import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEther,
  parseEventLogs,
  stringToHex,
  toFunctionSelector,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  documentDomain,
  documentRegistryAbi,
  documentTypes,
  type DocumentMessage,
  type DocumentRegistryArtifact,
} from '../../packages/chain/src/document-registry.ts';

const issuer = privateKeyToAccount(generatePrivateKey());
const outsider = privateKeyToAccount(generatePrivateKey());
function clientsAt(rpc: string) {
  const transport = http(rpc, { retryCount: 0, timeout: 3_000 });
  return {
    publicClient: createPublicClient({ chain: hardhat, transport }),
    issuerClient: createWalletClient({ chain: hardhat, transport, account: issuer }),
    outsiderClient: createWalletClient({ chain: hardhat, transport, account: outsider }),
  };
}
let publicClient!: ReturnType<typeof clientsAt>['publicClient'];
let issuerClient!: ReturnType<typeof clientsAt>['issuerClient'];
let outsiderClient!: ReturnType<typeof clientsAt>['outsiderClient'];
let rpcUrl = '';
const artifact = JSON.parse(
  readFileSync('packages/chain/artifacts/DocumentRegistry.json', 'utf8'),
) as DocumentRegistryArtifact;

let chainProcess: ChildProcess | undefined;
let contract: Address;

async function reservePort() {
  return new Promise<number>((resolvePromise, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve an ephemeral test port.'));
        return;
      }
      server.close(() => resolvePromise(address.port));
    });
  });
}

async function waitForChain() {
  let lastError: unknown;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (!chainProcess || chainProcess.exitCode !== null) throw new Error('Hardhat test chain exited early.');
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: AbortSignal.timeout(1_000),
      });
      if (!response.ok || (await response.json() as { result?: string }).result !== '0x7a69') {
        throw new Error('Hardhat JSON-RPC returned an unexpected response.');
      }
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error('Hardhat test chain did not become ready.', { cause: lastError });
}

async function stopChain() {
  const child = chainProcess;
  chainProcess = undefined;
  if (!child || child.exitCode !== null) return;
  await new Promise<void>((resolvePromise) => {
    const force = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(force);
      resolvePromise();
    });
    child.kill('SIGTERM');
  });
}

async function signature(message: DocumentMessage, overrides: { chainId?: number; contract?: Address; signer?: typeof issuer } = {}) {
  const signer = overrides.signer ?? issuer;
  return signer.signTypedData({
    domain: documentDomain(overrides.chainId ?? hardhat.id, overrides.contract ?? contract),
    types: documentTypes,
    primaryType: 'Document',
    message,
  });
}

async function simulateRegister(
  message: DocumentMessage,
  signed: Hex,
  account: typeof issuer | typeof outsider = issuer,
) {
  return publicClient.simulateContract({
    address: contract,
    abi: documentRegistryAbi,
    functionName: 'register',
    args: [message.documentId, message.documentHash, message.issuedAt, signed],
    account,
  });
}

async function expectRevert(action: Promise<unknown>, name: string) {
  await assert.rejects(action, new RegExp(name));
}

before(async () => {
  const port = await reservePort();
  const rpc = `http://127.0.0.1:${port}`;
  rpcUrl = rpc;
  ({ publicClient, issuerClient, outsiderClient } = clientsAt(rpc));
  const runtimeDirectory = resolve('.demo', `live-registry-test-${process.pid}-${randomUUID()}`);
  mkdirSync(runtimeDirectory, { recursive: true });
  const log = openSync(resolve(runtimeDirectory, 'hardhat.log'), 'a', 0o600);
  try {
    chainProcess = spawn(
      process.execPath,
      [
        'node_modules/hardhat/dist/src/cli.js',
        '--config',
        'packages/chain/hardhat.config.ts',
        'node',
        '--network',
        'default',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        stdio: ['ignore', log, log],
        env: {
          ...process.env,
          XDG_CACHE_HOME: runtimeDirectory,
          XDG_CONFIG_HOME: runtimeDirectory,
          XDG_DATA_HOME: runtimeDirectory,
        },
      },
    );
  } finally {
    closeSync(log);
  }
  try {
    await waitForChain();
    await Promise.all([
      publicClient.request({ method: 'hardhat_setBalance' as never, params: [issuer.address, toHex(parseEther('10'))] as never }),
      publicClient.request({ method: 'hardhat_setBalance' as never, params: [outsider.address, toHex(parseEther('10'))] as never }),
    ]);
    const deploymentHash = await issuerClient.deployContract({
      abi: documentRegistryAbi,
      bytecode: artifact.bytecode,
      args: [issuer.address],
    });
    const deploymentReceipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash });
    assert.equal(deploymentReceipt.status, 'success');
    assert.ok(deploymentReceipt.contractAddress);
    contract = deploymentReceipt.contractAddress;
  } catch (error) {
    await stopChain();
    throw error;
  }
});

