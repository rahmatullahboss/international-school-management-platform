#!/usr/bin/env bash
set -euo pipefail

mode="${1:-inspect}"
case "$mode" in
  inspect|apply|replay-database) ;;
  *)
    echo "Unsupported INT-01 Neon gate mode: $mode" >&2
    exit 2
    ;;
esac

readonly EXPECTED_NEON_PROJECT_ID="lingering-brook-52999532"
readonly EXPECTED_NEON_BRANCH_ID="br-super-truth-axp0urxi"
readonly EXPECTED_NEON_DATABASE_NAME="neondb"
readonly EXPECTED_NEON_ROLE_NAME="neondb_owner"

resolve_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return
  fi

  if [[ -z "${NEON_API_KEY:-}" ]]; then
    echo "DATABASE_URL or NEON_API_KEY is required" >&2
    exit 1
  fi

  local response
  response=$(curl --fail --silent --show-error \
    --header "Authorization: Bearer $NEON_API_KEY" \
    --get "https://console.neon.tech/api/v2/projects/$EXPECTED_NEON_PROJECT_ID/connection_uri" \
    --data-urlencode "branch_id=$EXPECTED_NEON_BRANCH_ID" \
    --data-urlencode "database_name=$EXPECTED_NEON_DATABASE_NAME" \
    --data-urlencode "role_name=$EXPECTED_NEON_ROLE_NAME" \
    --data-urlencode "pooled=false")

  DATABASE_URL=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("uri", ""))' <<<"$response")
  unset response

  if [[ -z "$DATABASE_URL" ]]; then
    echo "Neon API response did not contain a connection URI" >&2
    exit 1
  fi

  export DATABASE_URL
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::add-mask::$DATABASE_URL"
  fi
  echo "Resolved Neon connection for project=$EXPECTED_NEON_PROJECT_ID branch=$EXPECTED_NEON_BRANCH_ID"
}

resolve_database_url

psql_base=(psql "$DATABASE_URL" -X --no-psqlrc -v ON_ERROR_STOP=1)

foundation_ids=(
  202607280001_FND-01_foundation
  202607280002_FND-01_tenancy
  202607280003_FND-01_identity_policy
  202607280004_FND-01_transactional_primitives
  202607280005_FND-01_shared_services
)

int_migrations=(
  "202607280101_INT-01_country_pack_engine|packages/modules/country-packs/migrations/202607280101_INT-01_country_pack_engine.sql"
  "202607280102_INT-01_integration_runtime|packages/modules/integrations/migrations/202607280102_INT-01_integration_runtime.sql"
  "202607280103_INT-01_import_export|packages/modules/integrations/migrations/202607280103_INT-01_import_export.sql"
  "202607280104_INT-01_migration_studio|packages/modules/migration-studio/migrations/202607280104_INT-01_migration_studio.sql"
  "202607280105_INT-01_oneroster_profile|packages/modules/integrations/migrations/202607280105_INT-01_oneroster_profile.sql"
  "202607280106_INT-01_lti_sso_scim|packages/modules/integrations/migrations/202607280106_INT-01_lti_sso_scim.sql"
  "202607280107_INT-01_connector_governance|packages/modules/integrations/migrations/202607280107_INT-01_connector_governance.sql"
)

foundation_migrations=(
  "202607280001_FND-01_foundation|infra/database/migrations/202607280001_FND-01_foundation.sql"
  "202607280002_FND-01_tenancy|infra/database/migrations/202607280002_FND-01_tenancy.sql"
  "202607280003_FND-01_identity_policy|infra/database/migrations/202607280003_FND-01_identity_policy.sql"
  "202607280004_FND-01_transactional_primitives|infra/database/migrations/202607280004_FND-01_transactional_primitives.sql"
  "202607280005_FND-01_shared_services|infra/database/migrations/202607280005_FND-01_shared_services.sql"
)

migration_exists() {
  local id="$1"
  "${psql_base[@]}" -Atc "SELECT count(*) FROM platform.schema_migration WHERE migration_id = '$id'" | grep -qx '1'
}

print_connection_identity() {
  local endpoint_id
  endpoint_id=$(python3 - "$DATABASE_URL" <<'PY'
import sys
from urllib.parse import urlsplit
host = urlsplit(sys.argv[1]).hostname or ''
print(host.split('.')[0] if host else 'unknown')
PY
)
  echo "endpoint_id=$endpoint_id"
  "${psql_base[@]}" -Atc "SELECT 'database=' || current_database(), 'role=' || current_user"
  "${psql_base[@]}" -Atc "SELECT 'neon.branch_id=' || COALESCE(current_setting('neon.branch_id', true), ''), 'neon.project_id=' || COALESCE(current_setting('neon.project_id', true), '')"
}

