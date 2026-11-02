import { createSupportedPdf, fileSha256, type PdfEntry } from '@koda/protocol';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const directory = 'apps/web/public/proof-files';
mkdirSync(directory, { recursive: true });
const font = readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
const entries: PdfEntry[] = [
  ['demo', '데이터', '교육용 가상 데이터 · 실제 잔고 증명 아님'],
  ['document', '문서번호', 'KP-2026-0930-0417'],
  ['customer', '법인명', '㈜가온테크 (가상 상장법인)'],
  ['date', '잔고 기준일', '2026-09-30 23:59:59 KST'],
  ['issued', '발행 시각', '2026-10-01 10:02:19 KST'],
  ['issuer', '모의 서명자 DID', 'did:koda:issuer:koda-ops'],
  ['wallet', 'BTC 보관 지갑 (가상·체크섬 무효)', 'bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz'],
  ['counterparty', '거래 상대방', 'OTC 거래상대 A사, B사 (가상)'],
  ['btc.quantity', 'BTC 수량', '12.4500'],
  ['btc.valuation', 'BTC 평가액 (KRW)', '1942110000'],
  ['eth.quantity', 'ETH 수량', '310.2000'],
  ['eth.valuation', 'ETH 평가액 (KRW)', '1563408000'],
  ['usdc.quantity', 'USDC 수량', '1250000.00'],
  ['usdc.valuation', 'USDC 평가액 (KRW)', '1736250000'],
  ['price', '기준가 시점·출처', '2026-09-30 23:59 KST · 시연용 가상 기준가'],
  ['count', '3분기 거래', '12건'],
].map(([field, label, value]) => ({ field: field!, label: label!, value: value! }));
const transactions = [
 ['07-14', 'A사', '+2.0000 BTC', '4f1a…a21c'], ['08-02', 'B사', '−80.00 ETH', '0x9b…07de'],
 ['08-29', 'A사', '+500,000 USDC', '0x12…e9f0'], ['09-17', 'B사', '+0.4500 BTC', '77c0…3b51'],
 ['07-03', 'A사', '+1.0000 BTC', '2ab1…a001'], ['07-21', 'B사', '+50.00 ETH', '0x41…0012'],
 ['08-05', 'A사', '−0.5000 BTC', 'bc21…a003'], ['08-14', 'B사', '+200,000 USDC', '0x51…0014'],
 ['08-20', 'A사', '+0.2500 BTC', 'cd31…a005'], ['09-02', 'B사', '+40.20 ETH', '0x61…0016'],
 ['09-11', 'A사', '−100,000 USDC', '0x71…0017'], ['09-28', 'B사', '+0.2500 BTC', 'ef41…a008'],
];
transactions.forEach((row, i) => entries.push({ field: `tx.${i}`, label: `가상 거래 ${i+1}`, value: row.join(' · ') }));
// Fixed synthetic fixture salt; no signing keys or live account material.
const salt = 'koda_demo_v03_synthetic_fixture_salt_00000001'.padEnd(43, '0').slice(0, 43);
const original = createSupportedPdf(entries, font, salt, 'original');
const changedEntries = entries.map(e => ({ ...e, value: e.field === 'btc.quantity' ? '15.4500' : e.field === 'btc.valuation' ? '2410088000' : e.value }));
const changed = createSupportedPdf(changedEntries, font, salt, 'modified');
const copy = createSupportedPdf(entries, font, salt, 'resaved');
for (const [name, data] of [['original', original], ['modified', changed], ['resaved', copy]] as const) writeFileSync(`${directory}/${name}.pdf`, data);
writeFileSync(`${directory}/manifest.json`, JSON.stringify({ hash: await fileSha256(original), changedHash: await fileSha256(changed), copyHash: await fileSha256(copy), entries }, null, 2));
console.log('Created original, modified, and re-saved synthetic PDFs.');
