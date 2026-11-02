import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSupportedPdf, pdfEntries } from '@koda/protocol';
import { authenticate, logout } from './helpers.js';
import { testDataDir } from '../../scripts/test-environment.js';

const doc='KODA-PRD-20260930-GAON';
const shots=resolve(testDataDir,'screenshots');mkdirSync(shots,{recursive:true});
test('PRD S01–07: live issuance, permissions, PDF files, four layouts and revocation',async({page,browser})=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const outgoing:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://localhost:5186')&&!r.url().startsWith('data:'))outgoing.push(r.url());});
 await page.goto('/');await expect(page.getByText('인증 전 · 역할별 공개 범위')).toBeVisible();
 await page.screenshot({path:resolve(shots,'01-auth-1440.png'),fullPage:true});
 await authenticate(page,'issuer');await expect(page.locator('.certificate')).toBeVisible();
 if(await page.getByRole('button',{name:'원본 PDF 발행하기',exact:true}).count()) await page.getByRole('button',{name:'원본 PDF 발행하기',exact:true}).click();await expect(page.getByText('원본이 발행되었습니다',{exact:true})).toBeVisible();
 await expect(page.locator('.certificate')).toContainText('12.4500');await page.screenshot({path:resolve(shots,'02-issued-1440.png'),fullPage:true});
 const downloaded=await page.request.get(`/api/issuer/evidence/${doc}/versions/1/file`);expect(downloaded.status()).toBe(200);const original=await downloaded.body();
 const source=await (await page.request.get(`/api/issuer/evidence/${doc}/versions/1/source`)).json();const payload=JSON.parse(source.envelope.payloadCanonical);const font=readFileSync('apps/web/public/fonts/PretendardVariable.ttf');const salt=source.envelope.salt;
 const changed=structuredClone(payload);changed.assets[0].quantity='15.4500';changed.assets[0].valuationAmount='2410088000';
 const modified=Buffer.from(createSupportedPdf(pdfEntries(changed),font,salt,'content-modified'));
 const resaved=Buffer.from(createSupportedPdf(pdfEntries(payload),font,salt,'resaved-supported'));
 const files=resolve(testDataDir,'pdf-files');mkdirSync(files,{recursive:true});for(const [name,buffer] of [['original.pdf',original],['content-modified.pdf',modified],['resaved.pdf',resaved]] as const)writeFileSync(resolve(files,name),buffer,{mode:0o600});
 await logout(page);await authenticate(page,'finance-a');await page.getByRole('link',{name:'㈜가온테크 잔고 증명서',exact:true}).click();
 await expect(page.getByText('원본 기반 열람본 · 일부 가림')).toBeVisible();await expect(page.getByRole('button',{name:'원본 내려받기 없음'})).toBeDisabled();expect(await page.getByRole('button',{name:'원본 검증하기',exact:true}).count()).toBe(0);
 const financeBody=await page.locator('body').innerText();expect(financeBody).not.toContain(payload.assets[0].custodyAddress);expect(financeBody).not.toContain(payload.movements[0].transactionReference);expect(financeBody).not.toContain(salt);
 const summary=await (await page.request.get(`/api/finance/evidence/${doc}/versions/1`)).text();expect(summary).not.toContain(salt);expect(summary).not.toContain(payload.assets[0].custodyAddress);
 await page.screenshot({path:resolve(shots,'03-finance-1440.png'),fullPage:true});
 await expect(page.locator('[aria-current=step]')).toHaveCount(1);await expect(page.locator('[aria-current=step]')).toContainText('일부 가림 열람');await page.getByRole('button',{name:'감사인에게 권한 보내기',exact:true}).click();await expect(page.locator('[aria-current=step]')).toContainText('권한 전달');await expect(page.getByText('외부감사 제출용 · 전체 항목')).toBeVisible();await expect(page.getByText('원본 파일은 재무 담당자 PC를 거치지 않습니다.')).toBeVisible();
 const created=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/grants'));await page.getByRole('button',{name:'권한 생성',exact:true}).click();const grant=await (await created).json();await expect(page.getByRole('heading',{name:'권한 생성 · 수신 대기',exact:true})).toBeVisible();
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'링크 복사',exact:true}).click();await expect(page.getByText(/링크를 복사했습니다/)).toBeVisible();
 await page.screenshot({path:resolve(shots,'04-share-1440.png'),fullPage:true});await page.getByRole('button',{name:'공유 확인 닫기'}).click();
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});const audit=await ctx.newPage();audit.on('pageerror',e=>errors.push(e.message));await audit.goto('/share#token='+grant.token);await authenticate(audit,'auditor-b');await expect(audit.locator('.certificate')).toBeVisible();await expect(audit.locator('.transaction-table tbody tr')).toHaveCount(4);
 await audit.getByText('주소·거래·발행 상세',{exact:true}).click();await audit.getByRole('button',{name:'나머지 8건 펼치기'}).click();await expect(audit.locator('.transaction-table tbody tr')).toHaveCount(12);await audit.getByRole('button',{name:'거래 내역 접기'}).click();await audit.getByText('주소·거래·발행 상세',{exact:true}).click();
 const before=await audit.locator('.certificate').innerText();await audit.getByRole('button',{name:'원본 검증하기',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('KODA가 발행한 원본과 같습니다.');expect((await audit.locator('.certificate').innerText()).replace(/\s/g,'')).toBe(before.replace(/\s/g,''));
 const checked=await audit.locator('.pdf-result p').textContent();await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.locator('.pdf-result p')).toHaveText(checked!);
 const fontCheck=await audit.evaluate(async()=>{await document.fonts.ready;return{loaded:document.fonts.check('16px Pretendard'),family:getComputedStyle(document.body).fontFamily,faces:[...document.fonts].filter(f=>f.family==='Pretendard').map(f=>f.status),storage:[localStorage.length,sessionStorage.length]};});expect(fontCheck.loaded).toBe(true);expect(fontCheck.faces).toContain('loaded');expect(fontCheck.storage).toEqual([0,0]);
 for(const [name,width,height] of [['1440',1440,900],['1280',1280,900],['390',390,844],['zoom-200-layout',720,450]] as const){await audit.setViewportSize({width,height});await audit.screenshot({path:resolve(shots,'05-original-'+name+'.png'),fullPage:true});expect(await audit.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(audit.getByRole('button',{name:'원본 검증하기',exact:true})).toBeVisible();}
 await audit.setViewportSize({width:1440,height:900});
 await audit.getByText('사본 파일 검사로 이동 →',{exact:true}).click();
 const choose=async(name:string,buffer:Buffer,expected:string)=>{await audit.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name,mimeType:'application/pdf',buffer});await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText(expected);};
 await choose('renamed-original.pdf',original,'KODA가 발행한 원본과 같습니다.');await choose('content-modified.pdf',modified,'체인 기록과 다릅니다.');await expect(audit.locator('.asset-table')).toContainText('15.4500');await expect(audit.locator('.asset-table')).toContainText('2,410,088,000');await expect(audit.locator('.asset-table')).toContainText('원본 12.4500');await audit.screenshot({path:resolve(shots,'07-content-changed.png'),fullPage:true});
 await choose('resaved.pdf',resaved,'원본 아님 · 재저장 사본 또는 열람본');await audit.screenshot({path:resolve(shots,'07-resaved.png'),fullPage:true});
 await choose('unsupported.pdf',Buffer.from('%PDF-1.7\nnot-a-supported-file'),'내용 비교 불가');await audit.getByRole('button',{name:'KODA에 확인 요청',exact:true}).click();await expect(audit.getByText('문의 초안 · 실제 발송 없음')).toBeVisible();
 await audit.getByRole('button',{name:'원본 링크로 다시 받기',exact:true}).click();await expect(audit.locator('.certificate')).toContainText('12.4500');await expect(audit.locator('.pdf-result')).toHaveCount(0);await audit.getByText('사본 파일 검사로 이동 →',{exact:true}).click();
 // Late response from old file must not repaint a newer selection.
 let release!:()=>void;const held=new Promise<void>(r=>release=r);let requested!:()=>void;const reached=new Promise<void>(r=>requested=r);
 await audit.route('**/api/grants/*/file',async route=>{requested();await held;await route.continue().catch(()=>{});});
 await audit.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name:'slow.pdf',mimeType:'application/pdf',buffer:modified});await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Expected PDF request did not start')),10000))]);
 await audit.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name:'new.pdf',mimeType:'application/pdf',buffer:resaved});release();await audit.unroute('**/api/grants/*/file');await expect(audit.locator('.pdf-result')).toContainText('파일을 선택했습니다.');await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('원본 아님');
 // Record lookup failure is unavailable, never a successful match.
 await audit.route('**/anchor-record',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'RECORD_UNAVAILABLE',message:'모의 기록 조회 실패'})}));await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.pdf-result')).toContainText('모의 기록을 확인할 수 없습니다');await audit.unroute('**/anchor-record');
 await page.getByRole('button',{name:'현황 새로고침',exact:true}).click();await expect(page.getByText(/열람 확인 ·/).first()).toBeVisible();await page.getByRole('button',{name:'철회',exact:true}).first().click();await page.getByRole('button',{name:'공유 철회',exact:true}).click();
 await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.getByText(/접근 차단 · 문서를 표시할 수 없습니다/)).toBeVisible();expect(await audit.locator('.certificate').count()).toBe(0);expect(await audit.locator('.pdf-result').count()).toBe(0);
 expect(errors).toEqual([]);expect(outgoing).toEqual([]);await ctx.close();
});
