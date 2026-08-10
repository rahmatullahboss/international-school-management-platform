#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

"${PSQL[@]}" <<'SQL'
INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000005', 'admissions.application.review'),
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000005', 'admissions.application.offer.issue'),
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000005', 'admissions.application.offer.accept'),
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000005', 'admissions.application.applicant.convert')
ON CONFLICT DO NOTHING;

DO $session$
BEGIN
  IF NOT iam.register_browser_session(
    '95500000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'admissions-lifecycle-queue-verifier',
    ARRAY['95100000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'Admissions lifecycle verifier session was not registered';
  END IF;
END
$session$;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES
  ('95000000-0000-4000-8000-000000000001', '95500000-0000-4000-8000-000000000101', 'active'),
  ('95000000-0000-4000-8000-000000000001', '95500000-0000-4000-8000-000000000102', 'active')
ON CONFLICT (tenant_id, person_id) DO NOTHING;

INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name, starts_on, ends_on, publication_state
) VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95500000-0000-4000-8000-000000000303',
    'LIFECYCLE-2026',
    'Lifecycle Academic Year',
    current_date - 30,
    current_date + 300,
    'published'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95500000-0000-4000-8000-000000000305',
    'LIFECYCLE-NO-CALENDAR',
    'Lifecycle Year Without Campus Calendar',
    current_date - 10,
    current_date + 200,
    'published'
  )
ON CONFLICT (tenant_id, academic_year_id) DO NOTHING;

INSERT INTO academics.instructional_calendar (
  tenant_id, calendar_id, academic_year_id, campus_id, timezone, publication_state
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000304',
  '95500000-0000-4000-8000-000000000303',
  '95000000-0000-4000-8000-000000000003',
  'Asia/Dhaka',
  'published'
)
ON CONFLICT (tenant_id, academic_year_id, campus_id) DO NOTHING;

INSERT INTO academics.curriculum_version (
  tenant_id, curriculum_version_id, curriculum_key, version_label,
  curriculum_name, effective_from, publication_state
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000301',
  'lifecycle-curriculum',
  'v1',
  'Lifecycle Curriculum',
  current_date - 30,
  'published'
)
ON CONFLICT (tenant_id, curriculum_version_id) DO NOTHING;

INSERT INTO academics.program_version (
  tenant_id, program_version_id, program_key, version_label,
  curriculum_version_id, program_name, grade_levels, publication_state
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000302',
  'lifecycle-program',
  'v1',
  '95500000-0000-4000-8000-000000000301',
  'Lifecycle Program',
  '["Grade 7", "Grade 8"]'::jsonb,
  'published'
)
ON CONFLICT (tenant_id, program_version_id) DO NOTHING;

INSERT INTO admissions.application (
  tenant_id, application_id, application_number, cycle_id,
  applicant_person_id, submitting_guardian_person_id, form_version_id,
  status, version, submitted_at, created_at, updated_at
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000203',
  'APP-LIFECYCLE-001',
  '95100000-0000-4000-8000-000000000201',
  '95500000-0000-4000-8000-000000000101',
  '95500000-0000-4000-8000-000000000102',
  '95100000-0000-4000-8000-000000000202',
  'under-review',
  2,
  '2026-08-01T08:30:00Z',
  '2026-08-01T08:00:00Z',
  clock_timestamp()
)
ON CONFLICT (tenant_id, application_id) DO NOTHING;

INSERT INTO admissions.interview_event (
  tenant_id, interview_id, application_id, scheduled_at,
  campus_id, interviewer_account_ids, status
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000204',
  '95500000-0000-4000-8000-000000000203',
  clock_timestamp() + interval '1 day',
  '95000000-0000-4000-8000-000000000003',
  '[]'::jsonb,
  'scheduled'
)
ON CONFLICT (tenant_id, interview_id) DO NOTHING;

INSERT INTO admissions.application_program_choice (
  tenant_id, program_choice_id, application_id, program_id, preference_rank
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000205',
  '95500000-0000-4000-8000-000000000203',
  '95500000-0000-4000-8000-000000000302',
  1
)
ON CONFLICT (tenant_id, application_id, preference_rank) DO NOTHING;

