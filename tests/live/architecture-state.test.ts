import { test } from 'node:test';
import assert from 'node:assert/strict';
import { architectureMapState, type ArchitectureStateInput } from '../../apps/web/src/live/architecture-state.ts';
import type { VerificationResult, VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';

const base: ArchitectureStateInput = { scene: 'lookup', busy: true };
const trace = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state'], location: VerificationTraceEvent['location']): VerificationTraceEvent => ({ id, state, location, operation: id });
const result = (overrides: Partial<VerificationResult>): VerificationResult => ({ status: 'invalid', message: 'test', ...overrides });

test('input and signature failures stop locally without claiming a chain read', () => {
  const input = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'invalid' }) });
  const signature = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'signature-mismatch', signatureValid: false }) });
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
  const unavailable = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'unavailable', signatureValid: true }) });
  const pending = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'pending', signatureValid: true, finalizedBlock: '100', receiptBlockNumber: '101' }) });
  assert.match(unavailable.label, /검증정보 확인 실패/);
  assert.equal(unavailable.chainReadComplete, false);
  assert.match(pending.label, /확정 대기/);
  assert.equal(pending.chainReadComplete, false);
});

test('unavailable results describe the actual local, deployment, or RPC failure', () => {
  const local = architectureMapState({
    ...base,
    scene: 'compare',
    busy: false,
    trace: [trace('sha256', 'failure', 'local')],
    result: result({ status: 'unavailable', message: 'PDF 해시를 계산할 수 없습니다.' }),
  });
  const deployment = architectureMapState({
    ...base,
    scene: 'compare',
    busy: false,
    trace: [trace('deployment-validation', 'failure', 'ethereum')],
    result: result({ status: 'unavailable', message: '배포 신뢰 기준을 확인할 수 없습니다.' }),
  });
  const rpc = architectureMapState({
    ...base,
    scene: 'compare',
    busy: false,
    trace: [trace('record', 'failure', 'ethereum')],
    result: result({ status: 'unavailable', message: '확정된 기록을 조회할 수 없습니다.' }),
  });

  assert.match(local.label, /PDF 해시 계산 실패/);
  assert.equal(local.detail, 'PDF 해시를 계산할 수 없습니다.');
  assert.match(deployment.label, /컨트랙트 확인 실패/);
  assert.equal(deployment.detail, '배포 신뢰 기준을 확인할 수 없습니다.');
  assert.match(rpc.label, /공개 조회 실패/);
  assert.equal(rpc.detail, '확정된 기록을 조회할 수 없습니다.');
  for (const actual of [local, deployment, rpc]) {
    assert.equal(actual.focus, 'third-party');
    assert.equal(actual.chainReadComplete, false);
  }
});

test('only a validated chain record completes both read paths', () => {
  const match = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'match', chainRecordValid: true, fileMatch: true }) });
  const mismatch = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'file-mismatch', chainRecordValid: true, fileMatch: false }) });
  const dishonestMatch = architectureMapState({ ...base, scene: 'compare', busy: false, result: result({ status: 'match' }) });
  assert.equal(match.chainReadComplete, true);
  assert.equal(mismatch.chainReadComplete, true);
  assert.equal(dishonestMatch.chainReadComplete, false);
});

test('seven scenes map to the agreed issuer and verifier groups', () => {
  assert.equal(architectureMapState({ scene: 'custody', busy: false }).focus, 'koda');
  assert.equal(architectureMapState({ scene: 'prepare', busy: false }).focus, 'koda');
  assert.equal(architectureMapState({ scene: 'register', busy: false }).focus, 'write');
  assert.equal(architectureMapState({ scene: 'receive', busy: false }).focus, 'handoff');
  assert.equal(architectureMapState({ scene: 'inspect', busy: false }).focus, 'third-party');
  assert.equal(architectureMapState({ scene: 'lookup', busy: false }).focus, 'query');
  assert.equal(architectureMapState({ scene: 'compare', busy: false }).focus, 'third-party');
});

test('only compare presents a final result while busy verification follows the actual trace', () => {
  const finalResult = result({ status: 'match', chainRecordValid: true, fileMatch: true });
  const lookup = architectureMapState({ scene: 'lookup', busy: false, result: finalResult });
  const compare = architectureMapState({ scene: 'compare', busy: false, result: finalResult });
  const busyInspect = architectureMapState({ scene: 'inspect', busy: true, trace: [trace('record', 'running', 'ethereum')], result: finalResult });

  assert.equal(lookup.focus, 'query');
  assert.equal(compare.chainReadComplete, true);
  assert.equal(busyInspect.focus, 'query');
  assert.match(busyInspect.detail, /문서 검증기록 조회/);
});

test('manual inspect and lookup use their own trace phase while busy receive follows deployment validation', () => {
  const successfulTrace: VerificationTraceEvent[] = [
    trace('input', 'success', 'local'),
    trace('sha256', 'success', 'local'),
    trace('signature', 'success', 'local'),
    trace('deployment-validation', 'success', 'ethereum'),
    trace('chain-id', 'success', 'ethereum'),
    trace('finalized-block', 'success', 'ethereum'),
    trace('transaction-input', 'success', 'ethereum'),
    trace('receipt', 'success', 'ethereum'),
    trace('canonical-block', 'success', 'ethereum'),
    trace('registration-event', 'success', 'local'),
    trace('finality', 'success', 'local'),
    trace('authorized-issuer', 'success', 'ethereum'),
    trace('record', 'success', 'ethereum'),
    trace('hash-comparison', 'success', 'local'),
  ];
  const finalResult = result({ status: 'match', chainRecordValid: true, fileMatch: true });
  const inspect = architectureMapState({ scene: 'inspect', busy: false, trace: successfulTrace, result: finalResult });
  const lookup = architectureMapState({ scene: 'lookup', busy: false, trace: successfulTrace, result: finalResult });
  const receive = architectureMapState({
    scene: 'receive',
    busy: true,
    trace: [trace('deployment-validation', 'running', 'ethereum')],
    result: finalResult,
  });

  assert.equal(inspect.focus, 'third-party');
  assert.match(inspect.detail, /발급서명 복구/);
  assert.equal(lookup.focus, 'response');
  assert.match(lookup.detail, /문서 검증기록 조회 응답/);
  assert.equal(receive.focus, 'query');
  assert.match(receive.detail, /컨트랙트 코드·발급자 확인/);
});

test('manual lookup keeps pending and local chain checks from looking like a successful RPC response', () => {
  const pending = architectureMapState({
    scene: 'lookup',
    busy: false,
    trace: [
      trace('finalized-block', 'success', 'ethereum'),
      trace('finality', 'failure', 'local'),
    ],
    result: result({ status: 'pending', signatureValid: true, finalizedBlock: '100', receiptBlockNumber: '101' }),
  });
  const eventFailure = architectureMapState({
    scene: 'lookup',
    busy: false,
    trace: [
      trace('canonical-block', 'success', 'ethereum'),
      trace('registration-event', 'failure', 'local'),
    ],
    result: result({ status: 'invalid', signatureValid: true }),
  });

  assert.equal(pending.focus, 'third-party');
  assert.match(pending.label, /확정 대기/);
  assert.equal(eventFailure.focus, 'third-party');
  assert.match(eventFailure.label, /로컬 검사 실패/);
  assert.match(eventFailure.detail, /등록 이벤트 대조 실패/);
});
