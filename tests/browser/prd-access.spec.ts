import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {authenticate,logout} from './helpers.js';
import {testDataDir,testOrigin} from '../../scripts/test-environment.js';
const doc='KODA-PRD-20260930-GAON';
async function grant(page:Page){
 const me=await(await page.request.get('/api/me')).json();const auditors=await(await page.request.get('/api/finance/auditors')).json();
 const r=await page.request.post(`/api/evidence/${doc}/versions/1/grants`,{headers:{origin:testOrigin,'x-csrf-token':me.csrf},data:{auditorDid:auditors[0].did,idempotencyKey:crypto.randomUUID()}});expect(r.status()).toBe(201);return r.json();
}
test('T02,12,16: actual rejected signature, keyboard authentication and 200% CSS zoom',async({page})=>{
 await page.goto('/');await expect(page.getByLabel('시연 신원',{exact:false})).toBeEnabled();await page.getByLabel('시연 신원',{exact:false}).selectOption('issuer');
 const bad=JSON.parse(readFileSync(resolve(testDataDir,'keys/issuer.json'),'utf8'));bad.pkcs8=JSON.parse(readFileSync(resolve(testDataDir,'keys/auditor-c.json'),'utf8')).pkcs8;
 await page.getByLabel('해당 신원의 키 파일').setInputFiles({name:'wrong-signature.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
 const denied=page.waitForResponse(r=>r.url().endsWith('/auth/verify'));await page.getByRole('button',{name:'시연 신원 인증'}).click();expect((await denied).status()).toBe(401);await expect(page.getByRole('alert')).toContainText('키가 일치하지 않거나');expect(await page.locator('.certificate').count()).toBe(0);
 await page.getByLabel('시연 신원',{exact:false}).selectOption('finance-a');await page.getByLabel('해당 신원의 키 파일').setInputFiles(resolve(testDataDir,'keys/finance-a.json'));await page.getByRole('button',{name:'시연 신원 인증'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('link',{name:'㈜가온테크 잔고 증명서',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'㈜가온테크 잔고 증명서',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByText('원본 기반 열람본 · 일부 가림')).toBeVisible();
 await page.getByRole('button',{name:'감사인에게 권한 보내기',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'감사인에게 권한 전달'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('region',{name:'감사인에게 권한 전달'})).toHaveCount(0);await expect(page.getByRole('button',{name:'감사인에게 권한 보내기',exact:true})).toBeFocused();
 // CSS zoom tests real 200% text/layout scaling. Browser-menu zoom remains a distinct manual check.
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});await page.screenshot({path:resolve(testDataDir,'screenshots','03-finance-css-200.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.getByRole('button',{name:'감사인에게 권한 보내기',exact:true})).toBeVisible();
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
});

test('T09–12: wrong recipient, direct ID, expiry, late revocation, logout/back never revive originals',async({page,browser})=>{
 test.setTimeout(90000);await page.goto('/');await authenticate(page,'finance-a');const created=await grant(page);
 const ctx=await browser.newContext(),audit=await ctx.newPage();await audit.goto('/share#token='+created.token);await authenticate(audit,'auditor-c');await expect(audit.getByText('접근 차단 · 문서를 표시할 수 없습니다.')).toHaveCount(0);await expect(audit.getByText(/접근 차단 · 문서를 표시할 수 없습니다/)).toBeVisible();expect(await audit.locator('.certificate').count()).toBe(0);
 expect((await audit.request.get('/api/grants/'+created.grant.id+'/file')).status()).toBe(404);
 await logout(audit);await audit.goto('/share#token='+created.token);await authenticate(audit,'auditor-b');await expect(audit.locator('.certificate')).toBeVisible();
 // Only this disposable grant is expired; no session clock override.
 let db=new DatabaseSync(resolve(testDataDir,'demo.sqlite'));db.prepare('UPDATE share_grants SET expiresAt=? WHERE id=?').run(Date.now()-1000,created.grant.id);db.close();
 await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.getByText(/기한이 지났습니다|만료되었습니다/)).toBeVisible();expect(await audit.locator('.certificate').count()).toBe(0);
 const next=await grant(page);await audit.goto('/share#token='+next.token);await expect(audit.locator('.certificate')).toBeVisible();
 let release!:()=>void;const hold=new Promise<void>(r=>release=r);let ready!:()=>void;const reached=new Promise<void>(r=>ready=r);
 await audit.route('**/anchor-record',async route=>{const response=await route.fetch();ready();await hold;await route.fulfill({response}).catch(()=>{});});
 await audit.getByRole('button',{name:'원본 검증하기',exact:true}).click();await reached;
 const me=await(await page.request.get('/api/me')).json();expect((await page.request.post('/api/grants/'+next.grant.id+'/revoke',{headers:{origin:testOrigin,'x-csrf-token':me.csrf}})).status()).toBe(200);release();
 await expect(audit.getByText(/철회되었습니다/)).toBeVisible();expect(await audit.locator('.pdf-result').count()).toBe(0);await audit.unroute('**/anchor-record');
 const final=await grant(page);await audit.goto('/share#token='+final.token);await expect(audit.locator('.certificate')).toBeVisible();await audit.getByRole('button',{name:'원본 검증하기',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('KODA가 발행한 원본과 같습니다.');await logout(audit);await audit.goBack();await expect(audit.getByRole('button',{name:'시연 신원 인증'})).toBeVisible();expect(await audit.locator('.certificate').count()).toBe(0);expect(await audit.locator('.pdf-result').count()).toBe(0);
 await ctx.close();
});
