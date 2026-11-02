import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { workflowFixture } from './workflow-fixture.js';

test('T-04: issuer-only candidate issuance, duplicate submits and immutable new version', async () => {
  const f = await workflowFixture({ issuer: true });
  try {
    const issuer = await f.login('issuer'); const finance = await f.login('finance-a');
    assert.equal((await f.app.inject({ url: '/api/issuer/snapshots', headers: finance })).statusCode, 403);
    const list = await f.app.inject({ url: '/api/issuer/snapshots', headers: issuer }); assert.equal(list.statusCode, 200);
    const candidate = list.json().find((s: { snapshotId: string }) => s.snapshotId === 'SYNTHETIC-a-V2'); assert.equal(candidate.payload.version, 2);
    const body = { snapshotId: candidate.snapshotId, idempotencyKey: randomUUID() };
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/issuer/evidence', headers: finance, payload: body })).statusCode, 403);
    const responses = await Promise.all([1,2].map(() => f.app.inject({ method: 'POST', url: '/api/issuer/evidence', headers: issuer, payload: body })));
    assert.ok(responses.every(r => r.statusCode === 202 || r.statusCode === 200));
    assert.equal(responses[0]!.json().evidenceId, candidate.payload.evidenceId);
    await f.app.issuerIdle();
    const url = `/api/issuer/evidence/${candidate.payload.evidenceId}/versions/2`;
    const done = await f.app.inject({ url, headers: issuer }); assert.equal(done.json().status, 'CONFIRMED');
    assert.equal(f.db.prepare('SELECT count(*) n FROM evidence_versions WHERE evidenceId=? AND version=2').get(candidate.payload.evidenceId)!.n, 1);
    assert.equal(f.db.prepare('SELECT count(*) n FROM evidence_versions WHERE evidenceId=? AND version=1').get(candidate.payload.evidenceId)!.n, 1);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/issuer/evidence', headers: issuer, payload: { ...body, snapshotId: 'OTHER' } })).statusCode, 409);
    assert.throws(() => f.db.prepare('UPDATE evidence_versions SET salt=? WHERE version=2').run('changed'), /Immutable/);
  } finally { await f.close(); }
});

test('T-04/07/08: unavailable issuance retains fixed bytes; explicit retry resumes same job', async () => {
  let unavailable = true;
  const f = await workflowFixture({ issuer: true, unavailable: () => unavailable });
  try {
    const issuer = await f.login('issuer'); const finance = await f.login('finance-a');
    const candidate = (await f.app.inject({ url: '/api/issuer/snapshots', headers: issuer })).json().find((s: { snapshotId: string }) => s.snapshotId === 'SYNTHETIC-a-V2');
    const body = { snapshotId: candidate.snapshotId, idempotencyKey: randomUUID() };
    await f.app.inject({ method: 'POST', url: '/api/issuer/evidence', headers: issuer, payload: body }); await f.app.issuerIdle();
    const url = `/api/issuer/evidence/${candidate.payload.evidenceId}/versions/2`;
    assert.equal((await f.app.inject({ url, headers: issuer })).json().status, 'UNAVAILABLE');
    const before = f.db.prepare('SELECT * FROM evidence_versions WHERE evidenceId=? AND version=2').get(candidate.payload.evidenceId);
    const grant = await f.app.inject({ method: 'POST', url: `/api/evidence/${candidate.payload.evidenceId}/versions/2/grants`, headers: finance, payload: { auditorDid: f.identities.get('auditor-b')!.did, idempotencyKey: randomUUID() } }); assert.equal(grant.statusCode, 409);
    unavailable = false;
    assert.equal((await f.app.inject({ method: 'POST', url: url + '/retry', headers: issuer })).statusCode, 202);
    await f.app.issuerIdle(); assert.equal((await f.app.inject({ url, headers: issuer })).json().status, 'CONFIRMED');
    assert.deepEqual(f.db.prepare('SELECT * FROM evidence_versions WHERE evidenceId=? AND version=2').get(candidate.payload.evidenceId), before);
  } finally { await f.close(); }
});
