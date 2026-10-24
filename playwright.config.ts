import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', timeout:45000, workers:1,
  use:{baseURL:'http://127.0.0.1:5173',headless:true,viewport:{width:1512,height:982},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}},
  webServer:{command:process.env.E2E_PREVIEW==='1'?'npm run preview -- --port 5173 --strictPort':'npm run dev -- --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
});
