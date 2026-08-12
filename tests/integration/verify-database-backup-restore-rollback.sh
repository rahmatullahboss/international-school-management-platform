#!/usr/bin/env bash
set -euo pipefail

umask 077

CALLER_DATABASE="${PGDATABASE:-postgres}"
SOURCE_DATABASE="school_recovery_source_${$}"
RESTORE_DATABASE="school_recovery_restore_${$}"
DUMP_DIRECTORY="$(mktemp -d)"
DUMP_FILE="${DUMP_DIRECTORY}/school-recovery.dump"
SENTINEL_TENANT_ID="98000000-0000-4000-8000-000000000001"
SENTINEL_EVENT_ID="98000000-0000-4000-8000-000000000002"
DRIFT_EVENT_ID="98000000-0000-4000-8000-000000000003"

validate_temporary_database_name() {
  local database_name="$1"
  if [[ ! "$database_name" =~ ^school_recovery_(source|restore)_[0-9]+$ ]]; then
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

fingerprint_database() {
  local database_name="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$database_name" -Atqc "
WITH relation_metadata AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_array(
        namespace.nspname,
        relation.relname,
        relation.relkind,
        relation.relrowsecurity,
        relation.relforcerowsecurity
      )
      ORDER BY namespace.nspname, relation.relname, relation.relkind
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND namespace.nspname NOT LIKE 'pg_temp_%'
    AND namespace.nspname NOT LIKE 'pg_toast_temp_%'
    AND relation.relkind IN ('r', 'p')
), policy_metadata AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_array(
        namespace.nspname,
        relation.relname,
        policy.polname,
        policy.polcmd,
        policy.polpermissive,
        policy.polroles::text,
        coalesce(pg_get_expr(policy.polqual, policy.polrelid), ''),
        coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), '')
      )
      ORDER BY namespace.nspname, relation.relname, policy.polname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_policy AS policy
  JOIN pg_class AS relation ON relation.oid = policy.polrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
), privileged_function_metadata AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_array(
        namespace.nspname,
        callable.proname,
        pg_get_function_identity_arguments(callable.oid),
        coalesce(callable.proacl::text, '')
      )
      ORDER BY namespace.nspname, callable.proname, pg_get_function_identity_arguments(callable.oid)
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_proc AS callable
  JOIN pg_namespace AS namespace ON namespace.oid = callable.pronamespace
  WHERE callable.prosecdef
    AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
), migration_metadata AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_array(migration_id, stream_id, description)
      ORDER BY migration_id
    ),
    '[]'::jsonb
  ) AS value
  FROM platform.schema_migration
), sentinel AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tenantId', tenant.tenant_id,
        'slug', tenant.slug,
        'displayName', tenant.display_name,
        'provisioningStatus', tenant.provisioning_status,
        'eventId', event.event_id,
        'eventType', event.event_type,
        'payload', event.payload
      )
      ORDER BY tenant.tenant_id, event.event_id
    ),
    '[]'::jsonb
  ) AS value
  FROM platform.tenant AS tenant
  JOIN integration_core.outbox_event AS event ON event.tenant_id = tenant.tenant_id
  WHERE tenant.tenant_id = '${SENTINEL_TENANT_ID}'::uuid
    AND event.event_id = '${SENTINEL_EVENT_ID}'::uuid
), representative_counts AS (
  SELECT jsonb_build_object(
    'tenant', (SELECT count(*) FROM platform.tenant),
    'account', (SELECT count(*) FROM iam.account),
    'membership', (SELECT count(*) FROM iam.membership),
    'outboxEvent', (SELECT count(*) FROM integration_core.outbox_event),
    'auditEvent', (SELECT count(*) FROM audit.audit_event),
    'runtimeProjection', (SELECT count(*) FROM platform.runtime_read_model_projection),
    'runtimeDeadLetter', (SELECT count(*) FROM platform.runtime_projection_dead_letter),
    'runtimeRecoveryReceipt', (SELECT count(*) FROM platform.runtime_projection_recovery_receipt),
    'admissionApplication', (SELECT count(*) FROM admissions.application)
  ) AS value
)
SELECT encode(
  public.digest(
    convert_to(
      jsonb_build_object(
        'migrations', migration_metadata.value,
        'relations', relation_metadata.value,
        'policies', policy_metadata.value,
        'securityDefinerFunctions', privileged_function_metadata.value,
        'representativeCounts', representative_counts.value,
        'sentinel', sentinel.value
      )::text,
      'UTF8'
    ),
    'sha256'
  ),
  'hex'
)
FROM relation_metadata, policy_metadata, privileged_function_metadata,
     migration_metadata, representative_counts, sentinel;"
}

