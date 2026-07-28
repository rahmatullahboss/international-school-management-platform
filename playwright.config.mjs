import { defineConfig } from '@playwright/test';

export default defineConfig({
  tsconfig: './tsconfig.playwright.json',
  testDir: './tests/browser',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview --workspace=@school/platform-web -- --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
