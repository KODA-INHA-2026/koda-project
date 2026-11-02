import { FinanceHandoff } from '../components/FinanceHandoff';
import { useEffect, useRef, useState } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import type { AccountingSummaryDTO, FinanceSummaryDTO, PrincipalDTO, SessionDTO } from '@koda/protocol';
import { DemoFlow } from '../components/DemoWorkspace';
import { Certificate } from '../components/Certificate';
import { FinanceActions } from '../components/FinanceActions';
import { api, RequestError } from '../api/client';
import { Icon } from '../components/Icon';
import { Notice } from '../components/Notice';

const date = (value: string, time = false) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {}), timeZone: 'Asia/Seoul' }).format(new Date(value));
function quantity(value: string) { const [whole = '', fraction] = value.split('.'); return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : ''); }
function useEvidence<T>(path: string, onUnauthorized: () => void, refreshAccess=false) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let pending:AbortController|null=null;let closed=false;
    const load=async()=>{pending?.abort();const c=new AbortController();pending=c;
      try{const result=await api<T>(path,{signal:c.signal});if(!closed&&!c.signal.aborted){setData(result);setError('');}}
      catch(e){if(closed||c.signal.aborted)return;setData(null);if(e instanceof RequestError&&e.status===401)onUnauthorized();else setError(e instanceof Error?e.message:'열람 권한을 확인하지 못했습니다.');}};
    setData(null);setError('');void load();
    const focus=()=>{if(refreshAccess)void load();};const visible=()=>{if(!document.hidden)focus();};
    const hide=()=>{pending?.abort();setData(null);};
    window.addEventListener('focus',focus);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',focus);document.addEventListener('visibilitychange',visible);
    const timer=refreshAccess?setInterval(()=>{if(!document.hidden)void load();},15000):undefined;
    return()=>{closed=true;pending?.abort();clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',focus);document.removeEventListener('visibilitychange',visible);};
  },[path,retry,onUnauthorized,refreshAccess]);
  return{data,error,reload:()=>setRetry(n=>n+1)};
}
function LoadingOrError({ error, reload }: { error: string; reload: () => void }) {
  return error ? <Notice kind="error" title="증빙을 불러오지 못했습니다">{error}<button className="text-button" onClick={reload}>증빙 다시 불러오기</button></Notice> : <div className="loading-state" role="status"><span className="spinner" />권한과 증빙을 확인하고 있습니다…</div>;
}
export function EvidenceList({ principal, navigate, onUnauthorized }: { principal: PrincipalDTO; navigate: (path: string) => void; onUnauthorized: () => void }) {
  const { data, error, reload } = useEvidence<FinanceSummaryDTO[]>((principal.role==='ACCOUNTING'?'/accounting':'/finance')+'/evidence', onUnauthorized, principal.role==='ACCOUNTING');
  const [search, setSearch] = useState('');
  const items = data?.filter(e => (e.evidenceId + e.asOfAt + date(e.asOfAt)).toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="page">
    <DemoFlow step={3} role={principal.role}/>
    <section className="evidence-panel" aria-labelledby="list-title">
      <div className="table-toolbar"><h2 id="list-title">증빙 목록</h2><div className="search-field" hidden={Boolean(data && data.length<2)}><Icon name="search" /><input aria-label="문서 번호 또는 기준일 검색" placeholder="문서 번호 또는 기준일 검색" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      {!data ? <LoadingOrError error={error} reload={reload} /> : items.length === 0 ? <div className="empty-state"><h3>{search ? '검색 결과가 없습니다' : '조회할 증빙이 없습니다'}</h3><p>{search ? '문서 번호나 기준일을 다시 확인해 주세요.' : '아직 열람할 증빙이 없습니다. 회계담당자는 재무담당자의 인계를 받은 뒤 조회할 수 있습니다.'}</p>{search && <button className="text-button" onClick={() => setSearch('')}>검색 초기화</button>}</div> : <div className="table-scroll"><table className="evidence-table"><thead><tr><th scope="col">문서</th><th scope="col">기준일 · KST</th><th scope="col">자산</th><th scope="col">열람 범위</th><th scope="col"><span className="sr-only">상세 보기</span></th></tr></thead><tbody>{items.map(e => <tr key={e.evidenceId + e.version}>
        <td><div className="document-cell"><a href={'/evidence/' + e.evidenceId + '/versions/' + e.version} onClick={event => { event.preventDefault(); navigate(event.currentTarget.pathname); }}>{e.customerDisplayName} 잔고 증명서</a><span>{e.evidenceId} · 버전 {e.version}</span></div></td>
        <td data-label="기준일 · KST">{date(e.asOfAt)}</td><td data-label="자산">{e.assets.map(a => a.code).join(' · ')}</td><td data-label="열람 범위"><span className="verification-state">일부 가림</span></td>
        <td><a className="detail-link" href={'/evidence/' + e.evidenceId + '/versions/' + e.version} aria-label={`${e.evidenceId} 상세 보기`} onClick={event => { event.preventDefault(); navigate(event.currentTarget.pathname); }}>상세 보기 <Icon name="arrow" /></a></td>
      </tr>)}</tbody></table></div>}
    </section>
    <details className="implementation-note"><summary>열람 범위</summary><p>상세 주소·거래 참조·증빙 원문은 이 역할에 제공되지 않습니다.</p></details>
  </div>;
}
defineControls(EvidenceList, { principal: false, navigate: false, onUnauthorized: false });

export function EvidenceDetail({ path, navigate, onUnauthorized, session }: { path: string; navigate: (path: string) => void; onUnauthorized: () => void; session: SessionDTO }) {
  const prefix=session.principal.role==='ACCOUNTING'?'/accounting':'/finance';
  const { data: e, error, reload } = useEvidence<FinanceSummaryDTO|AccountingSummaryDTO>(prefix + path, onUnauthorized, session.principal.role==='ACCOUNTING');
  const viewId=useRef(crypto.randomUUID());
  const [openedRevision,setOpenedRevision]=useState(0);
  useEffect(()=>{if(!e)return;const c=new AbortController();void api(prefix+path+'/open',{method:'POST',headers:{'x-csrf-token':session.csrf},body:JSON.stringify({viewId:viewId.current}),signal:c.signal}).then(()=>{if(!c.signal.aborted)setOpenedRevision(n=>n+1);}).catch(err=>{if(!c.signal.aborted&&err instanceof RequestError&&err.status===401)onUnauthorized();});return()=>c.abort();},[e?.evidenceId,e?.version,path,prefix,session.csrf,onUnauthorized]);
  return <div className="page detail-page">
    {!e ? <LoadingOrError error={error} reload={reload} /> : <>
      {e.canHandoff?<FinanceHandoff openedRevision={openedRevision} evidence={e} session={session} onUnauthorized={onUnauthorized}/>:<FinanceActions openedRevision={openedRevision} evidence={e} session={session} onUnauthorized={onUnauthorized}><Certificate masked={e} journal={'journal' in e?e.journal:undefined}/>{'internalGrant' in e&&<p className="accounting-expiry">회계 열람 만료 · {date(e.internalGrant.expiresAt,true)} KST</p>}</FinanceActions>}

    </>}
  </div>;
}
defineControls(EvidenceDetail, { path: { type: 'text' }, navigate: false, onUnauthorized: false, session: false });