assert_database_contract() {
  local database_name="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$database_name" <<SQL >/dev/null
DO \$recovery_contract\$
DECLARE
  protected_count integer;
BEGIN
  IF (SELECT count(*) FROM platform.schema_migration) <> 62 THEN
    RAISE EXCEPTION 'expected 62 reviewed migration rows in recovery database';
  END IF;
  IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-06') <> 1
     OR (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'PROD-07') <> 1 THEN
    RAISE EXCEPTION 'PROD-06/07 recovery migrations are missing';
  END IF;

  SELECT count(*) INTO protected_count
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE (namespace.nspname, relation.relname) IN (
    ('iam', 'membership'),
    ('integration_core', 'outbox_event'),
    ('admissions', 'application')
  )
    AND relation.relrowsecurity
    AND relation.relforcerowsecurity;
  IF protected_count <> 3 THEN
    RAISE EXCEPTION 'representative forced-RLS protections did not survive recovery';
  END IF;

  IF to_regprocedure('platform.production_runtime_credential_ready()') IS NULL
     OR to_regprocedure('platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)') IS NULL
     OR to_regprocedure('platform.recover_runtime_projection_dead_letter(uuid,uuid,uuid,text,text,uuid)') IS NULL
     OR to_regprocedure('platform.projection_recovery_credential_ready()') IS NULL THEN
    RAISE EXCEPTION 'reviewed production/recovery functions are incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM platform.tenant
    WHERE tenant_id = '${SENTINEL_TENANT_ID}'::uuid
      AND slug = 'backup-rehearsal-sentinel'
      AND display_name = 'Backup Rehearsal Sentinel'
      AND provisioning_status = 'active'
  ) THEN
    RAISE EXCEPTION 'backup recovery tenant sentinel is missing or changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE tenant_id = '${SENTINEL_TENANT_ID}'::uuid
      AND event_id = '${SENTINEL_EVENT_ID}'::uuid
      AND event_type = 'rehearsal.backup.sentinel'
      AND payload = '{"sentinel":"baseline","version":1}'::jsonb
  ) THEN
    RAISE EXCEPTION 'backup recovery outbox sentinel is missing or changed';
  END IF;
END
\$recovery_contract\$;
SQL
}

create_database "$SOURCE_DATABASE"

PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-auth-durable-context.sh >/dev/null
PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-production-runtime.sh >/dev/null
PGDATABASE="$SOURCE_DATABASE" bash tests/integration/verify-runtime-projection-dead-letter-recovery.sh >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$SOURCE_DATABASE" <<SQL >/dev/null
INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile,
  database_binding, provisioning_status
) VALUES (
  '${SENTINEL_TENANT_ID}'::uuid,
  'backup-rehearsal-sentinel',
  'Backup Rehearsal Sentinel',
  'test',
  'regional-pooled',
  'recovery-rehearsal',
  'active'
)
ON CONFLICT (tenant_id) DO UPDATE
SET slug = EXCLUDED.slug,
    display_name = EXCLUDED.display_name,
    home_region = EXCLUDED.home_region,
    deployment_profile = EXCLUDED.deployment_profile,
    database_binding = EXCLUDED.database_binding,
    provisioning_status = EXCLUDED.provisioning_status;

INSERT INTO integration_core.outbox_event (
  tenant_id, event_id, event_type, schema_version, aggregate_type,
  aggregate_id, aggregate_version, correlation_id, causation_id,
  payload, occurred_at, available_at
) VALUES (
  '${SENTINEL_TENANT_ID}'::uuid,
  '${SENTINEL_EVENT_ID}'::uuid,
  'rehearsal.backup.sentinel',
  1,
  'backup_rehearsal',
  '${SENTINEL_TENANT_ID}',
  1,
  '${SENTINEL_EVENT_ID}',
  NULL,
  '{"sentinel":"baseline","version":1}'::jsonb,
  '2026-08-12T00:00:00Z'::timestamptz,
  '2026-08-12T00:00:00Z'::timestamptz
)
ON CONFLICT (tenant_id, event_id) DO UPDATE
SET event_type = EXCLUDED.event_type,
    schema_version = EXCLUDED.schema_version,
    aggregate_type = EXCLUDED.aggregate_type,
    aggregate_id = EXCLUDED.aggregate_id,
    aggregate_version = EXCLUDED.aggregate_version,
    correlation_id = EXCLUDED.correlation_id,
    causation_id = EXCLUDED.causation_id,
    payload = EXCLUDED.payload,
    occurred_at = EXCLUDED.occurred_at,
    available_at = EXCLUDED.available_at,
    published_at = NULL,
    attempt_count = 0,
    last_error = NULL;
