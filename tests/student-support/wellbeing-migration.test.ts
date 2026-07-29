import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/wellbeing/migrations/202607290204_CARE-01_wellbeing.sql',
  import.meta.url,
);

describe('CARE wellbeing migration contract', () => {
  test('forces RLS and preserves counselling, basis, risk and publication history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS wellbeing');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('CARE_WELLBEING_APPEND_ONLY_RECORD');
    expect(sql).toContain('prepared_by_principal_id <> approved_by_principal_id');
    expect(sql).toContain("classification text NOT NULL DEFAULT 'CARE-C3'");
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('HAVING count(*) >= 5');
    expect(sql).toContain("'202607290204_CARE-01_wellbeing'");
    expect(sql).not.toMatch(/ALTER TABLE\s+(people|billing|ledger|integration|academics|hr)\./i);
    expect(sql).not.toContain('BYPASSRLS');
  });
});
