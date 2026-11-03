import { createSupportedPdf, fileSha256 } from '@koda/protocol';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { receiptEntries } from '../../apps/web/src/experience/receipt.js';

const directory = 'apps/web/public/receipt-files';
mkdirSync(directory, { recursive: true });
const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
const salt = 'koda_receipt_synthetic_fixture_20261028_000001'.slice(0, 43);
const changedEntries = receiptEntries.map(entry => ({ ...entry,
  value: entry.field === 'received.amount' ? '25100.00' : entry.field === 'difference.amount' ? '0.00' : entry.value,
}));
const original = createSupportedPdf(receiptEntries, font, salt, 'original');
const modified = createSupportedPdf(changedEntries, font, salt, 'modified');
const resaved = createSupportedPdf(receiptEntries, font, salt, 'resaved');
for (const [name, bytes] of [['original', original], ['modified', modified], ['resaved', resaved]] as const) {
  writeFileSync(`${directory}/${name}.pdf`, bytes);
}
writeFileSync(`${directory}/manifest.json`, JSON.stringify({
  hash: await fileSha256(original), changedHash: await fileSha256(modified), copyHash: await fileSha256(resaved), entries: receiptEntries,
}, null, 2));
console.log('Created synthetic receipt PDFs: original, altered amounts, and resaved.');
