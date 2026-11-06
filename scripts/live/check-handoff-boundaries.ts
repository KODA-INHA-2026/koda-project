import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { recordedDeployment, recordedProof } from '../../apps/web/src/live/recorded-evidence.ts';
import { serializeVerificationFile } from '../../apps/web/src/live/verification-file.ts';

const base = process.env.KODA_PREVIEW_URL ?? 'http://127.0.0.1:5190/live.html';
const output = process.env.KODA_REVIEW_OUTPUT ?? 'docs/design/document-handoff-2026-11-06';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const findings: string[] = [];
try {
  for (const status of ['pending', 'reverted', 'unrelated-success', 'altered-issuer']) {
    const page = await browser.newPage();
    await page.goto(base);
    const proof = { ...recordedProof, transactionHash: `0x${'11'.repeat(32)}` };
    await page.evaluate(async ({ proof, deployment }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('koda-sepolia-document-demo-v1', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('evidence');
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('evidence', 'readwrite');
        tx.objectStore('evidence').put({ proof, deployment, original: new Uint8Array([37, 80, 68, 70, 45]), altered: new Uint8Array() }, 'current');
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, { proof, deployment: status === 'altered-issuer' ? { ...recordedDeployment, issuer: `0x${'33'.repeat(20)}` } : recordedDeployment });
    await page.route(/ethereum-sepolia-rpc\.publicnode\.com/, async route => {
      const body = route.request().postDataJSON();
      if (body.method !== 'eth_getTransactionReceipt' && body.method !== 'eth_getTransactionByHash') { await route.continue(); return; }
      const result = body.method === 'eth_getTransactionByHash' ? {
        hash: proof.transactionHash, from: recordedDeployment.issuer, to: recordedDeployment.contract, input: '0x',
        nonce: '0x0', value: '0x0', gas: '0x100', gasPrice: '0x1', blockNumber: '0x123', blockHash: `0x${'22'.repeat(32)}`, transactionIndex: '0x0', type: '0x0', v: '0x1b', r: '0x1', s: '0x1',
      } : status === 'pending' ? null : {
        transactionHash: proof.transactionHash, transactionIndex: '0x0', blockNumber: '0x123', blockHash: `0x${'22'.repeat(32)}`,
        from: recordedDeployment.issuer, to: recordedDeployment.contract, cumulativeGasUsed: '0x100', gasUsed: '0x100', effectiveGasPrice: '0x1',
        contractAddress: null, logs: [], logsBloom: `0x${'00'.repeat(256)}`, status: status === 'reverted' ? '0x0' : '0x1', type: '0x2',
      };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result }) });
    });
    await page.reload();
    await page.getByText('발표자 실행 준비', { exact: true }).click();
    await page.getByRole('button', { name: '이 브라우저의 최근 발급 불러오기' }).click();
    await expect(page.locator('.kp-error')).toBeVisible({ timeout: 90000 });
    if (status === 'unrelated-success') await expect(page.locator('.kp-secondary')).toContainText('등록 트랜잭션이 제출된 검증정보와 연결되지 않습니다.');
    if (status === 'altered-issuer') await expect(page.locator('.kp-secondary')).toContainText('공개된 발급 계약과 저장된 배포정보가 다릅니다.');
    await expect(page.getByRole('button', { name: '증명서 PDF 받기', exact: false })).toBeDisabled();
    await expect(page.getByRole('button', { name: '검증정보 JSON 받기', exact: false })).toBeDisabled();
    findings.push(`${status}: restored issuance without a matching trusted registration cannot enable either handoff download.`);
    await page.close();
  }
  const page = await browser.newPage();
  const rogue = { ...recordedDeployment, contract: `0x${'12'.repeat(20)}` as `0x${string}` };
  await page.addInitScript(value => localStorage.setItem('koda-live-trusted-v1', JSON.stringify(value)), rogue);
  const url = new URL(base); url.searchParams.set('view', 'verify');
  await page.goto(url.href);
  await page.getByLabel('전달받은 PDF와 검증정보 선택').setInputFiles({ name: 'local-only.json', mimeType: 'application/json', buffer: Buffer.from(serializeVerificationFile(recordedProof, rogue)) });
  await expect(page.locator('.ve-input-error')).toContainText('사전에 확인한');
  await expect(page.getByRole('button', { name: '문서 검증하기', exact: true })).toBeDisabled();
  findings.push('Issuer localStorage cannot add a trusted registry to the receiver. Fresh and reused browsers share the same public allowlist.');
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/handoff-boundaries.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), findings }, null, 2));
  console.log(JSON.stringify(findings, null, 2));
} finally { await browser.close(); }
