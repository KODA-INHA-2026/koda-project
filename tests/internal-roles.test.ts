import { prepareInternalRoles } from '../apps/api/src/services/internal-access.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign, randomUUID } from 'node:crypto';
import { fromBase64Url, fileSha256, createSupportedPdf, pdfEntries, inspectPdf, verifySourceProof, MAX_PDF_BYTES } from '@koda/protocol';
import { openDatabase, insertPrincipal } from '../apps/api/src/repositories/database.js';
import { migrateSourceFiles, MockAnchorAdapter, sourceFile } from '../apps/api/src/services/source-file.js';
import { newIdentity } from '../apps/api/src/crypto/keys.js';
import { demoPeople, accountingPeople } from '../apps/api/src/fixtures/synthetic.js';
import { buildApp } from '../apps/api/src/app.js';

async function fixture(click=false){
  const db=openDatabase();migrateSourceFiles(db);prepareInternalRoles(db);let time=Date.now();const now=()=>time;
  const people=new Map([...demoPeople,...accountingPeople].map(p=>{const key=newIdentity();insertPrincipal(db,{...p,did:key.did,keyFile:p.id+'.json'});return[p.id,key];}));
  const issuer=newIdentity();db.prepare('INSERT INTO issuer_trust VALUES (?,?)').run(issuer.did,issuer.publicKey);db.prepare('INSERT INTO auditor_assignments VALUES (?,?)').run('tenant-a',people.get('auditor-b')!.did);
  const font=readFileSync('apps/web/public/fonts/PretendardVariable.ttf'),adapter=new MockAnchorAdapter(db,now);const origin='http://localhost:5186';
  const signingKey=createPrivateKey({key:Buffer.from(issuer.privateKey,'base64url'),format:'der',type:'pkcs8'});
  const app=buildApp({db,origin,now,demoWallet:click?(id,did,bytes)=>{const k=people.get(id)!;assert.equal(k.did,did);return sign(null,bytes,createPrivateKey({key:Buffer.from(k.privateKey,'base64url'),format:'der',type:'pkcs8'})).toString('base64url');}:undefined,issuer:{sign:b=>sign(null,b,signingKey).toString('base64url'),pdf:{internalRoles:true,font,issuerSigningDid:issuer.did,adapter},anchor:async()=>{throw new Error('EVM MUST NOT BE CALLED');}}});await app.ready();
  async function login(id:string){const k=people.get(id)!;const c=(await app.inject({method:'POST',url:'/api/auth/challenge',headers:{origin},payload:{did:k.did}})).json();const r=await app.inject({method:'POST',url:'/api/auth/verify',headers:{origin},payload:{challengeId:c.challengeId,signature:sign(null,fromBase64Url(c.signingBytes),createPrivateKey({key:Buffer.from(k.privateKey,'base64url'),format:'der',type:'pkcs8'})).toString('base64url')}});assert.equal(r.statusCode,200);return{origin,cookie:String(r.headers['set-cookie']).split(';')[0]!, 'x-csrf-token':r.json().csrf};}
  return{db,app,people,font,adapter,issuer,login,advance:(ms:number)=>time+=ms,close:async()=>{await app.close();db.close();}};
}


