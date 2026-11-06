import type { SceneId } from './architecture-state';
import type { VerificationTraceEvent } from './verification';

export const ACTS = ['발급·등록·전달', '제3자 검증'] as const;
export type ReviewPhase = 'inspect' | 'lookup' | 'compare';

export function chapterForTrace(trace: VerificationTraceEvent[]): SceneId {
  const event = trace.findLast(item => item.state === 'running') ?? trace.at(-1);
  if (!event) return 'receive';
  if (['input', 'sha256', 'signature'].includes(event.id)) return 'inspect';
  if (event.id === 'hash-comparison') return 'compare';
  return 'lookup';
}

// A summary of observed work, not a second execution or an exhaustive RPC timeline.
export function observedReviewPhases(trace: VerificationTraceEvent[]): ReviewPhase[] {
  const phases: ReviewPhase[] = [];
  if (trace.some(event => ['input', 'sha256', 'signature'].includes(event.id))) phases.push('inspect');
  if (trace.some(event => !['deployment-validation', 'input', 'sha256', 'signature', 'hash-comparison'].includes(event.id))) phases.push('lookup');
  if (trace.some(event => event.id === 'hash-comparison')) phases.push('compare');
  if (!phases.length && trace.some(event => event.id === 'deployment-validation')) phases.push('lookup');
  return phases;
}

export function reviewMapStep(phase: ReviewPhase, trace: VerificationTraceEvent[]) {
  const events = trace.filter(event => phase === 'inspect' ? ['input', 'sha256', 'signature'].includes(event.id)
    : phase === 'compare' ? event.id === 'hash-comparison'
      : !['input', 'sha256', 'signature', 'hash-comparison'].includes(event.id));
  return events.findLast(event => event.state === 'failure') ?? events.at(-1);
}
