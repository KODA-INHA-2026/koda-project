'use strict';
const data=window.KODA_COMMERCIAL_CASES;
const assurance=window.KODA_ASSURANCE,assuranceUI=window.KODA_ASSURANCE_UI;
const scenarioIds=['normal','lookalike','spam','network','asset','tampered','stale','untrusted'];
const copy=window.KODA_PRODUCT_COPY;
const byId=id=>document.getElementById(id);
const validClient=id=>data.cases.some(c=>c.id===id);
const validViews=['list','detail','activity','archive'];
const params=new URLSearchParams(location.search);
const initialClient=params.get('client');
const requestedScenario=params.get('scenario');
let gateReady=false,gateBusy=false,gateRevision=0,outputBusy=false;
let gateCase=null;
let currentView=validViews.includes(params.get('view'))?params.get('view'):'list';
const current={id:validClient(initialClient)?initialClient:'export',stage:0,approvals:new Set(),received:false,company:true,amount:false,events:[],scenario:scenarioIds.includes(requestedScenario)?requestedScenario:'normal',request:null,result:null};
const storageKey='koda-workspace-assurance-20261025-3';
let restored=false,restoreWasVerified=false;
try{
 const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');
 if(!requestedScenario&&saved&&validClient(saved.id)&&(!initialClient||saved.id===initialClient)&&Number.isInteger(saved.stage)&&saved.stage>=0&&saved.stage<=4){
  Object.assign(current,{id:saved.id,stage:saved.stage,received:saved.received===true,company:saved.company!==false,amount:saved.amount===true,approvals:new Set((saved.approvals||[]).filter(x=>x==='A'||x==='B')),events:Array.isArray(saved.events)?saved.events.slice(-50):[],scenario:scenarioIds.includes(saved.scenario)?saved.scenario:'normal',request:saved.request&&typeof saved.request==='object'?saved.request:null});
  restored=true;restoreWasVerified=saved.wasVerified===true;
 }
}catch{}
const getCase=()=>data.cases.find(c=>c.id===current.id);
const words=()=>copy.cases[current.id];
const featureNames={export:'대금 확인',game:'파트너 정산',audit:'감사자료'};
const featureIcons={export:'receipt',game:'arrows-exchange',audit:'file-text'};
const stageEvents={export:['받은 대금을 확인했어요','청구서와 금액을 맞춰봤어요','담당자 확인을 기록했어요','회계팀에 보낼 자료를 정리했어요'],game:['파트너별 금액을 확인했어요','거래 상대를 확인했어요','두 사람의 승인을 모았어요','지급 담당자에게 넘길 기록을 정리했어요'],audit:['보여줄 항목을 골랐어요','자료 출처와 시간을 확인했어요','보여줄 내용을 확인했어요','감사자료 목록을 정리했어요']};
const fmt=(text,values={})=>String(text||'').replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
const label=key=>copy.common.labels[key];
const money=amount=>Number(amount).toLocaleString('en-US');
const referenceTime=()=>assuranceUI.time(gateCase?.referenceTime);
const blocked=()=>current.result!==null&&current.result.passed!==true;
const verified=()=>gateReady&&current.result?.passed===true&&current.result.clientId===current.id&&current.result.scenarioId===current.scenario;
// The same guard serves the detail download and the archive, with an additional
// receipt requirement before a game record can be presented as prepared.
const canDownload=()=>current.stage===4&&verified();
const hasPreparedOutput=()=>canDownload()&&(current.id!=='game'||current.received);
function addEvent(action,actor=copy.common.events.defaultActor){current.events.push({order:current.events.length+1,actor,action});}
function save(){try{sessionStorage.setItem(storageKey,JSON.stringify({...current,result:undefined,wasVerified:verified(),approvals:[...current.approvals]}));}catch{}}
function reset(message){
 current.stage=0;current.approvals.clear();current.received=false;current.result=null;gateRevision++;current.events=[];
 addEvent(copy.common.events.started);render(message);
}
function nextOwner(){
 if(!verified())return '자료 확인 담당자';
 if(current.id==='game'){
  if(current.stage===2&&current.approvals.size<2)return current.approvals.size===0?'승인자 A·B 역할':'승인자 '+(current.approvals.has('A')?'B':'A')+' 역할';
  if(current.stage===2||current.stage===3)return '지급 담당자';
  if(current.stage===4)return current.received?'정산 기록 담당자':'처리 결과 확인 담당자';
  return '정산 담당자';
 }
 if(current.id==='audit')return current.stage===4?'감사자료 받는 사람':current.stage<2?'자료 담당자':'공유 확인 담당자';
 return current.stage===4?'회계팀':'재무 담당자';
}
function nextAction(){
 if(!verified())return '주소·거래 항목과 발급 서명을 먼저 확인해 주세요.';
 if(current.id==='game'&&current.stage===2)return current.approvals.size===0?'A·B 역할로 각각 내용을 확인하고 승인해 주세요.':current.approvals.size===1?'남은 승인자가 같은 자료를 확인해 주세요.':'승인 기록을 지급 담당자에게 넘겨 주세요.';
 if(current.id==='game'&&current.stage===4)return current.received?'처리번호와 실제 지급 내역을 함께 확인해 주세요.':'지급 담당자에게 처리번호와 내역을 확인해 주세요.';
 return {export:['거래 상대와 받은 금액을 확인해 주세요.','연결할 청구서와 금액을 확인해 주세요.','대금과 청구서를 연결할지 확인해 주세요.','회계팀에 보낼 자료를 정리해 주세요.','저장한 내역과 함께 확인해 주세요.'],game:['파트너별 금액과 합계를 확인해 주세요.','거래 상대의 등록 자료를 확인해 주세요.','','요청·승인 기록과 처리 상태를 살펴보세요.',''],audit:['필요한 법인명과 거래 수량을 골라 주세요.','자료 출처와 기준 시간을 확인해 주세요.','받는 사람에게 필요한 내용인지 확인해 주세요.','자료에 담을 항목과 기준을 한 번 더 봐 주세요.','자료 목록에 필요한 항목이 담겼는지 확인해 주세요.']}[current.id][current.stage];
}
function shortStatus(){
 if(gateBusy)return '정보 확인 중';
 if(blocked())return '정보 확인 필요';
 if(!verified())return '정보 확인 대기';
 if(current.id==='game'&&current.stage===2)return current.approvals.size+' / 2명 승인';
 if(current.id==='game'&&current.stage===4)return current.received?'처리번호 연결됨':'처리 결과 대기';
 return {export:['대금 확인 대기','청구서 확인 중','담당자 확인 대기','자료 준비 중','자료 준비됨'],game:['금액 확인 대기','거래 상대 확인 중','승인 대기','넘길 자료 준비됨','처리 결과 대기'],audit:['항목 선택 중','출처 확인 중','내용 확인 중','자료 목록 확인 중','자료 목록 준비됨']}[current.id][current.stage];
}
function statusTone(){
 return blocked()?'danger':current.id==='game'&&((current.stage===2&&current.approvals.size<2)||(current.stage===4&&!current.received))?'warning':'neutral';
}
function cell(tag,text,className){
 const el=document.createElement(tag);el.textContent=text;
 if(className)el.className=className;
 return el;
}
function recordTable(caption,headers,rows,numberColumns=[]){
 const wrap=document.createElement('div');wrap.className='console-table-wrap';
 const table=document.createElement('table');table.className='console-table console-record-table';
 const cap=cell('caption',caption,'sr-only');table.append(cap);
 const head=document.createElement('thead'),hr=document.createElement('tr');
 headers.forEach((text,i)=>{const th=cell('th',text,numberColumns.includes(i)?'console-number':'');th.scope='col';hr.append(th);});
 head.append(hr);table.append(head);
 const body=document.createElement('tbody');
 rows.forEach(entry=>{
  const tr=document.createElement('tr');if(entry.tone)tr.dataset.tone=entry.tone;
  entry.values.forEach((text,i)=>{const td=cell(i===0?'th':'td',text,numberColumns.includes(i)?'console-number':'');if(i===0)td.scope='row';tr.append(td);});body.append(tr);
 });table.append(body);wrap.append(table);return wrap;
}
function recordFacts(entries){
 const dl=document.createElement('dl');dl.className='console-facts';
 entries.forEach(([key,value,tone])=>{
  const row=document.createElement('div');if(tone)row.dataset.tone=tone;
  row.append(cell('dt',key),cell('dd',value));dl.append(row);
 });return dl;
}
function renderRecords(){
 const c=getCase(),w=words(),records=byId('stage-records');records.replaceChildren();
 if(c.id==='export'){
  records.append(recordFacts([[label('counterparty'),c.counterparty.replace(' (가상 거래처)','')],[label('network'),(current.request?.network||c.network)+' · 요청 네트워크']]));
  records.append(recordTable('청구서와 받은 대금의 금액',['구분','금액'],[
   {values:[label('invoiceAmount'),money(c.amount)+' '+c.asset]},
   {values:[label('receiptAmount'),money(current.request?.transaction?.amount??c.amount)+' '+c.asset],tone:Number(current.request?.transaction?.amount??c.amount)!==c.amount?'warning':''},
   {values:[label('difference'),Number(current.request?.transaction?.amount??c.amount)!==c.amount?'금액 확인 필요':'차이 없어요'],tone:Number(current.request?.transaction?.amount??c.amount)!==c.amount?'warning':''}
  ],[1]));
  if(current.stage>=3)records.append(recordFacts([[label('linkedRecords'),w.linkedRecords]]));
 }else if(c.id==='game'){
  records.append(recordTable('정산할 파트너 3곳',['파트너','등록 정보','보낼 금액'],c.partners.map((p,i)=>({
   values:[p.name.replace(' (가상)',''),verified()?'서명된 등록 자료와 일치':'주소 확인 필요',money(current.request?.partners?.[i]?.amount??p.amount)+' '+(current.request?.partners?.[i]?.asset||c.asset)],
   tone:verified()?'':'neutral'
  })),[2]));
  const facts=[[label('settlementTotal'),money(c.amount)+' '+c.asset],[label('network'),c.network],[label('approvals'),current.approvals.size+' / 2명']];
  if(current.stage>=3)facts.push([label('executionReference'),current.received?'DEMO-EXEC-1028':'아직 도착하지 않았어요',current.received?'':'warning']);
  if(current.stage===4)facts.push([label('reconciliationStatus'),current.received?'요청·승인·처리번호 연결됨':'처리 결과를 기다리고 있어요',current.received?'':'warning']);
  records.append(recordFacts(facts));
 }else{
  records.append(recordFacts([[label('recordCount'),c.transactionCount+'건'],[label('companyIncluded'),current.company?'포함':'제외'],[label('amountIncluded'),current.amount?'포함':'제외']]));
  if(current.amount){
   records.append(recordTable('자료 목록에 담을 거래 3건',['거래 번호','자산','수량'],(current.request?.transactions||c.transactions).map(t=>({values:[t.id,t.asset,String(t.amount)]})),[2]));
  }else{
   const note=cell('p','거래 번호는 파일에 담고 수량은 표시 항목에서 빼요.','console-record-note');records.append(note);
  }
 }
}
function renderList(){
 const c=getCase(),w=words();
 byId('list-company').textContent=c.company;byId('list-industry').textContent=c.industry;
 byId('list-value-label').textContent=c.id==='audit'?'거래 건수':'금액';
 const tbody=byId('task-list-body');tbody.replaceChildren();
 const tr=document.createElement('tr'),name=document.createElement('th');name.scope='row';
 name.append(cell('strong',w.job),cell('small',c.workId,'console-mono'));tr.append(name);
 const statusCell=document.createElement('td'),status=cell('span',shortStatus(),'console-status');status.dataset.tone=statusTone();statusCell.append(status);tr.append(statusCell);
 tr.append(cell('td',c.id==='audit'?c.transactionCount+'건':money(c.amount)+' '+c.asset,'console-number'),cell('td',nextOwner()));
 const actionCell=document.createElement('td'),open=cell('button',current.stage===0?'확인하기':'이어하기','console-button console-outline');
 open.type='button';open.id='open-task';open.setAttribute('aria-label',c.company+' '+w.job+' '+open.textContent);
 open.addEventListener('click',()=>setView('detail'));actionCell.append(open);tr.append(actionCell);tbody.append(tr);
}
function renderActivity(){
 const body=byId('activity-table-body'),log=byId('event-log');body.replaceChildren();log.replaceChildren();
 current.events.forEach(event=>{
  const tr=document.createElement('tr');tr.append(cell('th',String(event.order).padStart(2,'0'),'console-order'),cell('td',event.actor),cell('td',event.action));
  tr.firstChild.scope='row';body.append(tr);
 });
 current.events.slice(-3).forEach(event=>{
  const li=document.createElement('li');li.append(cell('span',String(event.order).padStart(2,'0'),'console-event-order'));
  const detail=document.createElement('div');detail.append(cell('strong',event.action),cell('small',event.actor));li.append(detail);log.append(li);
 });
 byId('activity-table-wrap').hidden=current.events.length===0;byId('activity-empty').hidden=current.events.length!==0;
}
function renderArchive(){
 const c=getCase(),w=words(),ready=hasPreparedOutput();
 byId('archive-content').hidden=!ready;byId('archive-empty').hidden=ready;
 byId('download-archive').disabled=!ready||outputBusy;byId('download-archive').setAttribute('aria-busy',String(outputBusy));
 if(ready){
  byId('archive-name').textContent=w.outputLabel;byId('archive-file').textContent=c.workId+' · JSON';
  byId('archive-source').textContent=current.result?.recordId||'—';byId('archive-time').textContent=referenceTime();
  byId('archive-description').textContent=c.id==='game'?w.output.receivedDescription:w.output.description;
 }else{
  byId('archive-empty-title').textContent=c.id==='game'&&current.stage===4?'처리 결과를 기다리고 있어요.':'아직 준비된 자료가 없어요.';
  byId('archive-empty-description').textContent=c.id==='game'&&current.stage===4?'진행 기록은 업무 내역에서 저장할 수 있어요. 처리 결과를 연결한 뒤 정산 기록을 정리해 주세요.':'업무 내용을 확인한 뒤 자료를 정리해 주세요.';
 }
}
function showStatus(value,message){
 const box=byId('stage-status');box.dataset.tone=value.tone==='success'?'neutral':value.tone||'neutral';
 box.replaceChildren(cell('strong',fmt(value.title,{count:current.approvals.size})),cell('p',message||value.body));
}
function renderViews(){
 document.querySelectorAll('[data-view-panel]').forEach(panel=>{panel.hidden=panel.dataset.viewPanel!==currentView;});
 document.querySelectorAll('[data-view]').forEach(link=>{
  link.href='?client='+encodeURIComponent(current.id)+'&view='+link.dataset.view+'&scenario='+encodeURIComponent(current.scenario);
  if(link.closest('.console-nav')&&link.dataset.view===currentView)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 });
 document.querySelectorAll('.view-company').forEach(el=>{el.textContent=getCase().company;});
 document.title=getCase().company+' · '+({list:'업무 홈',detail:featureNames[current.id],activity:'활동 내역',archive:'자료 보관함'})[currentView]+' — KODA Workspace';
}
function render(message,progress=false){
 const c=getCase(),w=words(),step=w.stages[current.stage];
 byId('client-select').value=c.id;byId('nav-task-label').textContent=featureNames[c.id];byId('feature-icon').src='assets/icons/'+featureIcons[c.id]+'.svg';
 byId('workspace-company').textContent=c.company;byId('client-name').textContent=w.job;byId('workspace-subtitle').textContent=w.question;byId('work-id').textContent=c.workId;
 byId('stage-kicker').textContent=step.label;byId('stage-title').textContent=step.title;byId('stage-description').textContent=step.description;
 if(!verified()){byId('stage-title').textContent='주소와 거래 정보를 먼저 확인해요.';byId('stage-description').textContent='발급 서명과 요청한 정보가 맞아야 다음 업무로 이어갈 수 있어요.';}
 if(c.id==='game'&&current.stage===4&&current.received){byId('stage-title').textContent=w.received.title;byId('stage-description').textContent=w.received.description;}
 byId('task-status').textContent=shortStatus();byId('task-status').dataset.tone=statusTone();
 byId('context-source').textContent=gateCase?.record?.payload?.recordId||gateCase?.recordId||'—';byId('context-time').textContent=referenceTime();
 byId('next-owner').textContent=nextOwner();byId('context-responsibility').textContent=nextAction();
 renderRecords();
 byId('audit-disclosure').hidden=false;byId('audit-company').checked=current.company;byId('audit-amount').checked=current.amount;
 byId('approval-panel').hidden=!(verified()&&c.id==='game'&&current.stage===2);
 for(const actor of ['A','B']){const button=byId('approve-'+actor.toLowerCase());button.disabled=!verified()||current.approvals.has(actor);button.textContent=current.approvals.has(actor)?actor+' 역할 · 승인했어요':actor+' 역할로 승인하기';}
 byId('approval-count').textContent=current.approvals.size+' / 2';
 const next=byId('next-stage');next.textContent=gateBusy?'정보를 확인하고 있어요…':!verified()?'정보 확인하기':step.action;
 next.disabled=!gateReady||gateBusy||outputBusy||(verified()&&(current.stage===4||(c.id==='game'&&current.stage===2&&current.approvals.size<2)));next.hidden=verified()&&current.stage===4;next.setAttribute('aria-busy',String(gateBusy));
 byId('repair-case').textContent='정상 자료로 바꾸기';byId('repair-case').hidden=!blocked();
 byId('receive-execution').hidden=!(verified()&&c.id==='game'&&current.stage===4&&!current.received);
 const download=byId('download-work');download.hidden=!canDownload();download.textContent=w.output.download;download.disabled=outputBusy||!canDownload();download.setAttribute('aria-busy',String(outputBusy));
 download.className='console-button '+(c.id==='game'&&!current.received?'console-outline':'console-primary');
 byId('output-help').hidden=!canDownload();byId('output-help').textContent=c.id==='game'?(current.received?w.output.receivedDescription:w.output.pendingDescription):w.output.description;
 let status=step.status;
 if(!verified())status={tone:blocked()?'danger':'neutral',title:blocked()?'아래 확인 결과를 살펴봐 주세요.':'정보 확인이 필요해요.',body:'발급 서명과 주소·거래를 확인한 뒤 다음 업무를 진행해요.'};
 else if(c.id==='game'&&current.stage===2)status=step.statusVariants[current.approvals.size===0?'none':current.approvals.size===1?'partial':'complete'];
 else if(c.id==='game'&&current.stage===4&&current.received)status={tone:'neutral',title:'처리번호를 기록에 연결했어요.',body:'지급 여부는 실제 처리 내역을 함께 확인하세요.'};
 showStatus(status,message);
 assuranceUI.renderResult(byId('assurance-result'),current.result,{pending:gateBusy});
 if(current.result){const recheck=cell('button','정보 다시 확인하기','console-button console-outline assurance-recheck');recheck.type='button';recheck.addEventListener('click',()=>runVerification());byId('assurance-result').append(recheck);}
 renderList();renderActivity();renderArchive();renderViews();save();
 document.dispatchEvent(new CustomEvent('koda:work-rendered',{detail:{progress:progress&&currentView==='detail'}}));
}
function routeURL(){return '?client='+encodeURIComponent(current.id)+'&view='+currentView+'&scenario='+encodeURIComponent(current.scenario);}
function focusView(from){
 const target=currentView==='detail'?byId('client-name'):currentView==='activity'?byId('activity-heading'):currentView==='archive'?byId('archive-heading'):from==='detail'?byId('open-task'):byId('list-heading');
 target?.focus({preventScroll:true});
}
function setView(view,{push=true,focus=true}={}){
 if(!validViews.includes(view))return;
 const from=currentView;currentView=view;render();
 if(push)history.pushState(null,'',routeURL());
 if(focus){focusView(from);window.scrollTo({top:0,behavior:'instant'});}
 byId('view-status').textContent=({list:'업무 목록',detail:featureNames[current.id]+' 업무 내역',activity:'활동 내역',archive:'자료 보관함'})[view]+'을 열었어요.';
}
function changeClient(id,view='list'){
 if(!validClient(id))return;
 if(id===current.id){setView(view);return;}
 current.id=id;current.scenario='normal';current.request=null;currentView=view;loadGateInputs();
 reset(fmt(copy.common.messages.clientChanged,{company:getCase().company}));
 history.pushState(null,'',routeURL());byId('view-status').textContent=getCase().company+' 업무를 열었어요.';
}
document.querySelectorAll('[data-view]').forEach(link=>link.addEventListener('click',event=>{
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();setView(link.dataset.view);
}));
document.querySelectorAll('[data-open-current]').forEach(button=>button.addEventListener('click',()=>setView('detail')));
byId('back-to-list').addEventListener('click',()=>setView('list'));
byId('client-select').addEventListener('change',event=>changeClient(event.target.value));
byId('restart-case').addEventListener('click',()=>{current.scenario='normal';current.request=null;loadGateInputs();reset('정상 자료로 돌아왔어요. 정보를 다시 확인해 주세요.');history.replaceState(null,'',routeURL());});
byId('assurance-scenario').addEventListener('change',event=>{current.scenario=event.target.value;current.request=null;loadGateInputs();reset('자료를 바꿨어요. 정보를 다시 확인해 주세요.');history.replaceState(null,'',routeURL());});
byId('next-stage').addEventListener('click',async()=>{
 if(!verified()){await runVerification();return;}
 if(current.stage>=4||(current.id==='game'&&current.stage===2&&current.approvals.size<2))return;
 addEvent(stageEvents[current.id][current.stage]);current.stage++;render(undefined,true);
 if(current.id==='game'&&current.stage===2)(current.approvals.has('A')?byId('approve-b'):byId('approve-a')).focus();
 else if(current.stage===4)(byId('receive-execution').hidden?byId('download-work'):byId('receive-execution')).focus({preventScroll:true});
});
byId('repair-case').addEventListener('click',()=>{current.scenario='normal';current.request=null;loadGateInputs();reset('정상 자료로 바꿨어요. 정보를 다시 확인해 주세요.');history.replaceState(null,'',routeURL());byId('next-stage').focus();});
for(const actor of ['A','B'])byId('approve-'+actor.toLowerCase()).addEventListener('click',()=>{
 if(!verified()||current.id!=='game'||current.stage!==2||current.approvals.has(actor))return;
 current.approvals.add(actor);addEvent(copy.common.events.approval,actor+' 역할');render();
 (current.approvals.size===2?byId('next-stage'):byId('approve-'+(actor==='A'?'b':'a'))).focus();
});
byId('receive-execution').addEventListener('click',()=>{
 if(!verified()||current.id!=='game'||current.stage!==4||current.received)return;
 current.received=true;addEvent('처리 결과를 연결했어요','처리 결과 확인 담당자');render();byId('download-work').focus({preventScroll:true});
});
for(const [id,key]of [['audit-company','company'],['audit-amount','amount']])byId(id).addEventListener('change',event=>{
 current[key]=event.target.checked;reset('담을 항목을 바꿨어요. 정보를 다시 확인해 주세요.');
});
async function downloadOutput(archive=false){
 if(outputBusy||!canDownload()||(archive&&!hasPreparedOutput()))return;
 const version=gateRevision;outputBusy=true;render();
 try{
  const out=await assurance.createOutput(current.id,current.scenario,current.result,{company:current.company,amount:current.amount});
  if(version!==gateRevision)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=getCase().workId+'-확인내역.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch{if(version===gateRevision)byId('view-status').textContent='확인 내역을 만들지 못했어요. 정보를 다시 확인해 주세요.';}
 finally{outputBusy=false;render();}
}
byId('download-work').addEventListener('click',()=>downloadOutput());
byId('download-archive').addEventListener('click',()=>downloadOutput(true));
function invalidateGate(){
 const hadResult=current.result!==null||current.stage>0||current.approvals.size>0;
 gateRevision++;current.result=null;current.stage=0;current.approvals.clear();current.received=false;
 if(hadResult)addEvent('입력이 바뀌어 이전 확인 결과와 승인을 지웠어요.');
 byId('assurance-input-error').hidden=true;document.querySelectorAll('[data-request-path]').forEach(field=>field.removeAttribute('aria-invalid'));render();
}
function markInvalidInputs(){
 const fields=[...document.querySelectorAll('[data-request-path]')];
 fields.forEach(field=>{
  const path=field.dataset.requestPath,value=field.value.trim();
  const isAddress=/(wallet|counterparty|recipient|from|to)$/.test(path),isTransaction=/(transaction\.id|transactions\.\d+\.id)$/.test(path);
  const invalid=(isAddress&&!/^0x[0-9a-f]{40}$/i.test(value))||(isTransaction&&!/^0x[0-9a-f]{64}$/i.test(value))||(field.type==='number'&&(!value||!Number.isFinite(Number(value))));
  if(invalid){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','assurance-input-error');}
 });
 if(fields.some(f=>f.getAttribute('aria-invalid')==='true')){const error=byId('assurance-input-error');error.textContent='주소는 0x와 40자리, 거래 번호는 0x와 64자리의 16진수로 입력해 주세요. 수량도 확인해 주세요.';error.hidden=false;}
}
function loadGateInputs(){
 if(!gateReady)return;
 gateCase=assurance.getCase(current.id,current.scenario);if(!current.request)current.request=structuredClone(gateCase.request);
 const select=byId('assurance-scenario');select.replaceChildren();gateCase.scenarios.forEach(s=>{const option=cell('option',s.label);option.value=s.id;select.append(option);});select.value=current.scenario;select.disabled=false;
 assuranceUI.renderRequest(byId('assurance-inputs'),current.id,current.request,invalidateGate);
}
async function runVerification(){
 if(!gateReady||gateBusy)return;
 const version=++gateRevision;gateBusy=true;current.stage=0;current.approvals.clear();current.received=false;current.result=null;render();
 const client=current.id,scenario=current.scenario,request=structuredClone(current.request);
 try{
  const result=await assurance.verify(client,scenario,{request});if(version!==gateRevision)return;
  current.result=result;if(result.passed===true)current.stage=1;
  if(result.passed!==true)markInvalidInputs();
  addEvent(result.passed===true?'발급 서명과 요청한 정보를 확인했어요.':'정보 확인에서 다른 항목을 찾았어요.');
 }catch{if(version===gateRevision){const error=byId('assurance-input-error');error.textContent='정보를 확인하지 못했어요. 입력을 확인하고 다시 눌러 주세요.';error.hidden=false;}}
 finally{gateBusy=false;render();}
 if(version===gateRevision){const invalid=document.querySelector('[data-request-path][aria-invalid=true]');if(invalid?.closest('details'))invalid.closest('details').open=true;if(invalid)invalid.focus();else assuranceUI.focusResult(byId('assurance-result'));}
}
window.addEventListener('popstate',()=>{
 const query=new URLSearchParams(location.search),id=query.get('client'),view=query.get('view'),scenario=scenarioIds.includes(query.get('scenario'))?query.get('scenario'):'normal';
 const from=currentView;currentView=validViews.includes(view)?view:'list';
 if((validClient(id)&&id!==current.id)||scenario!==current.scenario){if(validClient(id))current.id=id;current.scenario=scenario;current.request=null;loadGateInputs();reset('확인할 자료를 바꿨어요. 정보를 다시 확인해 주세요.');}
 else render();focusView(from);
});
render();
if(!assurance){const error=byId('assurance-input-error');error.textContent='확인 기능을 불러오지 못했어요. 화면을 새로고침해 주세요.';error.hidden=false;}
else assurance.ready.then(async()=>{
 gateReady=true;loadGateInputs();
 if(restored&&restoreWasVerified&&current.request){
  const version=gateRevision,client=current.id,scenario=current.scenario,request=structuredClone(current.request);
  try{
   const result=await assurance.verify(client,scenario,{request});
   if(version!==gateRevision||client!==current.id||scenario!==current.scenario)return;
   current.result=result;if(!verified()){current.stage=0;current.approvals.clear();current.received=false;}
  }catch{
   if(version!==gateRevision||client!==current.id||scenario!==current.scenario)return;
   current.stage=0;current.result=null;current.approvals.clear();current.received=false;
  }
  render();
 }else reset();
 history.replaceState(null,'',routeURL());
}).catch(()=>{const error=byId('assurance-input-error');error.textContent='기준 자료를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.';error.hidden=false;});

