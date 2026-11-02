import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID, createPrivateKey, sign } from 'node:crypto';
import { openDatabase } from '../apps/api/src/repositories/database.ts';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseEther, toHex, type Hex } from 'viem';
import { anchorAbi, chainClients, recordCommitment, checkInstance, type TrustedConfig } from '../packages/chain/src/client.ts';
import { anchorReader } from '../packages/chain/src/reader.js';
import { resumeCommitment } from '../packages/chain/src/issuance.js';
import { createServer } from 'node:net';
import { testDataDir } from '../scripts/test-environment.js';
import { buildApp } from '../apps/api/src/app.js';
import { fromBase64Url } from '@koda/protocol';

let processHandle: ChildProcess;
const rpc = 'http://127.0.0.1:18546';
const writerKey = generatePrivateKey();
const writer = privateKeyToAccount(writerKey);
const { publicClient, walletClient } = chainClients(rpc, writerKey);
let config: TrustedConfig;
async function startChain() {
  await new Promise<void>((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(18546, '127.0.0.1', () => server.close(() => resolve())); });
  const cache = resolve(testDataDir, 'chain-suite-cache'); mkdirSync(cache, { recursive: true });
  const log = openSync(resolve(testDataDir, 'chain-suite.log'), 'a', 0o600);
  processHandle = spawn(process.execPath, ['node_modules/hardhat/dist/src/cli.js','--config','packages/chain/hardhat.config.ts','node','--network','default','--hostname','127.0.0.1','--port','18546'], { stdio: ['ignore',log,log], env: { ...process.env, XDG_CACHE_HOME: cache, XDG_CONFIG_HOME: cache, XDG_DATA_HOME: cache } });
  let ready = false;
  for (let i = 0; i < 40; i++) { if (processHandle.exitCode !== null) throw new Error('Isolated chain failed to start'); try { await publicClient.getChainId(); ready = true; break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  assert.ok(ready);
}
async function stopChain() { if (processHandle && processHandle.exitCode === null) { processHandle.kill('SIGTERM'); await new Promise<void>(resolve => processHandle.once('exit', () => resolve())); } }
before(async () => {
  await startChain();
  await publicClient.request({ method: 'hardhat_setBalance' as never, params: [writer.address, toHex(parseEther('10'))] as never });
  const artifact = JSON.parse(readFileSync('packages/chain/artifacts/AnchorRegistry.json', 'utf8'));
  const instanceId = toHex(randomBytes(32));
  const deploymentTx = await walletClient!.deployContract({ abi: anchorAbi, bytecode: artifact.bytecode, args: [writer.address, instanceId] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx });
  config = { chainId: 31337, contractAddress: receipt.contractAddress!, instanceId, writer: writer.address, deploymentTx, deploymentBlockHash: receipt.blockHash, deploymentBlockNumber: String(receipt.blockNumber), rpc, issuerSigningDid: 'not-used-in-contract' };
});
after(stopChain);

test('T-06: deployed writer, instance, actual receipt event and readback match', async () => {
  await checkInstance(config);
  const commitment = toHex(randomBytes(32));
  const record = await recordCommitment(config, writerKey, commitment);
  assert.match(record.txHash, /^0x[0-9a-f]{64}$/);
  const proof = await anchorReader(config)(commitment, { ...record, instanceId: config.instanceId });
  const recordedBlock = await publicClient.getBlock({ blockHash: record.blockHash });
  assert.equal(proof.evidence?.recordedAt, new Date(Number(recordedBlock.timestamp) * 1000).toISOString());
  assert.equal(proof.evidence?.blockNumber, String(recordedBlock.number));
  assert.equal(proof.evidence?.blockHash, recordedBlock.hash);
  assert.equal(await publicClient.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'isAnchored', args: [commitment] }), true);
  await assert.rejects(recordCommitment(config, writerKey, commitment), /AlreadyAnchored/);
});
test('T-06: unauthorized writer and zero value rejected; absent commitment is false', async () => {
  const other = privateKeyToAccount(generatePrivateKey());
  const commitment = toHex(randomBytes(32));
  await assert.rejects(publicClient.simulateContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'anchor', args: [commitment], account: other }), /Unauthorized/);
  await assert.rejects(recordCommitment(config, writerKey, toHex(new Uint8Array(32))), /InvalidCommitment/);
  assert.equal(await publicClient.readContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'isAnchored', args: [commitment] }), false);
});
test('T-07 subset: unavailable RPC and incorrect chain identity cannot pass', async () => {
  await assert.rejects(checkInstance({ ...config, instanceId: toHex(randomBytes(32)) }), /CHAIN_INSTANCE_CHANGED/);
  await assert.rejects(checkInstance({ ...config, rpc: 'http://127.0.0.1:18547' }));
});
test('T-01: fresh preparation, repeat preparation and archived re-preparation persist valid SQLite state', async () => {
  const dir = resolve(testDataDir, 'test-preparation-' + randomUUID());
  const env = { ...process.env, KODA_DATA_DIR: dir, KODA_RPC_URL: rpc, KODA_API_PORT: '18548' };
  const run = (...args: string[]) => promisify(execFile)(process.execPath, ['--import','tsx','scripts/prepare.ts', ...args], { env });
  await run();
  const firstKey = readFileSync(resolve(dir,'keys/finance-a.json'), 'utf8');
  const firstConfig = readFileSync(resolve(dir,'trusted.json'), 'utf8');
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  try {
    const port = (listener.address() as { port: number }).port;
    await assert.rejects(promisify(execFile)(process.execPath, ['--import','tsx','scripts/prepare.ts','--fresh'], { env: { ...env, KODA_API_PORT: String(port) } }), /API가 실행 중/);
    assert.equal(readFileSync(resolve(dir,'trusted.json'), 'utf8'), firstConfig);
  } finally { await new Promise<void>(resolve => listener.close(() => resolve())); }
  await run();
  assert.ok(readFileSync(resolve(dir,'keys/finance-a.json'), 'utf8') === firstKey, 'Repeat preparation must preserve the isolated key');
  assert.equal(readFileSync(resolve(dir,'trusted.json'), 'utf8'), firstConfig);
  const db = openDatabase(resolve(dir, 'demo.sqlite'));
  try { assert.equal(db.prepare('SELECT count(*) as n FROM evidence_versions').get()!.n, 2); assert.equal(db.prepare('SELECT count(*) as n FROM schema_migrations').get()!.n, 3); } finally { db.close(); }
  await run('--fresh');
  assert.ok(readFileSync(resolve(dir,'keys/finance-a.json'), 'utf8') !== firstKey, 'Fresh preparation must rotate the isolated key');
  await checkInstance(JSON.parse(readFileSync(resolve(dir,'trusted.json'), 'utf8')));
});

