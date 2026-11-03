import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { scenes } from './data';
import { receipt, amount, differenceLabel, financeChecks, receiptFields, type ReceiptView } from './receipt';
import { useExperience, type ExperienceState } from './useExperience';
import { saveFile, shortHash } from '../proof/model';
import './experience.css';
const { block: BLOCK, issuer: ISSUER, issuedAt: RECORDED_AT } = receipt;
import { IssueRecordFigure } from './IssueRecordFigure';
import { VerificationFigure } from './VerificationFigure';

function Icon({name, size=22}:{name:'check'|'arrow'|'lock'|'file'|'chain'|'shield'|'close'|'refresh';size?:number}) {
  const paths = {check:<path d="m5 12 4 4L19 6"/>,arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,lock:<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,file:<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h5"/></>,chain:<><path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/></>,shield:<><path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,close:<path d="m6 6 12 12M6 18 18 6"/>,refresh:<><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(()=>{ const dialog=ref.current!; dialog.showModal(); return ()=>dialog.close(); },[]);
  return <dialog ref={ref} aria-labelledby={titleId} className="xp-modal" onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close();}}><header><h2 id={titleId}>{title}</h2><button className="xp-icon-button" onClick={close} aria-label="닫기"><Icon name="close"/></button></header>{children}</dialog>;
}
function Document({view}:{view:ReceiptView}) {
  const internal = view === 'finance' || view === 'accounting';
  return <>
    <div className="xp-document-heading"><span><Icon name="file"/> {receipt.title}</span><span className={'xp-badge '+(internal?'muted':'')}>{internal?'원본 기반 열람본':'KODA 발행 원본'}</span></div>
    <div className="xp-balance"><span>해외 거래처에서 받은 금액</span><strong>{amount(receipt.receivedMinor)}<span>USDC</span></strong><p>{receipt.customer} · {receipt.receivedAt}</p></div>
    <div className="xp-receipt-amounts"><div><span>청구 금액</span><strong>{amount(receipt.invoiceMinor)} USDC</strong></div><div className="xp-receipt-gap"><span>청구 대비 차이</span><strong>{differenceLabel}</strong></div></div>
    <dl className="xp-receipt-fields">{receiptFields(view).map(field=><div key={field.label}><dt>{field.label}</dt><dd>{field.visibility && field.visibility !== 'full' && <span className={'xp-field-visibility '+field.visibility}>{field.visibility==='hidden'?<Icon name="lock" size={14}/>:'일부'}</span>}<span>{field.value}</span></dd></div>)}</dl>
    <p className="xp-receipt-source">청구 정보: 고객사 제공 · 수취 정보: KODA 모의 기록</p>
    {internal && <div className="xp-privacy"><Icon name="lock"/><div><strong>{view==='finance'?'대조에 필요한 정보만 보여요':'결산에 필요한 정보만 보여요'}</strong><p>{view==='finance'?'거래처는 코드로, 지갑 주소와 거래 식별자는 일부만 표시해요.':'거래처와 거래 식별자는 가리고, 지갑은 용도만 표시해요.'}</p></div></div>}
  </>;
}
function ChainDiagram({d}:{d:ExperienceState}) {
  const issuing=d.scene===0;
  const mismatch=Boolean(d.scene===5 && d.result && d.result.kind!=='match');
  const phase=d.failure?'failed':d.done?'complete':d.processing?(['creating','signing','connecting'] as const)[d.progress]??'connecting':'idle';
  const different=d.done&&mismatch;
  const labels=issuing
    ? ['원본 문서 생성 중','발행자 서명 중','문서 지문을 체인에 연결 중']
    : d.scene===4
      ? ['서명과 열람 권한 확인 중','원본 지문 다시 계산 중','발행 기록의 지문과 대조 중']
      : ['선택한 파일의 지문 계산 중','발행 기록의 지문과 대조 중','파일 내용 차이 확인 중'];
  const label=d.failure?'처리 실패 · 다시 시도해 주세요':d.error?'처리가 멈췄어요':d.done
    ? issuing?'발행 기록 연결 완료':different?(d.result?.kind==='changed'?'검증 실패 · 내용 변경 감지':d.result?.kind==='copy'?'지문 불일치 · 비교한 내용은 같아요':'지문 불일치 · 내용 비교 불가'):'지문 일치 · 검증 완료'
    : d.processing?labels[Math.min(d.progress,2)]!:issuing?'새 발행 기록을 기다리고 있어요':'기록된 지문과 파일을 비교해요';
  return <div className={`xp-chain-diagram ${issuing?'issue':d.scene===4?'verify audit':'verify inspect'} ${phase}${different?(d.result?.kind==='changed'?' different changed':' different'):''}`}>
    {issuing ? <IssueRecordFigure phase={phase}/> : <VerificationFigure original={d.scene===4} label={label} result={d.scene===5?d.result?.kind??null:null} stage={d.failure?'error':d.done?'complete':d.processing?(d.scene===4?(['checking','checking','comparing'] as const):(['checking','comparing','reading'] as const))[Math.min(d.progress,2)]!:'idle'}/>}
    <p className="xp-chain-status" role="status">{label}</p>
  </div>;
}
function Backend({d,openRecord}:{d:ExperienceState;openRecord:()=>void}) {
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{panel.current?.scrollTo({top:0});},[d.scene]);
  const s=scenes[d.scene]!;
  const progress=d.done?3:d.progress;
  const hasChain=[0,4,5].includes(d.scene);
  const mismatch=d.scene===5 && d.result && d.result.kind!=='match';
  return <aside ref={panel} className="xp-backend" aria-label="화면 뒤 처리 과정">
    <div className="xp-backend-top"><span><i/> 화면 뒤에서는</span><span className="xp-simulation">모의 시연</span></div>
    <h2>{hasChain ? <>원본의 지문을<br/><em>블록체인</em>으로 확인해요</> : d.scene===3 ? <>문서는 그대로,<br/><em>권한만</em> 이동해요</> : <>같은 원본,<br/><em>역할에 맞는</em> 열람 범위</>}</h2>
    <p className="xp-backend-intro">{hasChain?'사용자의 클릭이 기록과 검증으로 이어지는 과정이에요.':'인증과 정보 공개 범위는 KODA 시스템에서 관리해요.'}</p>
    <ol className="xp-process" aria-live="polite">{s.steps.map(([kind,title,description],i)=>{
      const finding=d.scene===5&&d.result&&i>0 ? i===1&&mismatch?'불일치':i===2?{match:'일치',changed:'변경 감지',copy:'내용 동일',unknown:'비교 불가'}[d.result.kind]:null : null;
      const changed=Boolean(finding&&d.result?.kind==='changed');
      return <li key={title} className={(progress>i?'complete':'')+(d.processing&&progress===i?' active':'')+(d.failure?.step===i?' failed':'')+(finding&&mismatch?' finding':'')+(changed?' changed':'')}><span className="xp-process-dot">{d.failure?.step===i||changed?<Icon name="close" size={17}/>:finding&&mismatch?<Icon name="file" size={17}/>:progress>i?<Icon name="check" size={17}/>:i+1}</span><div><span className={'xp-process-kind '+(kind==='블록체인'?'onchain':'')}>{kind==='블록체인'&&<Icon name="chain" size={15}/>} {kind}</span><h3>{title}</h3><p>{description}</p></div><span className="xp-process-status">{d.failure?.step===i?'처리 오류':finding??(progress>i?'완료':d.processing&&progress===i?'처리 중':'대기')}</span></li>;
    })}</ol>
    <div className={'xp-chain-card '+(hasChain?'':'offchain')}>
      <div className="xp-chain-title"><Icon name={hasChain?'chain':'shield'}/><b>{hasChain?'블록체인 · 문서 지문':'KODA · 원본 보관소'}</b></div>
      {hasChain ? <><ChainDiagram d={d}/><div className="xp-hash-pair"><span>발행 원본 지문</span><code>{shortHash(d.manifest?.hash??'')}</code></div>{d.scene===5 && d.result && <div className={'xp-hash-pair '+(mismatch?'mismatch':'')}><span>선택한 파일 지문</span><code>{shortHash(d.result.hash)}</code></div>}<p className="xp-chain-note">{mismatch?'지문이 달라요. 내용 비교 결과를 함께 확인하세요.':'문서 내용은 올리지 않고, 지문과 발행 정보만 남겨요.'}</p></> : <><div className="xp-vault"><Icon name="lock" size={30}/><div><strong>원본은 KODA에</strong><span>{d.scene===3?'감사인에게는 열람 권한만':'담당자에게는 필요한 정보만'}</span></div></div><p className="xp-chain-note">이 단계는 체인에 새로 기록하지 않아요.</p></>}
      <button className="xp-dark-link" onClick={openRecord}>공개 기록 살펴보기 <Icon name="arrow" size={17}/></button>
    </div>
    <p className="xp-backend-foot">지문 계산은 실제로, DID·권한·체인 기록은 모의로 동작해요.</p>
  </aside>;
}
export default function Experience() {
  const d=useExperience(); const s=scenes[d.scene]!;
  const workspaceBody=useRef<HTMLDivElement>(null);
  const pointerNavigation=useRef(false);
  const previousScene=useRef(d.scene);
  useEffect(()=>{
    if(previousScene.current===d.scene) return;
    previousScene.current=d.scene;
    if(!pointerNavigation.current) return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation=workspaceBody.current?.animate(reduced?[{opacity:.65},{opacity:1}]:[{opacity:.65,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduced?100:180,easing:'cubic-bezier(0.23,1,0.32,1)'});
    return ()=>animation?.cancel();
  },[d.scene]);
  useEffect(()=>{ const heading=workspaceBody.current?.querySelector('h1'); heading?.setAttribute('tabindex','-1'); heading?.focus({preventScroll:true}); workspaceBody.current?.scrollTo({top:0}); },[d.scene]);
  const [modal,setModal]=useState<'record'|'scope'|'document'|'history'|null>(null);
  const [query,setQuery]=useState(''); const [searched,setSearched]=useState(false);
  const openRecord=()=>{setQuery(d.manifest?.hash??'');setSearched(false);setModal('record');};
  const normalized=query.trim().replace(/[,#\s]/g,'');
  const found=Boolean(d.manifest&&[d.manifest.hash,BLOCK.replaceAll(',', ''),ISSUER].includes(normalized));
  const locked=d.scene>=4&&d.expired;
  const resultRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(d.result){resultRef.current?.focus({preventScroll:true});resultRef.current?.scrollIntoView({block:'nearest',behavior:'instant'});}},[d.result]);
  const resultTitle=d.result?{match:'KODA가 발행한 원본과 같아요',changed:'검증 실패 · 원본과 내용이 달라요',copy:'원본 아님 · 재저장 사본 또는 열람본',unknown:'지문이 달라요. 내용은 비교할 수 없어요'}[d.result.kind]:'';
  function next(){if(d.scene===5)d.go(4);else d.go(d.scene+1);}
  return <div className="xp-root" onPointerDownCapture={()=>{pointerNavigation.current=true;}} onKeyDownCapture={()=>{pointerNavigation.current=false;}}>
    <a className="xp-skip" href="#workspace">업무 화면으로 이동</a>
    <header className="xp-journey"><a className="xp-brand" href="#issue" onClick={e=>{e.preventDefault();d.go(0);}}>KODA<span>proof</span></a><nav aria-label="조직별 데모 흐름">{[{name:'KODA',steps:[0]},{name:'고객사',steps:[1,2,3]},{name:'외부 감사',steps:[4,5]}].map(g=><div className="xp-journey-group" key={g.name}><span className="xp-group-name">{g.name}</span><div>{g.steps.map(i=><button key={i} disabled={d.busy} className={(i===d.scene?'current ':'')+(d.completed.includes(i)?'done':'')+(i===5&&d.result&&d.result.kind!=='match'?' inspected-'+d.result.kind:'')} aria-current={i===d.scene?'step':undefined} onClick={()=>d.go(i)}><span>{d.completed.includes(i)?<Icon name={i===5&&d.result&&d.result.kind!=='match'?(d.result.kind==='changed'?'close':'file'):'check'} size={15}/>:i+1}</span>{scenes[i]!.label}</button>)}</div></div>)}</nav><button className="xp-icon-button xp-reset" onClick={d.reset} aria-label="처음부터 다시 시연" title="처음부터 다시 시연"><Icon name="refresh"/></button></header>
    <main className="xp-layout">
      <section className="xp-workspace" id="workspace" aria-label="사용자 업무 화면">
        <header className="xp-app-header"><div className="xp-org"><span className="xp-org-mark">{d.scene===0?'K':'한'}</span><strong>{s.org}</strong><span className="xp-app-divider"/><span>{d.scene===0?'증빙 관리':d.scene<4?'증빙함':'감사 업무'}</span></div><span className="xp-person"><span className="xp-person-dot"/>{s.role}</span></header>
        <div className="xp-workspace-body" ref={workspaceBody}>
          <div className="xp-page-heading"><div><p>{d.scene===0?'증빙 발행':d.scene<4?'한빛정밀 · 해외 대금 수취':'한빛정밀 · 수취 증빙 검증'}</p><h1>{locked?'열람 기간이 끝났어요':s.title}</h1><span>{locked?'권한을 다시 받으면 원본을 확인할 수 있어요.':s.description}</span></div></div>
          {locked ? <div className="xp-locked"><Icon name="lock" size={50}/><h2>원본 열람이 잠겼어요</h2><p>시연 권한을 복원해 검증을 이어갈 수 있어요.</p><button className="xp-button primary" onClick={()=>d.setExpired(false)}>시연 권한 복원</button></div> : <>
          {d.scene===0 && <div className="xp-card"><Document view="issuer"/><button className="xp-text-link" onClick={()=>setModal('document')}>발행 원본 상세 보기 <Icon name="arrow" size={17}/></button></div>}
          {d.scene===1 && <><div className="xp-card"><Document view="finance"/></div><div className="xp-review"><h2>대조 결과를 확인해 주세요</h2>{financeChecks.map((label,i)=><label key={label}><input type="checkbox" checked={d.checks[i]} disabled={d.busy||d.done} onChange={e=>d.setChecks(old=>old.map((v,j)=>j===i?e.target.checked:v))}/><span>{label}</span></label>)}</div></>}
          {d.scene===2 && <><div className="xp-handoff"><Icon name="check"/><span>{d.completed.includes(1)?'재무 대조 완료 · 100 USDC 차이는 확인 필요':'재무 담당자의 대조 완료를 가정한 미리보기예요'}</span></div><div className="xp-card"><Document view="accounting"/></div><div className="xp-connection"><span className="xp-file-icon"><Icon name="file"/></span><div><strong>2026년 10월 수출대금 결산 자료</strong><p>수취액 · 청구 대비 차이 · 확인 필요 상태를 연결</p></div><span className={'xp-badge '+(d.done?'':'muted')}>{d.done?'연결 완료':'연결 대기'}</span></div></>}
          {d.scene===3 && <div className="xp-card xp-share-card"><div className="xp-share-document"><Icon name="file" size={32}/><div><strong>해외 대금 수취 증빙</strong><p>한빛정밀 · DEMO-INV-1028</p></div></div><label className="xp-field">받는 감사인<select disabled={d.busy||d.done} aria-label="받는 감사인"><option>한울회계법인 · 외부 감사인</option></select></label><div className="xp-recipient-did"><Icon name="shield" size={18}/><span>등록된 감사인 DID로 지정돼요</span></div><div className="xp-field">열람 범위<div className="xp-preset"><Icon name="check"/><div><strong>외부감사 제출용</strong><span>해당 수취 건의 금액 · 거래처 · 지갑 · Tx (시연 설정)</span></div></div></div><label className="xp-field">열람 만료일<input type="date" min={receipt.grantStart} value={d.expires} disabled={d.busy||d.done} onChange={e=>d.setExpires(e.target.value)} aria-label="열람 만료일"/></label><div className="xp-privacy"><Icon name="lock"/><div><strong>파일은 전달되지 않아요</strong><p>감사인은 지정된 기간에 KODA 원본을 직접 열어요.</p></div></div></div>}
          {d.scene===4 && <><div className="xp-handoff"><Icon name="shield"/><span>{d.completed.includes(3)?`원본 전체 열람 가능 · ${d.expires}까지`:'감사 권한을 받은 상태의 미리보기예요'}</span></div><div className="xp-card"><Document view="auditor"/><button className="xp-text-link" onClick={()=>setModal('document')}>수취 건 · 원본 상세 보기 <Icon name="arrow" size={17}/></button></div></>}
          {d.scene===5 && <><div className={'xp-card xp-upload '+(d.result?'has-result':'')}><span className="xp-file-icon"><Icon name="file" size={34}/></span><h2>{d.file?d.file.name:'검사할 PDF를 선택해 주세요'}</h2><p>파일은 서버로 보내지 않고 브라우저에서 검사해요.</p><button className="xp-button secondary" disabled={d.busy} onClick={()=>d.input.current?.click()}>{d.file?'다른 파일 선택':'PDF 파일 선택'}</button><div className="xp-samples"><span>감사인 검증 시연</span><div>{(['original','modified','resaved'] as const).map(kind=><button key={kind} disabled={d.busy} onClick={()=>void d.sample(kind)}>{{original:'성공 시연 · 원본',modified:'실패 시연 · 수정본',resaved:'재저장 사본'}[kind]}</button>)}</div></div></div>{d.result&&<div ref={resultRef} tabIndex={-1} role="status" className={'xp-file-result '+d.result.kind}><span className="xp-result-symbol"><Icon name={d.result.kind==='match'?'check':d.result.kind==='changed'?'close':'file'} size={27}/></span><h2>{resultTitle}</h2><p>{{match:'원본 파일의 지문과 일치해요.',changed:`메일로 받은 사본에서 ${d.result.differences.length}곳의 변경을 발견했어요. 원본을 다시 확인해 주세요.`,copy:'지문은 다르지만 비교한 항목은 같아요. 재저장 사본 또는 열람본일 수 있어요.',unknown:'지원하지 않는 PDF 형식이에요. 지문 차이만으로 위변조라고 판단하지 않아요.'}[d.result.kind]}</p>{d.result.differences.map(diff=><div className="xp-difference" key={diff.label}><strong>{diff.label}</strong><span>원본 {diff.label.includes('(USDC)')?Number(diff.before).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDC':diff.before}<Icon name="arrow" size={17}/><b>사본 {diff.label.includes('(USDC)')?Number(diff.after).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDC':diff.after}</b></span></div>)}<button className="xp-text-link" onClick={()=>d.go(4)}>KODA 원본으로 돌아가기 <Icon name="arrow" size={17}/></button></div>}</>}

          </>}
          <div className="xp-workspace-tools"><button onClick={()=>setModal('history')}>활동 기록{d.records.length>0&&` ${d.records.length}`}</button><button onClick={()=>setModal('scope')}>역할별 열람 범위</button>{d.scene>=4&&<button disabled={d.busy} onClick={()=>d.setExpired(!d.expired)}>{d.expired?'시연 권한 복원':'기간 만료 시연'}</button>}{d.done&&d.scene===4&&<button onClick={()=>saveFile('KODA_검증증적_모의.json',JSON.stringify({mode:'simulation',hash:d.manifest?.hash,issuer:ISSUER,block:BLOCK,checkedAt:new Date().toISOString()},null,2),'application/json')}>검증 증적 저장</button>}</div>
        </div>
        {!locked&&<div className="xp-workspace-bottom">
          {d.done&&d.scene!==5&&<div className="xp-success" role="status"><Icon name="check"/><div><strong>{s.result}</strong><p>{d.scene===4?'원본 PDF 지문이 모의 발행 기록과 일치해요.':d.scene===0?'같은 원본을 역할에 맞게 열람할 수 있어요.':'다음 담당자 화면에서 업무를 이어갈 수 있어요.'}</p></div></div>}
          {d.failure&&<div className="xp-failure" role="alert"><Icon name="close"/><div><strong>{d.failure.title}</strong><p>{d.failure.detail}</p></div></div>}
          {d.error&&<p className="xp-error" role="alert">{d.error}</p>}
          <div className="xp-action-area"><span>{d.scene===1||d.scene===2?<><Icon name="lock" size={17}/> 원본 파일은 내려받지 않아요</>:d.scene===3?'열람 시작일 2026.11.03':d.scene===4?'원본의 지문과 발행 기록을 대조해요':d.scene===5?'PDF 최대 10 MB':'한빛정밀에 수취 증빙을 발행해요'}</span><button className="xp-button primary" disabled={d.busy||(!d.manifest)||(d.scene===1&&!d.done&&d.checks.some(v=>!v))||(d.scene===5&&!d.file&&!d.done)} aria-busy={d.busy} onClick={()=>d.done?next():void d.run()}>{d.busy?<><span className="xp-spinner"/>{d.processing?`${s.steps[Math.min(d.progress,2)]![1]} 중`:'파일을 불러오고 있어요'}</>:d.done?<>{d.scene===5?'KODA 원본 확인하기':s.next}<Icon name="arrow"/></>:d.failure?<><Icon name="refresh"/>다시 시도</>:s.action}</button></div>
        </div>}
      </section>
      <Backend d={d} openRecord={openRecord}/>
    </main>
    <footer className="xp-footer"><span>KODA × INHA <b>2026</b></span><span>가상 법인·모의 데이터로 체험하는 데모</span><span>{String(d.scene+1).padStart(2,'0')} / 06 <button disabled={d.busy||d.scene===0} onClick={()=>d.go(d.scene-1)} aria-label="이전 장면">←</button><button disabled={d.busy||d.scene===5} onClick={()=>d.go(d.scene+1)} aria-label="다음 장면">→</button></span></footer>
    <input ref={d.input} className="xp-hidden" type="file" accept="application/pdf,.pdf" aria-label="검사할 PDF 파일" onChange={e=>{const file=e.target.files?.[0];if(file)d.chooseFile(file);e.target.value='';}}/>
    {modal&&<Modal title={{record:'공개 블록체인 기록',scope:'역할별 열람 범위',document:'해외 대금 수취 증빙',history:'활동 기록'}[modal]} close={()=>setModal(null)}>
      {modal==='record'&&<><p className="xp-modal-description">로그인 없이 지문·블록 번호·발행자 DID로 조회해요. 시연용 모의 기록이에요.</p><form className="xp-search" onSubmit={e=>{e.preventDefault();setSearched(true);}}><input value={query} onChange={e=>{setQuery(e.target.value);setSearched(false);}} aria-label="문서 지문, 블록 번호, 발행자 DID" placeholder="문서 지문, 블록 번호, 발행자 DID"/><button className="xp-button primary">조회</button></form>{searched&&(found?<div className="xp-record-detail"><span className="xp-badge">찾은 기록 1건 · 모의</span><dl><dt>문서 지문</dt><dd><code>{d.manifest?.hash}</code></dd><dt>블록 번호</dt><dd>#{BLOCK}</dd><dt>발행자 DID</dt><dd><code>{ISSUER}</code></dd><dt>기록 시각</dt><dd>{RECORDED_AT}</dd></dl></div>:<p className="xp-empty" role="status">일치하는 기록이 없어요.</p>)}<div className="xp-privacy"><Icon name="lock"/><p>법인명, 수취 금액, 지갑 주소, 거래 상대방은 공개 기록에 담기지 않아요.</p></div></>}
      {modal==='scope'&&<><p className="xp-modal-description">같은 원본을 업무에 필요한 범위로 보여줘요. 시연용 권한 설정이에요.</p><div className="xp-table-wrap"><table className="xp-scope"><thead><tr><th>정보</th><th>재무 담당자</th><th>회계 담당자</th><th>외부 감사인</th></tr></thead><tbody>{[['청구・수취 금액・차이','전체','전체','전체'],['청구서 번호・수취 시각','전체','전체','전체'],['거래처','거래처 코드','가림','전체'],['수취 지갑','용도・주소 일부','용도만','전체'],['거래 식별자 (Tx)','일부','가림','전체']].map(row=><tr key={row[0]}>{row.map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table></div><p className="xp-modal-description">재무는 청구·수취 대조, 회계는 차이의 확인 상태를 유지하며 결산 자료 연결을 맡아요. 외부 감사인의 범위는 이번 시연의 가정이며 실무 정책 확정 전이에요.</p></>}
      {modal==='document'&&<><Document view={d.scene===1?'finance':d.scene===2||d.scene===3?'accounting':d.scene===0?'issuer':'auditor'}/><p className="xp-modal-description">문서 {receipt.id} · 발행자 {ISSUER}<br/>발행 시각 {receipt.issuedAt}<br/>가상 수취 사례이며 실제 송금·환전·정산을 실행하지 않아요.</p></>}

      {modal==='history'&&<>{d.records.length?<ol className="xp-history">{d.records.map((r,i)=><li key={i}><Icon name="check"/><div><strong>{r.action}</strong><p>{r.actor} · {r.time} · 모의 처리</p></div></li>)}</ol>:<p className="xp-empty">아직 수행한 작업이 없어요. 화면의 버튼으로 첫 작업을 시작해 보세요.</p>}</>}
    </Modal>}
  </div>;
}
