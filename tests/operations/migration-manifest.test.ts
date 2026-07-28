import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

interface MigrationManifestEntry {
  readonly sequence: number;
  readonly migrationId: string;
  readonly path: string;
  readonly schemas: readonly string[];
}

interface MigrationManifest {
  readonly stream: string;
  readonly orderedMigrations: readonly MigrationManifestEntry[];
}

const manifestUrl = new URL(
  '../../docs/modules/operations/migration-manifest.json',
  import.meta.url,
);

async function loadManifest(): Promise<MigrationManifest> {
  return JSON.parse(await readFile(manifestUrl, 'utf8')) as MigrationManifest;
}

describe('OPS migration manifest', () => {
  it('defines a unique contiguous ordered migration sequence', async () => {
    const manifest = await loadManifest();
    expect(manifest.stream).toBe('OPS-01');
    expect(manifest.orderedMigrations.map((entry) => entry.sequence)).toEqual([
      201, 202, 203, 204, 205, 206, 207,
    ]);
    expect(new Set(manifest.orderedMigrations.map((entry) => entry.migrationId)).size).toBe(
      manifest.orderedMigrations.length,
    );
    expect(new Set(manifest.orderedMigrations.map((entry) => entry.path)).size).toBe(
      manifest.orderedMigrations.length,
    );
  });

  it('points to migrations that register OPS ownership and force tenant RLS', async () => {
    const manifest = await loadManifest();
    for (const entry of manifest.orderedMigrations) {
      const migrationUrl = new URL(`../../${entry.path}`, import.meta.url);
      const sql = await readFile(migrationUrl, 'utf8');
      expect(sql).toContain(entry.migrationId);
      expect(sql).toContain("'OPS-01'");
      expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    }
  });

  it('covers every owned operations schema exactly once in replay metadata', async () => {
    const manifest = await loadManifest();
    expect(manifest.orderedMigrations.flatMap((entry) => entry.schemas).sort()).toEqual([
      'activities',
      'asset',
      'cafeteria',
      'hostel',
      'hr',
      'inventory',
      'library',
      'procurement',
      'transport',
    ]);
  });
});
