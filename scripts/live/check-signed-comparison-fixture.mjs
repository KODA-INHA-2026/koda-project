import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.KODA_FIXTURE_ORIGIN ?? 'http://127.0.0.1:5190';
const fixtureUrl = `${origin}/signed-comparison-fixture.html`;
const output = resolve('docs/design/signed-comparison-2026-11-07');
await mkdir(output, { recursive: true });
const viteMetadata = JSON.parse(await readFile('apps/web/node_modules/.vite/deps/_metadata.json', 'utf8'));
const browserHash = viteMetadata.browserHash;

const harness = `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>재서명 비교 합성 검증</title></head>
<body><div id="fixture-label">합성 브라우저 검증 · 임시 시험 서명자와 모의 체인 응답 · 실제 Sepolia 기록 아님</div><main id="root"></main>
<style>#fixture-label{background:#fff4d8;border-bottom:1px solid #e5ca86;color:#765716;font:600 12px/1.5 Pretendard,sans-serif;padding:9px 20px;text-align:center}#root{padding:24px;max-width:1500px;margin:auto}@media(max-width:600px){#root{padding:12px}}</style>
<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
<script type="module">
import React from '/node_modules/.vite/deps/react.js?v=${browserHash}';
import ReactDomClient from '/node_modules/.vite/deps/react-dom_client.js?v=${browserHash}';
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData } from '/node_modules/.vite/deps/viem.js?v=${browserHash}';
import { generatePrivateKey, privateKeyToAccount } from '/node_modules/.vite/deps/viem_accounts.js?v=${browserHash}';
import { VerificationExperience } from '/src/live/VerificationExperience.tsx';
import { verifySignedComparison } from '/src/live/signed-comparison.ts';
import { sha256 } from '/src/live/verification.ts';
import { documentDomain, documentRegistryAbi, documentTypes } from '/@fs/${resolve('packages/chain/src/document-registry.ts').replaceAll('\\', '/') }';
import '/src/live/presentation.css';
const { createRoot } = ReactDomClient;
const { useEffect, useState } = React;

const issuer = privateKeyToAccount(generatePrivateKey());
const trusted = { chainId: 11155111, contract: '0x1111111111111111111111111111111111111111', issuer: issuer.address };
const documentId = '0x' + '22'.repeat(32);
const transactionHash = '0x' + '99'.repeat(32);
const blockHash = '0x' + '88'.repeat(32);
const issuedAt = 1799280000n;
const original = new TextEncoder().encode('%PDF-1.7\\nKODA synthetic original 100 BTC\\n%%EOF');
const alternate = new TextEncoder().encode('%PDF-1.7\\nKODA synthetic alternate 120 BTC\\n%%EOF');

async function sign(bytes) {
  const documentHash = await sha256(bytes);
  const message = { documentId, documentHash, issuedAt };
  const signature = await issuer.signTypedData({
    domain: documentDomain(trusted.chainId, trusted.contract), types: documentTypes, primaryType: 'Document', message,
  });
  return { documentId, documentHash, issuedAt: issuedAt.toString(), signature };
}

function clientFor(reference, mode = 'ok') {
  const receiptBlock = mode === 'pending' ? 101n : 90n;
  const finalized = 100n;
  const input = encodeFunctionData({ abi: documentRegistryAbi, functionName: 'register',
    args: [reference.documentId, reference.documentHash, BigInt(reference.issuedAt), reference.signature] });
  const topics = encodeEventTopics({ abi: documentRegistryAbi, eventName: 'DocumentRegistered', args: { documentId } });
  const data = encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint64' }], [reference.documentHash, BigInt(reference.issuedAt)]);
  const available = () => { if (mode === 'failure') throw new Error('Synthetic RPC unavailable'); };
  return {
    async getChainId() { available(); return trusted.chainId; },
    async getTransaction() { available(); return { to: trusted.contract, from: trusted.issuer, input }; },
    async getTransactionReceipt() { available(); return { status: 'success', to: trusted.contract, from: trusted.issuer, blockNumber: receiptBlock, blockHash, logs: [{ address: trusted.contract, topics, data }] }; },
    async getBlock(args) { available(); return args.blockTag === 'finalized'
      ? { number: finalized, hash: '0x' + '77'.repeat(32), timestamp: 1799280100n }
      : { number: args.blockNumber, hash: blockHash, timestamp: 1799280050n }; },
    async readContract(args) { available(); return args.functionName === 'authorizedIssuer'
      ? trusted.issuer : [reference.documentHash, BigInt(reference.issuedAt)]; },
  };
}

async function makeFixtures() {
  const reference = { ...await sign(original), transactionHash };
  const candidate = await sign(alternate);
  const fixture = async mode => {
    const trace = [];
    const result = await verifySignedComparison(alternate, candidate, reference, trusted, clientFor(reference, mode), event => trace.push(event));
    return { result, trace };
  };
  return { reference, candidate, conflict: await fixture('ok'), pending: await fixture('pending'), failure: await fixture('failure') };
}

const empty = () => {};
function App() {
  const [fixtures, setFixtures] = useState();
  const [result, setResult] = useState();
  const [trace, setTrace] = useState([]);
  const [variant, setVariant] = useState('resigned');
  useEffect(() => { void makeFixtures().then(value => {
    setFixtures(value); setResult(value.conflict.result); setTrace(value.conflict.trace); window.fixtureReady = true;
  }).catch(error => { window.fixtureError = error.stack ?? error.message; }); }, []);
  useEffect(() => {
    if (!fixtures) return;
    window.fixtureShow = name => { const next = fixtures[name]; setVariant('resigned'); setResult(next.result); setTrace(next.trace); };
    window.fixtureFacts = () => ({ conflict: fixtures.conflict.result, pending: fixtures.pending.result, failure: fixtures.failure.result, trace: fixtures.conflict.trace });
  }, [fixtures]);
  if (!fixtures) return React.createElement('p', null, '합성 비교 결과 준비 중');
  const select = next => { setVariant(next); setResult(undefined); setTrace([]); };
  return React.createElement(VerificationExperience, {
    stage: 'result', mode: 'recorded', busy: false, customer: '합성 시험 법인', asOf: '합성 기준시점',
    proof: fixtures.candidate, trusted, verificationProof: fixtures.candidate, verificationTrust: trusted,
    selectedName: variant === 'resigned' ? '합성_120BTC_재서명본.pdf' : '선택한_예시.pdf',
    selectedProofName: variant === 'resigned' ? '합성_재서명_비교정보.json' : '선택한_검증정보.json',
    inputSource: 'sample', inputError: '', inputLoading: false, canDownload: true, selectedVariant: variant,
    signedComparisonReady: true, comparisonReference: fixtures.reference, result, verificationTrace: trace,
    canVerify: true, notice: '', error: '', setup: null, evidence: null,
    onVerify: () => { if (variant === 'resigned') { setResult(fixtures.conflict.result); setTrace(fixtures.conflict.trace); } },
    onSelectSample: select, onSelectFiles: empty, onClearFiles: () => { setResult(undefined); setTrace([]); },
    onDownload: empty, onDownloadProof: empty, verificationBusy: false,
    motion: { step: 'result', paused: false, replay: false, reducedMotion: true, replayRun: empty, finish: empty, toggle: empty },
  });
}
createRoot(document.getElementById('root')).render(React.createElement(App));
</script></body></html>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${error.name}: ${error.message || String(error)}`));
  page.on('console', message => {
    if (message.type() !== 'error' || message.text().includes('[vite] failed to connect') || message.text().includes('WebSocket connection')) return;
    errors.push(`console: ${message.text()}`);
  });
  await page.route(fixtureUrl, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: harness }));
  await page.goto(fixtureUrl);
  await page.waitForTimeout(1_000);
  if (errors.length) throw new Error(JSON.stringify(errors));
  await expect.poll(() => page.evaluate(() => Boolean(window.fixtureError || window.fixtureReady)), { timeout: 30_000 }).toBe(true);
  const fixtureError = await page.evaluate(() => window.fixtureError);
  if (fixtureError) throw new Error(fixtureError);
  await expect(page.getByText('합성 브라우저 검증', { exact: false })).toBeVisible();

  await expect(page.locator('.ve-local-checks .is-confirmed')).toHaveCount(2);
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-mismatch/);
  await expect(page.locator('.ve-outcome h2')).toHaveText('서명은 유효하지만 등록 원본과 다릅니다');
  await expect(page.locator('.ve-questions li')).toHaveCount(3);
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(1);
  await expect(page.locator('.ve-questions .is-warning')).toHaveCount(2);
  await expect(page.locator('.ve-transfer-path.is-observed')).toHaveCount(2);
  await expect(page.locator('.ve-route-label.is-observed')).toHaveCount(2);
  await expect(page.locator('.ve-ethereum')).toHaveClass(/has-record/);
  const facts = await page.evaluate(() => window.fixtureFacts());
  expect(facts.conflict.status).toBe('file-mismatch');
  expect(facts.conflict.signatureValid).toBe(true);
  expect(facts.conflict.fileMatch).toBe(true);
  expect(facts.conflict.chainRecordValid).toBe(true);
  expect(facts.conflict.signedComparison.registrationConflict).toBe(true);
  checks.push('Actual helper result shows two local passes, finalized registration conflict, two observed paths, and three CEO questions');
  await page.screenshot({ path: `${output}/fixture-conflict-1440.png`, fullPage: true });

  await page.getByRole('button', { name: '발급 원본 100 BTC', exact: true }).click();
  await expect(page.locator('.ve-outcome')).toHaveCount(0);
  await expect(page.locator('.ve-ethereum.has-record')).toHaveCount(0);
  checks.push('Switching examples clears the previous result instead of reusing a stale verdict');

  for (const state of ['pending', 'failure']) {
    await page.evaluate(name => window.fixtureShow(name), state);
    await expect(page.locator('.ve-ethereum.has-record')).toHaveCount(0);
    await expect(page.locator('.ve-transfer-path.is-observed')).toHaveCount(0);
  }
  expect(facts.pending.status).toBe('pending');
  expect(facts.pending.signedComparison.registrationConflict).toBe(false);
  expect(facts.failure.status).not.toBe('match');
  expect(facts.failure.signedComparison.registrationConflict).toBe(false);
  checks.push('Pending and RPC failure states never paint a confirmed chain record or registration conflict');

  await page.evaluate(() => window.fixtureShow('conflict'));
  for (const width of [1440, 1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 900 : 1100 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 1280) await page.screenshot({ path: `${output}/fixture-conflict-${width}.png`, fullPage: true });
  }
  checks.push('The isolated actual component has no page overflow at 1440, 1280, or 390 pixels');
  expect(errors).toEqual([]);

  const report = {
    checkedAt: new Date().toISOString(),
    fixtureUrl,
    syntheticFixture: true,
    realSepoliaEvidence: false,
    privateKeyPersisted: false,
    description: 'Actual VerificationExperience + verifySignedComparison, ephemeral in-memory signer, fully shaped mock VerificationClient.',
    checks,
    facts: {
      conflict: { status: facts.conflict.status, signatureValid: facts.conflict.signatureValid, fileMatch: facts.conflict.fileMatch, chainRecordValid: facts.conflict.chainRecordValid, registrationConflict: facts.conflict.signedComparison.registrationConflict },
      pending: { status: facts.pending.status, registrationConflict: facts.pending.signedComparison.registrationConflict },
      failure: { status: facts.failure.status, registrationConflict: facts.failure.signedComparison.registrationConflict },
      conflictTrace: facts.trace.map(({ id, state, location }) => ({ id, state, location })),
    },
    browserErrors: errors,
  };
  await writeFile(`${output}/fixture-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
