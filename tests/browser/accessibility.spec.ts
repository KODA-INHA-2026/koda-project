import { test, expect, type Locator, type Page } from '@playwright/test';
import { testDataDir } from '../../scripts/test-environment.js';
import { showFinanceVerification, authenticate, v1Detail } from './helpers.js';

async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible(); await expect(target).toBeEnabled();
  for (let i = 0; i < 80; i++) { if (await target.evaluate(el => el === document.activeElement)) return; await page.keyboard.press('Tab'); }
  await expect(target).toBeFocused();
}

for (const layout of [{ width: 1280, height: 900, zoom: 1 }, { width: 1440, height: 900, zoom: 1 }, { width: 390, height: 844, zoom: 1 }, { width: 1440, height: 900, zoom: 2 }]) {
  test(`AC-12: ${layout.width}x${layout.height}, ${layout.zoom * 100}% equivalent viewport/DPR reflow`, async ({ page }) => {
    await page.setViewportSize({ width: layout.width / layout.zoom, height: layout.height / layout.zoom });
    if (layout.zoom !== 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: layout.width / layout.zoom, height: layout.height / layout.zoom, deviceScaleFactor: layout.zoom, mobile: false });
    }
    await page.goto('/'); await authenticate(page);
    const detail = page.locator('a.detail-link[href="' + v1Detail + '"]');
    await expect(detail).toBeVisible();
    if (layout.zoom === 1 && layout.width > 390) expect((await detail.boundingBox())!.y).toBeLessThan(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await detail.click();
    await expect(page.getByText('12.50000000', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testDataDir + `/screenshots/detail-${layout.width}-${layout.zoom}x.png`, fullPage: true });
    await page.getByRole('button', { name: '감사인에게 권한 전달', exact: true }).click();
    await expect(page.getByRole('button', { name: '권한 생성', exact: true })).toBeEnabled();
    const dialog = page.getByRole('dialog');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
    await page.getByRole('button', { name: '권한 생성', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '권한 생성', exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testDataDir + `/screenshots/share-${layout.width}-${layout.zoom}x.png` });
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: '감사인에게 권한 전달', exact: true })).toBeFocused();
  });
}

test('AC-12: keyboard sharing, modal focus containment, verification and revocation', async ({ page }) => {
  await page.goto('/'); await authenticate(page); await page.goto(v1Detail);
  const share = page.getByRole('button', { name: '감사인에게 권한 전달', exact: true }); await expect(share).toBeEnabled();
  await tabTo(page, share); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(share).toBeFocused();
  await page.keyboard.press('Enter');
  const created = page.waitForResponse(r => r.url().endsWith('/versions/1/grants') && r.request().method() === 'POST');
  await tabTo(page, page.getByRole('button', { name: '권한 생성', exact: true })); await page.keyboard.press('Enter');
  const response = await created; expect(response.status()).toBe(201); const { grant } = await response.json();
  await tabTo(page, page.getByRole('button', { name: '공유 확인 닫기', exact: true })); await page.keyboard.press('Enter');
  await tabTo(page, page.getByText('서버 원본 확인 근거', { exact: true })); await page.keyboard.press('Enter');
  await expect(page.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: '공유 현황', exact: true })); await page.keyboard.press('Enter');
  const row = page.locator('[data-grant-id="' + grant.id + '"]'); await expect(row).toBeVisible();
  await tabTo(page, row.getByRole('button', { name: '철회', exact: true })); await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: '공유 철회', exact: true })); await page.keyboard.press('Enter');
  await expect(row.getByText('철회됨', { exact: true })).toBeVisible();
});
