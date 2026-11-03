// Synthetic receipt scenario shared by the UI and generated inspection PDFs.
export const receipt = {
  id: 'KP-2026-1028-0102',
  title: '해외 대금 수취 증빙',
  customer: '한빛정밀',
  invoice: 'DEMO-INV-1028',
  invoiceMinor: 2510000,
  receivedMinor: 2500000,
  receivedAt: '2026-10-28 15:00 KST',
  issuedAt: '2026-10-28 15:05 KST',
  counterparty: '해외 거래처 A사 (가상)',
  counterpartyCode: 'CP-07',
  wallet: '0xDEMO-HANBIT-RECEIPT-9b06',
  transaction: '0xDEMO-USDC-RECEIPT-f2c1',
  issuer: 'did:koda:issuer:koda-ops',
  block: '21,950,204',
  grantStart: '2026-11-03',
} as const;

export const amount = (minor: number) => (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const differenceMinor = receipt.invoiceMinor - receipt.receivedMinor;
export const differenceLabel = `${amount(differenceMinor)} USDC 부족 · 확인 필요`;
export type ReceiptView = 'issuer' | 'finance' | 'accounting' | 'auditor';
export function receiptFields(view: ReceiptView) {
  const full = view === 'issuer' || view === 'auditor';
  return [
    { label: '청구서 번호', value: receipt.invoice },
    { label: '수취 시각', value: receipt.receivedAt },
    { label: '거래처', value: full ? receipt.counterparty : view === 'finance' ? `거래처 코드 ${receipt.counterpartyCode}` : '가림', visibility: full ? 'full' : view === 'finance' ? 'partial' : 'hidden' },
    { label: '수취 지갑', value: full ? receipt.wallet : view === 'finance' ? '수출대금 수취 지갑 · …9b06' : '수출대금 수취 지갑 (주소 가림)', visibility: full ? 'full' : 'partial' },
    { label: '거래 식별자 (Tx)', value: full ? receipt.transaction : view === 'finance' ? '…f2c1' : '가림', visibility: full ? 'full' : view === 'finance' ? 'partial' : 'hidden' },
  ];
}

export const financeChecks = [
  '청구서 DEMO-INV-1028과 수취 증빙을 대조했어요',
  '100.00 USDC 부족을 확인했고, 원인은 확인이 필요해요',
  '차이와 확인 필요 상태를 회계팀에 함께 전달해요',
] as const;

export const receiptEntries = [
  ['type', '문서 유형', receipt.title],
  ['demo', '데이터', '교육용 가상 데이터 · 실제 수취 증명 아님'],
  ['document', '문서번호', receipt.id],
  ['customer', '법인명', `${receipt.customer} (가상 수출기업)`],
  ['invoice', '청구서 번호', receipt.invoice],
  ['invoice.source', '청구 정보 출처', '고객사 제공 청구 자료 (가상)'],
  ['invoice.amount', '청구 금액 (USDC)', (receipt.invoiceMinor / 100).toFixed(2)],
  ['received.amount', '수취 금액 (USDC)', (receipt.receivedMinor / 100).toFixed(2)],
  ['difference.amount', '청구 대비 부족액 (USDC)', (differenceMinor / 100).toFixed(2)],
  ['difference.status', '차이 확인 상태', '원인 확인 필요 · 수수료 또는 미수금으로 확정하지 않음'],
  ['receivedAt', '수취 시각', receipt.receivedAt],
  ['issuedAt', '발행 시각', receipt.issuedAt],
  ['issuer', '모의 서명자 DID', receipt.issuer],
  ['counterparty', '거래처', receipt.counterparty],
  ['counterparty.code', '거래처 코드', receipt.counterpartyCode],
  ['wallet', '수취 지갑 (가상 식별자)', receipt.wallet],
  ['transaction', '거래 식별자 (가상 Tx)', receipt.transaction],
].map(([field, label, value]) => ({ field: field!, label: label!, value: value! }));
