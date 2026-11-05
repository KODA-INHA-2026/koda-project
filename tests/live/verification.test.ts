import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  type Address,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  documentDomain,
  documentRegistryAbi,
  documentTypes,
} from '../../packages/chain/src/document-registry.ts';
import {
  sha256,
  verifyDocument,
  type DocumentProof,
  type TrustedDeployment,
  type VerificationClient,
  type VerificationTraceEvent,
} from '../../apps/web/src/live/verification.ts';

const issuer = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const contract = '0x1111111111111111111111111111111111111111' as Address;
const transactionHash = `0x${'99'.repeat(32)}` as Hex;
const blockHash = `0x${'88'.repeat(32)}` as Hex;
const documentId = `0x${'22'.repeat(32)}` as Hex;
const issuedAt = 1_799_280_000n;
const pdf = new TextEncoder().encode('%PDF-1.7\nKODA synthetic test\n%%EOF');
const trusted: TrustedDeployment = { chainId: 11_155_111, contract, issuer: issuer.address };

async function makeProof(overrides: Partial<DocumentProof> = {}, signer = issuer) {
  const documentHash = await sha256(pdf);
  const message = { documentId, documentHash, issuedAt };
  const signature = await signer.signTypedData({
    domain: documentDomain(trusted.chainId, trusted.contract),
    types: documentTypes,
    primaryType: 'Document',
    message,
  });
  return {
    documentId,
    documentHash,
    issuedAt: issuedAt.toString(),
    signature,
    transactionHash,
    ...overrides,
  } satisfies DocumentProof;
}

function clientFor(proof: DocumentProof, options: {
  chainId?: number;
  contractIssuer?: Address;
  record?: readonly [Hex, bigint];
  finalizedBlock?: bigint;
  receiptBlock?: bigint;
  receiptStatus?: 'success' | 'reverted';
  transactionTo?: Address;
  transactionFrom?: Address;
  transactionInput?: Hex;
  eventHash?: Hex;
  fail?: boolean;
  failFinalizedRead?: boolean;
  readCalls?: { functionName: string; blockNumber?: bigint; blockTag?: string }[];
} = {}) {
  const finalizedBlock = options.finalizedBlock ?? 100n;
  const receiptBlock = options.receiptBlock ?? 90n;
  const input = options.transactionInput ?? encodeFunctionData({
    abi: documentRegistryAbi,
    functionName: 'register',
    args: [proof.documentId, proof.documentHash, BigInt(proof.issuedAt), proof.signature],
  });
  const topics = encodeEventTopics({
    abi: documentRegistryAbi,
    eventName: 'DocumentRegistered',
    args: { documentId: proof.documentId },
  });
  const data = encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint64' }],
    [options.eventHash ?? proof.documentHash, BigInt(proof.issuedAt)],
  );
  const fake = {
    async getChainId() {
      if (options.fail) throw new Error('RPC unavailable');
      return options.chainId ?? trusted.chainId;
    },
    async readContract(args: { functionName: string; blockNumber?: bigint; blockTag?: string }) {
      options.readCalls?.push(args);
      if (options.fail) throw new Error('RPC unavailable');
      if (options.failFinalizedRead) throw new Error('Contract has no code at finalized block');
      if (args.functionName === 'authorizedIssuer') return options.contractIssuer ?? trusted.issuer;
      return options.record ?? [proof.documentHash, BigInt(proof.issuedAt)];
    },
    async getTransaction() {
      if (options.fail) throw new Error('RPC unavailable');
      return {
        to: options.transactionTo ?? trusted.contract,
        from: options.transactionFrom ?? trusted.issuer,
        input,
      };
    },
    async getTransactionReceipt() {
      if (options.fail) throw new Error('RPC unavailable');
      return {
        status: options.receiptStatus ?? 'success',
        to: options.transactionTo ?? trusted.contract,
        from: options.transactionFrom ?? trusted.issuer,
        blockNumber: receiptBlock,
        blockHash,
        logs: [{ address: trusted.contract, topics, data }],
      };
    },
    async getBlock(args: { blockTag?: string; blockNumber?: bigint }) {
      if (options.fail) throw new Error('RPC unavailable');
      if (args.blockTag === 'finalized') {
        return { number: finalizedBlock, hash: `0x${'77'.repeat(32)}`, timestamp: 1_799_280_100n };
      }
      return { number: args.blockNumber!, hash: blockHash, timestamp: 1_799_280_050n };
    },
  };
  return fake as unknown as VerificationClient;
}

