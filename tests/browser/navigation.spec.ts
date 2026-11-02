import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authenticate, logout } from './helpers.js';
import { testOrigin, testDataDir } from '../../scripts/test-environment.js';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

type NavigationObservation = { persisted: boolean; sensitiveAtShow: boolean; validAtShow: boolean };
const runId = randomUUID();
for (const scenario of ['revoke', 'expiry', 'logout'] as const) {
  test(`T-13: real back/forward after ${scenario} never restores hidden original or old VALID`, async ({ page, browser }, info) => {
    await page.goto('/'); await authenticate(page);
    const session = await (await page.request.get('/api/me')).json();
    const auditors = await (await page.request.get('/api/finance/auditors')).json();
    const headers = { origin: testOrigin, 'x-csrf-token': session.csrf };
    const made = await page.request.post('/api/evidence/KODA-20261031-001/versions/1/grants', { headers, data: {
      auditorDid: auditors[0].did, idempotencyKey: randomUUID(), ...(scenario === 'expiry' ? { expiresAt: new Date(Date.now() + 6000).toISOString() } : {}),
    } });
    expect(made.status()).toBe(201); const { grant, token } = await made.json();
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const observations: { persisted: boolean; sensitiveAtShow: boolean; validAtShow: boolean }[] = [];
      Object.assign(window, { navigationObservations: observations });
      window.addEventListener('pageshow', event => observations.push({ persisted: event.persisted,
        sensitiveAtShow: document.body?.innerText.includes('SYNTHETIC_PRIVATE_') ?? false,
        validAtShow: !!document.querySelector('.verification-result[data-status="VALID"]'),
      }));
    });
    const audit = await context.newPage(); const observations: NavigationObservation[] = [];
    const collect = async () => observations.push(...await audit.evaluate(() => (window as unknown as { navigationObservations: NavigationObservation[] }).navigationObservations));
    const assertHidden = async () => { await expect(audit.locator('.verification-result[data-status="VALID"]')).toHaveCount(0); expect((await audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false); };
    const assertBlocked = async () => {
      if (scenario === 'logout') await expect(audit.getByRole('heading', { name: '공유받은 증빙을 확인하려면 인증해 주세요' })).toBeVisible();
      else await expect(audit.getByRole('alert')).toContainText(scenario === 'expiry' ? '기한이 지났습니다' : '철회');
      await assertHidden(); await collect();
    };
    try {
      await audit.goto(testOrigin);
      await audit.evaluate(link => location.assign(link), testOrigin + '/share#token=' + token);
      await authenticate(audit, 'auditor-b');
      await expect(audit.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
      await audit.getByRole('button', { name: '원본 검증하기', exact: true }).click();
      await expect(audit.getByText('KODA가 발행한 원본과 같습니다.', { exact: true })).toBeVisible();
      await audit.goto(testOrigin + '/?navigation=away');
      await expect(audit.getByRole('heading', { name: '공유받은 증빙', exact: true })).toBeVisible();
      if (scenario === 'revoke') expect((await page.request.post('/api/grants/' + grant.id + '/revoke', { headers })).status()).toBe(200);
      else if (scenario === 'expiry') await expect.poll(async () => (await audit.request.get('/api/grants/' + grant.id + '/evidence')).status(), { timeout: 9000 }).toBe(410);
      else await logout(audit);
      for (let step = 0; step < 4; step++) { await audit.goBack(); if (new URL(audit.url()).pathname === '/audit/grants/' + grant.id) break; }
      expect(new URL(audit.url()).pathname === '/audit/grants/' + grant.id).toBe(true);
      await assertBlocked();
      await audit.goForward(); await assertHidden(); await collect();
      await audit.goBack(); await assertBlocked();
      expect(observations.every(o => !o.sensitiveAtShow && !o.validAtShow)).toBe(true);
      const observation = { runId, scenario, observedBfcacheRestore: observations.some(o => o.persisted), observations };
      appendFileSync(resolve(testDataDir, 'navigation-observations.jsonl'), JSON.stringify(observation) + '\n', { mode: 0o600 });
      await info.attach('native-navigation-observation', { body: Buffer.from(JSON.stringify(observation)), contentType: 'application/json' });
    } finally { await context.close(); }
  });
}
