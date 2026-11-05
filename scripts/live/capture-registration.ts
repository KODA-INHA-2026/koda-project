import { basename, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  createPublicClient,
  decodeFunctionData,
  getAddress,
  http,
  isAddressEqual,
  isHash,
  parseEventLogs,
  recoverTypedDataAddress,
  type Address,
  type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';
import {
  DOCUMENT_REGISTRY_NAME,
  DOCUMENT_REGISTRY_VERSION,
  documentDomain,
  documentRegistryAbi,
  documentTypes,
} from '../../packages/chain/src/document-registry.ts';
import {
  verifyDocument,
  type Proof,
  type TrustedDeployment,
} from '../../apps/web/src/live/verification.ts';

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const OUTPUT_DIRECTORY = resolve('docs/portfolio/2026-11-06-sepolia');
const DEPLOYMENT_EVIDENCE = resolve(OUTPUT_DIRECTORY, 'deployment-latest.json');
const CONTRACT_SOURCE = resolve('packages/chain/contracts/DocumentRegistry.sol');
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;
const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC, { retryCount: 1, timeout: 20_000 }),
});

interface DeploymentEvidence {
  chainId: number;
  contractAddress: Address;
  authorizedIssuer: Address;
  deploymentTransaction: Hex;
  sourceSha256: string;
  checks: Record<string, boolean>;
}

function fail(message: string): never {
  throw new Error(message);
}

function sameHex(left: Hex, right: Hex) {
  return left.toLowerCase() === right.toLowerCase();
}

function serialize(value: unknown) {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2) + '\n';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function readDeployment(): DeploymentEvidence {
  const evidence = JSON.parse(readFileSync(DEPLOYMENT_EVIDENCE, 'utf8')) as DeploymentEvidence;
  if (evidence.chainId !== sepolia.id) fail('Deployment evidence is not for Sepolia.');
  if (Object.values(evidence.checks).some((check) => check !== true)) fail('Deployment evidence contains a failed trust check.');
  return evidence;
}

async function inspectPdf(path: string | undefined, proof: Proof, trusted: TrustedDeployment) {
  if (!path) return { supplied: false, validationClaimed: false };
  const absolute = resolve(path);
  const bytes = readFileSync(absolute);
  return {
    supplied: true,
    validationClaimed: true,
    fileName: basename(absolute),
    byteLength: bytes.byteLength,
    result: await verifyDocument(bytes, proof, trusted, client),
  };
}

