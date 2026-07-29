CREATE SCHEMA IF NOT EXISTS academics;

CREATE OR REPLACE FUNCTION academics.reject_published_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.publication_state = 'published' THEN
    RAISE EXCEPTION 'published academic versions are immutable';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.publication_state = 'published'
     AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)
  THEN
    RAISE EXCEPTION 'published academic versions are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;

CREATE TABLE IF NOT EXISTS academics.academic_year (
  tenant_id uuid NOT NULL,
  academic_year_id uuid NOT NULL DEFAULT gen_random_uuid(),
  year_code text NOT NULL,
  year_name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, academic_year_id),
  UNIQUE (tenant_id, year_code),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS academics.academic_term (
  tenant_id uuid NOT NULL,
  term_id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL,
  term_code text NOT NULL,
  term_name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, term_id),
  UNIQUE (tenant_id, academic_year_id, term_code),
  UNIQUE (tenant_id, academic_year_id, sequence_no),
  FOREIGN KEY (tenant_id, academic_year_id)
    REFERENCES academics.academic_year (tenant_id, academic_year_id),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS academics.instructional_calendar (
  tenant_id uuid NOT NULL,
  calendar_id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  timezone text NOT NULL,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, calendar_id),
  UNIQUE (tenant_id, academic_year_id, campus_id),
  FOREIGN KEY (tenant_id, academic_year_id)
    REFERENCES academics.academic_year (tenant_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS academics.calendar_day (
  tenant_id uuid NOT NULL,
  calendar_day_id uuid NOT NULL DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL,
  calendar_date date NOT NULL,
  instructional boolean NOT NULL DEFAULT true,
  cycle_day text,
  day_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, calendar_day_id),
  UNIQUE (tenant_id, calendar_id, calendar_date),
  FOREIGN KEY (tenant_id, calendar_id)
    REFERENCES academics.instructional_calendar (tenant_id, calendar_id)
);

CREATE TABLE IF NOT EXISTS academics.bell_schedule (
  tenant_id uuid NOT NULL,
  bell_schedule_id uuid NOT NULL DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL,
  schedule_name text NOT NULL,
  timezone text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, bell_schedule_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS academics.bell_period (
  tenant_id uuid NOT NULL,
  period_id uuid NOT NULL DEFAULT gen_random_uuid(),
  bell_schedule_id uuid NOT NULL,
  period_code text NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  attendance_required boolean NOT NULL DEFAULT true,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  PRIMARY KEY (tenant_id, period_id),
  UNIQUE (tenant_id, bell_schedule_id, period_code),
  UNIQUE (tenant_id, bell_schedule_id, sequence_no),
  FOREIGN KEY (tenant_id, bell_schedule_id)
    REFERENCES academics.bell_schedule (tenant_id, bell_schedule_id),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS academics.curriculum_version (
  tenant_id uuid NOT NULL,
  curriculum_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  curriculum_key text NOT NULL,
  version_label text NOT NULL,
  curriculum_name text NOT NULL,
  country_pack_ref text,
  effective_from date NOT NULL,
  effective_to date,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, curriculum_version_id),
  UNIQUE (tenant_id, curriculum_key, version_label),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS academics.program_version (
  tenant_id uuid NOT NULL,
  program_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_key text NOT NULL,
  version_label text NOT NULL,
  curriculum_version_id uuid NOT NULL,
  program_name text NOT NULL,
  grade_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, program_version_id),
  UNIQUE (tenant_id, program_key, version_label),
  FOREIGN KEY (tenant_id, curriculum_version_id)
    REFERENCES academics.curriculum_version (tenant_id, curriculum_version_id),
  CHECK (jsonb_typeof(grade_levels) = 'array' AND jsonb_array_length(grade_levels) > 0)
);

CREATE TABLE IF NOT EXISTS academics.course_version (
  tenant_id uuid NOT NULL,
  course_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_key text NOT NULL,
  version_label text NOT NULL,
  curriculum_version_id uuid NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  credits numeric(10,4) NOT NULL DEFAULT 0 CHECK (credits >= 0),
  prerequisite_course_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, course_version_id),
  UNIQUE (tenant_id, course_key, version_label),
  UNIQUE (tenant_id, curriculum_version_id, course_code, version_label),
  FOREIGN KEY (tenant_id, curriculum_version_id)
    REFERENCES academics.curriculum_version (tenant_id, curriculum_version_id),
  CHECK (jsonb_typeof(prerequisite_course_keys) = 'array')
);

