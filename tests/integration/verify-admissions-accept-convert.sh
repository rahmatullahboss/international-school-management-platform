#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

# This verifier intentionally continues the canonical Admissions fixture created by
# verify-production-operator-work-queue.sh and advanced to an issued offer by
# verify-admissions-offer-command.sh. Fresh sessions prove these transitions through
# the durable command boundary rather than relying on a prior browser session.
"${PSQL[@]}" <<'SQL'
INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000005',
    'admissions.application.offer.accept'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000005',
    'admissions.application.applicant.convert'
  )
ON CONFLICT DO NOTHING;

DO $sessions$
BEGIN
  IF NOT iam.register_browser_session(
    '95400000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'admissions-accept-convert-verifier',
    ARRAY['95100000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Admissions accept/convert verifier session was not registered';
  END IF;

  IF NOT iam.register_browser_session(
    '95400000-0000-4000-8000-000000000002',
    '95200000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'admissions-accept-convert-permission-denial-verifier',
    ARRAY['95200000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Admissions accept/convert denial session was not registered';
  END IF;
END
$sessions$;

INSERT INTO admissions.application_checklist_item (
  tenant_id, checklist_item_id, application_id, requirement_key, label, required, status
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95400000-0000-4000-8000-000000000101',
  '95100000-0000-4000-8000-000000000203',
  'final-record',
  'Final verified record',
  true,
  'pending'
)
ON CONFLICT (tenant_id, application_id, requirement_key) DO UPDATE SET status = 'pending';
SQL

accept_blocked="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.accept_application_offer_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,3,'admissions-accept-precondition-0001','95400000-0000-4000-8000-000000000102'::uuid)->>'reason';")"
if [[ "$accept_blocked" != "domain-conflict" ]]; then
  echo "Expected incomplete-checklist acceptance conflict, got: $accept_blocked" >&2
  exit 1
fi

"${PSQL[@]}" -c "UPDATE admissions.application_checklist_item SET status='waived', verified_at=clock_timestamp() WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application_id='95100000-0000-4000-8000-000000000203'::uuid AND requirement_key='final-record';" >/dev/null

accept_success="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.accept_application_offer_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,3,'admissions-accept-test-0001','95400000-0000-4000-8000-000000000103'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command', value->'receipt'->>'domainEvidenceId' FROM result;")"
IFS='|' read -r accept_ok accept_replayed accept_command accept_offer_id <<<"$accept_success"
if [[ "$accept_ok" != "true" || "$accept_replayed" != "false" || "$accept_command" != "admissions.application.offer.accept" || -z "$accept_offer_id" ]]; then
  echo "Unexpected acceptance response: $accept_success" >&2
  exit 1
fi

accept_state="$("${PSQL[@]}" -AtqF '|' -c "SELECT application.status, application.version, offer.status, (offer.accepted_at IS NOT NULL)::text FROM admissions.application AS application JOIN admissions.offer AS offer ON offer.tenant_id=application.tenant_id AND offer.application_id=application.application_id WHERE application.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application.application_id='95100000-0000-4000-8000-000000000203'::uuid;")"
if [[ "$accept_state" != "accepted|4|accepted|true" ]]; then
  echo "Unexpected accepted application state: $accept_state" >&2
  exit 1
fi

accept_replay="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.accept_application_offer_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,3,'admissions-accept-test-0001','95400000-0000-4000-8000-000000000103'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'domainEvidenceId' FROM result;")"
if [[ "$accept_replay" != "true|true|$accept_offer_id" ]]; then
  echo "Unexpected acceptance replay: $accept_replay" >&2
  exit 1
fi

accept_idempotency_conflict="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.accept_application_offer_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'admissions-accept-test-0001','95400000-0000-4000-8000-000000000104'::uuid)->>'reason';")"
if [[ "$accept_idempotency_conflict" != "idempotency-conflict" ]]; then
  echo "Expected acceptance idempotency conflict, got: $accept_idempotency_conflict" >&2
  exit 1
