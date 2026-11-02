import { test, expect, type Page, type Browser } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { selectTamperedFile, authenticate, logout } from './helpers.js';

async function openAudit(finance: Page, browser: Browser) {
  await finance.goto('/'); await authenticate(finance);
  const session = await (await finance.request.get('/api/me')).json();
  const recipients = await (await finance.request.get('/api/finance/auditors')).json();
  const headers = { origin: new URL(finance.url()).origin, 'x-csrf-token': session.csrf };
  const response = await finance.request.post('/api/evidence/KODA-20261031-001/versions/1/grants', { headers, data: { auditorDid: recipients[0].did, idempotencyKey: randomUUID() } });
  expect(response.status()).toBe(201); const { grant, token } = await response.json();
  const context = await browser.newContext(); const audit = await context.newPage();
  await audit.clock.install();
  const url = new URL('/share', finance.url()); url.hash = 'token=' + token;
  await audit.goto(url.href); await authenticate(audit, 'auditor-b');
  await expect(audit.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
  return { audit, context, grant, headers, endpoint: '/api/grants/' + grant.id + '/evidence' };
}
const valid = (page: Page) => page.getByText('KODA가 발행한 원본과 같습니다.', { exact: true });

test('S-07 regression: valid focus and periodic permission checks preserve the last result and original timestamp', async ({ page, browser }) => {
  const f = await openAudit(page, browser);
  try {
    await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect(valid(f.audit)).toBeVisible();
    const stamp = await f.audit.locator('.verification-result p').filter({ hasText: '검증 시각' }).innerText();
    const checked = f.audit.waitForResponse(r => r.url().endsWith(f.endpoint));
    await f.audit.evaluate(() => window.dispatchEvent(new Event('focus'))); await checked;
    await expect(valid(f.audit)).toBeVisible();
    expect(await f.audit.locator('.verification-result p').filter({ hasText: '검증 시각' }).innerText()).toBe(stamp);
    await expect(f.audit.getByText('마지막 검증 결과', { exact: false })).toBeVisible();

    const polled = f.audit.waitForResponse(r => r.url().endsWith(f.endpoint));
    await f.audit.clock.runFor(15_100); await polled;
    await expect(valid(f.audit)).toBeVisible();
    expect(await f.audit.locator('.verification-result p').filter({ hasText: '검증 시각' }).innerText()).toBe(stamp);
    const cdp = await f.context.newCDPSession(f.audit);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    const otherTab = await f.context.newPage(); await otherTab.goto(new URL(page.url()).origin); await otherTab.bringToFront();
    await expect.poll(() => f.audit.evaluate(() => document.hasFocus())).toBe(false);
    const refocused = f.audit.waitForResponse(r => r.url().endsWith(f.endpoint));
    await f.audit.bringToFront(); await refocused; await expect(valid(f.audit)).toBeVisible();
    expect(await f.audit.locator('.verification-result p').filter({ hasText: '검증 시각' }).innerText()).toBe(stamp);
    await otherTab.close();
    // Headless Chrome did not naturally report hidden=true on tab switching.
    // Exercise that branch explicitly; this is not real visibility/bfcache evidence.
    await f.audit.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(valid(f.audit)).toHaveCount(0); expect((await f.audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
    await f.audit.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(valid(f.audit)).toBeVisible();
    expect(await f.audit.locator('.verification-result p').filter({ hasText: '검증 시각' }).innerText()).toBe(stamp);
    expect(await f.audit.evaluate(async () => ({ local: Object.keys(localStorage).length, session: Object.keys(sessionStorage).length, databases: (await indexedDB.databases()).length }))).toEqual({ local: 0, session: 0, databases: 0 });
    await selectTamperedFile(f.audit);
    await expect(f.audit.locator('.verification-result').getByText('체인 기록과 다릅니다.', { exact: true })).toBeVisible();
    await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(f.audit.locator('.verification-result').getByText('체인 기록과 다릅니다.', { exact: true })).toBeVisible();
    await expect(f.audit.getByText('선택 파일의 실제 검사 결과', { exact: false })).toBeVisible();
    await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect(valid(f.audit)).toBeVisible();
    await expect(f.audit.getByText('선택 파일의 실제 검사 결과', { exact: false })).toHaveCount(0);
  } finally { await f.context.close(); }
});

test('S-07: pending permission hides old success; network failure permanently discards it', async ({ page, browser }) => {
  const f = await openAudit(page, browser); let release = () => {};
  try {
    await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect(valid(f.audit)).toBeVisible();
    const gate = new Promise<void>(resolve => { release = resolve; });
    await f.audit.route('**' + f.endpoint, async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); }, { times: 1 });
    await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(f.audit.getByText('열람 권한을 확인하고 있어요…', { exact: true })).toBeVisible();
    await expect(valid(f.audit)).toHaveCount(0); expect((await f.audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
    release(); await expect(valid(f.audit)).toBeVisible();
    await f.audit.route('**' + f.endpoint, route => route.abort('connectionreset'), { times: 1 });
    await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(f.audit.getByRole('alert')).toContainText('서버에 연결할 수 없습니다');
    await f.audit.getByRole('button', { name: '권한 다시 확인', exact: true }).click();
    await expect(f.audit.getByText('아직 검증하지 않았습니다.', { exact: true })).toBeVisible();
  } finally { release(); await f.context.close(); }
});

for (const field of ['payloadCanonical', 'salt', 'signature', 'statementCanonical', 'anchorLocator', 'version', 'grant', 'trust']) {
  test(`S-07: changed ${field} binding invalidates old result without modifying the issued original`, async ({ page, browser }) => {
    const f = await openAudit(page, browser);
    try {
      await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect(valid(f.audit)).toBeVisible();
      const endpoint = field === 'trust' ? '/api/verification/trust' : f.endpoint;
      await f.audit.route('**' + endpoint, async route => {
        const response = await route.fetch(); const body = await response.json();
        if (field === 'trust') body.instanceId = '0x' + '00'.repeat(32);
        else if (field === 'grant') body.grant.version++;
        else if (field === 'version') body.envelope.version++;
        else if (field === 'anchorLocator') body.envelope.anchorLocator.blockHash = '0x' + '00'.repeat(32);
        else body.envelope[field] += ' ';
        await route.fulfill({ response, json: body });
      }, { times: 1 });
      await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(f.audit.getByText('아직 검증하지 않았습니다.', { exact: true })).toBeVisible();
      await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(f.audit.getByText('아직 검증하지 않았습니다.', { exact: true })).toBeVisible();
      await expect(valid(f.audit)).toHaveCount(0);
    } finally { await f.context.close(); }
  });
}

test('S-07: normal recheck does not cancel in-flight RPC, but revocation fences a late valid result', async ({ page, browser }) => {
  const f = await openAudit(page, browser); let release = () => {};
  let blockReads = 0;
  f.audit.on('response', response => { if (response.url().startsWith(process.env.KODA_RPC_URL ?? 'http://127.0.0.1:18545') && response.request().postData()?.includes('eth_getBlockByNumber')) blockReads++; });
  async function holdRpc() {
    let entered = false; const gate = new Promise<void>(resolve => { release = resolve; });
    await f.audit.route((process.env.KODA_RPC_URL ?? 'http://127.0.0.1:18545') + '/**', async route => { const response = await route.fetch(); entered = true; await gate; await route.fulfill({ response }); }, { times: 1 });
    await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click();
    await expect.poll(() => entered).toBe(true);
  }
  try {
    await holdRpc(); await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(f.audit.getByRole('button', { name: '원본 검증하기', exact: true })).toBeDisabled();
    release(); await expect(valid(f.audit)).toBeVisible();
    const before = blockReads; await holdRpc();
    expect((await page.request.post('/api/grants/' + f.grant.id + '/revoke', { headers: f.headers })).status()).toBe(200);
    await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(f.audit.getByRole('alert')).toContainText('철회'); release();
    await expect.poll(() => blockReads).toBeGreaterThanOrEqual(before + 2);
    await expect(valid(f.audit)).toHaveCount(0); expect((await f.audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
  } finally { release(); await f.context.close(); }
});

test('S-07: a late previously-authorized recheck cannot overwrite verification-time revocation', async ({ page, browser }) => {
  const f = await openAudit(page, browser); let releaseRpc = () => {}; let releasePermission = () => {};
  try {
    let rpcHeld = false; let permissionHeld = false; let permissionFinished = false;
    const rpcGate = new Promise<void>(resolve => { releaseRpc = resolve; });
    const permissionGate = new Promise<void>(resolve => { releasePermission = resolve; });
    await f.audit.route((process.env.KODA_RPC_URL ?? 'http://127.0.0.1:18545') + '/**', async route => { const response = await route.fetch(); rpcHeld = true; await rpcGate; await route.fulfill({ response }); }, { times: 1 });
    await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect.poll(() => rpcHeld).toBe(true);
    await f.audit.route('**' + f.endpoint, async route => {
      const response = await route.fetch(); permissionHeld = true; await permissionGate;
      try { await route.fulfill({ response }); }
      catch (error) {
        // Chromium can settle the intercepted route on AbortController.abort()
        // without emitting requestfailed until the route itself is released.
        if (!(error instanceof Error) || !error.message.includes('Route is already handled!')) throw error;
      }
      permissionFinished = true;
    }, { times: 1 });
    await f.audit.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect.poll(() => permissionHeld).toBe(true);
    expect((await page.request.post('/api/grants/' + f.grant.id + '/revoke', { headers: f.headers })).status()).toBe(200);
    releaseRpc(); await expect(f.audit.getByRole('alert')).toContainText('철회');
    releasePermission(); await expect.poll(() => permissionFinished).toBe(true);
    await f.audit.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(f.audit.getByRole('alert')).toContainText('철회');
    await expect(valid(f.audit)).toHaveCount(0); expect((await f.audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
  } finally { releaseRpc(); releasePermission(); await f.context.close(); }
});

for (const person of ['auditor-b', 'auditor-c']) {
  test(`S-07: real session replacement with ${person} never reuses the prior session's result`, async ({ page, browser }) => {
    const f = await openAudit(page, browser);
    try {
      await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect(valid(f.audit)).toBeVisible();
      const priorCsrf = (await (await f.audit.request.get('/api/me')).json()).csrf;
      const other = await f.context.newPage(); await other.goto(new URL(page.url()).origin);
      await logout(other); await authenticate(other, person);
      expect((await (await other.request.get('/api/me')).json()).csrf !== priorCsrf).toBe(true);
      await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
      if (person === 'auditor-c') {
        await expect(f.audit.getByRole('alert')).toContainText('접근할 수 없습니다');
        expect((await f.audit.content()).includes('SYNTHETIC_PRIVATE_')).toBe(false);
        await logout(other); await authenticate(other, 'auditor-b');
        await f.audit.evaluate(() => window.dispatchEvent(new Event('focus')));
      }
      await expect(f.audit.getByRole('heading', { name: '가상 고객사 A 잔고 증명서' })).toBeVisible();
      await expect(f.audit.getByText('아직 검증하지 않았습니다.', { exact: true })).toBeVisible(); await expect(valid(f.audit)).toHaveCount(0);
      await f.audit.getByRole('button', { name: '원본 검증하기', exact: true }).click(); await expect(valid(f.audit)).toBeVisible();
    } finally { await f.context.close(); }
  });
}
