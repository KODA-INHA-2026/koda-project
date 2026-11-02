import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { testDataDir } from '../../scripts/test-environment.js';
import { authenticate, v1Detail } from './helpers.js';

async function login(page: Page, principal = 'finance-a') {
  await page.goto('/');
  await authenticate(page, principal);
  if (principal.startsWith('finance')) await expect(page.getByRole('heading', { name: '수탁 증빙', exact: true })).toBeVisible();
  else await expect(page.getByRole('heading', { name: principal === 'issuer' ? '잔고 증명서를 발행합니다' : '공유받은 증빙', exact: true })).toBeVisible();
}

test('T-05: Node signs/browser verifies and browser signs/Node verifies with tamper rejection', async ({ page }) => {
  const pair = generateKeyPairSync('ed25519');
  const bytes = new TextEncoder().encode('KODA interop — 가상 자료 2026');
  const privateKey = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const publicKey = pair.publicKey.export({ format: 'jwk' }).x!;
  const signature = sign(null, bytes, pair.privateKey).toString('base64');
  await page.goto('/');
  const result = await page.evaluate(async ({ privateKey, publicKey, signature, message }) => {
    const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const pub = await crypto.subtle.importKey('raw', decode(publicKey), 'Ed25519', false, ['verify']);
    const key = await crypto.subtle.importKey('pkcs8', decode(privateKey), 'Ed25519', false, ['sign']);
    const data = new Uint8Array(message);
    const valid = await crypto.subtle.verify('Ed25519', pub, decode(signature), data);
    const signed = new Uint8Array(await crypto.subtle.sign('Ed25519', key, data));
    data[0] = data[0]! ^ 1;
    const tampered = await crypto.subtle.verify('Ed25519', pub, decode(signature), data);
    let nonExtractable = false; try { await crypto.subtle.exportKey('pkcs8', key); } catch { nonExtractable = true; }
    return { valid, tampered, nonExtractable, signed: Array.from(signed) };
  }, { privateKey, publicKey, signature, message: Array.from(bytes) });
  expect(result.valid).toBe(true); expect(result.tampered).toBe(false); expect(result.nonExtractable).toBe(true);
  expect(verify(null, bytes, pair.publicKey, new Uint8Array(result.signed))).toBe(true);
});

