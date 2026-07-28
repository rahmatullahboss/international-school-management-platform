import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../packages/modules/people/migrations/202607280105_SIS-01_operations.sql',
  import.meta.url,
);

describe('SIS operations migration', () => {
  it('creates import, quality, export, report and reconciliation records', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const table of [
      'people.import_batch',
      'people.import_row',
      'people.data_quality_issue',
      'people.export_audit',
      'student_lifecycle.report_snapshot',
      'student_lifecycle.reconciliation_run',
      'student_lifecycle.reconciliation_issue',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('forces tenant RLS, immutable report snapshots and migration-ledger evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("current_setting(''app.tenant_id'', true)");
    expect(sql).toContain('report snapshots are immutable');
    expect(sql).toContain("'202607280105_SIS-01_operations'");
  });
});
