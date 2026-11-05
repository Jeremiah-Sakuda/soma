import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: false,
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  resolve: { alias: { '@': `${repo}src` }, dedupe: ['react', 'react-dom'] },
  oxc: { jsx: { runtime: 'automatic' } },
  build: { outDir: `${repo}.local/pm121/viewer/dist`, emptyOutDir: true },
});
