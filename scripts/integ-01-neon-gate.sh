#!/usr/bin/env bash
set -euo pipefail

mode="${1:-apply}"
case "$mode" in
  apply|verify|replay-database) ;;
  *) echo "Unsupported INTEG-01 Neon gate mode: $mode" >&2; exit 2 ;;
esac

: "${DATABASE_URL:?DATABASE_URL is required}"
readonly EXPECTED_PROJECT_ID="lingering-brook-52999532"
readonly EXPECTED_BRANCH_ID="${NEON_EXPECTED_BRANCH_ID:-br-shiny-silence-axznuy37}"
readonly MANIFEST="infra/database/migration-manifest.json"
psql_base=(psql "$DATABASE_URL" -X --no-psqlrc -v ON_ERROR_STOP=1)

replace_database_name() {
  python3 - "$1" "$2" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
url = urlsplit(sys.argv[1])
print(urlunsplit((url.scheme, url.netloc, '/' + sys.argv[2], url.query, url.fragment)))
PY
}

manifest_entries() {
  python3 - "$MANIFEST" <<'PY'
import json, sys
manifest = json.load(open(sys.argv[1], encoding='utf-8'))
for item in manifest['migrations']:
    print(f"{item['id']}|{item['stream']}|{item['path']}")
PY
}

assert_branch_identity() {
  local url="$1" actual_project actual_branch
  actual_project=$(psql "$url" -X --no-psqlrc -Atc "SELECT COALESCE(current_setting('neon.project_id', true), '')")
  actual_branch=$(psql "$url" -X --no-psqlrc -Atc "SELECT COALESCE(current_setting('neon.branch_id', true), '')")
  [[ "$actual_project" == "$EXPECTED_PROJECT_ID" ]] || { echo "Unexpected Neon project: $actual_project" >&2; exit 1; }
  [[ "$actual_branch" == "$EXPECTED_BRANCH_ID" ]] || { echo "Unexpected Neon branch: $actual_branch" >&2; exit 1; }
}

migration_exists() {
  local url="$1" id="$2" ledger
  ledger=$(psql "$url" -X --no-psqlrc -Atc "SELECT to_regclass('platform.schema_migration') IS NOT NULL")
  [[ "$ledger" == "t" ]] || return 1
  psql "$url" -X --no-psqlrc -Atc "SELECT count(*) FROM platform.schema_migration WHERE migration_id = '$id'" | grep -qx '1'
}

apply_manifest() {
  local url="$1" entry id stream file
  while IFS= read -r entry; do
    id="${entry%%|*}"
    stream="${entry#*|}"; stream="${stream%%|*}"
    file="${entry##*|}"
    [[ -f "$file" ]] || { echo "Missing migration file: $file" >&2; exit 1; }
    if migration_exists "$url" "$id"; then
      echo "skip $id"
      continue
    fi
    echo "apply $id ($stream)"
    psql "$url" -X --no-psqlrc -v ON_ERROR_STOP=1 --single-transaction -f "$file" >/dev/null
  done < <(manifest_entries)
}

