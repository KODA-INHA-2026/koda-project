import { createPublicClient, http, parseAbi, parseEventLogs, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import type { AnchorReadPort, TrustedConfig } from '@koda/protocol';

// Read-only browser entry: no wallet, fixture, signing key or server dependency.
export const readAbi = parseAbi([
  'function writer() view returns (address)', 'function instanceId() view returns (bytes32)',
  'function isAnchored(bytes32 commitment) view returns (bool)', 'event Anchored(bytes32 indexed commitment)',
]);
export function anchorReader(config: TrustedConfig): AnchorReadPort {
  const url = new URL(config.rpc);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Only fixed loopback demo RPC allowed');
  const client = createPublicClient({ chain: hardhat, transport: http(config.rpc, { timeout: 3000, retryCount: 0 }) });
  return async (commitment, locator) => {
    const unavailable = (reasonCode: string) => ({ status: 'UNAVAILABLE' as const, reasonCode });
    const mismatch = (reasonCode: string) => ({ status: 'FAIL' as const, reasonCode });
    try {
      if (await client.getChainId() !== config.chainId) return unavailable('CHAIN_INSTANCE_CHANGED');
      const code = await client.getCode({ address: config.contractAddress });
      if (!code || code === '0x') return unavailable('CHAIN_INSTANCE_CHANGED');
      const [instance, writer] = await Promise.all([
        client.readContract({ address: config.contractAddress, abi: readAbi, functionName: 'instanceId' }),
        client.readContract({ address: config.contractAddress, abi: readAbi, functionName: 'writer' }),
      ]);
      if (instance !== config.instanceId || writer.toLowerCase() !== config.writer.toLowerCase()) return unavailable('CHAIN_INSTANCE_CHANGED');
      const deployment = await client.getTransactionReceipt({ hash: config.deploymentTx });
      const deploymentBlock = await client.getBlock({ blockNumber: BigInt(config.deploymentBlockNumber) });
      if (deployment.status !== 'success' || deployment.contractAddress?.toLowerCase() !== config.contractAddress.toLowerCase() || deployment.blockHash !== config.deploymentBlockHash || deploymentBlock.hash !== config.deploymentBlockHash || String(deployment.blockNumber) !== config.deploymentBlockNumber) return unavailable('CHAIN_INSTANCE_CHANGED');
      const stored = await client.readContract({ address: config.contractAddress, abi: readAbi, functionName: 'isAnchored', args: [commitment] });
      if (!stored) return unavailable('RECORD_NOT_FOUND');
      const receipt = await client.getTransactionReceipt({ hash: locator.txHash as Hex });
      if (receipt.status !== 'success') return unavailable('TRANSACTION_REVERTED');
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (block.hash !== receipt.blockHash) return unavailable('CHAIN_INSTANCE_CHANGED');
      const events = parseEventLogs({ abi: readAbi, logs: receipt.logs, eventName: 'Anchored', strict: true });
      if (locator.instanceId !== config.instanceId || receipt.blockHash !== locator.blockHash || receipt.to?.toLowerCase() !== config.contractAddress.toLowerCase() || receipt.from.toLowerCase() !== config.writer.toLowerCase() || !events.some(e => e.address.toLowerCase() === config.contractAddress.toLowerCase() && e.args.commitment === commitment)) return mismatch('ANCHOR_RECEIPT_MISMATCH');
      return { status: 'PASS', reasonCode: 'ANCHOR_CONFIRMED', evidence: { blockNumber: String(block.number), blockHash: block.hash!, recordedAt: new Date(Number(block.timestamp) * 1000).toISOString() } };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      return unavailable(name === 'TransactionReceiptNotFoundError' ? 'RECEIPT_NOT_FOUND' : name === 'BlockNotFoundError' ? 'CHAIN_INSTANCE_CHANGED' : 'RPC_UNAVAILABLE');
    }
  };
}