SQL

assert_database_contract "$SOURCE_DATABASE"
SOURCE_FINGERPRINT="$(fingerprint_database "$SOURCE_DATABASE")"
if [[ ! "$SOURCE_FINGERPRINT" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Source database fingerprint is invalid" >&2
  exit 1
fi

pg_dump --format=custom --no-owner --file="$DUMP_FILE" --dbname="$SOURCE_DATABASE"
if [[ ! -s "$DUMP_FILE" ]]; then
  echo "Database backup artifact is empty" >&2
  exit 1
fi
DUMP_SHA256="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
if [[ ! "$DUMP_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Database backup digest is invalid" >&2
  exit 1
fi

create_database "$RESTORE_DATABASE"
pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE" "$DUMP_FILE" >/dev/null
assert_database_contract "$RESTORE_DATABASE"
FIRST_RESTORE_FINGERPRINT="$(fingerprint_database "$RESTORE_DATABASE")"
if [[ "$FIRST_RESTORE_FINGERPRINT" != "$SOURCE_FINGERPRINT" ]]; then
  echo "First restored database fingerprint does not match source" >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DATABASE" <<SQL >/dev/null
UPDATE platform.tenant
SET display_name = 'DRIFTED RESTORE TARGET'
WHERE tenant_id = '${SENTINEL_TENANT_ID}'::uuid;

INSERT INTO integration_core.outbox_event (
  tenant_id, event_id, event_type, schema_version, aggregate_type,
  aggregate_id, aggregate_version, correlation_id, payload,
  occurred_at, available_at
) VALUES (
  '${SENTINEL_TENANT_ID}'::uuid,
  '${DRIFT_EVENT_ID}'::uuid,
  'rehearsal.rollback.drift',
  1,
  'backup_rehearsal',
  '${SENTINEL_TENANT_ID}',
  2,
  '${DRIFT_EVENT_ID}',
  '{"sentinel":"drift"}'::jsonb,
  '2026-08-12T00:01:00Z'::timestamptz,
  '2026-08-12T00:01:00Z'::timestamptz
);
SQL

DRIFTED_FINGERPRINT="$(fingerprint_database "$RESTORE_DATABASE")"
if [[ "$DRIFTED_FINGERPRINT" == "$SOURCE_FINGERPRINT" ]]; then
  echo "Deliberate restore-only drift did not change the recovery fingerprint" >&2
  exit 1
fi
if [[ "$(fingerprint_database "$SOURCE_DATABASE")" != "$SOURCE_FINGERPRINT" ]]; then
  echo "Source database changed while rehearsing restore drift" >&2
  exit 1
fi

drop_database "$RESTORE_DATABASE"
create_database "$RESTORE_DATABASE"
pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE" "$DUMP_FILE" >/dev/null
assert_database_contract "$RESTORE_DATABASE"
SECOND_RESTORE_FINGERPRINT="$(fingerprint_database "$RESTORE_DATABASE")"
if [[ "$SECOND_RESTORE_FINGERPRINT" != "$SOURCE_FINGERPRINT" ]]; then
  echo "Second restored database fingerprint does not match immutable source baseline" >&2
  exit 1
fi

DRIFT_MARKER_COUNT="$(
  psql -X -v ON_ERROR_STOP=1 -d "$RESTORE_DATABASE" -Atqc \
    "SELECT count(*) FROM integration_core.outbox_event WHERE tenant_id='${SENTINEL_TENANT_ID}'::uuid AND event_id='${DRIFT_EVENT_ID}'::uuid;"
)"
if [[ "$DRIFT_MARKER_COUNT" != "0" ]]; then
  echo "Rollback restore retained the deliberate drift marker" >&2
  exit 1
fi

if [[ "$(fingerprint_database "$SOURCE_DATABASE")" != "$SOURCE_FINGERPRINT" ]]; then
  echo "Source database changed after rollback restore" >&2
  exit 1
fi

printf 'Database backup/restore/rollback rehearsal passed (dump_sha256=%s).\n' "$DUMP_SHA256"
