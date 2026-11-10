import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Run from the repository root: npx playwright test --config xr/playwright.hands.config.ts
// The dev server installs IWER. The separate production config checks the non-emulated build.
export default defineConfig({
  testDir: './tests',
  testMatch: 'hands.spec.ts',
  outputDir: './test-results/hands',
  reporter: [['list'], ['html', { outputFolder: './playwright-report/hands', open: 'never' }]],
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: 'chromium',
    headless: false,
    viewport: { width: 1600, height: 900 },
    baseURL: 'http://127.0.0.1:4176',
    trace: 'retain-on-failure',
    video: process.env.SOMA_RECORD_XR === '1' ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  webServer: {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    command: 'npm run dev -- --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
