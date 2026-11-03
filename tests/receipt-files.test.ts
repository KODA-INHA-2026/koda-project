import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileSha256, readSupportedPdf } from '@koda/protocol';
import { receiptEntries } from '../apps/web/src/experience/receipt.js';

const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
const read = (name: string) => readFileSync(`apps/web/public/receipt-files/${name}.pdf`);
test('receipt files distinguish a genuine shortage from altered receipt amounts and a resaved original', async () => {
  const manifest = JSON.parse(readFileSync('apps/web/public/receipt-files/manifest.json', 'utf8'));
  assert.deepEqual(manifest.entries, receiptEntries);
  for (const [name, hash] of [['original', manifest.hash], ['modified', manifest.changedHash], ['resaved', manifest.copyHash]]) {
    assert.equal(await fileSha256(read(name)), hash);
  }
  assert.equal(new Set([manifest.hash, manifest.changedHash, manifest.copyHash]).size, 3);
  assert.deepEqual(readSupportedPdf(read('original'), font, receiptEntries), receiptEntries);
  assert.deepEqual(readSupportedPdf(read('resaved'), font, receiptEntries), receiptEntries);
  const changed = readSupportedPdf(read('modified'), font, receiptEntries);
  assert.deepEqual(changed.flatMap((entry, i) => entry.value === receiptEntries[i]!.value ? [] : [[entry.field, receiptEntries[i]!.value, entry.value]]), [
    ['received.amount', '25000.00', '25100.00'],
    ['difference.amount', '100.00', '0.00'],
  ]);
  assert.throws(() => readSupportedPdf(Buffer.concat([read('original'), Buffer.from('\n%untrusted overlay')]), font, receiptEntries));
});

test('existing custody PDFs remain readable with the original header', () => {
  const directory = 'apps/web/public/proof-files';
  const { entries } = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
  assert.deepEqual(readSupportedPdf(readFileSync(`${directory}/original.pdf`), font, entries), entries);
});