INSERT INTO admissions.admissions_decision (
  tenant_id, decision_id, application_id, decision,
  reason_code, decided_by_account_id, decided_at
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000206',
  '95500000-0000-4000-8000-000000000203',
  'admit',
  'lifecycle-verifier',
  '95100000-0000-4000-8000-000000000004',
  clock_timestamp()
)
ON CONFLICT (tenant_id, application_id) DO NOTHING;
SQL

identity_count="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM academics.program_grade_level_identity WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND program_version_id='95500000-0000-4000-8000-000000000302'::uuid AND grade_level IN ('Grade 7','Grade 8');")"
if [[ "$identity_count" != "2" ]]; then
  echo "Expected two stable grade identities, got: $identity_count" >&2
  exit 1
fi

issue_stage="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT queue->>'schemaVersion', queue->>'role', item->>'action', item->>'version', item->'placementOptions'->0->>'programId', item->'placementOptions'->0->>'academicYearId', item->'placementOptions'->0->>'gradeLevelId', item->'placementOptions'->0->>'gradeLevelLabel' FROM resolved, candidate;")"
IFS='|' read -r schema_version queue_role issue_action issue_version program_id academic_year_id grade_level_id grade_level_label <<<"$issue_stage"
if [[ "$schema_version" != "2" || "$queue_role" != "admissions" || "$issue_action" != "issue-offer" || "$issue_version" != "2" || "$program_id" != "95500000-0000-4000-8000-000000000302" || "$academic_year_id" != "95500000-0000-4000-8000-000000000303" || -z "$grade_level_id" || ( "$grade_level_label" != "Grade 7" && "$grade_level_label" != "Grade 8" ) ]]; then
  echo "Unexpected issue-offer lifecycle stage: $issue_stage" >&2
  exit 1
fi

no_calendar_option_count="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT count(*) FROM candidate CROSS JOIN LATERAL jsonb_array_elements(item->'placementOptions') AS option WHERE option->>'academicYearId'='95500000-0000-4000-8000-000000000305';")"
if [[ "$no_calendar_option_count" != "0" ]]; then
  echo "Academic year without selected-campus calendar leaked into placement options: $no_calendar_option_count" >&2
  exit 1
fi

no_calendar_offer="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.issue_application_offer_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,2,'95500000-0000-4000-8000-000000000302'::uuid,'95500000-0000-4000-8000-000000000305'::uuid,'$grade_level_id'::uuid,clock_timestamp()+interval '30 days','admissions-lifecycle-no-calendar-0001','95500000-0000-4000-8000-000000000405'::uuid)->>'reason';")"
if [[ "$no_calendar_offer" != "domain-conflict" ]]; then
  echo "Expected academic year without selected-campus calendar to fail closed, got: $no_calendar_offer" >&2
  exit 1
fi

bogus_grade="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.issue_application_offer_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,2,'95500000-0000-4000-8000-000000000302'::uuid,'95500000-0000-4000-8000-000000000303'::uuid,'95500000-0000-4000-8000-000000000399'::uuid,clock_timestamp()+interval '30 days','admissions-lifecycle-bogus-grade-0001','95500000-0000-4000-8000-000000000401'::uuid)->>'reason';")"
if [[ "$bogus_grade" != "domain-conflict" ]]; then
  echo "Expected arbitrary grade identity to fail closed, got: $bogus_grade" >&2
  exit 1
fi

issue_result="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.issue_application_offer_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,2,'$program_id'::uuid,'$academic_year_id'::uuid,'$grade_level_id'::uuid,clock_timestamp()+interval '30 days','admissions-lifecycle-issue-0001','95500000-0000-4000-8000-000000000402'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command' FROM result;")"
if [[ "$issue_result" != "true|false|admissions.application.offer.issue" ]]; then
  echo "Unexpected catalog-validated offer result: $issue_result" >&2
  exit 1
fi

accept_stage="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT item->>'action', item->>'version', item->>'offerExpiresAt' FROM candidate;")"
IFS='|' read -r accept_action accept_version offer_expires_at <<<"$accept_stage"
if [[ "$accept_action" != "accept-offer" || "$accept_version" != "3" || -z "$offer_expires_at" ]]; then
  echo "Unexpected accept-offer lifecycle stage: $accept_stage" >&2
  exit 1
fi

accept_result="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.accept_application_offer_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,3,'admissions-lifecycle-accept-0001','95500000-0000-4000-8000-000000000403'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command' FROM result;")"
if [[ "$accept_result" != "true|false|admissions.application.offer.accept" ]]; then
  echo "Unexpected offer acceptance result: $accept_result" >&2
  exit 1
