import { expect, test } from '@playwright/test';

const fixture = 'apps/web/public/receipt-files/';
const workspace = (page: import('@playwright/test').Page) => page.getByRole('region', { name: '사용자 업무 화면' });
async function scene(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('navigation', { name: '조직별 데모 흐름' }).getByRole('button', { name: new RegExp(name+'$') }).click();
}
test.beforeEach(async ({page}) => { await page.goto('./'); await expect(page.getByRole('heading',{name:'해외 대금 수취를 증빙해요'})).toBeVisible(); });

test('issuance, finance reconciliation, accounting, grant and auditor verification connect', async ({page}) => {
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'증빙 발행하기',exact:true}).click();
  await expect(page.locator('.xp-success')).toContainText('고객사에 증빙을 전달했어요');
  await expect(page.locator('.xp-process .complete')).toHaveCount(3);
  await page.getByRole('button',{name:'재무 담당자 화면으로'}).click();
  await expect(workspace(page)).toContainText('재무 담당자');
  await expect(page.getByRole('button',{name:'대조 결과를 회계팀에 전달'})).toBeDisabled();
  await expect(workspace(page)).not.toContainText('0xDEMO-HANBIT-RECEIPT-9b06');
  await expect(workspace(page)).not.toContainText('해외 거래처 A사');
  await expect(workspace(page)).toContainText('거래처 코드 CP-07');
  await expect(workspace(page)).toContainText('…9b06');
  await expect(workspace(page)).toContainText('…f2c1');
  for (const name of ['청구서 DEMO-INV-1028과 수취 증빙을 대조했어요','100.00 USDC 부족을 확인했고, 원인은 확인이 필요해요','차이와 확인 필요 상태를 회계팀에 함께 전달해요']) await page.getByRole('checkbox',{name}).check();
  await page.getByRole('button',{name:'대조 결과를 회계팀에 전달'}).click();
  await page.getByRole('button',{name:'회계 담당자 화면으로'}).click();
  await expect(workspace(page)).toContainText('회계 담당자');
  await expect(workspace(page)).not.toContainText('CP-07');
  await expect(workspace(page)).not.toContainText('9b06');
  await expect(workspace(page)).not.toContainText('f2c1');
  await expect(workspace(page)).toContainText('수출대금 수취 지갑 (주소 가림)');
  await expect(workspace(page)).toContainText('재무 대조 완료 · 100 USDC 차이는 확인 필요');
  await page.getByRole('button',{name:'결산 자료에 연결하기'}).click();
  await page.getByRole('button',{name:'감사인에게 권한 전달하기'}).click();
  await page.getByRole('button',{name:'열람 권한 보내기',exact:true}).click();
  await page.getByRole('button',{name:'외부 감사인 화면으로'}).click();
  await expect(workspace(page)).toContainText('0xDEMO-HANBIT-RECEIPT-9b06');
  await page.getByRole('button',{name:'원본 검증하기',exact:true}).click();
  await expect(page.locator('.xp-success')).toContainText('KODA가 발행한 원본과 같아요');
  expect(errors).toEqual([]);
});

test('invalid grant dates and expired permissions block access', async ({page}) => {
  await scene(page,'권한 전달');
  await page.getByLabel('열람 만료일').fill('2026-10-01');
  await page.getByRole('button',{name:'열람 권한 보내기',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('11월 3일 이후');
  await scene(page,'원본 검증');
  await page.getByRole('button',{name:'기간 만료 시연'}).click();
  await expect(workspace(page)).toContainText('원본 열람이 잠겼어요');
  await expect(workspace(page)).not.toContainText('0xDEMO-HANBIT-RECEIPT-9b06');
  await expect(page.getByRole('button',{name:'원본 검증하기',exact:true})).toHaveCount(0);
  await scene(page,'사본 검사');
  await expect(page.getByRole('button',{name:'PDF 파일 선택',exact:true})).toHaveCount(0);
});

test('actual PDF bytes distinguish modified, resaved, original and unsupported files without upload', async ({page}) => {
  const writes:string[]=[]; page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
  await scene(page,'사본 검사');
  for(const [file,kind,title] of [['modified.pdf','changed','검증 실패 · 원본과 내용이 달라요'],['resaved.pdf','copy','원본 아님 · 재저장 사본 또는 열람본'],['original.pdf','match','KODA가 발행한 원본과 같아요']]) {
    await page.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles(fixture+file);
    await page.getByRole('button',{name:'파일 검사하기',exact:true}).click();
    await expect(page.locator('.xp-file-result.'+kind)).toContainText(title!);
    if(kind==='changed') { await expect(page.locator('.xp-difference')).toHaveCount(2); await expect(page.locator('.xp-difference').first()).toContainText('25,100.00'); }
  }
  await page.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name:'unsupported.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nunknown')});
  await page.getByRole('button',{name:'파일 검사하기',exact:true}).click();
  await expect(page.locator('.xp-file-result.unknown')).toContainText('지문 차이만으로 위변조라고 판단하지 않아요');
  expect(writes).toEqual([]);
});

test('public lookup does not expose source document information and supports no match', async ({page}) => {
  await page.getByRole('button',{name:'공개 기록 살펴보기'}).click();
  const dialog=page.getByRole('dialog');
  await page.getByLabel('문서 지문, 블록 번호, 발행자 DID').fill('#21,950,204');
  await page.getByRole('button',{name:'조회',exact:true}).click();
  await expect(dialog).toContainText('찾은 기록 1건');
  await expect(dialog).not.toContainText('한빛정밀');
  await expect(dialog).not.toContainText('25,000.00');
  await page.getByLabel('문서 지문, 블록 번호, 발행자 DID').fill('missing');
  await page.getByRole('button',{name:'조회',exact:true}).click();
  await expect(dialog).toContainText('일치하는 기록이 없어요');
  await expect(dialog.locator('.xp-record-detail')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('reset cancels an in-progress operation and clears completed state', async ({page}) => {
  await page.getByRole('button',{name:'증빙 발행하기',exact:true}).click();
  await page.getByRole('button',{name:'처음부터 다시 시연',exact:true}).click();
  await expect(page.getByRole('button',{name:'증빙 발행하기',exact:true})).toBeEnabled();
  await page.waitForTimeout(2300);
  await expect(page.locator('.xp-success')).toHaveCount(0);
  await expect(page.locator('.xp-process .complete')).toHaveCount(0);
});

test('mobile layout remains readable without body overflow and keyboard navigation respects fields', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading',{name:'받은 증빙을 대조해요'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await scene(page,'권한 전달');
  await page.getByLabel('열람 만료일').focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('heading',{name:'감사인에게 열람 권한을 보내요'})).toBeVisible();
});
