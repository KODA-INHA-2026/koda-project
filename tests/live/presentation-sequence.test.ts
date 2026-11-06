import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTS,
  ACT_VIEWS,
  liveStageAct,
  motionFocus,
  nextMotionStep,
  presentationAct,
  type MotionStep,
} from '../../apps/web/src/live/presentation-sequence.ts';
import type { VerificationResult, VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';
const event = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state'] = 'success'): VerificationTraceEvent => ({ id, state, operation: id, location: 'local' });
const matched: VerificationResult = { status: 'match', message: 'ok', chainRecordValid: true, chainHash: `0x${'ab'.repeat(32)}` };

test('five acts follow the CEO flow and keep the external verifier separate', () => {
  assert.deepEqual(ACTS, ['원본 발급', '전자서명·해시 생성', '블록체인 기록', '제3자 대조·검증', '외부 검증 초안']);
  assert.deepEqual(ACT_VIEWS, ['issue', 'prepare', 'register', 'verify', 'external']);
  assert.equal(presentationAct(null), 0);
  assert.equal(presentationAct('unknown'), 0);
  assert.equal(presentationAct('verify'), 3);
  assert.equal(presentationAct('external'), 4);
  assert.equal(liveStageAct('ready'), 0);
  assert.equal(liveStageAct('pdf'), 0);
  assert.equal(liveStageAct('hash'), 1);
  assert.equal(liveStageAct('sign'), 1);
  assert.equal(liveStageAct('register'), 2);
  assert.equal(liveStageAct('included'), 2);
  assert.equal(liveStageAct('verify'), 3);
  assert.equal(liveStageAct('finalized'), 3);
  assert.equal(liveStageAct('result'), 3);
});

test('fast RPC does not skip intermediate verification motion', () => {
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
