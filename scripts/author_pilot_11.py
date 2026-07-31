from pathlib import Path


def replace_exact(text: str, old: str, new: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'expected {expected} occurrence(s), found {count}: {old[:160]!r}')
    return text.replace(old, new, expected)


index_path = Path('apps/platform-api/src/index.ts')
index = index_path.read_text()
index = replace_exact(
    index,
    "export * from './database-guardian-projection-composer-store.js';\n",
    "export * from './database-guardian-projection-composer-store.js';\n"
    "export * from './runtime-student-projection-composer.js';\n"
    "export * from './database-student-projection-composer-store.js';\n",
)
index_path.write_text(index)

verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()
verification = replace_exact(
    verification,
    "manifest.gate !== 'GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1'",
    "manifest.gate !== 'GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1'",
)
verification = replace_exact(
    verification,
    "if (migrations.length !== 10) {\n  throw new Error(`expected ten post-integration migrations, got ${migrations.length}`);\n}",
    "if (migrations.length !== 11) {\n  throw new Error(`expected eleven post-integration migrations, got ${migrations.length}`);\n}",
)
verification = replace_exact(
    verification,
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10'].includes(migration.stream)",
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11'].includes(migration.stream)",
)
verification = replace_exact(
    verification,
    "IF (SELECT count(*) FROM platform.schema_migration) <> 50 THEN\n    RAISE EXCEPTION 'expected 50 total migration ledger rows';",
    "IF (SELECT count(*) FROM platform.schema_migration) <> 51 THEN\n    RAISE EXCEPTION 'expected 51 total migration ledger rows';",
)
verification = replace_exact(
    verification,
    "OR to_regprocedure('platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL THEN",
    "OR to_regprocedure('platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL\n"
    "     OR to_regprocedure('platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL THEN",
)

marker = """SET ROLE app_runtime;
DO $account_revoke_verification$
"""
if verification.count(marker) != 1:
    raise SystemExit('expected one account revocation insertion marker')

