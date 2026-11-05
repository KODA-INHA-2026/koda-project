import { createPublicClient, createWalletClient, custom, encodeDeployData, getAddress, http, isAddressEqual, type Address, type EIP1193Provider, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { documentRegistryAbi, documentDomain, documentTypes, type DocumentRegistryArtifact } from '../../../../packages/chain/src/document-registry';
import compiled from './generated/DocumentRegistry.json';
import type { Proof, TrustedDeployment } from './verification';

export const artifact = compiled as DocumentRegistryArtifact;
export const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
export const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL, { retryCount: 1, timeout: 15_000 }) });
type Injected = EIP1193Provider & { isMetaMask?: boolean; providers?: Injected[] };
function injectedWallet() {
  const injected = (window as Window & { ethereum?: Injected }).ethereum;
  const provider = injected?.providers?.find(p => p.isMetaMask) ?? injected;
  if (!provider) throw new Error('MetaMask가 설치된 브라우저에서 이 로컬 페이지를 열어 주세요.');
  return createWalletClient({ chain: sepolia, transport: custom(provider) });
}
export async function restoreWallet() {
  try {
    const wallet = injectedWallet();
    const [account] = await wallet.getAddresses(); // eth_accounts reuses an existing permission; no prompt.
    if (!account || await wallet.getChainId() !== sepolia.id) return undefined;
    return { wallet, account: getAddress(account) };
  } catch { return undefined; }
}
export async function connectWallet() {
  const wallet = injectedWallet();
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error('연결된 시험 계정이 없습니다.');
  if (await wallet.getChainId() !== sepolia.id) throw new Error('MetaMask 네트워크를 Ethereum Sepolia로 변경한 뒤 다시 연결해 주세요.');
  if (await publicClient.getChainId() !== sepolia.id) throw new Error('조회 RPC의 체인이 Sepolia와 다릅니다.');
  return { wallet, account: getAddress(account) };
}
export type Connection = Awaited<ReturnType<typeof connectWallet>>;

export async function assertWallet(connection: Connection, issuer = connection.account) {
  const [current] = await connection.wallet.getAddresses();
  if (await connection.wallet.getChainId() !== sepolia.id || !current || !isAddressEqual(current, issuer)) {
    throw new Error('네트워크 또는 계정이 바뀌었습니다. Sepolia 시험 발급자 계정으로 다시 연결해 주세요.');
  }
}

export async function inspectDeployment(trusted: TrustedDeployment) {
  if (trusted.chainId !== sepolia.id || await publicClient.getChainId() !== sepolia.id) throw new Error('Sepolia 체인이 아닙니다.');
  const code = await publicClient.getBytecode({ address: trusted.contract });
  if (!code) throw new Error('해당 주소에 컨트랙트 코드가 없습니다.');
  const mask = (value: string) => {
    let result = value.slice(2).toLowerCase();
    for (const slots of Object.values(artifact.immutableReferences)) for (const slot of slots) {
      result = result.slice(0, slot.start * 2) + '0'.repeat(slot.length * 2) + result.slice((slot.start + slot.length) * 2);
    }
    return result;
  };
  if (code.length !== artifact.deployedBytecode.length || mask(code) !== mask(artifact.deployedBytecode)) throw new Error('배포 코드가 이 데모의 컴파일 결과와 다릅니다.');
  const issuer = await publicClient.readContract({ address: trusted.contract, abi: documentRegistryAbi, functionName: 'authorizedIssuer' });
  if (!isAddressEqual(issuer, trusted.issuer)) throw new Error('컨트랙트의 발급자와 사전 지정 시험 발급자가 다릅니다.');
  if (!trusted.deploymentTransaction) throw new Error('신뢰 기준에 배포 거래가 없습니다.');
  const [receipt, tx] = await Promise.all([
    publicClient.getTransactionReceipt({ hash: trusted.deploymentTransaction }),
    publicClient.getTransaction({ hash: trusted.deploymentTransaction }),
  ]);
  const expectedInput = encodeDeployData({ abi: documentRegistryAbi, bytecode: artifact.bytecode, args: [trusted.issuer] });
  if (receipt.status !== 'success' || !receipt.contractAddress || !isAddressEqual(receipt.contractAddress, trusted.contract) || tx.input.toLowerCase() !== expectedInput.toLowerCase()) {
    throw new Error('배포 거래·생성 코드·발급자 인자가 일치하지 않습니다.');
  }
  const [included, finalized] = await Promise.all([
    publicClient.getBlock({ blockNumber: receipt.blockNumber }), publicClient.getBlock({ blockTag: 'finalized' }),
  ]);
  if (included.hash !== receipt.blockHash) throw new Error('배포 블록이 현재 정식 체인과 다릅니다.');
  if (receipt.blockNumber > finalized.number) throw new Error('배포는 블록에 포함됐고 최종 확정 대기 중입니다. 잠시 뒤 배포 결과를 다시 조회해 주세요. 재배포할 필요는 없습니다.');
}

export async function recoverDeployment(hash: Hex, issuer: Address): Promise<TrustedDeployment> {
  const receipt = await publicClient.getTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('배포 거래가 성공하지 않았습니다.');
  const trusted: TrustedDeployment = { chainId: 11155111, contract: receipt.contractAddress, issuer, deploymentTransaction: hash };
  await inspectDeployment(trusted);
  return trusted;
}

export async function deployRegistry(connection: Connection, onSent: (hash: Hex) => void): Promise<TrustedDeployment> {
  await assertWallet(connection);
  const hash = await connection.wallet.deployContract({ account: connection.account, abi: documentRegistryAbi, bytecode: artifact.bytecode, args: [connection.account] });
  onSent(hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('배포 거래가 성공하지 않았습니다.');
  return recoverDeployment(hash, connection.account);
}

export async function signDocument(connection: Connection, trusted: TrustedDeployment, message: Omit<Proof, 'signature' | 'transactionHash'>) {
  await assertWallet(connection, trusted.issuer);
  return connection.wallet.signTypedData({ account: trusted.issuer, domain: documentDomain(sepolia.id, trusted.contract), types: documentTypes, primaryType: 'Document', message: { ...message, issuedAt: BigInt(message.issuedAt) } });
}

export async function registerDocument(connection: Connection, trusted: TrustedDeployment, proof: Proof) {
  await assertWallet(connection, trusted.issuer);
  await inspectDeployment(trusted);
  const { request } = await publicClient.simulateContract({ account: trusted.issuer, address: trusted.contract, abi: documentRegistryAbi, functionName: 'register', args: [proof.documentId, proof.documentHash, BigInt(proof.issuedAt), proof.signature] });
  return connection.wallet.writeContract(request);
}

export const transactionUrl = (hash: Hex) => `https://sepolia.etherscan.io/tx/${hash}`;
export const addressUrl = (address: Address) => `https://sepolia.etherscan.io/address/${address}`;
