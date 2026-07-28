CREATE SCHEMA IF NOT EXISTS student_lifecycle;
GRANT USAGE ON SCHEMA student_lifecycle TO app_runtime;

CREATE TABLE IF NOT EXISTS student_lifecycle.student_profile (
  tenant_id uuid NOT NULL,
  student_profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'prospective'
    CHECK (status IN ('prospective', 'active', 'leave', 'withdrawn', 'graduated', 'alumni')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, student_profile_id),
  UNIQUE (tenant_id, person_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.staff_profile (
  tenant_id uuid NOT NULL,
  staff_profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'leave', 'inactive', 'terminated')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, staff_profile_id),
  UNIQUE (tenant_id, person_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.student_status_history (
  tenant_id uuid NOT NULL,
  status_history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  status text NOT NULL
    CHECK (status IN ('prospective', 'active', 'leave', 'withdrawn', 'graduated', 'alumni')),
  reason_code text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, status_history_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS current_student_status_unique
  ON student_lifecycle.student_status_history (tenant_id, student_profile_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS student_lifecycle.staff_status_history (
  tenant_id uuid NOT NULL,
  status_history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_profile_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'leave', 'inactive', 'terminated')),
  reason_code text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, status_history_id),
  FOREIGN KEY (tenant_id, staff_profile_id)
    REFERENCES student_lifecycle.staff_profile (tenant_id, staff_profile_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS current_staff_status_unique
  ON student_lifecycle.staff_status_history (tenant_id, staff_profile_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS student_lifecycle.profile_identifier (
  tenant_id uuid NOT NULL,
  profile_identifier_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_kind text NOT NULL CHECK (profile_kind IN ('student', 'staff')),
  profile_id uuid NOT NULL,
  identifier_type text NOT NULL,
  identifier_value citext NOT NULL,
  campus_id uuid,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, profile_identifier_id),
  UNIQUE (tenant_id, identifier_type, identifier_value),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.profile_document (
  tenant_id uuid NOT NULL,
  profile_document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_kind text NOT NULL CHECK (profile_kind IN ('student', 'staff')),
  profile_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_type text NOT NULL,
  visibility text NOT NULL DEFAULT 'restricted'
    CHECK (visibility IN ('standard', 'restricted', 'guardian-visible')),
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, profile_document_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS student_lifecycle.lifecycle_access_effect (
  tenant_id uuid NOT NULL,
  access_effect_id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_kind text NOT NULL CHECK (profile_kind IN ('student', 'staff')),
  profile_id uuid NOT NULL,
  source_status text NOT NULL,
  interactive_access text NOT NULL CHECK (interactive_access IN ('enabled', 'suspended', 'revoked')),
  guardian_portal_visibility text
    CHECK (guardian_portal_visibility IN ('visible', 'historical', 'hidden')),
  operational_expectations text NOT NULL CHECK (operational_expectations IN ('active', 'paused', 'closed')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, access_effect_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

DO $sis_profiles_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'student_profile', 'staff_profile', 'student_status_history', 'staff_status_history',
    'profile_identifier', 'profile_document', 'lifecycle_access_effect'
  ]
  LOOP
    EXECUTE format('ALTER TABLE student_lifecycle.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE student_lifecycle.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON student_lifecycle.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON student_lifecycle.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON student_lifecycle.%I TO app_runtime',
      table_name
    );
  END LOOP;
END
$sis_profiles_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280102_SIS-01_profiles',
  'SIS-01',
  'Student and staff profiles, effective status history, identifiers, documents and access effects'
)
ON CONFLICT (migration_id) DO NOTHING;
