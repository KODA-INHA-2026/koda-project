import { useDemoHandoff } from '../demo-handoff';
import { useEffect, useRef, useState } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import type { FinanceSummaryDTO, InternalGrantDTO, SessionDTO } from '@koda/protocol';
import { api, RequestError } from '../api/client';
import { DemoWorkspace, ActivityLog } from './DemoWorkspace';
import { Certificate } from './Certificate';
import { displayDate } from './VerificationPanel';

export function FinanceHandoff({ openedRevision=0, evidence,session,onUnauthorized }: { openedRevision?:number;evidence:FinanceSummaryDTO;session:SessionDTO;onUnauthorized:()=>void }) {
  const handoff=useDemoHandoff();
  const [created,setCreated]=useState(false);
  const [people,setPeople]=useState<{did:string;name:string}[]>([]),[recipient,setRecipient]=useState('');
  const [grants,setGrants]=useState<InternalGrantDTO[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [operation,setOperation]=useState<'create'|'revoke'>('create');
  const [editing,setEditing]=useState(false),[revision,setRevision]=useState(0),[duration,setDuration]=useState(24),[confirm,setConfirm]=useState<string|null>(null);
  const request=useRef<{recipientDid:string;expiresAt:string;idempotencyKey:string}|null>(null);
  const controller=useRef(new AbortController());
  const path=`/finance/evidence/${evidence.evidenceId}/versions/${evidence.version}/internal-grants`;
  function fail(e:unknown){if(controller.current.signal.aborted)return;if(e instanceof RequestError&&e.status===401)onUnauthorized();else setError(e instanceof Error?e.message:'인계 상태를 확인하지 못했습니다. 다시 시도해 주세요.');}
  async function refresh(){try{const g=await api<InternalGrantDTO[]>(path,{signal:controller.current.signal});if(!controller.current.signal.aborted)setGrants(g);}catch(e){fail(e);}}
  useEffect(()=>{const c=controller.current;api<{did:string;name:string}[]>('/finance/accountants',{signal:c.signal}).then(p=>{if(!c.signal.aborted){setPeople(p);setRecipient(p[0]?.did??'');}}).catch(fail);void refresh();return()=>c.abort();},[path]);
  async function create(e:React.FormEvent){e.preventDefault();if(busy||!recipient)return;setOperation('create');setBusy(true);setError('');setMessage('');request.current??={recipientDid:recipient,expiresAt:new Date(Date.now()+duration*3600000).toISOString(),idempotencyKey:crypto.randomUUID()};
    try{await api<InternalGrantDTO>(path,{method:'POST',headers:{'x-csrf-token':session.csrf},body:JSON.stringify(request.current),signal:controller.current.signal});if(!controller.current.signal.aborted){setCreated(true);setMessage('회계 열람 권한을 만들었습니다. 지정 회계담당자가 인증하면 받은 증빙에서 확인할 수 있습니다.');setEditing(false);request.current=null;setRevision(n=>n+1);await refresh();}}catch(e){fail(e);}finally{if(!controller.current.signal.aborted)setBusy(false);}}
  async function revoke(id:string){if(busy)return;setOperation('revoke');setBusy(true);setError('');try{await api('/internal-grants/'+id+'/revoke',{method:'POST',headers:{'x-csrf-token':session.csrf},signal:controller.current.signal});if(!controller.current.signal.aborted){setConfirm(null);setRevision(n=>n+1);setMessage('인계 권한을 철회했습니다. 연결된 감사 권한의 이후 접근도 차단됩니다.');await refresh();}}catch(e){fail(e);}finally{if(!controller.current.signal.aborted)setBusy(false);}}
  return <DemoWorkspace step={3} role="FINANCE" insight="재무는 잔고를 확인하고, 같은 회사의 회계담당자에게 결산용 열람 권한을 줍니다."
    trace={[{title:'DID → 회사·재무 권한 확인',detail:'인증된 회사의 증빙만 제공합니다.',state:'confirmed'},
      {title:'서버 → 민감 정보 제외',detail:'잔고·평가액·거래 건수만. 거래 원문은 보내지 않습니다.',state:'confirmed'},
      {title:operation==='revoke'?'서버 · 인계 철회':'서버 · 회계 권한 생성',detail:operation==='revoke'?'이후 회계 열람과 연결된 감사 접근을 차단합니다. 체인 거래는 없습니다.':'지정 DID·같은 회사·문서 버전·만료를 확인합니다. 체인 거래는 없습니다.',state:busy?'running':error?'blocked':message?'confirmed':'idle'}]}
    document={<Certificate masked={evidence}/>}
    toolbar={created?<button className="button primary" onClick={()=>void handoff({principalId:'accounting-a',path:'/evidence/'+evidence.evidenceId+'/versions/'+evidence.version})}>회계담당자에게 이어가기 →</button>:!editing?<button className="button primary" onClick={()=>{setOperation('create');setEditing(true);setError('');setMessage('');}} disabled={!evidence.canHandoff}>회계담당자에게 인계하기</button>:null}
    actions={<div className="internal-actions">
      {editing&&<form onSubmit={create} className="handoff-form"><h2>결산용 열람 권한 인계</h2><label className="field-label" htmlFor="accountant">같은 회사의 회계담당자</label><select id="accountant" value={recipient} disabled={busy||Boolean(request.current)} onChange={e=>setRecipient(e.target.value)}>{people.map(p=><option key={p.did} value={p.did}>{p.name}</option>)}</select>
        <p>거래 일시·자산·수량을 추가로 봅니다. 전체 주소·상대방·Tx 해시는 제공하지 않습니다.</p>
        <label className="field-label" htmlFor="internal-duration">열람 기간</label><select id="internal-duration" value={duration} disabled={busy||Boolean(request.current)} onChange={e=>setDuration(Number(e.target.value))}><option value={1}>1시간</option><option value={24}>24시간</option><option value={168}>7일</option></select>
        <details><summary>수신자 DID 확인</summary><p className="technical-value">{recipient}</p></details><p>원본 파일을 보내지 않습니다. 권한 생성과 실제 열람은 별도로 기록합니다.</p>
        <div className="button-row"><button className="button secondary" type="button" disabled={busy} onClick={()=>{setEditing(false);request.current=null;}}>닫기</button><button className="button primary" disabled={busy||!recipient}>{busy?'권한 확인 중…':'회계 열람 권한 생성'}</button></div></form>}
      {error&&<p role="alert">{error}</p>}{message&&<p className="handoff-result" role="status">{message}</p>}
      <button className="button secondary" disabled>원본 내려받기 없음</button>
      <details className="handoff-history"><summary>인계 현황 · {grants.length}건</summary><button className="text-button" onClick={()=>void refresh()}>인계 현황 새로고침</button>
        {grants.length===0?<p>아직 인계한 권한이 없습니다.</p>:grants.map(g=><div className="internal-grant" key={g.id}><strong>{g.recipientName} · {g.status==='ACTIVE'?'유효':g.status==='EXPIRED'?'만료':'철회됨'}</strong><p>{g.firstOpenedAt?'회계 열람 확인 · '+displayDate(g.firstOpenedAt):'권한 생성 · 회계 열람 대기'}</p><p>만료 {displayDate(g.expiresAt)}</p>{g.status==='ACTIVE'&&(confirm===g.id?<div><p>이후 회계 열람과 연결된 감사인 접근을 차단합니다. 이미 본 내용은 회수되지 않습니다.</p><button className="button danger" disabled={busy} onClick={()=>void revoke(g.id)}>인계 철회 확정</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(null)}>취소</button></div>:<button className="text-button" onClick={()=>setConfirm(g.id)}>인계 철회</button>)}</div>)}
      </details>
    </div>}
    records={<ActivityLog path={'/finance/events?evidenceId='+evidence.evidenceId+'&version='+evidence.version} refreshKey={revision+openedRevision} onUnauthorized={onUnauthorized}/>}/>;
}
defineControls(FinanceHandoff,{openedRevision:false,evidence:false,session:false,onUnauthorized:false});
