import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'packages/modules/integrations/migrations/202607280107_INT-01_connector_governance.sql',
);

describe('connector governance migration', () => {
  test('creates immutable manifests, approval, sandbox, privacy and metric evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of [
      'connector_manifest',
      'connector_approval',
      'connector_sandbox_run',
      'connector_subprocessor',
      'connector_metric_bucket',
      'connector_alert',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS integration.${table}`);
    }
    expect(sql).toContain('reviewed_by text');
    expect(sql).toContain('sandbox_passed boolean');
    expect(sql).toContain('privacy_url text NOT NULL');
    expect(sql).toContain('dead_letter_count bigint NOT NULL');
    expect(sql).toContain('CREATE TRIGGER connector_manifest_immutable');
    expect(sql).toContain("'202607280107_INT-01_connector_governance'");
  });
});
