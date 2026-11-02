import { test, expect, chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { testDataDir, testOrigin } from '../../scripts/test-environment.js';
import { authenticate, logout } from './helpers.js';

test('v0.3 T-16: actual Chrome 200% page zoom, S-01–07 and blocked state',async()=>{
  test.setTimeout(120000);
  const context=await chromium.launchPersistentContext(resolve(testDataDir,'zoom-profile-'+randomUUID()),{channel:'chrome',headless:true,viewport:{width:1440,height:900}});
  const page=await context.newPage();const dir=resolve(testDataDir,'screenshots/zoom');mkdirSync(dir,{recursive:true});
  async function shot(name:string){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); const cdp = await context.newCDPSession(page); const captured = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false }); writeFileSync(dir+'/'+name+'.png', Buffer.from(captured.data, 'base64')); await cdp.detach();}
  try{
    await page.goto('chrome://settings/appearance');await page.locator('#zoomLevel').selectOption({label:'200%'});await page.goto(testOrigin);
    expect(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))).toEqual({width:720,height:450,dpr:2});
    await expect(page.getByLabel('시연 신원')).toBeEnabled();await shot('s01');await authenticate(page,'issuer');
    await page.locator('[data-snapshot-id="GAON-Q3-V03"]').getByRole('button',{name:'발행 완료 원본 열기'}).click();await expect(page.locator('.issued-source')).toContainText('체인 기록 시각');await page.locator('.issued-source h2').first().scrollIntoViewIfNeeded();await shot('s02');
    await logout(page);await authenticate(page,'finance-a');await page.goto(testOrigin+'/evidence/KODA-20260930-GAON/versions/1');await expect(page.getByText('KODA 원본 확인 · 서버 검사',{exact:true})).toBeVisible();await shot('s03');await page.locator('.wallet-list').scrollIntoViewIfNeeded();await shot('s03-wallet');
    await page.getByRole('button',{name:'감사인에게 권한 전달'}).click();const dialog=page.getByRole('dialog');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await shot('s04');
    const made=page.waitForResponse(r=>r.url().endsWith('/versions/1/grants')&&r.request().method()==='POST');await page.getByRole('button',{name:'권한 생성',exact:true}).click();const {grant,token}=await(await made).json();
    await page.getByRole('button',{name:'공유 확인 닫기'}).click();await logout(page);await page.goto(testOrigin+'/share#token='+token);await authenticate(page,'auditor-b');await expect(page.locator('.certificate')).toContainText('㈜가온테크');await shot('s05');
    await page.getByRole('button',{name:'원본 검증하기',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByText('KODA가 발행한 원본과 같습니다.',{exact:true})).toBeVisible();await page.locator('.verification-result>strong').scrollIntoViewIfNeeded();await shot('s06');
    await page.getByRole('button',{name:'메일 사본 검사로 이동'}).click();await expect(page.getByLabel('검사할 시연 JSON 파일')).toBeFocused();await page.getByLabel('검사할 시연 JSON 파일').setInputFiles(resolve(testDataDir,'files/gaon-mail-copy.json'));await page.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(page.locator('.difference-table')).toContainText('15.4500');await page.locator('.file-inspection .verification-result>strong').scrollIntoViewIfNeeded();await shot('s07');await page.locator('.difference-table').scrollIntoViewIfNeeded();await shot('s07-difference');
    // A wrong recipient after real logout and reauthentication is a blocked access state at this zoom.
    await logout(page);await authenticate(page,'auditor-c');await expect(page.getByRole('alert')).toContainText('접근할 수 없습니다');await expect(page.locator('.certificate, .difference-table')).toHaveCount(0);await shot('blocked');
  }finally{await context.close();}
});
