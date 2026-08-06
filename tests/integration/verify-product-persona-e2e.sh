#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

"${PSQL[@]}" <<'SQL'
INSERT INTO iam.permission(permission_key, description, required_assurance) VALUES
  ('admissions.application.review', 'Review admissions applications', 'aal1'),
  ('admissions.enrolment.convert', 'Convert an accepted applicant to enrolment', 'aal1'),
  ('finance.receipt.create', 'Create cashier receipts', 'aal1'),
  ('finance.reconciliation.write', 'Reconcile verified receipts', 'aal1'),
  ('finance.refund.approve', 'Approve finance refunds', 'aal2'),
  ('support.diagnostics.read', 'Read tenant-scoped support diagnostics', 'aal1'),
  ('support.break-glass.request', 'Request privileged support access', 'aal2'),
  ('platform.tenant.mutate', 'Mutate tenant-owned platform configuration', 'aal2')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

INSERT INTO iam.account(account_id, provider, provider_subject, email, assurance_level) VALUES
  ('61000000-0000-4000-8000-000000000004', 'https://identity.school.test', 'persona-admissions', 'admissions@school.test', 'aal2'),
  ('62000000-0000-4000-8000-000000000004', 'https://identity.school.test', 'persona-finance', 'finance@school.test', 'aal2'),
  ('63000000-0000-4000-8000-000000000004', 'https://identity.school.test', 'persona-support', 'support@platform.test', 'aal2')
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO iam.role(tenant_id, role_id, role_key, display_name, system_role) VALUES
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'admissions-officer-e2e', 'Admissions Officer E2E', false),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000005', 'cashier-e2e', 'Cashier E2E', false),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000005', 'platform-support-e2e', 'Platform Support E2E', false)
ON CONFLICT (tenant_id, role_id) DO NOTHING;

INSERT INTO iam.role_permission(tenant_id, role_id, permission_key) VALUES
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'admissions.application.review'),
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'admissions.enrolment.convert'),
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'runtime.snapshot.refresh'),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000005', 'finance.receipt.create'),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000005', 'finance.reconciliation.write'),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000005', 'runtime.snapshot.refresh'),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000005', 'support.diagnostics.read'),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000005', 'support.break-glass.request'),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000005', 'runtime.snapshot.refresh')
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership(tenant_id, membership_id, account_id, campus_id, status) VALUES
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', 'active'),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', 'active'),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000006', '63000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', 'active')
ON CONFLICT (tenant_id, membership_id) DO NOTHING;