CREATE TABLE IF NOT EXISTS academics.learning_standard (
  tenant_id uuid NOT NULL,
  standard_id uuid NOT NULL DEFAULT gen_random_uuid(),
  curriculum_version_id uuid NOT NULL,
  standard_code text NOT NULL,
  description text NOT NULL,
  parent_standard_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, standard_id),
  UNIQUE (tenant_id, curriculum_version_id, standard_code),
  FOREIGN KEY (tenant_id, curriculum_version_id)
    REFERENCES academics.curriculum_version (tenant_id, curriculum_version_id),
  FOREIGN KEY (tenant_id, parent_standard_id)
    REFERENCES academics.learning_standard (tenant_id, standard_id)
);

CREATE TABLE IF NOT EXISTS academics.class_section (
  tenant_id uuid NOT NULL,
  section_id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  term_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  section_code text NOT NULL,
  section_title text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'retired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, section_id),
  UNIQUE (tenant_id, academic_year_id, term_id, campus_id, section_code),
  FOREIGN KEY (tenant_id, course_version_id)
    REFERENCES academics.course_version (tenant_id, course_version_id),
  FOREIGN KEY (tenant_id, academic_year_id)
    REFERENCES academics.academic_year (tenant_id, academic_year_id),
  FOREIGN KEY (tenant_id, term_id)
    REFERENCES academics.academic_term (tenant_id, term_id)
);

CREATE TABLE IF NOT EXISTS academics.staff_assignment (
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  staff_profile_id uuid NOT NULL,
  assignment_role text NOT NULL CHECK (assignment_role IN ('teacher', 'co-teacher', 'assistant')),
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, section_id)
    REFERENCES academics.class_section (tenant_id, section_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS academic_current_staff_assignment_unique
  ON academics.staff_assignment (tenant_id, section_id, staff_profile_id, assignment_role)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS academics.section_roster (
  tenant_id uuid NOT NULL,
  roster_entry_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  joined_on date NOT NULL,
  left_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, roster_entry_id),
  FOREIGN KEY (tenant_id, section_id)
    REFERENCES academics.class_section (tenant_id, section_id),
  CHECK (left_on IS NULL OR left_on >= joined_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS academic_current_section_roster_unique
  ON academics.section_roster (tenant_id, section_id, student_profile_id)
  WHERE left_on IS NULL;
CREATE INDEX IF NOT EXISTS academic_student_roster_lookup_idx
  ON academics.section_roster (tenant_id, student_profile_id, joined_on DESC);

DO $academic_publication_triggers$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'academic_year', 'instructional_calendar', 'bell_schedule', 'curriculum_version',
    'program_version', 'course_version', 'class_section'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS published_version_immutable ON academics.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER published_version_immutable BEFORE UPDATE OR DELETE ON academics.%I FOR EACH ROW EXECUTE FUNCTION academics.reject_published_mutation()',
      table_name
    );
  END LOOP;
END
$academic_publication_triggers$;

DO $academic_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'academic_year', 'academic_term', 'instructional_calendar', 'calendar_day',
    'bell_schedule', 'bell_period', 'curriculum_version', 'program_version',
    'course_version', 'learning_standard', 'class_section', 'staff_assignment', 'section_roster'
  ]
  LOOP
    EXECUTE format('ALTER TABLE academics.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE academics.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON academics.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON academics.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON academics.%I TO app_runtime', table_name);
  END LOOP;
END
$academic_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280201_ACAD-01_academic_structure',
  'ACAD-01',
  'Versioned academic calendars, curricula, courses, sections, staff assignments and rosters'
)
ON CONFLICT (migration_id) DO NOTHING;
