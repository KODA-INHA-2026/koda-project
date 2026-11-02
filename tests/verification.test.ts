import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createPrivateKey, sign } from 'node:crypto';
import { canonicalJson, commitmentBytes, toBase64Url, verifyEnvelope, type AuditEnvelopeDTO, type TrustedConfig } from '../packages/protocol/src/index.ts';
import { newIdentity, hash } from '../apps/api/src/crypto/keys.ts';
import { syntheticPayload } from '../apps/api/src/fixtures/synthetic.ts';

export function verificationFixture() {
  const issuer = newIdentity();
  const trust: TrustedConfig = { chainId: 31337, contractAddress: '0x' + '11'.repeat(20) as `0x${string}`, instanceId: '0x' + '22'.repeat(32) as `0x${string}`, writer: '0x' + '33'.repeat(20) as `0x${string}`, deploymentTx: '0x' + '44'.repeat(32) as `0x${string}`, deploymentBlockHash: '0x' + '55'.repeat(32) as `0x${string}`, deploymentBlockNumber: '1', rpc: 'http://127.0.0.1:18545', issuerSigningDid: issuer.did };
  const payload = syntheticPayload('a', issuer.did);
  const salt = toBase64Url(randomBytes(32));
  const commitment = '0x' + hash(commitmentBytes(payload, salt));
  const statementCanonical = canonicalJson({ domain: 'KODA-CUSTODY-DEMO-STATEMENT-v1', schemaVersion: payload.schemaVersion, evidenceId: payload.evidenceId, version: payload.version, tenantId: payload.tenantId, issuerSigningDid: issuer.did, commitmentAlgorithm: 'SHA-256', commitment, anchorTarget: { chainId: trust.chainId, contractAddress: trust.contractAddress, instanceId: trust.instanceId } });
  const signature = sign(null, Buffer.from(statementCanonical), createPrivateKey({ key: Buffer.from(issuer.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
  const envelope: AuditEnvelopeDTO = { evidenceId: payload.evidenceId, version: payload.version, tenantId: payload.tenantId, payloadCanonical: canonicalJson(payload), salt, statementCanonical, signature, anchorLocator: { txHash: '0x' + '66'.repeat(32) as `0x${string}`, blockHash: '0x' + '77'.repeat(32) as `0x${string}`, instanceId: trust.instanceId } };
  return { envelope, trust, payload };
}

test('T-05/T-12: real canonical bytes, pinned issuer, signature and commitment; no server status trusted', async () => {
  const f = verificationFixture();
  const run = (envelope = f.envelope, trust = f.trust) => verifyEnvelope(envelope, trust, { mode: 'CLIENT_DIRECT', anchor: async () => ({ status: 'PASS', reasonCode: 'ANCHOR_CONFIRMED' }) });
  assert.equal((await run()).status, 'VALID');
  for (const changed of [
    { ...f.envelope, payloadCanonical: canonicalJson({ ...f.payload, assets: f.payload.assets.map(a => ({ ...a, quantity: '0' })) }) },
    { ...f.envelope, salt: toBase64Url(randomBytes(32)) },
    { ...f.envelope, signature: toBase64Url(randomBytes(64)) },
    { ...f.envelope, evidenceId: 'OTHER' },
    { ...f.envelope, statementCanonical: f.envelope.statementCanonical.replace('31337', '31338') },
  ]) assert.equal((await run(changed)).status, 'INVALID');
  assert.equal((await run(f.envelope, { ...f.trust, issuerSigningDid: newIdentity().did })).status, 'INVALID');
  const attacker = newIdentity();
  const resigned = sign(null, Buffer.from(f.envelope.statementCanonical), createPrivateKey({ key: Buffer.from(attacker.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
  assert.equal((await run({ ...f.envelope, signature: resigned })).status, 'INVALID');
  const falselyMarked = { ...f.envelope, signature: resigned, status: 'VALID' };
  assert.equal((await run(falselyMarked)).status, 'INVALID');
  assert.equal((await run(verificationFixture().envelope)).status, 'INVALID');
  const nonCanonical = { ...f.envelope, payloadCanonical: '{"demo":true,' + f.envelope.payloadCanonical.slice(1) };
  assert.notEqual((await run(nonCanonical)).status, 'VALID');
});

test('T-07/T-12: RPC/no record/reset are UNVERIFIABLE; later checks never fabricated after failure', async () => {
  const f = verificationFixture();
  for (const reasonCode of ['RPC_UNAVAILABLE', 'RECORD_NOT_FOUND', 'CHAIN_INSTANCE_CHANGED']) {
    const result = await verifyEnvelope(f.envelope, f.trust, { mode: 'SERVER_MEDIATED', anchor: async () => ({ status: 'UNAVAILABLE', reasonCode }) });
    assert.equal(result.status, 'UNVERIFIABLE'); assert.equal(result.reasonCode, reasonCode);
  }
  let called = false;
  const result = await verifyEnvelope({ ...f.envelope, signature: toBase64Url(randomBytes(64)) }, f.trust, { mode: 'CLIENT_DIRECT', anchor: async () => { called = true; throw new Error('must not run'); } });
  assert.equal(result.status, 'INVALID'); assert.equal(called, false); assert.equal(result.checks.at(-1)?.status, 'NOT_RUN');
});