test('T-07/T-12: actual receipt binding, missing storage and recovery after lost local receipt', async () => {
  const commitment = toHex(randomBytes(32));
  const recorded = await recordCommitment(config, writerKey, commitment);
  const locator = { ...recorded, instanceId: config.instanceId };
  assert.equal((await anchorReader(config)(commitment, locator)).status, 'PASS');
  const other = await recordCommitment(config, writerKey, toHex(randomBytes(32)));
  assert.equal((await anchorReader(config)(commitment, { ...other, instanceId: config.instanceId })).reasonCode, 'ANCHOR_RECEIPT_MISMATCH');
  const artifact = JSON.parse(readFileSync('packages/chain/artifacts/AnchorRegistry.json', 'utf8'));
  const deployment = await walletClient!.deployContract({ abi: anchorAbi, bytecode: artifact.bytecode, args: [writer.address, toHex(randomBytes(32))] });
  const otherContract = (await publicClient.waitForTransactionReceipt({ hash: deployment })).contractAddress!;
  const otherTx = await walletClient!.writeContract({ address: otherContract, abi: anchorAbi, functionName: 'anchor', args: [commitment] });
  const otherReceipt = await publicClient.waitForTransactionReceipt({ hash: otherTx });
  assert.equal((await anchorReader(config)(commitment, { txHash: otherTx, blockHash: otherReceipt.blockHash, instanceId: config.instanceId })).reasonCode, 'ANCHOR_RECEIPT_MISMATCH');
  assert.equal((await anchorReader(config)(toHex(randomBytes(32)), locator)).reasonCode, 'RECORD_NOT_FOUND');
  let recovered = false;
  const resumed = await resumeCommitment(config, writerKey, commitment, null, tx => { recovered = tx === recorded.txHash; });
  assert.equal(recovered, true); assert.deepEqual(resumed, locator);
});

