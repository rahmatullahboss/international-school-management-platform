import { defineConfig } from '@playwright/test';

export default defineConfig({
  tsconfig: './tsconfig.json',
  testDir: '.',
  testMatch: 'browser.e2e.tsx',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
  },
});