test('accepts a matching PDF only after signature, transaction, event, and finalized record agree', async () => {
  const proof = await makeProof();
  const trace: VerificationTraceEvent[] = [];
  const readCalls: { functionName: string; blockNumber?: bigint; blockTag?: string }[] = [];
  const result = await verifyDocument(pdf, proof, trusted, clientFor(proof, { readCalls }), event => trace.push(event));
  assert.equal(result.status, 'match');
  assert.equal(result.signatureValid, true);
  assert.equal(result.chainRecordValid, true);
  assert.equal(result.fileMatch, true);
  assert.equal(result.receiptBlockNumber, '90');
  assert.equal(result.finalizedBlock, '100');
  assert.equal(result.recoveredAddress, trusted.issuer);
  assert.equal(result.chainIssuedAt, issuedAt.toString());
  assert.deepEqual(
    trace.filter(event => event.state === 'success').map(event => event.id),
    ['input', 'sha256', 'signature', 'chain-id', 'finalized-block', 'transaction-input', 'receipt', 'canonical-block', 'registration-event', 'finality', 'authorized-issuer', 'record', 'hash-comparison'],
  );
  assert.equal(trace.some(event => event.state === 'failure'), false);
  assert.deepEqual(readCalls.map(({ functionName, blockNumber, blockTag }) => ({ functionName, blockNumber, blockTag })), [
    { functionName: 'authorizedIssuer', blockNumber: 100n, blockTag: undefined },
    { functionName: 'records', blockNumber: 100n, blockTag: undefined },
  ]);
});

test('reports a modified PDF separately after the signed finalized original is trusted', async () => {
  const proof = await makeProof();
  const changed = new TextEncoder().encode('%PDF-1.7\nKODA changed test\n%%EOF');
  const trace: VerificationTraceEvent[] = [];
  const result = await verifyDocument(changed, proof, trusted, clientFor(proof), event => trace.push(event));
  assert.equal(result.status, 'file-mismatch');
  assert.equal(result.signatureValid, true);
  assert.equal(result.chainRecordValid, true);
  assert.equal(result.fileMatch, false);
  assert.equal(trace.at(-1)?.id, 'hash-comparison');
  assert.equal(trace.at(-1)?.state, 'failure');
});

test('rejects a signature from an address other than the trusted issuer before chain lookup', async () => {
  const proof = await makeProof({}, other);
  const trace: VerificationTraceEvent[] = [];
  const result = await verifyDocument(pdf, proof, trusted, clientFor(proof, { fail: true }), event => trace.push(event));
  assert.equal(result.status, 'signature-mismatch');
  assert.equal(result.signatureValid, false);
  assert.deepEqual(trace.filter(event => event.state === 'running').map(event => event.id), ['input', 'sha256', 'signature']);
  assert.equal(trace.at(-1)?.id, 'signature');
  assert.equal(trace.at(-1)?.state, 'failure');
});

test('distinguishes wrong chain, missing finalized record, and RPC outage', async () => {
  const proof = await makeProof({ transactionHash: undefined });
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { chainId: 1 }))).status, 'invalid');
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { contractIssuer: other.address }))).status, 'invalid');
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { record: [`0x${'00'.repeat(32)}`, 0n] }))).status, 'not-registered');
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { fail: true }))).status, 'unavailable');
});

test('keeps an included but non-finalized registration pending', async () => {
  const proof = await makeProof();
  const trace: VerificationTraceEvent[] = [];
  const result = await verifyDocument(pdf, proof, trusted, clientFor(proof, {
    finalizedBlock: 100n,
    receiptBlock: 101n,
    failFinalizedRead: true,
  }), event => trace.push(event));
  assert.equal(result.status, 'pending');
  assert.equal(result.receiptBlockNumber, '101');
  assert.equal(result.finalizedBlock, '100');
  assert.equal(trace.at(-1)?.id, 'finality');
  assert.equal(trace.at(-1)?.state, 'failure');
  assert.equal(trace.some(event => event.id === 'authorized-issuer' || event.id === 'record'), false);
});

test('rejects a receipt or transaction that is not bound to the trusted registration', async () => {
  const proof = await makeProof();
  const wrongRecipient = '0x3333333333333333333333333333333333333333' as Address;
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { transactionTo: wrongRecipient }))).status, 'invalid');
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { eventHash: `0x${'44'.repeat(32)}` }))).status, 'invalid');
  assert.equal((await verifyDocument(pdf, proof, trusted, clientFor(proof, { receiptStatus: 'reverted' }))).status, 'invalid');
});

test('does not treat malformed metadata as a chain result', async () => {
  const proof = await makeProof({ issuedAt: '01799280000' });
  const result = await verifyDocument(pdf, proof, trusted, clientFor(proof, { fail: true }));
  assert.equal(result.status, 'invalid');
});

test('does not let an observer callback change the verification result', async () => {
  const proof = await makeProof();
  const result = await verifyDocument(pdf, proof, trusted, clientFor(proof), () => {
    throw new Error('broken trace renderer');
  });
  assert.equal(result.status, 'match');
});
