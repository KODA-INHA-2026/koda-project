import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { workflowFixture } from './workflow-fixture.js';
const path = '/api/evidence/KODA-20261031-001/versions/1/grants';

test('T-10/11/13/14: recipient-bound sharing, retry without stored token, open, report, revoke and tenant events', async () => {
  const f = await workflowFixture();
  try {
    const finance = await f.login('finance-a'); const auditor = await f.login('auditor-b'); const other = await f.login('auditor-c'); const tenantB = await f.login('finance-b');
    const payload = { auditorDid: f.identities.get('auditor-b')!.did, expiresAt: new Date(f.now() + 60_000).toISOString(), idempotencyKey: randomUUID() };
    const create = () => f.app.inject({ method: 'POST', url: path, headers: finance, payload });
    const made = await create(); assert.equal(made.statusCode, 201);
    const { grant, token } = made.json(); assert.equal(typeof token, 'string');
    const repeated = await create(); assert.equal(repeated.statusCode, 200); assert.equal(repeated.json().grant.id, grant.id); assert.equal(repeated.json().token, undefined);
    assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM share_grants').all()).includes(token), false);
    assert.equal((await f.app.inject({ method: 'POST', url: path, headers: finance, payload: { ...payload, expiresAt: new Date(f.now()+90_000).toISOString() } })).statusCode, 409);
    for (const headers of [{ origin: finance.origin }, other, finance]) {
      const blocked = await f.app.inject({ method: 'POST', url: '/api/grants/open', headers, payload: { token } });
      assert.ok([401,404].includes(blocked.statusCode)); assert.equal(blocked.body.includes('SYNTHETIC_PRIVATE_'), false);
    }
    const opened = await f.app.inject({ method: 'POST', url: '/api/grants/open', headers: auditor, payload: { token } });
    assert.equal(opened.statusCode, 200); assert.equal(opened.json().grant.id, grant.id); assert.ok(opened.body.includes('SYNTHETIC_PRIVATE_'));
    assert.equal((await f.app.inject({ url: `/api/grants/${grant.id}/evidence`, headers: other })).statusCode, 404);
    assert.equal((await f.app.inject({ url: `/api/grants/${grant.id}/evidence?version=2`, headers: auditor })).statusCode, 400);
    const report = await f.app.inject({ method: 'POST', url: `/api/grants/${grant.id}/verification-events`, headers: auditor, payload: { status: 'VALID' } }); assert.equal(report.statusCode, 204);
    assert.equal((await f.app.inject({ method: 'POST', url: `/api/grants/${grant.id}/revoke`, headers: tenantB })).statusCode, 404);
    assert.equal((await f.app.inject({ method: 'POST', url: `/api/grants/${grant.id}/revoke`, headers: finance })).statusCode, 200);
    assert.equal((await f.app.inject({ url: `/api/grants/${grant.id}/evidence`, headers: auditor })).statusCode, 410);
    assert.equal((await f.app.inject({ url: `/api/grants/${grant.id}/evidence`, headers: other })).statusCode, 404);
    const events = await f.app.inject({ url: '/api/finance/events', headers: finance });
    assert.match(events.body, /CLIENT_REPORTED/); assert.match(events.body, /GRANT_REVOKED/); assert.equal(events.body.includes(token), false); assert.equal(events.body.includes('SYNTHETIC_PRIVATE_'), false);
    const unrelated = await f.app.inject({ url: '/api/finance/events', headers: tenantB }); assert.equal(unrelated.body.includes(grant.id), false);
  } finally { await f.close(); }
});

test('T-10/13: strict scope, assignment, expiry boundary, CSRF and pending versions', async () => {
  const f = await workflowFixture();
  try {
    const finance = await f.login('finance-a'); const auditor = await f.login('auditor-b');
    const good = { auditorDid: f.identities.get('auditor-b')!.did, expiresAt: new Date(f.now()+1000).toISOString(), idempotencyKey: randomUUID() };
    for (const payload of [ { ...good, role: 'AUDITOR' }, { ...good, scope: 'ALL' }, { ...good, auditorDid: f.identities.get('auditor-c')!.did }, { ...good, expiresAt: new Date(f.now()).toISOString() }, { ...good, expiresAt: new Date(f.now()+8*24*60*60_000).toISOString() } ]) {
      const response = await f.app.inject({ method: 'POST', url: path, headers: finance, payload }); assert.ok([400,403].includes(response.statusCode));
    }
    assert.equal((await f.app.inject({ method: 'POST', url: path, headers: { cookie: finance.cookie, origin: finance.origin }, payload: good })).statusCode, 403);
    assert.equal((await f.app.inject({ method: 'POST', url: path.replace('001','002'), headers: finance, payload: good })).statusCode, 404);
    const made = await f.app.inject({ method: 'POST', url: path, headers: finance, payload: good }); assert.equal(made.statusCode, 201);
    const id = made.json().grant.id;
    f.advance(999); assert.equal((await f.app.inject({ url: `/api/grants/${id}/evidence`, headers: auditor })).statusCode, 200);
    f.advance(1); assert.equal((await f.app.inject({ url: `/api/grants/${id}/evidence`, headers: auditor })).statusCode, 410);
    f.db.prepare('DELETE FROM anchor_records WHERE evidenceId=?').run('KODA-20261031-001');
    assert.equal((await f.app.inject({ method: 'POST', url: path, headers: finance, payload: { ...good, idempotencyKey: randomUUID(), expiresAt: new Date(f.now()+1000).toISOString() } })).statusCode, 409);
  } finally { await f.close(); }
});
