import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/learning-support/migrations/202607290206_CARE-01_learning_support.sql',
  import.meta.url,
);

describe('CARE learning-support migration contract', () => {
  test('forces RLS, preserves restricted history and exposes only minimized projections', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS learning_support');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('CARE_LEARNING_SUPPORT_APPEND_ONLY_RECORD');
    expect(sql).toContain('prepared_by_principal_id <> approved_by_principal_id');
    expect(sql).toContain("classification text NOT NULL DEFAULT 'CARE-C3'");
    expect(sql).toContain('minimum_payload jsonb');
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('HAVING count(*) >= 5');
    expect(sql).toContain("'202607290206_CARE-01_learning_support'");
    expect(sql).not.toMatch(/REFERENCES\s+academics\./i);
    expect(sql).not.toMatch(/ALTER TABLE\s+(people|billing|ledger|integration|academics|hr)\./i);
    expect(sql).not.toContain('BYPASSRLS');
    expect(sql).not.toContain('GRANT DELETE');
  });
});
