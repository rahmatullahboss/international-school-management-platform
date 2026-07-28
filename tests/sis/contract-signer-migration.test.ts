import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/admissions/migrations/202607280106_SIS-01_contract_signer.sql',
  import.meta.url,
);

describe('SIS contract signer migration', () => {
  it('adds accountable account and optional person signer evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('signed_by_account_id uuid');
    expect(sql).toContain('signed_by_person_id uuid');
    expect(sql).toContain('REFERENCES iam.account (account_id)');
    expect(sql).toContain('REFERENCES people.person (tenant_id, person_id)');
  });

  it('requires account and timestamp for signed contracts and records the migration', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain("status <> 'signed'");
    expect(sql).toContain('signed_at IS NOT NULL');
    expect(sql).toContain('signed_by_account_id IS NOT NULL');
    expect(sql).toContain('NOT VALID');
    expect(sql).toContain('VALIDATE CONSTRAINT enrollment_contract_signer_required');
    expect(sql).toContain("'202607280106_SIS-01_contract_signer'");
  });
});
