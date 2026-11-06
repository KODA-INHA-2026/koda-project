import type { SceneId } from './architecture-state';
import type { LiveStage } from './presentation-types';
import type { VerificationTraceEvent } from './verification';

export const CHAPTERS: { id: SceneId; label: string }[] = [
  { id: 'custody', label: '수탁과 증명서' },
  { id: 'prepare', label: '검증정보 생성' },
  { id: 'register', label: '등록과 확정' },
  { id: 'receive', label: '검증 시작' },
  { id: 'inspect', label: '제출 문서 확인' },
  { id: 'lookup', label: '블록체인 조회' },
  { id: 'compare', label: '대조와 결과' },
];
export const LIVE_CHAPTER: Record<LiveStage, SceneId> = {
  ready: 'custody', pdf: 'custody', hash: 'prepare', sign: 'prepare',
  register: 'register', included: 'register', verify: 'receive', finalized: 'compare', result: 'compare',
};
export function isVerificationChapter(id: SceneId): id is 'receive' | 'inspect' | 'lookup' | 'compare' {
  return ['receive', 'inspect', 'lookup', 'compare'].includes(id);
}
export function chapterForStep(id: string): SceneId {
  if (id === 'deployment') return 'receive';
  if (id === 'hash' || id === 'signature') return 'inspect';
  if (id === 'chain') return 'lookup';
  return 'compare';
}
export function chapterForTrace(trace: VerificationTraceEvent[]): SceneId {
  const event = trace.find(item => item.state === 'running') ?? trace.at(-1);
  if (!event || event.id === 'deployment-validation') return 'receive';
  if (['input', 'sha256', 'signature'].includes(event.id)) return 'inspect';
  if (event.id === 'hash-comparison') return 'compare';
  return 'lookup';
}
