import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'packages/modules/integrations/migrations/202607280102_INT-01_integration_runtime.sql',
);

describe('integration runtime migration', () => {
  test('creates tenant-scoped runtime, replay and disclosure tables', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS integration');
    for (const table of [
      'api_spec',
      'connection',
      'credential',
      'external_identifier',
      'webhook_subscription',
      'outbound_delivery',
      'inbound_receipt',
      'connection_health',
      'disclosure_event',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS integration.${table}`);
    }
    expect(sql).toContain('UNIQUE (tenant_id, connection_id, object_type, external_id)');
    expect(sql).toContain('UNIQUE (tenant_id, subscription_id, event_id)');
    expect(sql).toContain("'disclosure_event'");
    expect(sql).toContain('ALTER TABLE integration.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE TRIGGER disclosure_event_append_only');
    expect(sql).not.toMatch(/\bsecret\b/iu);
    expect(sql).toContain("'202607280102_INT-01_integration_runtime'");
  });
});
