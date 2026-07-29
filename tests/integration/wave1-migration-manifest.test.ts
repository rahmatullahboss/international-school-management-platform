import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

interface ManifestMigration {
  readonly order: number;
  readonly id: string;
  readonly stream:
    | 'FND-01'
    | 'SIS-01'
    | 'FIN-01'
    | 'INT-01'
    | 'ACAD-01'
    | 'OPS-01'
    | 'CARE-01';
  readonly path: string;
}

interface MigrationManifest {
  readonly program: string;
  readonly gate: string;
  readonly orderingRule: string;
  readonly migrations: readonly ManifestMigration[];
}

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, 'infra/database/migration-manifest.json'), 'utf8'),
) as MigrationManifest;

function sqlFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return sqlFiles(absolute);
    return entry.endsWith('.sql') ? [path.relative(root, absolute)] : [];
  });
}

describe('Wave 2 canonical migration manifest', () => {
  it('contains every reviewed migration exactly once in dependency-safe serial order', () => {
    const expectedFiles = [
      ...sqlFiles(path.join(root, 'infra/database/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/people/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/student-lifecycle/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/admissions/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/ledger/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/billing/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/country-packs/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/integrations/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/migration-studio/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/academics/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/scheduling/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/attendance/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/gradebook/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/records/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/hr/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/procurement/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/inventory-assets/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/library/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/transport/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/residential-catering/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/activities-trips/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/safeguarding/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/health/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/behavior/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/wellbeing/migrations')),
      ...sqlFiles(path.join(root, 'packages/modules/learning-support/migrations')),
    ].sort();
    const manifestFiles = manifest.migrations.map((migration) => migration.path).sort();

    expect(manifest.program).toBe('international-school-platform-v1');
    expect(manifest.gate).toBe('GATE-WAVE-2-INTEGRATED');
    expect(manifestFiles).toEqual(expectedFiles);
    expect(new Set(manifest.migrations.map((migration) => migration.id)).size).toBe(
      manifest.migrations.length,
    );
    expect(manifest.migrations.map((migration) => migration.order)).toEqual(
      Array.from({ length: manifest.migrations.length }, (_, index) => index + 1),
    );
    expect(manifest.migrations.map((migration) => migration.stream)).toEqual([
      ...Array<string>(5).fill('FND-01'),
      ...Array<string>(6).fill('SIS-01'),
      ...Array<string>(4).fill('FIN-01'),
      ...Array<string>(7).fill('INT-01'),
      ...Array<string>(5).fill('ACAD-01'),
      ...Array<string>(7).fill('OPS-01'),
      ...Array<string>(6).fill('CARE-01'),
    ]);
  });

  it('binds every manifest identifier to the matching immutable SQL ledger record', () => {
    for (const migration of manifest.migrations) {
      const sql = readFileSync(path.join(root, migration.path), 'utf8');
      expect(sql).toContain(`'${migration.id}'`);
      expect(sql).toContain(`'${migration.stream}'`);
      expect(sql).toMatch(/ON CONFLICT \(migration_id\) DO NOTHING;/u);
    }
  });
});
