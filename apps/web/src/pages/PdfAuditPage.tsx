import { useCallback, useEffect, useRef, useState } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import { createSupportedPdf, pdfEntries, canonicalJson, parseCanonical, validatePayload, inspectPdf, MAX_PDF_BYTES, type AuditAccessDTO, type EvidencePayload, type SessionDTO, type PdfInspection, type MockAnchorRecord } from '@koda/protocol';
import { api, RequestError } from '../api/client';
import { Certificate, decimal } from '../components/Certificate';
import type { VerificationPhase } from '../components/AuditVerificationScene';
import { Notice } from '../components/Notice';
import { ActivityLog, DemoWorkspace, type TraceItem } from '../components/DemoWorkspace';
import { displayDate } from '../components/VerificationPanel';
interface FileTrust { mode:'MOCK'; issuerSigningDid:string }
export function PdfAuditPage({ path, token, session, navigate, consumed, onUnauthorized }: { path:string; token:string|null; session:SessionDTO; navigate:(p:string)=>void; consumed:()=>void; onUnauthorized:()=>void }) {
  const [phase,setPhase]=useState<VerificationPhase>('idle');
  const [fileMode,setFileMode]=useState(false);
  const [preparing,setPreparing]=useState(false);
  const [access,setAccess]=useState<AuditAccessDTO|null>(null),[error,setError]=useState(''),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false);
  const [result,setResult]=useState<PdfInspection|null>(null),[file,setFile]=useState<File|null>(null),[fileError,setFileError]=useState(''),[inquiry,setInquiry]=useState(false),[copyNotice,setCopyNotice]=useState(''),[refreshKey,setRefreshKey]=useState(0);
  const fileInput=useRef<HTMLInputElement>(null);const selection=useRef(0),generation=useRef(0),permissions=useRef(0);const request=useRef<AbortController|null>(null),verification=useRef<AbortController|null>(null);
  const live=useRef(true),checkingNow=useRef(true);const viewId=useRef(crypto.randomUUID()),opened=useRef<string|null>(null);
  const binding=useRef<string|null>(null);const saved=useRef<{binding:string;result:PdfInspection}|null>(null);
  const grantId=path.startsWith('/audit/grants/')?path.split('/')[3]:null;
  const subject=[session.principal.id,session.principal.did,session.principal.role,session.principal.organizationId,session.csrf].join(':');
  const bind=useCallback((a:AuditAccessDTO,t:FileTrust)=>canonicalJson({subject,grant:a.grant,source:a.envelope,trust:t}),[subject]);
  const clear=useCallback(()=>{setPreparing(false);setPhase('idle');generation.current++;selection.current++;verification.current?.abort();saved.current=null;binding.current=null;setResult(null);setFile(null);setFileError('');setInquiry(false);setCopyNotice('');setBusy(false);if(fileInput.current)fileInput.current.value='';},[]);
  const fail=useCallback((e:unknown)=>{setAccess(null);clear();if(e instanceof RequestError&&e.status===401)onUnauthorized();else setError(e instanceof Error?e.message:'현재 열람 권한을 확인할 수 없습니다. 다시 시도해 주세요.');},[clear,onUnauthorized]);
  const recheck=useCallback(async()=>{
    const seq=++permissions.current;request.current?.abort();const c=new AbortController();request.current=c;checkingNow.current=true;setChecking(true);setAccess(null);setResult(null);setError('');
    try{
      if(!grantId&&!token)throw new Error('원래 권한 링크를 다시 열어 주세요. 링크 정보는 브라우저에 저장하지 않습니다.');
      const a=grantId?await api<AuditAccessDTO>('/grants/'+grantId+(opened.current===grantId?'/evidence':'/open'),opened.current===grantId?{signal:c.signal}:{method:'POST',headers:{'x-csrf-token':session.csrf},body:JSON.stringify({viewId:viewId.current}),signal:c.signal}):await api<AuditAccessDTO>('/grants/open',{method:'POST',headers:{'x-csrf-token':session.csrf},body:JSON.stringify({token,viewId:viewId.current}),signal:c.signal});
      if(c.signal.aborted||seq!==permissions.current)return;opened.current=a.grant.id;
      if(!grantId){consumed();navigate('/audit/grants/'+a.grant.id);return;}
      const t=await api<FileTrust>('/verification/file-trust',{signal:c.signal});const b=bind(a,t);
      if(c.signal.aborted||seq!==permissions.current)return;
      if(binding.current&&binding.current!==b)clear();binding.current=b;
      if(!document.hidden){setAccess(a);if(saved.current?.binding===b)setResult(saved.current.result);}
    }catch(e){if(!c.signal.aborted&&seq===permissions.current)fail(e);}
    finally{if(!c.signal.aborted&&seq===permissions.current&&!document.hidden){checkingNow.current=false;setChecking(false);}}
  },[grantId,token,session.csrf,consumed,navigate,bind,clear,fail]);
  useEffect(()=>{
    live.current=true;void recheck();const poll=setInterval(()=>{if(!document.hidden)void recheck();},15000);
    const focus=()=>{if(!document.hidden)void recheck();};const visibility=()=>{if(document.hidden){permissions.current++;request.current?.abort();generation.current++;verification.current?.abort();setBusy(false);checkingNow.current=true;setChecking(true);setAccess(null);setResult(null);}else void recheck();};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
    return()=>{if(grantId){opened.current=null;viewId.current=crypto.randomUUID();}live.current=false;permissions.current++;generation.current++;selection.current++;request.current?.abort();verification.current?.abort();saved.current=null;binding.current=null;clearInterval(poll);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);};
  },[recheck,grantId]);
  useEffect(()=>{if(!access)return;const timeout=setTimeout(()=>{setAccess(null);clear();setError('열람 권한이 만료되었습니다. 재무담당자에게 새 권한을 요청해 주세요.');},Math.max(0,Date.parse(access.grant.expiresAt)-Date.now()));return()=>clearTimeout(timeout);},[access,clear]);
  const accessLost=useCallback(()=>{setAccess(null);clear();setError('현재 열람 권한을 확인할 수 없습니다. 권한을 다시 확인해 주세요.');},[clear]);
  async function bytes(url:string,signal:AbortSignal){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});if(!r.ok){const e=await r.json().catch(()=>({}));throw new RequestError(r.status,e.code??'FILE_UNAVAILABLE',e.message??'원본 PDF를 불러오지 못했습니다.');}return new Uint8Array(await r.arrayBuffer());}
  async function verify(useFile=false){
    if(!grantId||!access||busy||checkingNow.current||(useFile&&!file))return;
    setPhase('access');
    const seq=++generation.current,selectedVersion=selection.current,selected=file;const c=new AbortController();verification.current?.abort();verification.current=c;saved.current=null;setResult(null);setBusy(true);setFileError('');setError('');
    const current=()=>live.current&&!c.signal.aborted&&generation.current===seq&&selection.current===selectedVersion;
    try{
      const a=await api<AuditAccessDTO>('/grants/'+grantId+'/evidence',{signal:c.signal});const t=await api<FileTrust>('/verification/file-trust',{signal:c.signal});const b=bind(a,t);
      if(!current())return;if(b!==binding.current){clear();void recheck();return;}
      const p=parseCanonical(a.envelope.payloadCanonical);validatePayload(p);const proof=a.envelope.sourceProof;if(!proof||t.mode!=='MOCK')throw new Error('지원하는 PDF 증명 기준이 아닙니다.');
      const original=await bytes('/api/grants/'+grantId+'/file',c.signal);const font=await bytes('/fonts/PretendardVariable.ttf',c.signal);
      if(!current())return;setPhase('record');
      let record:MockAnchorRecord|null=null;try{record=await api<MockAnchorRecord>('/grants/'+grantId+'/anchor-record',{signal:c.signal});}catch(e){if(!(e instanceof RequestError)||e.status<500)throw e;}
      const chosen=useFile&&selected?new Uint8Array(await selected.arrayBuffer()):original;
      if(!current())return;
      setPhase('cryptography');
      const outcome=await inspectPdf(chosen,original,proof,p,t.issuerSigningDid,record,font);
      if(!current())return;
      setPhase('finalize');
      await api('/grants/'+grantId+'/file-verification-events',{method:'POST',headers:{'x-csrf-token':session.csrf},body:JSON.stringify({schemaVersion:'pdf-inspection/1',status:outcome.status}),signal:c.signal});
      const final=await api<AuditAccessDTO>('/grants/'+grantId+'/evidence',{signal:c.signal});const finalTrust=await api<FileTrust>('/verification/file-trust',{signal:c.signal});
      if(!current())return;if(bind(final,finalTrust)!==b||binding.current!==b){clear();void recheck();return;}
      saved.current={binding:b,result:outcome};if(!document.hidden&&!checkingNow.current){setAccess(final);setResult(outcome);setPhase('complete');setRefreshKey(n=>n+1);}
    }catch(e){if(current()){if(e instanceof RequestError)fail(e);else setFileError(e instanceof Error?e.message:'파일 검사 불가입니다. 지원 PDF를 선택해 주세요.');}}
    finally{if(current())setBusy(false);}
  }
  function choose(f:File|undefined){setPreparing(false);setPhase('idle');generation.current++;selection.current++;verification.current?.abort();saved.current=null;setResult(null);setBusy(false);setFile(null);setFileError('');setInquiry(false);setCopyNotice('');if(!f)return;if(f.size>MAX_PDF_BYTES){setFileError('파일은 10 MiB 이하여야 합니다. 더 작은 지원 PDF를 선택해 주세요.');return;}setFile(f);}
  async function restore(){setFileMode(false);clear();setAccess(null);setChecking(true);checkingNow.current=true;if(!grantId)return;const seq=++generation.current;const c=new AbortController();verification.current=c;try{await bytes('/api/grants/'+grantId+'/file',c.signal);if(live.current&&!c.signal.aborted&&generation.current===seq)await recheck();}catch(e){if(live.current&&!c.signal.aborted&&generation.current===seq){fail(e);checkingNow.current=false;setChecking(false);}}}
  let payload:EvidencePayload|null=null;try{if(access){const p=parseCanonical(access.envelope.payloadCanonical);validatePayload(p);payload=p;}}catch{/* no unsupported payload displayed */}
  const step=fileMode||file?7:busy||result||saved.current?6:5;
  const stages=['access','record','cryptography','finalize'];
  const state=(id:string):TraceItem['state']=>{
    if(checking)return id==='access'?'running':'idle';
    if(!access)return id==='access'?'blocked':'idle';
    if(result){if(id==='record'&&!result.record)return 'blocked';if(id==='cryptography')return !result.signature||['COMPARISON_UNAVAILABLE','VERIFICATION_UNAVAILABLE'].includes(result.status)?'blocked':result.fingerprint?'confirmed':result.fileHash?'different':'blocked';return 'confirmed';}
    if(busy)return id===phase?'running':stages.indexOf(id)<stages.indexOf(phase)?'confirmed':'idle';
    if(fileError&&id===phase)return 'blocked';return id==='access'?'confirmed':'idle';
  };
  const shortHash=(h?:string)=>h?`${h.slice(0,12)}…${h.slice(-8)}`:'검사 후 계산';
  const trace:TraceItem[]=[
    {title:'서버 · 감사인 DID와 권한',detail:'지정 신원·만료·철회를 확인하고 원본을 직접 제공합니다.',state:state('access')},
    {title:'모의 체인 · 발행 기록 조회',detail:result?.record?`저장 지문 ${shortHash(result.record.fileHash)} · 기록 시각 확인`:'발행 때 저장한 PDF 지문과 기록 시각을 읽습니다. 새 거래를 만들지 않습니다.',state:state('record')},
    {title:'브라우저 · DID 서명과 지문 대조',detail:result?`선택 파일 ${shortHash(result.fileHash)} · ${result.fingerprint?'기록된 지문과 일치':result.status==='COMPARISON_UNAVAILABLE'?'지문은 계산했지만 내용을 충분히 읽을 수 없음':result.fileHash?'지문이 달라 실제 내용도 비교':'충분히 판독할 수 없음'}`:'KODA 공개키로 서명을 확인하고, 실제 PDF의 SHA-256을 기록과 비교합니다.',state:state('cryptography')},
    {title:'서버 · 권한 재확인과 검사 기록',detail:result?'현재 권한을 다시 확인한 뒤 검사 결과를 저장했습니다.':'검사 도중 철회되지 않았는지 확인하고 결과를 기록합니다.',state:state('finalize')},
  ];
  async function sample(kind:'original'|'modified'|'resaved'|'unreadable'){
    choose(undefined);if(!access||!payload||!grantId)return;
    const seq=++generation.current,c=new AbortController();verification.current=c;setPreparing(true);
    try{
      let data:Uint8Array;
      if(kind==='original')data=await bytes('/api/grants/'+grantId+'/file',c.signal);
      else if(kind==='unreadable')data=new TextEncoder().encode('%PDF-1.7\nunsupported-demo-file');
      else {const font=await bytes('/fonts/PretendardVariable.ttf',c.signal);const content=structuredClone(payload);if(kind==='modified'){content.assets[0]!.quantity='15.4500';content.assets[0]!.valuationAmount='2410088000';}data=createSupportedPdf(pdfEntries(content),font,access.envelope.salt,kind);}
      if(live.current&&!c.signal.aborted&&generation.current===seq)choose(new File([new Uint8Array(data)],`KODA-${kind}.pdf`,{type:'application/pdf'}));
    }catch(e){if(!c.signal.aborted&&generation.current===seq){if(e instanceof RequestError)fail(e);else setFileError('시연 파일을 준비하지 못했습니다. 다시 선택해 주세요.');}}
    finally{if(generation.current===seq)setPreparing(false);}
  }
  const outcome=(busy||result||file)&&<div className="pdf-result" data-status={result?.status??'NOT_RUN'} role="status"><strong>{busy?'서명·파일 지문·기록을 확인하고 있어요':result?.reason??'파일을 선택했습니다. 검사를 시작해 주세요.'}</strong>{result&&<p>실제 검사 {displayDate(result.checkedAt)} · 시연용 모의 기록</p>}</div>;
  const toolbar=<>{fileMode?<><h2>메일로 받은 파일은 같을까요?</h2><p>실제 PDF를 선택하거나 아래 시연 파일을 사용하세요.</p><div className="sample-files" aria-label="실제 시연 PDF 선택">{([['original','정상 원본'],['modified','내용 수정'],['resaved','재저장 사본'],['unreadable','비교 불가']] as const).map(([id,label])=><button className="sample-file" key={id} disabled={busy||preparing} onClick={()=>void sample(id)}>{label}</button>)}</div>{preparing&&<p role="status">실제 시연 PDF를 준비하고 있습니다…</p>}<label className="field-label" htmlFor="pdf-file">검사할 PDF 파일</label><input ref={fileInput} id="pdf-file" type="file" accept=".pdf,application/pdf" onChange={e=>choose(e.target.files?.[0])} aria-describedby="pdf-help"/>{file&&<p className="selected-file">선택됨 · {file.name}</p>}<p id="pdf-help" className="field-hint">지원 KODA PDF · 최대 10 MiB · 브라우저 안에서 검사</p><button className="button primary" disabled={!file||busy||preparing} onClick={()=>void verify(true)}>{busy?'파일 검사 중…':'선택 파일 검사'}</button><button className="text-button" onClick={()=>{choose(undefined);setFileMode(false);}}>원본 열람으로 돌아가기</button></>:<><button className="button primary" disabled={busy} onClick={()=>void verify()}>{busy?'검사 중…':'원본 검증하기'}</button><button className="text-button" onClick={()=>{choose(undefined);setFileMode(true);}}>사본 파일 검사로 이동 →</button></>}{outcome}{!fileMode&&!result&&!busy&&<p className="audit-status">원본 전체 열람 · 검증 전<br/>열람 만료 {access&&displayDate(access.grant.expiresAt)}</p>}{fileError&&<Notice kind="error" title="파일을 검사할 수 없습니다">{fileError}</Notice>}</>;
  const actions=<>
    {!fileMode&&<section className="four-checks" aria-label="원본의 네 확인 항목"><h2>네 가지를 확인해요</h2><ul><li>발행자 서명 <strong>{result?result.signature?'확인':'미확인':'검사 전'}</strong></li><li>PDF 파일 지문 <strong>{result?result.fingerprint?'일치':'미확인 / 불일치':'검사 전'}</strong></li><li>기록 시각 <strong>{result?result.record?'확인':'조회 불가':'검사 전'}</strong></li><li>열람 권한 <strong>{access?'유효':'확인 필요'}</strong></li></ul></section>}

    {file&&result&&<><button className="text-button" onClick={()=>void restore()}>원본 링크로 다시 받기</button><button className="text-button" onClick={()=>setInquiry(true)}>KODA에 확인 요청</button>{inquiry&&<div className="inquiry"><h3>문의 초안 · 실제 발송 없음</h3><p>{access?.envelope.evidenceId} · {file.name}<br />{result.reason}</p><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`KODA 확인 문의 초안\n문서: ${access?.envelope.evidenceId}\n파일: ${file.name}\n결과: ${result.reason}\n검사 시각: ${result.checkedAt}\n원본과 사본의 확인을 요청합니다.`);if(live.current)setCopyNotice('문의 내용을 복사했습니다. 실제 발송·접수는 하지 않았습니다.');}catch{if(live.current)setCopyNotice('복사하지 못했습니다. 클립보드 권한을 확인하고 다시 시도해 주세요.');}}}>문의 내용 복사</button><p role="status">{copyNotice}</p></div>}</>}
    <details className="document-disclosure"><summary>검사 범위·결과 저장</summary><p>스캔·임의 편집기 형식은 비교 불가입니다. 발행 파일과의 동일성 검사입니다. 실제 자산·최초 입력값·감사의견을 증명하지 않습니다.</p><button className="button secondary" disabled>검증 결과 저장 · 시연에서 저장 미지원</button></details></>;
  return <div className="page detail-page">
    {checking?<DemoWorkspace step={step} trace={trace} insight="DID로 사람과 발행자를 확인하고, 블록체인 역할의 모의 원장에서 발행 당시 지문을 찾아 대조합니다." document={<p className="loading-state" role="status">신원과 열람 권한을 확인하고 있습니다…</p>} actions={<p>확인 중에는 문서와 과거 결과를 숨깁니다.</p>} records={<p>권한 확인 중</p>}/>:error?<DemoWorkspace step={step} trace={trace} insight="DID로 사람과 발행자를 확인하고, 블록체인 역할의 모의 원장에서 발행 당시 지문을 찾아 대조합니다." document={<Notice kind="error" title="접근 차단 · 문서를 표시할 수 없습니다">{error}</Notice>} actions={<button className="button primary" onClick={()=>void recheck()}>권한 다시 확인</button>} records={<p>재무담당자에게 유효한 권한을 요청해 주세요.</p>}/>:access&&payload?<DemoWorkspace step={step} trace={trace} insight="DID로 사람과 발행자를 확인하고, 블록체인 역할의 모의 원장에서 발행 당시 지문을 찾아 대조합니다." document={<><Certificate payload={payload} envelope={access.envelope} differences={result?.differences}/>{result&&result.differences.length>0&&<details className="document-differences document-disclosure"><summary>선택 사본과 실제 원본의 차이 {result.differences.length}건</summary><table className="document-table"><thead><tr><th>항목</th><th>원본</th><th>선택 사본</th></tr></thead><tbody>{result.differences.map(d=><tr key={d.field}><th>{d.label}</th><td data-label="원본">{decimal(d.before)}</td><td data-label="선택 사본" className="changed-value">{decimal(d.after)}</td></tr>)}</tbody></table></details>}</>} toolbar={toolbar} actions={actions} records={<ActivityLog path={'/grants/'+access.grant.id+'/events'} refreshKey={refreshKey} onUnauthorized={onUnauthorized} onAccessDenied={accessLost}/>}/>:null}</div>;
}
defineControls(PdfAuditPage,{path:false,token:false,session:false,navigate:false,consumed:false,onUnauthorized:false});
