import { defineControls } from 'tempo-sdk/assets';
import type { VerificationResult } from '@koda/protocol';
export const displayDate = (v: string) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(v)) + ' KST';
const titles = { VALID: 'KODA가 발행한 원본과 같습니다.', INVALID: '발행 자료와 일치하지 않습니다.', UNVERIFIABLE: '지금은 검증할 수 없습니다.' };
const labels = { FORMAT: '원문 형식', ISSUER: '등록된 발행자', BINDING: '문서·버전·체인 연결', SIGNATURE: '발행 서명', COMMITMENT: '원문 계산값', ANCHOR: '실제 체인 기록' };
const states = { PASS: '확인', FAIL: '불일치', UNAVAILABLE: '확인 불가', NOT_RUN: '미실행' };
const reasons: Record<string, string> = { RPC_UNAVAILABLE: '로컬 체인에 연결할 수 없습니다. 체인 실행 상태를 확인한 뒤 다시 검증해 주세요.', RECORD_NOT_FOUND: '지정한 체인에 발행 기록이 없습니다.', CHAIN_INSTANCE_CHANGED: '개발 체인이 변경되었거나 초기화되었습니다. 이전 기록을 인정하지 않습니다.', RECEIPT_NOT_FOUND: '거래 영수증을 찾을 수 없습니다.', TRANSACTION_REVERTED: '기록 거래가 실패했습니다.', UNSUPPORTED_FORMAT: '지원하는 원문 형식이 아닙니다.', CRYPTO_UNAVAILABLE: '브라우저의 암호 검증 기능을 사용할 수 없습니다.' };
export function VerificationPanel({ result, busy, run, copy = false, authorizationCheckedAt, expiresAt, chainMismatch = false }: { result: VerificationResult | null; busy: boolean; run: () => void; copy?: boolean; authorizationCheckedAt?: string; expiresAt?: string; chainMismatch?: boolean }) {
  const check = (id: string) => states[result?.checks.find(c => c.id === id)?.status ?? 'NOT_RUN'];
  return <section className="verification-panel" aria-label={copy ? '선택 파일 검사 결과' : '원본 검증 결과'}>
    <div className="section-action"><h2>{copy ? 'S-07 · 선택 파일 검사' : result?.mode === 'SERVER_MEDIATED' ? '서버 원본 확인' : 'S-06 · 원본 검증'}</h2><button className="button secondary" disabled={busy} onClick={run}>{busy ? '확인 중…' : copy ? '파일 다시 검사' : result ? '다시 검증' : '원본 검증하기'}</button></div>
    <div className="verification-result" data-status={busy ? 'PENDING' : result?.status ?? 'NOT_VERIFIED'} role="status" aria-live="polite">
      <strong>{busy ? '서명·지문·체인 기록을 확인하고 있습니다…' : result ? chainMismatch ? '체인 기록과 다릅니다.' : titles[result.status] : '아직 검증하지 않았습니다.'}</strong>
      {!busy && result && <><p>{result.mode === 'SERVER_MEDIATED' ? '서버가 원문을 확인한 결과' : copy ? '선택 파일의 실제 검사 결과 · 발행 원본은 그대로 유지됩니다.' : '이 브라우저에서 원문·서명을 재계산하고 체인을 직접 조회한 결과'}</p><p className="inspection-time">마지막 검증 결과 · 검증 시각 {displayDate(result.checkedAt)}</p>
        {result.status === 'UNVERIFIABLE' && <p>{reasons[result.reasonCode] ?? '필수 검사를 끝내지 못했습니다. 근거를 확인한 뒤 다시 시도해 주세요.'}</p>}
        <dl className="verification-four"><div><dt>발행자 서명</dt><dd>{check('SIGNATURE')}</dd></div><div><dt>문서 지문</dt><dd>{check('COMMITMENT')}</dd></div><div><dt>체인 기록 시각</dt><dd>{result.anchorEvidence ? displayDate(result.anchorEvidence.recordedAt) : check('ANCHOR') + ' · 확인한 시각 없음'}</dd></div><div><dt>열람 권한</dt><dd>{authorizationCheckedAt ? <>확인 · {displayDate(authorizationCheckedAt)}{expiresAt && <span>만료 {displayDate(expiresAt)}</span>}</> : '재무 세션 · 서버 요청 인가'}</dd></div></dl>
        <details className="verification-evidence"><summary>세부 암호 검사 · 6개</summary><dl>{result.checks.map(c => <div key={c.id}><dt>{labels[c.id]}</dt><dd>{states[c.status]} <code>{c.reasonCode}</code></dd></div>)}</dl><p>체인 인스턴스 <code>{result.chainInstance}</code></p>{result.anchorEvidence && <p>기록 블록 {result.anchorEvidence.blockNumber} · <code>{result.anchorEvidence.blockHash}</code></p>}</details>
        <p className="field-hint">권한 재확인은 체인 재검증이 아닙니다. 마지막 검사 시각의 결과를 보존합니다.</p>
        <button className="button secondary unavailable-action" disabled>검증 결과 저장 · 시연 미지원</button>
      </>}
    </div>
    <p className="field-hint">출처·무결성 확인은 자산의 실재·소유권·실시간 잔고·감사의견을 보장하지 않습니다.</p>
  </section>;
}
defineControls(VerificationPanel, { result: false, busy: { type: 'boolean' }, run: false, copy: { type: 'boolean' }, authorizationCheckedAt: false, expiresAt: false, chainMismatch: false });
