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

RESET ROLE;

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
