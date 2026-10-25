'use strict';
(()=>{
 const instrument=document.querySelector('[data-signal-instrument]');
 if(!instrument)return;
 const buttons=[...instrument.querySelectorAll('[data-signal-case]')];
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let revision=0,animation=null,activeScenario=null;
 const text=(selector,value)=>{instrument.querySelector(selector).textContent=value;};
 function stopMotion(){animation?.cancel();animation=null;}
 function digits(selector,value,center){
  const row=instrument.querySelector(selector);row.replaceChildren();
  for(let offset=-4;offset<=4;offset++){
   const span=document.createElement('span');span.textContent=value[center+offset]||'·';
   if(offset===0)span.className='signal-focus-char';row.append(span);
  }
 }
 async function select(scenario,animate=true){
  if(activeScenario===scenario)return;
  activeScenario=scenario;
  const own=++revision;stopMotion();
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.signalCase===scenario)));
  instrument.dataset.state='loading';instrument.setAttribute('aria-busy','true');
  text('[data-signal-signature]','확인 중');text('[data-signal-target]','확인 중');
  text('[data-signal-decision]','선택한 요청을 확인합니다.');text('[data-signal-next]','원자료 서명과 주소를 각각 검사합니다.');
  text('[data-signal-comparison]','선택한 주소를 확인하고 있습니다.');
  try{
   const core=window.KODA_ASSURANCE;if(!core)throw Error('unavailable');
   await core.ready;if(own!==revision)return;
   const data=core.getCase('export',scenario);
   const field=data.addressFields.find(f=>f.path==='counterparty')||data.addressFields.find(f=>f.value.toLowerCase()!==f.expected.toLowerCase());
   if(!field)throw Error('address unavailable');
   const differences=[...field.value].map((v,i)=>v.toLowerCase()!==field.expected[i]?.toLowerCase()?i:-1).filter(i=>i>=0);
   const center=differences[0]??20;
   digits('[data-signal-source]',field.expected,center);digits('[data-signal-request]',field.value,center);
   text('[data-signal-full-source]',field.expected);text('[data-signal-full-request]',field.value);
   text('[data-signal-position]',`0x 뒤 ${center-1}번째 글자`);
   document.querySelector('[data-signal-open]').href=`workspace.html?client=export&view=detail&scenario=${scenario}`;
   const result=await core.verify('export',scenario);if(own!==revision)return;
   const signature=result.checks.find(check=>check.id==='source_signature');
   const target=result.checks.find(check=>check.id==='counterparty');
   const label=(check,pass,fail)=>check?.passed===true?pass:check?.passed===false?fail:'미확인';
   text('[data-signal-signature]',label(signature,'유효','확인 불가'));
   text('[data-signal-target]',label(target,'일치','불일치'));
   text('[data-signal-decision]',result.passed?'다음 업무로 이어갑니다.':'주소가 달라, 여기서 멈춥니다.');
   text('[data-signal-next]',result.passed?'청구서와 입금을 맞춰볼 수 있습니다.':'서명은 유효해도 이 요청에 사용할 수 없습니다.');
   text('[data-signal-record]',result.recordId);
   text('[data-signal-expiry]',new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(result.validUntil))+' KST');
   instrument.dataset.state=target?.passed===true?'match':target?.passed===false?'mismatch':'unchecked';
   const explanation=target?.passed===false?`${center-1}번째 글자: 원자료 ${field.expected[center]}, 요청 ${field.value[center]}. 서명이 유효해도 주소는 다릅니다.`:target?.passed===true?'주소 전체가 일치합니다. 원자료 서명과 주소를 각각 확인했습니다.':'원자료를 확인할 수 없어 주소 일치를 판정하지 않았습니다.';
   text('[data-signal-comparison]',explanation);
   if(animate&&!reduce.matches){
    animation=instrument.querySelector('.signal-window').animate([{transform:'scaleX(1.8)',opacity:.2},{transform:'scaleX(1)',opacity:1}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});
   }
  }catch(error){if(own!==revision)return;activeScenario=null;instrument.dataset.state='error';text('[data-signal-signature]','미확인');text('[data-signal-target]','미확인');text('[data-signal-decision]','자료를 다시 확인해 주세요.');text('[data-signal-next]','업무 화면에서 자료를 다시 불러올 수 있습니다.');text('[data-signal-comparison]','자료를 불러오지 못했습니다. 업무 화면에서 다시 확인해 주세요.');}
  finally{if(own===revision)instrument.setAttribute('aria-busy','false');}
 }
 buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.signalCase)));
 reduce.addEventListener('change',()=>{if(reduce.matches)stopMotion();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
 select('lookalike',false);
})();
