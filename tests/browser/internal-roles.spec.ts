import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createSupportedPdf,pdfEntries} from '@koda/protocol';
import {authenticate,logout} from './helpers.js';
import {testDataDir} from '../../scripts/test-environment.js';
const shots=resolve(testDataDir,'screenshots');mkdirSync(shots,{recursive:true});
const doc='KODA-PRD-20260930-GAON';

test('four roles: finance → accounting → auditor; actual PDF inspection, responsive UI and cascaded revocation',async({page,browser})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.role-journey li')).toHaveCount(4);await authenticate(page,'issuer');
 await expect(page.locator('.certificate')).toBeVisible();
 if(await page.getByRole('button',{name:'원본 PDF 발행하기',exact:true}).count())await page.getByRole('button',{name:'원본 PDF 발행하기',exact:true}).click();
 await expect(page.getByText('원본이 발행되었습니다',{exact:true})).toBeVisible();
 const original=await(await page.request.get(`/api/issuer/evidence/${doc}/versions/1/file`)).body();
 const source=await(await page.request.get(`/api/issuer/evidence/${doc}/versions/1/source`)).json();const payload=JSON.parse(source.envelope.payloadCanonical),font=readFileSync('apps/web/public/fonts/PretendardVariable.ttf');
 expect(payload.assets[0].valuationAmount).toBe('1942110000');
 const modifiedPayload=structuredClone(payload);modifiedPayload.assets[0].quantity='15.4500';modifiedPayload.assets[0].valuationAmount='2410088000';
 const modified=Buffer.from(createSupportedPdf(pdfEntries(modifiedPayload),font,source.envelope.salt,'modified'));
 const resaved=Buffer.from(createSupportedPdf(pdfEntries(payload),font,source.envelope.salt,'resaved'));
 const fileDir=resolve(testDataDir,'pdf-files');mkdirSync(fileDir,{recursive:true});for(const [name,bytes]of [['original.pdf',original],['content-modified.pdf',modified],['resaved.pdf',resaved]]as const)writeFileSync(resolve(fileDir,name),bytes,{mode:0o600});
 await logout(page);await authenticate(page,'finance-a');await page.getByRole('link',{name:'㈜가온테크 잔고 증명서',exact:true}).click();
 await expect(page.getByRole('button',{name:'회계담당자에게 인계하기',exact:true})).toBeVisible();expect(await page.getByRole('button',{name:'감사인에게 권한 보내기',exact:true}).count()).toBe(0);
 const finance=await(await page.request.get(`/api/finance/evidence/${doc}/versions/1`)).json();expect(finance.canShare).toBe(false);expect(finance.journal).toBeUndefined();
 const financeSession=await(await page.request.get('/api/me')).json();
 const previous=await(await page.request.get(`/api/finance/evidence/${doc}/versions/1/internal-grants`)).json();
 for(const g of previous)if(g.status==='ACTIVE')await page.request.post('/api/internal-grants/'+g.id+'/revoke',{headers:{origin:'http://localhost:5186','x-csrf-token':financeSession.csrf}});
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});const account=await ctx.newPage();account.on('pageerror',e=>errors.push(e.message));await account.goto('/');await authenticate(account,'accounting-a');
 await expect(account.getByRole('heading',{name:'조회할 증빙이 없습니다'})).toBeVisible();
 await page.getByRole('button',{name:'회계담당자에게 인계하기',exact:true}).click();await page.getByLabel('같은 회사의 회계담당자').selectOption({label:'회계담당자 A'});
 const handoffResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/internal-grants'));
 await page.getByRole('button',{name:'회계 열람 권한 생성',exact:true}).click();const handoff=await(await handoffResponse).json();await expect(page.getByText(/회계 열람 권한을 만들었습니다/)).toBeVisible();
 await page.screenshot({path:resolve(shots,'finance-handoff-1440.png'),fullPage:true});
 await account.evaluate(()=>window.dispatchEvent(new Event('focus')));await account.getByRole('link',{name:'㈜가온테크 잔고 증명서',exact:true}).click();
 await expect(account.getByRole('heading',{name:'결산용 거래',exact:true})).toBeVisible();await expect(account.locator('.accounting-journal tbody tr')).toHaveCount(4);
 await expect(account.locator('.event-list').first()).toContainText('회계 열람 허용 · 열람 확인');
 await expect(account.locator('.role-journey [aria-current=step]')).toContainText('회계');
 const accounting=await(await account.request.get(`/api/accounting/evidence/${doc}/versions/1`)).json();expect(accounting.journal).toHaveLength(12);
 const body=await account.locator('body').innerText();for(const secret of [payload.assets[0].custodyAddress,payload.movements[0].transactionReference,source.envelope.salt,payload.movements[0].counterpartyName])expect(body).not.toContain(secret);
 expect((await account.request.get(`/api/issuer/evidence/${doc}/versions/1/file`)).status()).toBe(403);
 await account.getByRole('button',{name:'나머지 8건 펼치기',exact:true}).click();await expect(account.locator('.accounting-journal tbody tr')).toHaveCount(12);await account.getByRole('button',{name:'거래 내역 접기',exact:true}).click();

 for(const [width,height]of [[1440,900],[1280,900],[390,844],[720,450]] as const){
   await account.setViewportSize({width,height});await account.screenshot({path:resolve(shots,'accounting-'+width+'.png'),fullPage:width!==390});
   expect(await account.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await expect(account.getByRole('button',{name:'감사인에게 권한 보내기',exact:true})).toBeVisible();
 }
 await account.setViewportSize({width:1440,height:900});
 await account.evaluate(()=>document.documentElement.style.zoom='2');await account.screenshot({path:resolve(shots,'accounting-css-zoom-200.png'),fullPage:true});expect(await account.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await account.evaluate(()=>document.documentElement.style.zoom='');
 const fonts=await account.evaluate(async()=>{await document.fonts.ready;return {ok:document.fonts.check('16px Pretendard'),faces:[...document.fonts].filter(f=>f.family==='Pretendard').map(f=>f.status)};});expect(fonts.ok).toBe(true);expect(fonts.faces).toContain('loaded');
 await account.getByRole('button',{name:'감사인에게 권한 보내기',exact:true}).focus();await account.keyboard.press('Enter');
 await expect(account.getByRole('heading',{name:'열람 권한 설정'})).toBeVisible();
 const externalResponse=account.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/grants'));
 await account.getByRole('button',{name:'권한 생성',exact:true}).click();const external=await(await externalResponse).json();expect(Date.parse(external.grant.expiresAt)).toBeLessThanOrEqual(Date.parse(handoff.expiresAt));
 await ctx.grantPermissions(['clipboard-read','clipboard-write']);await account.getByRole('button',{name:'링크 복사',exact:true}).click();await expect(account.getByText(/링크를 복사했습니다/)).toBeVisible();
 const actx=await browser.newContext({viewport:{width:1440,height:900}});const audit=await actx.newPage();audit.on('pageerror',e=>errors.push(e.message));
 await audit.goto('/share#token='+external.token);await authenticate(audit,'auditor-b');await expect(audit.locator('.certificate')).toBeVisible();
 const before=await audit.locator('.certificate').innerText();await audit.getByRole('button',{name:'원본 검증하기',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('KODA가 발행한 원본과 같습니다.');expect((await audit.locator('.certificate').innerText()).replace(/\s/g,'')).toBe(before.replace(/\s/g,''));
 await audit.screenshot({path:resolve(shots,'auditor-1440.png'),fullPage:true});
 await audit.getByText('사본 파일 검사로 이동 →',{exact:true}).click();
 for(const[name,buffer,result]of [['original.pdf',original,'KODA가 발행한 원본과 같습니다.'],['content-modified.pdf',modified,'체인 기록과 다릅니다.'],['resaved.pdf',resaved,'원본 아님 · 재저장 사본 또는 열람본'],['unreadable.pdf',Buffer.from('%PDF-1.7\nunknown'),'내용 비교 불가']]as const){
   await audit.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name,mimeType:'application/pdf',buffer});await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText(result);
   if(name==='content-modified.pdf'){await expect(audit.locator('.asset-table')).toContainText('15.4500');await expect(audit.locator('.asset-table')).toContainText('1,942,110,000');}
 }
 await audit.route('**/anchor-record',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'RECORD_UNAVAILABLE',message:'모의 기록 조회 실패'})}));await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('모의 기록을 확인할 수 없습니다');await audit.unroute('**/anchor-record');
 // Replacing a file cancels a pending result for the previous selection.
 let releaseFile!:()=>void;let fileReached!:()=>void;let holdFile=true;
 const fileHeld=new Promise<void>(r=>releaseFile=r),fileStarted=new Promise<void>(r=>fileReached=r);
 await audit.route('**/anchor-record',async route=>{if(!holdFile){await route.continue();return;}holdFile=false;const response=await route.fetch();fileReached();await fileHeld;await route.fulfill({response}).catch(()=>{});});
 await audit.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name:'previous.pdf',mimeType:'application/pdf',buffer:original});await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await fileStarted;
 await audit.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name:'current.pdf',mimeType:'application/pdf',buffer:modified});releaseFile();await audit.unroute('**/anchor-record');
 await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('체인 기록과 다릅니다.');expect(await audit.locator('.pdf-result').innerText()).not.toContain('KODA가 발행한 원본과 같습니다.');
 await account.getByRole('button',{name:'공유 확인 닫기'}).click();
 // A previously successful response held in the browser must not restore a revoked view.
 let release!:()=>void;let reached!:()=>void;const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>reached=r);let first=true;
 await account.route('**/api/accounting/evidence/*/versions/1',async route=>{if(!first){await route.continue();return;}first=false;const response=await route.fetch();reached();await held;await route.fulfill({response}).catch(()=>{});});
 await account.evaluate(()=>window.dispatchEvent(new Event('focus')));await started;
 await page.getByText(/인계 현황 ·/).click();await page.getByRole('button',{name:'인계 현황 새로고침'}).click();await expect(page.getByText(/회계 열람 확인 ·/).first()).toBeVisible();
 await page.getByRole('button',{name:'인계 철회',exact:true}).click();await page.getByRole('button',{name:'인계 철회 확정',exact:true}).click();await expect(page.locator('.trace-graph')).toContainText('서버 · 인계 철회');
 await account.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(account.getByText(/회계 열람 권한이 없거나 만료·철회/)).toBeVisible();release();await account.unroute('**/api/accounting/evidence/*/versions/1');expect(await account.locator('.certificate').count()).toBe(0);
 await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.getByText(/접근 차단 · 문서를 표시할 수 없습니다/)).toBeVisible();expect(await audit.locator('.certificate').count()).toBe(0);
 expect(errors).toEqual([]);await ctx.close();await actx.close();
});