fi

accept_revision_conflict="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.accept_application_offer_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,3,'admissions-accept-test-0002','95400000-0000-4000-8000-000000000105'::uuid) AS value) SELECT value->>'reason', value->>'currentVersion' FROM result;")"
if [[ "$accept_revision_conflict" != "revision-conflict|4" ]]; then
  echo "Expected acceptance revision conflict, got: $accept_revision_conflict" >&2
  exit 1
fi

accept_permission_denied="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.accept_application_offer_command('95400000-0000-4000-8000-000000000002'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'admissions-accept-test-0003','95400000-0000-4000-8000-000000000106'::uuid)->>'reason';")"
if [[ "$accept_permission_denied" != "permission-not-granted" ]]; then
  echo "Expected acceptance permission denial, got: $accept_permission_denied" >&2
  exit 1
fi

convert_bad_date="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'2020-01-01'::date,'admissions-convert-precondition-0001','95400000-0000-4000-8000-000000000107'::uuid)->>'reason';")"
if [[ "$convert_bad_date" != "domain-conflict" ]]; then
  echo "Expected conversion effective-date conflict, got: $convert_bad_date" >&2
  exit 1
fi

convert_success="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'2026-09-15'::date,'admissions-convert-test-0001','95400000-0000-4000-8000-000000000108'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command', value->'receipt'->>'domainEvidenceId' FROM result;")"
IFS='|' read -r convert_ok convert_replayed convert_command conversion_id <<<"$convert_success"
if [[ "$convert_ok" != "true" || "$convert_replayed" != "false" || "$convert_command" != "admissions.application.applicant.convert" || -z "$conversion_id" ]]; then
  echo "Unexpected conversion response: $convert_success" >&2
  exit 1
fi

convert_state="$("${PSQL[@]}" -AtqF '|' -c "SELECT application.status, application.version, profile.status, profile.version, enrollment.status, enrollment.effective_from, enrollment.campus_id, enrollment.program_id, enrollment.academic_year_id FROM admissions.application AS application JOIN admissions.applicant_conversion AS conversion ON conversion.tenant_id=application.tenant_id AND conversion.application_id=application.application_id JOIN student_lifecycle.student_profile AS profile ON profile.tenant_id=conversion.tenant_id AND profile.student_profile_id=conversion.student_profile_id JOIN student_lifecycle.enrollment AS enrollment ON enrollment.tenant_id=conversion.tenant_id AND enrollment.enrollment_id=conversion.enrollment_id WHERE application.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application.application_id='95100000-0000-4000-8000-000000000203'::uuid;")"
if [[ "$convert_state" != "converted|5|active|2|active|2026-09-15|95000000-0000-4000-8000-000000000003|95300000-0000-4000-8000-000000000102|95300000-0000-4000-8000-000000000104" ]]; then
  echo "Unexpected converted applicant state: $convert_state" >&2
  exit 1
fi

history_state="$("${PSQL[@]}" -AtqF '|' -c "SELECT (SELECT count(*) FROM student_lifecycle.student_status_history AS history JOIN admissions.applicant_conversion AS conversion ON conversion.tenant_id=history.tenant_id AND conversion.student_profile_id=history.student_profile_id WHERE conversion.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND conversion.application_id='95100000-0000-4000-8000-000000000203'::uuid), (SELECT count(*) FROM student_lifecycle.enrollment_status_history AS history JOIN admissions.applicant_conversion AS conversion ON conversion.tenant_id=history.tenant_id AND conversion.enrollment_id=history.enrollment_id WHERE conversion.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND conversion.application_id='95100000-0000-4000-8000-000000000203'::uuid), (SELECT count(*) FROM student_lifecycle.placement_history AS placement JOIN admissions.applicant_conversion AS conversion ON conversion.tenant_id=placement.tenant_id AND conversion.enrollment_id=placement.enrollment_id WHERE conversion.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND conversion.application_id='95100000-0000-4000-8000-000000000203'::uuid), (SELECT count(*) FROM student_lifecycle.admission_history WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application_id='95100000-0000-4000-8000-000000000203'::uuid);")"
if [[ "$history_state" != "2|1|1|1" ]]; then
  echo "Unexpected lifecycle history state: $history_state" >&2
  exit 1
