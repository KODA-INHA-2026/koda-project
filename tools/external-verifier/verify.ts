import { open, readFile, stat } from 'node:fs/promises';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { inspectDeployment } from '../../apps/web/src/live/wallet';
import { parseVerificationFile, PDF_LIMIT, VERIFICATION_LIMIT } from '../../apps/web/src/live/verification-file';
import { verifyDocument, type VerificationTraceEvent } from '../../apps/web/src/live/verification';
import { recordedDeployment } from '../../apps/web/src/live/recorded-evidence';

const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL, { retryCount: 1, timeout: 15_000 }) });

function usage() {
  return '사용법: node verify.mjs <증명서.pdf> <검증정보.json>';
}

async function main() {
  const [pdfPath, jsonPath, ...extra] = process.argv.slice(2);
  if (!pdfPath || !jsonPath || extra.length) throw new Error(usage());
  const [pdfStat, jsonStat] = await Promise.all([stat(pdfPath), stat(jsonPath)]);
  if (!pdfStat.isFile() || !jsonStat.isFile()) throw new Error('PDF와 검증정보 JSON은 파일이어야 합니다.');
  if (pdfStat.size > PDF_LIMIT) throw new Error('PDF는 10 MiB 이하여야 합니다.');
  if (jsonStat.size > VERIFICATION_LIMIT) throw new Error('검증정보 JSON은 64 KiB 이하여야 합니다.');
  const pdfHandle = await open(pdfPath, 'r');
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await pdfHandle.read(header, 0, header.length, 0);
    if (bytesRead !== 5 || header.toString('ascii') !== '%PDF-') throw new Error('PDF 파일 형식이 아닙니다.');
  } finally {
    await pdfHandle.close();
  }
  const [pdfBuffer, jsonBuffer] = await Promise.all([readFile(pdfPath), readFile(jsonPath)]);
  const { proof, deployment } = parseVerificationFile(jsonBuffer.toString('utf8'), [recordedDeployment]);
  const trace: VerificationTraceEvent[] = [];
  trace.push({ id: 'deployment-validation', operation: '고정 신뢰 기준의 배포 코드·발급자 확인', location: 'ethereum', state: 'running' });
  try {
    await inspectDeployment(deployment);
    trace[0] = { ...trace[0]!, state: 'success', detail: deployment.contract };
  } catch (error) {
    trace[0] = { ...trace[0]!, state: 'failure', detail: error instanceof Error ? error.message : String(error) };
    throw Object.assign(new Error('사전에 공개한 계약의 배포 코드와 발급자를 확인하지 못했습니다.'), { trace });
  }
  const result = await verifyDocument(new Uint8Array(pdfBuffer), proof, deployment, client, event => trace.push(event));
  const report = {
    format: 'koda-external-verification-report/v1',
    checkedAt: new Date().toISOString(),
    runtime: `Node.js ${process.versions.node}`,
    rpc: RPC_URL,
    trust: { chainId: deployment.chainId, contract: deployment.contract, issuer: deployment.issuer },
    documentId: proof.documentId,
    result,
    trace,
    limits: ['시험 발급자와 Sepolia 실증 기록을 검증합니다.', 'BTC 잔고의 사실성이나 KODA 공식 운영 신원을 증명하지 않습니다.', 'RPC 가용성과 응답의 독립성은 별도 운영 정책이 필요합니다.'],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = result.status === 'match' ? 0 : result.status === 'file-mismatch' ? 2 : 1;
}

main().catch(error => {
  const report = { format: 'koda-external-verification-report/v1', checkedAt: new Date().toISOString(), status: 'error', message: error instanceof Error ? error.message : String(error), trace: error?.trace ?? [] };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
});
