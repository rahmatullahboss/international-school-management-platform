from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    return text.replace(old, new, 1)


index_path = Path('apps/platform-api/src/index.ts')
index_text = index_path.read_text()
index_text = replace_once(
    index_text,
    "export * from './database-projection-worker-store.js';",
    "export * from './database-projection-worker-store.js';\nexport * from './runtime-admin-projection-composer.js';\nexport * from './database-admin-projection-composer-store.js';",
    'index exports',
)
index_path.write_text(index_text)

script_path = Path('tests/integration/verify-auth-durable-context.sh')
text = script_path.read_text()
text = replace_once(
    text,
    "if (manifest.gate !== 'GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1') {",
    "if (manifest.gate !== 'GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1') {",
    'manifest gate',
)
text = replace_once(
    text,
    'if (migrations.length !== 7) {\n  throw new Error(`expected seven post-integration migrations, got ${migrations.length}`);\n}',
    'if (migrations.length !== 8) {\n  throw new Error(`expected eight post-integration migrations, got ${migrations.length}`);\n}',
    'manifest count',
)
text = replace_once(
    text,
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);",
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);",
    'stream allowlist',
)
text = replace_once(
    text,
    "IF (SELECT count(*) FROM platform.schema_migration) <> 47 THEN\n    RAISE EXCEPTION 'expected 47 total migration ledger rows';",
    "IF (SELECT count(*) FROM platform.schema_migration) <> 48 THEN\n    RAISE EXCEPTION 'expected 48 total migration ledger rows';",
    'ledger count',
)
text = replace_once(
    text,
    "     OR to_regclass('platform.runtime_projection_source_publication') IS NULL THEN",
    "     OR to_regclass('platform.runtime_projection_source_publication') IS NULL\n     OR to_regclass('platform.runtime_projection_composition_run') IS NULL THEN",
    'composition table presence',
)

