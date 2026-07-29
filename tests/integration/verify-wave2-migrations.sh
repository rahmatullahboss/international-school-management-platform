#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
MANIFEST="infra/database/migration-manifest.json"

mapfile -t migrations < <(
  node --input-type=module - "$MANIFEST" <<'NODE'
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const migrations = manifest.migrations ?? [];

if (manifest.gate !== 'GATE-WAVE-2-INTEGRATED') {
  throw new Error(`unexpected manifest gate: ${manifest.gate}`);
}
if (migrations.length !== 40) {
  throw new Error(`expected 40 canonical migrations, got ${migrations.length}`);
}

const orders = migrations.map((migration) => migration.order);
const ids = migrations.map((migration) => migration.id);
const paths = migrations.map((migration) => migration.path);
const expectedOrders = Array.from({ length: migrations.length }, (_, index) => index + 1);

if (JSON.stringify(orders) !== JSON.stringify(expectedOrders)) {
  throw new Error('migration orders are not contiguous');
}
if (new Set(ids).size !== ids.length) throw new Error('duplicate migration id');
if (new Set(paths).size !== paths.length) throw new Error('duplicate migration path');
for (const migrationPath of paths) {
  if (!existsSync(migrationPath)) throw new Error(`missing migration: ${migrationPath}`);
  console.log(migrationPath);
}
NODE
)

for migration in "${migrations[@]}"; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done

"${PSQL[@]}" -At <<'SQL'
DO $verification$
DECLARE
  expected_counts jsonb := '{"FND-01":5,"SIS-01":6,"FIN-01":4,"INT-01":7,"ACAD-01":5,"OPS-01":7,"CARE-01":6}'::jsonb;
  expected_schemas text[] := ARRAY[
    'academics', 'scheduling', 'attendance', 'gradebook', 'records',
    'hr', 'procurement', 'inventory', 'asset', 'library', 'transport',
    'hostel', 'cafeteria', 'activities', 'health', 'behavior',
    'wellbeing', 'safeguarding', 'learning_support'
  ];
  stream_name text;
  expected_count integer;
  actual_count integer;
  missing_schema_count integer;
  empty_schema_count integer;
  unprotected_table_count integer;
BEGIN
  IF (SELECT count(*) FROM platform.schema_migration) <> 40 THEN
    RAISE EXCEPTION 'expected 40 migration ledger rows, got %',
      (SELECT count(*) FROM platform.schema_migration);
  END IF;

  FOR stream_name, expected_count IN
    SELECT key, value::text::integer FROM jsonb_each(expected_counts)
  LOOP
    SELECT count(*) INTO actual_count
    FROM platform.schema_migration
    WHERE stream_id = stream_name;

    IF actual_count <> expected_count THEN
      RAISE EXCEPTION 'expected % migrations for %, got %',
        expected_count, stream_name, actual_count;
    END IF;
  END LOOP;

  SELECT count(*) INTO missing_schema_count
  FROM unnest(expected_schemas) AS expected(schema_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = expected.schema_name
  );

  IF missing_schema_count <> 0 THEN
    RAISE EXCEPTION 'missing % Wave 2 schemas', missing_schema_count;
  END IF;

  SELECT count(*) INTO empty_schema_count
  FROM unnest(expected_schemas) AS expected(schema_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = expected.schema_name AND c.relkind = 'r'
  );

  IF empty_schema_count <> 0 THEN
    RAISE EXCEPTION '% Wave 2 schemas contain no ordinary tables', empty_schema_count;
  END IF;

  SELECT count(*) INTO unprotected_table_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname = ANY(expected_schemas)
    AND (
      NOT c.relrowsecurity
      OR NOT c.relforcerowsecurity
      OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
    );

  IF unprotected_table_count <> 0 THEN
    RAISE EXCEPTION '% Wave 2 tables are missing forced RLS or policies',
      unprotected_table_count;
  END IF;
END
$verification$;

SELECT json_build_object(
  'migration_count', (SELECT count(*) FROM platform.schema_migration),
  'acad_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'ACAD-01'),
  'ops_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'OPS-01'),
  'care_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'CARE-01'),
  'wave2_protected_tables', (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = ANY(ARRAY[
        'academics', 'scheduling', 'attendance', 'gradebook', 'records',
        'hr', 'procurement', 'inventory', 'asset', 'library', 'transport',
        'hostel', 'cafeteria', 'activities', 'health', 'behavior',
        'wellbeing', 'safeguarding', 'learning_support'
      ])
      AND c.relrowsecurity
      AND c.relforcerowsecurity
      AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
  )
);
SQL
