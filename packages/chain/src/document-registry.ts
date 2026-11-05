import { parseAbi, type Abi, type Address, type Hex } from 'viem';

export const DOCUMENT_REGISTRY_NAME = 'KodaDocumentRegistryDemo';
export const DOCUMENT_REGISTRY_VERSION = '1';

export const documentRegistryAbi = parseAbi([
  'constructor(address authorizedIssuer_)',
  'function authorizedIssuer() view returns (address)',
  'function records(bytes32 documentId) view returns (bytes32 documentHash, uint64 issuedAt)',
  'function register(bytes32 documentId, bytes32 documentHash, uint64 issuedAt, bytes signature)',
  'event DocumentRegistered(bytes32 indexed documentId, bytes32 documentHash, uint64 issuedAt)',
  'error InvalidIssuer()',
  'error Unauthorized()',
  'error InvalidDocumentId()',
  'error InvalidDocumentHash()',
  'error InvalidIssuedAt()',
  'error InvalidSignature()',
  'error AlreadyRegistered()',
]);

export const documentTypes = {
  Document: [
    { name: 'documentId', type: 'bytes32' },
    { name: 'documentHash', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint64' },
  ],
} as const;

export interface DocumentMessage {
  documentId: Hex;
  documentHash: Hex;
  issuedAt: bigint;
}

export interface DocumentRecord {
  documentHash: Hex;
  issuedAt: bigint;
}

export interface DocumentRegistryArtifact {
  contractName: 'DocumentRegistry';
  sourceName: 'DocumentRegistry.sol';
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
  storageLayout: unknown;
  immutableReferences: Record<string, Array<{ start: number; length: number }>>;
  metadata: unknown;
  compiler: {
    version: string;
    optimizer: { enabled: boolean; runs: number };
    evmVersion: string;
  };
}

export function documentDomain(chainId: number, verifyingContract: Address) {
  return {
    name: DOCUMENT_REGISTRY_NAME,
    version: DOCUMENT_REGISTRY_VERSION,
    chainId,
    verifyingContract,
  } as const;
}
