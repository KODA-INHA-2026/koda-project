import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { renderCertificate } from '../../apps/web/src/live/certificate.ts';
import { sha256 } from '../../apps/web/src/live/verification.ts';
import { reproduceRecordedIssuance, recordedProof } from '../../apps/web/src/live/recorded-evidence.ts';

test('live certificate is deterministic, changed quantity changes the complete file hash', async () => {
  const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
  const id = `0x${'12'.repeat(32)}` as const;
  const issuedAt = String(Math.floor(new Date('2026-11-06T03:00:00Z').getTime() / 1000));
  const original = renderCertificate(font, id, issuedAt);
  const altered = renderCertificate(font, id, issuedAt, true);
  assert.equal(new TextDecoder().decode(original.slice(0,8)), '%PDF-1.7');
  assert.deepEqual(renderCertificate(font, id, issuedAt), original);
  assert.notEqual(await sha256(original), await sha256(altered));
  assert.ok(original.byteLength < 10 * 1024 * 1024);
  mkdirSync('tmp/pdfs/live', { recursive: true });
  writeFileSync('tmp/pdfs/live/original.pdf', original);
  writeFileSync('tmp/pdfs/live/altered.pdf', altered);
});

test('historical replay preserves the registered PDF while the next customer changes', async () => {
  const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
  const historical = reproduceRecordedIssuance(font);
  assert.equal(await sha256(historical.original), recordedProof.documentHash);
  assert.notEqual(await sha256(historical.altered), recordedProof.documentHash);
  const next = renderCertificate(font, recordedProof.documentId, recordedProof.issuedAt);
  assert.notEqual(await sha256(next), recordedProof.documentHash);
  assert.equal(historical.customer, '한울테크홀딩스㈜');
});
