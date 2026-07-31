from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} marker, found {count}")
    return text.replace(old, new, 1)


index_path = Path("apps/platform-api/src/index.ts")
index = index_path.read_text()
if "runtime-teacher-projection-composer.js" not in index:
    index = replace_once(
        index,
        "export * from './database-admin-projection-composer-store.js';\n",
        "export * from './database-admin-projection-composer-store.js';\n"
        "export * from './runtime-teacher-projection-composer.js';\n"
        "export * from './database-teacher-projection-composer-store.js';\n",
        "platform export",
    )
    index_path.write_text(index)

path = Path("tests/integration/verify-auth-durable-context.sh")
text = path.read_text()
if "GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1" in text:
    raise SystemExit(0)

text = replace_once(
    text,
    "if (manifest.gate !== 'GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1') {",
    "if (manifest.gate !== 'GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1') {",
    "manifest gate",
)
text = replace_once(
    text,
    "if (migrations.length !== 8) {\n  throw new Error(`expected eight post-integration migrations, got ${migrations.length}`);\n}",
    "if (migrations.length !== 9) {\n  throw new Error(`expected nine post-integration migrations, got ${migrations.length}`);\n}",
    "migration count",
)
text = replace_once(
    text,
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'].includes(migration.stream))",
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09'].includes(migration.stream))",
    "stream allowlist",
)
text = replace_once(
    text,
    "IF (SELECT count(*) FROM platform.schema_migration) <> 48 THEN\n    RAISE EXCEPTION 'expected 48 total migration ledger rows';",
    "IF (SELECT count(*) FROM platform.schema_migration) <> 49 THEN\n    RAISE EXCEPTION 'expected 49 total migration ledger rows';",
    "ledger count",
)
text = replace_once(
    text,
    "OR to_regclass('platform.runtime_projection_composition_run') IS NULL THEN",
    "OR to_regclass('platform.runtime_projection_composition_run') IS NULL\n"
    "     OR to_regprocedure('platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL THEN",
    "teacher function presence",
)

