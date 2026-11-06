import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.KODA_PREVIEW_URL ?? 'http://127.0.0.1:5190/live.html';
const output = process.env.KODA_REVIEW_OUTPUT ?? 'docs/design/verification-review-2026-11-06';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const findings = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  let rpcRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('ethereum-sepolia-rpc.publicnode.com')) rpcRequests++; });
  await page.goto(base);
  await page.getByRole('button', { name: '직접 검증하기', exact: true }).click();
  await page.clock.install();
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.kp-result h3')).toHaveText('발급 원본과 일치해요', { timeout: 90000 });
  await expect(page.locator('.kp-review-controls')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  const callsAtResult = rpcRequests;
  await page.getByRole('button', { name: '조회할 컨트랙트 확인 처리 기록 보기' }).click();
  await page.getByRole('button', { name: '처리 기록 재생', exact: true }).click();
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'deployment');
  await expect(page.locator('.kp-verify-process li.is-success')).toHaveCount(5);
  await page.clock.fastForward(3_000);
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'deployment');
  await page.clock.fastForward(500);
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'hash');
  await page.getByRole('button', { name: '처리 기록 일시정지', exact: true }).click();
  await page.clock.fastForward(10_000);
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'hash');
  await page.getByRole('button', { name: '확정된 등록 기록 조회 처리 기록 보기' }).click();
  await expect(page.locator('.kam.is-review .kam-chain')).toHaveClass(/is-active/);
  await expect(page.locator('.kp-now')).toContainText('실행 종료');
  await expect(page.locator('.kp-now')).toContainText('같은 확정 블록');
  await page.screenshot({ path: `${output}/record-review.png`, fullPage: true });
  await page.getByRole('button', { name: '처리 기록 재생', exact: true }).click();
  await page.clock.fastForward(3_500);
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'comparison');
  await page.clock.fastForward(3_500);
  await expect(page.getByRole('button', { name: '처리 기록 재생', exact: true })).toBeVisible();
  expect(rpcRequests).toBe(callsAtResult);
  findings.push('Original: match immediately; 3.5s recorded steps, pause/select/end; no extra RPC during review.');

  await page.getByRole('button', { name: '변경본 120 BTC' }).click();
  await expect(page.locator('.kp-review-controls')).toHaveCount(0);
  await expect(page.locator('.kam.is-review')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.resume();
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.kp-result h3')).toHaveText('발급 원본과 달라요', { timeout: 90000 });
  await expect(page.locator('[data-step=comparison]')).toHaveClass(/is-mismatch/);
  await expect(page.getByRole('button', { name: '처리 기록 재생', exact: true })).toBeDisabled();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  await page.clock.fastForward(20_000);
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'deployment');
  await page.getByRole('button', { name: '다음 처리 기록' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'hash');
  findings.push('File selection clears stale review; altered PDF mismatches; reduced motion uses keyboard/manual review only.');

  await page.clock.resume();
  await page.getByRole('button', { name: '다시 검증하기', exact: true }).click();
  await expect(page.locator('.kp-review-controls')).toHaveCount(0);
  await expect(page.locator('.kp-result h3')).toHaveText('발급 원본과 달라요', { timeout: 90000 });
  await page.locator('.kp-transport>ol button').first().click();
  await expect(page.locator('.kam.is-review')).toHaveCount(0);
  await page.locator('.kp-transport>ol button').last().click();
  await expect(page.locator('li.is-reviewing')).toHaveAttribute('data-step', 'deployment');
  findings.push('Reverification and scene change clear the previous active review.');

  await page.getByRole('button', { name: '발급 원본 100 BTC' }).click();
  let injected = 0;
  await page.route(/ethereum-sepolia-rpc\.publicnode\.com/, route => {
    injected++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: route.request().postDataJSON()?.id ?? 1, error: { code: -32603, message: 'QA: forced failure' } }) });
  });
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  // viem retries use timers; let the test clock run again for the injected error.
  await page.clock.resume();
  await expect(page.locator('.kp-result h3')).toHaveText('검증에 필요한 정보를 확인하지 못했어요', { timeout: 90000 });
  expect(injected).toBeGreaterThan(0);
  await expect(page.locator('.kp-review-controls>span')).toContainText('1 / 1');
  await expect(page.locator('[data-step=deployment]')).toHaveClass(/is-failure/);
  await expect(page.locator('.kp-verify-process li.is-success')).toHaveCount(0);
  await expect(page.locator('.kam-path[d="M346 118 V225"]')).toHaveClass(/is-active/);
  await expect(page.locator('.kam-path[d="M378 270 H402 V132 H378 V118"]')).not.toHaveClass(/is-active/);
  await expect(page.locator('.kam.is-review .is-complete')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음 처리 기록' })).toBeDisabled();
  await page.screenshot({ path: `${output}/failed-review.png`, fullPage: true });
  findings.push('Injected RPC failure: only the attempted group is reviewable; static query location, no response/completion highlight.');

  await expect(page.locator('.kam-scope')).toContainText('Bitcoin 네트워크의 BTC');
  await expect(page.locator('.kam-scope')).toContainText('Ethereum에는 문서 검증정보만 기록');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (let i = 0; i < 8; i++) {
      await page.locator('.kp-transport>ol button').nth(i).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.screenshot({ path: `${output}/review-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
  findings.push('All eight scenes at 1280px/390px: no page overflow or browser errors. No wallet requests.');
  await writeFile(`${output}/browser-check.json`, JSON.stringify({ base, findings }, null, 2));
  console.log(findings.join('\n'));
} finally { await browser.close(); }
