import { defineConfig } from '@playwright/test';
import { testDataDir, testOrigin } from './scripts/test-environment.js';
export default defineConfig({
  testDir: './tests/browser', outputDir: testDataDir + '/browser-results', fullyParallel: false, workers: 1,
  timeout: 30_000, expect: { timeout: 7000 }, reporter: 'list',
  use: { baseURL: testOrigin, channel: 'chrome', headless: true, viewport: { width: 1440, height: 900 }, trace: 'off', screenshot: 'off' },
});
