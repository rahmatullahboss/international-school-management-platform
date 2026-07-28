import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /sis-browser\.spec\.tsx$/u,
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  tsconfig: './tsconfig.playwright.json',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
});
