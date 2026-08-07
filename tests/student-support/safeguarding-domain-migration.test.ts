import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/safeguarding/migrations/202607290205_CARE-01_safeguarding_domain.sql',
  import.meta.url,
);

describe('CARE safeguarding domain migration contract', () => {
  test('forces tenant RLS, preserves append-only C4 history and suppresses tiny cohorts', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS safeguarding.concern_intake');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('CARE_SAFEGUARDING_APPEND_ONLY_RECORD');
    expect(sql).toContain('CARE_SAFEGUARDING_CASE_IDENTITY_IMMUTABLE');
    expect(sql).toContain("classification text NOT NULL DEFAULT 'CARE-C4'");
    expect(sql).toContain('requested_by_principal_id <> approved_by_principal_id');
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('HAVING count(*) >= 10');
    expect(sql).toContain("'202607290205_CARE-01_safeguarding_domain'");
    expect(sql).not.toMatch(/ALTER TABLE\s+(people|billing|ledger|integration|academics|hr)\./i);
    expect(sql).not.toContain('BYPASSRLS');
    expect(sql).not.toContain('GRANT DELETE');
  });
});
