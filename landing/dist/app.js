'use strict';
(()=>{
 const $=id=>document.getElementById(id),ui=window.KODA_ASSURANCE_UI,core=window.KODA_ASSURANCE;
 const input=$('received-json'),file=$('received-file'),button=$('verify-received'),result=$('received-result'),error=$('receiver-error'),sample=$('load-public-example'),sampleStatus=$('receiver-example-status');
 let revision=0,busy=false,readBusy=false,sampleBusy=false,coreReady=false;
 function invalidate(){revision++;readBusy=false;sampleBusy=false;sampleStatus.textContent='';error.hidden=true;input.removeAttribute('aria-invalid');file.removeAttribute('aria-invalid');ui.renderResult(result,null,{receiver:true});syncButton();}
 function fail(message,field=input){error.textContent=message;error.hidden=false;field.setAttribute('aria-invalid','true');field.focus();}
 function syncButton(){button.disabled=busy||readBusy||sampleBusy||!coreReady;button.setAttribute('aria-busy',String(busy||readBusy||sampleBusy));button.textContent=readBusy?'파일을 읽고 있어요…':sampleBusy?'예시를 준비하고 있어요…':busy?'확인하고 있어요…':'받은 자료 확인하기';sample.disabled=busy||readBusy||sampleBusy||!coreReady||Boolean(input.value.trim()||file.files.length);sample.textContent=sampleBusy?'공개 예시 준비 중…':'공개 예시 자료 불러오기';sample.setAttribute('aria-busy',String(sampleBusy));}
 function setBusy(value){busy=value;syncButton();}
 ui.renderResult(result,null,{receiver:true});
 if(!core){fail('확인 기능을 불러오지 못했어요. 화면을 새로고침해 주세요.');return;}
 core.ready.then(()=>{coreReady=true;syncButton();}).catch(()=>fail('기준 자료를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.'));
 input.addEventListener('input',invalidate);
 sample.addEventListener('click',async()=>{
  if(busy||readBusy||sampleBusy||!coreReady||input.value.trim()||file.files.length)return;
  invalidate();const version=revision;sampleBusy=true;syncButton();
  try{
   const checked=await core.verify('export','normal');
   if(version!==revision)return;
   if(checked.passed!==true)throw new Error('Example source unavailable');
   const output=await core.createOutput('export','normal',checked,{company:true,amount:true});
   if(version!==revision)return;
   input.value=JSON.stringify(output,null,2);
   sampleStatus.textContent='공개 합성 예시를 불러왔어요. 받은 자료 확인하기를 누르면 원자료부터 다시 검사해요.';
  }catch{if(version===revision)fail('공개 예시를 준비하지 못했어요. 법인 업무에서 저장한 JSON을 가져와 주세요.');}
  finally{if(version===revision){sampleBusy=false;syncButton();}}
 });
 file.addEventListener('change',async()=>{
  input.value='';invalidate();const selected=file.files[0];if(!selected)return;
  const version=revision;
  if(selected.size===0){fail('빈 파일이에요. 저장한 JSON 파일을 골라 주세요.',file);return;}
  if(selected.size>1024*1024){fail('파일이 너무 커요. 1MB 이하의 확인 내역을 골라 주세요.',file);return;}
  readBusy=true;syncButton();
  try{const text=await selected.text();if(version!==revision)return;input.value=text;if(!text.trim())fail('내용이 없는 파일이에요. 저장한 JSON 파일을 골라 주세요.',file);}
  catch{if(version===revision)fail('파일을 읽지 못했어요. 파일을 다시 골라 주세요.',file);}
  finally{if(version===revision){readBusy=false;syncButton();}}
 });
 $('clear-received').addEventListener('click',()=>{input.value='';file.value='';invalidate();input.focus();});
 $('receiver-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||readBusy||sampleBusy||!coreReady)return;error.hidden=true;input.removeAttribute('aria-invalid');file.removeAttribute('aria-invalid');
  const raw=input.value.trim();if(!raw){fail('JSON 내용을 붙여넣거나 파일을 골라 주세요.');return;}
  if(raw.length>1024*1024){fail('내용이 너무 길어요. 1MB 이하의 확인 내역을 사용해 주세요.');return;}
  let output;try{output=JSON.parse(raw);}catch{fail('JSON 형식이 맞지 않아요. 파일 전체 내용을 다시 가져와 주세요.');return;}
  if(!output||typeof output!=='object'||Array.isArray(output)){fail('확인 내역 객체가 필요해요. 업무에서 저장한 JSON을 가져와 주세요.');return;}
  const version=++revision;setBusy(true);ui.renderResult(result,null,{pending:true,receiver:true});
  try{await core.ready;const checked=await core.verifyOutput(output);if(version!==revision)return;ui.renderResult(result,checked,{receiver:true});ui.focusResult(result);}
  catch{if(version===revision){ui.renderResult(result,null,{receiver:true});fail('이 자료를 확인하지 못했어요. 업무에서 저장한 파일인지 확인해 주세요.');}}
  finally{setBusy(false);}
 });
})();
