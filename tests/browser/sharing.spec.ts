import { test, expect } from '@playwright/test';
import { showFinanceVerification, authenticate, v1Detail } from './helpers.js';

test('S-03→04→06→07: real share and browser verification, wrong recipient denied, revoke clears open page', async ({ page, browser }) => {
  await page.goto('/'); await authenticate(page);
  await page.locator('a.detail-link[href="' + v1Detail + '"]').click();
  await showFinanceVerification(page);
  await expect(page.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('서버가 원문을 확인한 결과', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '감사인에게 권한 전달', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'S-04 · 감사인에게 권한 전달' })).toBeVisible();
  const created = page.waitForResponse(r => r.url().endsWith('/versions/1/grants') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '권한 생성', exact: true }).click();
  const response = await created; expect(response.status()).toBe(201);
  const { token, grant } = await response.json();
  await expect(page.getByText('권한 생성 · 수신 대기', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '링크 복사', exact: true })).toBeEnabled();
  const url = new URL('/share', page.url()); url.hash = 'token=' + token;
  const auditContext = await browser.newContext(); const audit = await auditContext.newPage();
  const otherContext = await browser.newContext(); const other = await otherContext.newPage();
  try {
    await audit.goto(url.href);
    await expect(audit.getByRole('heading', { name: '공유받은 증빙을 확인하려면 인증해 주세요' })).toBeVisible();
    expect(await audit.evaluate(() => location.hash === '')).toBe(true);
    expect((await audit.locator('body').innerText()).includes('12.50000000')).toBe(false);
    await authenticate(audit, 'auditor-b');
    await expect(audit.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
    const calls: string[] = []; audit.on('request', r => { if (r.url().startsWith(process.env.KODA_RPC_URL ?? 'http://127.0.0.1:18545')) calls.push(r.postData() ?? ''); });
    await audit.getByRole('button', { name: '원본 검증하기', exact: true }).click();
    await expect(audit.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
    expect(calls.some(s => s.includes('eth_getTransactionReceipt'))).toBe(true);
    await other.goto(url.href); await authenticate(other, 'auditor-c');
    await expect(other.getByRole('alert')).toContainText('접근할 수 없습니다');
    expect((await other.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
    await page.getByRole('button', { name: '공유 확인 닫기' }).click();
    await page.getByRole('button', { name: '공유 현황', exact: true }).click();
    const item = page.locator('[data-grant-id="' + grant.id + '"]');
    await item.getByRole('button', { name: '철회', exact: true }).click();
    await page.getByRole('button', { name: '공유 철회', exact: true }).click();
    await expect(item.getByText('철회됨', { exact: true })).toBeVisible();
    await audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(audit.getByRole('alert')).toContainText('철회');
    expect((await audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
  } finally { await auditContext.close(); await otherContext.close(); }
});
