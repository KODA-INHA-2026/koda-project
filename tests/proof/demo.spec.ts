import { test, expect, type Page } from '@playwright/test';
const fixture = 'apps/web/public/proof-files/';
const stage = (page: Page) => page.locator('.stage');
async function scene(page: Page, id: string) { await page.getByRole('button', { name: new RegExp('^'+id+' ') }).click(); }
test.beforeEach(async ({ page }) => { await page.goto('./'); await expect(page.locator('.stage')).toBeVisible(); });

test('seven scenes connect through real actions, with masked finance and whole auditor view', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: '서명 요청 승인 · 모의' }).click();
  await expect(stage(page)).toContainText('인증 완료');
  await page.getByRole('button', { name: 'KODA로 들어가기' }).click();
  await page.getByRole('button', { name: '발행하고 체인에 기록' }).click();
  await expect(page.getByRole('button', { name: '고객사 증빙함으로' })).toBeVisible();
  await expect(stage(page)).toContainText('모의 기록 완료');
  await page.getByRole('button', { name: '고객사 증빙함으로' }).click();
  await expect(stage(page)).toContainText('원본 기반 열람본 · 일부 가림');
  await expect(stage(page)).not.toContainText('bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz');
  await expect(stage(page)).not.toContainText('OTC 거래상대 A사');
  await expect(page.getByRole('button', { name: '원본 내려받기 없음' })).toBeDisabled();
  await page.getByRole('button', { name: '감사인에게 권한 보내기' }).click();
  await page.getByRole('button', { name: '권한 보내기', exact: true }).last().click();
  await expect(stage(page)).toContainText('요청 ● 정책 확인 ● 수신 ●');
  await page.getByRole('button', { name: '감사인으로 원본 열기' }).click();
  await expect(stage(page)).toContainText('bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz');
  await expect(stage(page)).toContainText('OTC 거래상대 A사');
  await page.getByRole('button', { name: '외 8건 펼치기' }).click();
  await expect(stage(page).locator('.doc table').last().locator('tbody tr')).toHaveCount(14);
  await page.getByRole('button', { name: '거래 내역 접기' }).click();
  const documentBefore = await stage(page).locator('.doc').innerText();
  await page.getByRole('button', { name: '원본 검증하기' }).click();
  await expect(stage(page).locator('.result')).toContainText('원본과 같습니다.');
  expect(await stage(page).locator('.doc').innerText()).toBe(documentBefore);
  await expect(stage(page)).toContainText('시연용 모의 기록');
  await scene(page, 'S-07');
  await expect(stage(page)).toContainText('체인 기록과 다릅니다.');
  await expect(stage(page).locator('.diff').first()).toHaveText('15.4500');
  await expect(stage(page)).toContainText('원본 ₩ 1,942,110,000');
  expect(errors).toEqual([]);
});

test('each role selects its own DID and authenticates to its screen', async ({ page }) => {
  await page.getByRole('button', { name: '고객사 재무·회계 담당', exact: true }).click();
  await expect(page.locator('.panel-did')).toHaveText('did:koda:corp:gaon-fin-01');
  await page.getByRole('button', { name: '서명 요청 승인 · 모의' }).click();
  await page.getByRole('button', { name: '재무·회계 담당자로 들어가기' }).click();
  await expect(stage(page).locator('.doc')).toContainText('원본 기반 열람본');
  await page.getByRole('button', { name: '처음부터 다시 시연' }).click();
  await page.getByRole('button', { name: '외부 감사인', exact: true }).click();
  await expect(page.locator('.panel-did')).toHaveText('did:koda:auditor:hanul-cpa');
});

test('grant dates validate and expired role cannot see or verify original', async ({ page }) => {
  await scene(page, 'S-04');
  await page.getByLabel('열람 만료일').fill('2026-10-01');
  await page.getByRole('button', { name: '권한 보내기', exact: true }).last().click();
  await expect(page.getByRole('status')).toContainText('유효한 열람 기간');
  await page.getByLabel('열람 만료일').fill('2026-12-31');
  await page.getByRole('button', { name: '권한 보내기', exact: true }).last().click();
  await page.getByRole('button', { name: '감사인으로 원본 열기' }).click();
  await page.getByRole('button', { name: '기간 만료 시연' }).click();
  await expect(stage(page)).toContainText('열람 권한이 만료되었습니다.');
  await expect(stage(page)).not.toContainText('bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz');
  await expect(page.getByRole('button', { name: '원본 검증하기' })).toHaveCount(0);
  await scene(page, 'S-07');
  await expect(page.getByRole('button', { name: 'PDF 파일 선택' })).toHaveCount(0);
});

