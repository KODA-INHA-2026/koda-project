import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localVerificationChecks, verifierOutcome } from '../../apps/web/src/live/verifier-outcome.ts';
import type { VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';

const originalHash = `0x${'11'.repeat(32)}` as const;
const changedHash = `0x${'22'.repeat(32)}` as const;

test('local signature and file checks stay distinct from the final registration verdict', () => {
  const original = localVerificationChecks({ status: 'match', message: '', signatureValid: true, fileHash: originalHash }, [], originalHash, false);
  const altered = localVerificationChecks({ status: 'file-mismatch', message: '', signatureValid: true, fileHash: changedHash }, [], originalHash, false);
  const resigned = localVerificationChecks({ status: 'file-mismatch', message: '', fileHash: changedHash,
    signedComparison: { signatureValid: true, fileMatch: true, signedHash: changedHash, registrationConflict: true } }, [], changedHash, true);
  assert.deepEqual(original, { signatureValid: true, fileMatch: true });
  assert.deepEqual(altered, { signatureValid: true, fileMatch: false });
  assert.deepEqual(resigned, { signatureValid: true, fileMatch: true });
});

test('unknown or failed hashing is not rendered as a mismatch', () => {
  assert.deepEqual(localVerificationChecks(undefined, [], originalHash, false), { signatureValid: undefined, fileMatch: undefined });
  const failed: VerificationTraceEvent[] = [{ id: 'sha256', operation: '제출 PDF 전체 바이트 SHA-256', location: 'local', state: 'failure', detail: 'Web Crypto SHA-256 계산 실패' }];
  assert.deepEqual(localVerificationChecks({ status: 'unavailable', message: '' }, failed, originalHash, false), { signatureValid: undefined, fileMatch: undefined });
});

test('resigned candidate checks are not replaced by the original reference signature', () => {
  const trace: VerificationTraceEvent[] = [
    { id: 'sha256', operation: '재서명 PDF 전체 바이트 SHA-256', location: 'local', state: 'success', detail: changedHash },
    { id: 'signature', operation: '재서명 정보의 발급자 주소 복구', location: 'local', state: 'success' },
    { id: 'signature', operation: '등록 원본의 EIP-712 발급자 주소 복구', location: 'local', state: 'failure' },
  ];
  assert.deepEqual(localVerificationChecks({ status: 'unavailable', message: '', signatureValid: false }, trace, changedHash, true), { signatureValid: true, fileMatch: true });
});

test('local success during an RPC outage does not turn the final verdict into success', () => {
  const result = { status: 'unavailable' as const, message: 'RPC failed', signatureValid: true, fileHash: originalHash };
  assert.deepEqual(localVerificationChecks(result, [], originalHash, false), { signatureValid: true, fileMatch: true });
  assert.equal(verifierOutcome(result).kind, 'failure');
});

test('signed comparison keeps valid issuer evidence distinct from registered-original conflict', () => {
  const outcome = verifierOutcome({ status: 'file-mismatch', message: 'registered original differs',
    signatureValid: true, chainRecordValid: true, fileMatch: true,
    signedComparison: { signatureValid: true, fileMatch: true, signedHash: `0x${'44'.repeat(32)}`, registrationConflict: true } });
  assert.equal(outcome.kind, 'mismatch');
  assert.equal(outcome.title, '서명은 유효하지만 등록 원본과 다릅니다');
  assert.equal(outcome.questions[0]?.state, 'confirmed');
  assert.equal(outcome.questions[1]?.value, '등록본과 불일치');
  assert.equal(outcome.questions[2]?.state, 'warning');
});

test('file mismatch does not describe a valid issuance signature as proof of this submitted PDF', () => {
  const outcome = verifierOutcome({ status: 'file-mismatch', message: 'different bytes', signatureValid: true, fileMatch: false });
  assert.equal(outcome.kind, 'mismatch');
  assert.equal(outcome.questions[0]?.value, '원본 확인 불가');
  assert.ok(outcome.questions.every(question => question.state !== 'confirmed'));
  assert.equal(outcome.questions[1]?.value, '불일치');
});

test('pending finality remains distinct from an unavailable verification failure', () => {
  const pending = verifierOutcome({ status: 'pending', message: 'not finalized' });
  const unavailable = verifierOutcome({ status: 'unavailable', message: 'rpc failed', signatureValid: true });
  assert.equal(pending.kind, 'pending');
  assert.ok(pending.questions.every(question => question.state === 'waiting'));
  assert.equal(unavailable.kind, 'failure');
  assert.equal(unavailable.questions[0]?.value, '확인 불가');
  assert.ok(unavailable.questions.every(question => question.state === 'unavailable'));
});

test('pending distinguishes a missing receipt from an included but non-finalized transaction', () => {
  const waiting = verifierOutcome({ status: 'pending', message: '영수증 없음' });
  const included = verifierOutcome({ status: 'pending', message: 'finalized 대기', receiptBlockNumber: '123' });
  assert.match(waiting.title, /블록 포함/);
  assert.ok(waiting.questions.every(question => question.value === '블록 포함 대기'));
  assert.match(included.title, /최종 확정/);
  assert.ok(included.questions.every(question => question.value === '최종 확정 대기'));
});
