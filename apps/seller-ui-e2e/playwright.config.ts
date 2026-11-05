import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  fullyParallel: false,
  reporter: 'list',
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx next start ../../apps/seller-ui --hostname 127.0.0.1 --port 3001',
    url: 'http://127.0.0.1:3001/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_GATEWAY_URL: 'http://127.0.0.1:8000',
      NEXT_PUBLIC_USER_UI_URL: 'http://127.0.0.1:3000',
    },
  },
});