test('actual PDF bytes distinguish original, modified, resaved and unsupported; files never upload', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => { if (request.method() !== 'GET') requests.push(request.method()+' '+request.url()); });
  await scene(page, 'S-07');
  const input = page.getByLabel('검사할 PDF 파일', { exact: true });
  await input.setInputFiles(fixture+'modified.pdf');
  await expect(stage(page).locator('.docsel b')).toHaveText('modified.pdf');
  await expect(stage(page)).toContainText('바뀐 항목 2곳');
  await expect(stage(page).locator('.diff').first()).toHaveText('15.4500');
  await input.setInputFiles(fixture+'resaved.pdf');
  await expect(stage(page).locator('.result')).toContainText('원본 아님 · 재저장 사본 또는 열람본');
  await expect(stage(page).locator('.failure')).toHaveCount(0);
  await expect(stage(page)).toContainText('전체 항목 동일');
  await input.setInputFiles(fixture+'original.pdf');
  await expect(stage(page).locator('.result')).toContainText('원본과 같습니다.');
  await input.setInputFiles({ name: 'unsupported.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nunknown layout') });
  await expect(stage(page).locator('.result')).toContainText('내용 비교 불가');
  await expect(stage(page).locator('.failure')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('public search accepts hash, block and DID, no match hides details, local comparison has no customer data', async ({ page }) => {
  await scene(page, 'S-08');
  await expect(stage(page)).toContainText('공개 · 로그인 없음');
  await expect(stage(page)).not.toContainText('㈜가온테크');
  await expect(stage(page)).not.toContainText('KP-2026-0930-0417');
  const input = page.getByLabel('문서 지문, 블록 번호, 발행자 DID');
  for (const query of ['#21,904,118', 'did:koda:issuer:koda-ops']) {
    await input.fill(query); await page.getByRole('button', { name: '조회', exact: true }).click();
    await expect(stage(page)).toContainText('찾은 기록 1건');
  }
  await input.fill('missing'); await page.getByRole('button', { name: '조회', exact: true }).click();
  await expect(stage(page)).toContainText('찾은 기록 0건');
  await expect(stage(page).locator('.full-hash')).toHaveCount(0);
  await page.getByLabel('공개 조회에서 대조할 파일').setInputFiles(fixture+'original.pdf');
  await expect(page.getByRole('status')).toContainText('문서 지문 일치');
  await page.getByLabel('공개 조회에서 대조할 파일').setInputFiles(fixture+'modified.pdf');
  await expect(page.getByRole('status').last()).toContainText('일치하는 모의 기록 없음');
});

test('proof export and confirmation request leave records', async ({ page }) => {
  await scene(page, 'S-05'); await page.getByRole('button', { name: '원본 검증하기' }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '검증 증적 저장' }).click();
  expect((await download).suggestedFilename()).toBe('KODA_검증증적_모의.json');
  await expect(page.locator('.record-scroll .cur')).toContainText('검증 증적 저장');
  await scene(page, 'S-07'); await page.getByRole('button', { name: 'KODA에 확인 요청' }).click();
  await expect(page.locator('.record-scroll .cur')).toContainText('KODA 확인 요청 (모의)');
  await expect(page.getByRole('status')).toContainText('외부로 전송하지 않았습니다.');
});

test('all nine screens include mock labels and desktop frame stays fixed', async ({ page }) => {
  let box: { x: number; y: number; width: number; height: number } | null = null;
  for (const id of ['S-01','S-02','S-03','S-04','S-05','S-06','S-07','S-08','M-01']) {
    await scene(page, id); await expect(stage(page)).toContainText('모의 데이터');
    const current = await stage(page).boundingBox(); if (box) expect(current).toEqual(box); else box = current;
    if (id !== 'S-08' && id !== 'M-01') await expect(stage(page)).toContainText('시연용 모의 체인 · 실제 기록 아님');
  }
});

test('narrow viewport and keyboard navigation work without horizontal body overflow', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await page.keyboard.press('ArrowRight'); await expect(page.locator('.notes .sid')).toContainText('S-02');
  await scene(page, 'S-08'); const input = page.getByLabel('문서 지문, 블록 번호, 발행자 DID'); await input.focus(); await page.keyboard.press('ArrowLeft'); await expect(page.locator('.notes .sid')).toContainText('S-08');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
