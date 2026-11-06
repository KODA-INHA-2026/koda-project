import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTS, motionFocus, nextMotionStep, type MotionStep } from '../../apps/web/src/live/presentation-sequence.ts';
import type { VerificationResult, VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';
const event = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state'] = 'success'): VerificationTraceEvent => ({ id, state, operation: id, location: 'local' });
const matched: VerificationResult = { status: 'match', message: 'ok', chainRecordValid: true, chainHash: `0x${'ab'.repeat(32)}` };

test('two core acts plus an external verification draft; fast RPC does not skip intermediate motion', () => {
  assert.equal(ACTS.length, 3);
  const evidence = { trace: [event('sha256'), event('record'), event('hash-comparison')], result: matched };
  let step: MotionStep = 'prepare';
  for (const expected of ['request', 'record', 'return', 'compare', 'result']) {
    step = nextMotionStep(step, evidence);
    assert.equal(step, expected);
  }
  assert.equal(motionFocus('request'), 'query');
  assert.equal(motionFocus('return'), 'response');
  assert.equal(motionFocus('compare'), 'third-party');
});
test('slow RPC never fabricates a document lookup, a returned record, or a comparison', () => {
  assert.equal(nextMotionStep('prepare', { trace: [event('receipt')] }), 'prepare');
  assert.equal(nextMotionStep('prepare', { trace: [event('record', 'running')] }), 'request');
  assert.equal(nextMotionStep('request', { trace: [event('record', 'running')] }), 'request');
  assert.equal(nextMotionStep('request', { trace: [event('record')], result: { ...matched, chainRecordValid: false } }), 'result');
  assert.equal(nextMotionStep('return', { trace: [event('record')] }), 'return');
});
test('early failures and pending stop before a record response; unregistered returns no comparison', () => {
  for (const status of ['unavailable', 'signature-mismatch', 'pending', 'invalid'] as const) {
    const result: VerificationResult = { status, message: 'stopped' };
    assert.equal(nextMotionStep('prepare', { trace: [event('signature', 'failure')], result }), 'result');
  }
  assert.equal(nextMotionStep('request', { trace: [event('record', 'failure')], result: { status: 'not-registered', message: 'none' } }), 'result');
});
test('changed PDF still gets the valid registered reference, then a real mismatch', () => {
  const evidence = { trace: [event('record'), event('hash-comparison', 'failure')], result: { ...matched, status: 'file-mismatch' as const } };
  assert.equal(nextMotionStep('request', evidence), 'record');
  assert.equal(nextMotionStep('return', evidence), 'compare');
  assert.equal(nextMotionStep('compare', evidence), 'result');
});
