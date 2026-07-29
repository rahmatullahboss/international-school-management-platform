import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../packages/modules/hr/migrations/202607280201_OPS-01_hr_staff.sql',
  import.meta.url,
);

describe('OPS HR migration', () => {
  it('creates the owned HR schema and complete core tables', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS hr');
    for (const table of [
      'staff_profile',
      'employment_contract',
      'leave_request',
      'staff_attendance',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS hr.${table}`);
    }
    expect(sql).not.toContain('REFERENCES people.');
    expect(sql).not.toContain('REFERENCES finance.');
  });

  it('forces tenant RLS and grants only the runtime role', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('ALTER TABLE hr.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE hr.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('TO app_runtime');
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
  });

  it('registers the migration as OPS-01', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain("'202607280201_OPS-01_hr_staff'");
    expect(sql).toContain("'OPS-01'");
  });
});
