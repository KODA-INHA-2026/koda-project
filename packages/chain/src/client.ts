import { createPublicClient, createWalletClient, http, parseAbi, parseEventLogs, type Hex, type Address, type PublicClient, type WalletClient, type HttpTransport, type PrivateKeyAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
export const anchorAbi = parseAbi([
  'constructor(address writer_, bytes32 instanceId_)',
  'function writer() view returns (address)', 'function instanceId() view returns (bytes32)',
  'function anchor(bytes32 commitment)', 'function isAnchored(bytes32 commitment) view returns (bool)',
  'event Anchored(bytes32 indexed commitment)', 'error Unauthorized()', 'error InvalidCommitment()', 'error AlreadyAnchored()',
]);
export interface TrustedConfig { chainId: number; contractAddress: Address; instanceId: Hex; writer: Address; deploymentTx: Hex; deploymentBlockHash: Hex; deploymentBlockNumber: string; rpc: string; issuerSigningDid: string }
export function chainClients(rpc: string, privateKey?: Hex): { publicClient: PublicClient<HttpTransport, typeof hardhat>; walletClient: WalletClient<HttpTransport, typeof hardhat, PrivateKeyAccount> | undefined } {
  const url = new URL(rpc);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Only loopback demo RPC is allowed');
  const publicClient = createPublicClient({ chain: hardhat, transport: http(rpc, { timeout: 3000, retryCount: 0 }) });
  const walletClient = privateKey ? createWalletClient({ account: privateKeyToAccount(privateKey), chain: hardhat, transport: http(rpc, { timeout: 3000, retryCount: 0 }) }) : undefined;
  return { publicClient, walletClient };
}
export async function checkInstance(config: TrustedConfig): Promise<void> {
  const { publicClient: client } = chainClients(config.rpc);
  const [chainId, instance, writer, block, receipt] = await Promise.all([
    client.getChainId(), client.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'instanceId' }),
    client.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'writer' }),
    client.getBlock({ blockNumber: BigInt(config.deploymentBlockNumber) }), client.getTransactionReceipt({ hash: config.deploymentTx }),
  ]);
  if (chainId !== config.chainId || instance !== config.instanceId || writer.toLowerCase() !== config.writer.toLowerCase() || block.hash !== config.deploymentBlockHash || receipt.status !== 'success' || receipt.contractAddress?.toLowerCase() !== config.contractAddress.toLowerCase() || receipt.blockHash !== config.deploymentBlockHash) throw new Error('CHAIN_INSTANCE_CHANGED');
}
export async function recordCommitment(config: TrustedConfig, privateKey: Hex, commitment: Hex) {
  await checkInstance(config);
  const { publicClient, walletClient } = chainClients(config.rpc, privateKey);
  const { request } = await publicClient.simulateContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'anchor', args: [commitment], account: walletClient!.account });
  const txHash = await walletClient!.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 10000 });
  const logs = parseEventLogs({ abi: anchorAbi, logs: receipt.logs, eventName: 'Anchored', strict: true });
  const record = await publicClient.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'isAnchored', args: [commitment] });
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  if (receipt.status !== 'success' || receipt.to?.toLowerCase() !== config.contractAddress.toLowerCase() || block.hash !== receipt.blockHash || !record || !logs.some(log => log.address.toLowerCase() === config.contractAddress.toLowerCase() && log.args.commitment === commitment)) throw new Error('ANCHOR_NOT_CONFIRMED');
  return { txHash, blockHash: receipt.blockHash };
}
