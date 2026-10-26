import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Share one fresh synthetic database with this run's workers, never previous runs.
const directory = process.env.SOMA_E2E_TEMP_DIRECTORY ?? mkdtempSync(join(tmpdir(), 'soma-e2e-'));
process.env.SOMA_E2E_TEMP_DIRECTORY = directory;
export default defineConfig({
  testDir: './tests/e2e', globalTeardown: './tests/e2e/cleanup.ts', fullyParallel: false, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false,
    timeout: 120000, env: { NEXT_PUBLIC_FIREBASE_API_KEY: 'synthetic-browser-test-key', SOMA_PERSISTENCE: 'local-synthetic', SOMA_LIVE_INFERENCE: 'false', SOMA_LOCAL_DATABASE_PATH: join(directory, 'workspace.sqlite') },
  },
});
