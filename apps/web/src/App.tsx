import { DemoHandoffContext, type DemoHandoff } from './demo-handoff';
import { PdfAuditPage } from './pages/PdfAuditPage';
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { defineControls } from 'tempo-sdk/assets';
import type { SessionDTO } from '@koda/protocol';
import { api, RequestError } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { EvidenceList, EvidenceDetail } from './pages/EvidencePages';
import { Icon } from './components/Icon';
import { Notice } from './components/Notice';
const AuditPage = lazy(()=>import('./pages/AuditPage').then(m=>({default:m.AuditPage})));
import { IssuerPage } from './pages/IssuerPage';

function readShareToken() {
  const value = window.location.pathname === '/share' ? new URLSearchParams(window.location.hash.slice(1)).get('token') : null;
  if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

const roles = { ISSUER: '발행 담당자', FINANCE: '재무담당자', ACCOUNTING: '회계담당자', AUDITOR: '외부 감사인' };
export default function App() {
  const [mock,setMock]=useState<boolean|null>(null);
  useEffect(()=>{const c=new AbortController();api<{scope:string}>('/health',{signal:c.signal}).then(v=>{if(!c.signal.aborted)setMock(v.scope==='MOCK_PDF_PRD_V03');}).catch(()=>{});return()=>c.abort();},[]);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState('');
  const [path, setPath] = useState(window.location.pathname);
  const [shareToken, setShareToken] = useState(readShareToken);
  const consumed = useCallback(() => setShareToken(null), []);
  const receiving = path === '/share' || path.startsWith('/audit/grants/');
  const pendingCheck = useRef<AbortController | null>(null);
  const currentSession = useRef(session); currentSession.current = session;
  const transitioning = useRef(false);
  const [handoff, setHandoff] = useState<DemoHandoff | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useCallback((next: string) => { window.history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0); }, []);
  const lock = useCallback(() => { pendingCheck.current?.abort(); setSession(null); setChecking(false); setNotice('세션이 만료되었거나 접근 권한이 변경되었습니다. 다시 인증해 주세요.'); }, []);
  const refresh = useCallback(async () => {
    if (transitioning.current) return;
    pendingCheck.current?.abort(); const controller = new AbortController(); pendingCheck.current = controller; if (!currentSession.current) setChecking(true);
    try { const current = await api<SessionDTO>('/me', { signal: controller.signal }); if (!controller.signal.aborted) setSession(current); }
    catch (error) { if (!controller.signal.aborted) { setSession(null); if (!(error instanceof RequestError && error.status === 401)) setNotice(error instanceof Error ? error.message : '연결을 확인해 주세요.'); } }
    finally { if (!controller.signal.aborted) setChecking(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const pop = () => { setPath(window.location.pathname); void refresh(); };
    const visibility = () => { if (!currentSession.current) return; if (document.hidden) pendingCheck.current?.abort(); else void refresh(); };
    const focus = () => { if (!document.hidden && currentSession.current) void refresh(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    const leaving = () => { pendingCheck.current?.abort(); flushSync(() => setChecking(true)); };
    window.addEventListener('popstate', pop); document.addEventListener('visibilitychange', visibility); window.addEventListener('focus', focus); window.addEventListener('pageshow', restored);
    window.addEventListener('pagehide', leaving);
    return () => { pendingCheck.current?.abort(); window.removeEventListener('popstate', pop); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', restored); window.removeEventListener('pagehide', leaving); };
  }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const expires = setTimeout(lock, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    const poll = setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    return () => { clearTimeout(expires); clearInterval(poll); };
  }, [session, lock, refresh]);
  async function logout(next?: DemoHandoff) {
    if (!session || loggingOut) return; transitioning.current = true; setLoggingOut(true); setLogoutError(''); pendingCheck.current?.abort(); setChecking(true);
    try { await api('/auth/logout', { method: 'POST', headers: { 'x-csrf-token': session.csrf } }); setSession(null); setNotice(next ? '앞 역할의 세션을 종료했습니다. 다음 담당자의 신원을 확인해 이어갑니다.' : '세션을 종료했습니다. 다른 신원으로 다시 인증할 수 있습니다.'); setHandoff(next ?? null); setShareToken(next?.token ?? null); if(next) navigate(next.path); else if (!receiving) navigate('/'); }
    catch (e) { if (e instanceof RequestError && e.status === 401) { setSession(null); navigate('/'); } else setLogoutError(e instanceof Error ? e.message : '로그아웃을 완료하지 못했습니다.'); }
    finally { pendingCheck.current?.abort(); transitioning.current = false; setChecking(false); setLoggingOut(false); }
  }
  function onLogin(current: SessionDTO) { pendingCheck.current?.abort(); setSession(current); setChecking(false); setNotice(''); setLogoutError(''); if(handoff && current.principal.id===handoff.principalId) { navigate(handoff.path); setHandoff(null); } else if (!receiving) navigate(['FINANCE','ACCOUNTING'].includes(current.principal.role) ? '/evidence' : '/'); }
  return <DemoHandoffContext.Provider value={logout}><div className="app-shell">
    <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <div className="workspace-main"><header className="topbar"><div className="topbar-location"><a className="module-brand" href="/" onClick={e => { e.preventDefault(); navigate(session && ['FINANCE','ACCOUNTING'].includes(session.principal.role) ? '/evidence' : '/'); }}>KODA <span>증빙</span></a><span className="environment-label">모의 데이터</span></div><div className="identity-area">{session ? <><div><span>{session.principal.organizationName}</span><strong>{session.principal.name}</strong></div><button className="logout-button" onClick={()=>void logout()} disabled={loggingOut}><Icon name="logout" /><span>역할 바꾸기</span></button></> : <span className="guest-status"><Icon name="lock" />인증 전</span>}</div></header>
      <main id="main-content" key={session ? [session.principal.id, session.principal.did, session.principal.role, session.principal.organizationId, session.csrf].join(':') : 'guest'}>{logoutError && <div className="global-notice"><Notice kind="error" title="세션 종료를 완료하지 못했습니다">{logoutError}<button className="text-button" onClick={()=>void logout()}>로그아웃 다시 시도</button></Notice></div>}
        {checking ? <div className="loading-state page" role="status"><span className="spinner" />세션을 확인하고 있습니다…</div>
          : !session ? <LoginPage suggested={handoff?.principalId} onLogin={onLogin} notice={notice} receiving={receiving} />
          : receiving && mock === null ? <p role="status">기록 모드를 확인하고 있습니다…</p> : receiving && mock ? <PdfAuditPage path={path} token={shareToken} session={session} navigate={navigate} consumed={consumed} onUnauthorized={lock} /> : receiving ? <Suspense fallback={<p role="status">기존 검사 화면을 불러오는 중…</p>}><AuditPage path={path} token={shareToken} session={session} navigate={navigate} consumed={consumed} onUnauthorized={lock} /></Suspense>
          : ['FINANCE','ACCOUNTING'].includes(session.principal.role) ? (/^\/evidence\/[^/]+\/versions\/[^/]+$/.test(path) ? <EvidenceDetail key={path} path={path} navigate={navigate} onUnauthorized={lock} session={session} /> : <EvidenceList principal={session.principal} navigate={navigate} onUnauthorized={lock} />)
          : session.principal.role === 'ISSUER' ? <IssuerPage session={session} onUnauthorized={lock} />
          : <div className="page"><h1>공유받은 증빙</h1><Notice title="전달받은 공유 링크를 열어 주세요">감사인 역할만으로 고객사의 증빙 목록이나 원문을 조회할 수 없습니다. 지정된 공유 링크로 들어오면 권한을 다시 확인합니다.</Notice><button className="button secondary role-switch" onClick={()=>void logout()}>로그아웃하고 신원 바꾸기<Icon name="arrow" /></button></div>}
      </main><footer className="app-footer"><span>KODA × INHA <b>2026</b></span><span>시연용 모의 체인 · 실제 기록 아님</span></footer>
    </div>
  </div></DemoHandoffContext.Provider>;
}
defineControls(App, {});
