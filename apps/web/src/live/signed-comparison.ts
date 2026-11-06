import { getAddress, isAddress, recoverTypedDataAddress, type Address, type Hex } from 'viem';
import { documentDomain, documentTypes } from '../../../../packages/chain/src/document-registry.js';
import {
  sha256,
  verifyDocument,
  type DocumentProof,
  type Proof,
  type TrustedDeployment,
  type VerificationClient,
  type VerificationResult,
  type VerificationTraceCallback,
  type VerificationTraceEvent,
} from './verification';

export const SIGNED_COMPARISON_FILE_FORMAT = 'koda-signed-comparison-v1';
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const UINT64_MAX = (1n << 64n) - 1n;

export type SignedComparison = {
  signatureValid: boolean;
  fileMatch: boolean;
  signedHash: Hex;
  recoveredAddress?: Address;
  registrationConflict: boolean;
};

export type SignedComparisonResult = VerificationResult & { signedComparison?: SignedComparison };

type SignedComparisonFile = {
  format: typeof SIGNED_COMPARISON_FILE_FORMAT;
  chain: { chainId: number; contract: Address; issuer: Address };
  reference: { transactionHash: Hex };
  candidate: Omit<DocumentProof, 'transactionHash'>;
};

function emit(callback: VerificationTraceCallback | undefined, event: VerificationTraceEvent) {
  try { callback?.(event); } catch { /* Observability must never change verification. */ }
}

function object(value: unknown, allowed: string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key));
}

function hex(value: unknown, bytes: number): value is Hex {
  return typeof value === 'string' && new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}

function nonZeroHex(value: unknown, bytes: number): value is Hex {
  return hex(value, bytes) && !/^0x0+$/i.test(value);
}

