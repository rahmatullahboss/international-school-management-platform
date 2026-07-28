CREATE TABLE IF NOT EXISTS student_lifecycle.enrollment (
  tenant_id uuid NOT NULL,
  enrollment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  program_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  grade_level_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'transferred', 'withdrawn', 'completed', 'cancelled')),
  effective_from date NOT NULL,
  effective_to date,
  source_application_id uuid,
  idempotency_key text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, enrollment_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  FOREIGN KEY (tenant_id, source_application_id)
    REFERENCES admissions.application (tenant_id, application_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS current_enrollment_program_year_unique
  ON student_lifecycle.enrollment (tenant_id, student_profile_id, program_id, academic_year_id)
  WHERE effective_to IS NULL AND status IN ('pending', 'active');

CREATE OR REPLACE FUNCTION student_lifecycle.prevent_enrollment_identity_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.student_profile_id <> NEW.student_profile_id
     OR OLD.campus_id <> NEW.campus_id
     OR OLD.program_id <> NEW.program_id
     OR OLD.academic_year_id <> NEW.academic_year_id
     OR OLD.grade_level_id IS DISTINCT FROM NEW.grade_level_id
     OR OLD.effective_from <> NEW.effective_from
  THEN
    RAISE EXCEPTION 'enrollment identity and placement history are immutable';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS enrollment_identity_immutable ON student_lifecycle.enrollment;
CREATE TRIGGER enrollment_identity_immutable
  BEFORE UPDATE ON student_lifecycle.enrollment
  FOR EACH ROW EXECUTE FUNCTION student_lifecycle.prevent_enrollment_identity_rewrite();

CREATE TABLE IF NOT EXISTS student_lifecycle.enrollment_status_history (
  tenant_id uuid NOT NULL,
  status_history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  status text NOT NULL
    CHECK (status IN ('pending', 'active', 'transferred', 'withdrawn', 'completed', 'cancelled')),
  effective_from date NOT NULL,
  effective_to date,
  reason_code text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, status_history_id),
  FOREIGN KEY (tenant_id, enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS current_enrollment_status_unique
  ON student_lifecycle.enrollment_status_history (tenant_id, enrollment_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS student_lifecycle.transfer_record (
  tenant_id uuid NOT NULL,
  transfer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_enrollment_id uuid NOT NULL,
  destination_enrollment_id uuid NOT NULL,
  destination_campus_id uuid NOT NULL,
  destination_program_id uuid NOT NULL,
  transfer_date date NOT NULL,
  reason_code text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, transfer_id),
  UNIQUE (tenant_id, source_enrollment_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, source_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, destination_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, destination_campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (source_enrollment_id <> destination_enrollment_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.withdrawal_record (
  tenant_id uuid NOT NULL,
  withdrawal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  withdrawal_date date NOT NULL,
  reason_code text NOT NULL,
  destination_school text,
  destination_country_code char(2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, withdrawal_id),
  UNIQUE (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.previous_school (
  tenant_id uuid NOT NULL,
  previous_school_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  school_name text NOT NULL,
  country_code char(2) NOT NULL,
  program_name text,
  grade_level text,
  attended_from date,
  attended_to date,
  transcript_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, previous_school_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, transcript_document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (attended_to IS NULL OR attended_from IS NULL OR attended_to >= attended_from)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.admission_history (
  tenant_id uuid NOT NULL,
  admission_history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  application_id uuid,
  admitted_at date NOT NULL,
  admission_type text NOT NULL CHECK (admission_type IN ('new', 'transfer-in', 're-enrollment')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, admission_history_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, application_id)
    REFERENCES admissions.application (tenant_id, application_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.placement_history (
  tenant_id uuid NOT NULL,
  placement_history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  program_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  grade_level_id uuid,
  effective_from date NOT NULL,
  effective_to date,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, placement_history_id),
  FOREIGN KEY (tenant_id, enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.promotion_record (
  tenant_id uuid NOT NULL,
  promotion_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_enrollment_id uuid NOT NULL,
  destination_enrollment_id uuid NOT NULL,
  promoted_at date NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('promoted', 'retained', 'advanced-with-support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, promotion_id),
  UNIQUE (tenant_id, source_enrollment_id),
  FOREIGN KEY (tenant_id, source_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, destination_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.re_enrollment_record (
  tenant_id uuid NOT NULL,
  re_enrollment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  prior_enrollment_id uuid NOT NULL,
  new_enrollment_id uuid NOT NULL,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, re_enrollment_id),
  UNIQUE (tenant_id, prior_enrollment_id, new_enrollment_id),
  FOREIGN KEY (tenant_id, prior_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id),
  FOREIGN KEY (tenant_id, new_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.alumni_transition (
  tenant_id uuid NOT NULL,
  alumni_transition_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  final_enrollment_id uuid NOT NULL,
  transition_date date NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('graduated', 'withdrawn', 'completed-program')),
  alumni_access text NOT NULL CHECK (alumni_access IN ('enabled', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, alumni_transition_id),
  UNIQUE (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  FOREIGN KEY (tenant_id, final_enrollment_id)
    REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id)
);

DO $sis_enrollment_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applicant_conversion_enrollment_fk'
      AND conrelid = 'admissions.applicant_conversion'::regclass
  ) THEN
    ALTER TABLE admissions.applicant_conversion
      ADD CONSTRAINT applicant_conversion_enrollment_fk
      FOREIGN KEY (tenant_id, enrollment_id)
      REFERENCES student_lifecycle.enrollment (tenant_id, enrollment_id);
  END IF;
END
$sis_enrollment_fk$;

DO $sis_enrollment_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'enrollment', 'enrollment_status_history', 'transfer_record', 'withdrawal_record',
    'previous_school', 'admission_history', 'placement_history', 'promotion_record',
    're_enrollment_record', 'alumni_transition'
  ]
  LOOP
    EXECUTE format('ALTER TABLE student_lifecycle.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE student_lifecycle.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON student_lifecycle.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON student_lifecycle.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON student_lifecycle.%I TO app_runtime', table_name);
  END LOOP;
END
$sis_enrollment_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280104_SIS-01_enrollment',
  'SIS-01',
  'Historically correct enrollment, transfer, withdrawal, promotion, re-enrollment and alumni lifecycle'
)
ON CONFLICT (migration_id) DO NOTHING;
