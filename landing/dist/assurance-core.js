/* Browser-local sample source verification. No KODA, blockchain, ownership, AI or ZK connection. */
(function(root){
 'use strict';
 const enc=new TextEncoder(),state={fixtures:null,keyring:null},bindings=new WeakMap();
 const issuerLabel='산학프로젝트 샘플 발급키';
 const outputNotice='공개된 합성 원자료가 포함되어요. 선택은 표시 항목에 적용되며 비공개 처리·ZK·파일 자체의 발급서명은 아니에요.';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const canonical=value=>{
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw new TypeError('JSON-safe finite values only');
 };
 const bytes=value=>Uint8Array.from(atob(String(value).replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
 const sha=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',typeof value==='string'?enc.encode(value):value)),x=>x.toString(16).padStart(2,'0')).join('');
 const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)?value.toLowerCase():null;
 const transaction=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value)?value.toLowerCase():null;
 const asset=value=>typeof value==='string'&&/^[a-z0-9:/._-]{1,200}$/i.test(value)?value.toLowerCase():null;
 const decimal=value=>{
  if(typeof value!=='string'||! /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))return null;
  let [whole,fraction='']=value.split('.');fraction=fraction.replace(/0+$/,'');
  if(whole==='-0'&&!fraction)whole='0';return whole+(fraction?'.'+fraction:'');
 };
 const time=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
 const same=(a,b,normalise=String)=>{const x=normalise(a),y=normalise(b);return x!==null&&y!==null&&x===y;};
 const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
 const exactKeys=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
 const stringRecord=(value,keys)=>exactKeys(value,keys)&&keys.every(key=>typeof value[key]==='string');
 function requestSchema(clientId,request){
  if(clientId==='export')return exactKeys(request,['network','wallet','counterparty','transaction'])&&['network','wallet','counterparty'].every(key=>typeof request[key]==='string')&&stringRecord(request.transaction,['id','from','to','assetId','asset','amount']);
  const list=clientId==='game'?'partners':'transactions',keys=clientId==='game'?['id','recipient','assetId','asset','amount']:['id','wallet','network','assetId','asset','amount'];
  return exactKeys(request,['network','wallet',list])&&typeof request.network==='string'&&typeof request.wallet==='string'&&Array.isArray(request[list])&&request[list].every(item=>stringRecord(item,keys));
 }
 const envelopeSchema=value=>exactKeys(value,['payload','keyId','algorithm','signature'])&&plain(value.payload)&&['keyId','algorithm','signature'].every(key=>typeof value[key]==='string');
 const merge=(base,patch)=>{
  if(!plain(patch))throw new TypeError('request must be an object');
  const out=clone(base);
  for(const [key,value]of Object.entries(patch)){
   if(['__proto__','constructor','prototype'].includes(key))throw new TypeError('Invalid request key');
   out[key]=plain(value)&&plain(out[key])?merge(out[key],value):clone(value);
  }return out;
 };
 const flags=(signature=false)=>({isDemo:true,cryptographicVerification:signature,sourceSignatureOnly:true,actualKODA:false,actualWalletOwnership:false,chainExecution:false,externalExecution:false,privacy:false,zeroKnowledge:false,zkProof:null,assurance:'NONE'});
 const check=(id,label,passed,expected=null,actual=null,detail='')=>({id,label,status:passed===null?'not_checked':passed?'passed':'failed',passed,expected,actual,detail});
 function needReady(){if(!state.fixtures)throw new Error('Await KODA_ASSURANCE.ready first');}
 function getClient(id){needReady();const c=state.fixtures.clients.find(c=>c.id===id);if(!c)throw new RangeError('Unknown client');return c;}
 function getScenario(c,id){const s=c.scenarios.find(s=>s.id===id);if(!s)throw new RangeError('Unknown scenario');return s;}
 const mapBy=(items,key)=>Array.isArray(items)?new Map(items.map(item=>[item?.[key],item])):new Map();
 const exactSet=(a,b,key,normalise=String)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  const one=a.map(x=>normalise(x?.[key])),two=b.map(x=>normalise(x?.[key]));
  return one.every(x=>x!==null)&&two.every(x=>x!==null)&&new Set(one).size===one.length&&new Set(two).size===two.length&&one.slice().sort().join('|')===two.slice().sort().join('|');
 };
 function fields(client,request,record){
  const f=record?.payload?.facts||{},addressFields=[],txFields=[];
  const add=(path,label,value,expected)=>addressFields.push({path,label,value:String(value??''),expected:String(expected??'')});
  const tx=(path,label,value,expected)=>txFields.push({path,label,value:String(value??''),expected:String(expected??'')});
  add('wallet','대상 지갑 주소',request.wallet,f.wallet);
  if(client.id==='export'){
   add('counterparty','거래 상대 주소',request.counterparty,f.counterparty);
   add('transaction.from','입금 보낸 주소',request.transaction?.from,f.transaction?.from);
   add('transaction.to','입금 받은 주소',request.transaction?.to,f.transaction?.to);
   tx('transaction.id','입금 거래 번호',request.transaction?.id,f.transaction?.id);
  }else if(client.id==='game'){
   const registered=mapBy(f.partners,'id');
   (request.partners||[]).forEach((p,i)=>add('partners.'+i+'.recipient',p.id+' 받을 주소',p.recipient,registered.get(p.id)?.registeredAddress));
  }else{
   const signed=mapBy(f.transactions,'id');
   (request.transactions||[]).forEach((t,i)=>{add('transactions.'+i+'.wallet','거래 '+(i+1)+' 대상 지갑',t.wallet,signed.get(t.id)?.wallet);tx('transactions.'+i+'.id','거래 '+(i+1)+' 번호',t.id,f.transactions?.[i]?.id);});
  }return {addressFields,txFields};
 }
 function getCase(clientId,scenarioId='normal'){
  const c=getClient(clientId),s=getScenario(c,scenarioId),record=clone(state.fixtures.records[s.recordId]),request=clone(s.request||c.request);
  return {id:c.id,company:c.company,scope:c.scope,label:c.label,scenarioId:s.id,scenarioLabel:s.label,scenarios:c.scenarios.map(x=>({id:x.id,label:x.label})),request,record,checkedAt:state.fixtures.checkTime,clockMode:'fixed-reference',referenceTime:record.payload.referenceTime,validUntil:record.payload.validUntil,...fields(c,request,record)};
 }
 function factChecks(client,request,payload,enabled){
  const f=payload?.facts||{},out=[];
  const add=(id,label,test,expected,actual,detail='')=>out.push(check(id,label,enabled?Boolean(test()):null,expected??null,actual??null,enabled?detail:'원자료의 신뢰·유효성을 확인하기 전에는 판정하지 않아요.'));
  add('wallet','대상 지갑 주소',()=>same(request.wallet,f.wallet,address),f.wallet,request.wallet,'42자리 전체 주소를 정규화한 뒤 정확히 비교해요. 소유권 증명은 아니에요.');
  add('network','네트워크',()=>same(request.network,f.network),f.network,request.network,'요청과 서명된 자료의 네트워크 식별자를 비교해요.');
  if(client.id==='export'){
   const r=request.transaction||{},t=f.transaction||{};
   add('counterparty','거래 상대 주소',()=>same(request.counterparty,f.counterparty,address),f.counterparty,request.counterparty);
   add('transaction','입금 거래 번호',()=>same(r.id,t.id,transaction),t.id,r.id);
   add('transaction_sender','입금 보낸 주소',()=>same(r.from,t.from,address)&&same(r.from,request.counterparty,address),t.from,r.from);
   add('transaction_recipient','입금 받은 주소',()=>same(r.to,t.to,address)&&same(r.to,request.wallet,address),t.to,r.to);
   add('asset','자산 식별자',()=>same(r.assetId,t.assetId,asset)&&same(r.asset,t.asset),{asset:t.asset,assetId:t.assetId},{asset:r.asset,assetId:r.assetId},'같은 이름의 다른 자산을 구분하기 위해 식별자도 비교해요.');
   add('amount','받은 수량',()=>same(r.amount,t.amount,decimal),t.amount,r.amount,'부동소수점 반올림 없이 십진수 값을 비교해요.');
  }else if(client.id==='game'){
   const source=mapBy(f.partners,'id'),requested=Array.isArray(request.partners)?request.partners:[],set=exactSet(requested,f.partners,'id');
   add('partner_set','정산 요청의 세 파트너',()=>set,(f.partners||[]).map(p=>p.id),requested.map(p=>p.id));
   add('partner_addresses','파트너별 등록 주소',()=>set&&requested.every(p=>same(p.recipient,source.get(p.id)?.registeredAddress,address)),(f.partners||[]).map(p=>({id:p.id,address:p.registeredAddress})),requested.map(p=>({id:p.id,address:p.recipient})),'지급 전 등록 주소 대조이며 지급 완료나 체인 전송을 뜻하지 않아요.');
   add('asset','파트너별 자산 식별자',()=>set&&requested.every(p=>same(p.assetId,source.get(p.id)?.assetId,asset)&&same(p.asset,source.get(p.id)?.asset)),(f.partners||[]).map(p=>({id:p.id,assetId:p.assetId})),requested.map(p=>({id:p.id,assetId:p.assetId})));
   add('amount','지급 전 요청 수량',()=>set&&requested.every(p=>same(p.amount,source.get(p.id)?.plannedAmount,decimal)),(f.partners||[]).map(p=>({id:p.id,amount:p.plannedAmount})),requested.map(p=>({id:p.id,amount:p.amount})),'서명된 요청 스냅샷과 비교한 수량이며 실제 지급 내역이 아니에요.');
  }else{
   const source=mapBy(f.transactions,'id'),requested=Array.isArray(request.transactions)?request.transactions:[],set=exactSet(requested,f.transactions,'id',transaction);
   const signed=t=>source.get(t.id)||Array.from(source.values()).find(s=>same(t.id,s.id,transaction));
   add('transaction_set','수탁 거래 번호 전체',()=>set,(f.transactions||[]).map(t=>t.id),requested.map(t=>t.id),'거래 누락·추가·중복도 확인해요.');
   add('transaction_wallets','각 거래의 대상 지갑',()=>set&&requested.every(t=>same(t.wallet,signed(t)?.wallet,address)&&same(t.wallet,request.wallet,address)),(f.transactions||[]).map(t=>t.wallet),requested.map(t=>t.wallet));
   add('transaction_networks','각 거래의 네트워크',()=>set&&requested.every(t=>same(t.network,signed(t)?.network)),(f.transactions||[]).map(t=>t.network),requested.map(t=>t.network));
   add('asset','각 거래의 자산 식별자',()=>set&&requested.every(t=>same(t.assetId,signed(t)?.assetId,asset)&&same(t.asset,signed(t)?.asset)),(f.transactions||[]).map(t=>({id:t.id,assetId:t.assetId})),requested.map(t=>({id:t.id,assetId:t.assetId})));
   add('amount','각 거래의 수량',()=>set&&requested.every(t=>same(t.amount,signed(t)?.amount,decimal)),(f.transactions||[]).map(t=>({id:t.id,amount:t.amount})),requested.map(t=>({id:t.id,amount:t.amount})),'합성 수탁 기록의 값과 비교하며 실제 체인 거래나 감사 의견을 증명하지 않아요.');
  }return out;
 }
 function outcome(checks){
  const failed=checks.find(c=>c.passed===false);
  if(!failed&&checks.every(c=>c.passed===true))return {passed:true,status:'VERIFIED_SAMPLE_SOURCE_AND_TARGET',title:'원자료 서명과 요청 정보가 맞아요.',summary:'샘플 발급키의 서명과 이 요청에 필요한 주소·거래 사실을 확인했어요.'};
  const id=failed?.id;
  if(id==='request_schema'||id==='source_envelope')return {passed:false,status:'INVALID_VERIFICATION_STRUCTURE',title:'확인 자료의 항목 형식이 맞지 않아요.',summary:'정해진 요청 항목과 원자료 서명 형식을 사용해 주세요. 추가 주장은 확인하지 않아요.'};
  if(id==='issuer')return {passed:false,status:'UNTRUSTED_ISSUER',title:'신뢰 목록에 없는 발급키예요.',summary:'원자료의 발급처를 확인할 수 없어 거래 사실은 판정하지 않았어요.'};
  if(id==='source_signature'||id==='key_fingerprint')return {passed:false,status:'INVALID_SOURCE_SIGNATURE',title:'원자료 서명을 확인할 수 없어요.',summary:'자료가 바뀌었거나 서명·발급키가 맞지 않아요. 거래 사실은 판정하지 않았어요.'};
  if(id==='source_time'||id==='key_time'||id==='clock')return {passed:false,status:'OUTSIDE_VALIDITY_WINDOW',title:'확인 기준시간에 유효한 자료가 아니에요.',summary:'유효한 원자료와 발급키를 준비한 뒤 다시 확인해 주세요.'};
  if(id==='source_context')return {passed:false,status:'SOURCE_CONTEXT_MISMATCH',title:'이 업무의 원자료가 아니에요.',summary:'법인·업무·확인 범위가 이 요청과 연결되는 자료인지 확인해 주세요.'};
  return {passed:false,status:id==='network'||id==='transaction_networks'?'NETWORK_MISMATCH':id==='asset'?'ASSET_MISMATCH':id==='amount'?'AMOUNT_MISMATCH':'TARGET_MISMATCH',title:'요청과 원자료의 정보가 달라요.',summary:'다른 항목을 확인해 주세요. 서명이 유효해도 요청한 주소·거래와 다를 수 있어요.'};
 }
 async function inspect(clientId,request,envelope,checkedAt){
  const client=getClient(clientId),checks=[],p=envelope?.payload||{},point=time(checkedAt);
  const requestOkay=Boolean(requestSchema(clientId,request)),envelopeOkay=Boolean(envelopeSchema(envelope));
  checks.push(check('request_schema','요청 항목 형식',requestOkay,'업무별 정해진 항목과 문자열 값',null));
  checks.push(check('source_envelope','원자료 서명 형식',envelopeOkay,'payload/keyId/algorithm/signature',null));
  checks.push(check('clock','확인 기준시간',Number.isFinite(point),state.fixtures.checkTime,checkedAt,'실시간이 아닌 지정된 기준시간으로 검사해요.'));
  const key=state.keyring.keys.find(k=>k.id===p.issuerId),trusted=Boolean(key&&envelope?.keyId===p.issuerId);
  checks.push(check('issuer','발급키 신뢰 목록',trusted,'프로젝트에 등록된 샘플 공개키',p.issuerId||null,'KODA의 키·발급 사실을 확인하는 기능은 아니에요.'));
  let fingerprint='',keyOkay=false,signatureVerified=false;
  if(trusted){
   try{
    const spki=bytes(key.publicKeySpki);fingerprint=await sha(spki);
    keyOkay=key.algorithm==='ECDSA-P256-SHA256'&&fingerprint===key.fingerprint;
    checks.push(check('key_fingerprint','공개키 지문',keyOkay,key.fingerprint,fingerprint,'SPKI DER 바이트의 SHA-256 지문을 직접 계산해요.'));
    if(keyOkay&&envelope.algorithm==='ECDSA-P256-SHA256'&&typeof envelope.signature==='string'){
     const publicKey=await root.crypto.subtle.importKey('spki',spki,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
     const signature=bytes(envelope.signature);
     signatureVerified=signature.length===64&&await root.crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,enc.encode(canonical(p)));
    }
   }catch{if(!checks.some(c=>c.id==='key_fingerprint'))checks.push(check('key_fingerprint','공개키 지문',false,key.fingerprint,null));}
  }else checks.push(check('key_fingerprint','공개키 지문',null,null,null,'신뢰 목록에 없는 키는 가져오지 않아요.'));
  checks.push(check('source_signature','원자료 서명',trusted&&keyOkay?signatureVerified:null,'ECDSA P-256 · SHA-256',signatureVerified?'서명 유효':null,'서명된 원자료만 검사하며 주소 소유권이나 실제 체인 거래를 증명하지 않아요.'));
  const keyTime=trusted&&keyOkay&&Number.isFinite(point)?Number.isFinite(time(key.validFrom))&&Number.isFinite(time(key.validUntil))&&point>=time(key.validFrom)&&point<time(key.validUntil):null;
  checks.push(check('key_time','발급키 유효 시간',keyTime,trusted?{from:key.validFrom,until:key.validUntil}:null,checkedAt));
  const sourceTime=signatureVerified&&Number.isFinite(point)?Number.isFinite(time(p.referenceTime))&&Number.isFinite(time(p.validFrom))&&Number.isFinite(time(p.validUntil))&&time(p.referenceTime)<=point&&time(p.validFrom)<time(p.validUntil)&&point>=time(p.validFrom)&&point<time(p.validUntil):null;
  checks.push(check('source_time','원자료 유효 시간',sourceTime,signatureVerified?{from:p.validFrom,until:p.validUntil}:null,checkedAt,'시작은 포함하고 만료 시각부터는 사용할 수 없어요.'));
  const context=signatureVerified&&keyTime===true&&sourceTime===true?p.schemaVersion===1&&p.clientId===client.id&&p.scope===client.scope&&p.company===client.company&&p.synthetic===true&&typeof p.recordId==='string'&&plain(p.facts):null;
  checks.push(check('source_context','법인·업무 범위',context,{clientId:client.id,scope:client.scope},signatureVerified?{clientId:p.clientId,scope:p.scope}:null));
  const factsEnabled=checks.every(c=>c.passed===true);
  if(requestOkay)checks.push(...factChecks(client,request,factsEnabled?p:{},factsEnabled));
  const result={...outcome(checks),clientId:client.id,checks,issuer:{id:String(p.issuerId||''),label:issuerLabel,fingerprint},recordId:String(p.recordId||''),scope:client.scope,signatureVerified,checkedAt,referenceTime:String(p.referenceTime||''),validUntil:String(p.validUntil||''),request:clone(request),clockMode:'fixed-reference',...flags(signatureVerified)};
  result.facts=[
   {label:'법인',value:client.company},{label:'확인 범위',value:client.label},{label:'대상 지갑 주소',value:String(request.wallet||'')},
   {label:'발급처',value:issuerLabel},{label:'원자료 번호',value:result.recordId},{label:'공개키 지문',value:fingerprint||'미확인'},
   {label:'원자료 기준시간',value:result.referenceTime},{label:'검사 기준시간',value:checkedAt},{label:'원자료 만료시간',value:result.validUntil},
   {label:'암호학적 확인 범위',value:'샘플 원자료 서명만 확인 · 실제 지갑 소유권·체인 실행·KODA 발급·ZK 확인 아님'}
  ];
  return result;
 }
 async function verify(clientId,scenarioId='normal',overrides={}){
  await api.ready;
  if(!plain(overrides)||Object.keys(overrides).some(k=>!['request','source','checkedAt'].includes(k)))throw new TypeError('Unsupported verification override');
  const selected=getCase(clientId,scenarioId),request=overrides.request?merge(selected.request,overrides.request):selected.request,source=clone(overrides.source||selected.record),checkedAt=overrides.checkedAt??selected.checkedAt;
  const result=await inspect(clientId,request,source,checkedAt);
  result.scenarioId=scenarioId;
  bindings.set(result,{clientId,scenarioId,request:clone(request),source:clone(source),checkedAt});
  return result;
 }
 function disclosedFor(client,request,payload,selection){
  const out={wallet:request.wallet,network:request.network,recordId:payload.recordId,referenceTime:payload.referenceTime,validUntil:payload.validUntil};
  if(selection.company)out.company=payload.company;
  if(client.id==='export'){
   out.counterparty=request.counterparty;out.transaction={id:request.transaction.id,from:request.transaction.from,to:request.transaction.to,assetId:request.transaction.assetId,asset:request.transaction.asset};
   if(selection.amount)out.transaction.amount=request.transaction.amount;
  }else if(client.id==='game'){
   out.partners=request.partners.map(p=>({id:p.id,recipient:p.recipient,assetId:p.assetId,asset:p.asset,...(selection.amount?{plannedAmount:p.amount}:{})}));
   out.paymentStatus='NOT_EXECUTED';
  }else{
   out.recordCount=request.transactions.length;
   out.transactions=request.transactions.map(t=>({id:t.id,wallet:t.wallet,network:t.network,assetId:t.assetId,asset:t.asset,...(selection.amount?{amount:t.amount}:{})}));
   out.auditOpinion='NONE';
  }return out;
 }
 async function sourceReference(envelope,fingerprint){
  return {recordId:envelope.payload.recordId,issuerId:envelope.payload.issuerId,digestAlgorithm:'SHA-256',payloadDigest:await sha(canonical(envelope.payload)),signatureAlgorithm:envelope.algorithm,signature:envelope.signature,publicKeyFingerprint:fingerprint};
 }
 async function createOutput(clientId,scenarioId,result,selection={company:true,amount:false}){
  await api.ready;
  const binding=bindings.get(result);
  if(!binding||binding.clientId!==clientId||binding.scenarioId!==scenarioId)throw new Error('Use the actual verified Result from this core instance');
  if(!plain(selection)||typeof selection.company!=='boolean'||typeof selection.amount!=='boolean'||Object.keys(selection).some(k=>!['company','amount'].includes(k)))throw new TypeError('Explicit boolean company/amount selection required');
  if(time(binding.checkedAt)!==time(state.fixtures.checkTime))throw new Error('Outputs use the configured fixed reference clock');
  const fresh=await inspect(clientId,binding.request,binding.source,binding.checkedAt);
  if(!fresh.passed)throw new Error('Failed verification cannot create an output');
  const client=getClient(clientId),source=clone(binding.source);
  const output={format:'KODA_SAMPLE_SOURCE_OUTPUT',schemaVersion:1,clientId,scope:client.scope,recordId:source.payload.recordId,checkedAt:state.fixtures.checkTime,clockMode:'fixed-reference',issuer:clone(fresh.issuer),sourceEnvelope:source,request:clone(binding.request),selection:clone(selection),disclosed:disclosedFor(client,binding.request,source.payload,selection),sourceReference:await sourceReference(source,fresh.issuer.fingerprint),flags:flags(true),notice:outputNotice};
  output.outputDigest=await sha(canonical(output));return output;
 }
 async function verifyOutput(output){
  await api.ready;
  if(!plain(output)||output.format!=='KODA_SAMPLE_SOURCE_OUTPUT'||output.schemaVersion!==1||!state.fixtures.clients.some(c=>c.id===output.clientId)||!plain(output.request)||!plain(output.sourceEnvelope)){
   return {passed:false,status:'INVALID_OUTPUT',title:'확인할 수 있는 파일 형식이 아니에요.',summary:'이 서비스가 준비한 원자료 확인 파일인지 확인해 주세요.',checks:[check('output_format','파일 형식',false,'KODA_SAMPLE_SOURCE_OUTPUT v1',output?.format??null)],facts:[],issuer:{id:'',label:issuerLabel,fingerprint:''},recordId:'',scope:'',signatureVerified:false,checkedAt:state.fixtures.checkTime,...flags(false)};
  }
  const result=await inspect(output.clientId,clone(output.request),clone(output.sourceEnvelope),state.fixtures.checkTime),checks=result.checks,basePassed=result.passed;
  const p=output.sourceEnvelope.payload||{},client=getClient(output.clientId);
  const outputKeys=['format','schemaVersion','clientId','scope','recordId','checkedAt','clockMode','issuer','sourceEnvelope','request','selection','disclosed','sourceReference','flags','notice','outputDigest'];
  checks.push(check('output_envelope','지원하는 파일 항목',Object.keys(output).length===outputKeys.length&&Object.keys(output).every(k=>outputKeys.includes(k))&&output.notice===outputNotice,'정해진 원자료 확인 파일 항목',null,'확인 범위 밖의 추가 주장을 파일에 넣지 않아요.'));
  checks.push(check('output_issuer','파일의 발급키 표시',canonical(output.issuer??null)===canonical(result.issuer),result.issuer,output.issuer??null));
  checks.push(check('output_clock','파일의 검사 기준시간',time(output.checkedAt)===time(state.fixtures.checkTime)&&output.clockMode==='fixed-reference',state.fixtures.checkTime,output.checkedAt,'수신자도 서비스에 지정된 같은 기준시간으로 다시 검사해요.'));
  checks.push(check('output_context','파일의 대상·확인 범위',output.recordId===p.recordId&&output.scope===client.scope&&output.scope===p.scope,{recordId:p.recordId,scope:p.scope},{recordId:output.recordId,scope:output.scope}));
  const selectionValid=plain(output.selection)&&typeof output.selection.company==='boolean'&&typeof output.selection.amount==='boolean'&&Object.keys(output.selection).every(k=>['company','amount'].includes(k));
  checks.push(check('output_selection','표시 항목 선택',selectionValid,'company/amount boolean',output.selection));
  const sourceOkay=basePassed;
  let selectedMatch=null,referenceMatch=null;
  if(sourceOkay&&selectionValid){
   try{selectedMatch=canonical(output.disclosed)===canonical(disclosedFor(client,output.request,p,output.selection));referenceMatch=canonical(output.sourceReference)===canonical(await sourceReference(output.sourceEnvelope,result.issuer.fingerprint));}catch{selectedMatch=false;referenceMatch=false;}
  }
  checks.push(check('output_values','선택 값과 원자료의 대응',selectedMatch,'원자료·요청에서 다시 만든 동일한 값',null,'원자료가 유효할 때만 표시 항목을 다시 만들어 비교해요.'));
  checks.push(check('output_source_reference','원자료 서명·지문 참조',referenceMatch,'직접 계산한 원자료 digest와 서명 참조',null));
  checks.push(check('output_scope_flags','확인 범위 표시',canonical(output.flags??null)===canonical(flags(true)),flags(true),output.flags??null));
  const unsigned=clone(output);delete unsigned.outputDigest;let integrity=false;
  try{integrity=typeof output.outputDigest==='string'&&output.outputDigest===await sha(canonical(unsigned));}catch{}
  checks.push(check('output_digest','파일 내용의 일관성',integrity,'SHA-256 consistency checksum',output.outputDigest||null,'파일 자체의 발급서명이 아니며 보낸 사람의 신원을 인증하지 않아요.'));
  result.passed=checks.every(c=>c.passed===true);
  if(result.passed){result.status='VERIFIED_OUTPUT_SOURCE_AND_VALUES';result.title='원자료 서명과 선택 값이 맞아요.';result.summary='수신자가 샘플 원자료 서명·대상·유효시간과 표시된 값을 다시 확인했어요.';}
  else if(!basePassed){/* Keep the precise source/target failure. */}
  else{result.status='OUTPUT_CONTENT_MISMATCH';result.title='파일 내용이 원자료와 맞지 않아요.';result.summary='파일의 대상·선택 값·참조·기준시간 또는 확인 범위를 다시 확인해 주세요.';}
  result.outputSignatureVerified=false;result.selectionAuthenticated=false;return result;
 }
 const script=root.document?.currentScript?.src,base=script?new URL('.',script):new URL('./',root.location?.href||'https://sample.invalid/');
 const api={ready:null,clients:[],getCase,verify,createOutput,verifyOutput};
 root.KODA_ASSURANCE=api;
 api.ready=(async()=>{
  if(!root.crypto?.subtle)throw new Error('WebCrypto requires a secure context');
  const load=async name=>{const response=await root.fetch(new URL('assets/'+name,base));if(!response.ok)throw new Error('Cannot load '+name);return response.json();};
  const [fixtures,keyring]=await Promise.all([load('assurance-fixtures.json'),load('assurance-keyring.json')]);
  if(fixtures.schemaVersion!==1||keyring.schemaVersion!==1||!Array.isArray(fixtures.clients)||!Array.isArray(keyring.keys)||!plain(fixtures.records))throw new Error('Unsupported assurance data');
  state.fixtures=fixtures;state.keyring=keyring;api.clients=fixtures.clients.map(c=>({id:c.id,company:c.company,scope:c.scope,label:c.label}));return api;
 })();
})(globalThis);