verify_manifest() {
  local url="$1" expected actual missing
  expected=$(python3 - "$MANIFEST" <<'PY'
import json, sys
print(len(json.load(open(sys.argv[1], encoding='utf-8'))['migrations']))
PY
)
  actual=$(psql "$url" -X --no-psqlrc -Atc "SELECT count(*) FROM platform.schema_migration WHERE stream_id IN ('FND-01','SIS-01','FIN-01','INT-01')")
  [[ "$actual" == "$expected" ]] || { echo "Migration ledger count mismatch: expected=$expected actual=$actual" >&2; exit 1; }

  missing=$(python3 - "$MANIFEST" <<'PY' | psql "$url" -X --no-psqlrc -At
import json, sys
ids = [m['id'].replace("'", "''") for m in json.load(open(sys.argv[1], encoding='utf-8'))['migrations']]
values = ','.join("('" + item + "')" for item in ids)
print(f"WITH expected(id) AS (VALUES {values}) SELECT id FROM expected EXCEPT SELECT migration_id FROM platform.schema_migration ORDER BY id;")
PY
)
  [[ -z "$missing" ]] || { echo "Missing migrations: $missing" >&2; exit 1; }

  psql "$url" -X --no-psqlrc -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $verify$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
      )
  LOOP
    IF NOT item.relrowsecurity OR NOT item.relforcerowsecurity THEN
      RAISE EXCEPTION 'tenant table %.% is missing forced RLS', item.schema_name, item.table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = item.schema_name
        AND p.tablename = item.table_name
        AND 'app_runtime' = ANY (p.roles)
    ) THEN
      RAISE EXCEPTION 'tenant table %.% has no app_runtime policy', item.schema_name, item.table_name;
    END IF;
  END LOOP;

  IF to_regprocedure('ledger.post_journal_entry(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'finance journal posting function missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journal_entry_immutable_when_posted' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'finance posted-journal immutability trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journal_line_immutable_when_posted' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'finance posted-line immutability trigger missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM ledger.journal_entry e
    LEFT JOIN ledger.journal_line l
      ON l.tenant_id = e.tenant_id
     AND l.legal_entity_id = e.legal_entity_id
     AND l.journal_entry_id = e.journal_entry_id
    WHERE e.status = 'posted'
    GROUP BY e.tenant_id, e.legal_entity_id, e.journal_entry_id
    HAVING COALESCE(sum(l.amount_minor) FILTER (WHERE l.side = 'debit'), 0)
        <> COALESCE(sum(l.amount_minor) FILTER (WHERE l.side = 'credit'), 0)
  ) THEN
    RAISE EXCEPTION 'unbalanced posted journal detected';
  END IF;
END
$verify$;
SQL

  psql "$url" -X --no-psqlrc -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
BEGIN;
INSERT INTO platform.tenant (tenant_id, slug, display_name, home_region, deployment_profile, database_binding, provisioning_status)
VALUES
 ('00000000-0000-4000-8000-00000000a101', 'integ-probe-a', 'Integration Probe A', 'test', 'regional-pooled', 'probe-a', 'database-ready'),
 ('00000000-0000-4000-8000-00000000b202', 'integ-probe-b', 'Integration Probe B', 'test', 'regional-pooled', 'probe-b', 'database-ready')
ON CONFLICT (tenant_id) DO NOTHING;
INSERT INTO tenancy.isolation_probe (tenant_id, label)
VALUES
 ('00000000-0000-4000-8000-00000000a101', 'visible-a'),
 ('00000000-0000-4000-8000-00000000b202', 'hidden-b');
SET LOCAL ROLE app_runtime;
SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-00000000a101', true);
DO $probe$
BEGIN
  IF (SELECT count(*) FROM tenancy.isolation_probe WHERE tenant_id = '00000000-0000-4000-8000-00000000b202') <> 0 THEN
    RAISE EXCEPTION 'cross-tenant read became visible';
  END IF;
  BEGIN
    INSERT INTO tenancy.isolation_probe (tenant_id, label)
    VALUES ('00000000-0000-4000-8000-00000000b202', 'forbidden');
    RAISE EXCEPTION 'cross-tenant write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;
SQL

  echo "Wave 1 database verification: PASS ($actual migrations)"
}

replay_database() {
  local replay_db="integ01_replay_${RANDOM}_$$" replay_url
  createdb --maintenance-db="$DATABASE_URL" "$replay_db"
  replay_url=$(replace_database_name "$DATABASE_URL" "$replay_db")
  cleanup() {
    "${psql_base[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$replay_db' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
    dropdb --maintenance-db="$DATABASE_URL" --if-exists "$replay_db" >/dev/null 2>&1 || true
  }
  trap cleanup EXIT
  apply_manifest "$replay_url"
  verify_manifest "$replay_url"
  cleanup
  trap - EXIT
  echo "Disposable recovery replay: PASS"
}

assert_branch_identity "$DATABASE_URL"
case "$mode" in
  apply) apply_manifest "$DATABASE_URL"; verify_manifest "$DATABASE_URL" ;;
  verify) verify_manifest "$DATABASE_URL" ;;
  replay-database) replay_database ;;
esac
