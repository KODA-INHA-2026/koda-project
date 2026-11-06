import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { documentDomain, documentRegistryAbi, documentTypes } from '../../packages/chain/src/document-registry.ts';
import {
  parseSignedComparisonFile,
  serializeSignedComparisonFile,
  verifySignedComparison,
} from '../../apps/web/src/live/signed-comparison.ts';
import { sha256, type DocumentProof, type TrustedDeployment, type VerificationClient } from '../../apps/web/src/live/verification.ts';

const issuer = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const contract = '0x1111111111111111111111111111111111111111' as Address;
const otherContract = '0x2222222222222222222222222222222222222222' as Address;
const transactionHash = `0x${'99'.repeat(32)}` as Hex;
const blockHash = `0x${'88'.repeat(32)}` as Hex;
const documentId = `0x${'22'.repeat(32)}` as Hex;
const issuedAt = 1_799_280_000n;
const original = new TextEncoder().encode('%PDF-1.7\nKODA original 100 BTC\n%%EOF');
const alternate = new TextEncoder().encode('%PDF-1.7\nKODA alternate 120 BTC\n%%EOF');
const trusted: TrustedDeployment = { chainId: 11_155_111, contract, issuer: issuer.address };

async function signedProof(bytes: Uint8Array, overrides: Partial<DocumentProof> = {}, signer = issuer, signingContract = contract) {
  const documentHash = await sha256(bytes);
  const message = {
    documentId: overrides.documentId ?? documentId,
    documentHash: overrides.documentHash ?? documentHash,
    issuedAt: BigInt(overrides.issuedAt ?? issuedAt),
  };
  const signature = await signer.signTypedData({
    domain: documentDomain(trusted.chainId, signingContract), types: documentTypes, primaryType: 'Document', message,
  });
  return { documentId, documentHash, issuedAt: issuedAt.toString(), signature, ...overrides } satisfies DocumentProof;
}

type ClientOptions = { outage?: boolean; pending?: boolean; badReceipt?: boolean; calls?: string[] };
function clientFor(reference: DocumentProof, options: ClientOptions = {}) {
  const receiptBlock = options.pending ? 101n : 90n;
  const finalized = 100n;
  const input = encodeFunctionData({
    abi: documentRegistryAbi,
    functionName: 'register',
    args: [reference.documentId, reference.documentHash, BigInt(reference.issuedAt), reference.signature],
  });
  const topics = encodeEventTopics({ abi: documentRegistryAbi, eventName: 'DocumentRegistered', args: { documentId } });
  const data = encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint64' }], [reference.documentHash, BigInt(reference.issuedAt)]);
  const call = (name: string) => {
    options.calls?.push(name);
    if (options.outage) throw new Error('RPC unavailable');
  };
  return {
    async getChainId() { call('chainId'); return trusted.chainId; },
    async getTransaction() {
      call('transaction');
      return { to: trusted.contract, from: trusted.issuer, input };
    },
    async getTransactionReceipt() {
      call('receipt');
      return { status: options.badReceipt ? 'reverted' : 'success', to: trusted.contract, from: trusted.issuer, blockNumber: receiptBlock, blockHash, logs: [{ address: trusted.contract, topics, data }] };
    },
    async getBlock(args: { blockTag?: string; blockNumber?: bigint }) {
      call(args.blockTag === 'finalized' ? 'finalized' : 'included');
      return args.blockTag === 'finalized'
        ? { number: finalized, hash: `0x${'77'.repeat(32)}`, timestamp: 1_799_280_100n }
        : { number: args.blockNumber!, hash: blockHash, timestamp: 1_799_280_050n };
    },
    async readContract(args: { functionName: string }) {
      call(args.functionName);
      return args.functionName === 'authorizedIssuer' ? trusted.issuer : [reference.documentHash, BigInt(reference.issuedAt)] as const;
    },
  } as unknown as VerificationClient;
}

test('accepts a genuine alternate signature locally, then proves conflict against the fully verified registration', async () => {
  const reference = { ...await signedProof(original), transactionHash };
  const candidate = await signedProof(alternate);
  const calls: string[] = [];
  const result = await verifySignedComparison(alternate, candidate, reference, trusted, clientFor(reference, { calls }));
  assert.equal(result.status, 'file-mismatch');
  assert.equal(result.signatureValid, true);
  assert.equal(result.chainRecordValid, true);
  assert.equal(result.fileMatch, true);
  assert.equal(result.signedComparison?.registrationConflict, true);
  assert.deepEqual(calls, ['chainId', 'finalized', 'transaction', 'receipt', 'included', 'authorizedIssuer', 'records']);
});

