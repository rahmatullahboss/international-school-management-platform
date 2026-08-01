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
  webServer: [
    {
      command:
        'npx wrangler dev tests/browser/platform-api-e2e-worker.ts --config apps/platform-api/wrangler.jsonc --ip 127.0.0.1 --port 8787 --var PILOT_SESSION_SECRET:playwright-pilot-session-secret-0123456789abcdef',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run preview --workspace=@school/platform-web -- --host 127.0.0.1',
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
