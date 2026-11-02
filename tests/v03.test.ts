import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { maskAddress, canonicalJson, parseCanonical, validatePayload, evidenceFile, parseEvidenceFile, inspectEvidenceFile, MAX_EVIDENCE_FILE_BYTES, type AuditEnvelopeDTO, type EvidencePayload } from '@koda/protocol';
import { workflowFixture } from './workflow-fixture.js';

async function issued() {
  const f = await workflowFixture({ issuer: true });
  const issuer = await f.login('issuer'), finance = await f.login('finance-a');
  const candidate = (await f.app.inject({ url: '/api/issuer/snapshots', headers: issuer })).json().find((s: {snapshotId:string}) => s.snapshotId === 'GAON-Q3-V03');
  f.advance(1000);
  const response = await f.app.inject({ method: 'POST', url: '/api/issuer/evidence', headers: issuer, payload: { snapshotId: candidate.snapshotId, idempotencyKey: randomUUID() } }); assert.equal(response.statusCode, 202);
  await f.app.issuerIdle();
  const path = '/evidence/KODA-20260930-GAON/versions/1';
  const source = await f.app.inject({ url: '/api/issuer' + path + '/source', headers: issuer }); assert.equal(source.statusCode, 200);
  return { ...f, issuer, finance, candidate, path, envelope: source.json().envelope as AuditEnvelopeDTO };
}
test('v0.3 T-03/04/09/18: v2 issuance and M-01 allowlist, source restricted, immutable bytes retained', async () => {
  const f = await issued();
  try {
    const p = parseCanonical(f.envelope.payloadCanonical) as EvidencePayload; validatePayload(p);
    assert.equal(p.schemaVersion, 'custody-demo/2'); assert.equal(p.customerDisplayName, '㈜가온테크'); assert.notEqual(p.issuedAt, f.candidate.payload.issuedAt);
    assert.deepEqual(p.assets.map(a => a.quantity), ['12.4500','310.2000','1250000.00']); assert.deepEqual(p.assets.map(a => a.valuationAmount), ['1245000000','930600000','1750000000']); assert.equal(p.movements.length,12);
    for (const headers of [f.finance, await f.login('auditor-b'), await f.login('finance-b')]) assert.equal((await f.app.inject({ url: '/api/issuer' + f.path + '/source', headers })).statusCode,403);
    const r = await f.app.inject({ url: '/api/finance' + f.path, headers: f.finance }); assert.equal(r.statusCode,200);
    const body = r.json(); assert.equal(body.movementCount,12); assert.equal(body.commitment, JSON.parse(f.envelope.statementCanonical).commitment); assert.equal(body.anchor.txHash,f.envelope.anchorLocator.txHash);
    for (const a of p.assets) { assert.equal(body.assets.find((x:{code:string}) => x.code===a.code).custodyAddressMasked, maskAddress(a.custodyAddress)); assert.equal(r.body.includes(a.custodyAddress.slice(4,-4)),false); }
    for (const secret of [f.envelope.salt,f.envelope.payloadCanonical,...p.movements.flatMap(m=>[m.id,m.counterpartyName!,m.counterpartyAddress,m.transactionReference])]) assert.ok(!r.body.includes(secret));
    assert.doesNotMatch(r.body, /"(payloadCanonical|salt|signature|custodyAddress|movements|counterpartyAddress)"/);
    assert.throws(()=>f.db.prepare('UPDATE evidence_versions SET payloadCanonical=? WHERE evidenceId=?').run('{}',p.evidenceId),/Immutable/);
    assert.equal(f.db.prepare('SELECT count(*) n FROM evidence_versions WHERE evidenceId LIKE ?').get('KODA-20261031-%')!.n,2);
  } finally { await f.close(); }
});
test('v0.3 T-05/12/17: strict file format, real signatures, actual difference, pinned trust, baseline failure', async () => {
  const f = await issued();
  try {
    const anchor = async () => ({status:'PASS' as const, reasonCode:'UNIT_TEST_ANCHOR', evidence:{blockNumber:'1',blockHash:f.envelope.anchorLocator.blockHash,recordedAt:'2026-11-02T00:00:00.000Z'}});
    const normal = parseEvidenceFile(evidenceFile(f.envelope));
    assert.equal((await inspectEvidenceFile(normal,f.envelope,f.trusted,anchor)).result.status,'VALID');
    const changed = structuredClone(normal); const p = parseCanonical(changed.payloadCanonical) as EvidencePayload; p.assets.find(a=>a.code==='BTC')!.quantity='15.4500'; changed.payloadCanonical=canonicalJson(p);
    const inspected=await inspectEvidenceFile(parseEvidenceFile(evidenceFile(changed)),f.envelope,f.trusted,anchor);
    assert.equal(inspected.chainMismatch,true); assert.equal(inspected.result.reasonCode,'COMMITMENT_MISMATCH'); assert.equal(inspected.result.checks.at(-1)!.status,'NOT_RUN'); assert.deepEqual(inspected.differences,[{field:'BTC.quantity',before:'12.4500',after:'15.4500'}]);
    const unavailable=await inspectEvidenceFile(changed,f.envelope,f.trusted,async()=>({status:'UNAVAILABLE',reasonCode:'RPC_UNAVAILABLE'})); assert.equal(unavailable.chainMismatch,false); assert.deepEqual(unavailable.differences,[]); assert.equal(unavailable.result.status,'INVALID'); assert.equal(unavailable.baseline.status,'UNVERIFIABLE');
    await assert.rejects(inspectEvidenceFile({...normal,evidenceId:'OTHER'},f.envelope,f.trusted,anchor));
    for (const content of ['not json','%PDF', ' '.repeat(MAX_EVIDENCE_FILE_BYTES+1), '{"format":"koda-evidence-file/1","format":"koda-evidence-file/1"}', canonicalJson({format:'koda-evidence-file/1',envelope:normal,rpc:'http://evil'}),canonicalJson({format:'koda-evidence-file/1',envelope:{...normal,status:'VALID',publicKey:'evil'}})]) assert.throws(()=>parseEvidenceFile(content));
    const duplicate = structuredClone(p); duplicate.assets.push(duplicate.assets[0]!); assert.throws(()=>validatePayload(duplicate));
    const duplicateMove = structuredClone(p); duplicateMove.movements.push(duplicateMove.movements[0]!); assert.throws(()=>validatePayload(duplicateMove));
    assert.throws(()=>validatePayload({...p,valuationBasis:'MARKET'})); assert.throws(()=>validatePayload({...p,schemaVersion:'custody-demo/3'}));
    assert.equal((await inspectEvidenceFile(normal,f.envelope,f.trusted,anchor)).result.status,'VALID');
  } finally { await f.close(); }
});
test('v0.3 T-10/11/13/14: first/reopen idempotency, polling does not count, full-history first open, deny after revoke', async () => {
  const f = await issued();
  try {
    const made=await f.app.inject({method:'POST',url:'/api'+f.path+'/grants',headers:f.finance,payload:{auditorDid:f.identities.get('auditor-b')!.did,idempotencyKey:randomUUID()}}); assert.equal(made.statusCode,201);
    const {grant,token}=made.json(); assert.equal(grant.firstOpenedAt,null);
    const auditor=await f.login('auditor-b'), other=await f.login('auditor-c'), viewId=randomUUID();
    const open=()=>f.app.inject({method:'POST',url:'/api/grants/open',headers:auditor,payload:{token,viewId}});
    assert.equal((await open()).statusCode,200); await open();
    const url='/api/grants/'+grant.id;
    assert.equal((await f.app.inject({method:'POST',url:url+'/open',headers:auditor,payload:{viewId}})).statusCode,200);
    const count=()=>f.db.prepare("SELECT count(*) n FROM audit_events WHERE grantId=? AND type='OPENED'").get(grant.id)!.n;
    assert.equal(count(),1);
    for(let i=0;i<3;i++) assert.equal((await f.app.inject({url:url+'/evidence',headers:auditor})).statusCode,200);
    assert.equal(count(),1); f.advance(5000);
    await f.app.inject({method:'POST',url:url+'/open',headers:auditor,payload:{viewId:randomUUID()}}); assert.equal(count(),2);
    const access=(await f.app.inject({url:url+'/evidence',headers:auditor})).json(); assert.notEqual(access.grant.firstOpenedAt,access.grant.lastOpenedAt); assert.equal(access.authorizationCheckedAt,new Date(f.now()).toISOString());
    for(let i=0;i<110;i++) await f.app.inject({method:'POST',url:url+'/verification-events',headers:auditor,payload:{status:'VALID'}});
    const listed=(await f.app.inject({url:'/api/finance/grants',headers:f.finance})).json()[0]; assert.equal(listed.firstOpenedAt,access.grant.firstOpenedAt);
    assert.equal((await f.app.inject({method:'POST',url:url+'/open',headers:other,payload:{viewId:randomUUID()}})).statusCode,404);
    await f.app.inject({method:'POST',url:url+'/revoke',headers:f.finance});
    assert.equal((await f.app.inject({method:'POST',url:url+'/open',headers:auditor,payload:{viewId:randomUUID()}})).statusCode,410);
  } finally {await f.close();}
});
