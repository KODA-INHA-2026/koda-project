'use strict';
window.KODA_ASSURANCE_UI=(()=>{
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const scalar=value=>value===null||value===undefined?'—':typeof value==='object'?JSON.stringify(value):String(value);
 const time=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' KST';};
 function addressLine(label,value,other){
  const line=el('span');line.append(document.createTextNode(label+' '));
  const str=scalar(value),compare=scalar(other);
  for(let i=0;i<str.length;i++){const changed=compare[i]!==undefined&&str[i].toLowerCase()!==compare[i].toLowerCase();line.append(changed?el('mark',str[i]):document.createTextNode(str[i]));}
  return line;
 }
 function renderResult(root,result,{pending=false,receiver=false}={}){
  root.replaceChildren();root.dataset.state=pending?'pending':result?(result.passed===true?'passed':'failed'):'idle';
  root.append(el('h2',receiver?'받은 자료 확인 결과':'확인 결과'));
  const summary=el('div',undefined,'assurance-summary');summary.append(el('span',pending?'…':result?(result.passed===true?'✓':'!'):'↗'));
  const body=el('div');
  const title=pending?'정보를 확인하고 있어요.':!result?'아직 확인하지 않았어요.':result.title||(result.passed===true?'요청한 정보와 맞아요.':'확인이 필요한 항목이 있어요.');
  body.append(el('h3',title),el('p',pending?'발급 서명과 요청한 내용을 확인해요.':!result?'주소·거래 정보와 발급 출처를 먼저 확인해 주세요.':result.summary||(result.passed===true?'아래 확인 범위 안에서 다음 업무를 이어갈 수 있어요.':'실패한 항목을 확인하고 정보를 바꾼 뒤 다시 확인해 주세요.')));summary.append(body);root.append(summary);
  if(result){
   const checks=Array.isArray(result.checks)?result.checks:Object.entries(result.checks||{}).map(([id,c])=>({id,...c}));
   const primary=el('ul',undefined,'assurance-checks assurance-primary-checks'),list=el('ul',undefined,'assurance-checks');
   const priority=new Set(['source_signature',result.clientId==='game'?'partner_addresses':result.clientId==='export'?'counterparty':'wallet','source_time']);
   const orderedChecks=[...checks].sort((a,b)=>Number(b.passed===false)-Number(a.passed===false));
   orderedChecks.forEach(check=>{
    const status=check.status==='not_checked'||check.passed===null?'not_checked':check.passed===true?'passed':'failed';
    const row=el('li',undefined,'assurance-check');row.dataset.status=status;
    const heading=el('div',undefined,'assurance-check-heading');heading.append(el('strong',check.label||check.id),el('b',status==='passed'?'일치·유효':status==='failed'?'확인 필요':'검사하지 않음'));row.append(heading);
    if(check.detail)row.append(el('p',check.detail));
    const expected=scalar(check.expected),actual=scalar(check.actual);
    if(status==='failed'&&(check.expected!==undefined||check.actual!==undefined)){
     const values=el('p',undefined,'assurance-diff');
     if(/^0x[0-9a-f]{40,64}$/i.test(expected)&&/^0x[0-9a-f]{40,64}$/i.test(actual)){values.append(addressLine('기준',expected,actual),addressLine('요청',actual,expected));}
     else if(Array.isArray(check.expected)&&Array.isArray(check.actual)&&check.expected.every(v=>typeof v==='string'||v&&typeof v==='object'&&'address' in v)){
      check.expected.forEach((baseline,i)=>{
       const requested=typeof baseline==='object'?check.actual.find(v=>v.id===baseline.id):check.actual[i];
       const one=typeof baseline==='object'?baseline.address:baseline,two=typeof requested==='object'?requested?.address:requested;
       if(scalar(one).toLowerCase()!==scalar(two).toLowerCase()){
        if(typeof baseline==='object')values.append(el('span',baseline.id));
        values.append(addressLine('기준',one,two),addressLine('요청',two,one));
       }
      });
     }else{values.append(el('span','기준 '+expected),el('span','요청 '+actual));}
     row.append(values);
    }
    (status==='failed'||priority.has(check.id)?primary:list).append(row);
   });root.append(primary);
   const more=el('details',undefined,'assurance-more');more.open=result.passed!==true;more.append(el('summary','전체 검사 '+checks.length+'개와 근거 보기'),list);
   if(result.issuer?.fingerprint)more.append(el('p','샘플 공개키 지문 '+result.issuer.fingerprint,'assurance-note'));root.append(more);
   const meta=el('div',undefined,'assurance-meta');meta.append(el('strong',result.issuer?.label||'발급처를 확인하지 못했어요.'));
   meta.append(el('p','확인 기준 '+time(result.checkedAt||result.checkTime)));
   if(result.referenceTime)meta.append(el('p','자료 시점 '+time(result.referenceTime)));
   if(result.validUntil)meta.append(el('p','유효 시점 '+time(result.validUntil)));
   if(result.recordId||result.sourceRecordId)meta.append(el('p','기준 자료 '+(result.recordId||result.sourceRecordId)));
   root.append(meta);
  }
  root.append(el('p','샘플 원자료의 서명과 요청 정보만 확인해요. 실제 KODA 발급·지갑 소유권·현재 잔액·지급·손실 보장·ZK는 확인하지 않아요.','assurance-scope'));
  if(receiver)root.append(el('p','파일 전체의 별도 발급서명이나 보낸 사람의 신원을 확인하는 기능은 아니에요.','assurance-note'));
 }
 function readPath(root,path){return path.split('.').reduce((v,k)=>v?.[k],root);}
 function writePath(root,path,value){const bits=path.split('.');let p=root;bits.slice(0,-1).forEach(k=>{p=p[k];});p[bits.at(-1)]=value;}
 function renderRequest(root,client,request,onChange){
  root.replaceChildren();const fields=[];
  function input(parent,label,path,{wide=false,type='text',note}={}){
   const wrap=el('label',undefined,'assurance-field'+(wide?' wide':'')),id='request-'+path.replaceAll('.','-');wrap.htmlFor=id;wrap.append(el('span',label));
   const control=el('input');control.id=id;control.type=type;control.value=scalar(readPath(request,path));control.autocomplete='off';control.spellcheck=false;control.setAttribute('autocapitalize','none');control.dataset.requestPath=path;
   if(/(wallet|counterparty|recipient|from|to)$/.test(path)||/(transaction\.id|transactions\.\d+\.id)$/.test(path))control.dataset.requestFormat='identifier';
   if(type==='text')control.inputMode='text';if(type==='number')control.step='any';
   control.addEventListener('input',()=>{writePath(request,path,type==='number'?control.value:control.value.trim());onChange(path);});wrap.append(control);
   if(note){const help=el('small',note);help.id=id+'-help';control.setAttribute('aria-describedby',help.id);wrap.append(help);}parent.append(wrap);fields.push(control);
  }
  if(client==='export')input(root,'확인할 거래 상대 주소','counterparty',{note:'앞뒤가 같아 보여도 주소 전체를 비교해요.'});
  else input(root,'법인 지갑 주소','wallet',{note:'앞뒤가 같아 보여도 주소 전체를 비교해요.'});
  if(client==='game'){
   request.partners.forEach((p,i)=>{const row=el('div',undefined,'assurance-target');input(row,(p.id||'파트너 '+(i+1))+' 받을 주소','partners.'+i+'.recipient');root.append(row);});
  }
  const more=el('details',undefined,'assurance-more');more.append(el('summary','거래 항목 보기·바꾸기'));
  const grid=el('div',undefined,'assurance-fields-grid');input(grid,'네트워크','network');
  if(client==='export'){
   input(grid,'법인 지갑 주소','wallet',{wide:true});input(grid,'거래 번호','transaction.id',{wide:true});input(grid,'보낸 주소','transaction.from',{wide:true});input(grid,'받은 주소','transaction.to',{wide:true});input(grid,'자산','transaction.asset');input(grid,'수량','transaction.amount',{type:'number'});input(grid,'자산 식별자','transaction.assetId',{wide:true});
  }else if(client==='game'){
   request.partners.forEach((p,i)=>{input(grid,(p.id||'파트너 '+(i+1))+' 자산','partners.'+i+'.asset');input(grid,(p.id||'파트너 '+(i+1))+' 수량','partners.'+i+'.amount',{type:'number'});input(grid,(p.id||'파트너 '+(i+1))+' 자산 식별자','partners.'+i+'.assetId',{wide:true});});
  }else{
   request.transactions.forEach((t,i)=>{input(grid,'거래 '+(i+1)+' 번호','transactions.'+i+'.id',{wide:true});input(grid,'거래 '+(i+1)+' 지갑 주소','transactions.'+i+'.wallet',{wide:true});input(grid,'거래 '+(i+1)+' 네트워크','transactions.'+i+'.network');input(grid,'거래 '+(i+1)+' 자산','transactions.'+i+'.asset');input(grid,'거래 '+(i+1)+' 수량','transactions.'+i+'.amount',{type:'number'});input(grid,'거래 '+(i+1)+' 자산 식별자','transactions.'+i+'.assetId',{wide:true});});
  }
  more.append(grid);root.append(more);return fields;
 }
 function focusResult(root){root.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'auto'});}
 return {renderResult,renderRequest,focusResult,time,scalar};
})();
