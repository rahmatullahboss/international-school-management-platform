#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

# The production operator-work-queue verifier runs immediately before this script and
# leaves a scoped Admissions fixture behind after revoking its original browser session.
# Reuse that canonical fixture, but create fresh sessions so this verifier proves the
# offer command independently of the queue read path.
"${PSQL[@]}" <<'SQL'
INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95100000-0000-4000-8000-000000000005',
  'admissions.application.offer.issue'
)
ON CONFLICT DO NOTHING;

DO $sessions$
BEGIN
  IF NOT iam.register_browser_session(
    '95300000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'admissions-offer-command-verifier',
    ARRAY['95100000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Admissions offer verifier session was not registered';
  END IF;

  IF NOT iam.register_browser_session(
    '95300000-0000-4000-8000-000000000002',
    '95200000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'admissions-offer-permission-denial-verifier',
    ARRAY['95200000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'Offer permission-denial verifier session was not registered';
  END IF;
END
$sessions$;

INSERT INTO admissions.application_program_choice (
  tenant_id, program_choice_id, application_id, program_id, preference_rank
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95300000-0000-4000-8000-000000000101',
  '95100000-0000-4000-8000-000000000203',
  '95300000-0000-4000-8000-000000000102',
  1
)
ON CONFLICT (tenant_id, application_id, preference_rank) DO NOTHING;

INSERT INTO admissions.admissions_decision (
  tenant_id, decision_id, application_id, decision, reason_code, decided_by_account_id, decided_at
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95300000-0000-4000-8000-000000000103',
  '95100000-0000-4000-8000-000000000203',
  'admit',
  'verified-for-offer-command-test',
  '95100000-0000-4000-8000-000000000004',
  clock_timestamp()
)
ON CONFLICT (tenant_id, application_id) DO NOTHING;

UPDATE admissions.application
SET status = 'under-review', version = 2, updated_at = clock_timestamp()
WHERE tenant_id = '95000000-0000-4000-8000-000000000001'
  AND application_id = '95100000-0000-4000-8000-000000000203'
  AND version = 1;
SQL

success="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.issue_application_offer_command('95300000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,2,'95300000-0000-4000-8000-000000000102'::uuid,'95300000-0000-4000-8000-000000000104'::uuid,NULL,'2026-09-30T23:59:59Z'::timestamptz,'admissions-offer-test-0001','95300000-0000-4000-8000-000000000105'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command', value->'receipt'->>'domainEvidenceId' FROM result;")"
IFS='|' read -r accepted replayed command offer_id <<<"$success"
if [[ "$accepted" != "true" || "$replayed" != "false" || "$command" != "admissions.application.offer.issue" || -z "$offer_id" ]]; then
  echo "Unexpected offer command success response: $success" >&2
  exit 1
fi

state="$("${PSQL[@]}" -AtqF '|' -c "SELECT application.status, application.version, offer.status, offer.campus_id, offer.program_id, offer.academic_year_id FROM admissions.application AS application JOIN admissions.offer AS offer ON offer.tenant_id = application.tenant_id AND offer.application_id = application.application_id WHERE application.tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND application.application_id='95100000-0000-4000-8000-000000000203'::uuid;")"
if [[ "$state" != "offered|3|issued|95000000-0000-4000-8000-000000000003|95300000-0000-4000-8000-000000000102|95300000-0000-4000-8000-000000000104" ]]; then
  echo "Unexpected persisted offer state: $state" >&2
  exit 1
fi

replay="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.issue_application_offer_command('95300000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,2,'95300000-0000-4000-8000-000000000102'::uuid,'95300000-0000-4000-8000-000000000104'::uuid,NULL,'2026-09-30T23:59:59Z'::timestamptz,'admissions-offer-test-0001','95300000-0000-4000-8000-000000000105'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'domainEvidenceId' FROM result;")"
if [[ "$replay" != "true|true|$offer_id" ]]; then
  echo "Unexpected idempotent offer replay: $replay" >&2
  exit 1
fi

idempotency_conflict="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.issue_application_offer_command('95300000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,2,'95300000-0000-4000-8000-000000000102'::uuid,'95300000-0000-4000-8000-000000000104'::uuid,NULL,'2026-10-01T23:59:59Z'::timestamptz,'admissions-offer-test-0001','95300000-0000-4000-8000-000000000106'::uuid)->>'reason';")"
if [[ "$idempotency_conflict" != "idempotency-conflict" ]]; then
  echo "Expected idempotency conflict, got: $idempotency_conflict" >&2
  exit 1
fi

revision_conflict="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.issue_application_offer_command('95300000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,2,'95300000-0000-4000-8000-000000000102'::uuid,'95300000-0000-4000-8000-000000000104'::uuid,NULL,'2026-09-30T23:59:59Z'::timestamptz,'admissions-offer-test-0002','95300000-0000-4000-8000-000000000107'::uuid) AS value) SELECT value->>'reason', value->>'currentVersion' FROM result;")"
if [[ "$revision_conflict" != "revision-conflict|3" ]]; then
  echo "Expected revision conflict, got: $revision_conflict" >&2
  exit 1
fi

domain_conflict="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.issue_application_offer_command('95300000-0000-4000-8000-000000000001'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,3,'95300000-0000-4000-8000-000000000199'::uuid,'95300000-0000-4000-8000-000000000104'::uuid,NULL,'2026-09-30T23:59:59Z'::timestamptz,'admissions-offer-test-0003','95300000-0000-4000-8000-000000000108'::uuid)->>'reason';")"
if [[ "$domain_conflict" != "domain-conflict" ]]; then
  echo "Expected program-choice domain conflict, got: $domain_conflict" >&2
  exit 1
fi

permission_denied="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.issue_application_offer_command('95300000-0000-4000-8000-000000000002'::uuid,'95100000-0000-4000-8000-000000000203'::uuid,3,'95300000-0000-4000-8000-000000000102'::uuid,'95300000-0000-4000-8000-000000000104'::uuid,NULL,'2026-09-30T23:59:59Z'::timestamptz,'admissions-offer-test-0004','95300000-0000-4000-8000-000000000109'::uuid)->>'reason';")"
if [[ "$permission_denied" != "permission-not-granted" ]]; then
  echo "Expected permission denial, got: $permission_denied" >&2
  exit 1
fi

evidence="$("${PSQL[@]}" -AtqF '|' -c "SELECT (SELECT count(*) FROM platform.operator_domain_command_receipt WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND command_type='admissions.application.offer.issue'), (SELECT count(*) FROM audit.audit_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND action='admissions.application.offer.issued' AND subject_id='95100000-0000-4000-8000-000000000203'), (SELECT count(*) FROM integration_core.outbox_event WHERE tenant_id='95000000-0000-4000-8000-000000000001'::uuid AND event_type='admissions.offer_issued' AND aggregate_id='95100000-0000-4000-8000-000000000203');")"
if [[ "$evidence" != "1|1|1" ]]; then
  echo "Expected one receipt/audit/outbox evidence row, got: $evidence" >&2
  exit 1
fi

"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95300000-0000-4000-8000-000000000001'::uuid, 'Admissions offer command verification complete')" >/dev/null
"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95300000-0000-4000-8000-000000000002'::uuid, 'Admissions offer permission verification complete')" >/dev/null

echo 'Admissions offer command verification passed.'
