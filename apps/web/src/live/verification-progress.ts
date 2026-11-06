import type { VerificationResult, VerificationTraceEvent, VerificationTraceId } from './verification';

const STEPS: { id: string; title: string; tech: string; ids: VerificationTraceId[] }[] = [
  { id: 'deployment', title: '조회할 컨트랙트 확인', tech: 'Ethereum · 배포 코드 / 고정 발급자', ids: ['deployment-validation'] },
  { id: 'hash', title: '제출 PDF 해시 계산', tech: '브라우저 · SHA-256', ids: ['input', 'sha256'] },
  { id: 'signature', title: '서명에서 발급자 확인', tech: '브라우저 · EIP-712 / ECDSA 주소 복구', ids: ['signature'] },
  { id: 'chain', title: '확정된 등록 기록 조회', tech: 'Ethereum · JSON-RPC / eth_call', ids: ['chain-id', 'finalized-block', 'transaction-input', 'receipt', 'canonical-block', 'registration-event', 'finality', 'authorized-issuer', 'record'] },
  { id: 'comparison', title: '세 해시 대조', tech: '브라우저 · Hfile / Hsigned / Hchain', ids: ['hash-comparison'] },
];

// Group the actual sequential trace; never infer completion from playback time.
export function verificationProgress(trace: VerificationTraceEvent[], busy: boolean, result?: VerificationResult) {
  return STEPS.map(step => {
    const events = trace.filter(event => step.ids.includes(event.id));
    const failure = events.find(event => event.state === 'failure');
    const finished = events.find(event => event.id === step.ids.at(-1))?.state === 'success';
    const state = failure
      ? result?.status === 'pending' && step.id === 'chain' ? 'pending'
        : result?.status === 'file-mismatch' && step.id === 'comparison' ? 'mismatch' : 'failure'
      : finished ? 'success' : events.length ? busy ? 'running' : 'stopped' : 'idle';
    const labels = { idle: '대기', running: '처리 중', success: '완료', pending: '확정 대기', mismatch: '불일치', failure: '확인 불가', stopped: '중단' };
    return { ...step, state, statusLabel: labels[state] };
  });
}
