import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { buildApp } from '../apps/api/src/app.ts';
import { openDatabase, insertPrincipal } from '../apps/api/src/repositories/database.ts';
import { newIdentity } from '../apps/api/src/crypto/keys.ts';
import { canonicalJson, fromBase64Url, type EvidencePayload, type Role } from '@koda/protocol';

const origin = 'http://localhost:5173';
const hidden = 'HIDDEN_SENTINEL_9384';
async function fixture() {
  let now = Date.parse('2026-11-02T00:00:00Z');
  const db = openDatabase();
  const identities = ['finance-a', 'finance-b', 'issuer', 'auditor-b'].map((id, index) => {
    const key = newIdentity();
    const role: Role = index < 2 ? 'FINANCE' : index === 2 ? 'ISSUER' : 'AUDITOR';
    insertPrincipal(db, { id, did: key.did, role, name: id, organizationId: index === 1 ? 'tenant-b' : 'tenant-a', organizationName: '가상 고객사', keyFile: id + '.json' });
    return { id, ...key };
  });
  for (const [id, tenant] of [['EV-A', 'tenant-a'], ['EV-B', 'tenant-b']]) {
    const payload: EvidencePayload = { schemaVersion: 'custody-demo/1', evidenceId: id!, version: 1, tenantId: tenant!, customerDisplayName: '가상 고객사', issuerSigningDid: identities[2]!.did,
      asOfAt: '2026-10-31T14:59:59.000Z', asOfTimeZone: 'Asia/Seoul', issuedAt: '2026-11-01T00:00:00.000Z',
      assets: [{ code: 'BTC', name: '비트코인', quantity: '12.50000000', custodyAddress: hidden + '_ADDRESS' }],
      movements: [{ id: 'm1', asset: 'BTC', quantity: '1', occurredAt: '2026-10-30T00:00:00.000Z', counterpartyAddress: hidden + '_COUNTERPARTY', transactionReference: hidden + '_TX' }], demo: true };
    db.prepare('INSERT INTO evidence_versions VALUES (?,?,?,?,?,?,?)').run(id!, 1, tenant!, canonicalJson(payload), hidden + '_SALT', canonicalJson({ commitment: 'public-commitment', anchorTarget: { instanceId: 'instance', chainId: 31337, contractAddress: 'public-contract' } }), hidden + '_SIGNATURE');
    db.prepare('INSERT INTO anchor_records VALUES (?,?,?,?,?,?)').run(id!, 1, id!, 'tx', 'block', 'instance');
  }
  const app = buildApp({ db, origin, now: () => now });
  await app.ready();
  const challenge = async (index = 0) => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin }, payload: { did: identities[index]!.did } });
    assert.equal(res.statusCode, 200);
    return res.json();
  };
  const response = (c: { challengeId: string; signingBytes: string }, index = 0) => ({ challengeId: c.challengeId, signature: sign(null, fromBase64Url(c.signingBytes), createPrivateKey({ key: Buffer.from(identities[index]!.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url') });
  const login = async (index = 0) => {
    const c = await challenge(index);
    const res = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: response(c, index) });
    assert.equal(res.statusCode, 200);
    return { cookie: res.headers['set-cookie']!.toString().split(';')[0]!, csrf: res.json().csrf, res };
  };
  return { app, db, identities, challenge, response, login, advance: (ms: number) => { now += ms; }, close: async () => { await app.close(); db.close(); } };
}

test('T-01 / T-09: migration repeatable; finance DTO excludes all private data', async () => {
  const f = await fixture();
  try {
    assert.equal(f.db.prepare('SELECT count(*) as n FROM schema_migrations').get()!.n, 3);
    const { cookie } = await f.login();
    for (const url of ['/api/finance/evidence', '/api/finance/evidence/EV-A/versions/1']) {
      const res = await f.app.inject({ url, headers: { cookie } });
      assert.equal(res.statusCode, 200); assert.equal(res.headers['cache-control'], 'no-store');
      assert.equal(res.body.includes(hidden), false);
      assert.equal(res.body.includes('"custodyAddress"'), false);
      assert.match(res.body, /12.50000000/); assert.match(res.body, /"…RESS"/); assert.match(res.body, /movementCount/);
    }
    assert.throws(() => f.db.prepare('UPDATE evidence_versions SET salt=?').run('changed'), /Immutable/);
  } finally { await f.close(); }
});

test('T-02: wrong key, malformed DID, expired and concurrently replayed nonce rejected', async () => {
  const f = await fixture();
  try {
    const badDid = await f.app.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin }, payload: { did: 'did:web:evil' } });
    assert.equal(badDid.statusCode, 400);
    const c = await f.challenge();
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: f.response(c, 1) })).statusCode, 401);
    const replay = await Promise.all([1, 2].map(() => f.app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: f.response(c) })));
    assert.deepEqual(replay.map(r => r.statusCode).sort(), [200, 401]);
    const exp = await f.challenge(); f.advance(90_000);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: f.response(exp) })).statusCode, 401);
  } finally { await f.close(); }
});

test('T-02: strict Origin/CSRF, role injection, logout and session deadline', async () => {
  const f = await fixture();
  try {
    for (const headers of [{}, { origin: 'http://evil.test' }]) assert.equal((await f.app.inject({ method: 'POST', url: '/api/auth/challenge', headers, payload: { did: f.identities[0]!.did } })).statusCode, 403);
    const c = await f.challenge();
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: { ...f.response(c), role: 'AUDITOR' } })).statusCode, 400);
    const { cookie, csrf, res } = await f.login();
    assert.match(res.headers['set-cookie']!.toString(), /HttpOnly/); assert.match(res.headers['set-cookie']!.toString(), /SameSite=Strict/); assert.match(res.headers['set-cookie']!.toString(), /Path=\/api/);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, origin } })).statusCode, 403);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, origin, 'x-csrf-token': csrf } })).statusCode, 204);
    assert.equal((await f.app.inject({ url: '/api/me', headers: { cookie } })).statusCode, 401);
    const next = await f.login(); f.advance(30 * 60_000);
    assert.equal((await f.app.inject({ url: '/api/me', headers: { cookie: next.cookie } })).statusCode, 401);
  } finally { await f.close(); }
});

test('T-03: every request uses current principal role, tenant and active status', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.app.inject({ url: '/api/finance/evidence' })).statusCode, 401);
    const { cookie } = await f.login();
    for (const url of ['/api/finance/evidence/EV-B/versions/1', '/api/finance/evidence/EV-A/versions/2', '/api/grants/anything/evidence']) {
      const res = await f.app.inject({ url, headers: { cookie } }); assert.equal(res.statusCode, 404); assert.equal(res.body.includes(hidden), false);
    }
    const injection = await f.app.inject({ url: '/api/finance/evidence?role=AUDITOR&tenantId=tenant-b&full=true', headers: { cookie } }); assert.equal(injection.statusCode, 400);
    for (const index of [2, 3]) { const other = await f.login(index); assert.equal((await f.app.inject({ url: '/api/finance/evidence', headers: { cookie: other.cookie } })).statusCode, 403); }
    f.db.prepare("UPDATE principals SET role='AUDITOR' WHERE id='finance-a'").run();
    assert.equal((await f.app.inject({ url: '/api/finance/evidence', headers: { cookie } })).statusCode, 403);
    f.db.prepare("UPDATE principals SET active=0 WHERE id='finance-a'").run();
    assert.equal((await f.app.inject({ url: '/api/me', headers: { cookie } })).statusCode, 401);
  } finally { await f.close(); }
});
