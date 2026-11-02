import { test, expect } from '@playwright/test';
import { authenticate, v1Detail } from './helpers.js';

test('F-06/F-12: lost create response retries same grant, without re-exposing its token', async ({ page }) => {
  await page.goto('/'); await authenticate(page); await page.goto(v1Detail);
  await page.getByRole('button', { name: '감사인에게 권한 전달', exact: true }).click();
  let lostGrant = '';
  await page.route('**/api/evidence/**/grants', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(201);
    lostGrant = (await response.json()).grant.id;
    await route.abort('connectionreset');
  }, { times: 1 });
  await page.getByRole('button', { name: '권한 생성', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('서버에 연결할 수 없습니다');
  await expect(page.getByLabel('지정 감사인')).toBeDisabled();
  const replay = page.waitForResponse(r => r.url().endsWith('/versions/1/grants') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '권한 생성', exact: true }).click();
  const response = await replay; expect(response.status()).toBe(200);
  const body = await response.json(); expect(body.grant.id).toBe(lostGrant); expect(body.token).toBeUndefined();
  await expect(page.getByText('이미 처리한 공유입니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '링크 복사', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '공유 확인 닫기', exact: true }).click();
  await page.getByRole('button', { name: '공유 현황', exact: true }).click();
  await expect(page.locator('[data-grant-id="' + lostGrant + '"]')).toHaveCount(1);
});
