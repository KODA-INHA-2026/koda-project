import { RoleJourney } from './RoleJourney';
import type { ReactNode } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import type { PdfInspection } from '@koda/protocol';
import { displayDate } from './VerificationPanel';
import './audit-verification-scene.css';

export type VerificationPhase = 'idle' | 'access' | 'record' | 'cryptography' | 'finalize' | 'complete';
interface Props {
  document: ReactNode;
  records: ReactNode;
  phase: VerificationPhase;
  busy: boolean;
  checking: boolean;
  authorized: boolean;
  error: string;
  verificationError: string;
  result: PdfInspection | null;
  onVerify: () => void;
  onRetryAccess: () => void;
  onInspectCopy: () => void;
}
const operations = [
  { id: 'access', place: 'KODA 서버', title: '감사인 DID·권한 확인', explanation: '인증된 DID의 지정 여부·만료·철회를 확인합니다.', transfer: '원본 PDF + 발행자 서명 증명' },
  { id: 'record', place: '모의 체인', title: '기준 지문·기록 시각 조회', explanation: '발행 때 남긴 지문을 같은 서버의 모의 저장소에서 읽습니다. 새 체인 거래는 없습니다.', transfer: '발행 당시의 파일 지문 + 기록 시각' },
  { id: 'cryptography', place: '브라우저', title: '발행자 DID 서명·PDF 지문 검사', explanation: 'KODA 공개키로 서명 확인 · PDF의 SHA-256 대조', transfer: '검사 결과를 서버에 보고' },
  { id: 'finalize', place: 'KODA 서버', title: '결과 기록·권한 최종 확인', explanation: '검사 중 권한이 바뀌지 않았는지 다시 확인합니다.', transfer: '' },
] as const;

