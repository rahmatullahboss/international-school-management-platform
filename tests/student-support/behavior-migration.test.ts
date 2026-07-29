import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/behavior/migrations/202607290203_CARE-01_behavior.sql',
  import.meta.url,
);

describe('CARE behavior migration contract', () => {
  test('uses CARE ownership, forced RLS, immutable history and suppressed reporting', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS behavior');
    expect(sql).toContain('FOREACH table_name IN ARRAY ARRAY[');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('CARE_BEHAVIOR_APPEND_ONLY_RECORD');
    expect(sql).toContain('CARE_BEHAVIOR_SOURCE_IMMUTABLE_USE_CORRECTION');
    expect(sql).toContain('prepared_by_principal_id <> approved_by_principal_id');
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('HAVING count(*) >= 5');
    expect(sql).toContain("'202607290203_CARE-01_behavior'");
    expect(sql).not.toMatch(/ALTER TABLE\s+(people|billing|ledger|integration|academics|hr)\./i);
    expect(sql).not.toContain('BYPASSRLS');
  });
});
