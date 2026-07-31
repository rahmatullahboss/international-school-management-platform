from pathlib import Path


def replace_exact(text: str, old: str, new: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'expected {expected} occurrence(s), found {count}: {old[:140]!r}')
    return text.replace(old, new, expected)


index_path = Path('apps/platform-api/src/index.ts')
index = index_path.read_text()
index = replace_exact(
    index,
    "export * from './database-teacher-projection-composer-store.js';\n",
    "export * from './database-teacher-projection-composer-store.js';\n"
    "export * from './runtime-guardian-projection-composer.js';\n"
    "export * from './database-guardian-projection-composer-store.js';\n",
)
index_path.write_text(index)

verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()
verification = replace_exact(
    verification,
    "manifest.gate !== 'GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1'",
    "manifest.gate !== 'GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1'",
)
verification = replace_exact(
    verification,
    "if (migrations.length !== 9) {\n  throw new Error(`expected nine post-integration migrations, got ${migrations.length}`);\n}",
    "if (migrations.length !== 10) {\n  throw new Error(`expected ten post-integration migrations, got ${migrations.length}`);\n}",
)
verification = replace_exact(
    verification,
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09'].includes(migration.stream)",
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10'].includes(migration.stream)",
)
verification = replace_exact(
    verification,
    "IF (SELECT count(*) FROM platform.schema_migration) <> 49 THEN\n    RAISE EXCEPTION 'expected 49 total migration ledger rows';",
    "IF (SELECT count(*) FROM platform.schema_migration) <> 50 THEN\n    RAISE EXCEPTION 'expected 50 total migration ledger rows';",
)
verification = replace_exact(
    verification,
    "OR to_regprocedure('platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL THEN",
    "OR to_regprocedure('platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL\n"
    "     OR to_regprocedure('platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL THEN",
)

marker = """SET ROLE app_runtime;
DO $account_revoke_verification$
"""
if verification.count(marker) != 1:
    raise SystemExit('expected one account revocation insertion marker')

