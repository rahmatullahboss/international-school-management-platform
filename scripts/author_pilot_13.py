from pathlib import Path


def patch_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one marker, got {count}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))


# Harden two SQL edge cases found during review.
patch_once(
    'infra/database/post-integration-migrations/202608010501_PILOT-13_operator_domain_commands.sql',
    "     OR p_recommendation NOT IN ('admit', 'waitlist', 'decline', 'more-information')\n",
    "     OR p_recommendation IS NULL\n     OR p_recommendation NOT IN ('admit', 'waitlist', 'decline', 'more-information')\n",
)
patch_once(
    'infra/database/post-integration-migrations/202608010501_PILOT-13_operator_domain_commands.sql',
    '  SELECT count(DISTINCT campus_scope.campus_id), min(campus_scope.campus_id)\n',
    '  SELECT count(DISTINCT campus_scope.campus_id), min(campus_scope.campus_id::text)::uuid\n',
)

# Export the non-HTTP service contracts without introducing a route.
patch_once(
    'apps/platform-api/src/index.ts',
    "export * from './database-projection-source-publisher-store.js';",
    "export * from './database-projection-source-publisher-store.js';\nexport * from './operator-domain-commands.js';\nexport * from './database-operator-domain-command-store.js';",
)

# Advance the canonical post-integration verifier to the PILOT-13 manifest.
auth_path = Path('tests/integration/verify-auth-durable-context.sh')
auth = auth_path.read_text()
replacements = [
    (
        "if (manifest.gate !== 'GATE-PILOT-RUNTIME-PROJECTION-OPERATIONS-MONITOR-V1') {",
        "if (manifest.gate !== 'GATE-PILOT-OPERATOR-DOMAIN-COMMANDS-V1') {",
    ),
    ('if (migrations.length !== 12) {', 'if (migrations.length !== 13) {'),
    (
        'throw new Error(`expected twelve post-integration migrations, got ${migrations.length}`);',
        'throw new Error(`expected thirteen post-integration migrations, got ${migrations.length}`);',
    ),
    (
        "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'].includes(migration.stream)",
        "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12', 'PILOT-13'].includes(migration.stream)",
    ),
    ('IF (SELECT count(*) FROM platform.schema_migration) <> 52 THEN', 'IF (SELECT count(*) FROM platform.schema_migration) <> 53 THEN'),
    ("RAISE EXCEPTION 'expected 52 total migration ledger rows';", "RAISE EXCEPTION 'expected 53 total migration ledger rows';"),
    (
        "     OR to_regprocedure('platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)') IS NULL THEN",
        "     OR to_regprocedure('platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)') IS NULL\n     OR to_regclass('platform.operator_domain_command_receipt') IS NULL\n     OR to_regprocedure('admissions.record_application_review_command(uuid,uuid,bigint,text,numeric,text,text,uuid)') IS NULL\n     OR to_regprocedure('billing.reconcile_bank_statement_line_command(uuid,uuid,uuid,text,text,uuid)') IS NULL\n     OR to_regprocedure('iam.request_privileged_support_access_command(uuid,text,integer,text,uuid)') IS NULL THEN",
    ),
    (
        "WHERE stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'))",
        "WHERE stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12', 'PILOT-13'))",
    ),
    (
        "WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'))",
        "WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12', 'PILOT-13'))",
    ),
    (
        "      'platform.runtime_projection_composition_run'\n    ]) AS protected(table_name)",
        "      'platform.runtime_projection_composition_run',\n      'platform.operator_domain_command_receipt'\n    ]) AS protected(table_name)",
    ),
]
for old, new in replacements:
    count = auth.count(old)
    if count != 1:
        raise SystemExit(f'auth verifier marker mismatch {count}: {old[:120]!r}')
    auth = auth.replace(old, new, 1)
auth_path.write_text(auth)

# Extend the already-canonical persona verifier with real domain fixtures and command evidence.
persona_path = Path('tests/integration/verify-product-persona-e2e.sh')
persona = persona_path.read_text()
fixture_marker = "SET ROLE app_runtime;\n\nDO $authorization$"
if persona.count(fixture_marker) != 1:
    raise SystemExit('persona verifier fixture marker mismatch')
fixtures = r"""
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

DO $authorization$"""
persona = persona.replace(fixture_marker, fixtures, 1)

command_marker = "END\n$mutations$;\n\nRESET ROLE;\n\nDO $evidence$"
if persona.count(command_marker) != 1:
    raise SystemExit('persona verifier command marker mismatch')
commands = r"""END
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

DO $evidence$"""
persona = persona.replace(command_marker, commands, 1)

summary_marker = "  'audit_events', (\n    SELECT count(*) FROM audit.audit_event"
if persona.count(summary_marker) != 1:
    raise SystemExit('persona verifier summary marker mismatch')
persona = persona.replace(
    summary_marker,
    "  'operator_domain_receipts', (SELECT count(*) FROM platform.operator_domain_command_receipt),\n"
    + summary_marker,
    1,
)
persona_path.write_text(persona)
