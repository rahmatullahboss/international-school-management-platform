#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

"${PSQL[@]}" <<'SQL'
INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000009',
  '95000000-0000-4000-8000-000000000002',
  'OTHER',
  'Other Test Campus',
  'Asia/Dhaka'
)
ON CONFLICT (tenant_id, campus_id) DO NOTHING;

INSERT INTO iam.account (account_id, provider, provider_subject, email, assurance_level)
VALUES
  (
    '95100000-0000-4000-8000-000000000004',
    'https://identity.production.test',
    'production-admissions',
    'production-admissions@school.test',
    'aal1'
  ),
  (
    '95200000-0000-4000-8000-000000000004',
    'https://identity.production.test',
    'production-finance',
    'production-finance@school.test',
    'aal1'
  )
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO iam.role (tenant_id, role_id, role_key, display_name, system_role)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000005',
    'admissions',
    'Production Test Admissions',
    false
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000005',
    'finance',
    'Production Test Finance',
    false
  )
ON CONFLICT (tenant_id, role_id) DO NOTHING;

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000005',
    'admissions.application.review'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000005',
    'finance.reconciliation.write'
  )
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership (tenant_id, membership_id, account_id, campus_id, status)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95100000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000003',
    'active'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000006',
    '95200000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000003',
    'active'
  )
ON CONFLICT (tenant_id, membership_id) DO NOTHING;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95100000-0000-4000-8000-000000000005'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000006',
    '95200000-0000-4000-8000-000000000005'
  )
ON CONFLICT DO NOTHING;

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES
  (
    '95100000-0000-4000-8000-000000000007',
    'https://identity.production.test',
    'production-admissions',
    '95100000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'active'
  ),
  (
    '95200000-0000-4000-8000-000000000007',
    'https://identity.production.test',
    'production-finance',
    '95200000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'active'
  )
ON CONFLICT (binding_id) DO NOTHING;

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000007',
    '95100000-0000-4000-8000-000000000005'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000007',
    '95200000-0000-4000-8000-000000000005'
  )
ON CONFLICT DO NOTHING;