student_probe = r'''

DO $student_composer_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'student composer execute grants are not least privilege';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_composition_run
    WHERE persona NOT IN ('admin', 'teacher', 'guardian')
  ) THEN
    RAISE EXCEPTION 'existing composition evidence persona backfill changed unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.person_link',
      'student_lifecycle.student_profile',
      'student_lifecycle.enrollment',
      'academics.section_roster',
      'scheduling.scheduled_class_meeting',
      'attendance.attendance_record',
      'gradebook.assessment',
      'gradebook.grade_publication'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'student composer role must retain function-only domain access';
  END IF;
END
$student_composer_privilege_contract$;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-0000000000c0',
  'https://identity.school.test',
  'provider-student-123',
  'student-test@school.test',
  'aal2'
);

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c1',
  'pilot-test-student',
  'Pilot Test Student',
  false
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-0000000000c0',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-0000000000c1'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c1',
  'runtime.snapshot.refresh'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-0000000000c3',
  'https://identity.school.test',
  'provider-student-123',
  '30000000-0000-4000-8000-0000000000c0',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c3',
  '30000000-0000-4000-8000-0000000000c1'
);

SET ROLE app_projection_admin;
DO $student_composer_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c1',
    'student',
    'governance:pilot-11'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'student' THEN
    RAISE EXCEPTION 'student persona mapping must configure: %', result;
  END IF;
END
$student_composer_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $student_composer_unlinked_profile$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    0,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d0'
  );
  IF result <> '{"composed": false, "reason": "student-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'student without database-owned person/profile linkage must fail: %', result;
  END IF;
END
$student_composer_unlinked_profile$;
RESET ROLE;

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c0',
  '30000000-0000-4000-8000-000000000030'
);

-- Current selected-campus and cross-campus rosters intentionally coexist.
INSERT INTO academics.section_roster (
  tenant_id, roster_entry_id, section_id, student_profile_id,
  enrollment_id, joined_on
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c5',
    '30000000-0000-4000-8000-000000000065',
    '30000000-0000-4000-8000-000000000031',
    '30000000-0000-4000-8000-000000000032',
    (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c6',
    '30000000-0000-4000-8000-00000000007b',
    '30000000-0000-4000-8000-000000000031',
    '30000000-0000-4000-8000-000000000032',
    (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
  );

UPDATE attendance.attendance_record
SET attendance_code_id = '30000000-0000-4000-8000-000000000088',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND attendance_record_id = '30000000-0000-4000-8000-00000000008b';

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'student',
  'person:30000000-0000-4000-8000-000000000030',
  2,
  '{"view":"student-home","source":"bootstrap"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
);

SET ROLE app_runtime;
DO $student_browser_session_registration$
BEGIN
  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-0000000000c4',
    '30000000-0000-4000-8000-0000000000c0',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-student-01',
    ARRAY['30000000-0000-4000-8000-0000000000c1'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'student browser session registration must succeed';
  END IF;
END
$student_browser_session_registration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $student_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    0,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d1'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first student composition must publish source revision one: %', result;
  END IF;
END
$student_composer_first_publication$;

DO $student_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    1,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d2'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'unchanged student data must not advance source revision: %', result;
  END IF;
END
$student_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_record
SET attendance_code_id = '30000000-0000-4000-8000-000000000089',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND attendance_record_id = '30000000-0000-4000-8000-00000000008b';

SET ROLE app_projection_composer;
DO $student_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    1,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d3'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'changed student data must publish source revision two: %', result;
  END IF;
END
$student_composer_changed_publication$;

DO $student_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    1,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d4'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 2}'::jsonb THEN
    RAISE EXCEPTION 'stale student composer revision must fail exactly: %', result;
  END IF;
END
$student_composer_revision_conflict$;
RESET ROLE;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-000000000005'
);

SET ROLE app_projection_composer;
DO $student_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    2,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d5'
  );
  IF result <> '{"composed": false, "reason": "persona-not-student"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose a student payload: %', result;
  END IF;
END
$student_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-0000000000c2'
  AND role_id = '30000000-0000-4000-8000-000000000005';

UPDATE student_lifecycle.student_profile
SET status = 'inactive',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND student_profile_id = '30000000-0000-4000-8000-000000000031';

SET ROLE app_projection_composer;
DO $student_composer_inactive_profile$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    2,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d6'
  );
  IF result <> '{"composed": false, "reason": "student-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'inactive student profile must fail closed: %', result;
  END IF;
END
$student_composer_inactive_profile$;
RESET ROLE;

UPDATE student_lifecycle.student_profile
SET status = 'active',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND student_profile_id = '30000000-0000-4000-8000-000000000031';

SET ROLE app_runtime;
DO $student_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-0000000000c4',
    'refresh-student-home-0001',
    2,
    'Apply the reviewed database-owned student home composition.',
    '30000000-0000-4000-8000-0000000000d7'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'student composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-09',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'student composition must apply through the durable worker: %', result;
  END IF;
END
$student_composer_end_to_end_refresh$;
RESET ROLE;

DO $student_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-0000000000c2'
      AND persona = 'student'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful student composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-0000000000c2'
  ) <> 2 THEN
    RAISE EXCEPTION 'student unchanged composition must not publish a source';
  END IF;
  IF (
    SELECT subject_ref
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-0000000000c2'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'person:30000000-0000-4000-8000-000000000030' THEN
    RAISE EXCEPTION 'student source subject must derive from person linkage';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-0000000000c2'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 3;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'student-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 2
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 1
     OR jsonb_array_length(projection_payload->'lessons') <> 2
     OR jsonb_array_length(projection_payload->'results') <> 1
     OR jsonb_array_length(projection_payload->'exceptions') <> 0
     OR projection_payload->'metrics'->0->>'capability' <> 'timetable.self.read'
     OR projection_payload->'metrics'->1->>'capability' <> 'attendance.self.read'
     OR projection_payload->'metrics'->2->>'capability' <> 'records.self.read'
     OR projection_payload->'metrics'->3->>'capability' <> 'records.self.read' THEN
    RAISE EXCEPTION 'projection revision three must contain exact student metrics, campus scope and capabilities: %', projection_payload;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(projection_payload->'lessons') AS lesson
    WHERE lesson->>'sectionId' = '30000000-0000-4000-8000-00000000007b'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(projection_payload->'results') AS result
    WHERE result->>'sectionId' = '30000000-0000-4000-8000-00000000007b'
  ) THEN
    RAISE EXCEPTION 'cross-campus roster data must not appear in student projection';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.student.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful student composition must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-student-home-0001'
      AND applied.source_revision = 2
      AND applied.projection_revision = 3
  ) <> 1 THEN
    RAISE EXCEPTION 'student composer refresh must retain exact source/projection evidence';
  END IF;
END
$student_composer_persistence$;

'''
verification = verification.replace(marker, student_probe + marker, 1)
verification = replace_exact(
    verification,
    "'PILOT-08', 'PILOT-09', 'PILOT-10'))",
    "'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11'))",
    expected=2,
)
verification_path.write_text(verification)