composer_probe = r'''
DO $admin_composer_privilege_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'app_projection_composer'
      AND (rolcanlogin OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'projection composer role must be no-login and unable to bypass RLS';
  END IF;
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'admin composer execute grants are not least privilege';
  END IF;
  IF has_function_privilege(
       'app_projection_composer',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_composer',
       'platform.configure_runtime_projection_persona_role(uuid,uuid,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'composer role must not inherit publisher or mapping administration';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'platform.runtime_projection_composition_run',
      'platform.runtime_projection_source',
      'platform.runtime_projection_source_publication',
      'student_lifecycle.enrollment',
      'attendance.attendance_session',
      'billing.bank_statement_line',
      'billing.cashier_session'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'composer role must retain function-only database access';
  END IF;
END
$admin_composer_privilege_contract$;

INSERT INTO people.person (
  tenant_id,
  person_id,
  status,
  date_of_birth
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000030',
  'active',
  DATE '2012-04-15'
);

INSERT INTO student_lifecycle.student_profile (
  tenant_id,
  student_profile_id,
  person_id,
  status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000030',
  'active'
);

INSERT INTO student_lifecycle.enrollment (
  tenant_id,
  enrollment_id,
  student_profile_id,
  campus_id,
  program_id,
  academic_year_id,
  status,
  effective_from,
  idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000032',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000036',
  '30000000-0000-4000-8000-000000000037',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'pilot-08-admin-student-0001'
);

INSERT INTO attendance.attendance_session (
  tenant_id,
  session_id,
  scheduled_meeting_id,
  section_id,
  campus_id,
  local_date,
  starts_at,
  ends_at,
  timezone,
  roster_student_ids,
  session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000033',
  '30000000-0000-4000-8000-000000000038',
  '30000000-0000-4000-8000-000000000039',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '08:00',
  TIME '08:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);

INSERT INTO billing.bank_statement_line (
  tenant_id,
  legal_entity_id,
  bank_statement_line_id,
  bank_account_ref,
  statement_ref,
  line_number,
  booking_date,
  amount_minor,
  currency,
  description,
  external_reference,
  import_hash,
  status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000034',
  'pilot-bank-01',
  'pilot-statement-01',
  1,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  5000,
  'BDT',
  'Unmatched pilot deposit',
  'pilot-payment-01',
  repeat('a', 64),
  'unmatched'
);

INSERT INTO billing.cashier_session (
  tenant_id,
  legal_entity_id,
  cashier_session_id,
  cashier_id,
  opened_by,
  opening_float_minor,
  currency,
  status,
  expected_cash_minor
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000035',
  'pilot-cashier-01',
  'account:30000000-0000-4000-8000-000000000004',
  1000,
  'BDT',
  'open',
  1000
);

SET ROLE app_projection_composer;
DO $admin_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    2,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000040'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 3
     OR length(result->'composition'->>'payloadDigest') <> 64
     OR (result->'composition'->>'payloadBytes')::integer < 2 THEN
    RAISE EXCEPTION 'first admin composition must publish source revision three: %', result;
  END IF;
END
$admin_composer_first_publication$;

DO $admin_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    3,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000041'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 3 THEN
    RAISE EXCEPTION 'unchanged authoritative data must not advance source revision: %', result;
  END IF;
END
$admin_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_session
SET session_state = 'finalized',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND session_id = '30000000-0000-4000-8000-000000000033';

SET ROLE app_projection_composer;
DO $admin_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    3,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000042'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 4 THEN
    RAISE EXCEPTION 'changed authoritative data must publish source revision four: %', result;
  END IF;
END
$admin_composer_changed_publication$;

DO $admin_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    3,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000043'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 4}'::jsonb THEN
    RAISE EXCEPTION 'stale composer revision must fail exactly: %', result;
  END IF;
END
$admin_composer_revision_conflict$;
RESET ROLE;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000025'
);

SET ROLE app_projection_composer;
DO $admin_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    4,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000044'
  );
  IF result <> '{"composed": false, "reason": "persona-not-admin"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose an admin payload: %', result;
  END IF;
END
$admin_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006'
  AND role_id = '30000000-0000-4000-8000-000000000025';

UPDATE iam.membership
SET status = 'suspended'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_projection_composer;
DO $admin_composer_inactive_scope$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    4,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000045'
  );
  IF result <> '{"composed": false, "reason": "scope-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'inactive membership must not compose an admin source: %', result;
  END IF;
END
$admin_composer_inactive_scope$;
RESET ROLE;

UPDATE iam.membership
SET status = 'active'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_runtime;
DO $admin_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0007',
    9,
    'Apply the reviewed database-owned admin home composition.',
    '30000000-0000-4000-8000-000000000046'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'admin composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-06',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'admin composition must apply through the durable worker: %', result;
  END IF;
END
$admin_composer_end_to_end_refresh$;
RESET ROLE;

DO $admin_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE state = 'published'
  ) <> 2 OR (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE state = 'unchanged'
  ) <> 1 THEN
    RAISE EXCEPTION 'composition evidence must preserve two publications and one no-op';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
  ) <> 4 THEN
    RAISE EXCEPTION 'unchanged composition must not create a source publication';
  END IF;
  IF (
    SELECT source_revision
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 4 THEN
    RAISE EXCEPTION 'admin composer must retain source revision four';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000006'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 10;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'admin-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 1 THEN
    RAISE EXCEPTION 'projection revision ten must contain exact authoritative admin metrics: %', projection_payload;
  END IF;
  IF jsonb_array_length(projection_payload->'exceptions') <> 2 THEN
    RAISE EXCEPTION 'finalized attendance must remove only the attendance exception';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.admin.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful composition run must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-admin-home-0007'
      AND applied.source_revision = 4
      AND applied.projection_revision = 10
  ) <> 1 THEN
    RAISE EXCEPTION 'admin composer refresh must retain exact source/projection evidence';
  END IF;

  BEGIN
    UPDATE platform.runtime_projection_composition_run
    SET state = 'published'
    WHERE correlation_id = '30000000-0000-4000-8000-000000000041';
    RAISE EXCEPTION 'composition evidence mutation unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'audit records are append-only' THEN
        RAISE;
      END IF;
  END;
END
$admin_composer_persistence$;

'''
text = replace_once(
    text,
    'SET ROLE app_runtime;\nDO $account_revoke_verification$',
    composer_probe + 'SET ROLE app_runtime;\nDO $account_revoke_verification$',
    'composer probe insertion',
)
text = replace_once(
    text,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'))",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'))",
    'canonical exclusion',
)
text = replace_once(
    text,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'))",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'))",
    'post integration inclusion',
)
text = replace_once(
    text,
    "      'platform.runtime_projection_source_publication'\n    ]) AS protected(table_name)",
    "      'platform.runtime_projection_source_publication',\n      'platform.runtime_projection_composition_run'\n    ]) AS protected(table_name)",
    'protected table summary',
)
script_path.write_text(text)