test('four roles: real authentication, internal handoff, restricted DTO, auditor direct original, revocation and expiry',async()=>{
 const f=await fixture();try{
  const ih=await f.login('issuer'),fh=await f.login('finance-a'),ch=await f.login('accounting-a'),foreign=await f.login('accounting-b'),ah=await f.login('auditor-b');
  const snap=(await f.app.inject({url:'/api/issuer/snapshots',headers:ih})).json()[0];
  await f.app.inject({method:'POST',url:'/api/issuer/evidence',headers:ih,payload:{snapshotId:snap.snapshotId,idempotencyKey:randomUUID()}});await f.app.issuerIdle();
  const id=snap.payload.evidenceId;const path=`/evidence/${id}/versions/1`;const internal='/api/finance'+path+'/internal-grants';
  const call=(method:'GET'|'POST',url:string,headers:typeof fh,payload?:object)=>f.app.inject({method,url,headers,payload});
  assert.equal((await call('GET','/api/accounting'+path,ch)).statusCode,403);
  assert.deepEqual((await call('GET','/api/accounting/evidence',ch)).json(),[]);
  assert.equal((await call('GET','/api/accounting/evidence',fh)).statusCode,403);
  const summary=(await call('GET','/api/finance'+path,fh)).json();assert.equal(summary.canHandoff,true);assert.equal(summary.canShare,false);assert.ok(!summary.journal);assert.equal(summary.assets[0].valuationAmount,'1942110000');
  const request={recipientDid:f.people.get('accounting-a')!.did,idempotencyKey:randomUUID()};
  for(const recipientDid of [f.people.get('accounting-b')!.did,f.people.get('auditor-b')!.did])assert.equal((await call('POST',internal,fh,{...request,recipientDid})).statusCode,403);
  assert.equal((await call('POST',internal,ch,request)).statusCode,403);
  assert.equal((await call('POST',internal,{...fh,'x-csrf-token':'invalid'},request)).statusCode,403);
  const created=await call('POST',internal,fh,request);assert.equal(created.statusCode,201);const parent=created.json();
  assert.equal((await call('POST',internal,fh,request)).json().id,parent.id);
  assert.equal((await call('POST',internal,fh,{...request,expiresAt:new Date(Date.now()+10000).toISOString()})).statusCode,409);
  const accounting=await call('GET','/api/accounting'+path,ch);assert.equal(accounting.statusCode,200);const allowed=accounting.json();assert.equal(allowed.journal.length,12);assert.deepEqual(Object.keys(allowed.journal[0]).sort(),['asset','occurredAt','quantity']);
  const raw=JSON.parse(String(f.db.prepare('SELECT payloadCanonical FROM evidence_versions').get()!.payloadCanonical));const file=sourceFile(f.db,id,1);
  for(const secret of [raw.assets[0].custodyAddress,raw.movements[0].counterpartyAddress,raw.movements[0].transactionReference,raw.movements[0].counterpartyName,file.proof.signature,String(f.db.prepare('SELECT salt FROM evidence_versions').get()!.salt)])assert.ok(!accounting.body.includes(secret));
  for(const key of ['payloadCanonical','salt','movements','sourceProof'])assert.ok(!(key in allowed));
  assert.equal((await call('GET','/api/accounting'+path,foreign)).statusCode,403);
  assert.equal((await call('GET','/api/issuer'+path+'/file',ch)).statusCode,403);
  const opened={viewId:randomUUID()};await call('POST','/api/accounting'+path+'/open',ch,opened);await call('POST','/api/accounting'+path+'/open',ch,opened);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM audit_events WHERE type='ACCOUNTING_OPENED'").get()!.n,1);
  assert.ok((await call('GET',internal,fh)).json()[0].firstOpenedAt);
  const external={auditorDid:f.people.get('auditor-b')!.did,idempotencyKey:randomUUID()};
  assert.equal((await call('POST','/api'+path+'/grants',fh,external)).statusCode,403);
  const response=await call('POST','/api'+path+'/grants',ch,external);assert.equal(response.statusCode,201);const grant=response.json();
  assert.ok(Date.parse(grant.grant.expiresAt)<=Date.parse(parent.expiresAt));
  assert.equal((await call('POST','/api/grants/open',ch,{token:grant.token})).statusCode,404);
  assert.equal((await call('POST','/api/grants/open',ah,{token:grant.token})).statusCode,200);
  assert.deepEqual((await call('GET','/api/grants/'+grant.grant.id+'/file',ah)).rawPayload,Buffer.from(file.bytes));
  assert.equal((await call('GET','/api/grants/'+grant.grant.id+'/file',ch)).statusCode,404);
  const record=await f.adapter.read(file.proof.fileHash);assert.equal((await inspectPdf(file.bytes,file.bytes,file.proof,raw,f.issuer.did,record,f.font)).status,'ORIGINAL_MATCH');
  assert.equal((await call('POST','/api/internal-grants/'+parent.id+'/revoke',foreign)).statusCode,403);
  assert.equal((await call('POST','/api/internal-grants/'+parent.id+'/revoke',fh)).statusCode,200);
  assert.equal((await call('GET','/api/accounting'+path,ch)).statusCode,403);
  assert.equal((await call('POST','/api'+path+'/grants',ch,{...external,idempotencyKey:randomUUID()})).statusCode,403);
  for(const endpoint of ['/file','/evidence','/anchor-record','/events'])assert.equal((await call('GET','/api/grants/'+grant.grant.id+endpoint,ah)).statusCode,410);
  // A later handoff does not revive a grant whose own parent was revoked.
  const next=await call('POST',internal,fh,{...request,idempotencyKey:randomUUID(),expiresAt:new Date(Date.now()+2000).toISOString()});assert.equal(next.statusCode,201);
  assert.equal((await call('GET','/api/grants/'+grant.grant.id+'/file',ah)).statusCode,410);
  f.advance(3000);assert.equal((await call('GET','/api/accounting'+path,ch)).statusCode,403);
 }finally{await f.close();}
});

