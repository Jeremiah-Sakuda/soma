import { defineConfig } from 'vite';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';

// The lab is a static WebXR page. Emulation (a desktop Quest 3) runs only on localhost during development.
export default defineConfig({
  base: './',
  // HTTP on localhost: browsers treat it as a secure origin for WebXR, and no self-signed certificate is needed.
  plugins: [iwsdkDev({ emulator: { device: 'metaQuest3' }, https: false })],
  server: { fs: { allow: ['..'] } },
});