DO $sessions$
BEGIN
  IF NOT iam.register_browser_session(
    '95100000-0000-4000-8000-000000000008',
    '95100000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'production-admissions-session',
    ARRAY['95100000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'admissions work queue session was not registered';
  END IF;
  IF NOT iam.register_browser_session(
    '95200000-0000-4000-8000-000000000008',
    '95200000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95200000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'production-finance-session',
    ARRAY['95200000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'finance work queue session was not registered';
  END IF;
END
$sessions$;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000101', 'active'),
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000102', 'active'),
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000103', 'active'),
  ('95000000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000104', 'active')
ON CONFLICT (tenant_id, person_id) DO NOTHING;

INSERT INTO admissions.admissions_cycle (tenant_id, cycle_id, name, opens_at, closes_at, status)
VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95100000-0000-4000-8000-000000000201',
  'Production Queue Test Cycle',
  '2026-07-01T00:00:00Z',
  '2027-06-30T23:59:59Z',
  'open'
)
ON CONFLICT (tenant_id, cycle_id) DO NOTHING;

INSERT INTO admissions.application_form_version (
  tenant_id, form_version_id, form_key, version, schema, published_at
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95100000-0000-4000-8000-000000000202',
  'production-work-queue-test',
  1,
  '{"type":"object"}'::jsonb,
  '2026-07-01T00:00:00Z'
)
ON CONFLICT (tenant_id, form_version_id) DO NOTHING;

INSERT INTO admissions.application (
  tenant_id, application_id, application_number, cycle_id,
  applicant_person_id, submitting_guardian_person_id, form_version_id,
  status, version, submitted_at
) VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000203',
    'APP-PROD-QUEUE-001',
    '95100000-0000-4000-8000-000000000201',
    '95100000-0000-4000-8000-000000000101',
    '95100000-0000-4000-8000-000000000102',
    '95100000-0000-4000-8000-000000000202',
    'submitted',
    1,
    '2026-08-01T08:30:00Z'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000205',
    'APP-OTHER-CAMPUS-001',
    '95100000-0000-4000-8000-000000000201',
    '95100000-0000-4000-8000-000000000103',
    '95100000-0000-4000-8000-000000000104',
    '95100000-0000-4000-8000-000000000202',
    'submitted',
    1,
    '2026-08-01T09:00:00Z'
  )
ON CONFLICT (tenant_id, application_id) DO NOTHING;

INSERT INTO admissions.interview_event (
  tenant_id, interview_id, application_id, scheduled_at, campus_id,
  interviewer_account_ids, status
) VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000204',
    '95100000-0000-4000-8000-000000000203',
    '2026-08-05T04:00:00Z',
    '95000000-0000-4000-8000-000000000003',
    '[]'::jsonb,
    'scheduled'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95100000-0000-4000-8000-000000000206',
    '95100000-0000-4000-8000-000000000205',
    '2026-08-05T05:00:00Z',
    '95000000-0000-4000-8000-000000000009',
    '[]'::jsonb,
    'scheduled'
  )
ON CONFLICT (tenant_id, interview_id) DO NOTHING;

INSERT INTO ledger.book (
  tenant_id, legal_entity_id, book_id, code, name, base_currency, active
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95200000-0000-4000-8000-000000000101',
  'PROD-Q',
  'Production Queue Test Ledger',
  'BDT',
  true
)
ON CONFLICT (tenant_id, legal_entity_id, book_id) DO NOTHING;

INSERT INTO ledger.fiscal_period (
  tenant_id, legal_entity_id, book_id, fiscal_period_id,
  period_code, starts_on, ends_on, status
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95200000-0000-4000-8000-000000000101',
  '95200000-0000-4000-8000-000000000102',
  '2026-08-Q',
  '2026-08-01',
  '2026-08-31',
  'open'
)
ON CONFLICT (tenant_id, legal_entity_id, fiscal_period_id) DO NOTHING;

INSERT INTO ledger.journal_entry (
  tenant_id, legal_entity_id, book_id, fiscal_period_id, journal_entry_id,
  entry_number, entry_date, description, source_document_type,
  source_document_id, correlation_id, idempotency_key, status,
  created_by, posted_by, posted_at
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95200000-0000-4000-8000-000000000101',
  '95200000-0000-4000-8000-000000000102',
  '95200000-0000-4000-8000-000000000103',
  952001,
  '2026-08-01',
  'Production work queue payment reference',
  'queue_test_payment',
  'QUEUE-PAYMENT-001',
  'queue-finance-correlation-001',
  'queue-finance-journal-001',
  'posted',
  'queue-test',
  'queue-test',
  '2026-08-01T09:05:00Z'
)
ON CONFLICT (tenant_id, legal_entity_id, journal_entry_id) DO NOTHING;

INSERT INTO billing.billing_account (
  tenant_id, legal_entity_id, billing_account_id,
  account_holder_ref, currency, status
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95200000-0000-4000-8000-000000000110',
  'queue-test-account',
  'BDT',
  'active'
)
ON CONFLICT (tenant_id, legal_entity_id, billing_account_id) DO NOTHING;

INSERT INTO billing.payment_intent (
  tenant_id, legal_entity_id, payment_intent_id, billing_account_id,
  amount_minor, currency, provider, provider_intent_id, status,
  created_by, created_at, expires_at, idempotency_key
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95200000-0000-4000-8000-000000000111',
  '95200000-0000-4000-8000-000000000110',
  1500000,
  'BDT',
  'queue-test-bank',
  'QUEUE-INTENT-001',
  'authorized',
  'queue-test',
  '2026-08-01T09:00:00Z',
  '2026-08-03T09:00:00Z',
  'queue-payment-intent-001'
)
ON CONFLICT (tenant_id, legal_entity_id, payment_intent_id) DO NOTHING;

INSERT INTO billing.payment_record (
  tenant_id, legal_entity_id, payment_id, billing_account_id,
  payment_intent_id, provider, provider_payment_id, provider_event_id,
  receipt_number, amount_minor, currency, status, allocated_minor,
  refunded_minor, unapplied_minor, received_at, verified_by, journal_entry_id
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95200000-0000-4000-8000-000000000112',
  '95200000-0000-4000-8000-000000000110',
  '95200000-0000-4000-8000-000000000111',
  'queue-test-bank',
  'QUEUE-PAYMENT-001',
  'QUEUE-EVENT-001',
  'QUEUE-RCPT-001',
  1500000,
  'BDT',
  'settled',
  0,
  0,
  1500000,
  '2026-08-01T09:05:00Z',
  'queue-test',
  '95200000-0000-4000-8000-000000000103'
)
ON CONFLICT (tenant_id, legal_entity_id, payment_id) DO NOTHING;

INSERT INTO billing.bank_statement_line (
  tenant_id, legal_entity_id, bank_statement_line_id, bank_account_ref,
  statement_ref, line_number, booking_date, amount_minor, currency,
  description, external_reference, import_hash, status
) VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000002',
    '95200000-0000-4000-8000-000000000113',
    'QUEUE-BANK-BDT-001',
    'QUEUE-STMT-2026-08',
    1,
    '2026-08-01',
    1500000,
    'BDT',
    'Eligible work queue reconciliation line',
    'QUEUE-PAYMENT-001',
    'b1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    'unmatched'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000002',
    '95200000-0000-4000-8000-000000000114',
    'QUEUE-BANK-BDT-001',
    'QUEUE-STMT-2026-08',
    2,
    '2026-08-01',
    1400000,
    'BDT',
    'Mismatched amount should not appear',
    'QUEUE-OTHER-001',
    'c1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    'unmatched'
  )