test('T-07: pending transaction hash cannot pass before real mining', async () => {
  const commitment = toHex(randomBytes(32));
  await publicClient.request({ method: 'evm_setAutomine' as never, params: [false] as never });
  try {
    const txHash = await walletClient!.writeContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'anchor', args: [commitment], gas: 100000n });
    assert.equal((await anchorReader(config)(commitment, { txHash, blockHash: toHex(new Uint8Array(32)), instanceId: config.instanceId })).status, 'UNAVAILABLE');
    await publicClient.request({ method: 'evm_mine' as never, params: [] as never });
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    assert.equal((await anchorReader(config)(commitment, { txHash, blockHash: receipt.blockHash, instanceId: config.instanceId })).status, 'PASS');
    const revertedTx = await walletClient!.writeContract({ address: config.contractAddress, abi: anchorAbi, functionName: 'anchor', args: [commitment], gas: 100000n });
    await publicClient.request({ method: 'evm_mine' as never, params: [] as never });
    const reverted = await publicClient.getTransactionReceipt({ hash: revertedTx });
    assert.equal(reverted.status, 'reverted');
    assert.equal((await anchorReader(config)(commitment, { txHash: revertedTx, blockHash: reverted.blockHash, instanceId: config.instanceId })).reasonCode, 'TRANSACTION_REVERTED');
  } finally { await publicClient.request({ method: 'evm_setAutomine' as never, params: [true] as never }); }
});

