import {
  TransactionReceiptNotFoundError,
  decodeFunctionData,
  getAddress,
  isAddress,
  parseEventLogs,
  recoverTypedDataAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import {
  documentDomain,
  documentRegistryAbi,
  documentTypes,
} from '../../../../packages/chain/src/document-registry.js';

const SEPOLIA_CHAIN_ID = 11_155_111;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const UINT64_MAX = (1n << 64n) - 1n;
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;

export interface DocumentProof {
  documentId: Hex;
  documentHash: Hex;
  issuedAt: string;
  signature: Hex;
  transactionHash?: Hex;
}

export type Proof = DocumentProof;

export interface TrustedDeployment {
  chainId: 11155111;
  contract: Address;
  issuer: Address;
  deploymentTransaction?: Hex;
}

export type VerificationStatus =
  | 'match'
  | 'file-mismatch'
  | 'signature-mismatch'
  | 'not-registered'
  | 'pending'
  | 'unavailable'
  | 'invalid';

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  fileHash?: Hex;
  signedHash?: Hex;
  chainHash?: Hex;
  signatureValid?: boolean;
  chainRecordValid?: boolean;
  fileMatch?: boolean;
  receiptBlockNumber?: string;
  receiptBlockTime?: string;
  finalizedBlock?: string;
  recoveredAddress?: Address;
  chainIssuedAt?: string;
}

export type VerificationTraceId =
  | 'deployment-validation'
  | 'input'
  | 'sha256'
  | 'signature'
  | 'chain-id'
  | 'finalized-block'
  | 'transaction-input'
  | 'receipt'
  | 'canonical-block'
  | 'registration-event'
  | 'finality'
  | 'authorized-issuer'
  | 'record'
  | 'hash-comparison';

export interface VerificationTraceEvent {
  id: VerificationTraceId;
  operation: string;
  location: 'local' | 'ethereum';
  state: 'running' | 'success' | 'failure';
  detail?: string;
}

export type VerificationTraceCallback = (event: VerificationTraceEvent) => void;

export type VerificationClient = Pick<
  PublicClient,
  'getBlock' | 'getChainId' | 'getTransaction' | 'getTransactionReceipt' | 'readContract'
>;

function malformed(message: string): VerificationResult {
  return { status: 'invalid', message };
}

function tracer(callback?: VerificationTraceCallback) {
  let active: Omit<VerificationTraceEvent, 'state' | 'detail'> | undefined;
  const emit = (event: VerificationTraceEvent) => {
    try { callback?.(event); } catch { /* Observability must never change verification. */ }
  };
  return {
    start(id: VerificationTraceId, operation: string, location: 'local' | 'ethereum', detail?: string) {
      active = { id, operation, location };
      emit({ ...active, state: 'running', detail });
    },
    success(detail?: string) {
      if (!active) return;
      emit({ ...active, state: 'success', detail });
      active = undefined;
    },
    failure(detail?: string) {
      if (!active) return;
      emit({ ...active, state: 'failure', detail });
      active = undefined;
    },
  };
}

function isHexBytes(value: unknown, bytes: number) {
  return typeof value === 'string' && new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}

function parseIssuedAt(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= UINT64_MAX ? parsed : null;
}

function sameAddress(left: Address | null | undefined, right: Address) {
  return Boolean(left && getAddress(left) === getAddress(right));
}

function sameHex(left: Hex, right: Hex) {
  return left.toLowerCase() === right.toLowerCase();
}

