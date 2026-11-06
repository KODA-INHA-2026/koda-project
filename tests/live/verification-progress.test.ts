import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificationProgress } from '../../apps/web/src/live/verification-progress.ts';
import type { VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';
const event = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state']): VerificationTraceEvent => ({ id, state, location: 'local', operation: id });

test('presentation does not mark a grouped chain step complete after an intermediate RPC', () => {
  const rows = verificationProgress([event('chain-id', 'success'), event('finalized-block', 'running')], true);
  assert.equal(rows[3]!.state, 'running');
  assert.equal(rows[4]!.state, 'idle');
  assert.equal(verificationProgress([event('chain-id', 'success')], false)[3]!.state, 'stopped');
});
test('a failed deployment stops before presenting local or chain verification as complete', () => {
  const rows = verificationProgress([event('deployment-validation', 'failure')], false, { status: 'unavailable', message: 'test' });
  assert.equal(rows[0]!.state, 'failure');
  assert.ok(rows.slice(1).every(row => row.state === 'idle'));
});
test('pending finality and completed file mismatch remain distinct from a request failure', () => {
  assert.equal(verificationProgress([event('finality', 'failure')], false, { status: 'pending', message: 'test' })[3]!.state, 'pending');
  const mismatch = verificationProgress([event('signature', 'success'), event('record', 'success'), event('hash-comparison', 'failure')], false, { status: 'file-mismatch', message: 'test' });
  assert.equal(mismatch[2]!.state, 'success');
  assert.equal(mismatch[3]!.state, 'success');
  assert.equal(mismatch[4]!.state, 'mismatch');
  assert.equal(verificationProgress([event('record', 'failure')], false, { status: 'unavailable', message: 'test' })[3]!.state, 'failure');
});
