import { createDisplayPdf, type PdfEntry } from '../../../../packages/protocol/src/pdf.js';
import type { Hex } from 'viem';

export const CUSTOMER = '인하테크홀딩스㈜';
export const AS_OF = '2026-10-31 23:59:59 KST';
export async function createCertificate(documentId: Hex, issuedAt: string, altered = false) {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/PretendardVariable.ttf`);
  if (!response.ok) throw new Error('PDF용 한글 글꼴을 불러오지 못했습니다.');
  return renderCertificate(new Uint8Array(await response.arrayBuffer()), documentId, issuedAt, altered);
}
export function renderCertificate(font: Uint8Array, documentId: Hex, issuedAt: string, altered = false, customer = CUSTOMER) {
  const entries: PdfEntry[] = [
    { field: 'demo', label: '구분', value: '가상 법인·가상 잔고 / 실제 KODA 공식 증명서 아님' },
    { field: 'customer', label: '법인', value: `${customer} (가상 DAT 법인)` },
    { field: 'scope', label: '잔고 범위', value: '해당 법인의 KODA 수탁 BTC 전체 잔고 (가상)' },
    { field: 'asset', label: '자산', value: 'Bitcoin 네트워크의 네이티브 BTC / 랩드 BTC 아님' },
    { field: 'quantity', label: '수탁 잔고', value: altered ? '120.00000000 BTC' : '100.00000000 BTC' },
    { field: 'asof', label: '잔고 기준시점', value: AS_OF },
    { field: 'issued', label: '발급 기재시각 UTC', value: new Date(Number(issuedAt) * 1000).toISOString() },
    { field: 'id', label: '문서 ID', value: documentId },
    { field: 'issuer', label: '발급 역할', value: 'KODA의 발급 역할을 모사한 시험 발급자' },
  ];
  return createDisplayPdf(entries, font, documentId.slice(2,45), {
    title: 'BTC 잔고 증명서 | 가상 사례', note: '문서 원본 검증 실증용 / 등록·확정 여부는 별도 조회',
  });
}
