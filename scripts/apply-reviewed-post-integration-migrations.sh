#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

psql_cmd=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1)

if ! "${psql_cmd[@]}" -Atqc "SELECT to_regclass('platform.schema_migration') IS NOT NULL" | grep -qx 't'; then
  echo 'platform.schema_migration is missing; refusing post-integration migration apply.' >&2
  exit 1
fi

base_count=$("${psql_cmd[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration")
if [[ "$base_count" -lt 40 ]]; then
  echo "Only ${base_count} schema migrations are present; expected the reviewed 40-migration canonical base." >&2
  exit 1
fi

mapfile -t migration_paths < <(
  node -e "const fs=require('node:fs'); const manifest=JSON.parse(fs.readFileSync('infra/database/post-integration-migration-manifest.json','utf8')); for (const migration of manifest.migrations) console.log(migration.path);"
)

if [[ "${#migration_paths[@]}" -ne 13 ]]; then
  echo "Expected 13 reviewed post-integration migrations, found ${#migration_paths[@]}." >&2
  exit 1
fi

for migration_path in "${migration_paths[@]}"; do
  if [[ ! -f "$migration_path" ]]; then
    echo "Missing reviewed migration: $migration_path" >&2
    exit 1
  fi
  echo "Applying $migration_path"
  "${psql_cmd[@]}" -f "$migration_path"
done

ledger_count=$("${psql_cmd[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration")
if [[ "$ledger_count" -ne 53 ]]; then
  echo "Expected 53 migration ledger entries after apply, found ${ledger_count}." >&2
  exit 1
fi

echo 'Reviewed post-integration migration apply complete: 53 ledger entries.'
