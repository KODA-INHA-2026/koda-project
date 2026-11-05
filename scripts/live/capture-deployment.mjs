import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createPublicClient, http, decodeDeployData, isAddressEqual, keccak256 } from 'viem';
import { sepolia } from 'viem/chains';

const transactionHash = process.argv[2];
if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash ?? '')) throw new Error('Pass a public Sepolia deployment transaction hash.');
const rpc = 'https://ethereum-sepolia-rpc.publicnode.com';
const client = createPublicClient({ chain: sepolia, transport: http(rpc, { timeout: 20000, retryCount: 1 }) });
const artifact = JSON.parse(readFileSync('apps/web/src/live/generated/DocumentRegistry.json', 'utf8'));
const [chainId, receipt, transaction, finalized, latest] = await Promise.all([
  client.getChainId(), client.getTransactionReceipt({ hash: transactionHash }), client.getTransaction({ hash: transactionHash }),
  client.getBlock({ blockTag: 'finalized' }), client.getBlock({ blockTag: 'latest' }),
]);
if (chainId !== 11155111 || receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Not a successful Sepolia deployment.');
const [included, code, issuer] = await Promise.all([
  client.getBlock({ blockNumber: receipt.blockNumber }), client.getBytecode({ address: receipt.contractAddress }),
  client.readContract({ address: receipt.contractAddress, abi: artifact.abi, functionName: 'authorizedIssuer' }),
]);
const decoded = decodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, data: transaction.input });
const stripImmutables = (value) => {
  let masked = value.slice(2).toLowerCase();
  for (const slots of Object.values(artifact.immutableReferences)) for (const { start, length } of slots) masked = masked.slice(0,start*2) + '0'.repeat(length*2) + masked.slice((start+length)*2);
  return masked;
};
const checks = {
  transactionCreatesContract: transaction.to === null,
  zeroEthValue: transaction.value === 0n,
  creationCodeMatches: transaction.input.toLowerCase().startsWith(artifact.bytecode.toLowerCase()),
  constructorIssuerMatches: isAddressEqual(decoded.args[0], issuer),
  deploymentSenderIsIssuer: isAddressEqual(transaction.from, issuer),
  runtimeCodeMatches: !!code && code.length === artifact.deployedBytecode.length && stripImmutables(code) === stripImmutables(artifact.deployedBytecode),
  canonicalIncludedBlock: included.hash === receipt.blockHash,
  finalized: receipt.blockNumber <= finalized.number,
};
const observation = {
  capturedAtUtc: new Date().toISOString(), chainId, network: 'Ethereum Sepolia', rpc,
  contractAddress: receipt.contractAddress, authorizedIssuer: issuer, deploymentTransaction: transactionHash,
  deploymentBlock: receipt.blockNumber, deploymentBlockHash: receipt.blockHash,
  deploymentBlockTimeUtc: new Date(Number(included.timestamp)*1000).toISOString(),
  latestBlock: latest.number, finalizedBlock: finalized.number,
  finalizedBlockTimeUtc: new Date(Number(finalized.timestamp)*1000).toISOString(),
  gasUsed: receipt.gasUsed, effectiveGasPriceWei: receipt.effectiveGasPrice,
  gasFeeWei: receipt.gasUsed * receipt.effectiveGasPrice,
  bytecodeKeccak256: code ? keccak256(code) : null,
  sourceSha256: artifact.sourceSha256, compiler: artifact.compiler,
  openZeppelinVersion: JSON.parse(readFileSync('node_modules/@openzeppelin/contracts/package.json','utf8')).version,
  checks, receipt,
  explorerTransaction: `https://sepolia.etherscan.io/tx/${transactionHash}`,
  explorerContract: `https://sepolia.etherscan.io/address/${receipt.contractAddress}`,
};
const folder = 'docs/portfolio/2026-11-06-sepolia';
mkdirSync(folder, { recursive: true });
const content = JSON.stringify(observation, (_,value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n';
const stamp = observation.capturedAtUtc.replace(/[:.]/g,'-');
writeFileSync(`${folder}/deployment-${stamp}.json`, content);
writeFileSync(`${folder}/deployment-latest.json`, content);
console.log(JSON.stringify({ ...observation, receipt: undefined, artifactEvidenceSha256: createHash('sha256').update(content).digest('hex') }, (_,value) => typeof value === 'bigint' ? value.toString() : value, 2));
if (Object.entries(checks).some(([name,value]) => name !== 'finalized' && !value)) process.exitCode = 1;
