import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/proof', outputDir: './artifacts/proof/tests', workers: 1,
  timeout: 30000, expect: { timeout: 7000 }, reporter: 'list',
  use: { baseURL: process.env.KODA_PROOF_URL || 'http://localhost:5186', channel: 'chrome', headless: true, viewport: { width: 1510, height: 980 }, screenshot: 'only-on-failure' },
});
