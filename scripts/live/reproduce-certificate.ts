import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { renderCertificate } from '../../apps/web/src/live/certificate.js';
import { sha256 } from '../../apps/web/src/live/verification.js';

const directory = 'docs/portfolio/2026-11-06-sepolia';
const capture = JSON.parse(readFileSync(`${directory}/registration-2026-11-05T19-11-08-440Z.json`, 'utf8'));
const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
const original = renderCertificate(font, capture.proof.documentId, capture.proof.issuedAt, false, '한울테크홀딩스㈜');
const altered = renderCertificate(font, capture.proof.documentId, capture.proof.issuedAt, true, '한울테크홀딩스㈜');
const originalHash = await sha256(original);
assert.equal(originalHash, capture.proof.documentHash, 'Reproduced bytes do not match the actually registered PDF; do not claim original preservation.');
mkdirSync(`${directory}/pdf`, { recursive: true });
writeFileSync(`${directory}/pdf/registered-original.pdf`, original);
writeFileSync(`${directory}/pdf/altered-120-btc.pdf`, altered);
const evidence = {
  createdAtUtc: new Date().toISOString(),
  method: 'Deterministic reproduction of the historical Hanul registration from the pinned evidence file and the demo PDF generator, not a downloaded browser file.',
  registrationTransaction: capture.registrationTransaction,
  originalSha256: originalHash, registeredSha256: capture.proof.documentHash,
  exactRegisteredHashMatch: true, alteredSha256: await sha256(altered),
  customer: '한울테크홀딩스㈜ (historical registered fixture)',
};
writeFileSync(`${directory}/pdf/reproduction.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
