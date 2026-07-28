import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'packages/modules/migration-studio/migrations/202607280104_INT-01_migration_studio.sql',
);

describe('migration studio migration', () => {
  test('creates project, version, checksum, run, reconciliation and cutover evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of [
      'source_template',
      'project',
      'project_version',
      'source_file',
      'run',
      'reconciliation',
      'cutover',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS migration_studio.${table}`);
    }
    expect(sql).toContain('UNIQUE (tenant_id, run_key)');
    expect(sql).toContain('configuration_checksum text NOT NULL');
    expect(sql).toContain('file_checksum text NOT NULL');
    expect(sql).toContain('rollback_plan text NOT NULL');
    expect(sql).toContain("'202607280104_INT-01_migration_studio'");
  });
});
