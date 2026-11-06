import { chromium, expect } from '@playwright/test';
import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const sourceCommit = '1e1eaadc20252754ad54ff5723c30b4bf4c2e43d';
const url = 'https://koda-inha-2026.github.io/koda-project/sepolia-20261106/?revision=1e1eaad';
const output = resolve('deliverables/KODA_데모_01-05_최신화면_8장_20261107');
const zipPath = resolve('deliverables/KODA_데모_01-05_최신화면_8장_20261107.zip');
const evidence = resolve('docs/presentation/demo-png-five-stage-2026-11-07');
const viewport = { width: 1536, height: 1260 };
const deviceScaleFactor = 4;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

await mkdir(output, { recursive: true });
await mkdir(evidence, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const shots = [];
const errors = [];
const walletMethods = [];

function imageSize(bytes) {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function record(file, state) {
  const bytes = await readFile(join(output, file));
  const { width, height } = imageSize(bytes);
  expect(width).toBeGreaterThan(2400);
  expect(height).toBeGreaterThan(1300);
  shots.push({ file, state, width, height, bytes: bytes.length, sha256: hash(bytes) });
  console.log(`${file}: ${width} x ${height}`);
}

try {
  const context = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('qaWalletMethod', method => walletMethods.push(method));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'ethereum', { value: { request: async ({ method }) => {
      await window.qaWalletMethod(method);
      if (method === 'eth_accounts') return [];
      throw new Error(`Unexpected wallet method during PNG export: ${method}`);
    } } });
  });

  const buildResponse = await page.request.get(new URL(`build-info.json?capture=${Date.now()}`, url).href);
  expect(buildResponse.ok()).toBe(true);
  const build = await buildResponse.json();
  expect(build.sourceCommit).toBe(sourceCommit);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.kp-acts button')).toHaveCount(5);

  async function captureLocator(selector, file, state, style = '') {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    await page.mouse.move(viewport.width - 8, 4);
    await target.screenshot({
      path: join(output, file), type: 'png', scale: 'device', animations: 'disabled', caret: 'hide', style,
    });
    await record(file, state);
  }

  async function assertVerticalFiles() {
    const rows = page.locator('.ve-file-row');
    await expect(rows).toHaveCount(2);
    const pdf = await rows.nth(0).boundingBox();
    const json = await rows.nth(1).boundingBox();
    expect(pdf).not.toBeNull();
    expect(json).not.toBeNull();
    expect(json.y).toBeGreaterThanOrEqual(pdf.y + pdf.height - 1);
    expect(Math.abs(pdf.x - json.x)).toBeLessThan(1);
    await expect(rows.nth(0).locator(':scope > small')).toBeVisible();
    await expect(rows.nth(1).locator(':scope > small')).toBeVisible();
  }

  async function captureDashboard(file, state) {
    await assertVerticalFiles();
    const style = await page.addStyleTag({ content: `
      .ve-comparison-context { display:none !important; }
      .ve-transfer-layer { visibility:hidden !important; }
      .ve-experience *, .ve-experience *::before, .ve-experience *::after { animation:none !important; transition:none !important; }
    ` });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      const dashboard = await page.locator('.ve-dashboard').boundingBox();
      const cases = await page.locator('.ve-scenarios').boundingBox();
      expect(dashboard).not.toBeNull();
      expect(cases).not.toBeNull();
      const clip = { x: dashboard.x, y: cases.y, width: dashboard.width, height: dashboard.y + dashboard.height - cases.y };
      for (const button of await page.locator('.ve-scenarios button').all()) {
        const bounds = await button.boundingBox();
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(clip.x + clip.width + 1);
      }
      await page.screenshot({ path: join(output, file), type: 'png', scale: 'device', clip, caret: 'hide', animations: 'allow' });
      await record(file, state);
    } finally { await style.evaluate(element => element.remove()); }
  }

  async function captureComparison(file, state) {
    await assertVerticalFiles();
    const style = await page.addStyleTag({ content: `
      .ve-comparison-context { display:none !important; }
      .ve-experience *, .ve-experience *::before, .ve-experience *::after { animation:none !important; transition:none !important; }
    ` });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      const experience = await page.locator('.ve-experience').boundingBox();
      expect(experience).not.toBeNull();
      for (const selector of ['.ve-ethereum', '.ve-route-label.is-query', '.ve-route-label.is-response', '.ve-request-path', '.ve-response-path']) {
        await expect(page.locator(selector)).toBeVisible();
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(experience.x - 1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(experience.x + experience.width + 1);
        expect(bounds.y).toBeGreaterThanOrEqual(experience.y - 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(experience.y + experience.height + 1);
      }
      await expect(page.locator('.ve-route-label.is-observed')).toHaveCount(2);
      await page.screenshot({ path: join(output, file), type: 'png', scale: 'device', clip: experience, caret: 'hide', animations: 'allow' });
      await record(file, state);
    } finally { await style.evaluate(element => element.remove()); }
  }

  await expect(page.locator('.ij-root')).toHaveAttribute('data-issuance-stage', '1');
  await expect(page.locator('.ij-source')).toContainText('100 BTC');
  await captureLocator('.ij-canvas', '01_원본_발급.png', '01 original issuance canvas from the published five-stage build');

  await page.locator('.kp-acts button').nth(1).click();
  await expect(page.locator('.ij-root')).toHaveAttribute('data-issuance-stage', '2');
  await expect(page.locator('.ij-digest')).toContainText('0x');
  await expect(page.locator('.ij-signature code')).toContainText('0x');
  await captureLocator('.ij-canvas', '02_전자서명_해시_생성.png', '02 SHA-256 and EIP-712/ECDSA issuance evidence canvas');

  await page.locator('.kp-acts button').nth(2).click();
  await expect(page.locator('.ij-root')).toHaveAttribute('data-issuance-stage', '3');
  await expect(page.locator('.ij-stored-record code')).toContainText('0x');
  await expect(page.locator('.ij-handoff')).toContainText('KODA가 발급');
  await expect(page.locator('.ij-handoff')).toContainText('고객사');
  await expect(page.locator('.ij-handoff')).toContainText('제3자');
  await captureLocator('.ij-canvas', '03_블록체인_기록_고객사_전달.png', '03 actual recorded Ethereum reference and KODA-customer-third-party handoff canvas');

  await page.locator('.kp-acts button').nth(3).click();
  await expect(page.locator('.kp-root')).toHaveAttribute('data-presentation-act', '4');
  await expect(page.getByRole('button', { name: '발급 원본 100 BTC', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '발급 원본 100 BTC', exact: true }).click();
  const verify = page.getByRole('button', { name: '문서 검증하기', exact: true });
  await expect(page.locator('.ve-file-row.is-loaded')).toHaveCount(2);
  await expect(verify).toBeEnabled();
  await expect(page.locator('.ve-outcome')).toHaveCount(0);
  await captureDashboard('04a_검증_전.png', '04 dashboard with the real original PDF and verification JSON loaded before verification');

  await verify.click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-match/, { timeout: 120000 });
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(3);
  await expect(page.locator('.ve-route-label.is-observed')).toHaveCount(2);
  await captureDashboard('04b_원본_검증_성공.png', '04 actual Sepolia RPC verification of the original; all three checks confirmed');

  await page.getByRole('button', { name: /다시 서명한 문서/ }).click();
  await expect(page.locator('.ve-file-row.is-loaded')).toHaveCount(2);
  await expect(verify).toBeEnabled();
  await verify.click();
  await expect(page.locator('.ve-experience')).toHaveAttribute('data-motion-step', 'compare', { timeout: 120000 });
  await page.getByRole('button', { name: '처리 흐름 일시정지', exact: true }).click();
  await expect(page.locator('.ve-experience')).toHaveClass(/is-paused/);
  await expect(page.locator('.ve-local-checks .is-confirmed')).toHaveCount(2);
  await expect(page.locator('.ve-file-digest')).toContainText('0x42c75760');
  await expect(page.locator('.ve-return-slot')).toContainText('0xba9bca0b');
  await captureComparison('04c_Ethereum_조회_응답_대조.png', '04 actual signed comparison paused at compare with Ethereum, RPC request, response and both hashes visible');

  await page.getByRole('button', { name: /결과 바로 보기/ }).click();
  await expect(page.locator('.ve-outcome h2')).toHaveText('서명은 유효하지만 등록 원본과 다릅니다');
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(1);
  await expect(page.locator('.ve-questions .is-warning')).toHaveCount(2);
  await captureDashboard('04d_재서명_등록원본_불일치.png', '04 valid re-signature and PDF pair, but conflict with the finalized registered original');

  await page.locator('.kp-acts button').nth(4).click();
  await expect(page.locator('.kp-root')).toHaveAttribute('data-presentation-act', '5');
  await expect(page.locator('.ev-run')).toContainText('실제 실행 기록');
  await expect(page.locator('.ev-run')).toContainText('0xba9bca0b');
  await captureLocator('.ev-run', '05_외부환경_실행기록.png', '05 saved actual external Node.js verifier execution record from the published build');

  expect(errors).toEqual([]);
  expect(walletMethods.filter(method => method !== 'eth_accounts')).toEqual([]);
  shots.sort((a, b) => a.file.localeCompare(b.file, 'ko'));
  const pngFiles = (await readdir(output)).filter(file => file.toLowerCase().endsWith('.png')).sort((a, b) => a.localeCompare(b, 'ko'));
  expect(pngFiles).toHaveLength(8);
  expect(pngFiles).toEqual(shots.map(shot => shot.file));

  const zip = new AdmZip();
  for (const file of pngFiles) zip.addLocalFile(join(output, file));
  zip.writeZip(zipPath);
  const zipBytes = await readFile(zipPath);
  const zipEntries = new AdmZip(zipBytes).getEntries().map(entry => entry.entryName).sort((a, b) => a.localeCompare(b, 'ko'));
  expect(zipEntries).toEqual(pngFiles);
  expect(zipEntries.every(entry => entry.toLowerCase().endsWith('.png'))).toBe(true);

  const contact = await context.newPage();
  await contact.setViewportSize({ width: 1600, height: 2200 });
  const cards = await Promise.all(shots.map(async shot => {
    const bytes = await readFile(join(output, shot.file));
    return `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"/><figcaption>${shot.file}<br>${shot.width} × ${shot.height}</figcaption></figure>`;
  }));
  await contact.setContent(`<style>
    *{box-sizing:border-box}body{margin:0;padding:34px;background:#eef3ef;font-family:Arial,sans-serif;color:#123b2d}
    main{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0;padding:14px;background:#fff;border:1px solid #cbd9d0;border-radius:12px}
    img{display:block;width:100%;height:430px;object-fit:contain;background:#f8faf8}figcaption{padding:12px 4px 2px;font-size:18px;line-height:1.45}
  </style><main>${cards.join('')}</main>`, { waitUntil: 'load' });
  await contact.screenshot({ path: join(evidence, 'contact-sheet.png'), fullPage: true, type: 'png' });
  await contact.close();

  const manifest = {
    capturedAt: new Date().toISOString(), url, build, sourceCommit, viewport, deviceScaleFactor,
    method: 'Native 4x Chrome rendering from the published five-stage build. Issuance exports use the existing .ij-canvas; dashboard exports retain the existing cropped dashboard treatment; the comparison export includes the complete Ethereum request/response experience. Verification screenshots assert vertical PDF/JSON rows. Actual Sepolia RPC reads are used, with no new wallet signature or transaction.',
    shots, errors, walletMethods, zip: { file: zipPath, bytes: zipBytes.length, sha256: hash(zipBytes), entries: zipEntries },
  };
  await writeFile(join(evidence, 'capture.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ output, zipPath, evidence, shots, zip: manifest.zip }, null, 2));
} finally {
  await browser.close();
}
