import { defineConfig } from '@playwright/test';
// Build first: node node_modules/vite/bin/vite.js build --config docs/examples/pm117/viewer/vite.config.mjs
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1, reporter: 'list',
  outputDir: '../../.local/pm118/gallery-results',
  use: { baseURL: 'http://127.0.0.1:41908', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve-mechanism-comparison.mjs', cwd: '../..', url: 'http://127.0.0.1:41908', reuseExistingServer: true },
});
