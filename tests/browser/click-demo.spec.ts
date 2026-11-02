import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {testDataDir} from '../../scripts/test-environment.js';
import {logout} from './helpers.js';
const shots=resolve(testDataDir,'click-ui');mkdirSync(shots,{recursive:true});
test('click identity: readable roles, actual resolve/sign/verify, failure and retry',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('button',{name:'재무담당자로 시작',exact:true})).toBeEnabled();
 expect(await page.locator('input[type=file]').count()).toBe(0);await expect(page.locator('.role-choice')).toHaveCount(4);
 for(const [width,height]of [[1440,900],[1280,900],[390,844]] as const){await page.setViewportSize({width,height});await page.screenshot({path:resolve(shots,'login-'+width+'.png'),fullPage:width!==390});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 const lastRole=page.getByRole('button',{name:'외부 감사인으로 시작',exact:true});await lastRole.scrollIntoViewIfNeeded();await expect(lastRole).toBeInViewport();await page.screenshot({path:resolve(shots,'login-390-roles.png')});expect(await page.locator('.topbar').count()).toBe(1);
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.scrollTo(0,0));
 const calls:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/auth/'))calls.push(new URL(r.url()).pathname);});
 await page.route('**/auth/demo-resolve',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'MOCK_DID_UNAVAILABLE',message:'모의 DID 원장을 조회하지 못했습니다. 다시 시도해 주세요.'})}));
 await page.getByRole('button',{name:'재무담당자로 시작',exact:true}).click();await expect(page.getByRole('alert')).toContainText('모의 DID 원장');expect(calls).toEqual(['/api/auth/demo-resolve']);
 await expect(page.locator('.trace-graph [data-state=blocked]')).toContainText('DID 등록 조회');expect(await page.getByRole('button',{name:'역할 바꾸기',exact:true}).count()).toBe(0);
 await page.screenshot({path:resolve(shots,'did-unavailable.png'),fullPage:true});await page.unroute('**/auth/demo-resolve');calls.length=0;
 await page.getByRole('button',{name:'다시 시도',exact:true}).click();await expect(page.getByRole('button',{name:'역할 바꾸기',exact:true})).toBeVisible();
 expect(calls).toEqual(['/api/auth/demo-resolve','/api/auth/challenge','/api/auth/demo-sign','/api/auth/verify']);
 await logout(page);
 let release!:()=>void;let reached!:()=>void;const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>reached=r);
 await page.route('**/auth/demo-sign',async route=>{const response=await route.fetch();reached();await held;await route.fulfill({response});});calls.length=0;
 const role=page.getByRole('button',{name:'회계담당자로 시작',exact:true});await expect(role).toBeEnabled();await role.focus();await page.keyboard.press('Enter');await started;
 await expect(page.locator('.trace-graph [aria-current=step]')).toContainText('시연 지갑');await expect(role).toBeDisabled();await page.screenshot({path:resolve(shots,'signing.png'),fullPage:true});release();
 await expect(page.getByRole('button',{name:'역할 바꾸기',exact:true})).toBeVisible();expect(calls.filter(x=>x.endsWith('demo-sign'))).toHaveLength(1);await page.unroute('**/auth/demo-sign');
 expect(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily)).toContain('Pretendard');expect(errors).toEqual([]);
});
