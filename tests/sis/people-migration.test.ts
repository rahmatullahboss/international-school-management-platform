import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/people/migrations/202607280101_SIS-01_people.sql',
  import.meta.url,
);

describe('SIS people migration', () => {
  it('declares the complete people and authority table set', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const table of [
      'person',
      'person_name',
      'person_identifier',
      'contact_point',
      'postal_address',
      'person_address',
      'household',
      'household_member',
      'person_relationship',
      'guardian_student_authority',
      'emergency_contact_authority',
      'authorized_pickup',
      'communication_preference',
      'consent_record',
      'person_document',
      'duplicate_candidate',
      'person_merge_record',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS people.${table}`);
    }
  });

  it('forces tenant RLS and records the migration ledger entry', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE people.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain("'202607280101_SIS-01_people'");
    expect(sql).toContain("'SIS-01'");
  });
});
