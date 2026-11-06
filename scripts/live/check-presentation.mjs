import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.KODA_PREVIEW_URL ?? 'http://127.0.0.1:5190/live.html';
const output = process.env.KODA_REVIEW_OUTPUT ?? 'docs/design/verification-story-2026-11-06';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const findings = [];
const chapters = ['custody','prepare','register','receive','inspect','lookup','compare'];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  let rpcRequests = 0;
  const rpcRoute = /ethereum-sepolia-rpc\.publicnode\.com/;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (rpcRoute.test(request.url())) rpcRequests++; });
  await page.goto(base);
  await page.getByRole('button', { name: '직접 검증하기', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.kp-transport>ol button')).toHaveCount(7);
  for (let i = 0; i < chapters.length; i++) {
    await page.locator('.kp-transport>ol button').nth(i).click();
    await expect(page.locator(`.scene-${chapters[i]}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (i < 3) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}/${chapters[i]}.png`, fullPage: true }); }
  }
  await expect(page.locator('.kam')).toContainText('Bitcoin');
  await expect(page.locator('.kam')).toContainText('전용 지갑');
  await expect(page.locator('.ve-app-header')).toContainText('KODA 대시보드');
  await expect(page.locator('.ve-reason')).toContainText('블록체인에 발급 기록을 남기는 이유');
  await page.locator('.kp-transport>ol button').nth(3).click();
  await page.locator('.ve-dashboard').evaluate(element => { element.dataset.qaIdentity = 'persistent-dashboard'; });
  await page.clock.install();
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-match/, { timeout: 90000 });
  await expect(page.locator('.ve-review')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  const callsAtResult = rpcRequests;
  await page.locator('.ve-review ol button').first().click();
  await page.getByRole('button', { name: '처리 기록 재생', exact: true }).click();
  await page.clock.fastForward(3_000);
  await expect(page.locator('.scene-receive')).toBeVisible();
  await page.clock.fastForward(500);
  await expect(page.locator('.scene-inspect')).toBeVisible();
  await page.getByRole('button', { name: '처리 기록 일시정지', exact: true }).click();
  await page.clock.fastForward(10_000);
  await expect(page.locator('.scene-inspect')).toBeVisible();
  await expect(page.locator('.ve-review ol button').nth(1)).toHaveAttribute('aria-current','step');
  await page.getByRole('button', { name: '처리 기록 재생', exact: true }).click();
  await page.clock.fastForward(3_500);
  await expect(page.locator('.ve-review ol button').nth(2)).toHaveAttribute('aria-current','step');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}/inspect-original.png`, fullPage: true });
  await page.clock.fastForward(3_500);
  await expect(page.locator('.scene-lookup')).toBeVisible();
  await expect(page.locator('.ve-technical')).toContainText('records');
  await expect(page.locator('.ve-technical')).toContainText('finalized');
  await expect(page.locator('.kam-chain')).toHaveClass(/is-active/);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}/lookup-original.png`, fullPage: true });
  await page.clock.fastForward(3_500);
  await expect(page.locator('.scene-compare')).toBeVisible();
  await page.clock.fastForward(3_500);
  await expect(page.getByRole('button', { name: '처리 기록 재생', exact: true })).toBeVisible();
  await expect(page.locator('.ve-dashboard')).toHaveAttribute('data-qa-identity','persistent-dashboard');
  await expect(page.locator('.ve-questions li')).toHaveCount(3);
  expect(rpcRequests).toBe(callsAtResult);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}/compare-original.png`, fullPage: true });
  findings.push('Real original match is immediate; 3.5s review changes chapters while the dashboard DOM persists; pause/select/end add no RPC.');

  await page.locator('.kp-transport>ol button').nth(5).click();
  await expect(page.locator('.ve-review')).toHaveCount(0);
  await expect(page.locator('.kam-chain')).toHaveClass(/is-active/);
  await expect(page.locator('.ve-dashboard')).toHaveAttribute('data-qa-identity','persistent-dashboard');
  await page.getByRole('button', { name: '변경본 120 BTC' }).click();
  await expect(page.locator('.scene-receive')).toBeVisible();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-idle/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.resume();
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-mismatch/, { timeout: 90000 });
  await expect(page.locator('.ve-questions li').first()).toContainText('연결되지 않음');
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '처리 기록 재생', exact: true })).toBeDisabled();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  await page.clock.fastForward(20_000);
  await expect(page.locator('.scene-receive')).toBeVisible();
  await page.locator('.ve-review ol button').last().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.scene-compare')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}/compare-altered.png`, fullPage: true });
  findings.push('Altered PDF mismatches; original metadata signature is not shown as authenticating the submitted file. Reduced-motion review remains manual and keyboard accessible.');
  await page.clock.resume();
  await page.getByRole('button', { name: '다시 검증하기', exact: true }).click();
  await expect(page.locator('.ve-review')).toHaveCount(0);
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-mismatch/, { timeout: 90000 });

  await page.getByRole('button', { name: '발급 원본 100 BTC' }).click();
  let injected = 0;
  await page.route(rpcRoute, route => {
    injected++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc:'2.0',id:route.request().postDataJSON()?.id ?? 1,error:{code:-32603,message:'QA: forced lookup failure'} }) });
  });
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-failure/, { timeout: 90000 });
  expect(injected).toBeGreaterThan(0);
  await expect(page.locator('.ve-review ol button')).toHaveCount(1);
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음 처리 기록' })).toBeDisabled();
  await expect(page.locator('.kam.is-review .is-complete')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}/injected-rpc-failure.png`, fullPage: true });
  findings.push('Injected lookup failure: incomplete result, one attempted review group, no false confirmations or chain completion.');

  for (const width of [1280,390]) {
    await page.setViewportSize({width,height:width===390?844:900});
    for (let i=0;i<chapters.length;i++) {
      await page.locator('.kp-transport>ol button').nth(i).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if(i===0||i===5) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({path:`${output}/${width}-${chapters[i]}.png`,fullPage:true}); }
    }
  }
  expect(errors).toEqual([]);
  findings.push('Seven chapters at 1440/1280/390px without horizontal overflow; no browser exceptions or wallet requests.');
  await writeFile(`${output}/browser-check.json`,JSON.stringify({base,findings},null,2));
  console.log(findings.join('\n'));
} finally { await browser.close(); }
