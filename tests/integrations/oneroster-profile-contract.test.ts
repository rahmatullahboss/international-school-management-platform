import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { OneRosterCsvProfile } from '../../packages/modules/integrations/src/index.js';

const profilePath = path.join(
  process.cwd(),
  'packages/modules/integrations/profiles/oneroster-1.2-csv.json',
);
const migrationPath = path.join(
  process.cwd(),
  'packages/modules/integrations/migrations/202607280105_INT-01_oneroster_profile.sql',
);

describe('OneRoster profile artefacts', () => {
  test('keeps the runtime descriptor aligned with the supported-profile file', async () => {
    const file: unknown = JSON.parse(await readFile(profilePath, 'utf8'));
    const descriptor = new OneRosterCsvProfile().profile;

    expect(file).toMatchObject(descriptor);
    expect(file).toMatchObject({
      conformanceClaim: 'supported-subset',
      restExtensionStatus: 'contract-only',
    });
  });

  test('stores versioned profile and exchange validation evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of ['standard_profile', 'standard_exchange', 'standard_exchange_issue']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS integration.${table}`);
    }
    expect(sql).toContain('profile_document jsonb NOT NULL');
    expect(sql).toContain('source_checksum text NOT NULL');
    expect(sql).toContain('issue_code text NOT NULL');
    expect(sql).toContain("'202607280105_INT-01_oneroster_profile'");
  });
});