test('S-00→S-02→S-03: real login, safe summary, search, reload, logout/back', async ({ page }) => {
  const apiBodies: string[] = []; const consoleMessages: string[] = [];
  page.on('response', res => { if (res.url().includes('/api/finance/')) void res.text().then(t => apiBodies.push(t)); });
  page.on('console', message => consoleMessages.push(message.text()));
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('/api/')) requests.push(r.postData() ?? ''); });
  await page.goto('/'); await expect(page.getByRole('heading', { name: '한 장의 증명서, 역할에 맞는 열람' })).toBeVisible();
  mkdirSync(testDataDir + '/screenshots', { recursive: true });
  await page.screenshot({ path: testDataDir + '/screenshots/s00.png', fullPage: true });
  await login(page);
  await expect(page.locator('a[href="' + v1Detail + '"]').first()).toBeVisible();
  await page.screenshot({ path: testDataDir + '/screenshots/s02.png', fullPage: true });
  await page.getByLabel('문서 번호 또는 기준일 검색').fill('not-found');
  await expect(page.getByRole('heading', { name: '검색 결과가 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '검색 초기화' }).click();
  await page.locator('a[href="' + v1Detail + '"]').first().click();
  await expect(page.getByRole('heading', { name: '자산과 평가액' })).toBeVisible();
  await expect(page.getByText('12.50000000', { exact: true })).toBeVisible();
  await expect(page.getByText('KODA 원본 확인 · 서버 검사', { exact: true })).toBeVisible();
  await page.screenshot({ path: testDataDir + '/screenshots/s03.png', fullPage: true });
  const storage = await page.evaluate(async () => ({ local: { ...localStorage }, session: { ...sessionStorage }, databases: await indexedDB.databases(), registrations: (await navigator.serviceWorker.getRegistrations()).length }));
  expect(storage).toEqual({ local: {}, session: {}, databases: [], registrations: 0 });
  const html = await page.content();
  const key = JSON.parse(readFileSync(resolve(testDataDir, 'keys/finance-a.json'),'utf8'));
  expect([...apiBodies, html, ...consoleMessages].join('')).not.toContain('SYNTHETIC_PRIVATE_');
  expect(requests.join('')).not.toContain(key.pkcs8);
  expect(apiBodies.join('')).not.toMatch(/payloadCanonical|statementCanonical|"custodyAddress"|counterpartyAddress|transactionReference|"salt"|"signature"/);
  await page.reload(); await expect(page.getByText('12.50000000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^(역할 바꾸기|로그아웃)$/ }).click();
  await expect(page.getByRole('heading', { name: '한 장의 증명서, 역할에 맞는 열람' })).toBeVisible();
  await page.goBack(); await expect(page.getByRole('heading', { name: '한 장의 증명서, 역할에 맞는 열람' })).toBeVisible();
  await expect(page.getByText('12.50000000', { exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/finance/evidence')).status()).toBe(401);
});

test('T-03/T-09: wrong key, auditor role, other tenant/version and direct server files denied', async ({ page }) => {
  await page.goto('/'); await expect(page.getByLabel('시연 신원')).toBeEnabled();
  await page.getByLabel('해당 신원의 키 파일').setInputFiles(resolve(testDataDir, 'keys/auditor-b.json'));
  await page.getByRole('button', { name: '시연 신원 인증' }).click();
  await expect(page.getByRole('alert')).toContainText('선택한 신원과 키 파일이 다릅니다');
  await login(page, 'auditor-b'); expect((await page.request.get('/api/finance/evidence')).status()).toBe(403);
  await page.getByRole('button', { name: /^(역할 바꾸기|로그아웃)$/ }).click();
  await login(page);
  for (const url of ['/api/finance/evidence/KODA-20261031-002/versions/1', '/api/finance/evidence/KODA-20261031-001/versions/999']) expect((await page.request.get(url)).status()).toBe(404);
  for (const path of [testDataDir + '/keys/finance-a.json', testDataDir + '/demo.sqlite', 'local-design/README.md', 'apps/api/src/fixtures/synthetic.ts']) {
    const res = await page.request.get('/@fs/' + resolve(path)); expect(res.status()).toBe(403);
  }
});

test('S-00/S-03: narrow viewport and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await expect(page.getByLabel('시연 신원')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('시연 신원').focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('해당 신원의 키 파일')).toBeFocused();
  await login(page); await page.locator('a[href="' + v1Detail + '"]').first().click();
  await expect(page.getByText('12.50000000', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testDataDir + '/screenshots/s03-mobile.png', fullPage: true });
});

test('T-02/T-09: actual server session expiry clears an open detail screen', async ({ page }) => {
  await login(page); await page.locator('a[href="' + v1Detail + '"]').first().click();
  await expect(page.getByText('12.50000000', { exact: true })).toBeVisible();
  const cookie = (await page.context().cookies()).find(c => c.name === 'koda_session')!;
  const db = new DatabaseSync(resolve(testDataDir, 'demo.sqlite'));
  try { db.exec('PRAGMA busy_timeout=5000'); db.prepare('UPDATE sessions SET expiresAt=? WHERE tokenHash=?').run(Date.now()-1, createHash('sha256').update(cookie.value).digest('hex')); } finally { db.close(); }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: '한 장의 증명서, 역할에 맞는 열람' })).toBeVisible();
  await expect(page.getByText('12.50000000', { exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/finance/evidence')).status()).toBe(401);
});

test('S-02: network failure is recoverable and never displayed as verification success', async ({ page }) => {
  await login(page);
  await page.context().setOffline(true);
  await page.locator('a[href="' + v1Detail + '"]').first().click();
  await expect(page.getByRole('alert')).toContainText('서버에 연결할 수 없습니다');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: '증빙 다시 불러오기', exact: true }).click();
  await expect(page.getByText('12.50000000', { exact: true })).toBeVisible();
  await expect(page.getByText('KODA 원본 확인 · 서버 검사', { exact: true })).toBeVisible();
});