test('T-04/T-08: SQLite reopen and new API instance recover the same issuance after actual RPC failure', async () => {
  const dir = resolve(testDataDir, 'test-recovery-' + randomUUID());
  await promisify(execFile)(process.execPath, ['--import','tsx','scripts/prepare.ts'], { env: { ...process.env, KODA_DATA_DIR: dir, KODA_RPC_URL: rpc } });
  const trusted = JSON.parse(readFileSync(resolve(dir, 'trusted.json'), 'utf8')) as TrustedConfig;
  const signing = JSON.parse(readFileSync(resolve(dir, 'keys/issuer-signing.json'), 'utf8'));
  const writer = JSON.parse(readFileSync(resolve(dir, 'keys/chain-writer.json'), 'utf8'));
  const identity = JSON.parse(readFileSync(resolve(dir, 'keys/issuer.json'), 'utf8'));
  const origin = 'http://localhost:5174'; let available = false;
  let db = openDatabase(resolve(dir, 'demo.sqlite'));
  const start = () => buildApp({ db, origin, trusted, anchor: anchorReader(trusted), issuer: {
    sign: bytes => sign(null, bytes, createPrivateKey({ key: Buffer.from(signing.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url'),
    anchor: (commitment, priorTx, sent) => resumeCommitment({ ...trusted, rpc: available ? rpc : 'http://127.0.0.1:18547' }, writer.privateKey, commitment, priorTx, sent),
  } });
  let app = start();
  try {
    const challenge = (await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin }, payload: { did: identity.did } })).json();
    const signature = sign(null, fromBase64Url(challenge.signingBytes), createPrivateKey({ key: Buffer.from(identity.pkcs8, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
    const login = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin }, payload: { challengeId: challenge.challengeId, signature } }); assert.equal(login.statusCode, 200);
    const headers = { origin, cookie: login.headers['set-cookie']!.toString().split(';')[0]!, 'x-csrf-token': login.json().csrf };
    const payload = { snapshotId: 'SYNTHETIC-a-V2', idempotencyKey: randomUUID() };
    assert.equal((await app.inject({ method: 'POST', url: '/api/issuer/evidence', headers, payload })).statusCode, 202);
    await app.issuerIdle();
    const path = '/api/issuer/evidence/KODA-20261031-001/versions/2';
    assert.equal((await app.inject({ url: path, headers })).json().status, 'UNAVAILABLE');
    const bytes = JSON.stringify(db.prepare('SELECT * FROM evidence_versions WHERE version=2').get());
    await app.close(); db.close(); available = true;
    db = openDatabase(resolve(dir, 'demo.sqlite')); app = start(); await app.ready(); await app.issuerIdle();
    assert.equal((await app.inject({ url: path, headers })).json().status, 'CONFIRMED');
    assert.ok(JSON.stringify(db.prepare('SELECT * FROM evidence_versions WHERE version=2').get()) === bytes, 'Restart must not change signed bytes');
    assert.equal((await app.inject({ method: 'POST', url: '/api/issuer/evidence', headers, payload })).statusCode, 200);
    assert.equal(db.prepare('SELECT count(*) n FROM evidence_versions WHERE version=2').get()!.n, 1);
    const record = db.prepare('SELECT * FROM anchor_records WHERE version=2').get()!;
    assert.equal((await anchorReader(trusted)(String(record.commitment) as Hex, { txHash: String(record.txHash) as Hex, blockHash: String(record.blockHash) as Hex, instanceId: String(record.instanceId) as Hex })).status, 'PASS');
  } finally { await app.close(); db.close(); }

  // Exercise an actual API process crash, not only a new in-process app instance.
  const reservation = createServer(); await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  const configPath = resolve(dir, 'trusted.json'); const logPath = resolve(testDataDir, 'runtime-recovery.log');
  let apiProcess: ChildProcess | undefined;
  const pause = () => new Promise(resolve => setTimeout(resolve, 100));
  async function startApi() {
    const log = openSync(logPath, 'a', 0o600);
    apiProcess = spawn(process.execPath, ['--import','tsx','apps/api/src/main.ts'], { env: { ...process.env, KODA_DATA_DIR: dir, KODA_API_PORT: String(port), KODA_ORIGIN: origin }, stdio: ['ignore',log,log] }); closeSync(log);
    for (let i = 0; i < 100; i++) {
      if (apiProcess.exitCode !== null || apiProcess.signalCode !== null) throw new Error('Owned test API failed to start');
      try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return; } catch { /* wait for owned API */ }
      await pause();
    }
    throw new Error('Owned test API readiness timeout');
  }
  async function stopApi() { if (apiProcess && apiProcess.exitCode === null && apiProcess.signalCode === null) { const exited = new Promise<void>(resolve => apiProcess!.once('exit', () => resolve())); apiProcess.kill('SIGKILL'); await exited; } }
  const call = (path: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}/api` + path, init);
  try {
    writeFileSync(configPath, JSON.stringify({ ...trusted, rpc: 'http://127.0.0.1:18547' })); await startApi();
    const challenge = await (await call('/auth/challenge', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ did: identity.did }) })).json();
    const signature = sign(null, fromBase64Url(challenge.signingBytes), createPrivateKey({ key: Buffer.from(identity.pkcs8, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
    const login = await call('/auth/verify', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challengeId, signature }) }); assert.equal(login.status, 200);
    const headers = { origin, cookie: login.headers.get('set-cookie')!.split(';')[0]!, 'content-type': 'application/json', 'x-csrf-token': (await login.json()).csrf as string };
    const issue = await call('/issuer/evidence', { method: 'POST', headers, body: JSON.stringify({ snapshotId: 'SYNTHETIC-b-V2', idempotencyKey: randomUUID() }) }); assert.equal(issue.status, 202);
    const path = '/issuer/evidence/KODA-20261031-002/versions/2';
    async function waitStatus(wanted: string) { for (let i = 0; i < 100; i++) { if ((await (await call(path, { headers })).json()).status === wanted) return; await pause(); } throw new Error('Issuance did not reach ' + wanted); }
    await waitStatus('UNAVAILABLE'); await stopApi();
    writeFileSync(configPath, JSON.stringify(trusted)); await startApi(); await waitStatus('CONFIRMED');
    const rawLog = readFileSync(logPath, 'utf8');
    assert.ok(![signing.privateKey, writer.privateKey, identity.pkcs8].some(value => rawLog.includes(value)), 'Owned API log must not contain test signing secrets');
  } finally { await stopApi(); writeFileSync(configPath, JSON.stringify(trusted)); }
});

test('T-08: actual chain shutdown, restart and same-address redeploy never validate old evidence', async () => {
  const commitment = toHex(randomBytes(32)); const record = await recordCommitment(config, writerKey, commitment);
  const locator = { ...record, instanceId: config.instanceId };
  await stopChain();
  assert.equal((await anchorReader(config)(commitment, locator)).reasonCode, 'RPC_UNAVAILABLE');
  await startChain();
  assert.equal((await anchorReader(config)(commitment, locator)).reasonCode, 'CHAIN_INSTANCE_CHANGED');
  await publicClient.request({ method: 'hardhat_setBalance' as never, params: [writer.address, toHex(parseEther('10'))] as never });
  const artifact = JSON.parse(readFileSync('packages/chain/artifacts/AnchorRegistry.json', 'utf8'));
  const tx = await walletClient!.deployContract({ abi: anchorAbi, bytecode: artifact.bytecode, args: [writer.address, toHex(randomBytes(32))] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  assert.equal(receipt.contractAddress?.toLowerCase(), config.contractAddress.toLowerCase());
  assert.equal((await anchorReader(config)(commitment, locator)).reasonCode, 'CHAIN_INSTANCE_CHANGED');
});
