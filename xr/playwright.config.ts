import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** Run from the repo root: npx playwright test --config xr/playwright.config.ts.
 * Install both root and xr lockfiles first. Production Vite output excludes the dev emulator.
 * Headed Chromium keeps World.create's animation-frame initialization visible.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: 'lab.spec.ts',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    browserName: 'chromium',
    headless: false,
    viewport: { width: 1600, height: 900 },
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
    command: 'npm run build && python3 -m http.server 4175 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
