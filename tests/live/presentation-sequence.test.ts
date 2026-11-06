import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTS, chapterForTrace, observedReviewPhases, reviewMapStep } from '../../apps/web/src/live/presentation-sequence.ts';
import type { VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';
const event = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state'] = 'success'): VerificationTraceEvent => ({ id, state, operation: id, location: 'local' });

test('two acts retain internal processing without turning it into extra pages', () => {
  assert.equal(ACTS.length, 2);
  assert.equal(chapterForTrace([event('sha256', 'running')]), 'inspect');
  assert.equal(chapterForTrace([event('record', 'running')]), 'lookup');
  assert.equal(chapterForTrace([event('hash-comparison')]), 'compare');
});
test('review only summarizes work actually attempted and keeps failures on their own path', () => {
  const preflight = event('deployment-validation');
  assert.deepEqual(observedReviewPhases([]), []);
  assert.deepEqual(observedReviewPhases([event('deployment-validation', 'failure')]), ['lookup']);
  assert.deepEqual(observedReviewPhases([preflight, event('input', 'failure')]), ['inspect']);
  const interrupted = [preflight, event('sha256'), event('signature'), event('receipt', 'failure')];
  assert.deepEqual(observedReviewPhases(interrupted), ['inspect', 'lookup']);
  assert.equal(reviewMapStep('lookup', interrupted)?.state, 'failure');
  const completed = [preflight, event('sha256'), event('signature'), event('record'), event('hash-comparison', 'failure')];
  assert.deepEqual(observedReviewPhases(completed), ['inspect', 'lookup', 'compare']);
  assert.equal(reviewMapStep('compare', completed)?.state, 'failure');
});
