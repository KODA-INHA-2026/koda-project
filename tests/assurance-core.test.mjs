import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=path.join(project,'landing','dist');
const clone=v=>JSON.parse(JSON.stringify(v));
const source=await fs.readFile(path.join(publicDir,'assurance-core.js'),'utf8');
const fixture=JSON.parse(await fs.readFile(path.join(publicDir,'assets','assurance-fixtures.json'),'utf8'));
const keyring=JSON.parse(await fs.readFile(path.join(publicDir,'assets','assurance-keyring.json'),'utf8'));
async function boot(customKeys=keyring){
 const requested=[];
 const context=vm.createContext({crypto:webcrypto,TextEncoder,URL,atob,btoa,console,document:{currentScript:{src:'https://local-sample.invalid/assurance-core.js'}},fetch:async url=>{
  requested.push(String(url));const filename=new URL(url).pathname.split('/').at(-1);
  assert.ok(['assurance-fixtures.json','assurance-keyring.json'].includes(filename),'Unexpected request');
  return {ok:true,json:async()=>clone(filename==='assurance-fixtures.json'?fixture:customKeys)};
 }});
 vm.runInContext(source,context,{filename:'assurance-core.js'});await context.KODA_ASSURANCE.ready;
 assert.equal(requested.length,2);return context.KODA_ASSURANCE;
}
const api=await boot();
const find=(result,id)=>result.checks.find(c=>c.id===id);
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
const rehash=output=>{delete output.outputDigest;output.outputDigest=createHash('sha256').update(canonical(output)).digest('hex');return output;};
for(const id of ['export','game','audit']){
 test(id+': normal source signature and all exact facts pass',async()=>{
  const r=await api.verify(id,'normal');assert.equal(r.passed,true);assert.equal(r.signatureVerified,true);assert.ok(r.checks.every(c=>c.passed===true&&c.status==='passed'));
  assert.equal(r.issuer.label,'산학프로젝트 샘플 발급키');assert.match(r.issuer.fingerprint,/^[0-9a-f]{64}$/);
  for(const [key,value]of Object.entries({sourceSignatureOnly:true,actualKODA:false,actualWalletOwnership:false,chainExecution:false,externalExecution:false,privacy:false,zeroKnowledge:false,zkProof:null,assurance:'NONE'}))assert.equal(r[key],value);
 });
 test(id+': a middle character lookalike fails despite same prefix/suffix and valid source signature',async()=>{
  const c=api.getCase(id,'lookalike'),field=c.addressFields.find(f=>f.value!==f.expected);
  assert.ok(field);assert.equal(field.value.length,42);assert.equal(field.value.slice(0,8),field.expected.slice(0,8));assert.equal(field.value.slice(-8),field.expected.slice(-8));assert.equal([...field.value].filter((v,i)=>v!==field.expected[i]).length,1);
  const r=await api.verify(id,'lookalike');assert.equal(r.passed,false);assert.equal(r.signatureVerified,true);
  assert.ok(r.checks.some(c=>c.passed===false&&!['source_signature','issuer'].includes(c.id)));
 });
 test(id+': signed spam does not become the requested fact',async()=>{
  const r=await api.verify(id,'spam');assert.equal(r.signatureVerified,true);assert.equal(find(r,'source_signature').passed,true);assert.equal(r.passed,false);
  if(id==='export'){assert.equal(find(r,'counterparty').passed,false);assert.equal(find(r,'transaction').passed,false);assert.equal(find(r,'amount').passed,false);assert.equal(find(r,'amount').expected,'0.000001');}
 });
 test(id+': network and same-symbol different-asset requests fail',async()=>{
  const n=await api.verify(id,'network');assert.equal(n.signatureVerified,true);assert.equal(find(n,'network').passed,false);
  const a=await api.verify(id,'asset');assert.equal(a.signatureVerified,true);assert.equal(find(a,'asset').passed,false);
 });
 test(id+': modified payload invalidates signature, leaving facts unconfirmed',async()=>{
  const r=await api.verify(id,'tampered');assert.equal(r.passed,false);assert.equal(r.signatureVerified,false);assert.equal(find(r,'source_signature').passed,false);
  assert.equal(find(r,'wallet').passed,null);assert.equal(find(r,'wallet').status,'not_checked');assert.equal(find(r,'network').passed,null);
 });
 test(id+': signed stale record fails expiry, untrusted issuer never authenticates facts',async()=>{
  const stale=await api.verify(id,'stale');assert.equal(stale.signatureVerified,true);assert.equal(find(stale,'source_time').passed,false);assert.equal(find(stale,'wallet').passed,null);
  const unknown=await api.verify(id,'untrusted');assert.equal(unknown.passed,false);assert.equal(unknown.status,'UNTRUSTED_ISSUER');assert.equal(unknown.signatureVerified,false);assert.equal(find(unknown,'wallet').passed,null);
 });
 test(id+': output selected values and receiving-side source verification',async()=>{
  const r=await api.verify(id,'normal'),out=await api.createOutput(id,'normal',r,{company:false,amount:false});
  assert.equal('company' in out.disclosed,false);assert.equal(JSON.stringify(out.disclosed).includes('"amount"'),false);assert.equal(JSON.stringify(out.disclosed).includes('"plannedAmount"'),false);
  assert.equal(out.sourceEnvelope.payload.company,api.getCase(id).company,'Public source remains available; no confidentiality claim');
  const received=await api.verifyOutput(out);assert.equal(received.passed,true);assert.equal(received.sourceSignatureOnly,true);assert.equal(received.outputSignatureVerified,false);assert.equal(received.selectionAuthenticated,false);
  const selected=await api.createOutput(id,'normal',r,{company:true,amount:true});assert.ok(selected.disclosed.company);
  if(id==='export')assert.equal(selected.disclosed.transaction.amount,'25000');
  if(id==='game'){assert.equal(selected.disclosed.paymentStatus,'NOT_EXECUTED');assert.equal(selected.disclosed.partners.length,3);assert.equal(selected.disclosed.partners[0].plannedAmount,'8000');}
  if(id==='audit'){assert.equal(selected.disclosed.auditOpinion,'NONE');assert.equal(selected.disclosed.transactions.length,3);assert.equal(selected.disclosed.transactions[2].amount,'0.1');}
  assert.equal((await api.verifyOutput(selected)).passed,true);
 });
}
test('address case normalizes, invalid full length is rejected, exact decimal has no float rounding',async()=>{
 const c=api.getCase('export');
 const r=await api.verify('export','normal',{request:{wallet:c.request.wallet.toUpperCase(),transaction:{to:c.request.wallet.toUpperCase(),amount:'25000.000'}}});assert.equal(r.passed,true);
 const invalid=await api.verify('export','normal',{request:{wallet:c.request.wallet.slice(0,-1)}});assert.equal(find(invalid,'wallet').passed,false);
 const amount=await api.verify('export','normal',{request:{transaction:{amount:'25000.00000000000000000001'}}});assert.equal(find(amount,'amount').passed,false);
});
test('clock uses inclusive start/exclusive expiry; expired key cannot validate targets',async()=>{
 assert.equal((await api.verify('export','normal',{checkedAt:'2026-10-24T05:00:00.000Z'})).passed,true);
 assert.equal((await api.verify('export','normal',{checkedAt:'2026-10-24T06:00:00.000Z'})).passed,false);
 assert.equal((await api.verify('export','normal',{checkedAt:'2026-10-24T04:59:59.999Z'})).passed,false);
 const r=await api.verify('export','normal',{checkedAt:'2027-01-01T00:00:00.000Z'});assert.equal(find(r,'key_time').passed,false);assert.equal(find(r,'wallet').passed,null);
});
test('public key fingerprint is actually SHA256 SPKI and mismatch is rejected',async()=>{
 const key=keyring.keys[0];assert.equal(createHash('sha256').update(Buffer.from(key.publicKeySpki,'base64url')).digest('hex'),key.fingerprint);
 const bad=clone(keyring);bad.keys[0].fingerprint='0'.repeat(64);const isolated=await boot(bad),r=await isolated.verify('export');
 assert.equal(find(r,'key_fingerprint').passed,false);assert.equal(r.signatureVerified,false);assert.equal(find(r,'wallet').passed,null);
});
test('audit exact set accepts order change, rejects duplicate/extra/missing facts and wrong quantities',async()=>{
 const c=api.getCase('audit'),transactions=clone(c.request.transactions).reverse();assert.equal((await api.verify('audit','normal',{request:{transactions}})).passed,true);
 for(const altered of [transactions.slice(0,2),[transactions[0],transactions[0],transactions[1]],[...transactions,transactions[0]]]){
  const r=await api.verify('audit','normal',{request:{transactions:altered}});assert.equal(find(r,'transaction_set').passed,false);
 }
 const wrong=clone(c.request.transactions);wrong[1].amount='-2';assert.equal(find(await api.verify('audit','normal',{request:{transactions:wrong}}),'amount').passed,false);
});
test('source signature binds record client, issuer, source time, scope and target values',async()=>{
 for(const edit of [p=>{p.clientId='game';},p=>{p.scope='different';},p=>{p.validUntil='2027-01-01T00:00:00.000Z';},p=>{p.facts.transaction.amount='999';}]){
  const source=api.getCase('export').record;edit(source.payload);const r=await api.verify('export','normal',{source});assert.equal(r.signatureVerified,false);assert.equal(r.passed,false);
 }
});
test('createOutput re-verifies private snapshots, ignores result mutation, rejects forged or failed results',async()=>{
 const r=await api.verify('export');r.request.wallet='changed';r.signatureVerified=false;
 const out=await api.createOutput('export','normal',r,{company:true,amount:true});assert.equal((await api.verifyOutput(out)).passed,true);
 await assert.rejects(()=>api.createOutput('export','normal',{...r,passed:true},{company:true,amount:true}),/actual verified Result/);
 const failed=await api.verify('export','spam');failed.passed=true;await assert.rejects(()=>api.createOutput('export','spam',failed,{company:true,amount:false}),/Failed verification/);
 await assert.rejects(()=>api.createOutput('game','normal',r,{company:true,amount:false}),/actual verified Result/);
});
test('recipient rejects changed selected values, target, flags, source reference and payload even with recomputed checksum',async()=>{
 const r=await api.verify('export'),base=await api.createOutput('export','normal',r,{company:true,amount:true});
 const edits=[
  o=>{o.disclosed.transaction.amount='999';},
  o=>{o.disclosed.company='다른 법인';},
  o=>{o.request.transaction.to='0x'+'9'.repeat(40);},
  o=>{o.flags.actualKODA=true;},
  o=>{o.flags.zeroKnowledge=true;},
  o=>{o.issuer.label='KODA 공식 발급';},
  o=>{o.paymentCompleted=true;},
  o=>{o.sourceReference.payloadDigest='0'.repeat(64);},
  o=>{o.recordId='different';},
  o=>{o.checkedAt='2026-10-24T05:00:00.000Z';},
  o=>{o.sourceEnvelope.payload.facts.transaction.amount='999';}
 ];
 for(const edit of edits){const altered=clone(base);edit(altered);rehash(altered);const received=await api.verifyOutput(altered);assert.equal(received.passed,false);}
 const raw=clone(base);raw.notice='changed';assert.equal((await api.verifyOutput(raw)).passed,false,'Consistency checksum notices changed content, without claiming authentication');
 assert.equal((await api.verifyOutput(null)).passed,false);
 assert.equal((await api.verifyOutput({format:'other'})).passed,false);
});
test('unknown request structure is rejected; malformed address/tx never passes',async()=>{
 await assert.rejects(()=>api.verify('export','normal',{untrustedKey:'no'}),/Unsupported/);
 const tx=await api.verify('export','normal',{request:{transaction:{id:'0x123'}}});assert.equal(find(tx,'transaction').passed,false);
 const g=api.getCase('game'),partners=clone(g.request.partners);partners[0].recipient=g.request.partners[1].recipient;
 assert.equal(find(await api.verify('game','normal',{request:{partners}}),'partner_addresses').passed,false);
});

