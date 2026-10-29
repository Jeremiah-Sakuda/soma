import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Bound CPU contention as the suite grows; preserve meaningful per-case deadlines.
  test: { maxWorkers: 4, include: ['tests/**/*.test.ts'], environment: 'node' },
});
