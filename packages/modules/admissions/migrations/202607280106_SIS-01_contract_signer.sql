ALTER TABLE admissions.enrollment_contract
  ADD COLUMN IF NOT EXISTS signed_by_account_id uuid,
  ADD COLUMN IF NOT EXISTS signed_by_person_id uuid;

DO $sis_contract_signer_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollment_contract_signed_by_account_fk'
      AND conrelid = 'admissions.enrollment_contract'::regclass
  ) THEN
    ALTER TABLE admissions.enrollment_contract
      ADD CONSTRAINT enrollment_contract_signed_by_account_fk
      FOREIGN KEY (signed_by_account_id) REFERENCES iam.account (account_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollment_contract_signed_by_person_fk'
      AND conrelid = 'admissions.enrollment_contract'::regclass
  ) THEN
    ALTER TABLE admissions.enrollment_contract
      ADD CONSTRAINT enrollment_contract_signed_by_person_fk
      FOREIGN KEY (tenant_id, signed_by_person_id)
      REFERENCES people.person (tenant_id, person_id);
  END IF;
END
$sis_contract_signer_fk$;

DO $sis_contract_signer_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollment_contract_signer_required'
      AND conrelid = 'admissions.enrollment_contract'::regclass
  ) THEN
    ALTER TABLE admissions.enrollment_contract
      ADD CONSTRAINT enrollment_contract_signer_required CHECK (
        status <> 'signed'
        OR (
          signed_at IS NOT NULL
          AND signed_by_account_id IS NOT NULL
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM admissions.enrollment_contract
    WHERE status = 'signed'
      AND (
        signed_at IS NULL
        OR signed_by_account_id IS NULL
      )
  ) THEN
    ALTER TABLE admissions.enrollment_contract
      VALIDATE CONSTRAINT enrollment_contract_signer_required;
  END IF;
END
$sis_contract_signer_check$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280106_SIS-01_contract_signer',
  'SIS-01',
  'Accountable account and person evidence for enrollment contract signatures'
)
ON CONFLICT (migration_id) DO NOTHING;
