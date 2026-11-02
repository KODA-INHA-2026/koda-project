import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign, randomUUID } from 'node:crypto';
import { fromBase64Url, fileSha256, createSupportedPdf, pdfEntries, inspectPdf, verifySourceProof, MAX_PDF_BYTES } from '@koda/protocol';
import { openDatabase, insertPrincipal } from '../apps/api/src/repositories/database.js';
import { migrateSourceFiles, MockAnchorAdapter, sourceFile } from '../apps/api/src/services/source-file.js';
import { newIdentity } from '../apps/api/src/crypto/keys.js';
import { demoPeople } from '../apps/api/src/fixtures/synthetic.js';
import { buildApp } from '../apps/api/src/app.js';

async function fixture(){
  const db=openDatabase();migrateSourceFiles(db);let time=Date.now();const now=()=>time;
  const people=new Map(demoPeople.map(p=>{const key=newIdentity();insertPrincipal(db,{...p,did:key.did,keyFile:p.id+'.json'});return[p.id,key];}));
  const issuer=newIdentity();db.prepare('INSERT INTO issuer_trust VALUES (?,?)').run(issuer.did,issuer.publicKey);db.prepare('INSERT INTO auditor_assignments VALUES (?,?)').run('tenant-a',people.get('auditor-b')!.did);
  const font=readFileSync('apps/web/public/fonts/PretendardVariable.ttf'),adapter=new MockAnchorAdapter(db,now);const origin='http://localhost:5186';
  const signingKey=createPrivateKey({key:Buffer.from(issuer.privateKey,'base64url'),format:'der',type:'pkcs8'});
  const app=buildApp({db,origin,now,issuer:{sign:b=>sign(null,b,signingKey).toString('base64url'),pdf:{font,issuerSigningDid:issuer.did,adapter},anchor:async()=>{throw new Error('EVM MUST NOT BE CALLED');}}});await app.ready();
  async function login(id:string){const k=people.get(id)!;const c=(await app.inject({method:'POST',url:'/api/auth/challenge',headers:{origin},payload:{did:k.did}})).json();const r=await app.inject({method:'POST',url:'/api/auth/verify',headers:{origin},payload:{challengeId:c.challengeId,signature:sign(null,fromBase64Url(c.signingBytes),createPrivateKey({key:Buffer.from(k.privateKey,'base64url'),format:'der',type:'pkcs8'})).toString('base64url')}});assert.equal(r.statusCode,200);return{origin,cookie:String(r.headers['set-cookie']).split(';')[0]!, 'x-csrf-token':r.json().csrf};}
  return{db,app,people,font,adapter,issuer,login,advance:(ms:number)=>time+=ms,close:async()=>{await app.close();db.close();}};
}

