import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/proof', outputDir: './artifacts/proof/tests', workers: 1,
  webServer: process.env.KODA_PROOF_PREVIEW === '1' ? { command: 'npm exec -w @koda/web -- vite preview --host 127.0.0.1 --port 5192 --base=/koda-project/', url: 'http://127.0.0.1:5192/koda-project/', reuseExistingServer: false } : undefined,
  timeout: 30000, expect: { timeout: 7000 }, reporter: 'list',
  use: { baseURL: process.env.KODA_PROOF_URL || 'http://localhost:5186', channel: 'chrome', headless: true, viewport: { width: 1510, height: 980 }, screenshot: 'only-on-failure' },
});
