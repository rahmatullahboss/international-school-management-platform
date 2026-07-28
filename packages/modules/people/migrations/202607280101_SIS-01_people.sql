CREATE SCHEMA IF NOT EXISTS people;
GRANT USAGE ON SCHEMA people TO app_runtime;

CREATE TABLE IF NOT EXISTS people.person (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  person_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deceased', 'merged')),
  date_of_birth date,
  merged_into_person_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id),
  FOREIGN KEY (tenant_id, merged_into_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (
    (status = 'merged' AND merged_into_person_id IS NOT NULL)
    OR (status <> 'merged' AND merged_into_person_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS people.person_name (
  tenant_id uuid NOT NULL,
  person_name_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  usage text NOT NULL CHECK (usage IN ('legal', 'preferred', 'former', 'local-script')),
  given_name text NOT NULL,
  middle_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  family_name text NOT NULL,
  locale text,
  script text,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_name_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS person_current_legal_name_unique
  ON people.person_name (tenant_id, person_id)
  WHERE usage = 'legal' AND effective_to IS NULL;

CREATE TABLE IF NOT EXISTS people.person_identifier (
  tenant_id uuid NOT NULL,
  person_identifier_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  identifier_type text NOT NULL,
  identifier_value citext NOT NULL,
  issuing_country char(2),
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_identifier_id),
  UNIQUE (tenant_id, identifier_type, identifier_value),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS people.contact_point (
  tenant_id uuid NOT NULL,
  contact_point_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('email', 'phone', 'messaging')),
  normalized_value citext NOT NULL,
  display_value text NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, contact_point_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id)
);
CREATE INDEX IF NOT EXISTS contact_point_lookup_idx
  ON people.contact_point (tenant_id, kind, normalized_value);

CREATE TABLE IF NOT EXISTS people.postal_address (
  tenant_id uuid NOT NULL,
  postal_address_id uuid NOT NULL DEFAULT gen_random_uuid(),
  address_lines jsonb NOT NULL,
  locality text NOT NULL,
  administrative_area text,
  postal_code text,
  country_code char(2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, postal_address_id)
);

CREATE TABLE IF NOT EXISTS people.person_address (
  tenant_id uuid NOT NULL,
  person_address_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  postal_address_id uuid NOT NULL,
  address_type text NOT NULL CHECK (address_type IN ('home', 'mailing', 'work', 'other')),
  effective_from date NOT NULL,
  effective_to date,
  PRIMARY KEY (tenant_id, person_address_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, postal_address_id)
    REFERENCES people.postal_address (tenant_id, postal_address_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS people.household (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  household_id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, household_id)
);

CREATE TABLE IF NOT EXISTS people.household_member (
  tenant_id uuid NOT NULL,
  household_member_id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  person_id uuid NOT NULL,
  member_role text NOT NULL CHECK (member_role IN ('adult', 'child', 'dependent', 'sponsor', 'other')),
  effective_from date NOT NULL,
  effective_to date,
  PRIMARY KEY (tenant_id, household_member_id),
  FOREIGN KEY (tenant_id, household_id)
    REFERENCES people.household (tenant_id, household_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS household_member_person_idx
  ON people.household_member (tenant_id, person_id, effective_from);

CREATE TABLE IF NOT EXISTS people.person_relationship (
  tenant_id uuid NOT NULL,
  relationship_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_person_id uuid NOT NULL,
  related_person_id uuid NOT NULL,
  relationship_type text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, relationship_id),
  FOREIGN KEY (tenant_id, subject_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, related_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (subject_person_id <> related_person_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS people.guardian_student_authority (
  tenant_id uuid NOT NULL,
  authority_id uuid NOT NULL DEFAULT gen_random_uuid(),
  guardian_person_id uuid NOT NULL,
  student_person_id uuid NOT NULL,
  legal_authority boolean NOT NULL DEFAULT false,
  education_authority boolean NOT NULL DEFAULT false,
  billing_authority boolean NOT NULL DEFAULT false,
  communication_authority boolean NOT NULL DEFAULT false,
  pickup_authority boolean NOT NULL DEFAULT false,
  portal_access boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  restriction_reference text,
  effective_from date NOT NULL,
  effective_to date,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, authority_id),
  FOREIGN KEY (tenant_id, guardian_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (guardian_person_id <> student_person_id),
  CHECK (
    legal_authority OR education_authority OR billing_authority
    OR communication_authority OR pickup_authority OR portal_access
  ),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS guardian_authority_student_idx
  ON people.guardian_student_authority
  (tenant_id, student_person_id, guardian_person_id, effective_from);

CREATE TABLE IF NOT EXISTS people.emergency_contact_authority (
  tenant_id uuid NOT NULL,
  emergency_contact_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_person_id uuid NOT NULL,
  contact_person_id uuid NOT NULL,
  priority integer NOT NULL CHECK (priority > 0),
  may_consent_to_emergency_care boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL,
  effective_to date,
  PRIMARY KEY (tenant_id, emergency_contact_id),
  FOREIGN KEY (tenant_id, subject_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, contact_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (subject_person_id <> contact_person_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS people.authorized_pickup (
  tenant_id uuid NOT NULL,
  authorized_pickup_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_person_id uuid NOT NULL,
  pickup_person_id uuid NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  PRIMARY KEY (tenant_id, authorized_pickup_id),
  FOREIGN KEY (tenant_id, student_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, pickup_person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (student_person_id <> pickup_person_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS people.communication_preference (
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'messaging', 'postal')),
  enabled boolean NOT NULL DEFAULT true,
  locale text,
  priority integer NOT NULL DEFAULT 1 CHECK (priority > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id, channel),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id)
);

CREATE TABLE IF NOT EXISTS people.consent_record (
  tenant_id uuid NOT NULL,
  consent_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_person_id uuid NOT NULL,
  granted_by_person_id uuid NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn', 'expired')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  evidence_document_id uuid,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, consent_id),
  FOREIGN KEY (tenant_id, subject_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, granted_by_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, evidence_document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS people.person_document (
  tenant_id uuid NOT NULL,
  person_document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_type text NOT NULL,
  valid_from date,
  valid_to date,
  visibility text NOT NULL DEFAULT 'restricted'
    CHECK (visibility IN ('standard', 'restricted', 'guardian-visible')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_document_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES integration_core.document_object (tenant_id, document_id),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS people.duplicate_candidate (
  tenant_id uuid NOT NULL,
  duplicate_candidate_id uuid NOT NULL DEFAULT gen_random_uuid(),
  left_person_id uuid NOT NULL,
  right_person_id uuid NOT NULL,
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'merged')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (tenant_id, duplicate_candidate_id),
  FOREIGN KEY (tenant_id, left_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, right_person_id)
    REFERENCES people.person (tenant_id, person_id),
  UNIQUE (tenant_id, left_person_id, right_person_id),
  CHECK (left_person_id < right_person_id)
);

CREATE TABLE IF NOT EXISTS people.person_merge_record (
  tenant_id uuid NOT NULL,
  merge_id uuid NOT NULL DEFAULT gen_random_uuid(),
  surviving_person_id uuid NOT NULL,
  merged_person_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  source_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  merged_by_account_id uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, merge_id),
  FOREIGN KEY (tenant_id, surviving_person_id)
    REFERENCES people.person (tenant_id, person_id),
  FOREIGN KEY (tenant_id, merged_person_id)
    REFERENCES people.person (tenant_id, person_id),
  UNIQUE (tenant_id, merged_person_id),
  CHECK (surviving_person_id <> merged_person_id)
);

DO $sis_people_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'person',
    'person_name',
    'person_identifier',
    'contact_point',
    'postal_address',
    'person_address',
    'household',
    'household_member',
    'person_relationship',
    'guardian_student_authority',
    'emergency_contact_authority',
    'authorized_pickup',
    'communication_preference',
    'consent_record',
    'person_document',
    'duplicate_candidate',
    'person_merge_record'
  ]
  LOOP
    EXECUTE format('ALTER TABLE people.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE people.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON people.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON people.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON people.%I TO app_runtime', table_name);
  END LOOP;
END
$sis_people_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280101_SIS-01_people',
  'SIS-01',
  'People, households, guardian authority, consent, duplicate detection and merge'
)
ON CONFLICT (migration_id) DO NOTHING;
