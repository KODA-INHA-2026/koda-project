import { useDemoHandoff } from '../demo-handoff';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import { parseCanonical, validatePayload, type IssuedSourceDTO, type SessionDTO, type SnapshotDTO } from '@koda/protocol';
import { Certificate } from '../components/Certificate';
import { DemoWorkspace, ActivityLog } from '../components/DemoWorkspace';
import { api, RequestError } from '../api/client';
import { Notice } from '../components/Notice';
import { displayDate } from '../components/VerificationPanel';
const states={PREPARED:'문서·서명 저장 완료',PENDING:'모의 기록 저장 중',CONFIRMED:'발행 완료',FAILED:'기록 실패',UNAVAILABLE:'기록 확인 불가'};
export function IssuerPage({session,onUnauthorized}:{session:SessionDTO;onUnauthorized:()=>void}){
  const handoff=useDemoHandoff();
  const [list,setList]=useState<SnapshotDTO[]|null>(null),[selected,setSelected]=useState(''),[source,setSource]=useState<IssuedSourceDTO|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const controller=useRef(new AbortController()),keys=useRef(new Map<string,string>());const sourceId=useRef('');
  const fail=useCallback((e:unknown)=>{if(controller.current.signal.aborted)return;if(e instanceof RequestError&&e.status===401)onUnauthorized();else setError(e instanceof Error?e.message:'발행 요청을 완료하지 못했습니다.');},[onUnauthorized]);
  const load=useCallback(async()=>{try{const l=await api<SnapshotDTO[]>('/issuer/snapshots',{signal:controller.current.signal});if(!controller.current.signal.aborted){setList(l);setSelected(old=>old||l.find(s=>s.payload.schemaVersion==='custody-demo/3')?.snapshotId||l[0]?.snapshotId||'');}}catch(e){fail(e);}},[fail]);
  useEffect(()=>{void load();return()=>controller.current.abort();},[load]);
  const active=list?.find(s=>s.snapshotId===selected);const job=active?.job;const path=active?'/issuer/evidence/'+active.payload.evidenceId+'/versions/'+active.payload.version:'';
  useEffect(()=>{if(!list?.some(s=>s.job&&['PREPARED','PENDING'].includes(s.job.status)))return;const timer=setInterval(()=>void load(),1200);return()=>clearInterval(timer);},[list,load]);
  useEffect(()=>{setSource(null);sourceId.current=selected;if(job?.status!=='CONFIRMED')return;const c=new AbortController();api<IssuedSourceDTO>(path+'/source',{signal:c.signal}).then(v=>{if(!c.signal.aborted&&sourceId.current===selected)setSource(v);}).catch(e=>{if(!c.signal.aborted)fail(e);});return()=>c.abort();},[selected,job?.status,path,fail]);
  async function issue(retry=false){if(!active||busy)return;setBusy(true);setError('');if(!keys.current.has(selected))keys.current.set(selected,crypto.randomUUID());try{await api(retry?path+'/retry':'/issuer/evidence',{method:'POST',headers:{'x-csrf-token':session.csrf},...(retry?{}:{body:JSON.stringify({snapshotId:selected,idempotencyKey:keys.current.get(selected)})}),signal:controller.current.signal});await load();}catch(e){fail(e);}finally{if(!controller.current.signal.aborted)setBusy(false);}}
  let payload=active?.payload;if(source){try{const p=parseCanonical(source.envelope.payloadCanonical);validatePayload(p);payload=p;}catch{payload=undefined;}}
  return <div className="page detail-page">
    <DemoWorkspace step={2} insight="발행 버튼 한 번으로 PDF를 고정하고 서명합니다. 원문은 비공개로 보관하고, 최종 파일의 지문만 모의 체인에 기록합니다."
      trace={[
        {title:'원본 PDF 생성 · DID 서명',detail:'기준일·수량을 담은 PDF와 발행자 서명을 저장합니다.',state:job?'confirmed':busy?'running':'idle'},
        {title:'파일 지문 계산',detail:'최종 PDF 바이트의 SHA-256을 계산합니다. 내용이 바뀌면 지문도 달라집니다.',state:job?'confirmed':'idle'},
        {title:'모의 체인에 기록',detail:job?.status==='CONFIRMED'?'파일 지문과 기록 시각의 저장을 확인했습니다.':job?states[job.status]:'RPC 없이 격리된 모의 기록 저장소를 사용합니다.',state:job?.status==='CONFIRMED'?'confirmed':job?.status==='FAILED'||job?.status==='UNAVAILABLE'?'blocked':job?'running':'idle'},
      ]}
      technical={job&&<p>실제 발행 요청 {displayDate(job.createdAt)}<br/>처리 확인 {displayDate(job.updatedAt)}<br/>시나리오 발행일 2026.10.01과 구별됩니다.</p>}
      toolbar={!active?null:!job?<button key="issue" className="button primary" disabled={busy||!active} onClick={()=>void issue()}>{busy?'PDF 생성·서명 중…':'원본 PDF 발행하기'}</button>:job.status==='CONFIRMED'?<><button key="continue" className="button primary" onClick={()=>void handoff({principalId:'finance-a',path:'/evidence/'+active!.payload.evidenceId+'/versions/'+active!.payload.version})}>재무담당자에게 이어가기 →</button><a className="button secondary" href={'/api'+path+'/file'} download>발행 원본 PDF 내려받기</a></>:<button className="button primary" disabled={busy} onClick={()=>void issue(true)}>{busy?'처리 확인 중…':'같은 원본으로 기록 다시 시도'}</button>}
      document={<>{list&&list.length>1&&<><label className="field-label" htmlFor="issue-document">발행 문서 선택</label><select id="issue-document" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>{list.map(s=><option key={s.snapshotId} value={s.snapshotId}>{s.payload.customerDisplayName} · v{s.payload.version}</option>)}</select></>}{payload?<Certificate payload={payload} envelope={source?.envelope} candidate={!job}/>:<p role="status">발행 후보를 불러오는 중…</p>}</>}
      actions={<><h2>{job?.status==='CONFIRMED'?'원본이 발행되었습니다':'이 내용으로 원본을 발행할까요?'}</h2>{job?.status==='CONFIRMED'&&<p>이제 재무담당자가 같은 증명서를 일부 가림으로 확인합니다.</p>}
        {error&&<Notice kind="error" title="발행을 완료하지 못했습니다">{error}<button className="text-button" onClick={()=>void load()}>발행 상태 다시 확인</button></Notice>}

      </>} records={job?<ActivityLog path={path+'/events'} refreshKey={job.status==='CONFIRMED'?1:0} onUnauthorized={onUnauthorized}/>:<p>발행 전입니다. 완료한 행동이 여기에 기록됩니다.</p>}/>
  </div>;
}
defineControls(IssuerPage,{session:false,onUnauthorized:false});
