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

mapfile -t migration_entries < <(
  node -e "const fs=require('node:fs'); const manifest=JSON.parse(fs.readFileSync('infra/database/post-integration-migration-manifest.json','utf8')); const seen=new Set(); for (const migration of manifest.migrations) { if (!migration.id || !migration.path || seen.has(migration.id)) process.exit(2); seen.add(migration.id); console.log(migration.id + '\\t' + migration.path); }"
)

if [[ "${#migration_entries[@]}" -eq 0 ]]; then
  echo 'Post-integration migration manifest is empty.' >&2
  exit 1
fi

for migration_entry in "${migration_entries[@]}"; do
  IFS=$'\t' read -r migration_id migration_path <<< "$migration_entry"
  if [[ ! -f "$migration_path" ]]; then
    echo "Missing reviewed migration: $migration_path" >&2
    exit 1
  fi

  if "${psql_cmd[@]}" -Atq -v migration_id="$migration_id" -c \
    "SELECT EXISTS (SELECT 1 FROM platform.schema_migration WHERE migration_id = :'migration_id')" | grep -qx 't'; then
    echo "Already applied $migration_id"
    continue
  fi

  echo "Applying $migration_path"
  "${psql_cmd[@]}" --single-transaction -f "$migration_path"
done

missing_count=0
for migration_entry in "${migration_entries[@]}"; do
  IFS=$'\t' read -r migration_id _ <<< "$migration_entry"
  if ! "${psql_cmd[@]}" -Atq -v migration_id="$migration_id" -c \
    "SELECT EXISTS (SELECT 1 FROM platform.schema_migration WHERE migration_id = :'migration_id')" | grep -qx 't'; then
    echo "Reviewed migration ledger entry is missing after apply: $migration_id" >&2
    missing_count=$((missing_count + 1))
  fi
done

if [[ "$missing_count" -ne 0 ]]; then
  exit 1
fi

ledger_count=$("${psql_cmd[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration")
echo "Reviewed post-integration migration manifest verified; ${#migration_entries[@]} entries are present and the current ledger contains ${ledger_count} entries."
