import { createPrivateKey, sign, randomBytes } from 'node:crypto';
import { canonicalJson, commitmentBytes, fromBase64Url, toBase64Url, type TrustedConfig, type EvidencePayload } from '@koda/protocol';
import { newIdentity, hash } from '../apps/api/src/crypto/keys.js';
import { openDatabase, insertPrincipal } from '../apps/api/src/repositories/database.js';
import { syntheticPayload, demoPeople } from '../apps/api/src/fixtures/synthetic.js';
import { buildApp } from '../apps/api/src/app.js';
import { AnchorJobError } from '@koda/chain/issuance';

export async function workflowFixture(options: { issuer?: boolean; unavailable?: () => boolean } = {}) {
  let time = Date.now(); const db = openDatabase();
  const identities = new Map(demoPeople.map(p => {
    const key = newIdentity(); insertPrincipal(db, { ...p, did: key.did, keyFile: p.id + '.json' }); return [p.id, key];
  }));
  db.prepare('INSERT INTO auditor_assignments VALUES (?,?)').run('tenant-a', identities.get('auditor-b')!.did);
  const issuer = newIdentity();
  const hex = (byte: string, count = 32) => '0x' + byte.repeat(count) as `0x${string}`;
  const trusted: TrustedConfig = { chainId: 31337, contractAddress: hex('11', 20), instanceId: hex('22'), writer: hex('33', 20), deploymentTx: hex('44'), deploymentBlockHash: hex('55'), deploymentBlockNumber: '1', rpc: 'http://127.0.0.1:18545', issuerSigningDid: issuer.did };
  db.prepare('INSERT INTO issuer_trust VALUES (?,?)').run(issuer.did, issuer.publicKey);
  const payloads: EvidencePayload[] = [];
  for (const tenant of ['a','b'] as const) {
    const p = syntheticPayload(tenant, issuer.did); payloads.push(p);
    const salt = toBase64Url(randomBytes(32)); const commitment = '0x' + hash(commitmentBytes(p, salt));
    const statement = canonicalJson({ domain: 'KODA-CUSTODY-DEMO-STATEMENT-v1', schemaVersion: p.schemaVersion, evidenceId: p.evidenceId, version: p.version, tenantId: p.tenantId, issuerSigningDid: issuer.did, commitmentAlgorithm: 'SHA-256', commitment, anchorTarget: { chainId: trusted.chainId, contractAddress: trusted.contractAddress, instanceId: trusted.instanceId } });
    const signature = sign(null, Buffer.from(statement), createPrivateKey({ key: Buffer.from(issuer.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
    db.prepare('INSERT INTO evidence_versions VALUES (?,?,?,?,?,?,?)').run(p.evidenceId, p.version, p.tenantId, canonicalJson(p), salt, statement, signature);
    db.prepare('INSERT INTO anchor_records VALUES (?,?,?,?,?,?)').run(p.evidenceId, p.version, commitment, hex('66'), hex('77'), trusted.instanceId);
  }
  const origin = 'http://localhost:5174';
  const app = buildApp({ db, origin, trusted, now: () => time, anchor: async () => ({ status: 'PASS', reasonCode: 'UNIT_TEST_ANCHOR' }), issuer: options.issuer ? {
    sign: bytes => sign(null, bytes, createPrivateKey({ key: Buffer.from(issuer.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url'),
    anchor: async (_commitment, _tx, sent) => { if (options.unavailable?.()) throw new AnchorJobError('UNAVAILABLE', 'RPC_UNAVAILABLE'); sent(hex('88')); return { txHash: hex('88'), blockHash: hex('99'), instanceId: trusted.instanceId }; },
  } : undefined });
  await app.ready();
  async function login(id: string) {
    const key = identities.get(id)!;
    const c = (await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin }, payload: { did: key.did } })).json();
    const signature = sign(null, fromBase64Url(c.signingBytes), createPrivateKey({ key: Buffer.from(key.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
    const res = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: { challengeId: c.challengeId, signature } });
    if (res.statusCode !== 200) throw new Error('Fixture signature authentication failed');
    return { cookie: res.headers['set-cookie']!.toString().split(';')[0]!, origin, 'x-csrf-token': res.json().csrf as string };
  }
  return { app, db, identities, trusted, payloads, login, now: () => time, advance: (ms: number) => { time += ms; }, close: async () => { await app.close(); db.close(); } };
}
