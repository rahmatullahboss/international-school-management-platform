import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'packages/modules/integrations/migrations/202607280103_INT-01_import_export.sql',
);

describe('import/export migration', () => {
  test('creates versioned mappings, staged jobs, rows and reconciliation evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of ['import_mapping', 'import_job', 'import_row', 'export_job']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS integration.${table}`);
    }
    expect(sql).toContain('PRIMARY KEY (tenant_id, mapping_key, version)');
    expect(sql).toContain(
      'UNIQUE (tenant_id, source_checksum, mapping_key, mapping_version, mode)',
    );
    expect(sql).toContain('idempotency_key text NOT NULL');
    expect(sql).toContain('reconciliation jsonb NOT NULL');
    expect(sql).toContain("'202607280103_INT-01_import_export'");
  });
});
