import { test, expect } from '@playwright/test';
import { authenticate } from './helpers.js';

test('S-00/02: task-first module, no planned menus, document stays readable at 390px', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '로컬 시연 인증' })).toBeVisible();
  await expect(page.getByRole('button', { name: /공유 관리|활동 이력/ })).toHaveCount(0);
  await authenticate(page);
  await expect(page.getByRole('heading', { name: '수탁 증빙', exact: true })).toBeVisible();
  await expect(page.locator('.list-overview')).toHaveCount(0);
  const documentLink = page.getByRole('link', { name: '가상 고객사 A 잔고 증명서', exact: true }).first();
  expect((await documentLink.boundingBox())!.y).toBeLessThan(600);
  await page.getByLabel('문서 번호 또는 기준일 검색').fill('2026. 10. 31.');
  await expect(documentLink).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = page.getByRole('link', { name: /KODA-20261031-001 상세 보기/ }).first();
  const box = (await detail.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
