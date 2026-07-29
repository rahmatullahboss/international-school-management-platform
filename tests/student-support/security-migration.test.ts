import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/safeguarding/migrations/202607290201_CARE-01_security_contract.sql',
  import.meta.url,
);

describe('CARE security migration contract', () => {
  test('uses only a CARE-owned schema, forced RLS and append-only access evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS safeguarding');
    expect(sql).toContain('GRANT USAGE ON SCHEMA safeguarding TO app_runtime');
    expect(sql.match(/FORCE ROW LEVEL SECURITY/g)).toHaveLength(4);
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('CREATE POLICY care_access_evidence_select');
    expect(sql).toContain('CREATE POLICY care_access_evidence_insert');
    expect(sql).not.toContain('FOR SELECT, INSERT');
    expect(sql).toContain(
      'REVOKE UPDATE, DELETE ON safeguarding.access_evidence FROM app_runtime',
    );
    expect(sql).toContain('GRANT SELECT, INSERT ON safeguarding.access_evidence TO app_runtime');
    expect(sql).toContain("'202607290201_CARE-01_security_contract'");
    expect(sql).not.toMatch(/ALTER TABLE\s+(people|billing|ledger|integration|hr|academics)\./i);
    expect(sql).not.toContain('BYPASSRLS');
  });
});
