import { expect, test } from '@playwright/test';

const fixture = 'apps/web/public/proof-files/';
const workspace = (page: import('@playwright/test').Page) => page.getByRole('region', { name: '사용자 업무 화면' });
async function scene(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('navigation', { name: '조직별 데모 흐름' }).getByRole('button', { name: new RegExp(name+'$') }).click();
}
test.beforeEach(async ({page}) => { await page.goto('./'); await expect(page.getByRole('heading',{name:'3분기 증빙을 발행해요'})).toBeVisible(); });

test('issuance, finance reconciliation, accounting, grant and auditor verification connect', async ({page}) => {
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'증빙 발행하기',exact:true}).click();
  await expect(page.locator('.xp-success')).toContainText('고객사에 증빙을 전달했어요');
  await expect(page.locator('.xp-process .complete')).toHaveCount(3);
  await page.getByRole('button',{name:'재무 담당자 화면으로'}).click();
  await expect(workspace(page)).toContainText('재무 담당자');
  await expect(page.getByRole('button',{name:'대조 완료하고 회계팀에 전달'})).toBeDisabled();
  await expect(workspace(page)).not.toContainText('bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz');
  await expect(workspace(page)).not.toContainText('OTC 거래상대 A사');
  for (const name of ['거래소 매입 내역과 수량이 일치해요','내부 승인 자료와 거래가 일치해요','KODA 수탁 증빙의 잔고를 확인했어요']) await page.getByRole('checkbox',{name}).check();
  await page.getByRole('button',{name:'대조 완료하고 회계팀에 전달'}).click();
  await page.getByRole('button',{name:'회계 담당자 화면으로'}).click();
  await expect(workspace(page)).toContainText('회계 담당자');
  await expect(workspace(page)).toContainText('재무 담당자가 대조를 완료했어요');
  await page.getByRole('button',{name:'결산 자료에 연결하기'}).click();
  await page.getByRole('button',{name:'감사인에게 권한 전달하기'}).click();
  await page.getByRole('button',{name:'열람 권한 보내기',exact:true}).click();
  await page.getByRole('button',{name:'외부 감사인 화면으로'}).click();
  await expect(workspace(page)).toContainText('bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz');
  await page.getByRole('button',{name:'원본 검증하기',exact:true}).click();
  await expect(page.locator('.xp-success')).toContainText('KODA가 발행한 원본과 같아요');
  expect(errors).toEqual([]);
});

test('invalid grant dates and expired permissions block access', async ({page}) => {
  await scene(page,'권한 전달');
  await page.getByLabel('열람 만료일').fill('2026-10-01');
  await page.getByRole('button',{name:'열람 권한 보내기',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('11월 9일 이후');
  await scene(page,'원본 검증');
  await page.getByRole('button',{name:'기간 만료 시연'}).click();
  await expect(workspace(page)).toContainText('원본 열람이 잠겼어요');
  await expect(workspace(page)).not.toContainText('bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz');
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
    if(kind==='changed') { await expect(page.locator('.xp-difference')).toHaveCount(2); await expect(page.locator('.xp-difference').first()).toContainText('15.4500'); }
  }
  await page.getByLabel('검사할 PDF 파일',{exact:true}).setInputFiles({name:'unsupported.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nunknown')});
  await page.getByRole('button',{name:'파일 검사하기',exact:true}).click();
  await expect(page.locator('.xp-file-result.unknown')).toContainText('지문 차이만으로 위변조라고 판단하지 않아요');
  expect(writes).toEqual([]);
});

test('public lookup does not expose source document information and supports no match', async ({page}) => {
  await page.getByRole('button',{name:'공개 기록 살펴보기'}).click();
  const dialog=page.getByRole('dialog');
  await page.getByLabel('문서 지문, 블록 번호, 발행자 DID').fill('#21,904,118');
  await page.getByRole('button',{name:'조회',exact:true}).click();
  await expect(dialog).toContainText('찾은 기록 1건');
  await expect(dialog).not.toContainText('㈜가온테크');
  await expect(dialog).not.toContainText('12.4500');
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

test('v0.3 masking: each role sees only its policy fields and the redacted view verifies against the field bundle', async ({page}) => {
  const wallet='bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz';
  const fullTx=['4f1a…a21c','0x9b…07de','0x12…e9f0','77c0…3b51','2ab1…a001','0x41…0012','bc21…a003','0x51…0014','cd31…a005','0x61…0016','0x71…0017','ef41…a008'];
  const names=['OTC 거래상대','A사','B사'];
  const pageText=async()=>{ // workspace + side panel + scope modal: every place a value could leak
    await page.getByRole('button',{name:'역할별 열람 범위'}).click();
    const text=await page.locator('body').innerText();
    await page.keyboard.press('Escape');
    return text;
  };
  await scene(page,'재무 대조');
  await page.locator('.xp-view-transactions summary').click();
  await page.getByRole('button',{name:'열람본 검증하기'}).click();
  await expect(page.locator('.xp-disclosure-result.ok')).toContainText('발행 기록과 같아요');
  const finance=await pageText();
  for (const shown of ['BTC 보관 지갑 1 · …x9tz','CP-01','CP-02','시연용 가상 기준가',...fullTx.map(t=>'…'+t.slice(-4))]) expect(finance).toContain(shown);
  for (const secret of [wallet,'bc1q8f2k',...names,...fullTx]) expect(finance).not.toContain(secret);
  await page.getByRole('button',{name:'값 하나를 바꿔서 검증해 보기'}).click();
  await expect(page.locator('.xp-disclosure-result.bad')).toContainText('달라졌어요');
  await scene(page,'회계 결산');
  await page.getByRole('button',{name:'열람본 검증하기'}).click();
  await expect(page.locator('.xp-disclosure-result.ok')).toBeVisible();
  const accounting=await pageText();
  for (const shown of ['시연용 가상 기준가','자산별 증감','BTC 보관 지갑 1']) expect(accounting).toContain(shown);
  for (const secret of [wallet,'bc1q8f2k','x9tz','CP-01','CP-02',...names,...fullTx,...fullTx.map(t=>t.slice(-4))]) expect(accounting).not.toContain(secret);
  await scene(page,'원본 검증');
  await expect(workspace(page)).toContainText(wallet);
  await page.getByRole('button',{name:'역할별 열람 범위'}).click();
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(9);
  await expect(page.getByRole('dialog').getByRole('rowheader')).toHaveCount(9);
});

test('field bundle recorded at issuance matches the demo data (no circular verification)', async () => {
  const { issueFieldRoot, RECORDED_FIELD_ROOT } = await import('../../apps/web/src/experience/disclosure');
  expect(await issueFieldRoot()).toBe(RECORDED_FIELD_ROOT);
});
