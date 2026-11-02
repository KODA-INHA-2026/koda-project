import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { selectTamperedFile, authenticate } from './helpers.js';

async function createGrant(page: Page, seconds?: number) {
  const session = await (await page.request.get('/api/me')).json();
  const auditors = await (await page.request.get('/api/finance/auditors')).json();
  const response = await page.request.post('/api/evidence/KODA-20261031-001/versions/1/grants', {
    headers: { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrf },
    data: { auditorDid: auditors[0].did, idempotencyKey: randomUUID(), ...(seconds ? { expiresAt: new Date(Date.now() + seconds * 1000).toISOString() } : {}) },
  });
  expect(response.status()).toBe(201); return response.json();
}

test('T-12/13: browser tamper, real transport failure, recovery and wall-clock grant expiry', async ({ page, browser }) => {
  await page.goto('/'); await authenticate(page);
  const { grant, token } = await createGrant(page);
  const context = await browser.newContext(); const audit = await context.newPage();
  try {
    const link = new URL('/share', page.url()); link.hash = 'token=' + token;
    await audit.goto(link.href); await authenticate(audit, 'auditor-b');
    await expect(audit.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
    const original = (await (await audit.request.get('/api/grants/' + grant.id + '/evidence')).json()).envelope;
    await selectTamperedFile(audit);
    await expect(audit.locator('.verification-result').getByText('체인 기록과 다릅니다.', { exact: true })).toBeVisible();
    expect((await (await audit.request.get('/api/grants/' + grant.id + '/evidence')).json()).envelope).toEqual(original);
    await audit.route((process.env.KODA_RPC_URL ?? 'http://127.0.0.1:18545') + '/**', route => route.abort('connectionrefused'));
    await audit.getByRole('button', { name: '원본 검증하기', exact: true }).click();
    await expect(audit.getByText('지금은 검증할 수 없습니다.', { exact: true })).toBeVisible();
    await audit.unroute((process.env.KODA_RPC_URL ?? 'http://127.0.0.1:18545') + '/**');
    await audit.getByRole('button', { name: '원본 검증하기', exact: true }).click();
    await expect(audit.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
    const expiring = await createGrant(page, 5);
    link.hash = 'token=' + expiring.token; await audit.goto(link.href);
    await expect(audit.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
    await expect.poll(async () => (await audit.request.get('/api/grants/' + expiring.grant.id + '/evidence')).status(), { timeout: 8000 }).toBe(410);
    await audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(audit.getByRole('alert')).toContainText('기한이 지났습니다');
    expect((await audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
    await audit.reload(); await expect(audit.getByRole('alert')).toContainText('기한이 지났습니다');
  } finally { await context.close(); }
});