fi

convert_stage="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT item->>'action', item->>'version', item->>'suggestedEffectiveFrom', item->>'effectiveFromMax' FROM candidate;")"
IFS='|' read -r convert_action convert_version effective_from effective_max <<<"$convert_stage"
if [[ "$convert_action" != "convert-applicant" || "$convert_version" != "4" || ! "$effective_from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || ! "$effective_max" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || "$effective_from" > "$effective_max" ]]; then
  echo "Unexpected convert-applicant lifecycle stage: $convert_stage" >&2
  exit 1
fi

outside_year="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.convert_accepted_applicant_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,4,('$effective_max'::date + 1),'admissions-lifecycle-outside-year-0001','95500000-0000-4000-8000-000000000406'::uuid)->>'reason';")"
if [[ "$outside_year" != "domain-conflict" ]]; then
  echo "Expected conversion outside offered academic year to fail closed, got: $outside_year" >&2
  exit 1
fi

convert_result="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,4,'$effective_from'::date,'admissions-lifecycle-convert-0001','95500000-0000-4000-8000-000000000404'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command' FROM result;")"
if [[ "$convert_result" != "true|false|admissions.application.applicant.convert" ]]; then
  echo "Unexpected applicant conversion result: $convert_result" >&2
  exit 1
fi

remaining="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue) SELECT count(*) FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203';")"
if [[ "$remaining" != "0" ]]; then
  echo "Converted application remained actionable: $remaining" >&2
  exit 1
fi

persisted="$("${PSQL[@]}" -AtqF '|' -c "SELECT application.status, application.version, offer.status, enrollment.status, enrollment.program_id, enrollment.academic_year_id, enrollment.grade_level_id, grade.grade_level FROM admissions.application AS application JOIN admissions.offer AS offer ON offer.tenant_id=application.tenant_id AND offer.application_id=application.application_id JOIN admissions.applicant_conversion AS conversion ON conversion.tenant_id=application.tenant_id AND conversion.application_id=application.application_id JOIN student_lifecycle.enrollment AS enrollment ON enrollment.tenant_id=conversion.tenant_id AND enrollment.enrollment_id=conversion.enrollment_id JOIN academics.program_grade_level_identity AS grade ON grade.tenant_id=enrollment.tenant_id AND grade.grade_level_id=enrollment.grade_level_id WHERE application.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application.application_id='95500000-0000-4000-8000-000000000203'::uuid;")"
IFS='|' read -r application_status application_version offer_status enrollment_status persisted_program persisted_year persisted_grade persisted_grade_label <<<"$persisted"
if [[ "$application_status" != "converted" || "$application_version" != "5" || "$offer_status" != "accepted" || "$enrollment_status" != "active" || "$persisted_program" != "$program_id" || "$persisted_year" != "$academic_year_id" || "$persisted_grade" != "$grade_level_id" || "$persisted_grade_label" != "$grade_level_label" ]]; then
  echo "Unexpected persisted lifecycle state: $persisted" >&2
  exit 1
fi

evidence="$("${PSQL[@]}" -AtqF '|' -c "SELECT (SELECT count(*) FROM platform.operator_domain_command_receipt WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND domain_evidence_id IN (SELECT offer_id FROM admissions.offer WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application_id='95500000-0000-4000-8000-000000000203'::uuid) AND command_type IN ('admissions.application.offer.issue','admissions.application.offer.accept')), (SELECT count(*) FROM platform.operator_domain_command_receipt WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND command_type='admissions.application.applicant.convert' AND domain_evidence_id IN (SELECT conversion_id FROM admissions.applicant_conversion WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application_id='95500000-0000-4000-8000-000000000203'::uuid)), (SELECT count(*) FROM audit.audit_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND subject_id='95500000-0000-4000-8000-000000000203' AND action IN ('admissions.application.offer.issued','admissions.application.offer.accepted','admissions.application.applicant.converted')); ")"
if [[ "$evidence" != "2|1|3" ]]; then
  echo "Expected lifecycle command/audit evidence, got: $evidence" >&2
  exit 1
fi

"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95500000-0000-4000-8000-000000000001'::uuid, 'Admissions lifecycle queue verification complete')" >/dev/null

echo 'Admissions lifecycle work queue verification passed.'
