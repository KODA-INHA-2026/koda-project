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

test('default replay reproduces the finalized Inha registration and preserves the historical Hanul bytes', async () => {
  const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
  const current = reproduceRecordedIssuance(font);
  assert.equal(await sha256(current.original), recordedProof.documentHash);
  assert.deepEqual(current.original, new Uint8Array(readFileSync('docs/portfolio/2026-11-06-sepolia/inha-20261106/inha-original.pdf')));
  assert.notEqual(await sha256(current.altered), recordedProof.documentHash);
  assert.equal(current.customer, '인하테크홀딩스㈜');

  const historical = {
    documentId: `0x603157e939369a0a8b69499c6849e26ea0938b394a099130c9fb71e7303af32a` as const,
    documentHash: `0x4ffadf441fe587839f805dd70cc5836b465b449d1b7836f890716628dd2c2842` as const,
    issuedAt: '1793904567',
  };
  const historicalPdf = renderCertificate(font, historical.documentId, historical.issuedAt, false, '한울테크홀딩스㈜');
  assert.equal(await sha256(historicalPdf), historical.documentHash);
  assert.deepEqual(historicalPdf, new Uint8Array(readFileSync('docs/portfolio/2026-11-06-sepolia/pdf/registered-original.pdf')));
});
