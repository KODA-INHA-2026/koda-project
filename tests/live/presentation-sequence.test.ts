import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, chapterForStep, chapterForTrace, isVerificationChapter } from '../../apps/web/src/live/presentation-sequence.ts';
import type { VerificationTraceEvent } from '../../apps/web/src/live/verification.ts';
const event = (id: VerificationTraceEvent['id'], state: VerificationTraceEvent['state'] = 'running'): VerificationTraceEvent => ({ id, state, operation: id, location: 'local' });

test('three evidence preparation chapters precede four persistent verifier chapters', () => {
  assert.equal(CHAPTERS.length, 7);
  assert.ok(CHAPTERS.slice(0, 3).every(item => !isVerificationChapter(item.id)));
  assert.ok(CHAPTERS.slice(3).every(item => isVerificationChapter(item.id)));
});
test('verification follows actual work, including early failures, without jumping ahead to comparison', () => {
  assert.equal(chapterForTrace([]), 'receive');
  assert.equal(chapterForTrace([event('deployment-validation', 'failure')]), 'receive');
  assert.equal(chapterForTrace([event('sha256', 'failure')]), 'inspect');
  assert.equal(chapterForTrace([event('signature', 'success'), event('receipt')]), 'lookup');
  assert.equal(chapterForTrace([event('finality', 'failure')]), 'lookup');
  assert.equal(chapterForTrace([event('record', 'success'), event('hash-comparison', 'failure')]), 'compare');
  assert.deepEqual(['deployment','hash','signature','chain','comparison'].map(chapterForStep), ['receive','inspect','inspect','lookup','compare']);
});
