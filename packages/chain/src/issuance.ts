import { chainClients, anchorAbi, checkInstance } from './client.js';
import { anchorReader } from './reader.js';
import type { AnchorLocator, TrustedConfig } from '@koda/protocol';
import type { Hex } from 'viem';

export class AnchorJobError extends Error {
  constructor(public state: 'PENDING' | 'FAILED' | 'UNAVAILABLE', public reasonCode: string) { super(reasonCode); }
}
// Replay a durable commitment, never generate new signing bytes on retry.
export async function resumeCommitment(config: TrustedConfig, key: Hex, commitment: Hex, priorTx: Hex | null, sent: (hash: Hex) => void): Promise<AnchorLocator> {
  const { publicClient, walletClient } = chainClients(config.rpc, key);
  let txHash = priorTx;
  try {
    await checkInstance(config);
    const exists = await publicClient.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'isAnchored', args: [commitment] });
    if (exists) {
      // Covers a crash after chain confirmation but before persisting txHash/receipt.
      const events = await publicClient.getLogs({ address: config.contractAddress, fromBlock: BigInt(config.deploymentBlockNumber), toBlock: 'latest' });
      // Decode with the ABI instead of trusting the DB's old receipt.
      const { parseEventLogs } = await import('viem');
      const matches = parseEventLogs({ abi: anchorAbi, eventName: 'Anchored', logs: events, strict: true }).filter(e => e.args.commitment === commitment);
      if (matches.length !== 1 || !matches[0]!.transactionHash) throw new AnchorJobError('UNAVAILABLE', 'RECORD_NOT_FOUND');
      txHash = matches[0]!.transactionHash; sent(txHash);
    } else if (txHash) {
      let receipt;
      try { receipt = await publicClient.getTransactionReceipt({ hash: txHash }); }
      catch (e) {
        if (e instanceof Error && e.name === 'TransactionReceiptNotFoundError') throw new AnchorJobError('PENDING', 'RECEIPT_PENDING');
        throw e;
      }
      if (receipt.status === 'reverted') txHash = null;
      else throw new AnchorJobError('UNAVAILABLE', 'RECORD_NOT_FOUND');
    }
    if (!txHash) {
      const { request } = await publicClient.simulateContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'anchor', args: [commitment], account: walletClient!.account });
      txHash = await walletClient!.writeContract(request); sent(txHash);
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 8000 });
    if (receipt.status !== 'success') throw new AnchorJobError('FAILED', 'TRANSACTION_REVERTED');
    const locator = { txHash, blockHash: receipt.blockHash, instanceId: config.instanceId };
    const result = await anchorReader(config)(commitment, locator);
    if (result.status !== 'PASS') throw new AnchorJobError(result.status === 'FAIL' ? 'FAILED' : 'UNAVAILABLE', result.reasonCode);
    return locator;
  } catch (e) {
    if (e instanceof AnchorJobError) throw e;
    const message = e instanceof Error ? e.message : '';
    if (message === 'CHAIN_INSTANCE_CHANGED') throw new AnchorJobError('UNAVAILABLE', 'CHAIN_INSTANCE_CHANGED');
    if (/Unauthorized|InvalidCommitment/.test(message)) throw new AnchorJobError('FAILED', 'CONTRACT_REJECTED');
    throw new AnchorJobError(txHash ? 'PENDING' : 'UNAVAILABLE', txHash ? 'RECEIPT_PENDING' : 'RPC_UNAVAILABLE');
  }
}
