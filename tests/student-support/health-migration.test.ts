import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/health/migrations/202607290202_CARE-01_health.sql',
  import.meta.url,
);

describe('CARE health migration contract', () => {
  test('owns only health schema and forces tenant isolation on every table', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS health');
    expect(sql.match(/FORCE ROW LEVEL SECURITY/g)).toHaveLength(1);
    expect(sql).toContain("FOREACH table_name IN ARRAY ARRAY[");
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('medication_administration_append_only');
    expect(sql).toContain('CARE_HEALTH_CLOSED_ENCOUNTER_IMMUTABLE');
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('HAVING count(*) >= 5');
    expect(sql).toContain("'202607290202_CARE-01_health'");
    expect(sql).not.toMatch(/ALTER TABLE\s+(people|billing|ledger|integration|academics|hr)\./i);
    expect(sql).not.toContain('BYPASSRLS');
  });
});