test('internal handoff fails closed on record failure and rechecks authority after a delayed lookup',async()=>{
 const f=await fixture();try{
  const ih=await f.login('issuer'),fh=await f.login('finance-a'),ch=await f.login('accounting-a');
  const snap=(await f.app.inject({url:'/api/issuer/snapshots',headers:ih})).json()[0];await f.app.inject({method:'POST',url:'/api/issuer/evidence',headers:ih,payload:{snapshotId:snap.snapshotId,idempotencyKey:randomUUID()}});await f.app.issuerIdle();
  const path=`/evidence/${snap.payload.evidenceId}/versions/1`;const req={recipientDid:f.people.get('accounting-a')!.did,idempotencyKey:randomUUID()};
  const originalRead=f.adapter.read.bind(f.adapter);f.adapter.read=async()=>null;
  assert.equal((await f.app.inject({method:'POST',url:'/api/finance'+path+'/internal-grants',headers:fh,payload:req})).statusCode,409);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM internal_grants').get()!.n,0);f.adapter.read=originalRead;
  const parent=(await f.app.inject({method:'POST',url:'/api/finance'+path+'/internal-grants',headers:fh,payload:req})).json();
  let release!:()=>void;let reached!:()=>void;const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>reached=r);
  f.adapter.read=async hash=>{reached();await held;return originalRead(hash);};
  const response=f.app.inject({url:'/api/accounting'+path,headers:ch});const pending=Promise.resolve(response);await started;
  await f.app.inject({method:'POST',url:'/api/internal-grants/'+parent.id+'/revoke',headers:fh});release();assert.equal((await pending).statusCode,403);
 }finally{await f.close();}
});


test('click demo uses registry + actual challenge signature; never bypasses verify or accepts arbitrary signing',async()=>{
 const f=await fixture(true);try{
  const origin='http://localhost:5186';const post=(url:string,payload:object,source=origin)=>f.app.inject({method:'POST',url,headers:{origin:source},payload});
  assert.equal((await f.app.inject({url:'/api/demo/auth-mode'})).json().mode,'CLICK');
  const resolved=await post('/api/auth/demo-resolve',{principalId:'finance-a'});assert.equal(resolved.statusCode,200);assert.equal(resolved.json().mode,'MOCK');
  assert.equal((await f.app.inject({url:'/api/me'})).statusCode,401);
  assert.equal((await post('/api/auth/demo-resolve',{principalId:'finance-b'})).statusCode,400);
  assert.equal((await post('/api/auth/demo-resolve',{principalId:'finance-a'},'http://other.local')).statusCode,403);
  const c=(await post('/api/auth/challenge',{did:resolved.json().did})).json();
  const request={principalId:'finance-a',challengeId:c.challengeId};
  assert.equal((await post('/api/auth/demo-sign',{...request,bytes:'arbitrary'})).statusCode,400);
  assert.equal((await post('/api/auth/demo-sign',{...request,principalId:'accounting-a'})).statusCode,401);
  const signed=await post('/api/auth/demo-sign',request);assert.equal(signed.statusCode,200);assert.deepEqual(Object.keys(signed.json()).sort(),['mode','signature']);
  assert.equal((await f.app.inject({url:'/api/me'})).statusCode,401);
  const invalid=await post('/api/auth/verify',{challengeId:c.challengeId,signature:'A'.repeat(86)});assert.equal(invalid.statusCode,401);
  const ok=await post('/api/auth/verify',{challengeId:c.challengeId,signature:signed.json().signature});assert.equal(ok.statusCode,200);assert.equal(ok.json().principal.role,'FINANCE');
  assert.equal((await post('/api/auth/demo-sign',request)).statusCode,401);
  assert.equal((await post('/api/auth/verify',{challengeId:c.challengeId,signature:signed.json().signature})).statusCode,401);
  const next=(await post('/api/auth/challenge',{did:resolved.json().did})).json();f.advance(120001);
  assert.equal((await post('/api/auth/demo-sign',{...request,challengeId:next.challengeId})).statusCode,401);
  f.db.prepare('UPDATE principals SET active=0 WHERE id=?').run('finance-a');
  assert.equal((await post('/api/auth/demo-resolve',{principalId:'finance-a'})).statusCode,401);
  for(const k of f.people.values())for(const response of [resolved,signed,ok])assert.ok(!response.body.includes(k.privateKey));
 }finally{await f.close();}
 const disabled=await fixture();try{
  assert.equal((await disabled.app.inject({url:'/api/demo/auth-mode'})).json().mode,'FILE');
  assert.equal((await disabled.app.inject({method:'POST',url:'/api/auth/demo-resolve',headers:{origin:'http://localhost:5186'},payload:{principalId:'finance-a'}})).statusCode,404);
 }finally{await disabled.close();}
});
