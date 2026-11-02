import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {testDataDir} from '../../scripts/test-environment.js';
import {authenticate} from './helpers.js';
const shots=resolve(testDataDir,'guided-scenes');mkdirSync(shots,{recursive:true});
test('original scenes stay connected through real role authentication and file inspection',async({page})=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await authenticate(page,'issuer');await expect(page.locator('.certificate')).toBeVisible();
 if(await page.getByRole('button',{name:'원본 PDF 발행하기',exact:true}).count())await page.getByRole('button',{name:'원본 PDF 발행하기',exact:true}).click();
 await expect(page.getByText('원본이 발행되었습니다',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'재무담당자에게 이어가기 →'}).click();
 await expect(page.locator('.role-choice')).toHaveCount(1);await authenticate(page,'finance-a');
 await expect(page.locator('.certificate .wallet-list')).toBeVisible();
 await expect(page.locator('.certificate')).toContainText('원본 기반 열람본 · 일부 가림');
 await expect(page.locator('.current-scene')).toContainText('S-03');
 const financeDocument=await page.locator('.certificate').innerText();
 expect(await page.locator('.transaction-table').count()).toBe(0);
 await page.screenshot({path:resolve(shots,'03-finance-1440.png')});
 await page.getByRole('button',{name:'회계담당자에게 인계하기',exact:true}).click();
 await page.getByRole('button',{name:'회계 열람 권한 생성',exact:true}).click();
 await page.getByRole('button',{name:'회계담당자에게 이어가기 →'}).click();
 await expect(page.locator('.role-choice')).toHaveCount(1);await authenticate(page,'accounting-a');
 await expect(page.locator('.current-scene')).toContainText('S-03b');
 await expect(page.locator('.accounting-journal tbody tr')).toHaveCount(4);
 await page.screenshot({path:resolve(shots,'03b-accounting-1440.png')});
 await page.getByRole('button',{name:'감사인에게 권한 보내기',exact:true}).click();
 await expect(page.locator('.current-scene')).toContainText('S-04');
 await expect(page.locator('.certificate')).toBeVisible();await expect(page.locator('.certificate .wallet-list')).toBeVisible();
 await page.screenshot({path:resolve(shots,'04-permission-1440.png')});
 await page.getByRole('button',{name:'권한 생성',exact:true}).click();
 await page.getByRole('button',{name:'지정 감사인에게 이어가기 →'}).click();
 await expect(page.locator('.role-choice')).toHaveCount(1);await authenticate(page,'auditor-b');
 await expect(page.locator('.current-scene')).toContainText('S-05');
 await expect(page.locator('.transaction-table tbody tr')).toHaveCount(4);
 expect(await page.locator('.certificate').innerText()).not.toBe(financeDocument);
 const before=await page.locator('.certificate').innerText();
 const boxBefore=await page.locator('.certificate').boundingBox();
 await page.getByRole('button',{name:'원본 검증하기',exact:true}).click();
 await expect(page.locator('.pdf-result')).toContainText('KODA가 발행한 원본과 같습니다.');
 await expect(page.locator('.current-scene')).toContainText('S-06');
 expect(await page.locator('.certificate').innerText()).toBe(before);
 expect((await page.locator('.certificate').boundingBox())?.y).toBe(boxBefore?.y);
 await expect(page.locator('.trace-graph')).toContainText('저장 지문');
 for(const width of [1440,1280,962,390,720]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:resolve(shots,`06-verification-${width}.png`)});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:resolve(shots,'06-zoom-200.png')});
 await page.evaluate(()=>document.documentElement.style.zoom='');
 expect(await page.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('16px Pretendard')&&[...document.fonts].some(f=>f.family==='Pretendard'&&f.status==='loaded');})).toBe(true);
 await page.getByText('사본 파일 검사로 이동 →',{exact:true}).click();
 for(const [sample,status] of [['정상 원본','KODA가 발행한 원본과 같습니다.'],['내용 수정','체인 기록과 다릅니다.'],['재저장 사본','원본 아님 · 재저장 사본 또는 열람본'],['비교 불가','내용 비교 불가']]){
  await page.getByRole('button',{name:sample!,exact:true}).click();
  await expect(page.locator('.selected-file')).toBeVisible();
  await page.getByRole('button',{name:'선택 파일 검사',exact:true}).click();
  await expect(page.locator('.pdf-result')).toContainText(status!);
  if(sample==='내용 수정'){
   await expect(page.locator('.asset-table')).toContainText('15.4500');
   await expect(page.locator('.asset-table')).toContainText('12.4500');
   await page.screenshot({path:resolve(shots,'07-modified-1440.png')});
  }
 }
 expect(errors).toEqual([]);
});
