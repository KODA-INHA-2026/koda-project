import type { ArchitectureFocus } from './architecture-state';
import type { VerificationResult, VerificationTraceEvent } from './verification';

export const ACTS = ['발급·등록·전달', '제3자 검증'] as const;
export type MotionStep = 'ready' | 'prepare' | 'request' | 'record' | 'return' | 'compare' | 'result';
export const MOTION_MS: Record<MotionStep, number> = {
  ready: 0, prepare: 900, request: 1600, record: 1100, return: 1800, compare: 1500, result: 0,
};
export interface MotionEvidence { trace: VerificationTraceEvent[]; result?: VerificationResult }

// These are minimum presentation durations, never network timing or proof of completion.
// Each transition also needs evidence from the existing verifier.
export function nextMotionStep(step: MotionStep, { trace, result }: MotionEvidence): MotionStep {
  const attempted = trace.some(event => event.id === 'record');
  const recordRead = trace.some(event => event.id === 'record' && event.state === 'success')
    && result?.chainRecordValid === true && Boolean(result.chainHash);
  const compared = trace.some(event => event.id === 'hash-comparison');
  switch (step) {
    case 'prepare': return attempted ? 'request' : result ? 'result' : step;
    case 'request': return recordRead ? 'record' : result ? 'result' : step;
    case 'record': return recordRead ? 'return' : result ? 'result' : step;
    case 'return': return recordRead && compared ? 'compare' : result ? 'result' : step;
    case 'compare': return result ? 'result' : step;
    default: return step;
  }
}

export function motionFocus(step: MotionStep): ArchitectureFocus {
  if (step === 'request') return 'query';
  if (step === 'record') return 'ethereum';
  if (step === 'return') return 'response';
  return 'third-party';
}

export const MOTION_LABEL: Record<MotionStep, string> = {
  ready: '제3자 · 문서 검증', prepare: 'PDF·발급정보 확인', request: '문서 ID로 조회',
  record: '등록된 원본 확인', return: '등록 기록 수신', compare: '제출 PDF와 대조', result: '검증 결과',
};
