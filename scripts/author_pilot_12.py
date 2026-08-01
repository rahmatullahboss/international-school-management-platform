from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} marker, got {count}")
    return text.replace(old, new, 1)


index_path = Path("apps/platform-api/src/index.ts")
index = index_path.read_text(encoding="utf-8")
index = replace_once(
    index,
    "export * from './database-student-projection-composer-store.js';\nexport * from './runtime-projection-source-publisher.js';",
    "export * from './database-student-projection-composer-store.js';\n"
    "export * from './runtime-projection-operations-monitor.js';\n"
    "export * from './database-projection-operations-monitor-store.js';\n"
    "export * from './runtime-projection-source-publisher.js';",
    "platform export",
)
index_path.write_text(index, encoding="utf-8")

verifier_path = Path("tests/integration/verify-auth-durable-context.sh")
verifier = verifier_path.read_text(encoding="utf-8")
replacements = {
    "GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1":
        "GATE-PILOT-RUNTIME-PROJECTION-OPERATIONS-MONITOR-V1",
    "if (migrations.length !== 11) {": "if (migrations.length !== 12) {",
    "expected eleven post-integration migrations": "expected twelve post-integration migrations",
    "'PILOT-09', 'PILOT-10', 'PILOT-11'].includes":
        "'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'].includes",
    "(SELECT count(*) FROM platform.schema_migration) <> 51":
        "(SELECT count(*) FROM platform.schema_migration) <> 52",
    "expected 51 total migration ledger rows": "expected 52 total migration ledger rows",
    "OR to_regprocedure('platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL THEN":
        "OR to_regprocedure('platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL\n"
        "     OR to_regprocedure('platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)') IS NULL THEN",
    "'PILOT-09', 'PILOT-10', 'PILOT-11'))":
        "'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'))",
}
for old, new in replacements.items():
    verifier = replace_once(verifier, old, new, old)

