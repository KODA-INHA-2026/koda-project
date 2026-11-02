import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign, randomUUID } from 'node:crypto';
import { canonicalJson, commitmentBytes, fromBase64Url, type EvidencePayload } from '@koda/protocol';
import { openDatabase } from '../apps/api/src/repositories/database.js';
import { verifyDid, hash } from '../apps/api/src/crypto/keys.js';
import { anchorAbi, chainClients, checkInstance, type TrustedConfig } from '../packages/chain/src/client.js';
import { buildApp } from '../apps/api/src/app.js';
import { testDataDir, testOrigin } from './test-environment.js';
import { join } from 'node:path';
import { anchorReader } from '../packages/chain/src/reader.js';
import { verifyEnvelope } from '@koda/protocol';

const config = JSON.parse(readFileSync(join(testDataDir, 'trusted.json'),'utf8')) as TrustedConfig;
await checkInstance(config);
const { publicClient } = chainClients(config.rpc);
const db = openDatabase(join(testDataDir, 'demo.sqlite'));
const app = buildApp({ db, origin: testOrigin, trusted: config, anchor: anchorReader(config) });
async function loginAs(person: string) {
  const key = JSON.parse(readFileSync(join(testDataDir, 'keys', person + '.json'), 'utf8'));
  const challenge = (await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin: testOrigin }, payload: { did: key.did } })).json();
  const signature = sign(null, fromBase64Url(challenge.signingBytes), createPrivateKey({ key: Buffer.from(key.pkcs8, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
  const login = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: testOrigin }, payload: { challengeId: challenge.challengeId, signature } });
  assert.equal(login.statusCode, 200);
  return { origin: testOrigin, cookie: login.headers['set-cookie']!.toString().split(';')[0]!, 'x-csrf-token': login.json().csrf as string };
}
try {
  const rows = db.prepare('SELECT * FROM evidence_versions').all();
  assert.ok(rows.length >= 2);
  for (const row of rows) {
    const payload = JSON.parse(String(row.payloadCanonical)) as EvidencePayload;
    assert.equal(canonicalJson(payload), row.payloadCanonical);
    const statement = JSON.parse(String(row.statementCanonical));
    assert.equal(statement.commitment, '0x' + hash(commitmentBytes(payload, String(row.salt))));
    assert.equal(statement.issuerSigningDid, config.issuerSigningDid);
    assert.equal(verifyDid(config.issuerSigningDid, new TextEncoder().encode(String(row.statementCanonical)), fromBase64Url(String(row.signature))), true);
    assert.equal(await publicClient.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'isAnchored', args: [statement.commitment] }), true);
  }
  const finance = await loginAs('finance-a'); const auditor = await loginAs('auditor-b');
  const { cookie } = finance;
  const response = await app.inject({ url: '/api/finance/evidence', headers: { cookie } });
  assert.equal(response.statusCode, 200); assert.ok(response.json().length >= 1); assert.equal(response.body.includes('SYNTHETIC_PRIVATE_'), false);
  assert.equal((await app.inject({ url: '/api/finance/evidence/KODA-20261031-002/versions/1', headers: { cookie } })).statusCode, 404);
  const verified = await app.inject({ method: 'POST', url: '/api/finance/evidence/KODA-20261031-001/versions/1/verify', headers: finance });
  assert.equal(verified.statusCode, 200); assert.equal(verified.json().status, 'VALID');
  const recipients = (await app.inject({ url: '/api/finance/auditors', headers: finance })).json();
  const made = await app.inject({ method: 'POST', url: '/api/evidence/KODA-20261031-001/versions/1/grants', headers: finance, payload: { auditorDid: recipients[0].did, idempotencyKey: randomUUID() } });
  assert.equal(made.statusCode, 201);
  const { grant, token } = made.json();
  const opened = await app.inject({ method: 'POST', url: '/api/grants/open', headers: auditor, payload: { token } });
  assert.equal(opened.statusCode, 200);
  assert.equal((await verifyEnvelope(opened.json().envelope, config, { mode: 'CLIENT_DIRECT', anchor: anchorReader(config) })).status, 'VALID');
  assert.equal((await app.inject({ method: 'POST', url: '/api/grants/' + grant.id + '/revoke', headers: finance })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/grants/' + grant.id + '/evidence', headers: auditor })).statusCode, 410);
  for (const headers of [finance, auditor]) await app.inject({ method: 'POST', url: '/api/auth/logout', headers });
  console.log('D-01–D-04 smoke PASS: persisted signatures and actual chain, challenge authentication, tenant-safe finance DTO, server verification, recipient share/open, local crypto+RPC verification and revoke. Browser user issuance and exception coverage run in separate suites.');
} finally { await app.close(); db.close(); }
