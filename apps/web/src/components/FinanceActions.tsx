import { useDemoHandoff } from '../demo-handoff';
import { DemoWorkspace, ActivityLog } from './DemoWorkspace';
import { defineControls } from 'tempo-sdk/assets';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { AccountingSummaryDTO, FinanceSummaryDTO, GrantDTO, GrantCreatedDTO, SessionDTO } from '@koda/protocol';
import { api, RequestError } from '../api/client';
import { Modal } from './Modal';
import { Notice } from './Notice';
import { displayDate } from './VerificationPanel';
interface Auditor { did: string; name: string; organizationName: string }
const statusLabel = { ACTIVE: '활성', EXPIRED: '만료됨', REVOKED: '철회됨' };
const eventLabel: Record<string, string> = { GRANT_CREATED: '공유 생성', OPENED: '허용된 열람', VERIFIED: '검증 수행', GRANT_REVOKED: '공유 철회', ACCESS_DENIED: '접근 거부' };
export function FinanceActions({ openedRevision=0, evidence, session, onUnauthorized, children }: { openedRevision?:number; children?: ReactNode; evidence: FinanceSummaryDTO; session: SessionDTO; onUnauthorized: () => void }) {
  const [phase,setPhase]=useState('idle');
  const shareButton=useRef<HTMLButtonElement>(null);
  const [error, setError] = useState(''); const [sharing, setSharing] = useState(false); const [management, setManagement] = useState(false);
  const [grants, setGrants] = useState<GrantDTO[]>([]); const [revision,setRevision]=useState(0); const [loading, setLoading] = useState(false);
  const [revoke, setRevoke] = useState<GrantDTO | null>(null); const [revoking, setRevoking] = useState(false);
  const controller = useRef(new AbortController());
  useEffect(() => () => controller.current.abort(), []);
  const headers = { 'x-csrf-token': session.csrf };
  const prefix=session.principal.role==='ACCOUNTING'?'/accounting':'/finance';
  const documentPath = '/evidence/' + evidence.evidenceId + '/versions/' + evidence.version;
  function fail(e: unknown) { if (controller.current.signal.aborted) return; if (e instanceof RequestError && e.status === 401) onUnauthorized(); else setError(e instanceof Error ? e.message : '요청을 처리하지 못했습니다. 다시 시도해 주세요.'); }
  async function loadManagement() {
    setManagement(true); setLoading(true); setError('');
    const query = '?evidenceId=' + evidence.evidenceId + '&version=' + evidence.version;
    try { const g = await api<GrantDTO[]>(prefix+'/grants' + query, { signal: controller.current.signal }); if (!controller.current.signal.aborted) { setGrants(g); setRevision(n=>n+1); } }
    catch (e) { fail(e); } finally { if (!controller.current.signal.aborted) setLoading(false); }
  }
  async function confirmRevoke() {
    if (!revoke || revoking) return; setRevoking(true); setError('');
    try { await api('/grants/' + revoke.id + '/revoke', { method: 'POST', headers, signal: controller.current.signal }); if (!controller.current.signal.aborted) { setRevoke(null); await loadManagement(); } }
    catch (e) { fail(e); } finally { if (!controller.current.signal.aborted) setRevoking(false); }
  }
  return <>
    <DemoWorkspace step={sharing?4:3} role={session.principal.role}
      insight={sharing?'전달하는 것은 파일이 아니라, 지정 신원에 묶인 열람 권한입니다. 링크 복사와 실제 열람은 별도로 기록합니다.':session.principal.role==='ACCOUNTING'?'회계 권한을 확인한 뒤, 결산에 필요한 항목만 전달합니다.':'서버가 공개 가능한 정보만 골라 보냅니다. 브라우저에는 가려진 원문이나 개별 거래가 도착하지 않습니다.'}
      trace={sharing?[
        {title:'문서·수신자·기간 확인',detail:'현재 담당자의 회사·문서·전달 권한을 서버에서 확인합니다.',state:phase==='checking'?'running':phase==='created'||phase==='copied'?'confirmed':phase==='error'?'blocked':'idle'},
        {title:'지정 DID에 권한 생성',detail:'문서 버전과 만료 시각을 묶어 서버에 저장합니다.',state:phase==='created'||phase==='copied'?'confirmed':phase==='checking'?'running':'idle'},
        {title:'열람 링크 복사',detail:phase==='copied'?'링크 복사 확인. 감사인의 실제 인증과 열람은 아직 별도입니다.':'감사인은 자신의 키로 인증한 뒤 KODA에서 원본을 직접 받습니다.',state:phase==='copied'?'confirmed':'idle'},
      ]:[
        {title:'회사·역할 확인',detail:'현재 세션에 허용된 회사의 문서만 조회했습니다.',state:'confirmed'},
        {title:'서버에서 일부 가림',detail:session.principal.role==='ACCOUNTING'?'거래 일시·자산·수량만 추가 공개합니다. 상대방과 거래 추적 정보는 숨깁니다.':'주소 앞뒤 4자리·상대방 가림·거래 건수만 제공합니다.',state:'confirmed'},
        {title:'허용된 열람본 전달',detail:'원본 PDF와 숨긴 상세는 내부 담당자에게 제공하지 않습니다.',state:'confirmed'},
      ]}
      document={children}
      toolbar={sharing?null:<button ref={shareButton} className="button primary" disabled={!evidence.canShare} onClick={()=>{setPhase('idle');setSharing(true);window.scrollTo(0,0);}}>감사인에게 권한 보내기</button>}
      actions={sharing?<ShareDialog evidence={evidence} session={session} onPhaseChange={setPhase} close={()=>{setSharing(false);void loadManagement();requestAnimationFrame(()=>shareButton.current?.focus());}} onUnauthorized={onUnauthorized}/>:<><div className="finance-secondary"><button className="button secondary" disabled>원본 내려받기 없음</button><button className="text-button" onClick={()=>void loadManagement()}>보낸 권한 확인 · 철회</button></div>{error&&<Notice kind="error" title="작업을 완료하지 못했습니다">{error}</Notice>}</>}
      records={<ActivityLog path={prefix+'/events?evidenceId='+evidence.evidenceId+'&version='+evidence.version} refreshKey={revision+openedRevision+Number(sharing)} onUnauthorized={onUnauthorized}/>}/>
    {management && <section className="management-section" aria-label="이 문서의 공유 현황"><div className="section-action"><h2>이 문서의 공유 현황</h2><button className="text-button" onClick={() => void loadManagement()}>현황 새로고침</button></div><p className="document-reference">{evidence.evidenceId} · 버전 {evidence.version}</p>{loading ? <p role="status">공유 현황을 확인하고 있어요…</p> : <>{grants.length === 0 && <p>아직 만든 공유가 없습니다.</p>}<ul className="grant-list">{grants.map(g => <li key={g.id} data-grant-id={g.id}><div><strong>{g.auditorOrganizationName} · {g.auditorName}</strong><p>{g.firstOpenedAt ? "열람 확인 · " + displayDate(g.firstOpenedAt) : "권한 생성 · 수신 대기"}</p><p>생성 {displayDate(g.createdAt)}<br />만료 {displayDate(g.expiresAt)}</p></div><span>{statusLabel[g.status]}</span>{g.status === 'ACTIVE' && <button className="button secondary" onClick={() => setRevoke(g)}>철회</button>}</li>)}</ul></>}</section>}
    {revoke && <Modal title="이 공유를 철회할까요?" close={() => setRevoke(null)} busy={revoking}><p>{revoke.auditorName} · {revoke.evidenceId} · 버전 {revoke.version}</p><p className="action-warning">이 공유를 통한 이후 접근을 차단합니다. 이미 열람하거나 복사한 내용은 회수되지 않습니다.</p>{error && <Notice kind="error" title="철회 결과를 확인하지 못했습니다">{error} 현황 새로고침으로 결과를 확인할 수 있습니다.</Notice>}<div className="button-row"><button className="button secondary" disabled={revoking} onClick={() => setRevoke(null)}>돌아가기</button><button className="button danger" disabled={revoking} onClick={() => void confirmRevoke()}>{revoking ? '철회 중…' : '공유 철회'}</button></div></Modal>}
  </>;
}
function ShareDialog({ evidence, session, close, onUnauthorized, onPhaseChange }: { onPhaseChange:(phase:string)=>void; evidence: FinanceSummaryDTO; session: SessionDTO; close: () => void; onUnauthorized: () => void }) {
  const handoff=useDemoHandoff();
  const [auditors, setAuditors] = useState<Auditor[] | null>(null); const [did, setDid] = useState('');
  const internalExpiry=(evidence as Partial<AccountingSummaryDTO>).internalGrant?.expiresAt;
  const deadline=(hours:number)=>new Date(Math.min(Date.now()+hours*3600000,internalExpiry?Date.parse(internalExpiry):Infinity)).toISOString();
  const [expiresAt, setExpiresAt] = useState(() => deadline(24));
  const [created, setCreated] = useState<GrantCreatedDTO | null>(null); const [copyState, setCopyState] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const request = useRef<{ auditorDid: string; expiresAt: string; idempotencyKey: string } | null>(null);
  const controller = useRef(new AbortController());
  useEffect(() => { const abort = controller.current; api<Auditor[]>((session.principal.role==='ACCOUNTING'?'/accounting':'/finance')+'/auditors', { signal: abort.signal }).then(a => { if (!abort.signal.aborted) { setAuditors(a); setDid(a[0]?.did ?? ''); } }).catch(e => { if (!abort.signal.aborted) setError(e.message); }); return () => abort.abort(); }, [attempt]);
  useEffect(()=>{onPhaseChange(busy?'checking':created?(copyState.startsWith('링크를 복사')?'copied':'created'):error?'error':'idle');},[busy,created,copyState,error,onPhaseChange]);
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)close();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[close,busy]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (!did || busy || created) return; setBusy(true); setError('');
    request.current ??= { auditorDid: did, expiresAt, idempotencyKey: crypto.randomUUID() };
    try { const value = await api<GrantCreatedDTO>('/evidence/' + evidence.evidenceId + '/versions/' + evidence.version + '/grants', { method: 'POST', headers: { 'x-csrf-token': session.csrf }, body: JSON.stringify(request.current), signal: controller.current.signal }); if (!controller.current.signal.aborted) setCreated(value); }
    catch (e) { if (controller.current.signal.aborted) return; if (e instanceof RequestError && e.status === 401) onUnauthorized(); else setError(e instanceof Error ? e.message : '공유를 만들지 못했습니다.'); }
    finally { if (!controller.current.signal.aborted) setBusy(false); }
  }
  async function copy() {
    if (!created?.token) return;
    try { await navigator.clipboard.writeText(window.location.origin + '/share#token=' + created.token); setCopyState('링크를 복사했습니다. 메일 등으로 지정 감사인에게 직접 전달해 주세요. 수신·발송 완료는 아닙니다.'); }
    catch { setCopyState('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하고 링크 복사를 다시 눌러 주세요. 공유는 이미 생성되어 있습니다.'); }
  }
  return <section className="share-form" aria-label="감사인에게 권한 전달"><h2>{created?'권한 생성 · 수신 대기':'열람 권한 설정'}</h2>
    {created?.token&&<button className="button primary handoff-next" onClick={()=>void handoff({principalId:'auditor-b',path:'/share',token:created.token!})}>지정 감사인에게 이어가기 →</button>}
    <form onSubmit={create}>
      <label className="field-label" htmlFor="recipient">지정 감사인</label><select id="recipient" value={did} disabled={busy || Boolean(created) || Boolean(request.current)} onChange={e => setDid(e.target.value)}>{auditors?.map(a => <option key={a.did} value={a.did}>{a.name} · {a.organizationName}</option>)}</select>
      <p className="share-scope"><strong>외부감사 제출용 · 전체 항목</strong><br/>권한 생성 즉시 시작</p>
      <p className="share-deadline">만료 · {new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(new Date(created?.grant.expiresAt??expiresAt))} KST</p>
      {!created && <><label className="field-label" htmlFor="duration">열람 기간</label><select id="duration" defaultValue="24" disabled={busy || Boolean(request.current)} onChange={e => setExpiresAt(deadline(Number(e.target.value)))}><option value="1">최대 1시간</option><option value="24">최대 24시간</option><option value="168">최대 7일</option></select>{internalExpiry&&<p>내부 인계 만료 시 함께 종료됩니다.</p>}</>}
      {!auditors && !error && <p role="status">등록 감사인을 확인하고 있어요…</p>}{auditors?.length === 0 && <p>등록된 감사인이 없습니다. 공유를 만들 수 없습니다.</p>}
      {error && <Notice kind="error" title="공유를 완료하지 못했습니다">{error}{!auditors && <button type="button" className="text-button" onClick={() => { controller.current = new AbortController(); setError(''); setAttempt(n => n+1); }}>감사인 다시 불러오기</button>}{request.current && <p>같은 요청으로 다시 확인합니다. 조건을 바꾸려면 닫은 뒤 공유 현황을 먼저 확인해 주세요.</p>}</Notice>}
      {created?.replayed && <Notice title="이미 처리한 공유입니다">첫 응답 이후 링크 원문은 다시 제공하지 않습니다. 공유 현황에서 확인하고 필요하면 철회한 뒤 새로 만들어 주세요.</Notice>}
      {copyState && <p className="copy-feedback" role="status">{copyState}</p>}
      <p className="transfer-notice">원본은 KODA 서버에서 직접 제공합니다.</p><div className="button-row">{!created ? <button className="button primary" type="submit" disabled={!did || busy}>{busy ? '정책 확인·권한 생성 중…' : '권한 생성'}</button> : created.token && <button type="button" className="button primary" onClick={() => void copy()}>링크 복사</button>}<button type="button" className="button secondary" onClick={close} disabled={busy}>{created ? '공유 확인 닫기' : '취소'}</button></div>
      <details className="document-disclosure"><summary>수신자 DID 확인</summary><p className="technical-value">{did}</p></details><p className="action-warning">지정 감사인의 DID로 인증해야 열립니다.</p>
    </form>
  </section>;
}

defineControls(FinanceActions, { openedRevision: false, evidence: false, session: false, onUnauthorized: false, children: false });