require_agent_branch_identity() {
  local actual_project_id actual_branch_id
  actual_project_id=$("${psql_base[@]}" -Atc "SELECT COALESCE(current_setting('neon.project_id', true), '')")
  actual_branch_id=$("${psql_base[@]}" -Atc "SELECT COALESCE(current_setting('neon.branch_id', true), '')")

  if [[ "$actual_project_id" != "$EXPECTED_NEON_PROJECT_ID" ]]; then
    echo "Configured database belongs to unexpected Neon project: $actual_project_id" >&2
    exit 1
  fi
  if [[ "$actual_branch_id" != "$EXPECTED_NEON_BRANCH_ID" ]]; then
    echo "Configured database belongs to unexpected Neon branch: $actual_branch_id" >&2
    exit 1
  fi
}

require_agent_branch_baseline() {
  local schema_exists
  schema_exists=$("${psql_base[@]}" -Atc "SELECT to_regclass('platform.schema_migration') IS NOT NULL")
  if [[ "$schema_exists" != "t" ]]; then
    echo "Configured database is not foundation-ready: platform.schema_migration is missing" >&2
    exit 1
  fi

  local missing=()
  local id
  for id in "${foundation_ids[@]}" 202607280101_INT-01_country_pack_engine; do
    if ! migration_exists "$id"; then
      missing+=("$id")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    printf 'Configured database is not the expected INT-01 baseline; missing migrations: %s\n' "${missing[*]}" >&2
    exit 1
  fi
}

print_inspection() {
  echo "INT-01 Neon inspection"
  "${psql_base[@]}" -Atc "SELECT 'database=' || current_database(), 'role=' || current_user"
  "${psql_base[@]}" -Atc "SELECT migration_id FROM platform.schema_migration WHERE migration_id LIKE '2026072800%FND-01%' OR migration_id LIKE '2026072801%INT-01%' ORDER BY migration_id"
  "${psql_base[@]}" -Atc "SELECT 'schemas=' || string_agg(schema_name, ',') FROM (SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('country_pack','integration','migration_studio') ORDER BY schema_name) AS schemas"
  "${psql_base[@]}" -Atc "SELECT 'tenant_tables=' || count(*) || ',forced_rls=' || count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname IN ('country_pack','integration','migration_studio') AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped)"
}

apply_migration_set() {
  local connection_url="$1"
  shift
  local migrations=("$@")
  local entry id file exists
  for entry in "${migrations[@]}"; do
    id="${entry%%|*}"
    file="${entry#*|}"
    exists=$(psql "$connection_url" -X --no-psqlrc -v ON_ERROR_STOP=1 -Atc "SELECT CASE WHEN to_regclass('platform.schema_migration') IS NULL THEN 0 ELSE count(*) END FROM platform.schema_migration WHERE migration_id = '$id'" 2>/dev/null || true)
    if [[ "$exists" == "1" ]]; then
      echo "skip $id"
      continue
    fi
    echo "apply $id"
    psql "$connection_url" -X --no-psqlrc -v ON_ERROR_STOP=1 --single-transaction -f "$file" >/dev/null
  done
}

verify_structure() {
  "${psql_base[@]}" <<'SQL'
DO $verify$
DECLARE
  item record;
  expected_trigger record;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           c.relrowsecurity,
           c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN ('country_pack', 'integration', 'migration_studio')
      AND EXISTS (
        SELECT 1
        FROM pg_attribute a
        WHERE a.attrelid = c.oid
          AND a.attname = 'tenant_id'
          AND NOT a.attisdropped
      )
  LOOP
    IF NOT item.relrowsecurity OR NOT item.relforcerowsecurity THEN
      RAISE EXCEPTION 'tenant table %.% is missing forced RLS', item.schema_name, item.table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = item.schema_name
        AND p.tablename = item.table_name
        AND 'app_runtime' = ANY (p.roles)
    ) THEN
      RAISE EXCEPTION 'tenant table %.% has no app_runtime policy', item.schema_name, item.table_name;
    END IF;
  END LOOP;

  FOR expected_trigger IN
    SELECT * FROM (VALUES
      ('country_pack', 'manifest_release', 'released_manifest_immutable'),
      ('integration', 'api_spec', 'api_spec_immutable'),
      ('integration', 'disclosure_event', 'disclosure_event_append_only'),
      ('migration_studio', 'source_template', 'source_template_immutable'),
      ('integration', 'standard_profile', 'standard_profile_immutable'),
      ('integration', 'lti_launch_audit', 'lti_launch_audit_append_only'),
      ('integration', 'connector_manifest', 'connector_manifest_immutable')
    ) AS required(schema_name, table_name, trigger_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = expected_trigger.schema_name
        AND c.relname = expected_trigger.table_name
        AND t.tgname = expected_trigger.trigger_name
        AND NOT t.tgisinternal
    ) THEN
      RAISE EXCEPTION 'required trigger %.%.% is missing', expected_trigger.schema_name, expected_trigger.table_name, expected_trigger.trigger_name;
    END IF;
  END LOOP;
