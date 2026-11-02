import { assets, transactions, WALLET, PRICE_BASIS, CUSTODY_TYPE, levelOf, type Viewer } from './data';
import { ISSUER } from '../proof/model';

/*
 * 항목별 지문(선택적 공개) 시제품.
 * 발행할 때 항목마다 솔트를 붙여 지문을 만들고, 그 지문들을 순서대로 묶은 값(항목 지문 묶음)을 기록해 둔다.
 * 열람본에는 보이는 칸의 값과 솔트, 가린 칸의 지문만 담는다. 받은 사람은 가린 값을 몰라도
 * 같은 묶음 지문을 다시 계산할 수 있어, 열람본이 그 원본에서 나왔는지 확인할 수 있다.
 * 시연에서는 솔트를 항목 이름으로 정해 두었다. 그래서 코드를 아는 사람은 가린 날짜나 거래처처럼 후보가 적은 값을 대입해 맞힐 수 있다.
 * 실제로는 항목마다 무작위 32바이트를 쓰고 KODA만 보관하며, 보이는 칸의 솔트만 건넨다.
 */
/** 모의 발행 기록에 남긴 항목 지문 묶음. 발행 데이터가 바뀌면 이 값과 달라져 검증이 실패한다(테스트로 고정). */
export const RECORDED_FIELD_ROOT = 'e9acebc95f0a70cd0582d6e0879fec6fb5666f70640c454cf5645a01065c5a93';
const DOMAIN = 'KODA-FIELD-DISCLOSURE-DEMO-v1';
type Field = { field: string; group: string; value: string };
export type Disclosed = { field: string; value: string; salt: string };
export type Withheld = { field: string; digest: string };
export type ViewPackage = { viewer: Viewer; disclosed: Disclosed[]; withheld: Withheld[] };

export const fields: Field[] = [
  { field: 'customer', group: 'basic', value: '㈜가온테크' },
  { field: 'document', group: 'basic', value: 'KP-2026-0930-0417' },
  { field: 'asOf', group: 'basic', value: '2026-09-30 23:59:59 KST' },
  ...assets.flatMap(a => [
    { field: `asset.${a.code}.quantity`, group: 'assets', value: a.amount },
    { field: `asset.${a.code}.valuation`, group: 'assets', value: a.value },
  ]),
  { field: 'price', group: 'price', value: PRICE_BASIS },
  { field: 'custody', group: 'custody', value: CUSTODY_TYPE },
  { field: 'wallet.BTC', group: 'wallet', value: WALLET },
  ...transactions.flatMap(([date, party, amount, ref], i) => [
    { field: `tx.${i + 1}.date`, group: 'movement', value: date },
    { field: `tx.${i + 1}.amount`, group: 'movement', value: amount },
    { field: `tx.${i + 1}.counterparty`, group: 'counterparty', value: party },
    { field: `tx.${i + 1}.ref`, group: 'txref', value: ref },
  ]),
  { field: 'issuer', group: 'proof', value: ISSUER },
];

const encoder = new TextEncoder();
async function hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
const saltOf = (field: string) => hex(`${DOMAIN}|salt|${field}`);
const leaf = (field: string, value: string, salt: string) => hex(`${DOMAIN}|${salt}|${field}|${value}`);
const bundle = (digests: string[]) => hex(`${DOMAIN}|bundle|${digests.join('|')}`);

/** 발행 시점: 모든 항목으로 묶음 지문을 만든다(KODA 쪽 처리, 시연에서는 브라우저에서 계산). */
export async function issueFieldRoot() {
  return bundle(await Promise.all(fields.map(async f => leaf(f.field, f.value, await saltOf(f.field)))));
}
/** KODA 서버가 역할에 맞춰 만들어 보내는 열람본 꾸러미. 전체 공개 칸만 값과 솔트를 담는다. */
export async function viewPackage(viewer: Viewer, tamper = false): Promise<ViewPackage> {
  const disclosed: Disclosed[] = []; const withheld: Withheld[] = [];
  for (const f of fields) {
    const salt = await saltOf(f.field);
    // tamper: 시연용으로 받은 열람본의 BTC 수량 하나를 바꿔 검증이 실패하는지 보여 준다.
    if (levelOf(viewer, f.group) === 'full') disclosed.push({ field: f.field, value: tamper && f.field === 'asset.BTC.quantity' ? '15.4500' : f.value, salt });
    else withheld.push({ field: f.field, digest: await leaf(f.field, f.value, salt) });
  }
  return { viewer, disclosed, withheld };
}
/** 받는 쪽 검증: 가린 값 없이 묶음 지문을 다시 계산한다. 항목 순서는 공개된 형식(fields 순서)을 따른다. */
export async function verifyPackage(pkg: ViewPackage, recordedRoot = RECORDED_FIELD_ROOT) {
  const shown = new Map(pkg.disclosed.map(d => [d.field, d])); const hidden = new Map(pkg.withheld.map(w => [w.field, w.digest]));
  const digests = await Promise.all(fields.map(async ({ field }) => {
    const d = shown.get(field); if (d) return leaf(field, d.value, d.salt);
    const w = hidden.get(field); if (w) return w;
    throw new Error('열람본에 빠진 항목이 있어요: ' + field);
  }));
  const root = await bundle(digests);
  return { ok: root === recordedRoot, root, shown: pkg.disclosed.length, hidden: pkg.withheld.length };
}