function validateInput(bytes: Uint8Array, proof: DocumentProof, trusted: TrustedDeployment) {
  if (bytes.byteLength > MAX_PDF_BYTES) return 'PDF는 10 MiB 이하여야 합니다.';
  if (bytes.byteLength < 5 || new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-') {
    return 'PDF 파일 형식이 아닙니다.';
  }
  if (trusted.chainId !== SEPOLIA_CHAIN_ID) return '신뢰 설정의 체인이 Sepolia가 아닙니다.';
  if (!isAddress(trusted.contract) || trusted.contract === '0x0000000000000000000000000000000000000000') {
    return '신뢰할 컨트랙트 주소가 올바르지 않습니다.';
  }
  if (!isAddress(trusted.issuer) || trusted.issuer === '0x0000000000000000000000000000000000000000') {
    return '신뢰할 시험 발급자 주소가 올바르지 않습니다.';
  }
  if (!isHexBytes(proof.documentId, 32) || proof.documentId.toLowerCase() === ZERO_BYTES32) {
    return '문서 ID는 0이 아닌 bytes32여야 합니다.';
  }
  if (!isHexBytes(proof.documentHash, 32) || proof.documentHash.toLowerCase() === ZERO_BYTES32) {
    return '문서 해시는 0이 아닌 bytes32여야 합니다.';
  }
  if (!isHexBytes(proof.signature, 65)) return '발급서명은 65바이트여야 합니다.';
  if (proof.transactionHash !== undefined && !isHexBytes(proof.transactionHash, 32)) {
    return '등록 트랜잭션 해시가 올바르지 않습니다.';
  }
  if (!parseIssuedAt(proof.issuedAt)) return '발급시각은 uint64 범위의 양의 정수 문자열이어야 합니다.';
  return null;
}

export async function sha256(bytes: Uint8Array): Promise<Hex> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function validateRegistrationTransaction(
  input: Hex,
  proof: DocumentProof,
  issuedAt: bigint,
) {
  try {
    const decoded = decodeFunctionData({ abi: documentRegistryAbi, data: input });
    if (decoded.functionName !== 'register' || !decoded.args) return false;
    const [documentId, documentHash, registeredAt, signature] = decoded.args;
    return sameHex(documentId, proof.documentId)
      && sameHex(documentHash, proof.documentHash)
      && registeredAt === issuedAt
      && sameHex(signature, proof.signature);
  } catch {
    return false;
  }
}