after(stopChain);

test('registers one signed PDF hash and reads the immutable record back', async () => {
  const message: DocumentMessage = {
    documentId: keccak256(stringToHex('KODA-DEMO-2026-0001')),
    documentHash: `0x${'12'.repeat(32)}`,
    issuedAt: 1_799_279_999n,
  };
  const signed = await signature(message);
  const { request } = await simulateRegister(message, signed);
  const transactionHash = await issuerClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  assert.equal(receipt.status, 'success');
  const events = parseEventLogs({
    abi: documentRegistryAbi,
    logs: receipt.logs,
    eventName: 'DocumentRegistered',
    strict: true,
  });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0]!.args, message);

  const [documentHash, issuedAt] = await publicClient.readContract({
    address: contract,
    abi: documentRegistryAbi,
    functionName: 'records',
    args: [message.documentId],
  });
  assert.equal(documentHash, message.documentHash);
  assert.equal(issuedAt, message.issuedAt);

  await expectRevert(simulateRegister(message, signed), 'AlreadyRegistered');
  const unchanged = await publicClient.readContract({
    address: contract,
    abi: documentRegistryAbi,
    functionName: 'records',
    args: [message.documentId],
  });
  assert.deepEqual(unchanged, [message.documentHash, message.issuedAt]);
});

test('rejects unauthorized caller and signatures for another signer, chain, or contract', async () => {
  const base: DocumentMessage = {
    documentId: keccak256(stringToHex('KODA-DEMO-2026-0002')),
    documentHash: `0x${'34'.repeat(32)}`,
    issuedAt: 1_799_280_000n,
  };
  await expectRevert(simulateRegister(base, await signature(base, { signer: outsider }), outsider), 'Unauthorized');
  await expectRevert(simulateRegister(base, await signature(base, { signer: outsider })), 'InvalidSignature');
  await expectRevert(simulateRegister(base, await signature(base, { chainId: hardhat.id + 1 })), 'InvalidSignature');
  await expectRevert(simulateRegister(base, await signature(base, { contract: zeroAddress })), 'InvalidSignature');
  assert.deepEqual(
    await publicClient.readContract({ address: contract, abi: documentRegistryAbi, functionName: 'records', args: [base.documentId] }),
    [`0x${'00'.repeat(32)}`, 0n],
  );
});

test('rejects tampered fields and zero values without creating a record', async () => {
  const base: DocumentMessage = {
    documentId: keccak256(stringToHex('KODA-DEMO-2026-0003')),
    documentHash: `0x${'56'.repeat(32)}`,
    issuedAt: 1_799_280_001n,
  };
  const signed = await signature(base);
  await expectRevert(simulateRegister({ ...base, documentHash: `0x${'78'.repeat(32)}` }, signed), 'InvalidSignature');
  await expectRevert(simulateRegister({ ...base, issuedAt: base.issuedAt + 1n }, signed), 'InvalidSignature');
  await expectRevert(simulateRegister({ ...base, documentId: `0x${'00'.repeat(32)}` }, signed), 'InvalidDocumentId');
  await expectRevert(simulateRegister({ ...base, documentHash: `0x${'00'.repeat(32)}` }, signed), 'InvalidDocumentHash');
  await expectRevert(simulateRegister({ ...base, issuedAt: 0n }, signed), 'InvalidIssuedAt');
  assert.deepEqual(
    await publicClient.readContract({ address: contract, abi: documentRegistryAbi, functionName: 'records', args: [base.documentId] }),
    [`0x${'00'.repeat(32)}`, 0n],
  );
});

test('constructor rejects a zero authorized issuer', async () => {
  await expectRevert(
    issuerClient.deployContract({
      abi: documentRegistryAbi,
      bytecode: artifact.bytecode,
      args: [zeroAddress],
      gas: 3_000_000n,
    }),
    toFunctionSelector('InvalidIssuer()'),
  );
});
