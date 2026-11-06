import { test } from 'node:test';
import assert from 'node:assert/strict';
import { architectureMapState, type ArchitectureStateInput } from '../../apps/web/src/live/architecture-state.ts';
import type { VerificationResult, VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';

const base: ArchitectureStateInput = { scene: 'verify', busy: true };
const trace = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state'], location: VerificationTraceEvent['location']): VerificationTraceEvent => ({ id, state, location, operation: id });
const result = (overrides: Partial<VerificationResult>): VerificationResult => ({ status: 'invalid', message: 'test', ...overrides });

test('input and signature failures stop locally without claiming a chain read', () => {
  const input = architectureMapState({ ...base, busy: false, result: result({ status: 'invalid' }) });
  const signature = architectureMapState({ ...base, busy: false, result: result({ status: 'signature-mismatch', signatureValid: false }) });
  assert.equal(input.focus, 'third-party');
  assert.match(input.label, /입력 확인 실패/);
  assert.equal(input.chainReadComplete, false);
  assert.match(signature.label, /발급서명 불일치/);
  assert.equal(signature.chainReadComplete, false);
});

test('RPC running, success, and failure use request, response, and local failure states', () => {
  assert.equal(architectureMapState({ ...base, trace: [trace('record', 'running', 'ethereum')] }).focus, 'query');
  assert.equal(architectureMapState({ ...base, trace: [trace('record', 'success', 'ethereum')] }).focus, 'response');
  const failed = architectureMapState({ ...base, trace: [trace('record', 'failure', 'ethereum')] });
  assert.equal(failed.focus, 'third-party');
  assert.match(failed.label, /조회 실패/);
});

test('receipt event decoding and finality comparison remain local processing', () => {
  assert.equal(architectureMapState({ ...base, trace: [trace('registration-event', 'running', 'local')] }).focus, 'third-party');
  assert.equal(architectureMapState({ ...base, trace: [trace('finality', 'running', 'ethereum')] }).focus, 'third-party');
});

test('unavailable and pending results never mark a completed chain read', () => {
  const unavailable = architectureMapState({ ...base, busy: false, result: result({ status: 'unavailable', signatureValid: true }) });
  const pending = architectureMapState({ ...base, busy: false, result: result({ status: 'pending', signatureValid: true, finalizedBlock: '100' }) });
  assert.match(unavailable.label, /공개 조회 실패/);
  assert.equal(unavailable.chainReadComplete, false);
  assert.match(pending.label, /확정 대기/);
  assert.equal(pending.chainReadComplete, false);
});

test('only a validated chain record completes both read paths', () => {
  const match = architectureMapState({ ...base, busy: false, result: result({ status: 'match', chainRecordValid: true, fileMatch: true }) });
  const mismatch = architectureMapState({ ...base, busy: false, result: result({ status: 'file-mismatch', chainRecordValid: true, fileMatch: false }) });
  const dishonestMatch = architectureMapState({ ...base, busy: false, result: result({ status: 'match' }) });
  assert.equal(match.chainReadComplete, true);
  assert.equal(mismatch.chainReadComplete, true);
  assert.equal(dishonestMatch.chainReadComplete, false);
});
