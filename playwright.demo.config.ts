import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'demo-material-replay.spec.ts',workers:2,use:{...base.use,baseURL:'http://127.0.0.1:3198'},webServer:{...base.webServer,command:'npm run dev -- --webpack --port 3198',url:'http://127.0.0.1:3198',reuseExistingServer:false}});
