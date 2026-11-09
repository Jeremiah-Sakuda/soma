import { defineConfig } from 'vite';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';

// The lab is a static WebXR page. Emulation (a desktop Quest 3) runs only on localhost during development.
export default defineConfig({
  base: './',
  plugins: [iwsdkDev({ emulator: { device: 'metaQuest3' } })],
  server: { fs: { allow: ['..'] } },
});
