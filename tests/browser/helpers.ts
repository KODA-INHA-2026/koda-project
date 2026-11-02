import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { testDataDir } from '../../scripts/test-environment.js';
export async function authenticate(page: Page, person = 'finance-a') {
  await expect(page.locator('.role-choice, #principal').first()).toBeEnabled();
  if(await page.locator('.role-choice').count()){
    const labels:Record<string,string>={issuer:'KODA 운영자','finance-a':'재무담당자','accounting-a':'회계담당자','auditor-b':'외부 감사인'};
    for(let attempt=0;attempt<2;attempt++){
      const completed=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/auth/')&&(r.status()!==200||r.url().endsWith('/verify')));
      await page.getByRole('button',{name:labels[person]+(person==='auditor-b'?'으로 시작':'로 시작'),exact:true}).click();
      const response=await completed;if(response.status()===429&&attempt===0){await waitForAuthWindow(page);continue;}
      expect(response.status()).toBe(200);await expect(page.getByRole('button',{name:/^(역할 바꾸기|로그아웃)$/})).toBeVisible();return;
    }
    throw new Error('Click authentication did not complete');
  }
  await expect(page.getByLabel('시연 신원', { exact: false })).toBeEnabled();
  await page.getByLabel('시연 신원', { exact: false }).selectOption(person);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('해당 신원의 키 파일').setInputFiles(resolve(testDataDir, 'keys/' + person + '.json'));
    const completed = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/auth\/(challenge|verify)$/.test(r.url()) && (r.status() !== 200 || r.url().endsWith('/verify')));
    await page.getByRole('button', { name: '시연 신원 인증' }).click();
    const response = await completed;
    if (response.status() === 429 && attempt === 0) { await waitForAuthWindow(page); continue; }
    expect(response.status()).toBe(200);
    await expect(page.getByRole('button', { name: /^(역할 바꾸기|로그아웃)$/ })).toBeVisible(); return;
  }
}
export async function waitForAuthWindow(page: Page) {
  // Keep the real server's 60/min limit. Retry the UI only after its window expires.
  test.info().setTimeout(test.info().timeout + 65_000);
  test.info().annotations.push({ type: 'rate-limit-backoff', description: 'Real 429; waited 61 seconds without changing server policy or injecting a session.' });
  await expect(page.getByRole('alert')).toContainText('요청이 많습니다');
  await page.waitForTimeout(61_000);
}
export async function logout(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const completed = page.waitForResponse(r => r.url().endsWith('/api/auth/logout') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^(역할 바꾸기|로그아웃)$/ }).click(); const response = await completed;
    if (response.status() === 429 && attempt === 0) { await waitForAuthWindow(page); continue; }
    expect(response.status()).toBe(204); break;
  }
  await expect(page.locator('.role-choice, #key-file').first()).toBeVisible();
}
export const v1Detail = '/evidence/KODA-20261031-001/versions/1';

export async function selectTamperedFile(page: Page) {
  const grantId = new URL(page.url()).pathname.split('/')[3];
  const { envelope } = await (await page.request.get('/api/grants/' + grantId + '/evidence')).json();
  const { canonicalJson, evidenceFile } = await import('@koda/protocol');
  const payload = JSON.parse(envelope.payloadCanonical); payload.assets[0].quantity = '0'; envelope.payloadCanonical = canonicalJson(payload);
  await page.getByLabel('검사할 시연 JSON 파일').setInputFiles({ name: 'legacy-mail-copy.json', mimeType: 'application/json', buffer: Buffer.from(evidenceFile(envelope)) });
  await page.getByRole('button', { name: '선택 파일 검사', exact: true }).click();
}
export async function showFinanceVerification(page: Page) {
  const details = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: '서버 원본 확인 근거' }) });
  if (!await details.evaluate(el => (el as HTMLDetailsElement).open)) await details.locator(':scope > summary').click();
  await expect(page.getByText('KODA가 발행한 원본과 같습니다.', {exact:true})).toBeVisible();
}
