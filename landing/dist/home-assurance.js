'use strict';
(async()=>{
 const panels=[...document.querySelectorAll('[data-assurance-preview]')];
 const put=(parent,tag,text,className)=>{const el=document.createElement(tag);el.textContent=String(text??'');if(className)el.className=className;parent.append(el);return el;};
 function renderArtifact(panel,data){
  const root=panel.querySelector('[data-preview-artifact]');if(!root)return;
  root.replaceChildren();root.classList.add(`artifact-${data.id}`);
  const top=put(root,'div','','artifact-top');put(top,'span',data.id==='export'?'받은 입금 요청':data.id==='game'?'지급 전 등록 주소 대조':'요청한 수탁 거래');put(top,'span',data.company);
  if(data.id==='export'){
   put(root,'div','거래 상대와 연결할 받은 대금','artifact-heading');
   const amount=put(root,'div',new Intl.NumberFormat('ko-KR',{maximumFractionDigits:8}).format(Number(data.request.transaction.amount)),'artifact-amount');put(amount,'small',data.request.transaction.asset);
   const foot=put(root,'div','','artifact-foot');put(foot,'span','원자료와 주소·거래를 각각 대조');put(foot,'span','청구서 연결은 확인 이후');
  }else if(data.id==='game'){
   const partners=put(root,'div','','artifact-partners');
   for(const partner of data.request.partners){const item=put(partners,'div','','artifact-partner');put(item,'strong',partner.id);put(item,'span',`${partner.amount} ${partner.asset} · 요청 수량`);put(item,'code',partner.recipient);}
   const approval=put(root,'div','','artifact-approvals');put(approval,'b','A');put(approval,'b','B');put(approval,'span','주소·자료 확인 이후 두 명 승인');
  }else{
   const ledger=put(root,'div','','artifact-ledger');
   for(const transaction of data.request.transactions){put(ledger,'span',transaction.asset);put(ledger,'span',transaction.amount);}
   const foot=put(root,'div','','artifact-foot');put(foot,'span','필요한 항목 선택 → 확인 내역 저장');put(foot,'span','받는 사람도 재검증');
  }
 }
 try{
  if(!window.KODA_ASSURANCE)throw new Error('확인 기능을 불러오지 못했어요.');
  await window.KODA_ASSURANCE.ready;
  await Promise.all(panels.map(async panel=>{
   try{
    const caseData=window.KODA_ASSURANCE.getCase(panel.dataset.assurancePreview,panel.dataset.scenario);
    renderArtifact(panel,caseData);
    const result=await window.KODA_ASSURANCE.verify(panel.dataset.assurancePreview,panel.dataset.scenario);
    const verdict=panel.querySelector('[data-preview-verdict]');verdict.dataset.tone=result.passed?'success':'warning';
    panel.querySelector('.preview-verdict-mark').textContent=result.passed?'✓':'!';
    panel.querySelector('[data-preview-title]').textContent=result.title;
    panel.querySelector('[data-preview-summary]').textContent=result.summary;
    const address=(caseData.addressFields||[]).find(f=>f.value.toLowerCase()!==f.expected.toLowerCase())||(caseData.addressFields||[])[0];
    if(address){const comparison=document.createElement('div');comparison.className='preview-address';put(comparison,'p',address.label);for(const [name,value] of [['원자료 주소',address.expected],['요청 주소',address.value]]){const row=put(comparison,'div','');put(row,'span',name);const code=put(row,'code','');if(name==='요청 주소'){let plain='';for(let i=0;i<value.length;i++){if(value[i]?.toLowerCase()!==address.expected[i]?.toLowerCase()){if(plain){code.append(document.createTextNode(plain));plain='';}put(code,'mark',value[i]);}else plain+=value[i];}if(plain)code.append(document.createTextNode(plain));}else code.textContent=value;}panel.querySelector('[data-preview-verdict]').after(comparison);}
    const facts=panel.querySelector('[data-preview-facts]');facts.replaceChildren();
    for(const fact of (result.facts||[]).slice(0,5)){const row=put(facts,'div','');put(row,'dt',fact.label);put(row,'dd',fact.value);}
    const checks=panel.querySelector('[data-preview-checks]');checks.replaceChildren();
    const all=result.checks||[];
    const important=[...all.filter(c=>c.passed===false),...all.filter(c=>/signature|source_context|counterparty|partner_addresses|wallet|transaction|network|source_time/.test(c.id))];
    const selected=[...new Map([...important,...all].map(c=>[c.id,c])).values()].slice(0,6);
    for(const check of selected){const li=put(checks,'li','');li.dataset.state=check.passed===true?'pass':check.passed===false?'fail':'pending';put(li,'span',check.passed===true?'✓':check.passed===false?'!':'—','check-mark');put(li,'span',check.label);put(li,'strong',check.passed===true?'맞아요':check.passed===false?'확인 필요':'미확인');}
    if(result.checkedAt){const date=new Date(result.checkedAt);if(Number.isFinite(date.getTime()))panel.querySelector('[data-preview-time]').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' KST';}
   }catch(error){panel.querySelector('[data-preview-title]').textContent='확인 내역을 불러오지 못했어요.';panel.querySelector('[data-preview-summary]').textContent='업무 화면을 열어 다시 확인해 주세요.';}
   finally{panel.setAttribute('aria-busy','false');}
  }));
 }catch(error){for(const panel of panels){panel.setAttribute('aria-busy','false');panel.querySelector('[data-preview-title]').textContent='확인 내역을 불러오지 못했어요.';panel.querySelector('[data-preview-summary]').textContent='업무 화면에서 다시 확인해 주세요.';}}
})();
