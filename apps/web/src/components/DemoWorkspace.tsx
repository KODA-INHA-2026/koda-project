import { RoleJourney } from './RoleJourney';
import type { Role } from '@koda/protocol';
import { useEffect, useState, type ReactNode } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import type { AuditEventDTO } from '@koda/protocol';
import { api, RequestError } from '../api/client';
import { displayDate } from './VerificationPanel';
export type DemoStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface TraceItem { title: string; detail: string; state: 'idle' | 'running' | 'confirmed' | 'blocked' | 'different' }
const scenes = [
  { label: '신원 확인', role: '시연 시작', title: '어떤 역할로 살펴볼까요?' },
  { label: '원본 발행', role: 'KODA', title: '기준이 될 원본을 발행합니다' },
  { label: '일부 가림 열람', role: '재무담당자', title: '재무담당자는 필요한 정보만 봅니다' },
  { label: '권한 전달', role: '재무담당자', title: '파일 대신 열람 권한을 보냅니다' },
  { label: '전체 열람', role: '감사인', title: '감사인은 KODA 원본을 직접 엽니다' },
  { label: '원본 검증', role: '감사인', title: '발행된 원본과 같은지 확인합니다' },
  { label: '사본 검사', role: '감사인', title: '전달받은 사본은 원본과 같을까요?' },
];
export function DemoFlow({ step, role }: { step: DemoStep; role?: Role }) {
  const current=role??(step===1?undefined:step===2?'ISSUER':step<=4?'FINANCE':'AUDITOR');
  const task=step===1?(current?`${{ISSUER:'KODA 운영자',FINANCE:'재무담당자',ACCOUNTING:'회계담당자',AUDITOR:'감사인'}[current]}의 신원을 확인합니다`:scenes[0]!.title):current==='ACCOUNTING'?(step===4?'감사인에게 원본 열람 권한을 전달하세요':'결산에 필요한 거래를 확인하세요'):current==='FINANCE'?'잔고를 확인하고 회계담당자에게 인계하세요':scenes[step-1]!.title;
  return <RoleJourney current={current} task={task} scene={step===3&&current==='ACCOUNTING'?'S-03b · 결산용 열람':`S-0${step} · ${scenes[step-1]!.label}`}/>;
}
export function Backstage({ trace, insight, technical }: { trace: TraceItem[]; insight: string; technical?: ReactNode }) {
  const labels={idle:'대기',running:'처리 중',confirmed:'완료',blocked:'확인 불가',different:'차이 확인'};
  return <aside className="backstage" aria-label="뒷단 처리 해설">
    <div className="backstage-heading"><span>시연용 시스템 해설</span><h2>화면 뒤의 처리 과정</h2></div>
    <p className="mock-boundary">시연용 모의 체인 · 실제 기록 아님</p>
    <ol className="trace-graph" aria-label="현재 단계의 실제 처리 상태">{trace.map((t,i)=><li key={t.title} data-state={t.state} aria-current={t.state==='running'?'step':undefined}><div className="trace-marker" aria-hidden="true">{i+1}</div><div className="trace-node"><div><h3>{t.title}</h3><span className="trace-state">{labels[t.state]}</span></div><p>{t.detail}</p></div></li>)}</ol>
    <details className="technical-disclosure"><summary>처리 원리와 기술 근거</summary><p>{insight}</p><ol>{trace.map(t=><li key={t.title}><strong>{t.title}</strong><p>{t.detail}</p></li>)}</ol>{technical}<p>원본과 권한은 비공개 서버에, PDF 지문과 기록 시각은 같은 서버의 모의 원장에 저장합니다.</p></details>
  </aside>;
}
// Kept for the legacy EVM screen; the new demo uses a single scene heading.
export function WorkspaceStatus({ document, role, basis, permission, result }: { document: string; role: string; basis: string; permission: string; result: string }) {
  return <div className="workspace-status"><strong>{document}</strong><span>{role} · {basis} · {permission} · {result}</span></div>;
}
export function DemoWorkspace({ role, document, actions, records, step=3, trace=[], insight='', technical, toolbar }: { role?:Role; toolbar?:ReactNode; document: ReactNode; actions: ReactNode; records: ReactNode; step?: DemoStep; trace?: TraceItem[]; insight?: string; technical?: ReactNode }) {
  return <div className="demo-scene"><DemoFlow step={step} role={role}/><div className="scene-comparison"><section className="user-surface" aria-label="사용자 업무 화면"><div className="surface-label"><span>사용자 화면</span><strong>{role==='ACCOUNTING'?'회계담당자':scenes[step-1]!.role}</strong></div><div className="business-content" data-actions={Boolean(toolbar||actions)}><div className="workspace-document">{document}</div>{(toolbar||actions)&&<aside className="business-actions" aria-label="지금 할 일">{toolbar&&<div className="workspace-toolbar">{toolbar}</div>}{actions&&<div className="workspace-actions">{actions}</div>}</aside>}</div></section><Backstage trace={trace} insight={insight} technical={technical}/></div>{records&&<section className="workspace-records" aria-label="업무 기록"><div className="record-heading"><h2>{step===1?'인증 전 · 역할별 공개 범위':'최근 처리 기록'}</h2></div>{records}</section>}</div>;
}
const eventLabels:Record<string,string>={INTERNAL_GRANTED:'회계 인계 권한 생성',INTERNAL_REVOKED:'회계 인계 철회',ACCOUNTING_OPENED:'회계 열람 허용',ISSUED:'원본 발행',GRANT_CREATED:'권한 생성',GRANT_REVOKED:'열람 권한 철회',OPENED:'원본 열람 허용',FINANCE_OPENED:'일부 가림 열람',PDF_VERIFIED:'PDF 검사',VERIFIED:'검증',ACCESS_DENIED:'접근 차단'};
const resultLabels:Record<string,string>={MOCK_RECORDED:'모의 지문 저장',ACTIVE:'수신 대기',ALLOWED:'열람 확인',ORIGINAL_MATCH:'원본 일치',CONTENT_CHANGED:'내용 차이',NON_ORIGINAL_COPY:'비원본 사본',COMPARISON_UNAVAILABLE:'내용 비교 불가',VERIFICATION_UNAVAILABLE:'검증 불가',REVOKED:'철회됨',EXPIRED:'만료됨'};
export function ActivityLog({ path, refreshKey=0, onUnauthorized, onAccessDenied }: { path:string; refreshKey?:number; onUnauthorized:()=>void; onAccessDenied?:()=>void }) {
  const [events,setEvents]=useState<AuditEventDTO[]|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{const c=new AbortController();setError('');api<AuditEventDTO[]>(path,{signal:c.signal}).then(v=>{if(!c.signal.aborted)setEvents(v);}).catch(e=>{if(c.signal.aborted)return;setEvents(null);if(e instanceof RequestError&&e.status===401)onUnauthorized();else if(e instanceof RequestError&&[403,404,410].includes(e.status)&&onAccessDenied)onAccessDenied();else setError(e.message);});return()=>c.abort();},[path,refreshKey,retry,onUnauthorized,onAccessDenied]);
  const row=(e:AuditEventDTO)=><li key={e.id}><strong>{eventLabels[e.type]??e.type} · {resultLabels[e.result]??e.result}</strong><span>{e.source==='CLIENT_REPORTED'?'브라우저 검사 보고':'서버 기록'}</span><time dateTime={e.at}>{displayDate(e.at)}</time></li>;
  return <>{error?<div role="alert"><p>기록을 불러오지 못했습니다. {error}</p><button className="text-button" onClick={()=>setRetry(n=>n+1)}>기록 다시 불러오기</button></div>:events?<><ol className="event-list">{events.length===0?<li>아직 기록된 행동이 없습니다.</li>:row(events[0]!)}</ol>{events.length>1&&<details className="history-disclosure"><summary>이전 기록 {events.length-1}건 보기</summary><ol className="event-list">{events.slice(1).map(row)}</ol></details>}</>:<p role="status">기록을 불러오는 중…</p>}</>;
}
defineControls(DemoFlow,{role:{type:'select',options:['ISSUER','FINANCE','ACCOUNTING','AUDITOR']},step:{type:'select',options:[1,2,3,4,5,6,7]}});
defineControls(Backstage,{trace:false,insight:{type:'text'},technical:false});
defineControls(WorkspaceStatus,{document:{type:'text'},role:{type:'text'},basis:{type:'text'},permission:{type:'text'},result:{type:'text'}});
defineControls(DemoWorkspace,{role:{type:'select',options:['ISSUER','FINANCE','ACCOUNTING','AUDITOR']},toolbar:false,document:false,actions:false,records:false,step:{type:'select',options:[1,2,3,4,5,6,7]},trace:false,insight:{type:'text'},technical:false});
defineControls(ActivityLog,{path:false,refreshKey:false,onUnauthorized:false,onAccessDenied:false});
