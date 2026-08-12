#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
SECURITY_MANIFEST="infra/database/production-security-migration-manifest.json"

mapfile -t security_migrations < <(
  node --input-type=module - "$SECURITY_MANIFEST" <<'NODE'
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.gate !== 'GATE-PROD-SECURITY-DEFINER-HYGIENE-V1') {
  throw new Error(`unexpected production security gate: ${manifest.gate}`);
}
if (manifest.baseManifest !== 'infra/database/production-readiness-migration-manifest.json') {
  throw new Error('production security manifest must extend the reviewed production-readiness manifest');
}
const migrations = manifest.migrations ?? [];
if (migrations.length !== 1) {
  throw new Error(`expected one production security migration, got ${migrations.length}`);
}
const migration = migrations[0];
if (migration.order !== 1 || migration.stream !== 'PROD-08') {
  throw new Error('production security migration order/stream is invalid');
}
if (!existsSync(migration.path)) throw new Error(`missing migration: ${migration.path}`);
console.log(migration.path);
NODE
)

pre_migration_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration;")"
pre_prod08_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-08';")"
if [[ "$pre_migration_count" == "62" && "$pre_prod08_count" == "0" ]]; then
  :
elif [[ "$pre_migration_count" == "63" && "$pre_prod08_count" == "1" ]]; then
  :
else
  echo "SECURITY DEFINER hygiene audit requires the reviewed 62-migration readiness database or the exact 63-migration PROD-08 state; found total=${pre_migration_count}, PROD-08=${pre_prod08_count}." >&2
  exit 1
fi

for migration in "${security_migrations[@]}"; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done

migration_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration;")"
prod08_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-08';")"
if [[ "$migration_count" != "63" || "$prod08_count" != "1" ]]; then
  echo "SECURITY DEFINER hygiene audit requires exact PROD-08 migration state; found total=${migration_count}, PROD-08=${prod08_count}." >&2
  exit 1
fi

AUDIT_SQL=$(cat <<'SQL'
WITH security_definer AS (
  SELECT
    callable.oid,
    namespace.nspname AS schema_name,
    callable.proname AS function_name,
    pg_get_function_identity_arguments(callable.oid) AS identity_arguments,
    callable.proacl,
    callable.proowner,
    callable.proconfig,
    (
      SELECT setting
      FROM unnest(coalesce(callable.proconfig, ARRAY[]::text[])) AS setting
      WHERE split_part(setting, '=', 1) = 'search_path'
      LIMIT 1
    ) AS search_path_setting
  FROM pg_proc AS callable
  JOIN pg_namespace AS namespace ON namespace.oid = callable.pronamespace
  WHERE callable.prosecdef
    AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND namespace.nspname NOT LIKE 'pg_temp_%'
    AND namespace.nspname NOT LIKE 'pg_toast_temp_%'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend AS dependency
      WHERE dependency.classid = 'pg_proc'::regclass
        AND dependency.objid = callable.oid
        AND dependency.deptype = 'e'
    )
), violations AS (
  SELECT
    'public-execute'::text AS reason,
    schema_name,
    function_name,
    identity_arguments
  FROM security_definer
  WHERE EXISTS (
    SELECT 1
    FROM aclexplode(coalesce(proacl, acldefault('f', proowner))) AS privilege
    WHERE privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  )

  UNION ALL

  SELECT
    'missing-search-path',
    schema_name,
    function_name,
    identity_arguments
  FROM security_definer
  WHERE search_path_setting IS NULL

  UNION ALL

  SELECT
    'unsafe-search-path',
    schema_name,
    function_name,
    identity_arguments
  FROM security_definer
  WHERE search_path_setting IS NOT NULL
    AND regexp_replace(split_part(search_path_setting, '=', 2), '\s+', '', 'g')
      !~ '^pg_catalog(,|$)'

  UNION ALL

  SELECT
    'public-schema-security-definer',
    schema_name,
    function_name,
    identity_arguments
  FROM security_definer
  WHERE schema_name = 'public'
)
SELECT
  reason || '|' || format('%I.%I(%s)', schema_name, function_name, identity_arguments)
FROM violations
ORDER BY reason, schema_name, function_name, identity_arguments;
SQL
)

violations="$("${PSQL[@]}" -Atqc "$AUDIT_SQL")"
if [[ -n "$violations" ]]; then
  echo "System-wide SECURITY DEFINER hygiene violations:" >&2
  printf '%s\n' "$violations" | head -n 40 >&2
  exit 1
fi

self_test_output="$("${PSQL[@]}" -Atq <<SQL
BEGIN;
CREATE SCHEMA security_hygiene_selftest;

CREATE FUNCTION security_hygiene_selftest.public_execute_case()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, security_hygiene_selftest
AS 'SELECT 1';

CREATE FUNCTION security_hygiene_selftest.missing_search_path_case()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS 'SELECT 1';
REVOKE ALL ON FUNCTION security_hygiene_selftest.missing_search_path_case() FROM PUBLIC;

CREATE FUNCTION security_hygiene_selftest.unsafe_search_path_case()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = security_hygiene_selftest, pg_catalog
AS 'SELECT 1';
REVOKE ALL ON FUNCTION security_hygiene_selftest.unsafe_search_path_case() FROM PUBLIC;

CREATE FUNCTION public.security_hygiene_public_schema_case()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.security_hygiene_public_schema_case() FROM PUBLIC;

$AUDIT_SQL
ROLLBACK;
SQL
)"

for expected in \
  'public-execute|security_hygiene_selftest.public_execute_case()' \
  'missing-search-path|security_hygiene_selftest.missing_search_path_case()' \
  'unsafe-search-path|security_hygiene_selftest.unsafe_search_path_case()' \
  'public-schema-security-definer|public.security_hygiene_public_schema_case()'
do
  if ! grep -Fqx "$expected" <<<"$self_test_output"; then
    echo "SECURITY DEFINER hygiene self-test did not detect: ${expected}" >&2
    printf '%s\n' "$self_test_output" >&2
    exit 1
  fi
done

self_test_residue="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM pg_namespace WHERE nspname='security_hygiene_selftest'; SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='security_hygiene_public_schema_case';")"
if [[ "$self_test_residue" != $'0\n0' ]]; then
  echo "SECURITY DEFINER hygiene self-test left database residue" >&2
  exit 1
fi

echo "System-wide SECURITY DEFINER hygiene verification passed."
