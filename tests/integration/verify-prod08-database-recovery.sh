#!/usr/bin/env bash
set -euo pipefail

if [[ "${PROD08_RECOVERY_EPHEMERAL:-}" != "1" ]]; then
  echo "Refusing PROD-08 recovery rehearsal without PROD08_RECOVERY_EPHEMERAL=1." >&2
  exit 1
fi

umask 077

CALLER_DATABASE="${PGDATABASE:-postgres}"
SOURCE_DATABASE="school_prod08_source_${$}"
RESTORE_DATABASE="school_prod08_restore_${$}"
DUMP_DIRECTORY="$(mktemp -d)"
DUMP_FILE="${DUMP_DIRECTORY}/prod08-recovery.dump"

validate_temporary_database_name() {
  local database_name="$1"
  if [[ ! "$database_name" =~ ^school_prod08_(source|restore)_[0-9]+$ ]]; then
    echo "Refusing unsafe temporary database name: ${database_name}" >&2
    exit 1
  fi
  case "$database_name" in
    postgres|template0|template1|"$CALLER_DATABASE")
      echo "Refusing protected database name: ${database_name}" >&2
      exit 1
      ;;
  esac
}

validate_temporary_database_name "$SOURCE_DATABASE"
validate_temporary_database_name "$RESTORE_DATABASE"

MAINTENANCE_PSQL=(psql -X -v ON_ERROR_STOP=1 -d "$CALLER_DATABASE")

create_database() {
  local database_name="$1"
  validate_temporary_database_name "$database_name"
  "${MAINTENANCE_PSQL[@]}" -qc "CREATE DATABASE \"${database_name}\" TEMPLATE template0;"
}

drop_database() {
  local database_name="$1"
  validate_temporary_database_name "$database_name"
  "${MAINTENANCE_PSQL[@]}" -qc "DROP DATABASE IF EXISTS \"${database_name}\" WITH (FORCE);" || true
}

cleanup() {
  drop_database "$RESTORE_DATABASE"
  drop_database "$SOURCE_DATABASE"
  rm -rf "$DUMP_DIRECTORY"
}
trap cleanup EXIT

assert_prod08_security_contract() {
  local database_name="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$database_name" <<'SQL' >/dev/null
DO $prod08_recovery_contract$
DECLARE
  function_ids regprocedure[] := ARRAY[
    'billing.allocate_document_number(uuid,text,text)'::regprocedure,
    'ledger.post_journal_entry(uuid,text)'::regprocedure,
    'ledger.close_period(uuid,text)'::regprocedure,
    'ledger.reopen_period(uuid,text,text)'::regprocedure
  ];
  expected_paths text[] := ARRAY[
    'pg_catalog,billing,pg_temp',
    'pg_catalog,ledger,pg_temp',
    'pg_catalog,ledger,pg_temp',
    'pg_catalog,ledger,pg_temp'
  ];
  function_id regprocedure;
  configured_path text;
  index integer;
BEGIN
  IF (SELECT count(*) FROM platform.schema_migration) <> 63 THEN
    RAISE EXCEPTION 'expected exact 63-migration PROD-08 recovery state';
  END IF;
  IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-08') <> 1 THEN
    RAISE EXCEPTION 'expected exactly one PROD-08 migration ledger row';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM platform.schema_migration
    WHERE migration_id = '202608120801_PROD-08_security_definer_hygiene'
      AND stream_id = 'PROD-08'
  ) THEN
    RAISE EXCEPTION 'PROD-08 migration identity is missing';
  END IF;

  FOR index IN 1..array_length(function_ids, 1) LOOP
    function_id := function_ids[index];

    SELECT regexp_replace(split_part(setting, '=', 2), '\s+', '', 'g')
    INTO configured_path
    FROM pg_proc AS callable
    CROSS JOIN LATERAL unnest(coalesce(callable.proconfig, ARRAY[]::text[])) AS setting
    WHERE callable.oid = function_id
      AND split_part(setting, '=', 1) = 'search_path'
    LIMIT 1;

    IF configured_path IS DISTINCT FROM expected_paths[index] THEN
      RAISE EXCEPTION 'unexpected search_path for %: %', function_id, configured_path;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_proc AS callable
      CROSS JOIN LATERAL aclexplode(coalesce(callable.proacl, acldefault('f', callable.proowner))) AS privilege
      WHERE callable.oid = function_id
        AND privilege.grantee = 0
        AND privilege.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'PUBLIC execute survived for %', function_id;
    END IF;

    IF NOT has_function_privilege('app_runtime', function_id, 'EXECUTE') THEN
      RAISE EXCEPTION 'reviewed app_runtime execute grant is missing for %', function_id;
    END IF;
  END LOOP;
END
$prod08_recovery_contract$;
SQL
}

create_database "$SOURCE_DATABASE"

PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-auth-durable-context.sh >/dev/null
PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-production-runtime.sh >/dev/null
PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-runtime-projection-dead-letter-recovery.sh >/dev/null
PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-security-definer-hygiene.sh >/dev/null

assert_prod08_security_contract "$SOURCE_DATABASE"
SOURCE_STATE="$(psql -X -v ON_ERROR_STOP=1 -d "$SOURCE_DATABASE" -Atqc "SELECT string_agg(n.nspname || '.' || p.proname || ':' || coalesce(array_to_string(p.proconfig, ','), ''), E'\n' ORDER BY n.nspname, p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid = ANY(ARRAY['billing.allocate_document_number(uuid,text,text)'::regprocedure,'ledger.post_journal_entry(uuid,text)'::regprocedure,'ledger.close_period(uuid,text)'::regprocedure,'ledger.reopen_period(uuid,text,text)'::regprocedure]);")"

pg_dump --format=custom --no-owner --file="$DUMP_FILE" "$SOURCE_DATABASE"
test -s "$DUMP_FILE"
DUMP_DIGEST="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
[[ "$DUMP_DIGEST" =~ ^[0-9a-f]{64}$ ]]

create_database "$RESTORE_DATABASE"
pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE" "$DUMP_FILE" >/dev/null

assert_prod08_security_contract "$RESTORE_DATABASE"
RESTORED_STATE="$(psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DATABASE" -Atqc "SELECT string_agg(n.nspname || '.' || p.proname || ':' || coalesce(array_to_string(p.proconfig, ','), ''), E'\n' ORDER BY n.nspname, p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid = ANY(ARRAY['billing.allocate_document_number(uuid,text,text)'::regprocedure,'ledger.post_journal_entry(uuid,text)'::regprocedure,'ledger.close_period(uuid,text)'::regprocedure,'ledger.reopen_period(uuid,text,text)'::regprocedure]);")"

if [[ "$SOURCE_STATE" != "$RESTORED_STATE" ]]; then
  echo "PROD-08 privileged function configuration changed across backup/restore." >&2
  exit 1
fi

echo "PROD-08 database recovery alignment passed; dump sha256=${DUMP_DIGEST}."
