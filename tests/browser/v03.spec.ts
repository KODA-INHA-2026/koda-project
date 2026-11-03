import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { authenticate, logout } from './helpers.js';
import { testDataDir } from '../../scripts/test-environment.js';
import { canonicalJson, evidenceFile, maskAddress } from '@koda/protocol';

const docPath='/evidence/KODA-20260930-GAON/versions/1';
async function screenshot(page: Page, name: string) { if (name.startsWith('s07-')) await page.locator('.file-inspection .verification-result>strong').scrollIntoViewIfNeeded(); else if (name.startsWith('s03-') || name.startsWith('s05-')) await page.evaluate(() => window.scrollTo(0,0)); mkdirSync(testDataDir+'/screenshots/v03',{recursive:true}); await page.screenshot({path:testDataDir+'/screenshots/v03/'+name+'.png',fullPage:false}); }
async function fits(page: Page) { expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true); }

test('v0.3 S-01–S-07 / M-01 / R / AC-01–12 / T-09,15–18: actual issuance, masking, transfer, verification, selected file and recovery',async({page,browser})=>{
  test.setTimeout(120000);
  await page.goto('/'); await expect(page.getByText('교육용 데모 · 합성 자료')).toBeVisible();
  await page.getByLabel('시연 신원').focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('해당 신원의 키 파일')).toBeFocused();
  await screenshot(page,'s01-auth'); await authenticate(page,'issuer');
  const candidate=page.locator('[data-snapshot-id="GAON-Q3-V03"]'); await expect(candidate).toBeVisible();
  if(await candidate.getByRole('button',{name:'발행 내용 확인'}).count()) {
    await candidate.getByRole('button',{name:'발행 내용 확인'}).click();
    const dialog=page.getByRole('dialog'); await expect(dialog).toContainText('㈜가온테크'); await expect(dialog).toContainText('12.4500'); await expect(dialog).toContainText('12건');
    await screenshot(page,'s02-candidate'); await page.getByRole('button',{name:'증빙 발행',exact:true}).click();
  } else test.info().annotations.push({type:'issuance-already-present',description:'Repeat run checks the immutable issued source; the first run exercises issuance.'});
  await expect(candidate.getByText('발행 완료',{exact:true})).toBeVisible();
  await candidate.getByRole('button',{name:'발행 완료 원본 열기'}).click(); await expect(page.locator('.issued-source')).toContainText('12건');
  const sourceResponse=await (await page.request.get('/api/issuer'+docPath+'/source')).json(); const source=sourceResponse.envelope; expect(sourceResponse.verification.anchorEvidence.recordedAt).toBeTruthy();
  const originalPayload=JSON.parse(source.payloadCanonical);
  await screenshot(page,'s02-issued');
  // Create files from the already signed and actually verified source, in the isolated private directory only.
  if (!await import('node:fs').then(fs=>fs.existsSync(resolve(testDataDir,'files/gaon-original.json')))) await promisify(execFile)(process.execPath,['--import','tsx','scripts/evidence-files.ts'],{env:{...process.env,KODA_DATA_DIR:testDataDir}});
  await logout(page); await authenticate(page,'finance-a'); await page.goto(docPath);
  await expect(page.getByText('KODA 원본 확인 · 서버 검사',{exact:true})).toBeVisible();
  const finance=await (await page.request.get('/api/finance'+docPath)).json();
  expect(finance.movementCount).toBe(12); expect(finance.assets.map((a:{quantity:string})=>a.quantity)).toEqual(['12.4500','310.2000','1250000.00']);
  expect(finance.assets.map((a:{valuationAmount:string})=>a.valuationAmount)).toEqual(['1245000000','930600000','1750000000']);
  const html=await page.content(), safe=JSON.stringify(finance);
  for(const asset of originalPayload.assets){ expect(finance.assets.find((a:{code:string})=>a.code===asset.code).custodyAddressMasked).toBe(maskAddress(asset.custodyAddress)); expect(html+safe).not.toContain(asset.custodyAddress.slice(4,-4)); }
  for(const privateValue of [source.salt,source.signature,source.payloadCanonical,...originalPayload.movements.flatMap((m:{id:string;counterpartyAddress:string;transactionReference:string;counterpartyName:string})=>[m.id,m.counterpartyAddress,m.transactionReference,m.counterpartyName])]) expect(html+safe).not.toContain(privateValue);
  await expect(page.getByRole('button',{name:'원본 내려받기 없음'})).toBeDisabled();
  for(const width of [1280,1440,390]){await page.setViewportSize({width,height:900});await fits(page);await screenshot(page,'s03-'+width);}
  await page.setViewportSize({width:720,height:450}); await fits(page); await screenshot(page,'s03-200-equivalent'); await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'감사인에게 권한 전달'}).click();
  await expect(page.getByRole('dialog')).toContainText('한울회계법인'); await expect(page.getByRole('dialog')).toContainText('외부감사 제출용 · 전체 항목'); await expect(page.getByRole('dialog')).toContainText('원본 파일은 재무담당자 PC를 거치지 않습니다.');
  await screenshot(page,'s04-conditions');
  const response=page.waitForResponse(r=>r.url().endsWith(docPath+'/grants')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'권한 생성',exact:true}).click(); const made=await response; expect(made.status()).toBe(201); const {grant,token}=await made.json();
  await page.context().grantPermissions(['clipboard-read','clipboard-write']); await page.getByRole('button',{name:'링크 복사',exact:true}).click(); await expect(page.getByRole('dialog')).toContainText('링크를 복사했습니다.');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(new URL('/share#token='+token,page.url()).href);
  await screenshot(page,'s04-created'); await page.getByRole('button',{name:'공유 확인 닫기'}).click();
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']}); const audit=await context.newPage();
  try {
    await audit.goto(new URL('/share#token='+token,page.url()).href); await authenticate(audit,'auditor-b'); await expect(audit.locator('.certificate')).toContainText('㈜가온테크');
    expect(await audit.locator('.transaction-table tbody tr').count()).toBe(12);
    for(const asset of originalPayload.assets) await expect(audit.locator('.wallet-list')).toContainText(asset.custodyAddress);
    await expect(audit.locator('.certificate')).toContainText('A사'); await expect(audit.locator('.certificate')).toContainText('B사');
    for(const width of [1280,1440,390]){await audit.setViewportSize({width,height:900});await fits(audit);await screenshot(audit,'s05-'+width);}
    await audit.setViewportSize({width:720,height:450});await fits(audit);await screenshot(audit,'s05-200-equivalent');await audit.setViewportSize({width:1440,height:900});
    await audit.getByRole('button',{name:'원본 검증하기',exact:true}).click(); await expect(audit.getByText('KODA가 발행한 원본과 같습니다.',{exact:true})).toBeVisible();
    await expect(audit.locator('.verification-four>div')).toHaveCount(4); await expect(audit.getByRole('button',{name:'검증 결과 저장 · 시연 미지원'})).toBeDisabled();
    const stamp=await audit.locator('.inspection-time').innerText(); await audit.evaluate(()=>window.dispatchEvent(new Event('focus'))); await expect(audit.locator('.inspection-time')).toHaveText(stamp); await screenshot(audit,'s06-valid');
    await page.getByRole('button',{name:'공유 현황',exact:true}).click(); await expect(page.locator('[data-grant-id="'+grant.id+'"]')).toContainText('열람 확인');
    const fileInput=audit.getByLabel('검사할 시연 JSON 파일');
    await fileInput.setInputFiles(resolve(testDataDir,'files/gaon-original.json')); await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click(); await expect(audit.getByText('선택 파일이 원본과 같습니다.',{exact:true})).toBeVisible();
    // Renaming does not alter the signed content.
    await fileInput.setInputFiles({name:'renamed.json',mimeType:'application/json',buffer:readFileSync(resolve(testDataDir,'files/gaon-original.json'))}); await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click(); await expect(audit.getByText('선택 파일이 원본과 같습니다.',{exact:true})).toBeVisible();
    await fileInput.setInputFiles(resolve(testDataDir,'files/gaon-mail-copy.json')); await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();
    await expect(audit.locator('.verification-result')).toContainText('체인 기록과 다릅니다.'); await expect(audit.locator('.difference-table')).toContainText('BTC 수량'); await expect(audit.locator('.difference-table')).toContainText('12.4500'); await expect(audit.locator('.difference-table')).toContainText('15.4500');
    await audit.getByText('세부 암호 검사 · 6개',{exact:true}).click(); await expect(audit.locator('.verification-evidence')).toContainText('NOT_RUN');
    for(const width of [1280,1440,390]){await audit.setViewportSize({width,height:900});await fits(audit);await screenshot(audit,'s07-'+width);}
    await audit.setViewportSize({width:720,height:450});await fits(audit);await screenshot(audit,'s07-200-equivalent');await audit.setViewportSize({width:1440,height:900});
    const fileStamp=await audit.locator('.inspection-time').innerText();await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.locator('.inspection-time')).toHaveText(fileStamp);await expect(audit.locator('.difference-table')).toContainText('15.4500');
    await audit.getByRole('button',{name:'KODA에 확인 요청',exact:true}).click();await audit.getByRole('button',{name:'문의 내용 복사',exact:true}).click();await expect(audit.locator('.inquiry')).toContainText('실제 발송·접수는 하지 않았습니다.');expect(await audit.evaluate(()=>navigator.clipboard.readText())).toContain('gaon-mail-copy.json');
    await audit.getByRole('button',{name:'원본 링크로 다시 받기',exact:true}).click(); await expect(audit.locator('.certificate')).toContainText('12.4500');await expect(audit.locator('.difference-table')).toHaveCount(0);
    for(const sample of [{name:'broken.json',buffer:Buffer.from('{bad')},{name:'document.pdf',buffer:Buffer.from('%PDF')},{name:'oversize.json',buffer:Buffer.alloc(1024*1024+1,32)}]){await fileInput.setInputFiles({...sample,mimeType:'application/octet-stream'});await expect(audit.getByRole('alert')).toContainText('파일을 검사할 수 없습니다');await expect(audit.getByRole('button',{name:'선택 파일 검사',exact:true})).toBeDisabled();}
    const other=structuredClone(source);other.evidenceId='OTHER';await fileInput.setInputFiles({name:'other.json',mimeType:'application/json',buffer:Buffer.from(evidenceFile(other))});await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.getByRole('alert')).toContainText('다른 파일');await expect(audit.locator('.difference-table')).toHaveCount(0);
    await fileInput.setInputFiles(resolve(testDataDir,'files/gaon-mail-copy.json'));const rpc=(process.env.KODA_RPC_URL??'http://127.0.0.1:19545')+'/**';await audit.route(rpc,r=>r.abort('connectionrefused'));await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.file-findings')).toContainText('RPC_UNAVAILABLE');await expect(audit.getByText('체인 기록과 다릅니다.',{exact:true})).toHaveCount(0);await expect(audit.locator('.difference-table')).toHaveCount(0);await screenshot(audit,'s07-rpc-unavailable');await audit.unroute(rpc);
    await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.locator('.difference-table')).toContainText('15.4500');
    const current=await (await audit.request.get('/api/grants/'+grant.id+'/evidence')).json();expect(current.envelope).toEqual(source);
    expect(await audit.evaluate(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),db:await indexedDB.databases()}))).toEqual({local:[],session:[],db:[]});
    const row=page.locator('[data-grant-id="'+grant.id+'"]');await row.getByRole('button',{name:'철회',exact:true}).click();await page.getByRole('button',{name:'공유 철회',exact:true}).click();await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.getByRole('alert')).toContainText('철회');await expect(audit.locator('.certificate')).toHaveCount(0);await expect(audit.locator('.file-inspection')).toHaveCount(0);await expect(audit.locator('.verification-result')).toHaveCount(0);await screenshot(audit,'s05-blocked');
  } finally {await context.close();}
});

