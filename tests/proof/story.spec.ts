import { expect, test, type Page } from '@playwright/test';

// 원클릭 스토리 시연: 고객군 3개가 3축(KODA 발행 · 고객사 내부 · 외부 검증)으로 흐르고, 왜 블록체인인지 보여 준다.
const beat = (page: Page, name: string) => page.locator('.st-beats').getByRole('button', { name, exact: true }).click();

test('header button opens the one-click story and autoplay reaches the close card', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: '원클릭 시연' }).click();
  await expect(page.getByRole('region', { name: '원클릭 스토리 시연' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '시연 정리' })).toBeVisible({ timeout: 70_000 });
  await expect(page.locator('.st-reader')).toHaveCount(4); // 재무, 회계, 은행, 감사인
  expect(errors).toEqual([]);
});

test('each customer group masks per role and partners see only their own share', async ({ page }) => {
  await page.goto('./?story=game');
  await beat(page, '외부 검증');
  const orion = page.locator('.st-card.ext').filter({ has: page.locator('.st-role span', { hasText: 'Orion Studio' }) });
  await expect(orion).toContainText('8,000.00 USDC');
  await expect(orion).not.toContainText('6,000.00 USDC');
  await expect(orion.locator('.st-redact')).toHaveCount(1);
  await expect(page.locator('.st-card.ext.done')).toHaveCount(3, { timeout: 6000 });
  await page.getByRole('button', { name: /한빛정밀/ }).click();
  await beat(page, '내부 결산');
  const accounting = page.locator('.st-card', { hasText: '회계 담당자' });
  await expect(accounting).not.toContainText('Northstar');
  await expect(accounting).not.toContainText('0xa3f1');
  await page.getByRole('button', { name: /새봄자산운용/ }).click();
  await beat(page, '외부 검증');
  const valuer = page.locator('.st-card.ext').filter({ has: page.locator('.st-role span', { hasText: '나래가치평가' }) });
  await expect(valuer).not.toContainText('데스크 A');
  await expect(valuer).not.toContainText('demo-tx-0811');
});

test('why-blockchain scene recomputes a different fingerprint after the DB value changes', async ({ page }) => {
  await page.goto('./?story=audit');
  await beat(page, '왜 블록체인');
  const chain = page.locator('.st-world.chain dd');
  await expect(chain.first()).not.toHaveText('계산 중');
  const [now, recorded] = await chain.allInnerTexts();
  expect(now).not.toBe(recorded);
  await expect(page.locator('.st-world.db')).toContainText('바뀐 값을 그대로 믿게 돼요');
  await expect(page.locator('.st-honest')).toContainText('보증하지 않아요');
  await page.getByRole('button', { name: '단계별로 보기' }).click();
  await expect(page.getByRole('heading', { name: '3분기 증빙을 발행해요' })).toBeVisible();
});