export async function verifyDocument(
  bytes: Uint8Array,
  proof: DocumentProof,
  trusted: TrustedDeployment,
  client: VerificationClient,
  onTrace?: VerificationTraceCallback,
): Promise<VerificationResult> {
  const trace = tracer(onTrace);
  trace.start('input', 'PDF·검증정보 형식 검사', 'local', `${bytes.byteLength} bytes`);
  const inputError = validateInput(bytes, proof, trusted);
  if (inputError) {
    trace.failure(inputError);
    return malformed(inputError);
  }
  trace.success('PDF 헤더·크기·bytes32·uint64·서명 길이 확인');
  const issuedAt = parseIssuedAt(proof.issuedAt)!;
  trace.start('sha256', '제출 PDF 전체 바이트 SHA-256', 'local', 'Web Crypto digest');
  let fileHash: Hex;
  try {
    fileHash = await sha256(bytes);
  } catch {
    trace.failure('Web Crypto SHA-256 계산 실패');
    return { status: 'unavailable', message: 'PDF 해시를 계산할 수 없습니다.' };
  }
  trace.success(fileHash);
  const base = { fileHash, signedHash: proof.documentHash };

  let recovered: Address;
  trace.start('signature', 'EIP-712 서명자 주소 복구', 'local', 'ECDSA secp256k1 · Document(documentId,documentHash,issuedAt)');
  try {
    recovered = await recoverTypedDataAddress({
      domain: documentDomain(trusted.chainId, trusted.contract),
      types: documentTypes,
      primaryType: 'Document',
      message: { documentId: proof.documentId, documentHash: proof.documentHash, issuedAt },
      signature: proof.signature,
    });
  } catch {
    trace.failure('서명 복원 실패');
    return { ...base, status: 'signature-mismatch', message: '발급서명을 해석할 수 없습니다.', signatureValid: false };
  }
  if (!sameAddress(recovered, trusted.issuer)) {
    trace.failure(`복원 주소 ${recovered} · 신뢰 발급자와 불일치`);
    return { ...base, recoveredAddress: recovered, status: 'signature-mismatch', message: '서명자가 사전에 지정한 시험 발급자와 다릅니다.', signatureValid: false };
  }
  trace.success(`복원 주소 ${recovered}`);

  try {
    trace.start('chain-id', 'eth_chainId 조회', 'ethereum');
    const chainId = await client.getChainId();
    if (chainId !== trusted.chainId) {
      trace.failure(`조회 ${chainId} · 기대 ${trusted.chainId}`);
      return { ...base, recoveredAddress: recovered, status: 'invalid', message: '조회 노드가 Sepolia 체인에 연결되지 않았습니다.', signatureValid: true };
    }
    trace.success(`chainId ${chainId}`);
    trace.start('finalized-block', 'eth_getBlockByNumber(finalized)', 'ethereum');
    const finalized = await client.getBlock({ blockTag: 'finalized' });
    const finalizedBlock = finalized.number.toString();
    trace.success(`finalized #${finalizedBlock} · ${finalized.hash}`);
    let receiptBlockNumber: string | undefined;
    let receiptBlockTime: string | undefined;

    if (proof.transactionHash) {
      trace.start('transaction-input', 'eth_getTransactionByHash · register 입력 대조', 'ethereum', proof.transactionHash);
      const transaction = await client.getTransaction({ hash: proof.transactionHash });
      if (!sameAddress(transaction.to, trusted.contract)
        || !sameAddress(transaction.from, trusted.issuer)
        || !validateRegistrationTransaction(transaction.input, proof, issuedAt)) {
        trace.failure('to·from·register(documentId,documentHash,issuedAt,signature) 불일치');
        return { ...base, recoveredAddress: recovered, status: 'invalid', message: '등록 트랜잭션이 제출된 검증정보와 연결되지 않습니다.', signatureValid: true, finalizedBlock };
      }
      trace.success('등록 입력과 제출 검증정보 일치');

      let receipt;
      trace.start('receipt', 'eth_getTransactionReceipt 조회', 'ethereum', proof.transactionHash);
      try {
        receipt = await client.getTransactionReceipt({ hash: proof.transactionHash });
      } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) {
          trace.failure('영수증 없음 · 블록 포함 대기');
          return { ...base, recoveredAddress: recovered, status: 'pending', message: '등록 트랜잭션이 아직 블록에 포함되지 않았습니다.', signatureValid: true, finalizedBlock };
        }
        throw error;
      }
      if (receipt.status !== 'success'
        || !sameAddress(receipt.to, trusted.contract)
        || !sameAddress(receipt.from, trusted.issuer)) {
        trace.failure(`status ${receipt.status} · to/from 신뢰 기준 불일치`);
        return { ...base, recoveredAddress: recovered, status: 'invalid', message: '등록 트랜잭션 영수증이 신뢰 기준과 다릅니다.', signatureValid: true, finalizedBlock };
      }
      trace.success(`success · block #${receipt.blockNumber}`);
      trace.start('canonical-block', 'eth_getBlockByNumber · 포함 블록 정식 체인 대조', 'ethereum', `#${receipt.blockNumber}`);
      const includedBlock = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (includedBlock.hash !== receipt.blockHash) {
        trace.failure('영수증 blockHash와 현재 정식 블록 불일치');
        return { ...base, recoveredAddress: recovered, status: 'unavailable', message: '등록 블록이 현재 정식 체인과 일치하지 않습니다.', signatureValid: true, finalizedBlock };
      }
      trace.success(`${includedBlock.hash}`);
      receiptBlockNumber = receipt.blockNumber.toString();
      receiptBlockTime = new Date(Number(includedBlock.timestamp) * 1000).toISOString();
      trace.start('registration-event', '영수증의 DocumentRegistered 이벤트 해석·대조', 'local');
      const events = parseEventLogs({
        abi: documentRegistryAbi,
        eventName: 'DocumentRegistered',
        logs: receipt.logs,
        strict: true,
      });
      const eventMatches = events.some(({ address, args }) => sameAddress(address, trusted.contract)
        && sameHex(args.documentId, proof.documentId)
        && sameHex(args.documentHash, proof.documentHash)
        && args.issuedAt === issuedAt);
      if (!eventMatches) {
        trace.failure('documentId·documentHash·issuedAt 일치 이벤트 없음');
        return { ...base, recoveredAddress: recovered, status: 'invalid', message: '등록 이벤트가 제출된 검증정보와 일치하지 않습니다.', signatureValid: true, finalizedBlock, receiptBlockNumber, receiptBlockTime };
      }
      trace.success('DocumentRegistered 값 일치');
      trace.start('finality', '등록 블록과 finalized 블록 높이 비교', 'ethereum', `등록 #${receipt.blockNumber} · finalized #${finalized.number}`);
      if (receipt.blockNumber > finalized.number) {
        trace.failure('블록 포함 완료 · finalized 대기');
        return { ...base, recoveredAddress: recovered, status: 'pending', message: '등록은 블록에 포함됐지만 아직 finalized 상태가 아닙니다.', signatureValid: true, finalizedBlock, receiptBlockNumber, receiptBlockTime };
      }
      trace.success('등록 블록이 finalized 범위에 포함');
    }

    trace.start('authorized-issuer', 'viem readContract → eth_call authorizedIssuer()', 'ethereum', `고정 블록 #${finalized.number}`);
    const issuer = await client.readContract({
      address: trusted.contract,
      abi: documentRegistryAbi,
      functionName: 'authorizedIssuer',
      blockNumber: finalized.number,
    });
    if (!sameAddress(issuer as Address, trusted.issuer)) {
      trace.failure(`체인 ${issuer as Address} · 신뢰 ${trusted.issuer}`);
      return { ...base, recoveredAddress: recovered, status: 'invalid', message: '컨트랙트의 허용 발급자가 신뢰 설정과 다릅니다.', signatureValid: true, finalizedBlock, receiptBlockNumber, receiptBlockTime };
    }
    trace.success(`허용 발급자 ${issuer as Address}`);

    trace.start('record', 'viem readContract → eth_call records(documentId)', 'ethereum', `고정 블록 #${finalized.number}`);
    const record = await client.readContract({
      address: trusted.contract,
      abi: documentRegistryAbi,
      functionName: 'records',
      args: [proof.documentId],
      blockNumber: finalized.number,
    });
    const [chainHash, chainIssuedAt] = record as readonly [Hex, bigint];
    if (chainHash === ZERO_BYTES32 && chainIssuedAt === 0n) {
      trace.failure('고정 finalized 블록에 문서 ID 미등록');
      return { ...base, recoveredAddress: recovered, chainIssuedAt: '0', status: 'not-registered', message: 'finalized 상태에서 등록 기록을 찾지 못했습니다.', signatureValid: true, finalizedBlock, receiptBlockNumber, receiptBlockTime };
    }
    if (!sameHex(chainHash, proof.documentHash) || chainIssuedAt !== issuedAt) {
      trace.failure(`hash ${chainHash} · issuedAt ${chainIssuedAt}`);
      return { ...base, recoveredAddress: recovered, chainHash, chainIssuedAt: chainIssuedAt.toString(), status: 'invalid', message: '확정된 체인 기록이 발급서명 정보와 다릅니다.', signatureValid: true, chainRecordValid: false, finalizedBlock, receiptBlockNumber, receiptBlockTime };
    }
    trace.success(`hash ${chainHash} · issuedAt ${chainIssuedAt}`);
    trace.start('hash-comparison', '제출·서명·체인 해시 최종 대조', 'local');
    const fileMatch = fileHash.toLowerCase() === proof.documentHash.toLowerCase();
    if (fileMatch) trace.success('Hfile = message.documentHash = records[documentId].documentHash');
    else trace.failure('제출 PDF 해시만 발급서명·체인 기록과 불일치');
    return {
      ...base,
      recoveredAddress: recovered,
      chainHash,
      chainIssuedAt: chainIssuedAt.toString(),
      status: fileMatch ? 'match' : 'file-mismatch',
      message: fileMatch ? '제출 PDF가 발급 원본 및 확정된 체인 기록과 일치합니다.' : '제출 PDF가 발급 원본과 다릅니다.',
      signatureValid: true,
      chainRecordValid: true,
      fileMatch,
      finalizedBlock,
      receiptBlockNumber,
      receiptBlockTime,
    };
  } catch {
    trace.failure('RPC 또는 컨트랙트 조회 실패');
    return { ...base, recoveredAddress: recovered, status: 'unavailable', message: 'Sepolia의 확정된 기록을 조회할 수 없습니다.', signatureValid: true };
  }
}