END
$verify$;
SQL
}

verify_tenant_isolation() {
  "${psql_base[@]}" <<'SQL'
BEGIN;
INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile, database_binding, provisioning_status
) VALUES
  ('00000000-0000-4000-8000-00000000a101', 'int-01-probe-a', 'INT-01 Probe A', 'test', 'regional-pooled', 'probe-a', 'database-ready'),
  ('00000000-0000-4000-8000-00000000b202', 'int-01-probe-b', 'INT-01 Probe B', 'test', 'regional-pooled', 'probe-b', 'database-ready');

INSERT INTO integration.connection (
  tenant_id, connection_id, connector_key, connector_version, display_name
) VALUES
  ('00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a111', 'probe', 1, 'Probe A'),
  ('00000000-0000-4000-8000-00000000b202', '00000000-0000-4000-8000-00000000b222', 'probe', 1, 'Probe B');

SET LOCAL ROLE app_runtime;
SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-00000000a101', true);

DO $probe$
DECLARE
  visible_other integer;
BEGIN
  SELECT count(*) INTO visible_other
  FROM integration.connection
  WHERE tenant_id = '00000000-0000-4000-8000-00000000b202';
  IF visible_other <> 0 THEN
    RAISE EXCEPTION 'cross-tenant row became visible';
  END IF;

  BEGIN
    INSERT INTO integration.connection (
      tenant_id, connection_id, connector_key, connector_version, display_name
    ) VALUES (
      '00000000-0000-4000-8000-00000000b202',
      '00000000-0000-4000-8000-00000000b223',
      'probe',
      1,
      'Forbidden Probe'
    );
    RAISE EXCEPTION 'cross-tenant write unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;
SQL
}

replay_in_fresh_database() {
  local replay_database="int01_replay_${GITHUB_RUN_ID:-local}_${GITHUB_RUN_ATTEMPT:-1}"
  replay_database=${replay_database//-/_}
  local replay_url stale_database

  while IFS= read -r stale_database; do
    [[ -z "$stale_database" ]] && continue
    echo "cleanup stale replay database: $stale_database"
    "${psql_base[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$stale_database' AND pid <> pg_backend_pid()" >/dev/null
    dropdb --maintenance-db="$DATABASE_URL" --if-exists "$stale_database"
  done < <("${psql_base[@]}" -Atc "SELECT datname FROM pg_database WHERE datname LIKE 'int01_replay_%' ORDER BY datname")

  createdb --maintenance-db="$DATABASE_URL" "$replay_database"
  replay_url=$(python3 - "$DATABASE_URL" "$replay_database" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
url = urlsplit(sys.argv[1])
print(urlunsplit((url.scheme, url.netloc, '/' + sys.argv[2], url.query, url.fragment)))
PY
)

  cleanup_replay() {
    "${psql_base[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$replay_database' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
    dropdb --maintenance-db="$DATABASE_URL" --if-exists "$replay_database" >/dev/null 2>&1 || true
  }
  trap cleanup_replay EXIT

  apply_migration_set "$replay_url" "${foundation_migrations[@]}"
  apply_migration_set "$replay_url" "${int_migrations[@]}"

  DATABASE_URL="$replay_url" bash "$0" apply
  cleanup_replay
  trap - EXIT
  echo "fresh database replay passed"
}

print_connection_identity
require_agent_branch_identity

if [[ "$mode" == "replay-database" ]]; then
  require_agent_branch_baseline
  replay_in_fresh_database
  exit 0
fi

require_agent_branch_baseline
print_inspection

if [[ "$mode" == "inspect" ]]; then
  exit 0
fi

apply_migration_set "$DATABASE_URL" "${int_migrations[@]:1}"

for entry in "${int_migrations[@]}"; do
  id="${entry%%|*}"
  if ! migration_exists "$id"; then
    echo "Migration verification failed: $id is absent" >&2
    exit 1
  fi
done

verify_structure
verify_tenant_isolation
npm run test:neon
print_inspection
echo "INT-01 Neon apply gate passed"
