import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../../../tests/integrations/browser',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'on-first-retry',
  },
});