guardian_probe = r'''

DO $guardian_composer_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'guardian composer execute grants are not least privilege';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_composition_run
    WHERE persona NOT IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'existing composition evidence persona backfill changed unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.person_link',
      'people.guardian_student_authority',
      'student_lifecycle.student_profile',
      'student_lifecycle.enrollment',
      'attendance.attendance_record',
      'gradebook.grade_publication',
      'billing.responsible_party',
      'billing.invoice'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'guardian composer role must retain function-only domain access';
  END IF;
END
$guardian_composer_privilege_contract$;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-000000000080',
  'https://identity.school.test',
  'provider-guardian-123',
  'guardian-test@school.test',
  'aal2'
);

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000082',
  'pilot-test-guardian',
  'Pilot Test Guardian',
  false
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000080',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000082'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000082',
  'runtime.snapshot.refresh'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000084',
  'https://identity.school.test',
  'provider-guardian-123',
  '30000000-0000-4000-8000-000000000080',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000084',
  '30000000-0000-4000-8000-000000000082'
);

SET ROLE app_projection_admin;
DO $guardian_composer_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000082',
    'guardian',
    'governance:pilot-10'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'guardian' THEN
    RAISE EXCEPTION 'guardian persona mapping must configure: %', result;
  END IF;
END
$guardian_composer_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $guardian_composer_unlinked_person$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    0,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a0'
  );
  IF result <> '{"composed": false, "reason": "guardian-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'guardian without database-owned person linkage must fail: %', result;
  END IF;
END
$guardian_composer_unlinked_person$;
RESET ROLE;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000081',
  'active'
);

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000080',
  '30000000-0000-4000-8000-000000000081'
);

SET ROLE app_projection_composer;
DO $guardian_composer_without_authority$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    0,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a1'
  );
  IF result <> '{"composed": false, "reason": "authority-unavailable"}'::jsonb THEN
    RAISE EXCEPTION 'guardian without verified child authority must fail: %', result;
  END IF;
END
$guardian_composer_without_authority$;
RESET ROLE;

INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, billing_authority, portal_access,
  verification_status, effective_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000086',
  '30000000-0000-4000-8000-000000000081',
  '30000000-0000-4000-8000-000000000030',
  true,
  true,
  true,
  'verified',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

-- A same-campus child without verified authority must remain invisible.
INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b4',
  'active'
);
INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b5',
  '30000000-0000-4000-8000-0000000000b4',
  'active'
);
INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b6',
  '30000000-0000-4000-8000-0000000000b5',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000036',
  '30000000-0000-4000-8000-000000000037',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'pilot-10-unverified-child-01'
);
INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, portal_access, verification_status, effective_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b7',
  '30000000-0000-4000-8000-000000000081',
  '30000000-0000-4000-8000-0000000000b4',
  true,
  true,
  'pending',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

-- A verified child enrolled in another campus must remain outside this membership scope.
INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b0',
  'active'
);
INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b1',
  '30000000-0000-4000-8000-0000000000b0',
  'active'
);
INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b2',
  '30000000-0000-4000-8000-0000000000b1',
  '30000000-0000-4000-8000-000000000078',
  '30000000-0000-4000-8000-000000000036',
  '30000000-0000-4000-8000-000000000037',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'pilot-10-cross-campus-child-01'
);
INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, billing_authority, portal_access,
  verification_status, effective_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b3',
  '30000000-0000-4000-8000-000000000081',
  '30000000-0000-4000-8000-0000000000b0',
  true,
  true,
  true,
  'verified',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

INSERT INTO attendance.attendance_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  minimum_present_minutes, late_after_minutes,
  chronic_absence_threshold_percent, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000087',
  'pilot-10-guardian-attendance',
  'v1',
  1,
  5,
  10,
  'published'
);
INSERT INTO attendance.attendance_code (
  tenant_id, attendance_code_id, policy_version_id, code, label,
  meaning, counts_as_present
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000088',
    '30000000-0000-4000-8000-000000000087',
    'A',
    'Absent',
    'absent',
    false
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000089',
    '30000000-0000-4000-8000-000000000087',
    'P',
    'Present',
    'present',
    true
  );
INSERT INTO attendance.attendance_session (
  tenant_id, session_id, scheduled_meeting_id, section_id, campus_id,
  local_date, starts_at, ends_at, timezone, roster_student_ids, session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008a',
  '30000000-0000-4000-8000-00000000008c',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '12:00',
  TIME '12:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);
INSERT INTO attendance.attendance_record (
  tenant_id, attendance_record_id, client_record_id, session_id,
  student_profile_id, attendance_code_id, record_source, recorded_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008b',
  'pilot-10-guardian-attendance-01',
  '30000000-0000-4000-8000-00000000008a',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000088',
  'guardian',
  '30000000-0000-4000-8000-000000000080'
);

INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  calculation_mode, missing_score_treatment, rounding_decimals, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008d',
  'pilot-10-guardian-grade-policy',
  'v1',
  'traditional',
  'exclude',
  2,
  'published'
);
INSERT INTO gradebook.grade_calculation_snapshot (
  tenant_id, snapshot_id, section_id, reporting_period_id,
  student_profile_id, policy_version_id, category_percentages,
  calculated_percent, displayed_grade, formula
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008e',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-00000000008d',
  '{"coursework":85}'::jsonb,
  85,
  'A',
  'published guardian fixture'
);
INSERT INTO gradebook.grade_publication (
  tenant_id, publication_id, snapshot_id, available_from, published_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008f',
  '30000000-0000-4000-8000-00000000008e',
  clock_timestamp() - interval '1 day',
  '30000000-0000-4000-8000-000000000080'
);

INSERT INTO ledger.book (
  tenant_id, legal_entity_id, book_id, code, name, base_currency
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000090',
  'PILOT10',
  'Pilot 10 Book',
  'BDT'
);
INSERT INTO ledger.fiscal_period (
  tenant_id, legal_entity_id, book_id, fiscal_period_id,
  period_code, starts_on, ends_on, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000090',
  '30000000-0000-4000-8000-000000000091',
  'PILOT10',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 30,
  'open'
);
INSERT INTO ledger.account (
  tenant_id, legal_entity_id, book_id, account_id,
  account_code, account_name, account_type, natural_balance
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000090',
    '30000000-0000-4000-8000-000000000092',
    'AR-P10',
    'Guardian receivable',
    'asset',
    'debit'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000090',
    '30000000-0000-4000-8000-000000000093',
    'REV-P10',
    'Guardian fee income',
    'income',
    'credit'
  );
INSERT INTO ledger.journal_entry (
  tenant_id, legal_entity_id, book_id, fiscal_period_id, journal_entry_id,
  entry_date, description, source_document_type, source_document_id,
  correlation_id, idempotency_key, status, created_by, posted_by, posted_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000090',
  '30000000-0000-4000-8000-000000000091',
  '30000000-0000-4000-8000-000000000094',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  'Pilot guardian invoice',
  'invoice',
  'PILOT-10-INV-001',
  'pilot-10-guardian-invoice',
  'pilot-10-guardian-journal-01',
  'posted',
  'finance-preparer',
  'finance-approver',
  clock_timestamp()
);
INSERT INTO ledger.journal_line (
  tenant_id, legal_entity_id, journal_entry_id, journal_line_id,
  line_number, account_id, side, amount_minor, currency
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000094',
    '30000000-0000-4000-8000-000000000095',
    1,
    '30000000-0000-4000-8000-000000000092',
    'debit',
    1850000,
    'BDT'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000094',
    '30000000-0000-4000-8000-000000000096',
    2,
    '30000000-0000-4000-8000-000000000093',
    'credit',
    1850000,
    'BDT'
  );
INSERT INTO billing.billing_account (
  tenant_id, legal_entity_id, billing_account_id,
  account_holder_ref, currency, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000097',
  '30000000-0000-4000-8000-000000000030',
  'BDT',
  'active'
);
INSERT INTO billing.responsible_party (
  tenant_id, legal_entity_id, billing_account_id, person_ref,
  responsibility_basis_points, priority
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000097',
  '30000000-0000-4000-8000-000000000081',
  10000,
  1
);
INSERT INTO billing.invoice (
  tenant_id, legal_entity_id, invoice_id, billing_account_id,
  invoice_number, issue_date, due_date, currency, status,
  subtotal_minor, adjustment_minor, tax_minor, total_minor,
  allocated_minor, credited_minor, balance_minor, created_by,
  posted_by, posted_at, journal_entry_id, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000098',
  '30000000-0000-4000-8000-000000000097',
  'PILOT-10-INV-001',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 5,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 5,
  'BDT',
  'posted',
  1850000,
  0,
  0,
  1850000,
  0,
  0,
  1850000,
  'finance-preparer',
  'finance-approver',
  clock_timestamp(),
  '30000000-0000-4000-8000-000000000094',
  'pilot-10-guardian-invoice-01'
);

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'guardian',
  'person:30000000-0000-4000-8000-000000000081',
  3,
  '{"view":"guardian-home","source":"bootstrap"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
);

SET ROLE app_runtime;
DO $guardian_browser_session_registration$
BEGIN
  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-000000000085',
    '30000000-0000-4000-8000-000000000080',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-guardian-01',
    ARRAY['30000000-0000-4000-8000-000000000082'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'guardian browser session registration must succeed';
  END IF;
END
$guardian_browser_session_registration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $guardian_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    0,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a2'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first guardian composition must publish source revision one: %', result;
  END IF;
END
$guardian_composer_first_publication$;

DO $guardian_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    1,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a3'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'unchanged guardian data must not advance source revision: %', result;
  END IF;
END
$guardian_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_record
SET attendance_code_id = '30000000-0000-4000-8000-000000000089',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND attendance_record_id = '30000000-0000-4000-8000-00000000008b';

SET ROLE app_projection_composer;
DO $guardian_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    1,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a4'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'changed guardian data must publish source revision two: %', result;
  END IF;
END
$guardian_composer_changed_publication$;

DO $guardian_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    1,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a5'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 2}'::jsonb THEN
    RAISE EXCEPTION 'stale guardian composer revision must fail exactly: %', result;
  END IF;
END
$guardian_composer_revision_conflict$;
RESET ROLE;

UPDATE people.guardian_student_authority
SET effective_to = (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 1,
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND authority_id = '30000000-0000-4000-8000-000000000086';

SET ROLE app_projection_composer;
DO $guardian_composer_expired_authority$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    2,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a6'
  );
  IF result <> '{"composed": false, "reason": "authority-unavailable"}'::jsonb THEN
    RAISE EXCEPTION 'expired exact-campus authority must fail closed: %', result;
  END IF;
END
$guardian_composer_expired_authority$;
RESET ROLE;

UPDATE people.guardian_student_authority
SET effective_to = NULL,
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND authority_id = '30000000-0000-4000-8000-000000000086';

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000005'
);

SET ROLE app_projection_composer;
DO $guardian_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    2,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a7'
  );
  IF result <> '{"composed": false, "reason": "persona-not-guardian"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose a guardian payload: %', result;
  END IF;
END
$guardian_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000083'
  AND role_id = '30000000-0000-4000-8000-000000000005';

SET ROLE app_runtime;
DO $guardian_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-000000000085',
    'refresh-guardian-home-0001',
    3,
    'Apply the reviewed database-owned guardian home composition.',
    '30000000-0000-4000-8000-0000000000a8'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'guardian composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-08',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'guardian composition must apply through the durable worker: %', result;
  END IF;
END
$guardian_composer_end_to_end_refresh$;
RESET ROLE;

DO $guardian_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
      AND persona = 'guardian'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful guardian composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
  ) <> 2 THEN
    RAISE EXCEPTION 'guardian unchanged composition must not publish a source';
  END IF;
  IF (
    SELECT persona
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'guardian' THEN
    RAISE EXCEPTION 'guardian source must retain database-owned persona';
  END IF;
  IF (
    SELECT subject_ref
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'person:30000000-0000-4000-8000-000000000081' THEN
    RAISE EXCEPTION 'guardian source subject must derive from person linkage';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000083'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 4;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'guardian-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 1850000
     OR jsonb_array_length(projection_payload->'children') <> 1
     OR projection_payload->'children'->0->>'childId' <> '30000000-0000-4000-8000-000000000031'
     OR jsonb_array_length(projection_payload->'exceptions') <> 1
     OR projection_payload->'metrics'->0->>'capability' <> 'student.household.read'
     OR projection_payload->'metrics'->1->>'capability' <> 'attendance.household.read'
     OR projection_payload->'metrics'->2->>'capability' <> 'records.household.read'
     OR projection_payload->'metrics'->3->>'capability' <> 'finance.household.read' THEN
    RAISE EXCEPTION 'projection revision four must contain exact guardian metrics, authority and capabilities: %', projection_payload;
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.guardian.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful guardian composition must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-guardian-home-0001'
      AND applied.source_revision = 2
      AND applied.projection_revision = 4
  ) <> 1 THEN
    RAISE EXCEPTION 'guardian composer refresh must retain exact source/projection evidence';
  END IF;
END
$guardian_composer_persistence$;

'''
verification = verification.replace(marker, guardian_probe + marker, 1)
verification = replace_exact(
    verification,
    "'PILOT-07', 'PILOT-08', 'PILOT-09'))",
    "'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10'))",
    expected=2,
)
verification_path.write_text(verification)