marker = "SET ROLE app_runtime;\nDO $account_revoke_verification$"
fixture = r'''DO $projection_monitor_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_monitor',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_composer',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'projection monitor execute grants are not least privilege';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.membership',
      'platform.runtime_projection_persona_role',
      'platform.runtime_projection_source',
      'platform.runtime_projection_applied_command',
      'platform.runtime_projection_dead_letter',
      'integration_core.outbox_event'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_monitor', table_name, 'SELECT')
       OR has_table_privilege('app_projection_monitor', table_name, 'INSERT')
       OR has_table_privilege('app_projection_monitor', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_monitor', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'projection monitor role must retain function-only access';
  END IF;
END
$projection_monitor_privilege_contract$;

INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile,
  database_binding, provisioning_status
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  'projection-monitor-test',
  'Projection Monitor Test School',
  'test',
  'regional-pooled',
  'test',
  'active'
);

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'Projection Monitor Test School',
  'BD',
  'BDT'
);

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000002',
  'MON',
  'Monitor Campus',
  'Asia/Dhaka'
);

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES
  ('50000000-0000-4000-8000-000000000010', 'monitor-test', 'unique-source', 'monitor-unique@school.test', 'aal2'),
  ('50000000-0000-4000-8000-000000000011', 'monitor-test', 'unmapped', 'monitor-unmapped@school.test', 'aal2'),
  ('50000000-0000-4000-8000-000000000012', 'monitor-test', 'ambiguous', 'monitor-ambiguous@school.test', 'aal2'),
  ('50000000-0000-4000-8000-000000000013', 'monitor-test', 'missing-source', 'monitor-missing@school.test', 'aal2');

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000020', 'monitor-unique', 'Monitor Unique', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000021', 'monitor-unmapped', 'Monitor Unmapped', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000022', 'monitor-ambiguous-a', 'Monitor Ambiguous A', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000023', 'monitor-ambiguous-b', 'Monitor Ambiguous B', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000024', 'monitor-missing', 'Monitor Missing Source', false);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000030', '50000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000003', 'active'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000003', 'active'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000032', '50000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000003', 'active'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000033', '50000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000003', 'active');

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000030', '50000000-0000-4000-8000-000000000020'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000021'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000032', '50000000-0000-4000-8000-000000000022'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000032', '50000000-0000-4000-8000-000000000023'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000033', '50000000-0000-4000-8000-000000000024');

SET ROLE app_projection_admin;
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000020',
  'admin',
  'governance:pilot-12'
);
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000022',
  'teacher',
  'governance:pilot-12'
);
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000023',
  'guardian',
  'governance:pilot-12'
);
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000024',
  'student',
  'governance:pilot-12'
);
RESET ROLE;

INSERT INTO platform.runtime_projection_source (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, source_revision, payload, source_updated_at,
  payload_digest, payload_bytes
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000030',
  '50000000-0000-4000-8000-000000000003',
  'home',
  'admin',
  'account:50000000-0000-4000-8000-000000000010',
  1,
  '{"view":"monitor-fixture","source":"database"}'::jsonb,
  clock_timestamp() - interval '2 hours',
  repeat('0', 64),
  2
);

INSERT INTO integration_core.outbox_event (
  tenant_id, event_id, event_type, schema_version, aggregate_type,
  aggregate_id, aggregate_version, correlation_id, causation_id,
  payload, occurred_at, available_at, published_at, attempt_count, last_error
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000040',
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    '50000000-0000-4000-8000-000000000030',
    2,
    '50000000-0000-4000-8000-000000000050',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '10 minutes',
    clock_timestamp() - interval '10 minutes',
    NULL,
    0,
    NULL
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000041',
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    '50000000-0000-4000-8000-000000000030',
    2,
    '50000000-0000-4000-8000-000000000051',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '2 minutes',
    clock_timestamp() + interval '10 minutes',
    NULL,
    1,
    'source-unavailable'
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000042',
    'unrelated.event',
    1,
    'unrelated',
    'ignore',
    1,
    '50000000-0000-4000-8000-000000000052',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '30 minutes',
    clock_timestamp() - interval '30 minutes',
    NULL,
    0,
    NULL
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000043',
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    '50000000-0000-4000-8000-000000000030',
    2,
    '50000000-0000-4000-8000-000000000053',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '1 minute',
    clock_timestamp() - interval '1 minute',
    clock_timestamp(),
    1,
    'invalid-event'
  );

INSERT INTO platform.runtime_projection_dead_letter (
  tenant_id, event_id, command_id, error_code,
  attempt_count, worker_id, failed_at
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000043',
  NULL,
  'invalid-event',
  1,
  'projection-monitor-test-01',
  clock_timestamp()
);

SET ROLE app_projection_monitor;
DO $projection_monitor_snapshot$
DECLARE
  snapshot jsonb;
BEGIN
  snapshot := platform.read_runtime_projection_operations_snapshot(
    '50000000-0000-4000-8000-000000000001',
    300,
    300
  );

  IF snapshot->>'health' <> 'critical'
     OR snapshot->'controls' <> '{"exactEventAllowlist":true,"tenantScoped":true,"payloadRedacted":true,"functionOnlyAccess":true}'::jsonb
     OR (snapshot->'backlog'->>'eligible')::bigint <> 1
     OR (snapshot->'backlog'->>'retryScheduled')::bigint <> 1
     OR (snapshot->'backlog'->>'oldestEligibleSeconds')::bigint < 590
     OR (snapshot->'delivery'->>'appliedLastHour')::bigint <> 0
     OR (snapshot->'delivery'->>'deadLetterTotal')::bigint <> 1
     OR (snapshot->'delivery'->>'deadLettersLast24Hours')::bigint <> 1
     OR (snapshot->'delivery'->'byCode'->>'invalidEvent')::bigint <> 1
     OR (snapshot->'delivery'->'byCode'->>'sourceUnavailable')::bigint <> 0
     OR (snapshot->'delivery'->'byCode'->>'projectionStateConflict')::bigint <> 0
     OR (snapshot->'delivery'->'byCode'->>'processorError')::bigint <> 0
     OR (snapshot->'sources'->>'current')::bigint <> 1
     OR (snapshot->'sources'->>'stale')::bigint <> 1
     OR (snapshot->'sources'->>'unapplied')::bigint <> 1
     OR (snapshot->'sources'->>'missingForMappedMemberships')::bigint <> 1
     OR (snapshot->'mappings'->>'activeUnique')::bigint <> 2
     OR (snapshot->'mappings'->>'unmapped')::bigint <> 1
     OR (snapshot->'mappings'->>'ambiguous')::bigint <> 1 THEN
    RAISE EXCEPTION 'projection monitor snapshot did not retain exact redacted counts: %', snapshot;
  END IF;

  IF snapshot::text LIKE '%50000000-0000-4000-8000-000000000030%'
     OR snapshot ? 'payload'
     OR snapshot ? 'events'
     OR snapshot ? 'memberships'
     OR snapshot ? 'databaseUrl' THEN
    RAISE EXCEPTION 'projection monitor snapshot leaked scoped identifiers or payloads: %', snapshot;
  END IF;
END
$projection_monitor_snapshot$;

DO $projection_monitor_invalid_settings$
BEGIN
  BEGIN
    PERFORM platform.read_runtime_projection_operations_snapshot(
      '50000000-0000-4000-8000-000000000001',
      59,
      300
    );
    RAISE EXCEPTION 'invalid monitor threshold unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'invalid runtime projection monitor settings' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM platform.read_runtime_projection_operations_snapshot(
      '50000000-0000-4000-8000-000000000099',
      300,
      300
    );
    RAISE EXCEPTION 'unknown monitor tenant unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'runtime projection monitor tenant is unavailable' THEN
        RAISE;
      END IF;
  END;
END
$projection_monitor_invalid_settings$;
RESET ROLE;

SET ROLE app_runtime;
DO $account_revoke_verification$'''
verifier = replace_once(verifier, marker, fixture, "monitor fixture insertion")
verifier_path.write_text(verifier, encoding="utf-8")