ON CONFLICT (tenant_id, legal_entity_id, bank_statement_line_id) DO NOTHING;
SQL

admissions_queue="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH q AS (SELECT platform.resolve_operator_work_queue('95100000-0000-4000-8000-000000000008'::uuid) AS value) SELECT value->>'role', jsonb_array_length(value->'items'), value->'items'->0->>'applicationId', value->'items'->0->>'applicationNumber', value->'items'->0->>'version' FROM q;")"
if [[ "$admissions_queue" != "admissions|1|95100000-0000-4000-8000-000000000203|APP-PROD-QUEUE-001|1" ]]; then
  echo "Unexpected admissions work queue: $admissions_queue" >&2
  exit 1
fi

finance_queue="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH q AS (SELECT platform.resolve_operator_work_queue('95200000-0000-4000-8000-000000000008'::uuid) AS value) SELECT value->>'role', jsonb_array_length(value->'items'), value->'items'->0->>'bankStatementLineId', value->'items'->0->>'paymentId', value->'items'->0->>'amountMinor', jsonb_typeof(value->'items'->0->'amountMinor') FROM q;")"
if [[ "$finance_queue" != "finance|1|95200000-0000-4000-8000-000000000113|95200000-0000-4000-8000-000000000112|1500000|string" ]]; then
  echo "Unexpected finance work queue: $finance_queue" >&2
  exit 1
fi

"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95100000-0000-4000-8000-000000000008'::uuid, 'operator work queue verification complete')" >/dev/null
"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95200000-0000-4000-8000-000000000008'::uuid, 'operator work queue verification complete')" >/dev/null

revoked_queue="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT COALESCE(platform.resolve_operator_work_queue('95100000-0000-4000-8000-000000000008'::uuid)::text, 'null');")"
if [[ "$revoked_queue" != "null" ]]; then
  echo 'Revoked Admissions session still resolved a work queue.' >&2
  exit 1
fi

echo 'Production operator work queue scope, precision and revocation verification passed.'
