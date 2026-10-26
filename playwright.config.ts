import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI,
    timeout: 120000, env: { SOMA_PERSISTENCE: 'local-synthetic', SOMA_LIVE_INFERENCE: 'false', SOMA_DB_PATH: '.local/e2e.sqlite' },
  },
});