function sameHex(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function sameAddress(left: string, right: string) {
  return isAddress(left) && isAddress(right) && getAddress(left) === getAddress(right);
}

function issuedAt(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= UINT64_MAX ? parsed : null;
}

function malformed(message: string, candidate?: DocumentProof): SignedComparisonResult {
  return {
    status: 'invalid',
    message,
    ...(candidate && nonZeroHex(candidate.documentHash, 32) ? {
      signedHash: candidate.documentHash,
      signedComparison: { signatureValid: false, fileMatch: false, signedHash: candidate.documentHash, registrationConflict: false },
    } : {}),
  };
}

function validateCandidate(bytes: Uint8Array, candidate: DocumentProof, registeredProof: Proof, trusted: TrustedDeployment) {
  if (bytes.byteLength > MAX_PDF_BYTES || bytes.byteLength < 5
    || new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-') return '비교할 파일은 10 MiB 이하의 PDF여야 합니다.';
  if (candidate.transactionHash !== undefined) return '비교용 서명정보에는 등록 거래를 포함하지 않습니다.';
  if (!nonZeroHex(candidate.documentId, 32) || !sameHex(candidate.documentId, registeredProof.documentId)) {
    return '비교용 서명정보의 문서 ID가 등록 원본과 다릅니다.';
  }
  if (!nonZeroHex(candidate.documentHash, 32) || !hex(candidate.signature, 65) || !issuedAt(candidate.issuedAt)) {
    return '비교용 서명정보의 해시·서명·발급시각 형식을 확인해 주세요.';
  }
  if (!nonZeroHex(registeredProof.transactionHash, 32)) return '확인된 등록 거래가 있는 원본만 비교 기준으로 사용할 수 있습니다.';
  if (trusted.chainId !== 11_155_111 || !isAddress(trusted.contract) || !isAddress(trusted.issuer)) {
    return '사전에 확인한 발급 계약과 발급자 기준이 올바르지 않습니다.';
  }
  return null;
}

export async function verifySignedComparison(
  bytes: Uint8Array,
  candidate: DocumentProof,
  registeredProof: Proof,
  trusted: TrustedDeployment,
  client: VerificationClient,
  onTrace?: VerificationTraceCallback,
): Promise<SignedComparisonResult> {
  emit(onTrace, { id: 'input', operation: '재서명 비교자료 형식 검사', location: 'local', state: 'running', detail: `${bytes.byteLength} bytes` });
  const inputError = validateCandidate(bytes, candidate, registeredProof, trusted);
  if (inputError) {
    emit(onTrace, { id: 'input', operation: '재서명 비교자료 형식 검사', location: 'local', state: 'failure', detail: inputError });
    return malformed(inputError, candidate);
  }
  emit(onTrace, { id: 'input', operation: '재서명 비교자료 형식 검사', location: 'local', state: 'success', detail: '같은 문서 ID · 등록 주장 없음' });

  emit(onTrace, { id: 'sha256', operation: '재서명 PDF 전체 바이트 SHA-256', location: 'local', state: 'running' });
  let fileHash: Hex;
  try {
    fileHash = await sha256(bytes);
  } catch {
    emit(onTrace, { id: 'sha256', operation: '재서명 PDF 전체 바이트 SHA-256', location: 'local', state: 'failure', detail: 'Web Crypto SHA-256 계산 실패' });
    return { status: 'unavailable', message: '비교할 PDF의 해시를 계산할 수 없습니다.' };
  }
  const fileMatch = sameHex(fileHash, candidate.documentHash);
  emit(onTrace, { id: 'sha256', operation: '재서명 PDF 전체 바이트 SHA-256', location: 'local', state: fileMatch ? 'success' : 'failure', detail: fileHash });

  emit(onTrace, { id: 'signature', operation: '재서명 정보의 발급자 주소 복구', location: 'local', state: 'running' });
  let recoveredAddress: Address;
  try {
    recoveredAddress = await recoverTypedDataAddress({
      domain: documentDomain(trusted.chainId, trusted.contract),
      types: documentTypes,
      primaryType: 'Document',
      message: {
        documentId: candidate.documentId,
        documentHash: candidate.documentHash,
        issuedAt: BigInt(candidate.issuedAt),
      },
      signature: candidate.signature,
    });
  } catch {
    emit(onTrace, { id: 'signature', operation: '재서명 정보의 발급자 주소 복구', location: 'local', state: 'failure', detail: '서명 복원 실패' });
    return {
      fileHash, signedHash: candidate.documentHash, status: 'signature-mismatch', message: '비교용 발급서명을 해석할 수 없습니다.', signatureValid: false,
      fileMatch, signedComparison: { signatureValid: false, fileMatch, signedHash: candidate.documentHash, registrationConflict: false },
    };
  }
  const signatureValid = sameAddress(recoveredAddress, trusted.issuer);
  emit(onTrace, { id: 'signature', operation: '재서명 정보의 발급자 주소 복구', location: 'local', state: signatureValid ? 'success' : 'failure', detail: recoveredAddress });
  const comparison = { signatureValid, fileMatch, signedHash: candidate.documentHash, recoveredAddress, registrationConflict: false };
  if (!signatureValid) {
    return { fileHash, signedHash: candidate.documentHash, recoveredAddress, status: 'signature-mismatch', message: '비교용 서명자가 신뢰할 시험 발급자와 다릅니다.', signatureValid: false, fileMatch, signedComparison: comparison };
  }
  if (!fileMatch) {
    return { fileHash, signedHash: candidate.documentHash, recoveredAddress, status: 'file-mismatch', message: '비교용 PDF가 함께 전달된 발급서명 정보와 다릅니다.', signatureValid: true, fileMatch: false, signedComparison: comparison };
  }

  // The registered proof still goes through every transaction, receipt, event, finality and issuer check.
  const reference = await verifyDocument(bytes, registeredProof, trusted, client, event => {
    if (event.id === 'hash-comparison') {
      emit(onTrace, { ...event, operation: '제출 PDF와 기존 등록 원본 대조',
        detail: event.state === 'failure' ? '제출 PDF는 새 발급서명과 일치하며, 기존 등록 원본 해시와는 불일치'
          : event.state === 'success' ? '제출 PDF 해시와 기존 등록 원본 해시 일치' : event.detail });
    } else {
      emit(onTrace, event.id === 'signature' ? { ...event, operation: '등록 원본의 EIP-712 발급자 주소 복구' } : event);
    }
  });
  const referenceTrusted = reference.signatureValid === true && reference.chainRecordValid === true
    && (reference.status === 'match' || reference.status === 'file-mismatch');
  if (!referenceTrusted) return { ...reference, signedComparison: comparison };

  const registrationConflict = !sameHex(candidate.documentHash, registeredProof.documentHash)
    || candidate.issuedAt !== registeredProof.issuedAt;
  const signedComparison = { ...comparison, registrationConflict };
  if (registrationConflict) {
    return {
      ...reference,
      fileHash,
      signedHash: candidate.documentHash,
      recoveredAddress,
      status: 'file-mismatch',
      message: 'PDF와 새 발급서명은 일치하지만, 같은 문서 ID에 확정된 등록 원본과 다릅니다.',
      signatureValid: true,
      chainRecordValid: true,
      fileMatch: true,
      signedComparison,
    };
  }
  return { ...reference, fileHash, signedHash: candidate.documentHash, recoveredAddress, signedComparison };
}

export function serializeSignedComparisonFile(candidate: DocumentProof, registeredProof: Proof, trusted: TrustedDeployment) {
  const error = validateCandidate(new TextEncoder().encode('%PDF-'), candidate, registeredProof, trusted);
  if (error) throw new Error(error);
  const value: SignedComparisonFile = {
    format: SIGNED_COMPARISON_FILE_FORMAT,
    chain: { chainId: trusted.chainId, contract: trusted.contract, issuer: trusted.issuer },
    reference: { transactionHash: registeredProof.transactionHash! },
    candidate: {
      documentId: candidate.documentId,
      documentHash: candidate.documentHash,
      issuedAt: candidate.issuedAt,
      signature: candidate.signature,
    },
  };
  return JSON.stringify(value, null, 2);
}

export function parseSignedComparisonFile(text: string, registeredProof: Proof, trusted: TrustedDeployment): DocumentProof {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('재서명 비교정보 JSON을 읽지 못했습니다.'); }
  if (!object(value, ['format', 'chain', 'reference', 'candidate']) || value.format !== SIGNED_COMPARISON_FILE_FORMAT
    || !object(value.chain, ['chainId', 'contract', 'issuer']) || value.chain.chainId !== trusted.chainId
    || typeof value.chain.contract !== 'string' || !sameAddress(value.chain.contract, trusted.contract)
    || typeof value.chain.issuer !== 'string' || !sameAddress(value.chain.issuer, trusted.issuer)
    || !object(value.reference, ['transactionHash']) || !hex(value.reference.transactionHash, 32)
    || !registeredProof.transactionHash || !sameHex(value.reference.transactionHash, registeredProof.transactionHash)
    || !object(value.candidate, ['documentId', 'documentHash', 'issuedAt', 'signature'])) {
    throw new Error('사전에 확인한 등록 원본에 연결된 재서명 비교정보가 아닙니다.');
  }
  const candidate = value.candidate;
  if (!nonZeroHex(candidate.documentId, 32) || !sameHex(candidate.documentId, registeredProof.documentId)
    || !nonZeroHex(candidate.documentHash, 32) || !hex(candidate.signature, 65) || !issuedAt(candidate.issuedAt)) {
    throw new Error('재서명 비교정보의 문서 ID·해시·서명·발급시각 형식을 확인해 주세요.');
  }
  // This presentation comparison changes the PDF only; the issuance time stays fixed.
  if (candidate.issuedAt !== registeredProof.issuedAt) throw new Error('이 비교 사례는 등록 원본과 같은 발급 기재시각을 사용합니다.');
  return { documentId: candidate.documentId, documentHash: candidate.documentHash, issuedAt: candidate.issuedAt as string, signature: candidate.signature };
}
