import { defineConfig } from 'vitest/config';

const coverageBarrels = [
  'packages/database/src/index.ts',
  'packages/platform/src/index.ts',
  'packages/policy/src/index.ts',
  'packages/sis/src/admissions.ts',
  'packages/sis/src/people.ts',
  'packages/sis/src/student-lifecycle.ts',
  'packages/modules/activities-trips/src/index.ts',
  'packages/modules/admissions/src/index.ts',
  'packages/modules/behavior/src/index.ts',
  'packages/modules/billing/src/index.ts',
  'packages/modules/billing/src/contracts/index.ts',
  'packages/modules/health/src/index.ts',
  'packages/modules/hr/src/index.ts',
  'packages/modules/integrations/src/index.ts',
  'packages/modules/inventory-assets/src/index.ts',
  'packages/modules/learning-support/src/index.ts',
  'packages/modules/ledger/src/index.ts',
  'packages/modules/ledger/src/contracts/index.ts',
  'packages/modules/library/src/index.ts',
  'packages/modules/people/src/index.ts',
  'packages/modules/procurement/src/index.ts',
  'packages/modules/residential-catering/src/index.ts',
  'packages/modules/safeguarding/src/index.ts',
  'packages/modules/student-lifecycle/src/index.ts',
  'packages/modules/transport/src/index.ts',
  'packages/modules/wellbeing/src/index.ts',
] as const;

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      include: ['apps/**/src/**/*.{ts,tsx}', 'packages/**/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts', ...coverageBarrels],
      reporter: ['text', 'json-summary', 'html'],
      reportOnFailure: true,
    },
  },
});