test('v0.3 T-13/17: replacing a selected file and revoking access fence late file results',async({page,browser})=>{
  await page.goto('/');await authenticate(page,'finance-a');
  const session=await(await page.request.get('/api/me')).json(),auditors=await(await page.request.get('/api/finance/auditors')).json();
  const headers={origin:new URL(page.url()).origin,'x-csrf-token':session.csrf};
  const made=await page.request.post('/api'+docPath+'/grants',{headers,data:{auditorDid:auditors[0].did,idempotencyKey:crypto.randomUUID()}});expect(made.status()).toBe(201);const {grant,token}=await made.json();
  const context=await browser.newContext();const audit=await context.newPage();let release=()=>{};
  const rpc=(process.env.KODA_RPC_URL??'http://127.0.0.1:19545')+'/**';
  try{
    await audit.goto(new URL('/share#token='+token,page.url()).href);await authenticate(audit,'auditor-b');await expect(audit.locator('.certificate')).toBeVisible();
    async function holdFile(){let entered=false;const gate=new Promise<void>(r=>{release=r;});await audit.route(rpc,async route=>{const response=await route.fetch();entered=true;await gate;try{await route.fulfill({response});}catch(e){if(!(e instanceof Error)||!e.message.includes('already handled'))throw e;}},{times:1});await audit.getByLabel('검사할 시연 JSON 파일').setInputFiles(resolve(testDataDir,'files/gaon-mail-copy.json'));await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect.poll(()=>entered).toBe(true);}
    await holdFile();await audit.getByLabel('검사할 시연 JSON 파일').setInputFiles(resolve(testDataDir,'files/gaon-original.json'));release();await expect(audit.locator('.selected-file')).toContainText('gaon-original.json');await expect(audit.locator('.difference-table')).toHaveCount(0);
    await audit.getByRole('button',{name:'선택 파일 검사',exact:true}).click();await expect(audit.getByText('선택 파일이 원본과 같습니다.',{exact:true})).toBeVisible();
    await holdFile();expect((await page.request.post('/api/grants/'+grant.id+'/revoke',{headers})).status()).toBe(200);await audit.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(audit.getByRole('alert')).toContainText('철회');release();
    await expect(audit.locator('.certificate, .file-inspection, .verification-result')).toHaveCount(0);await audit.reload();await expect(audit.getByRole('alert')).toContainText('철회');await expect(audit.locator('.difference-table')).toHaveCount(0);
  }finally{release();await context.close();}
});