INSERT INTO iam.membership_role(tenant_id, membership_id, role_id) VALUES
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000006', '63000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO iam.oidc_membership_binding(
  binding_id, provider_issuer, provider_subject, account_id, tenant_id, membership_id, campus_id, status
) VALUES
  ('61000000-0000-4000-8000-000000000007', 'https://identity.school.test', 'persona-admissions', '61000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'active'),
  ('62000000-0000-4000-8000-000000000007', 'https://identity.school.test', 'persona-finance', '62000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'active'),
  ('63000000-0000-4000-8000-000000000007', 'https://identity.school.test', 'persona-support', '63000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'active')
ON CONFLICT (binding_id) DO NOTHING;

INSERT INTO iam.oidc_membership_role_binding(tenant_id, binding_id, role_id) VALUES
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000007', '61000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000007', '63000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;

DO $sessions$
BEGIN
  IF NOT iam.register_browser_session(
    '61000000-0000-4000-8000-000000000008',
    '61000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'persona-admissions-session',
    ARRAY['61000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'admissions session registration failed';
  END IF;

  IF NOT iam.register_browser_session(
    '62000000-0000-4000-8000-000000000008',
    '62000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'persona-finance-session',
    ARRAY['62000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'finance session registration failed';
  END IF;

  IF NOT iam.register_browser_session(
    '63000000-0000-4000-8000-000000000008',
    '63000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'persona-support-aal1',
    ARRAY['63000000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'support AAL1 session registration failed';
  END IF;

  IF NOT iam.register_browser_session(
    '63000000-0000-4000-8000-000000000009',
    '63000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'persona-support-aal2',
    ARRAY['63000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'support AAL2 session registration failed';
  END IF;
END
$sessions$;

INSERT INTO platform.runtime_read_model_projection(
  tenant_id, membership_id, campus_id, projection_key, persona, subject_ref,
  revision, payload, source_updated_at, generated_at
) VALUES
  ('30000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'home', 'admin', 'admissions-e2e', 1, '{"persona":"admissions"}'::jsonb, clock_timestamp(), clock_timestamp()),
  ('30000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'home', 'admin', 'finance-e2e', 1, '{"persona":"finance"}'::jsonb, clock_timestamp(), clock_timestamp()),
  ('30000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'home', 'admin', 'support-e2e', 1, '{"persona":"support"}'::jsonb, clock_timestamp(), clock_timestamp())
ON CONFLICT (tenant_id, membership_id, campus_id, projection_key) DO UPDATE
SET revision = EXCLUDED.revision,
    payload = EXCLUDED.payload,
    source_updated_at = EXCLUDED.source_updated_at,
    generated_at = EXCLUDED.generated_at;


-- PILOT-13 Admissions fixtures: one exact-campus application and one cross-campus application.
INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000090',
  '30000000-0000-4000-8000-000000000002',
  'P13X',
  'PILOT-13 Cross Campus',
  'Asia/Dhaka'
) ON CONFLICT (tenant_id, campus_id) DO NOTHING;

INSERT INTO people.person (tenant_id, person_id, status) VALUES
  ('30000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', 'active'),
  ('30000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000002', 'active')
ON CONFLICT (tenant_id, person_id) DO NOTHING;

INSERT INTO admissions.admissions_cycle (
  tenant_id, cycle_id, name, opens_at, closes_at, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000003',
  'PILOT-13 Admissions Cycle',
  clock_timestamp() - interval '1 day',
  clock_timestamp() + interval '30 days',
  'open'
) ON CONFLICT (tenant_id, cycle_id) DO NOTHING;

INSERT INTO admissions.application_form_version (
  tenant_id, form_version_id, form_key, version, schema, published_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000004',
  'pilot-13-form',
  1,
  '{}'::jsonb,
  clock_timestamp()
) ON CONFLICT (tenant_id, form_version_id) DO NOTHING;

INSERT INTO admissions.application (
  tenant_id, application_id, application_number, cycle_id,
  applicant_person_id, submitting_guardian_person_id, form_version_id,
  status, version, submitted_at
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000005',
    'P13-APP-001',
    '64000000-0000-4000-8000-000000000003',
    '64000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000002',
    '64000000-0000-4000-8000-000000000004',
    'submitted', 3, clock_timestamp()
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000015',
    'P13-APP-002',
    '64000000-0000-4000-8000-000000000003',
    '64000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000002',
    '64000000-0000-4000-8000-000000000004',
    'submitted', 2, clock_timestamp()
  )
ON CONFLICT (tenant_id, application_id) DO NOTHING;

INSERT INTO admissions.interview_event (
  tenant_id, interview_id, application_id, scheduled_at, campus_id,
  interviewer_account_ids, status
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000006',
    '64000000-0000-4000-8000-000000000005',
    clock_timestamp() + interval '1 day',
    '30000000-0000-4000-8000-000000000003',
    '["61000000-0000-4000-8000-000000000004"]'::jsonb,
    'scheduled'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000016',
    '64000000-0000-4000-8000-000000000015',
    clock_timestamp() + interval '1 day',
    '64000000-0000-4000-8000-000000000090',
    '["61000000-0000-4000-8000-000000000004"]'::jsonb,
    'scheduled'
  )
ON CONFLICT (tenant_id, interview_id) DO NOTHING;

-- PILOT-13 Finance fixtures: balanced posted journal, settled payment and unmatched statement line.
INSERT INTO ledger.book (
  tenant_id, legal_entity_id, book_id, code, name, base_currency, active
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000001',
  'P13', 'PILOT-13 Book', 'BDT', true
) ON CONFLICT (tenant_id, legal_entity_id, book_id) DO NOTHING;

INSERT INTO ledger.fiscal_period (
  tenant_id, legal_entity_id, book_id, fiscal_period_id,
  period_code, starts_on, ends_on, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000002',
  'P13-2026', CURRENT_DATE - 30, CURRENT_DATE + 30, 'open'
) ON CONFLICT (tenant_id, legal_entity_id, fiscal_period_id) DO NOTHING;

INSERT INTO ledger.account (
  tenant_id, legal_entity_id, book_id, account_id, account_code,
  account_name, account_type, natural_balance, active
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000001',
    '65000000-0000-4000-8000-000000000003',
    'P13-CASH', 'PILOT-13 Cash', 'asset', 'debit', true
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000001',
    '65000000-0000-4000-8000-000000000004',
    'P13-INCOME', 'PILOT-13 Income', 'income', 'credit', true
  )
ON CONFLICT (tenant_id, legal_entity_id, account_id) DO NOTHING;

INSERT INTO ledger.journal_entry (
  tenant_id, legal_entity_id, book_id, fiscal_period_id, journal_entry_id,
  entry_date, description, source_document_type, source_document_id,
  correlation_id, idempotency_key, status, created_by, posted_by, posted_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000005',
  CURRENT_DATE,
  'PILOT-13 settled payment journal',
  'payment', 'pilot-13-payment', 'pilot-13-finance-journal',
  'pilot-13-finance-journal', 'posted', 'pilot-13-fixture',
  'pilot-13-fixture', clock_timestamp()
) ON CONFLICT (tenant_id, legal_entity_id, journal_entry_id) DO NOTHING;

INSERT INTO ledger.journal_line (
  tenant_id, legal_entity_id, journal_entry_id, journal_line_id,
  line_number, account_id, side, amount_minor, currency, description
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000005',
    '65000000-0000-4000-8000-000000000006',
    1, '65000000-0000-4000-8000-000000000003', 'debit', 5000, 'BDT', 'Cash received'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000005',
    '65000000-0000-4000-8000-000000000007',
    2, '65000000-0000-4000-8000-000000000004', 'credit', 5000, 'BDT', 'Payment clearing'
  )
ON CONFLICT (tenant_id, legal_entity_id, journal_line_id) DO NOTHING;

INSERT INTO billing.billing_account (
  tenant_id, legal_entity_id, billing_account_id, account_holder_ref, currency, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000010',
  'person:64000000-0000-4000-8000-000000000001', 'BDT', 'active'
) ON CONFLICT (tenant_id, legal_entity_id, billing_account_id) DO NOTHING;

INSERT INTO billing.payment_intent (
  tenant_id, legal_entity_id, payment_intent_id, billing_account_id,
  amount_minor, currency, provider, provider_intent_id, status,
  created_by, expires_at, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000011',
  '65000000-0000-4000-8000-000000000010',
  5000, 'BDT', 'pilot-13', 'pilot-13-intent', 'authorized',
  'pilot-13-fixture', clock_timestamp() + interval '1 hour',
  'pilot-13-intent-0001'
) ON CONFLICT (tenant_id, legal_entity_id, payment_intent_id) DO NOTHING;

INSERT INTO billing.payment_record (
  tenant_id, legal_entity_id, payment_id, billing_account_id,
  payment_intent_id, provider, provider_payment_id, provider_event_id,
  receipt_number, amount_minor, currency, status, allocated_minor,
  refunded_minor, unapplied_minor, received_at, verified_by, journal_entry_id
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000012',
  '65000000-0000-4000-8000-000000000010',
  '65000000-0000-4000-8000-000000000011',
  'pilot-13', 'pilot-13-payment', 'pilot-13-provider-event', 'P13-R-0001',
  5000, 'BDT', 'settled', 0, 0, 5000, clock_timestamp(),
  'account:62000000-0000-4000-8000-000000000004',
  '65000000-0000-4000-8000-000000000005'
) ON CONFLICT (tenant_id, legal_entity_id, payment_id) DO NOTHING;

INSERT INTO billing.bank_statement_line (
  tenant_id, legal_entity_id, bank_statement_line_id, bank_account_ref,
  statement_ref, line_number, booking_date, amount_minor, currency,
  description, external_reference, import_hash, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000013',
  'pilot-13-bank', 'pilot-13-statement', 1, CURRENT_DATE, 5000, 'BDT',
  'PILOT-13 exact settled payment', 'pilot-13-payment', repeat('c', 64), 'unmatched'
) ON CONFLICT (tenant_id, legal_entity_id, bank_statement_line_id) DO NOTHING;

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000090',
  'PILOT-13 Other Legal Entity', 'BD', 'BDT'
) ON CONFLICT (tenant_id, legal_entity_id) DO NOTHING;

INSERT INTO billing.bank_statement_line (
  tenant_id, legal_entity_id, bank_statement_line_id, bank_account_ref,
  statement_ref, line_number, booking_date, amount_minor, currency,
  description, external_reference, import_hash, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000090',
  '65000000-0000-4000-8000-000000000093',
  'pilot-13-other-bank', 'pilot-13-other-statement', 1, CURRENT_DATE, 5000, 'BDT',
  'Cross legal-entity line', 'pilot-13-other', repeat('d', 64), 'unmatched'
) ON CONFLICT (tenant_id, legal_entity_id, bank_statement_line_id) DO NOTHING;

SET ROLE app_runtime;

DO $authorization$
DECLARE
  decision jsonb;
BEGIN
  decision := iam.evaluate_browser_permission('61000000-0000-4000-8000-000000000008', 'admissions.application.review');
  IF COALESCE((decision->>'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'admissions allowed permission was denied: %', decision;
  END IF;
  decision := iam.evaluate_browser_permission('61000000-0000-4000-8000-000000000008', 'finance.receipt.create');
  IF decision->>'reason' <> 'permission-not-granted' THEN
    RAISE EXCEPTION 'admissions finance denial failed: %', decision;
  END IF;

  decision := iam.evaluate_browser_permission('62000000-0000-4000-8000-000000000008', 'finance.reconciliation.write');
  IF COALESCE((decision->>'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'finance allowed permission was denied: %', decision;
  END IF;
  decision := iam.evaluate_browser_permission('62000000-0000-4000-8000-000000000008', 'finance.refund.approve');
  IF decision->>'reason' <> 'permission-not-granted' THEN
    RAISE EXCEPTION 'cashier refund approval denial failed: %', decision;
  END IF;

  decision := iam.evaluate_browser_permission('63000000-0000-4000-8000-000000000008', 'support.break-glass.request');
  IF decision->>'reason' <> 'step-up-required' OR decision->>'requiredAssurance' <> 'aal2' THEN
    RAISE EXCEPTION 'support AAL1 step-up contract failed: %', decision;
  END IF;
  decision := iam.evaluate_browser_permission('63000000-0000-4000-8000-000000000009', 'support.break-glass.request');
  IF COALESCE((decision->>'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'support AAL2 permission was denied: %', decision;
  END IF;
  decision := iam.evaluate_browser_permission('63000000-0000-4000-8000-000000000009', 'platform.tenant.mutate');
  IF decision->>'reason' <> 'permission-not-granted' THEN
    RAISE EXCEPTION 'support tenant-mutation denial failed: %', decision;
  END IF;
END
$authorization$;

DO $mutations$
DECLARE
  admissions_result jsonb;
  finance_result jsonb;
  support_result jsonb;
  replay_result jsonb;
BEGIN
  admissions_result := platform.submit_runtime_snapshot_refresh(
    '61000000-0000-4000-8000-000000000008',
    'persona-admissions-e2e-001',
    1,
    'Admissions persona persisted E2E evidence',
    '61000000-0000-4000-8000-000000000010'
  );
  IF COALESCE((admissions_result->>'accepted')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'admissions persisted mutation failed: %', admissions_result;
  END IF;

  finance_result := platform.submit_runtime_snapshot_refresh(
    '62000000-0000-4000-8000-000000000008',
    'persona-finance-e2e-001',
    1,
    'Finance persona persisted E2E evidence',
    '62000000-0000-4000-8000-000000000010'
  );
  IF COALESCE((finance_result->>'accepted')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'finance persisted mutation failed: %', finance_result;
  END IF;

  support_result := platform.submit_runtime_snapshot_refresh(
    '63000000-0000-4000-8000-000000000009',
    'persona-support-e2e-001',
    1,
    'Support persona persisted E2E evidence',
    '63000000-0000-4000-8000-000000000010'
  );
  IF COALESCE((support_result->>'accepted')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'support persisted mutation failed: %', support_result;
  END IF;

  replay_result := platform.submit_runtime_snapshot_refresh(
    '62000000-0000-4000-8000-000000000008',
    'persona-finance-e2e-001',
    1,
    'Finance persona persisted E2E evidence',
    '62000000-0000-4000-8000-000000000011'
  );
  IF COALESCE((replay_result->>'accepted')::boolean, false) IS NOT TRUE
     OR COALESCE((replay_result->>'replayed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'finance idempotent replay failed: %', replay_result;
  END IF;
END
$mutations$;

DO $operator_domain_privilege_contract$
BEGIN
  IF has_table_privilege(current_user, 'platform.operator_domain_command_receipt', 'SELECT')
     OR has_table_privilege(current_user, 'platform.operator_domain_command_receipt', 'INSERT')
     OR has_table_privilege(current_user, 'iam.privileged_access_grant', 'INSERT')
     OR has_function_privilege(
       current_user,
       'platform.resolve_operator_domain_command_session(uuid)',
       'EXECUTE'
     ) IS TRUE THEN
    RAISE EXCEPTION 'operator domain command direct-access boundary is not least privilege';
  END IF;
  IF NOT has_function_privilege(
       current_user,
       'admissions.record_application_review_command(uuid,uuid,bigint,text,numeric,text,text,uuid)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       current_user,
       'billing.reconcile_bank_statement_line_command(uuid,uuid,uuid,text,text,uuid)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       current_user,
       'iam.request_privileged_support_access_command(uuid,text,integer,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'operator domain command execute grants are incomplete';
  END IF;
END
$operator_domain_privilege_contract$;

DO $operator_domain_commands$
DECLARE
  result jsonb;
  replay jsonb;
BEGIN
  result := admissions.record_application_review_command(
    '61000000-0000-4000-8000-000000000008',
    '64000000-0000-4000-8000-000000000005',
    3,
    'more-information',
    82.5,
    'Request one additional verified school record before the decision review.',
    'domain-admissions-0001',
    '64000000-0000-4000-8000-000000000020'
  );
  IF result->>'accepted' <> 'true' OR result->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'Admissions domain review failed: %', result;
  END IF;

  replay := admissions.record_application_review_command(
    '61000000-0000-4000-8000-000000000008',
    '64000000-0000-4000-8000-000000000005',
    3,
    'more-information',
    82.5,
    'Request one additional verified school record before the decision review.',
    'domain-admissions-0001',
    '64000000-0000-4000-8000-000000000020'
  );
  IF replay->>'accepted' <> 'true' OR replay->>'replayed' <> 'true' THEN
    RAISE EXCEPTION 'Admissions exact replay failed: %', replay;
  END IF;

  result := admissions.record_application_review_command(
    '61000000-0000-4000-8000-000000000008',
    '64000000-0000-4000-8000-000000000005',
    3,
    'more-information',
    82.5,
    'A different review request under the same key.',
    'domain-admissions-0001',
    '64000000-0000-4000-8000-000000000021'
  );
  IF result <> '{"accepted": false, "reason": "idempotency-conflict"}'::jsonb THEN
    RAISE EXCEPTION 'Admissions changed-request replay must conflict: %', result;
  END IF;

  result := admissions.record_application_review_command(
    '61000000-0000-4000-8000-000000000008',
    '64000000-0000-4000-8000-000000000005',
    3,
    'more-information',
    82.5,
    'A stale independent review request.',
    'domain-admissions-stale-01',
    '64000000-0000-4000-8000-000000000022'
  );
  IF result <> '{"accepted": false, "reason": "revision-conflict", "currentVersion": 4}'::jsonb THEN
    RAISE EXCEPTION 'Admissions optimistic concurrency failed: %', result;
  END IF;

  result := admissions.record_application_review_command(
    '61000000-0000-4000-8000-000000000008',
    '64000000-0000-4000-8000-000000000015',
    2,
    'more-information',
    80,
    'Cross-campus application review must fail closed.',
    'domain-admissions-cross-01',
    '64000000-0000-4000-8000-000000000023'
  );
  IF result <> '{"accepted": false, "reason": "scope-not-found"}'::jsonb THEN
    RAISE EXCEPTION 'Admissions cross-campus review was not denied: %', result;
  END IF;

  result := billing.reconcile_bank_statement_line_command(
    '62000000-0000-4000-8000-000000000008',
    '65000000-0000-4000-8000-000000000013',
    '65000000-0000-4000-8000-000000000012',
    'Verified the bank reference, amount and currency against the settled receipt.',
    'domain-finance-0001',
    '65000000-0000-4000-8000-000000000020'
  );
  IF result->>'accepted' <> 'true' OR result->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'Finance reconciliation failed: %', result;
  END IF;

  replay := billing.reconcile_bank_statement_line_command(
    '62000000-0000-4000-8000-000000000008',
    '65000000-0000-4000-8000-000000000013',
    '65000000-0000-4000-8000-000000000012',
    'Verified the bank reference, amount and currency against the settled receipt.',
    'domain-finance-0001',
    '65000000-0000-4000-8000-000000000020'
  );
  IF replay->>'accepted' <> 'true' OR replay->>'replayed' <> 'true' THEN
    RAISE EXCEPTION 'Finance exact replay failed: %', replay;
  END IF;

  result := billing.reconcile_bank_statement_line_command(
    '62000000-0000-4000-8000-000000000008',
    '65000000-0000-4000-8000-000000000013',
    '65000000-0000-4000-8000-000000000012',
    'A different reconciliation reason under the same idempotency key.',
    'domain-finance-0001',
    '65000000-0000-4000-8000-000000000021'
  );
  IF result <> '{"accepted": false, "reason": "idempotency-conflict"}'::jsonb THEN
    RAISE EXCEPTION 'Finance changed-request replay must conflict: %', result;
  END IF;

  result := billing.reconcile_bank_statement_line_command(
    '62000000-0000-4000-8000-000000000008',
    '65000000-0000-4000-8000-000000000093',
    '65000000-0000-4000-8000-000000000012',
    'Cross legal-entity reconciliation must fail closed.',
    'domain-finance-cross-01',
    '65000000-0000-4000-8000-000000000022'
  );
  IF result <> '{"accepted": false, "reason": "scope-not-found"}'::jsonb THEN
    RAISE EXCEPTION 'Finance cross-legal-entity line was not denied: %', result;
  END IF;

  result := iam.request_privileged_support_access_command(
    '63000000-0000-4000-8000-000000000008',
    'Investigate a tenant-scoped authentication outage using approved diagnostics.',
    15,
    'domain-support-aal1-01',
    '66000000-0000-4000-8000-000000000019'
  );
  IF result <> '{"accepted": false, "reason": "step-up-required", "requiredAssurance": "aal2"}'::jsonb THEN
    RAISE EXCEPTION 'Support AAL1 command must require step-up: %', result;
  END IF;

  result := iam.request_privileged_support_access_command(
    '63000000-0000-4000-8000-000000000009',
    'Investigate a tenant-scoped authentication outage using approved diagnostics.',
    15,
    'domain-support-0001',
    '66000000-0000-4000-8000-000000000020'
  );
  IF result->>'accepted' <> 'true' OR result->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'Support pending break-glass request failed: %', result;
  END IF;

  replay := iam.request_privileged_support_access_command(
    '63000000-0000-4000-8000-000000000009',
    'Investigate a tenant-scoped authentication outage using approved diagnostics.',
    15,
    'domain-support-0001',
    '66000000-0000-4000-8000-000000000020'
  );
  IF replay->>'accepted' <> 'true' OR replay->>'replayed' <> 'true' THEN
    RAISE EXCEPTION 'Support exact replay failed: %', replay;
  END IF;

  result := iam.request_privileged_support_access_command(
    '63000000-0000-4000-8000-000000000009',
    'Investigate a tenant-scoped authentication outage using approved diagnostics.',
    20,
    'domain-support-0001',
    '66000000-0000-4000-8000-000000000021'
  );
  IF result <> '{"accepted": false, "reason": "idempotency-conflict"}'::jsonb THEN
    RAISE EXCEPTION 'Support changed-request replay must conflict: %', result;
  END IF;
END
$operator_domain_commands$;

RESET ROLE;

DO $operator_domain_evidence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.operator_domain_command_receipt
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND command_type IN (
        'admissions.application.review.record',
        'finance.bank-line.reconcile',
        'support.break-glass.request'
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three accepted operator domain command receipts must persist';
  END IF;

  IF (
    SELECT count(*)
    FROM admissions.application_review
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND application_id = '64000000-0000-4000-8000-000000000005'
      AND reviewer_account_id = '61000000-0000-4000-8000-000000000004'
  ) <> 1 OR (
    SELECT version
    FROM admissions.application
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND application_id = '64000000-0000-4000-8000-000000000005'
  ) <> 4 THEN
    RAISE EXCEPTION 'Admissions review evidence or optimistic version is incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM billing.bank_statement_line
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND legal_entity_id = '30000000-0000-4000-8000-000000000002'
      AND bank_statement_line_id = '65000000-0000-4000-8000-000000000013'
      AND status = 'reconciled'
      AND matched_payment_id = '65000000-0000-4000-8000-000000000012'
      AND matched_by = 'account:62000000-0000-4000-8000-000000000004'
      AND matched_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Finance bank-line reconciliation evidence is incorrect';
  END IF;

  IF (
    SELECT count(*)
    FROM iam.privileged_access_grant
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND principal_account_id = '63000000-0000-4000-8000-000000000004'
      AND reason = 'Investigate a tenant-scoped authentication outage using approved diagnostics.'
      AND approved_by_account_id IS NULL
      AND approved_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > requested_at
      AND expires_at <= requested_at + interval '30 minutes'
  ) <> 1 THEN
    RAISE EXCEPTION 'Support command must create exactly one pending, time-bounded request';
  END IF;

  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE correlation_id IN (
      '64000000-0000-4000-8000-000000000020',
      '65000000-0000-4000-8000-000000000020',
      '66000000-0000-4000-8000-000000000020'
    )
  ) <> 3 THEN
    RAISE EXCEPTION 'operator domain commands must retain three audit events';
  END IF;

  IF (
    SELECT count(*)
    FROM integration_core.outbox_event
    WHERE correlation_id IN (
      '64000000-0000-4000-8000-000000000020',
      '65000000-0000-4000-8000-000000000020',
      '66000000-0000-4000-8000-000000000020'
    )
  ) <> 3 THEN
    RAISE EXCEPTION 'operator domain commands must retain three outbox events';
  END IF;
END
$operator_domain_evidence$;

DO $evidence$
DECLARE
  receipt_count integer;
  audit_count integer;
  outbox_count integer;
  decision jsonb;
BEGIN
  SELECT count(*) INTO receipt_count
  FROM platform.runtime_command_receipt
  WHERE session_id IN (
    '61000000-0000-4000-8000-000000000008'::uuid,
    '62000000-0000-4000-8000-000000000008'::uuid,
    '63000000-0000-4000-8000-000000000009'::uuid
  );
  IF receipt_count <> 3 THEN
    RAISE EXCEPTION 'expected three persona mutation receipts, got %', receipt_count;
  END IF;

  SELECT count(*) INTO audit_count
  FROM audit.audit_event
  WHERE correlation_id IN (
    '61000000-0000-4000-8000-000000000010',
    '62000000-0000-4000-8000-000000000010',
    '63000000-0000-4000-8000-000000000010'
  );
  IF audit_count <> 3 THEN
    RAISE EXCEPTION 'expected three persona audit events, got %', audit_count;
  END IF;

  SELECT count(*) INTO outbox_count
  FROM integration_core.outbox_event
  WHERE correlation_id IN (
    '61000000-0000-4000-8000-000000000010',
    '62000000-0000-4000-8000-000000000010',
    '63000000-0000-4000-8000-000000000010'
  );
  IF outbox_count <> 3 THEN
    RAISE EXCEPTION 'expected three persona outbox events, got %', outbox_count;
  END IF;

  IF NOT iam.revoke_browser_session(
    '62000000-0000-4000-8000-000000000008',
    'persona E2E revocation proof'
  ) THEN
    RAISE EXCEPTION 'finance session revocation failed';
  END IF;
  decision := iam.evaluate_browser_permission(
    '62000000-0000-4000-8000-000000000008',
    'finance.reconciliation.write'
  );
  IF decision->>'reason' <> 'session-inactive' THEN
    RAISE EXCEPTION 'revoked finance session remained active: %', decision;
  END IF;
END
$evidence$;

SELECT json_build_object(
  'personas', ARRAY['admissions','finance','support'],
  'persisted_receipts', (
    SELECT count(*) FROM platform.runtime_command_receipt
    WHERE session_id IN (
      '61000000-0000-4000-8000-000000000008'::uuid,
      '62000000-0000-4000-8000-000000000008'::uuid,
      '63000000-0000-4000-8000-000000000009'::uuid
    )
  ),
  'operator_domain_receipts', (SELECT count(*) FROM platform.operator_domain_command_receipt),
  'audit_events', (
    SELECT count(*) FROM audit.audit_event
    WHERE correlation_id IN (
      '61000000-0000-4000-8000-000000000010',
      '62000000-0000-4000-8000-000000000010',
      '63000000-0000-4000-8000-000000000010'
    )
  )
);
SQL