test('PRD T03–07,09–11,13–14: real issuance, fixed PDF proof, MOCK, allowlist, grants and three files',async()=>{
 const f=await fixture();try{
  const issuer=await f.login('issuer'),finance=await f.login('finance-a'),auditor=await f.login('auditor-b'),other=await f.login('auditor-c'),foreign=await f.login('finance-b');
  const snapshots=(await f.app.inject({url:'/api/issuer/snapshots',headers:issuer})).json();assert.equal(snapshots.length,1);const p=snapshots[0].payload;assert.equal(p.schemaVersion,'custody-demo/3');const base=`/api/issuer/evidence/${p.evidenceId}/versions/1`;
  const issue=()=>f.app.inject({method:'POST',url:'/api/issuer/evidence',headers:issuer,payload:{snapshotId:snapshots[0].snapshotId,idempotencyKey:'prd-test-idempotency-001'}});
  assert.equal((await issue()).statusCode,202);await f.app.issuerIdle();assert.equal((await f.app.inject({url:base,headers:issuer})).json().status,'CONFIRMED');
  const source=sourceFile(f.db,p.evidenceId,1),originalPayload=JSON.parse(String(f.db.prepare('SELECT payloadCanonical FROM evidence_versions').get()!.payloadCanonical));const record=await f.adapter.read(source.proof.fileHash);
  assert.equal(await fileSha256(source.bytes),source.proof.fileHash);assert.equal(source.proof.byteLength,source.bytes.length);assert.ok(source.bytes.length<MAX_PDF_BYTES);assert.ok(record);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM anchor_records').get()!.n,0);
  const first=Buffer.from(source.bytes);await issue();await f.app.issuerIdle();assert.deepEqual(Buffer.from(sourceFile(f.db,p.evidenceId,1).bytes),first);assert.throws(()=>f.db.prepare('UPDATE source_files SET bytes=?').run(new Uint8Array([1])));
  const summaryResponse=await f.app.inject({url:`/api/finance/evidence/${p.evidenceId}/versions/1`,headers:finance});assert.equal(summaryResponse.statusCode,200);const summary=summaryResponse.json();assert.equal(summary.assets[0].quantity,'12.4500');assert.equal(summary.movementCount,12);assert.equal(summary.fileHash,source.proof.fileHash);assert.ok(summary.valuationQuotedAt);assert.equal(summary.assets[0].custodyAddressMasked,originalPayload.assets[0].custodyAddress.slice(0,4)+'…'+originalPayload.assets[0].custodyAddress.slice(-4));
  for(const value of [originalPayload.assets[0].custodyAddress,originalPayload.movements[0].transactionReference,originalPayload.movements[0].counterpartyAddress,source.proof.signature])assert.ok(!summaryResponse.body.includes(value));for(const key of ['salt','payloadCanonical','sourceProof','movements'])assert.ok(!(key in summary));
  assert.equal((await f.app.inject({url:base+'/file',headers:finance})).statusCode,403);assert.equal((await f.app.inject({url:`/api/finance/evidence/${p.evidenceId}/versions/1`,headers:foreign})).statusCode,404);
  const grantRequest={auditorDid:f.people.get('auditor-b')!.did,idempotencyKey:randomUUID()};const grantUrl=`/api/evidence/${p.evidenceId}/versions/1/grants`;
  const gr=await f.app.inject({method:'POST',url:grantUrl,headers:finance,payload:grantRequest});assert.equal(gr.statusCode,201);const {grant,token}=gr.json();
  const replay=(await f.app.inject({method:'POST',url:grantUrl,headers:finance,payload:grantRequest})).json();assert.equal(replay.grant.id,grant.id);assert.ok(!replay.token);
  assert.equal((await f.app.inject({method:'POST',url:'/api/grants/open',headers:other,payload:{token}})).statusCode,404);
  const open=()=>f.app.inject({method:'POST',url:'/api/grants/open',headers:auditor,payload:{token,viewId:'logical-open-123456789'}});assert.equal((await open()).statusCode,200);await open();assert.equal(f.db.prepare("SELECT COUNT(*) n FROM audit_events WHERE type='OPENED'").get()!.n,1);
  const url='/api/grants/'+grant.id;const downloaded=await f.app.inject({url:url+'/file',headers:auditor});assert.equal(downloaded.headers['content-type'],'application/pdf');assert.deepEqual(downloaded.rawPayload,first);assert.equal(downloaded.headers['cache-control'],'no-store');
  const salt=String(f.db.prepare('SELECT salt FROM evidence_versions').get()!.salt);
  const inspect=(b:Uint8Array,r:import('@koda/protocol').MockAnchorRecord|null=record)=>inspectPdf(b,source.bytes,source.proof,originalPayload,f.issuer.did,r,f.font);
  assert.equal((await inspect(source.bytes)).status,'ORIGINAL_MATCH');
  const changed=structuredClone(originalPayload);changed.assets[0].quantity='15.4500';changed.assets[0].valuationAmount='2410088000';const modified=createSupportedPdf(pdfEntries(changed),f.font,salt,'modified');const diff=await inspect(modified);assert.equal(diff.status,'CONTENT_CHANGED');assert.deepEqual(diff.differences.map(d=>[d.field,d.before,d.after]),[['assets.0.quantity','12.4500','15.4500'],['assets.0.valuationAmount','1245000000','2410088000']]);
  const resaved=createSupportedPdf(pdfEntries(originalPayload),f.font,salt,'resaved');assert.notEqual(await fileSha256(resaved),source.proof.fileHash);assert.equal((await inspect(resaved)).status,'NON_ORIGINAL_COPY');
  assert.equal((await inspect(new Uint8Array([1,2,3]))).status,'COMPARISON_UNAVAILABLE');assert.equal((await inspect(Buffer.concat([first,Buffer.from('\n%hidden overlay')]))).status,'COMPARISON_UNAVAILABLE');
  const different=structuredClone(originalPayload);different.evidenceId='OTHER';assert.equal((await inspect(createSupportedPdf(pdfEntries(different),f.font,salt))).status,'COMPARISON_UNAVAILABLE');
  assert.equal((await inspect(new Uint8Array(MAX_PDF_BYTES+1))).status,'COMPARISON_UNAVAILABLE');assert.equal((await inspect(source.bytes,null)).status,'VERIFICATION_UNAVAILABLE');
  assert.equal(await verifySourceProof(source.bytes,{...source.proof,version:2},{evidenceId:p.evidenceId,version:1,issuerSigningDid:f.issuer.did}),false);assert.equal(await verifySourceProof(modified,source.proof,{evidenceId:p.evidenceId,version:1,issuerSigningDid:f.issuer.did}),false);
  const recordText=JSON.stringify(record);for(const v of [p.evidenceId,originalPayload.customerDisplayName,salt,originalPayload.assets[0].quantity])assert.ok(!recordText.includes(v));
  assert.equal((await f.app.inject({method:'POST',url:url+'/file-verification-events',headers:auditor,payload:{schemaVersion:'pdf-inspection/1',status:'CONTENT_CHANGED'}})).statusCode,204);assert.equal((await f.app.inject({url:url+'/events',headers:auditor})).json()[0].source,'CLIENT_REPORTED');
  f.db.prepare('DELETE FROM mock_anchors').run();assert.equal((await f.app.inject({url:url+'/anchor-record',headers:auditor})).statusCode,503);
  assert.equal((await f.app.inject({method:'POST',url:grantUrl,headers:finance,payload:{...grantRequest,idempotencyKey:randomUUID()}})).statusCode,409);
  assert.equal((await f.app.inject({method:'POST',url:url+'/revoke',headers:finance})).statusCode,200);for(const endpoint of ['/file','/evidence','/anchor-record','/events'])assert.equal((await f.app.inject({url:url+endpoint,headers:auditor})).statusCode,410);
 }finally{await f.close();}
});

