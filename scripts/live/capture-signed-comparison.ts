import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSignedComparisonFile, serializeSignedComparisonFile, verifySignedComparison } from '../../apps/web/src/live/signed-comparison';
import { recordedDeployment, recordedProof } from '../../apps/web/src/live/recorded-evidence';
import { inspectDeployment, publicClient } from '../../apps/web/src/live/wallet';
import type { VerificationTraceEvent } from '../../apps/web/src/live/verification';

const input = process.argv[2];
if (!input) throw new Error('승인 후 내려받은 재서명 비교정보 JSON 경로가 필요합니다.');
const candidate = parseSignedComparisonFile(await readFile(input, 'utf8'), recordedProof, recordedDeployment);
const bytes = new Uint8Array(await readFile('docs/portfolio/2026-11-06-sepolia/inha-20261106/inha-altered-120-btc.pdf'));
await inspectDeployment(recordedDeployment);
const trace: VerificationTraceEvent[] = [];
const result = await verifySignedComparison(bytes, candidate, recordedProof, recordedDeployment, publicClient, event => trace.push(event));
assert.equal(result.status, 'file-mismatch');
assert.equal(result.signatureValid, true);
assert.equal(result.chainRecordValid, true);
assert.equal(result.signedComparison?.signatureValid, true);
assert.equal(result.signedComparison?.fileMatch, true);
assert.equal(result.signedComparison?.registrationConflict, true);
assert.equal(result.chainHash, recordedProof.documentHash);
assert.equal(result.fileHash, candidate.documentHash);
const serialized = serializeSignedComparisonFile(candidate, recordedProof, recordedDeployment);
const folder = resolve('docs/portfolio/2026-11-07-signed-comparison');
await mkdir(folder, { recursive: true });
await writeFile(`${folder}/signed-comparison.json`, serialized);
await writeFile(`${folder}/verification.json`, JSON.stringify({ verifiedAt: new Date().toISOString(),
  network: 'Ethereum Sepolia', approval: 'User reported approving the comparison signature and downloading its JSON in this chat.',
  newTransaction: false, registeredProof: recordedProof, candidate, result, trace }, null, 2));
await writeFile('apps/web/src/live/recorded-signed-comparison.json', `${serialized}\n`);
console.log(JSON.stringify({ status: result.status, signature: result.signedComparison, chainHash: result.chainHash, finalizedBlock: result.finalizedBlock, newTransaction: false }, null, 2));