test('returns match only when the valid candidate also agrees with the finalized registration', async () => {
  const signed = await signedProof(original);
  const reference = { ...signed, transactionHash };
  const result = await verifySignedComparison(original, signed, reference, trusted, clientFor(reference));
  assert.equal(result.status, 'match');
  assert.equal(result.signedComparison?.registrationConflict, false);
});

test('comparison trace distinguishes the new signature from the registered reference', async () => {
  const reference = { ...await signedProof(original), transactionHash };
  const candidate = await signedProof(alternate);
  const trace: { id: string; operation: string; state: string; detail?: string }[] = [];
  await verifySignedComparison(alternate, candidate, reference, trusted, clientFor(reference), event => trace.push(event));
  assert.equal(trace.filter(event => event.id === 'signature' && event.state === 'success').length, 2);
  assert.ok(trace.some(event => event.operation === '등록 원본의 EIP-712 발급자 주소 복구'));
  const final = trace.findLast(event => event.id === 'hash-comparison');
  assert.equal(final?.state, 'failure');
  assert.match(final?.detail ?? '', /새 발급서명과 일치.*기존 등록 원본 해시와는 불일치/);
});

test('treats an issuedAt-only re-sign as a registration conflict, never a success', async () => {
  const reference = { ...await signedProof(original), transactionHash };
  const candidate = await signedProof(original, { issuedAt: (issuedAt + 1n).toString() });
  const result = await verifySignedComparison(original, candidate, reference, trusted, clientFor(reference));
  assert.equal(result.status, 'file-mismatch');
  assert.equal(result.signedComparison?.fileMatch, true);
  assert.equal(result.signedComparison?.registrationConflict, true);
});

test('rejects bad local candidate data before any RPC call', async () => {
  const reference = { ...await signedProof(original), transactionHash };
  const cases = [
    { candidate: await signedProof(alternate, { documentId: `0x${'33'.repeat(32)}` }), bytes: alternate },
    { candidate: await signedProof(alternate, {}, other), bytes: alternate },
    { candidate: await signedProof(alternate, {}, issuer, otherContract), bytes: alternate },
    { candidate: await signedProof(alternate), bytes: original },
  ];
  for (const value of cases) {
    const calls: string[] = [];
    const result = await verifySignedComparison(value.bytes, value.candidate, reference, trusted, clientFor(reference, { calls }));
    assert.notEqual(result.status, 'match');
    assert.equal(result.signedComparison?.registrationConflict ?? false, false);
    assert.deepEqual(calls, []);
  }
});

test('never reports a conflict when the registered reference is unavailable, pending, or invalid', async () => {
  const reference = { ...await signedProof(original), transactionHash };
  const candidate = await signedProof(alternate);
  for (const options of [{ outage: true }, { pending: true }, { badReceipt: true }]) {
    const result = await verifySignedComparison(alternate, candidate, reference, trusted, clientFor(reference, options));
    assert.notEqual(result.status, 'match');
    assert.equal(result.signedComparison?.registrationConflict, false);
    assert.notEqual(result.chainRecordValid, true);
  }
});

test('serializes and parses only a candidate anchored to the known deployment and reference transaction', async () => {
  const reference = { ...await signedProof(original), transactionHash };
  const candidate = await signedProof(alternate);
  const serialized = serializeSignedComparisonFile(candidate, reference, trusted);
  assert.deepEqual(parseSignedComparisonFile(serialized, reference, trusted), candidate);

  const wrongReference = { ...reference, transactionHash: `0x${'55'.repeat(32)}` as Hex };
  assert.throws(() => parseSignedComparisonFile(serialized, wrongReference, trusted), /등록 원본/);
  const changedTrust = { ...trusted, contract: otherContract };
  assert.throws(() => parseSignedComparisonFile(serialized, reference, changedTrust), /등록 원본/);
  const injected = JSON.parse(serialized);
  injected.candidate.transactionHash = transactionHash;
  assert.throws(() => parseSignedComparisonFile(JSON.stringify(injected), reference, trusted), /등록 원본/);
  const changedTime = JSON.parse(serialized);
  changedTime.candidate.issuedAt = (BigInt(reference.issuedAt) + 1n).toString();
  assert.throws(() => parseSignedComparisonFile(JSON.stringify(changedTime), reference, trusted), /발급 기재시각/);
});
