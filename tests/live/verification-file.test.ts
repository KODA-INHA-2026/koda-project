import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordedDeployment, recordedProof } from '../../apps/web/src/live/recorded-evidence.ts';
import { parseVerificationFile, readReceivedFiles, serializeVerificationFile, PDF_LIMIT, VERIFICATION_LIMIT } from '../../apps/web/src/live/verification-file.ts';

const encoded = serializeVerificationFile(recordedProof, recordedDeployment);
const anchors = [recordedDeployment];
test('handoff preserves signed fields and uses the independently configured deployment', () => {
  const received = parseVerificationFile(encoded, anchors);
  assert.deepEqual(received.proof, recordedProof);
  assert.equal(received.deployment, recordedDeployment);
  assert.doesNotMatch(encoded, /issuer|privateKey|rpc|customer|original/);
});
test('a submitted JSON cannot redirect the registry, issuer, chain or RPC', () => {
  const mutate = (change: (value: any) => void) => { const v = JSON.parse(encoded); change(v); return JSON.stringify(v); };
  for (const changed of [
    mutate(v => { v.chain.contract = `0x${'12'.repeat(20)}`; }),
    mutate(v => { v.chain.chainId = 1; }),
    mutate(v => { v.chain.issuer = recordedDeployment.issuer; }),
    mutate(v => { v.rpc = 'https://attacker.invalid'; }),
    mutate(v => { v.format = 'other'; }),
  ]) assert.throws(() => parseVerificationFile(changed, anchors));
  assert.throws(() => parseVerificationFile(encoded, []), /사전에 확인/);
});
test('malformed fields are rejected before signature or chain verification', () => {
  for (const [field, value] of [['issuedAt', '-1'], ['issuedAt', '18446744073709551616'], ['documentId', `0x${'00'.repeat(32)}`], ['signature', '0x1234']]) {
    const altered = JSON.parse(encoded); altered.proof[field] = value;
    assert.throws(() => parseVerificationFile(JSON.stringify(altered), anchors));
  }
  assert.throws(() => parseVerificationFile('{', anchors));
});
test('handoff cannot omit the registration transaction to downgrade verification', () => {
  for (const transactionHash of [undefined, `0x${'00'.repeat(32)}`, '0x1234']) {
    const value = JSON.parse(encoded); value.proof.transactionHash = transactionHash;
    assert.throws(() => parseVerificationFile(JSON.stringify(value), anchors));
    assert.throws(() => serializeVerificationFile(value.proof, recordedDeployment));
  }
});
test('receiver accepts actual files in either order and can load one missing file later', async () => {
  const pdf = new File(['%PDF-1.7\nfixture'], 'received.pdf');
  const json = new File([encoded], 'received.json');
  const pair = await readReceivedFiles([json, pdf], anchors);
  assert.equal(pair.pdf?.name, 'received.pdf');
  assert.deepEqual(pair.verification?.proof, recordedProof);
  assert.equal((await readReceivedFiles([pdf], anchors)).verification, undefined);
  assert.equal((await readReceivedFiles([json], anchors)).pdf, undefined);
});
test('duplicate, oversized and malformed files do not produce a partially accepted pair', async () => {
  const pdf = new File(['%PDF-1.7\nfixture'], 'one.pdf');
  const invalidJson = new File(['{}'], 'proof.json');
  for (const files of [
    [pdf, new File(['%PDF-1.7'], 'two.pdf')], [new File(['x'], 'data.txt')],
    [new File(['not a pdf'], 'bad.pdf')], [pdf, invalidJson],
    [new File([new Uint8Array(PDF_LIMIT + 1)], 'large.pdf')],
    [new File([new Uint8Array(VERIFICATION_LIMIT + 1)], 'large.json')],
  ]) await assert.rejects(readReceivedFiles(files, anchors));
});