test('PRD T03,06,10: failed MOCK write retains original; retry, expiry and binding failure',async()=>{
 const f=await fixture();try{const ih=await f.login('issuer'),fh=await f.login('finance-a'),ah=await f.login('auditor-b');const snap=(await f.app.inject({url:'/api/issuer/snapshots',headers:ih})).json()[0];
 f.db.exec("CREATE TRIGGER fail_record BEFORE INSERT ON mock_anchors BEGIN SELECT RAISE(ABORT,'test store failure'); END;");
 await f.app.inject({method:'POST',url:'/api/issuer/evidence',headers:ih,payload:{snapshotId:snap.snapshotId,idempotencyKey:randomUUID()}});await f.app.issuerIdle();const path=`/api/issuer/evidence/${snap.payload.evidenceId}/versions/1`;assert.equal((await f.app.inject({url:path,headers:ih})).json().status,'UNAVAILABLE');const saved=sourceFile(f.db,snap.payload.evidenceId,1);
 f.db.exec('DROP TRIGGER fail_record');await f.app.inject({method:'POST',url:path+'/retry',headers:ih});await f.app.issuerIdle();assert.equal((await f.app.inject({url:path,headers:ih})).json().status,'CONFIRMED');assert.deepEqual(sourceFile(f.db,snap.payload.evidenceId,1).bytes,saved.bytes);
 const grant=(await f.app.inject({method:'POST',url:`/api/evidence/${snap.payload.evidenceId}/versions/1/grants`,headers:fh,payload:{auditorDid:f.people.get('auditor-b')!.did,idempotencyKey:randomUUID(),expiresAt:new Date(Date.now()+2000).toISOString()}})).json().grant;
 f.advance(3000);assert.equal((await f.app.inject({url:'/api/grants/'+grant.id+'/file',headers:ah})).statusCode,410);
 }finally{await f.close();}
});
