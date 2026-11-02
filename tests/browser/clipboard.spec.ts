import { test, expect, type Page } from '@playwright/test';
import { authenticate, v1Detail } from './helpers.js';
import { testOrigin } from '../../scripts/test-environment.js';

async function makeShare(page: Page) {
  await page.goto('/'); await authenticate(page); await page.goto(v1Detail);
  await page.getByRole('button', { name: '감사인에게 권한 전달', exact: true }).click();
  const created = page.waitForResponse(r => r.url().endsWith('/versions/1/grants') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '권한 생성', exact: true }).click();
  const response = await created; expect(response.status()).toBe(201);
  const id = (await response.json()).grant.id as string;
  await expect(page.getByText('권한 생성 · 수신 대기', { exact: true })).toBeVisible(); return id;
}

test('S-04→06: actual copy button and scoped Clipboard API round-trip, recipient allowed and other auditor denied', async ({ page, browser }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: testOrigin });
  await makeShare(page); await page.bringToFront();
  await page.getByRole('button', { name: '링크 복사', exact: true }).click();
  await expect(page.getByText('링크를 복사했습니다.', { exact: false })).toBeVisible();
  // Read only after this context wrote its own new synthetic share. Never log or attach it.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const parsed = new URL(copied);
  expect(parsed.origin === testOrigin && parsed.pathname === '/share' && /^#token=[A-Za-z0-9_-]{43}$/.test(parsed.hash)).toBe(true);
  for (const person of ['auditor-c', 'auditor-b']) {
    const context = await browser.newContext(); const recipient = await context.newPage();
    try {
      await recipient.goto(testOrigin);
      await recipient.evaluate(link => location.assign(link), copied);
      await expect(recipient.getByRole('heading', { name: '공유받은 증빙을 확인하려면 인증해 주세요' })).toBeVisible();
      expect(await recipient.evaluate(() => location.hash === '')).toBe(true);
      await authenticate(recipient, person);
      if (person === 'auditor-b') {
        await expect(recipient.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
        await recipient.getByRole('button', { name: '원본 검증하기', exact: true }).click();
        await expect(recipient.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
      } else {
        await expect(recipient.getByRole('alert')).toContainText('접근할 수 없습니다');
        expect((await recipient.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
      }
    } finally { await context.close(); }
  }
});

test('S-04: actual clipboard permission denial keeps the created grant and allows copy retry without recreating', async ({ page }) => {
  const id = await makeShare(page); let creates = 0;
  page.on('request', r => { if (r.url().endsWith('/versions/1/grants') && r.method() === 'POST') creates++; });
  const cdp = await page.context().newCDPSession(page);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  expect(typeof targetInfo.browserContextId === 'string').toBe(true);
  await cdp.send('Browser.setPermission', { permission: { name: 'clipboard-write' }, setting: 'denied', origin: testOrigin, browserContextId: targetInfo.browserContextId });
  await page.getByRole('button', { name: '링크 복사', exact: true }).click();
  await expect(page.getByText('복사하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('권한 생성 · 수신 대기', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '권한 생성', exact: true })).toHaveCount(0);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: testOrigin });
  await page.getByRole('button', { name: '링크 복사', exact: true }).click();
  await expect(page.getByText('링크를 복사했습니다.', { exact: false })).toBeVisible();
  expect(creates).toBe(0);
  const grants = await (await page.request.get('/api/finance/grants')).json();
  expect(grants.filter((g: { id: string }) => g.id === id).length).toBe(1);
});

test('S-04: unfocused document clipboard rejection is not a share creation failure', async ({ page }) => {
  await makeShare(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  const foreground = await page.context().newPage(); await foreground.goto(testOrigin); await foreground.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false);
  // Invoke the real handler without bringing the old document to the foreground.
  await page.getByRole('button', { name: '링크 복사', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.getByText('복사하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('권한 생성 · 수신 대기', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '권한 생성', exact: true })).toHaveCount(0);
});