async function main() {
  const [transactionArgument, originalPath, alteredPath] = process.argv.slice(2);
  if (!transactionArgument || !isHash(transactionArgument)) {
    fail('Usage: node --import tsx scripts/live/capture-registration.ts <txhash> [original.pdf] [altered.pdf]');
  }
  const transactionHash = transactionArgument as Hex;
  const deployment = readDeployment();
  const contractSourceSha256 = createHash('sha256').update(readFileSync(CONTRACT_SOURCE)).digest('hex');
  const contract = getAddress(deployment.contractAddress);
  const issuer = getAddress(deployment.authorizedIssuer);
  const trusted: TrustedDeployment = {
    chainId: sepolia.id,
    contract,
    issuer,
    deploymentTransaction: deployment.deploymentTransaction,
  };

  const [chainId, transaction, receipt, latestBlock, finalizedBlock] = await Promise.all([
    client.getChainId(),
    client.getTransaction({ hash: transactionHash }),
    client.getTransactionReceipt({ hash: transactionHash }),
    client.getBlock({ blockTag: 'latest' }),
    client.getBlock({ blockTag: 'finalized' }),
  ]);
  if (chainId !== sepolia.id) fail('RPC returned a different chain ID.');

  const decoded = decodeFunctionData({ abi: documentRegistryAbi, data: transaction.input });
  if (decoded.functionName !== 'register' || !decoded.args) fail('Transaction does not call register.');
  const [documentId, documentHash, issuedAt, signature] = decoded.args;
  const proof: Proof = {
    documentId,
    documentHash,
    issuedAt: issuedAt.toString(),
    signature,
    transactionHash,
  };
  const recoveredSigner = await recoverTypedDataAddress({
    domain: documentDomain(sepolia.id, contract),
    types: documentTypes,
    primaryType: 'Document',
    message: { documentId, documentHash, issuedAt },
    signature,
  });
  const includedBlock = await client.getBlock({ blockNumber: receipt.blockNumber });
  const events = parseEventLogs({
    abi: documentRegistryAbi,
    eventName: 'DocumentRegistered',
    logs: receipt.logs,
    strict: true,
  });
  const event = events.find((entry) => isAddressEqual(entry.address, contract)
    && sameHex(entry.args.documentId, documentId)
    && sameHex(entry.args.documentHash, documentHash)
    && entry.args.issuedAt === issuedAt);

  const [latestIssuer, latestRecord] = await Promise.all([
    client.readContract({ address: contract, abi: documentRegistryAbi, functionName: 'authorizedIssuer', blockTag: 'latest' }),
    client.readContract({ address: contract, abi: documentRegistryAbi, functionName: 'records', args: [documentId], blockTag: 'latest' }),
  ]);
  let finalizedIssuer: Address | null = null;
  let finalizedIssuerError: string | null = null;
  try {
    finalizedIssuer = await client.readContract({ address: contract, abi: documentRegistryAbi, functionName: 'authorizedIssuer', blockTag: 'finalized' });
  } catch (error) {
    finalizedIssuerError = errorMessage(error);
  }
  let finalizedRecord: readonly [Hex, bigint] | null = null;
  let finalizedRecordError: string | null = null;
  try {
    finalizedRecord = await client.readContract({ address: contract, abi: documentRegistryAbi, functionName: 'records', args: [documentId], blockTag: 'finalized' });
  } catch (error) {
    finalizedRecordError = errorMessage(error);
  }

  const latestRecordMatches = sameHex(latestRecord[0], documentHash) && latestRecord[1] === issuedAt;
  const includedAtOrBeforeFinalized = receipt.blockNumber <= finalizedBlock.number;
  const finalizedIssuerMatches = finalizedIssuer === null ? null : isAddressEqual(finalizedIssuer, issuer);
  const finalizedRecordExists = finalizedRecord === null
    ? null
    : !(finalizedRecord[0] === ZERO_BYTES32 && finalizedRecord[1] === 0n);
  const finalizedRecordMatches = finalizedRecord !== null
    && sameHex(finalizedRecord[0], documentHash)
    && finalizedRecord[1] === issuedAt;
  const checks = {
    chainIsSepolia: chainId === sepolia.id,
    transactionTargetsTrustedContract: Boolean(transaction.to && isAddressEqual(transaction.to, contract)),
    transactionSenderIsTrustedIssuer: isAddressEqual(transaction.from, issuer),
    zeroEthValue: transaction.value === 0n,
    receiptSuccessful: receipt.status === 'success',
    receiptTargetsTrustedContract: Boolean(receipt.to && isAddressEqual(receipt.to, contract)),
    receiptSenderIsTrustedIssuer: isAddressEqual(receipt.from, issuer),
    canonicalIncludedBlock: includedBlock.hash === receipt.blockHash,
    registrationEventMatches: Boolean(event),
    recoveredSignerIsTrustedIssuer: isAddressEqual(recoveredSigner, issuer),
    latestIssuerMatches: isAddressEqual(latestIssuer, issuer),
    latestRecordMatches,
    contractSourceMatchesPinnedDeployment: contractSourceSha256 === deployment.sourceSha256,
    includedAtOrBeforeFinalized,
    finalizedIssuerReadAvailable: finalizedIssuer !== null,
    finalizedIssuerMatches,
    finalizedRecordReadAvailable: finalizedRecord !== null,
    finalizedRecordExists,
    finalizedRecordMatches: finalizedRecord === null ? null : finalizedRecordMatches,
  };
  const actualGate = checks.chainIsSepolia
    && checks.transactionTargetsTrustedContract
    && checks.transactionSenderIsTrustedIssuer
    && checks.zeroEthValue
    && checks.receiptSuccessful
    && checks.receiptTargetsTrustedContract
    && checks.receiptSenderIsTrustedIssuer
    && checks.canonicalIncludedBlock
    && checks.registrationEventMatches
    && checks.recoveredSignerIsTrustedIssuer
    && checks.latestIssuerMatches
    && checks.latestRecordMatches
    && checks.contractSourceMatchesPinnedDeployment;
  const finalizedGate = actualGate
    && checks.includedAtOrBeforeFinalized
    && checks.finalizedIssuerMatches === true
    && checks.finalizedRecordMatches === true;
  const finalityReadUnavailable = !checks.finalizedIssuerReadAvailable || !checks.finalizedRecordReadAvailable;
  const capturedAtUtc = new Date().toISOString();
  const originalFile = await inspectPdf(originalPath, proof, trusted);
  const alteredFile = await inspectPdf(alteredPath, proof, trusted);
  const evidence = {
    capturedAtUtc,
    chainId,
    network: 'Ethereum Sepolia',
    rpc: RPC,
    trustedDeployment: {
      contractAddress: contract,
      authorizedIssuer: issuer,
      deploymentTransaction: deployment.deploymentTransaction,
      deploymentEvidence: 'deployment-latest.json',
      deploymentSourceSha256: deployment.sourceSha256,
      deploymentChecksAllPassed: true,
    },
    contractSource: {
      path: 'packages/chain/contracts/DocumentRegistry.sol',
      currentSha256: contractSourceSha256,
      deployedSourceSha256: deployment.sourceSha256,
      matchesPinnedDeployment: checks.contractSourceMatchesPinnedDeployment,
    },
    registrationTransaction: transactionHash,
    explorerTransaction: `https://sepolia.etherscan.io/tx/${transactionHash}`,
    explorerContract: `https://sepolia.etherscan.io/address/${contract}`,
    registrationBlock: receipt.blockNumber.toString(),
    registrationBlockHash: receipt.blockHash,
    registrationBlockTimeUtc: new Date(Number(includedBlock.timestamp) * 1000).toISOString(),
    latestBlock: latestBlock.number.toString(),
    finalizedBlock: finalizedBlock.number.toString(),
    finalizedBlockTimeUtc: new Date(Number(finalizedBlock.timestamp) * 1000).toISOString(),
    status: finalizedGate
      ? 'FINALIZED_VERIFIED'
      : actualGate && !includedAtOrBeforeFinalized
        ? 'INCLUDED_PENDING_FINALITY'
        : actualGate && finalityReadUnavailable
          ? 'FINALITY_READ_UNAVAILABLE'
          : 'INVALID',
    actualGate,
    finalizedGate,
    checks,
    proof,
    eip712: {
      domain: {
        name: DOCUMENT_REGISTRY_NAME,
        version: DOCUMENT_REGISTRY_VERSION,
        chainId: sepolia.id,
        verifyingContract: contract,
      },
      primaryType: 'Document',
      types: documentTypes,
      recoveredSigner,
    },
    records: {
      latest: { documentHash: latestRecord[0], issuedAt: latestRecord[1].toString() },
      finalized: finalizedRecord
        ? {
            available: true,
            exists: finalizedRecordExists,
            documentHash: finalizedRecord[0],
            issuedAt: finalizedRecord[1].toString(),
          }
        : { available: false, exists: null, error: finalizedRecordError },
    },
    finalizedIssuer: finalizedIssuer
      ? { available: true, address: finalizedIssuer, matchesTrustedIssuer: finalizedIssuerMatches }
      : { available: false, address: null, matchesTrustedIssuer: null, error: finalizedIssuerError },
    transactionCost: {
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPriceWei: receipt.effectiveGasPrice.toString(),
      feeWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
    },
    receipt: {
      status: receipt.status,
      from: receipt.from,
      to: receipt.to,
      blockNumber: receipt.blockNumber.toString(),
      blockHash: receipt.blockHash,
      transactionIndex: receipt.transactionIndex,
    },
    fileValidation: {
      performed: originalFile.supplied || alteredFile.supplied,
      original: originalFile,
      altered: alteredFile,
      note: originalFile.supplied || alteredFile.supplied
        ? 'File results were produced from the exact local bytes supplied to this capture command.'
        : 'No PDF arguments were supplied; this evidence does not claim file-byte validation.',
    },
  };

  if (!actualGate) fail('Registration evidence failed the actual inclusion gate.');
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const stamp = capturedAtUtc.replaceAll(':', '-').replace('.', '-');
  const versioned = resolve(OUTPUT_DIRECTORY, `registration-${stamp}.json`);
  const latest = resolve(OUTPUT_DIRECTORY, 'registration-latest.json');
  const json = serialize(evidence);
  writeFileSync(versioned, json);
  writeFileSync(latest, json);
  console.log(`Registration evidence: ${versioned}`);
  console.log(`Status: ${evidence.status}`);
  console.log(`File validation performed: ${evidence.fileValidation.performed}`);
}

await main();
