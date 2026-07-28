#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")

migrations=(
  infra/database/migrations/202607280001_FND-01_foundation.sql
  infra/database/migrations/202607280002_FND-01_tenancy.sql
  infra/database/migrations/202607280003_FND-01_identity_policy.sql
  infra/database/migrations/202607280004_FND-01_transactional_primitives.sql
  infra/database/migrations/202607280005_FND-01_shared_services.sql
  packages/modules/people/migrations/202607280101_SIS-01_people.sql
  packages/modules/student-lifecycle/migrations/202607280102_SIS-01_profiles.sql
  packages/modules/admissions/migrations/202607280103_SIS-01_admissions.sql
  packages/modules/student-lifecycle/migrations/202607280104_SIS-01_enrollment.sql
  packages/modules/people/migrations/202607280105_SIS-01_operations.sql
  packages/modules/admissions/migrations/202607280106_SIS-01_contract_signer.sql
)

for migration in "${migrations[@]}"; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done

"${PSQL[@]}" -At <<'SQL'
DO $verification$
DECLARE
  total_migrations integer;
  sis_migrations integer;
  sis_tables integer;
  forced_rls_tables integer;
  signer_columns integer;
  signer_constraints integer;
  signer_constraint_validated boolean;
BEGIN
  SELECT count(*) INTO total_migrations FROM platform.schema_migration;
  SELECT count(*) INTO sis_migrations FROM platform.schema_migration WHERE stream_id = 'SIS-01';
  SELECT count(*) INTO sis_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname IN ('people', 'admissions', 'student_lifecycle');
  SELECT count(*) INTO forced_rls_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname IN ('people', 'admissions', 'student_lifecycle')
    AND c.relrowsecurity
    AND c.relforcerowsecurity;
  SELECT count(*) INTO signer_columns
  FROM information_schema.columns
  WHERE table_schema = 'admissions'
    AND table_name = 'enrollment_contract'
    AND column_name IN ('signed_by_account_id', 'signed_by_person_id');
  SELECT count(*) INTO signer_constraints
  FROM pg_constraint
  WHERE conrelid = 'admissions.enrollment_contract'::regclass
    AND conname IN (
      'enrollment_contract_signed_by_account_fk',
      'enrollment_contract_signed_by_person_fk',
      'enrollment_contract_signer_required'
    );
  SELECT convalidated INTO signer_constraint_validated
  FROM pg_constraint
  WHERE conrelid = 'admissions.enrollment_contract'::regclass
    AND conname = 'enrollment_contract_signer_required';

  IF total_migrations <> 11 THEN
    RAISE EXCEPTION 'expected 11 migrations, got %', total_migrations;
  END IF;
  IF sis_migrations <> 6 THEN
    RAISE EXCEPTION 'expected 6 SIS migrations, got %', sis_migrations;
  END IF;
  IF sis_tables <> 59 OR forced_rls_tables <> 59 THEN
    RAISE EXCEPTION 'expected forced RLS 59/59, got %/%', forced_rls_tables, sis_tables;
  END IF;
  IF signer_columns <> 2 OR signer_constraints <> 3 THEN
    RAISE EXCEPTION 'signer schema incomplete: columns %, constraints %', signer_columns, signer_constraints;
  END IF;
  IF signer_constraint_validated IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'fresh signer constraint was not validated';
  END IF;
END
$verification$;

SELECT json_build_object(
  'migration_count', (SELECT count(*) FROM platform.schema_migration),
  'sis_migration_count', (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'SIS-01'),
  'sis_table_count', (
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname IN ('people', 'admissions', 'student_lifecycle')
  ),
  'forced_rls', (
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN ('people', 'admissions', 'student_lifecycle')
      AND c.relrowsecurity AND c.relforcerowsecurity
  ),
  'contract_signer_columns', 2,
  'contract_signer_constraints', 3,
  'contract_signer_constraint_validated', (
    SELECT convalidated FROM pg_constraint
    WHERE conrelid = 'admissions.enrollment_contract'::regclass
      AND conname = 'enrollment_contract_signer_required'
  )
);
SQL
