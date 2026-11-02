import { test, expect } from '@playwright/test';
import { authenticate, v1Detail } from './helpers.js';

test('F-12: successful session recheck must not discard a share confirmation form', async ({ page }) => {
  await page.goto('/'); await authenticate(page); await page.goto(v1Detail);
  await page.getByRole('button', { name: '감사인에게 권한 전달', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('유효기간').selectOption('1');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('유효기간')).toHaveValue('1');
});
