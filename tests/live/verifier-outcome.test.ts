import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifierOutcome } from '../../apps/web/src/live/verifier-outcome.ts';

test('file mismatch does not describe a valid issuance signature as proof of this submitted PDF', () => {
  const outcome = verifierOutcome({ status: 'file-mismatch', message: 'different bytes', signatureValid: true, fileMatch: false });
  assert.equal(outcome.kind, 'mismatch');
  assert.equal(outcome.questions[0]?.value, '제출 PDF는 발급 원본과 연결되지 않음');
  assert.equal(outcome.questions[1]?.value, '불일치');
});

test('pending finality remains distinct from an unavailable verification failure', () => {
  const pending = verifierOutcome({ status: 'pending', message: 'not finalized' });
  const unavailable = verifierOutcome({ status: 'unavailable', message: 'rpc failed', signatureValid: true });
  assert.equal(pending.kind, 'pending');
  assert.ok(pending.questions.every(question => question.state === 'waiting'));
  assert.equal(unavailable.kind, 'failure');
  assert.equal(unavailable.questions[0]?.value, '서명은 확인됐지만 제출 PDF 연결을 확인하지 못함');
});

test('pending distinguishes a missing receipt from an included but non-finalized transaction', () => {
  const waiting = verifierOutcome({ status: 'pending', message: '영수증 없음' });
  const included = verifierOutcome({ status: 'pending', message: 'finalized 대기', receiptBlockNumber: '123' });
  assert.match(waiting.title, /블록 포함/);
  assert.ok(waiting.questions.every(question => question.value === '블록 포함 대기'));
  assert.match(included.title, /최종 확정/);
  assert.ok(included.questions.every(question => question.value === '최종 확정 대기'));
});
