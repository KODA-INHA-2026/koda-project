import {
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { sepolia } from 'viem/chains';

export type DeploymentProgressClient = Pick<
  PublicClient,
  'getChainId' | 'getTransactionReceipt' | 'getBlock'
>;

export interface DeploymentProgress {
  phase: 'pending' | 'included' | 'finalized' | 'reverted' | 'unavailable';
  contract?: Address;
  includedBlock?: string;
  finalizedBlock?: string;
  blockTimeUtc?: string;
  message: string;
}

function isReceiptMissing(error: unknown) {
  return error instanceof Error && error.name === 'TransactionReceiptNotFoundError';
}

const unavailable = (message: string): DeploymentProgress => ({
  phase: 'unavailable',
  message,
});

export async function getDeploymentProgress(
  client: DeploymentProgressClient,
  hash: Hex,
): Promise<DeploymentProgress> {
  try {
    if (await client.getChainId() !== sepolia.id) {
      return unavailable('조회 노드가 Ethereum Sepolia에 연결되지 않았습니다.');
    }

    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash });
    } catch (error) {
      if (isReceiptMissing(error)) {
        return { phase: 'pending', message: '배포 거래가 아직 블록에 포함되지 않았습니다.' };
      }
      return unavailable('배포 거래 영수증을 조회할 수 없습니다.');
    }

    const includedBlock = receipt.blockNumber.toString();
    if (receipt.status === 'reverted') {
      return {
        phase: 'reverted',
        includedBlock,
        message: '배포 거래가 블록에 포함됐지만 실행이 되돌려졌습니다.',
      };
    }
    if (receipt.to !== null || !receipt.contractAddress) {
      return unavailable('해당 거래는 성공한 컨트랙트 배포 거래가 아닙니다.');
    }

    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    if (!block.hash || block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
      return unavailable('배포 거래가 포함된 블록이 현재 정식 체인과 일치하지 않습니다.');
    }
    const blockTimeUtc = new Date(Number(block.timestamp) * 1_000).toISOString();

    const finalized = await client.getBlock({ blockTag: 'finalized' });
    if (finalized.number === null) {
      return unavailable('Sepolia finalized 블록 번호를 확인할 수 없습니다.');
    }
    const finalizedBlock = finalized.number.toString();
    if (receipt.blockNumber > finalized.number) {
      return {
        phase: 'included',
        contract: receipt.contractAddress,
        includedBlock,
        finalizedBlock,
        blockTimeUtc,
        message: '컨트랙트가 블록에 포함됐고 finalized 상태를 기다리고 있습니다.',
      };
    }

    return {
      phase: 'finalized',
      contract: receipt.contractAddress,
      includedBlock,
      finalizedBlock,
      blockTimeUtc,
      message: '컨트랙트 배포가 Ethereum Sepolia에서 finalized 상태입니다.',
    };
  } catch {
    return unavailable('Sepolia 배포 상태를 조회할 수 없습니다.');
  }
}
