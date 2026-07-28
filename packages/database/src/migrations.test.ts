import { describe, expect, it } from 'vitest';

import { foundationMigrations, validateMigrationPlan } from './migrations.js';

describe('foundation migration plan', () => {
  it('is strictly ordered and contains unique identifiers', () => {
    expect(() => validateMigrationPlan(foundationMigrations)).not.toThrow();
    expect(foundationMigrations.map((migration) => migration.id)).toEqual([
      '202607280001_FND-01_foundation',
    ]);
  });

  it('creates the owned schemas and an RLS isolation probe', () => {
    const sql = foundationMigrations[0]?.sql ?? '';

    for (const schema of ['platform', 'tenancy', 'iam', 'audit', 'workflow', 'integration_core']) {
      expect(sql).toContain(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    }

    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('CREATE ROLE app_runtime NOLOGIN');
  });
});
