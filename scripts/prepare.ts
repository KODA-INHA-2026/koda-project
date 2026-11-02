import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createConnection } from 'node:net';
import { createPrivateKey, randomBytes, randomUUID, sign } from 'node:crypto';
import { generatePrivateKey } from 'viem/accounts';
import { parseEther, toHex, type Hex } from 'viem';
import { canonicalJson, commitmentBytes, toBase64Url } from '@koda/protocol';
import { newIdentity, hash } from '../apps/api/src/crypto/keys.js';
import { openDatabase, insertPrincipal } from '../apps/api/src/repositories/database.js';
import { demoPeople, syntheticPayload } from '../apps/api/src/fixtures/synthetic.js';
import { anchorAbi, chainClients, checkInstance, recordCommitment, type TrustedConfig } from '../packages/chain/src/client.js';

const privateRoot = resolve('.demo');
const dir = resolve(process.env.KODA_DATA_DIR ?? '.demo');
if (dir !== privateRoot && !dir.startsWith(privateRoot + sep)) throw new Error('Demo data must stay within the workspace .demo directory');
mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700);
if (process.argv.includes('--fresh')) {
  {
    const apiRunning = await new Promise<boolean>(resolve => {
      const socket = createConnection({ host: '127.0.0.1', port: Number(process.env.KODA_API_PORT ?? 3001) });
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false)); socket.setTimeout(1500, () => { socket.destroy(); resolve(true); });
    });
    if (apiRunning) throw new Error('API가 실행 중입니다. 앱 서버를 종료한 후 --fresh로 다시 준비하세요. 기존 상태는 변경하지 않았습니다.');
  }
  const archive = join(dir, 'archive', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID());
  mkdirSync(archive, { recursive: true, mode: 0o700 });
  for (const name of ['keys', 'demo.sqlite', 'trusted.json']) if (existsSync(join(dir, name))) renameSync(join(dir, name), join(archive, name));
  console.log('지정한 데이터 폴더의 archive/에 기존 환경을 보관합니다. 새 키·DB 준비로 기존 세션·링크를 사용할 수 없습니다.');
}
if (existsSync(join(dir, 'trusted.json'))) {
  const config = JSON.parse(readFileSync(join(dir, 'trusted.json'), 'utf8')) as TrustedConfig;
  await checkInstance(config);
  console.log('기존 데모 환경을 확인했습니다. 키·DB를 보존합니다.');
} else {
  if (existsSync(join(dir, 'keys')) || existsSync(join(dir, 'demo.sqlite'))) throw new Error('부분 초기화가 있습니다. 기존 로컬 상태를 검토한 뒤 별도 보관해야 합니다. 자동 삭제하지 않습니다.');
  const rpc = process.env.KODA_RPC_URL ?? 'http://127.0.0.1:8545';
  const privateKey = generatePrivateKey();
  const { publicClient, walletClient } = chainClients(rpc, privateKey);
  if (await publicClient.getChainId() !== 31337) throw new Error('Unexpected chain');
  await publicClient.request({ method: 'hardhat_setBalance' as never, params: [walletClient!.account.address, toHex(parseEther('10'))] as never });
  const artifact = JSON.parse(readFileSync('packages/chain/artifacts/AnchorRegistry.json', 'utf8')) as { bytecode: Hex };
  const instanceId = toHex(randomBytes(32));
  const deploymentTx = await walletClient!.deployContract({ abi: anchorAbi, bytecode: artifact.bytecode, args: [walletClient!.account.address, instanceId] });
  const deployment = await publicClient.waitForTransactionReceipt({ hash: deploymentTx, timeout: 10000 });
  if (deployment.status !== 'success' || !deployment.contractAddress) throw new Error('Deployment failed');
  const issuer = newIdentity();
  const config: TrustedConfig = { chainId: 31337, contractAddress: deployment.contractAddress, instanceId, writer: walletClient!.account.address,
    deploymentTx, deploymentBlockHash: deployment.blockHash, deploymentBlockNumber: String(deployment.blockNumber), rpc, issuerSigningDid: issuer.did };
  await checkInstance(config);
  const staging = join(dir, 'setup-' + randomUUID());
  mkdirSync(join(staging, 'keys'), { recursive: true, mode: 0o700 });
  const writePrivate = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
  const db = openDatabase(join(staging, 'demo.sqlite'));
  try {
    for (const person of demoPeople) {
      const key = newIdentity();
      insertPrincipal(db, { ...person, organizationName: person.id === 'finance-a' ? '㈜가온테크' : person.id === 'auditor-b' ? '한울회계법인' : person.organizationName, did: key.did, keyFile: person.id + '.json' });
      writePrivate(join(staging, 'keys', person.id + '.json'), { format: 'koda-demo-key/1', principalId: person.id, did: key.did, pkcs8: key.privateKey });
      if (person.id === 'auditor-b') db.prepare('INSERT INTO auditor_assignments VALUES (?,?)').run('tenant-a', key.did);
    }
    writePrivate(join(staging, 'keys', 'issuer-signing.json'), issuer);
    writePrivate(join(staging, 'keys', 'chain-writer.json'), { privateKey });
    db.prepare('INSERT INTO issuer_trust VALUES (?,?)').run(issuer.did, issuer.publicKey);
    for (const tenant of ['a','b'] as const) {
      const payload = syntheticPayload(tenant, issuer.did);
      const salt = toBase64Url(randomBytes(32));
      const commitment = ('0x' + hash(commitmentBytes(payload, salt))) as Hex;
      const statementCanonical = canonicalJson({ domain: 'KODA-CUSTODY-DEMO-STATEMENT-v1', schemaVersion: payload.schemaVersion, evidenceId: payload.evidenceId, version: payload.version,
        tenantId: payload.tenantId, issuerSigningDid: issuer.did, commitmentAlgorithm: 'SHA-256', commitment,
        anchorTarget: { chainId: config.chainId, contractAddress: config.contractAddress, instanceId } });
      const signature = sign(null, Buffer.from(statementCanonical), createPrivateKey({ key: Buffer.from(issuer.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })).toString('base64url');
      const record = await recordCommitment(config, privateKey, commitment);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO evidence_versions VALUES (?,?,?,?,?,?,?)').run(payload.evidenceId, payload.version, payload.tenantId, canonicalJson(payload), salt, statementCanonical, signature);
        db.prepare('INSERT INTO anchor_records VALUES (?,?,?,?,?,?)').run(payload.evidenceId, payload.version, commitment, record.txHash, record.blockHash, instanceId);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  } finally { db.close(); }
  chmodSync(join(staging, 'demo.sqlite'), 0o600);
  writePrivate(join(staging, 'trusted.json'), config);
  renameSync(join(staging, 'keys'), join(dir, 'keys'));
  renameSync(join(staging, 'demo.sqlite'), join(dir, 'demo.sqlite'));
  renameSync(join(staging, 'trusted.json'), join(dir, 'trusted.json'));
  console.log('준비 완료: 5개 데모 신원, 2개 회사 증빙, 실제 서명·앵커 기록·조회. 지정한 KODA_DATA_DIR의 keys/에서 개발 키를 선택하세요.');
}