teacher_block = r'''

DO $teacher_composer_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'teacher composer execute grants are not least privilege';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_composition_run
    WHERE persona <> 'admin'
  ) THEN
    RAISE EXCEPTION 'existing admin composition evidence must backfill as admin';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.person_link',
      'hr.staff_profile',
      'scheduling.class_meeting_pattern',
      'scheduling.scheduled_class_meeting',
      'attendance.attendance_session',
      'gradebook.assessment',
      'gradebook.assessment_result'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'teacher composer role must retain function-only domain access';
  END IF;
END
$teacher_composer_privilege_contract$;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-000000000050',
  'https://identity.school.test',
  'provider-teacher-123',
  'teacher-test@school.test',
  'aal2'
);

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000053',
  'pilot-test-teacher',
  'Pilot Test Teacher',
  false
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000050',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000053'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000053',
  'runtime.snapshot.refresh'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000054',
  'https://identity.school.test',
  'provider-teacher-123',
  '30000000-0000-4000-8000-000000000050',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000054',
  '30000000-0000-4000-8000-000000000053'
);

SET ROLE app_projection_admin;
DO $teacher_composer_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000053',
    'teacher',
    'governance:pilot-09'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'teacher' THEN
    RAISE EXCEPTION 'teacher persona mapping must configure: %', result;
  END IF;
END
$teacher_composer_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $teacher_composer_unlinked_staff$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    0,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000070'
  );
  IF result <> '{"composed": false, "reason": "staff-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'teacher without database-owned staff linkage must fail: %', result;
  END IF;
END
$teacher_composer_unlinked_staff$;
RESET ROLE;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000051',
  'active'
);

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000050',
  '30000000-0000-4000-8000-000000000051'
);

INSERT INTO hr.staff_profile (
  tenant_id, legal_entity_id, campus_id, staff_id, person_ref,
  staff_number, display_name, work_email, employment_status, joined_on
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000055',
  '30000000-0000-4000-8000-000000000051',
  'PILOT-T-001',
  'Pilot Teacher',
  'pilot-teacher@school.test',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 365
);

INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, publication_state, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000063',
  '30000000-0000-4000-8000-000000000061',
  '30000000-0000-4000-8000-000000000062',
  '30000000-0000-4000-8000-000000000003',
  'Pilot Teacher Timetable',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'published',
  'pilot-09-teacher-timetable-01'
);

INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id,
  weekday, starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000064',
  '30000000-0000-4000-8000-000000000063',
  '30000000-0000-4000-8000-000000000065',
  extract(dow FROM (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date)::smallint,
  TIME '09:00',
  TIME '09:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id,
  section_id, local_date, starts_at, ends_at, timezone, teacher_ids,
  student_ids, meeting_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000066',
  '30000000-0000-4000-8000-000000000063',
  '30000000-0000-4000-8000-000000000064',
  '30000000-0000-4000-8000-000000000065',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '09:00',
  TIME '09:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'scheduled'
);

INSERT INTO attendance.attendance_session (
  tenant_id, session_id, scheduled_meeting_id, section_id, campus_id,
  local_date, starts_at, ends_at, timezone, roster_student_ids, session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000067',
  '30000000-0000-4000-8000-000000000066',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '09:00',
  TIME '09:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);

INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  calculation_mode, missing_score_treatment, rounding_decimals, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000068',
  'pilot-09-teacher-policy',
  'v1',
  'traditional',
  'exclude',
  2,
  'published'
);

INSERT INTO gradebook.assessment_category (
  tenant_id, category_id, policy_version_id, category_code, category_label, weight_percent
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000069',
  '30000000-0000-4000-8000-000000000068',
  'QUIZ',
  'Quiz',
  100
);

INSERT INTO gradebook.assessment (
  tenant_id, assessment_id, section_id, reporting_period_id,
  policy_version_id, category_id, assessment_title, maximum_points,
  due_at, assessment_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000006a',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000068',
  '30000000-0000-4000-8000-000000000069',
  'Pilot Teacher Quiz',
  10,
  clock_timestamp() + interval '2 days',
  'published'
);

INSERT INTO gradebook.assessment_result (
  tenant_id, assessment_result_id, assessment_id, student_profile_id,
  result_state, raw_score, entered_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000006b',
  '30000000-0000-4000-8000-00000000006a',
  '30000000-0000-4000-8000-000000000031',
  'missing',
  NULL,
  '30000000-0000-4000-8000-000000000050'
);

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'teacher',
  'person:30000000-0000-4000-8000-000000000051',
  4,
  '{"view":"teacher-home","source":"bootstrap"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
);

SET ROLE app_runtime;
DO $teacher_browser_session_registration$
BEGIN
  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-000000000056',
    '30000000-0000-4000-8000-000000000050',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-teacher-01',
    ARRAY['30000000-0000-4000-8000-000000000053'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'teacher browser session registration must succeed';
  END IF;
END
$teacher_browser_session_registration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $teacher_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    0,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000071'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first teacher composition must publish source revision one: %', result;
  END IF;
END
$teacher_composer_first_publication$;

DO $teacher_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    1,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000072'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'unchanged teacher workload must not advance source revision: %', result;
  END IF;
END
$teacher_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_session
SET session_state = 'finalized', version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND session_id = '30000000-0000-4000-8000-000000000067';

UPDATE gradebook.assessment_result
SET result_state = 'scored', raw_score = 8, version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND assessment_result_id = '30000000-0000-4000-8000-00000000006b';

SET ROLE app_projection_composer;
DO $teacher_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    1,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000073'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'changed teacher workload must publish source revision two: %', result;
  END IF;
END
$teacher_composer_changed_publication$;

DO $teacher_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    1,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000074'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 2}'::jsonb THEN
    RAISE EXCEPTION 'stale teacher composer revision must fail exactly: %', result;
  END IF;
END
$teacher_composer_revision_conflict$;
RESET ROLE;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000005'
);

SET ROLE app_projection_composer;
DO $teacher_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    2,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000075'
  );
  IF result <> '{"composed": false, "reason": "persona-not-teacher"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose a teacher payload: %', result;
  END IF;
END
$teacher_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000052'
  AND role_id = '30000000-0000-4000-8000-000000000005';

UPDATE hr.staff_profile
SET employment_status = 'suspended', version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND staff_id = '30000000-0000-4000-8000-000000000055';

SET ROLE app_projection_composer;
DO $teacher_composer_inactive_staff$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    2,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000076'
  );
  IF result <> '{"composed": false, "reason": "staff-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'inactive linked staff must fail closed: %', result;
  END IF;
END
$teacher_composer_inactive_staff$;
RESET ROLE;

UPDATE hr.staff_profile
SET employment_status = 'active', version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND staff_id = '30000000-0000-4000-8000-000000000055';

SET ROLE app_runtime;
DO $teacher_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-000000000056',
    'refresh-teacher-home-0001',
    4,
    'Apply the reviewed database-owned teacher home composition.',
    '30000000-0000-4000-8000-000000000077'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'teacher composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-07',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'teacher composition must apply through the durable worker: %', result;
  END IF;
END
$teacher_composer_end_to_end_refresh$;
RESET ROLE;

DO $teacher_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
      AND persona = 'teacher'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful teacher composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
  ) <> 2 THEN
    RAISE EXCEPTION 'teacher unchanged composition must not publish a source';
  END IF;
  IF (
    SELECT persona
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'teacher' THEN
    RAISE EXCEPTION 'teacher source must retain database-owned persona';
  END IF;
  IF (
    SELECT subject_ref
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'person:30000000-0000-4000-8000-000000000051' THEN
    RAISE EXCEPTION 'teacher source subject must derive from person linkage';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000052'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 5;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'teacher-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 0
     OR jsonb_array_length(projection_payload->'today'->'classes') <> 1
     OR jsonb_array_length(projection_payload->'exceptions') <> 0 THEN
    RAISE EXCEPTION 'projection revision five must contain exact teacher metrics: %', projection_payload;
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.teacher.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful teacher composition must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-teacher-home-0001'
      AND applied.source_revision = 2
      AND applied.projection_revision = 5
  ) <> 1 THEN
    RAISE EXCEPTION 'teacher composer refresh must retain exact source/projection evidence';
  END IF;
END
$teacher_composer_persistence$;
'''

text = replace_once(
    text,
    "\nSET ROLE app_runtime;\nDO $account_revoke_verification$",
    teacher_block + "\nSET ROLE app_runtime;\nDO $account_revoke_verification$",
    "teacher lifecycle insertion",
)
text = replace_once(
    text,
    "stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08')",
    "stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09')",
    "canonical summary streams",
)
text = replace_once(
    text,
    "stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08')",
    "stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09')",
    "post-integration summary streams",
)
path.write_text(text)