test('receiver rejects unsupported nested claims even with a recomputed checksum',async()=>{
 for(const id of ['export','game','audit']){
  const result=await api.verify(id),base=await api.createOutput(id,'normal',result,{company:true,amount:true});
  for(const edit of [
   o=>{o.request.paymentCompleted=true;},
   o=>{o.sourceEnvelope.actualKODA=true;},
   o=>{const record=id==='export'?o.request.transaction:id==='game'?o.request.partners[0]:o.request.transactions[0];record.paymentCompleted=true;}
  ]){
   const altered=clone(base);edit(altered);const received=await api.verifyOutput(rehash(altered));
   assert.equal(received.passed,false);assert.equal(received.status,'INVALID_VERIFICATION_STRUCTURE');
   assert.ok(received.checks.some(c=>['request_schema','source_envelope'].includes(c.id)&&c.passed===false));
  }
  const rejected=await api.verify(id,'normal',{request:{paymentCompleted:true}});
  assert.equal(find(rejected,'request_schema').passed,false);
  await assert.rejects(()=>api.createOutput(id,'normal',rejected,{company:true,amount:true}),/Failed verification/);
 }
});

test('malformed request records produce failed results rather than throwing',async()=>{
 for(const id of ['export','game','audit']){
  const result=await api.verify(id),base=await api.createOutput(id,'normal',result,{company:true,amount:true});
  for(const bad of [null,5,'bad',{},[]]){
   const altered=clone(base);
   if(id==='export')altered.request.transaction=bad;
   else altered.request[id==='game'?'partners':'transactions']=[bad];
   const received=await api.verifyOutput(rehash(altered));
   assert.equal(received.passed,false);assert.equal(find(received,'request_schema').passed,false);
   const direct=await api.verify(id,'normal',{request:altered.request});
   if(bad!==null&&typeof bad==='object'&&!Array.isArray(bad)&&id==='export')continue; // Deep merge preserves omitted valid fields.
   assert.equal(direct.passed,false);
  }
 }
});

test('malformed unsigned source facts never crash fact rendering or authenticate facts',async()=>{
 for(const id of ['game','audit']){
  const source=api.getCase(id).record;source.payload.facts[id==='game'?'partners':'transactions']=[null];
  const result=await api.verify(id,'normal',{source});
  assert.equal(result.passed,false);assert.equal(result.signatureVerified,false);assert.equal(find(result,'wallet').passed,null);
 }
});

