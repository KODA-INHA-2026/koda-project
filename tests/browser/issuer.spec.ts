import { test, expect } from '@playwright/test';
import { showFinanceVerification, authenticate } from './helpers.js';

test('S-01: issuer reviews a candidate and explicitly issues version 2, not seed issuance', async ({ page }) => {
  await page.goto('/'); await authenticate(page, 'issuer');
  await expect(page.getByRole('heading', { name: '잔고 증명서를 발행합니다', exact: true })).toBeVisible();
  const candidate = page.locator('[data-snapshot-id="SYNTHETIC-a-V2"]');
  await expect(candidate).toContainText('버전 2');
  test.skip(await candidate.getByText('발행 완료', { exact: true }).count() > 0, 'Explicit issuance acceptance requires a freshly prepared isolated environment; do not count persisted success as issuance.');
  {
    await candidate.getByRole('button', { name: '발행 내용 확인' }).click();
    await expect(page.getByRole('dialog')).toContainText('가상 고객사 A');
    await expect(page.getByRole('dialog')).toContainText('버전 2');
    const request = page.waitForResponse(r => r.url().endsWith('/api/issuer/evidence') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '증빙 발행', exact: true }).click();
    expect((await request).status()).toBe(202);
  }
  await expect(candidate.getByText('발행 완료', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^(역할 바꾸기|로그아웃)$/ }).click(); await authenticate(page);
  await page.goto('/evidence/KODA-20261031-001/versions/2');
  await expect(page.getByText('KODA-20261031-001 · v2', { exact: true })).toBeVisible();
  await showFinanceVerification(page);
  await expect(page.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
});
