import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.KODA_PREVIEW_URL ?? 'http://127.0.0.1:5190/live.html';
const output = 'docs/design/content-refinement-2026-11-06';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const findings = [];
const scenes = ['intro', 'pdf', 'hash', 'sign', 'contract', 'block', 'handoff', 'verify'];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: '직접 검증하기', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const [index, scene] of scenes.entries()) {
    await page.locator('.kp-transport>ol button').nth(index).click();
    await expect(page.locator(`.kp-root.scene-${scene}`)).toBeVisible();
    await expect(page.locator('.kp-scene-heading')).not.toContainText(/0[1-7] ·/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`Desktop overflow: ${scene}`);
    await page.screenshot({ path: `${output}/after-${scene}.png`, fullPage: true });
  }
  await expect(page.locator('.kp-root')).not.toContainText('공개 검증 인프라');
  await expect(page.locator('.kp-root')).not.toContainText('고객 BTC가 올라가는 체인이 아님');
  await expect(page.locator('.kp-proof-context')).toContainText('미리 불러온 발급정보');
  await expect(page.locator('.kp-verify-process>ol>li')).toHaveCount(5);
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.kp-result h3')).toHaveText('발급 원본과 일치해요', { timeout: 90000 });
  await expect(page.locator('.kp-verify-process li.is-success')).toHaveCount(5);
  await page.screenshot({ path: `${output}/after-original-match.png`, fullPage: true });
  findings.push('Live Sepolia original: match; all 5 trace groups completed.');
  await page.getByRole('button', { name: '변경본 120 BTC' }).click();
  await expect(page.locator('.kp-verify-process li.is-success')).toHaveCount(0);
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.kp-result h3')).toHaveText('발급 원본과 달라요', { timeout: 90000 });
  await expect(page.locator('[data-step=chain]')).toHaveClass(/is-success/);
  await expect(page.locator('[data-step=comparison]')).toHaveClass(/is-mismatch/);
  await page.screenshot({ path: `${output}/after-altered-mismatch.png`, fullPage: true });
  findings.push('Live Sepolia altered: file-mismatch; chain succeeded, comparison differed.');
  await page.getByRole('button', { name: '발급 원본 100 BTC' }).click();
  // Deliberate transport failure: this screenshot is a test, not an observed RPC outage.
  let injectedRequests = 0;
  const rpcRoute = /ethereum-sepolia-rpc\.publicnode\.com/;
  await page.route(rpcRoute, route => {
    injectedRequests++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: route.request().postDataJSON()?.id ?? 1, error: { code: -32603, message: 'QA: forced lookup failure' } }) });
  });
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.kp-result h3')).toHaveText('검증에 필요한 정보를 확인하지 못했어요', { timeout: 90000 });
  await expect(page.locator('[data-step=deployment]')).toHaveClass(/is-failure/);
  await expect(page.locator('.kp-verify-process li.is-success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 검증하기', exact: true })).toBeEnabled();
  await page.screenshot({ path: `${output}/qa-forced-lookup-failure.png`, fullPage: true });
  expect(injectedRequests).toBeGreaterThan(0);
  findings.push('Injected RPC failure: no success indicators; retry action available.');
  await page.unroute(rpcRoute);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: '처음부터 다시 재생', exact: true })).toBeDisabled();
  await page.locator('.kp-transport>ol button').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.scene-intro')).toBeVisible();
  findings.push('Keyboard scene selection and reduced-motion playback guard passed.');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const [index, scene] of scenes.entries()) {
      await page.locator('.kp-transport>ol button').nth(index).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error(`Overflow at ${width}px: ${scene}`);
      if (scene === 'intro' || scene === 'verify') await page.screenshot({ path: `${output}/after-${width}-${scene}.png`, fullPage: true });
    }
    findings.push(`${width}px: all 8 scenes without page overflow.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  findings.push('No browser page errors. No wallet connection or signing requested.');
  await writeFile(`${output}/browser-check.json`, JSON.stringify({ base, findings }, null, 2));
  console.log(findings.join('\n'));
} finally { await browser.close(); }
