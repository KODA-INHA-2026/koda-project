import { isAddress, type Address, type Hex } from 'viem';
import type { Proof, TrustedDeployment } from './verification';

export const VERIFICATION_FILE_FORMAT = 'koda-document-verification/v1';
export const PDF_LIMIT = 10 * 1024 * 1024;
export const VERIFICATION_LIMIT = 64 * 1024;
type VerificationFile = {
  format: typeof VERIFICATION_FILE_FORMAT;
  chain: { chainId: number; contract: Address };
  proof: Proof;
};
export type ReceivedPdf = { name: string; bytes: Uint8Array };
export type ReceivedProof = { name: string; proof: Proof; deployment: TrustedDeployment };

export function serializeVerificationFile(proof: Proof, deployment: TrustedDeployment): string {
  if (!hex(proof.transactionHash, 32) || /^0x0+$/.test(proof.transactionHash)) throw new Error('등록 거래가 확인된 검증정보만 전달할 수 있습니다.');
  const value: VerificationFile = {
    format: VERIFICATION_FILE_FORMAT,
    chain: { chainId: deployment.chainId, contract: deployment.contract },
    proof: { documentId: proof.documentId, documentHash: proof.documentHash, issuedAt: proof.issuedAt,
      signature: proof.signature, ...(proof.transactionHash ? { transactionHash: proof.transactionHash } : {}) },
  };
  return JSON.stringify(value, null, 2);
}

function object(value: unknown, allowed: string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key));
}
function hex(value: unknown, bytes: number): value is Hex {
  return typeof value === 'string' && new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}

export function parseVerificationFile(text: string, knownDeployments: TrustedDeployment[]): Omit<ReceivedProof, 'name'> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('검증정보 JSON을 읽지 못했습니다. 발급받은 파일을 다시 선택해 주세요.'); }
  if (!object(value, ['format', 'chain', 'proof']) || value.format !== VERIFICATION_FILE_FORMAT
    || !object(value.chain, ['chainId', 'contract']) || value.chain.chainId !== 11155111
    || typeof value.chain.contract !== 'string' || !isAddress(value.chain.contract)
    || !object(value.proof, ['documentId', 'documentHash', 'issuedAt', 'signature', 'transactionHash'])) {
    throw new Error('이 데모가 지원하는 검증정보 파일이 아닙니다. PDF와 함께 받은 JSON을 선택해 주세요.');
  }
  const proof = value.proof;
  if (!hex(proof.documentId, 32) || /^0x0+$/.test(proof.documentId)
    || !hex(proof.documentHash, 32) || /^0x0+$/.test(proof.documentHash)
    || !hex(proof.signature, 65) || typeof proof.issuedAt !== 'string'
    || !/^[1-9][0-9]{0,19}$/.test(proof.issuedAt) || BigInt(proof.issuedAt) > (1n << 64n) - 1n
    || !hex(proof.transactionHash, 32) || /^0x0+$/.test(proof.transactionHash)) {
    throw new Error('검증정보의 문서 ID·해시·서명·발급시각 형식을 확인해 주세요.');
  }
  // An attached file locates a record; it must never appoint its own trusted issuer or RPC.
  const { contract, chainId } = value.chain;
  const deployment = knownDeployments.find(item => item.chainId === chainId
    && item.contract.toLowerCase() === contract.toLowerCase());
  if (!deployment) throw new Error('사전에 확인한 발급 계약의 검증정보가 아닙니다. 제출 파일의 주소를 새 신뢰 기준으로 사용하지 않습니다.');
  return { proof: { documentId: proof.documentId, documentHash: proof.documentHash, issuedAt: proof.issuedAt,
    signature: proof.signature, transactionHash: proof.transactionHash }, deployment };
}

export async function readReceivedFiles(files: File[], knownDeployments: TrustedDeployment[]) {
  if (!files.length || files.length > 2) throw new Error('증명서 PDF와 검증정보 JSON을 각각 한 개씩 선택해 주세요.');
  const pdfs = files.filter(file => /\.pdf$/i.test(file.name));
  const proofs = files.filter(file => /\.json$/i.test(file.name));
  if (pdfs.length > 1 || proofs.length > 1 || pdfs.length + proofs.length !== files.length) {
    throw new Error('증명서 PDF와 검증정보 JSON만 각각 한 개씩 선택해 주세요.');
  }
  if (pdfs.some(file => file.size > PDF_LIMIT)) throw new Error('10 MiB 이하의 PDF를 선택해 주세요.');
  if (proofs.some(file => file.size > VERIFICATION_LIMIT)) throw new Error('64 KiB 이하의 검증정보 JSON을 선택해 주세요.');
  let pdf: ReceivedPdf | undefined, verification: ReceivedProof | undefined;
  if (pdfs[0]) {
    const bytes = new Uint8Array(await pdfs[0].arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('선택한 파일이 PDF 형식이 아닙니다.');
    pdf = { name: pdfs[0].name, bytes };
  }
  if (proofs[0]) verification = { name: proofs[0].name, ...parseVerificationFile(await proofs[0].text(), knownDeployments) };
  return { pdf, verification };
}