/** S-06 review scene only. Other demo scenes retain their existing presentation. */
export function AuditVerificationScene({ document, records, phase, busy, checking, authorized, error, verificationError, result, onVerify, onRetryAccess, onInspectCopy }: Props) {
  const active = operations.findIndex(operation => operation.id === phase);
  const hasFailure = Boolean(error || verificationError) || result?.status === 'VERIFICATION_UNAVAILABLE';
  const currentMessage = checking ? '서버에서 현재 열람 권한 확인 중' : busy
    ? `${operations[active]?.place ?? '서버'}에서 ${operations[active]?.title ?? '검증'} 중`
    : hasFailure ? '확인하지 못한 항목이 있습니다' : result ? '이번 검증을 마쳤습니다' : '원본 검증을 누르면 처리가 시작됩니다';
  function state(id: typeof operations[number]['id'], index: number) {
    if (checking) return id === 'access' ? 'running' : 'waiting';
    if (error) return id === 'access' ? 'blocked' : 'waiting';
    if (verificationError) return index === active ? 'blocked' : index < active ? 'done' : 'waiting';
    if (result) {
      if (id === 'record' && !result.record) return 'blocked';
      if (id === 'cryptography' && (!result.signature || !result.fingerprint)) return 'blocked';
      return 'done';
    }
    if (busy && index === active) return 'running';
    if (busy && index < active) return 'done';
    return 'waiting';
  }
  const labels = { waiting: '대기', running: '처리 중', done: '완료', blocked: '확인 불가' };
  return <div className="audit-review-scene">
    <RoleJourney current="AUDITOR" task="발행된 원본과 같은지 확인하세요"/>
    <div className="verification-pair">
      <section className="review-user" aria-label="사용자 업무 화면">
        <header className="review-panel-heading"><div><span>사용자 화면</span><strong>감사인 · 원본 검증</strong></div>{authorized&&!checking&&!error&&<button className="button primary" disabled={busy} onClick={onVerify}>{busy?'원본 확인 중…':'원본 검증하기'}</button>}</header>
        {checking ? <p className="review-lock" role="status">현재 열람 권한을 확인하고 있습니다…</p> : error ? <div className="review-lock" role="alert"><h2>접근 차단 · 문서를 표시할 수 없습니다</h2><p>{error}</p><button className="button primary" onClick={onRetryAccess}>권한 다시 확인</button></div> : authorized ? <>
          <div className="review-outcome">
            {(busy || result) && <div className="pdf-result" data-status={result?.status ?? 'NOT_RUN'} role="status"><strong>{busy ? '서명·파일 지문·기록을 확인하고 있습니다' : result?.reason}</strong>{result && <p>실제 검사 {displayDate(result.checkedAt)} · 시연용 모의 기록</p>}</div>}
            {verificationError && <p className="review-validation-error" role="alert">검증을 완료하지 못했습니다. {verificationError} 원본 검증을 다시 시도해 주세요.</p>}
          </div>
          {document}
          <div className="review-decision">
            {!busy && <button className="text-button" onClick={onInspectCopy}>사본 파일 검사로 이동 →</button>}
          </div>
        </> : <p className="review-lock">허용된 원본을 불러오지 못했습니다.</p>}
      </section>
      <aside className="review-system" aria-label="시연용 시스템 해설">
        <header className="review-panel-heading"><span>시연용 시스템 해설</span><strong>블록체인 대조 과정 · 모의 실행</strong></header>
        <div className="system-current" role="status"><span className="execution-dot" data-running={busy || checking}/><p>{currentMessage}</p></div>
        <ol className="execution-diagram" aria-label="원본 검증의 실제 처리 순서">
          {operations.map((operation,index) => {
            const status = state(operation.id,index);
            return <li key={operation.id} data-operation={operation.id} data-state={status} aria-current={status === 'running' ? 'true' : undefined}>
              <div className="execution-node"><div className="execution-meta"><span>{operation.place}{operation.id === 'record' && <b>MOCK</b>}</span><span>{labels[status]}</span></div><h2>{operation.title}</h2>{(status === 'running' || status === 'blocked') && <p>{operation.explanation}</p>}</div>
              {operation.transfer && <div className="execution-transfer" aria-hidden="true">↓</div>}
            </li>;
          })}
        </ol>
        <div className="technology-boundary"><p><strong>DID</strong> 누가 열고, 누가 발행했는지 확인</p><p><strong>블록체인 역할</strong> 발행 당시 지문·기록 시각 대조</p><p>시연용 모의 체인 · 실제 기록 아님</p></div>
        <details className="review-proof"><summary>네 확인 항목과 실제 검사 근거</summary><ol>{operations.map(operation=><li key={operation.id}><strong>{operation.place} · {operation.title}</strong><p>{operation.explanation}</p></li>)}</ol><dl><div><dt>열람 권한</dt><dd>{authorized && !checking ? '현재 서버 요청에서 확인' : '확인 필요'}</dd></div><div><dt>발행자 서명</dt><dd>{result?.signature ? '확인' : '미확인'}</dd></div><div><dt>PDF 파일 지문</dt><dd>{result?.fingerprint ? '일치' : result ? '미확인 또는 불일치' : '미검사'}</dd></div><div><dt>모의 기록 시각</dt><dd>{result?.record ? `${displayDate(result.record.recordedAt)} · 시연용 모의 기록` : '미확인'}</dd></div></dl><p>개인키는 DID 자체가 아닙니다. 클릭형 데모에서는 격리된 서버의 시연 지갑이 서명하며, 개인키를 브라우저에 보내지 않습니다.</p><p>원문은 비공개 서버에서 제공합니다. 이 장면에서는 새 체인 기록을 발행하지 않으며 실제 RPC를 호출하지 않습니다.</p><p>파일의 동일성 검사이며 실제 자산 존재·최초 입력의 진실성을 보장하지 않습니다.</p><button className="button secondary" disabled>검증 결과 저장 · 시연에서 저장 미지원</button></details>
      </aside>
    </div>
    <details className="review-records"><summary>최근 처리 기록</summary>{records}</details>
  </div>;
}

defineControls(AuditVerificationScene, { document:false, records:false, phase:{type:'select'}, busy:{type:'boolean'}, checking:{type:'boolean'}, authorized:{type:'boolean'}, error:{type:'text'}, verificationError:{type:'text'}, result:false, onVerify:false, onRetryAccess:false, onInspectCopy:false });
