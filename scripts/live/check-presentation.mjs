import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.KODA_PREVIEW_URL ?? 'http://127.0.0.1:5190/live.html';
const output = process.env.KODA_REVIEW_OUTPUT ?? 'docs/design/two-act-demo-2026-11-06';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const findings = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  let rpcRequests = 0;
  const rpcRoute = /ethereum-sepolia-rpc\.publicnode\.com/;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (rpcRoute.test(request.url())) rpcRequests++; });
  const shot = async name => { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({path:`${output}/${name}.png`,fullPage:true}); };
  await page.goto(base);
  await page.getByRole('button', { name: '제3자가 검증하기', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.kp-acts button')).toHaveCount(2);
  await expect(page.locator('.kam-custody-context')).toHaveCount(0);
  for (const route of ['koda-bitcoin','customer-bitcoin','koda-customer-pdf','customer-third-party-pdf','koda-ethereum-register','third-party-ethereum-query','ethereum-third-party-response']) await expect(page.getByTestId(route)).toHaveCount(1);
  await expect(page.locator('[data-testid="third-party-bitcoin"]')).toHaveCount(0);
  await shot('01-issue');
  await page.locator('.ij-beats ol button').nth(1).click();
  await expect(page.getByTestId('koda-ethereum-register')).toHaveClass(/is-active/);
  await shot('01-register');
  await page.locator('.ij-beats ol button').nth(2).click();
  await expect(page.getByTestId('koda-customer-pdf')).toHaveClass(/is-active/);
  await page.getByRole('button', { name: '제3자가 검증하기', exact: true }).click();
  await expect(page.locator('.ve-app-header')).toContainText('대시보드');
  await expect(page.locator('.ve-evidence')).not.toHaveAttribute('open');
  await shot('02-ready');
  await page.locator('.ve-dashboard').evaluate(element => { element.dataset.qaIdentity = 'same-dashboard'; });
  await page.clock.install();
  await page.getByRole('button', { name: '문서 검증하기', exact: true }).click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-match/, { timeout: 90000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  const callsAtResult = rpcRequests;
  await expect(page.locator('.ve-replay')).toContainText('1 / 3');
  await expect(page.locator('.ve-processing')).toHaveClass(/phase-inspect/);
  await page.clock.fastForward(4_000);
  await expect(page.locator('.ve-processing')).toHaveClass(/phase-inspect/);
  await page.clock.fastForward(1_000);
  await expect(page.locator('.ve-processing')).toHaveClass(/phase-lookup/);
  await page.getByRole('button',{name:'처리 설명 일시정지',exact:true}).click();
  await page.clock.fastForward(10_000);
  await expect(page.locator('.ve-processing')).toHaveClass(/phase-lookup/);
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-match/);
  await shot('02-record-read');
  await page.getByRole('button',{name:'다음 처리 설명',exact:true}).click();
  await expect(page.locator('.ve-processing')).toHaveClass(/phase-compare/);
  await expect(page.locator('.ve-dashboard')).toHaveAttribute('data-qa-identity','same-dashboard');
  await expect(page.locator('.ve-questions li')).toHaveCount(3);
  expect(await page.locator('.ve-experience').innerText()).not.toMatch(/0x[a-f0-9]{64}/i);
  expect(rpcRequests).toBe(callsAtResult);
  await shot('02-match');
  findings.push('Two acts. One integrated actor map; custody paths go to Bitcoin, registration/read paths to Ethereum. Same dashboard through verification and replay.');
  findings.push('Actual original match is immediate. Observed summary advances after 5 seconds; pause/manual selection work without extra RPC. Full hashes stay in closed details.');

  await page.clock.resume();
  await page.getByRole('button', { name:'변경본 120 BTC', exact:true }).click();
  await expect(page.locator('.ve-outcome')).toHaveCount(0);
  await expect(page.locator('.ve-replay')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'문서 검증하기',exact:true}).click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-mismatch/,{timeout:90000});
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'처리 설명 재생',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'다음 처리 설명',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ve-processing')).toHaveClass(/phase-compare/);
  await shot('02-mismatch');
  await page.locator('.kp-acts button').first().click();
  await page.locator('.kp-acts button').last().click();
  await expect(page.locator('.ve-replay')).toHaveCount(0);
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-mismatch/);
  findings.push('Actual altered PDF mismatches. No original-signature claim authenticates the changed file. Reduced motion and keyboard controls work; act navigation stops replay and retains selected data.');

  await page.getByRole('button',{name:'발급 원본 100 BTC',exact:true}).click();
  let injected=0;
  await page.route(rpcRoute, route=>{injected++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:route.request().postDataJSON()?.id??1,error:{code:-32603,message:'QA forced lookup failure'}})});});
  await page.getByRole('button',{name:'문서 검증하기',exact:true}).click();
  await expect(page.locator('.ve-outcome')).toHaveClass(/is-failure/,{timeout:90000});
  expect(injected).toBeGreaterThan(0);
  await expect(page.locator('.ve-replay')).toContainText('1 / 1');
  await expect(page.locator('.ve-questions .is-confirmed')).toHaveCount(0);
  await expect(page.locator('.ve-digest-chain')).toContainText('등록된 원본 해시');
  await expect(page.locator('.ve-comparison-sign')).toHaveCount(0);
  await shot('02-unavailable');
  findings.push('Injected RPC failure remains incomplete. Only attempted lookup is replayable; no returned hash, comparison or successful answers are fabricated.');

  for(const width of [1440,1280,390]){
    await page.setViewportSize({width,height:width===390?844:900});
    for(let act=0;act<2;act++){
      await page.locator('.kp-acts button').nth(act).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
      if(act===0){await expect(page.locator('.kp-error')).toHaveCount(0);for(let i=0;i<3;i++){await page.locator('.ij-beats ol button').nth(i).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}}
      if(width!==1440)await shot(`${width}-act-${act+1}`);
    }
  }
  expect(errors).toEqual([]);
  findings.push('1440/1280/390px: both acts and issuer beats without horizontal overflow or browser exceptions. No wallet requests or new transactions.');
  await writeFile(`${output}/browser-check.json`,JSON.stringify({base,checkedAt:new Date().toISOString(),findings},null,2));
  console.log(JSON.stringify({base,findings},null,2));
}finally{await browser.close();}