fi

convert_replay="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'2026-09-15'::date,'admissions-convert-test-0001','95400000-0000-4000-8000-000000000108'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'domainEvidenceId' FROM result;")"
if [[ "$convert_replay" != "true|true|$conversion_id" ]]; then
  echo "Unexpected conversion replay: $convert_replay" >&2
  exit 1
fi

convert_idempotency_conflict="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'2026-09-16'::date,'admissions-convert-test-0001','95400000-0000-4000-8000-000000000109'::uuid)->>'reason';")"
if [[ "$convert_idempotency_conflict" != "idempotency-conflict" ]]; then
  echo "Expected conversion idempotency conflict, got: $convert_idempotency_conflict" >&2
  exit 1
fi

convert_revision_conflict="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,4,'2026-09-15'::date,'admissions-convert-test-0002','95400000-0000-4000-8000-000000000110'::uuid) AS value) SELECT value->>'reason', value->>'currentVersion' FROM result;")"
if [[ "$convert_revision_conflict" != "revision-conflict|5" ]]; then
  echo "Expected conversion revision conflict, got: $convert_revision_conflict" >&2
  exit 1
fi

convert_semantic_replay="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,5,'2026-09-15'::date,'admissions-convert-test-0003','95400000-0000-4000-8000-000000000111'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'domainEvidenceId' FROM result;")"
if [[ "$convert_semantic_replay" != "true|false|$conversion_id" ]]; then
  echo "Unexpected semantic conversion replay: $convert_semantic_replay" >&2
  exit 1
fi

convert_permission_denied="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.convert_accepted_applicant_command('95400000-0000-4000-8000-000000000002'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,5,'2026-09-15'::date,'admissions-convert-test-0004','95400000-0000-4000-8000-000000000112'::uuid)->>'reason';")"
if [[ "$convert_permission_denied" != "permission-not-granted" ]]; then
  echo "Expected conversion permission denial, got: $convert_permission_denied" >&2
  exit 1
fi

evidence="$("${PSQL[@]}" -AtqF '|' -c "SELECT (SELECT count(*) FROM platform.operator_domain_command_receipt WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND command_type='admissions.application.offer.accept'), (SELECT count(*) FROM platform.operator_domain_command_receipt WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND command_type='admissions.application.applicant.convert'), (SELECT count(*) FROM audit.audit_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND action='admissions.application.offer.accepted' AND subject_id='95100000-0000-4000-8000-000000000203'), (SELECT count(*) FROM audit.audit_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND action='admissions.application.applicant.converted' AND subject_id='95100000-0000-4000-8000-000000000203'), (SELECT count(*) FROM integration_core.outbox_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND event_type='sis.admissions.offer-accepted.v1' AND aggregate_id='95100000-0000-4000-8000-000000000203'), (SELECT count(*) FROM integration_core.outbox_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND event_type='sis.admissions.applicant-converted.v1' AND aggregate_id='95100000-0000-4000-8000-000000000203'), (SELECT count(*) FROM integration_core.outbox_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND event_type='sis.lifecycle.enrollment-created.v1');")"
if [[ "$evidence" != "1|2|1|1|1|1|1" ]]; then
  echo "Unexpected accept/convert evidence counts: $evidence" >&2
  exit 1
fi

"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95400000-0000-4000-8000-000000000001'::uuid, 'Admissions accept/convert verification complete')" >/dev/null
"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95400000-0000-4000-8000-000000000002'::uuid, 'Admissions accept/convert permission verification complete')" >/dev/null

echo 'Admissions offer acceptance and applicant conversion verification passed.'
