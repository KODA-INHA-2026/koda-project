import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Address, Hex, TransactionReceipt } from 'viem';
import {
  getDeploymentProgress,
  type DeploymentProgressClient,
} from '../../apps/web/src/live/deployment-progress.ts';

const transactionHash = `0x${'11'.repeat(32)}` as Hex;
const blockHash = `0x${'22'.repeat(32)}` as Hex;
const contract = `0x${'33'.repeat(20)}` as Address;

const receipt: TransactionReceipt = {
  blockHash,
  blockNumber: 12071288n,
  contractAddress: contract,
  cumulativeGasUsed: 1n,
  effectiveGasPrice: 1n,
  from: `0x${'44'.repeat(20)}` as Address,
  gasUsed: 1n,
  logs: [],
  logsBloom: `0x${'00'.repeat(256)}` as Hex,
  status: 'success' as const,
  to: null,
  transactionHash,
  transactionIndex: 0,
  type: 'eip1559' as const,
};

function client(overrides: {
  chainId?: number;
  receipt?: TransactionReceipt;
  receiptError?: Error;
  includedHash?: Hex;
  includedTimestamp?: bigint;
  finalizedNumber?: bigint | null;
  blockError?: Error;
} = {}) {
  return {
    getChainId: async () => overrides.chainId ?? 11155111,
    getTransactionReceipt: async () => {
      if (overrides.receiptError) throw overrides.receiptError;
      return overrides.receipt ?? receipt;
    },
    getBlock: async (request: { blockNumber?: bigint; blockTag?: string }) => {
      if (overrides.blockError) throw overrides.blockError;
      if (request.blockTag === 'finalized') {
        return { number: overrides.finalizedNumber ?? 12071228n, hash: `0x${'55'.repeat(32)}`, timestamp: 1_799_280_100n };
      }
      return {
        number: request.blockNumber ?? receipt.blockNumber,
        hash: overrides.includedHash ?? blockHash,
        timestamp: overrides.includedTimestamp ?? 1_799_280_000n,
      };
    },
  } as unknown as DeploymentProgressClient;
}

test('reports a missing receipt as pending', async () => {
  const missing = new Error('not found');
  missing.name = 'TransactionReceiptNotFoundError';
  assert.deepEqual(await getDeploymentProgress(client({ receiptError: missing }), transactionHash), {
    phase: 'pending',
    message: '배포 거래가 아직 블록에 포함되지 않았습니다.',
  });
});

test('reports an included deployment separately from finalized', async () => {
  const result = await getDeploymentProgress(client(), transactionHash);
  assert.equal(result.phase, 'included');
  assert.equal(result.contract, contract);
  assert.equal(result.includedBlock, '12071288');
  assert.equal(result.finalizedBlock, '12071228');
  assert.equal(result.blockTimeUtc, '2027-01-07T00:00:00.000Z');
});

test('reports a deployment at or below the finalized head as finalized', async () => {
  const result = await getDeploymentProgress(client({ finalizedNumber: 12071288n }), transactionHash);
  assert.equal(result.phase, 'finalized');
  assert.equal(result.contract, contract);
});

test('reports a reverted deployment', async () => {
  const result = await getDeploymentProgress(client({ receipt: { ...receipt, status: 'reverted', contractAddress: null } }), transactionHash);
  assert.deepEqual(result, {
    phase: 'reverted',
    includedBlock: '12071288',
    message: '배포 거래가 블록에 포함됐지만 실행이 되돌려졌습니다.',
  });
});

test('rejects a receipt whose block is no longer canonical', async () => {
  const result = await getDeploymentProgress(client({ includedHash: `0x${'66'.repeat(32)}` }), transactionHash);
  assert.equal(result.phase, 'unavailable');
  assert.match(result.message, /정식 체인/);
});

test('rejects a client connected to the wrong chain', async () => {
  const result = await getDeploymentProgress(client({ chainId: 1 }), transactionHash);
  assert.equal(result.phase, 'unavailable');
  assert.match(result.message, /Sepolia/);
});

test('turns RPC failures into unavailable results', async () => {
  const result = await getDeploymentProgress(client({ blockError: new Error('RPC offline') }), transactionHash);
  assert.deepEqual(result, {
    phase: 'unavailable',
    message: 'Sepolia 배포 상태를 조회할 수 없습니다.',
  });
});
