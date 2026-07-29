CREATE SCHEMA IF NOT EXISTS scheduling;

CREATE TABLE IF NOT EXISTS scheduling.timetable_version (
  tenant_id uuid NOT NULL,
  timetable_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL,
  term_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  timetable_name text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published', 'superseded')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, timetable_version_id),
  UNIQUE (tenant_id, idempotency_key),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS scheduling.class_meeting_pattern (
  tenant_id uuid NOT NULL,
  meeting_pattern_id uuid NOT NULL DEFAULT gen_random_uuid(),
  timetable_version_id uuid NOT NULL,
  section_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  timezone text NOT NULL,
  room_id uuid,
  teacher_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  student_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from date NOT NULL,
  valid_to date,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, meeting_pattern_id),
  FOREIGN KEY (tenant_id, timetable_version_id)
    REFERENCES scheduling.timetable_version (tenant_id, timetable_version_id),
  CHECK (ends_at > starts_at),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (jsonb_typeof(teacher_ids) = 'array'),
  CHECK (jsonb_typeof(student_ids) = 'array')
);
CREATE INDEX IF NOT EXISTS schedule_pattern_section_idx
  ON scheduling.class_meeting_pattern (tenant_id, section_id, weekday, starts_at);

CREATE TABLE IF NOT EXISTS scheduling.scheduled_class_meeting (
  tenant_id uuid NOT NULL,
  scheduled_meeting_id uuid NOT NULL DEFAULT gen_random_uuid(),
  timetable_version_id uuid NOT NULL,
  meeting_pattern_id uuid NOT NULL,
  section_id uuid NOT NULL,
  local_date date NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  timezone text NOT NULL,
  room_id uuid,
  teacher_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  student_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  meeting_status text NOT NULL DEFAULT 'scheduled'
    CHECK (meeting_status IN ('scheduled', 'cancelled')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scheduled_meeting_id),
  UNIQUE (tenant_id, meeting_pattern_id, local_date),
  FOREIGN KEY (tenant_id, timetable_version_id)
    REFERENCES scheduling.timetable_version (tenant_id, timetable_version_id),
  FOREIGN KEY (tenant_id, meeting_pattern_id)
    REFERENCES scheduling.class_meeting_pattern (tenant_id, meeting_pattern_id),
  CHECK (ends_at > starts_at),
  CHECK (jsonb_typeof(teacher_ids) = 'array'),
  CHECK (jsonb_typeof(student_ids) = 'array')
);
CREATE INDEX IF NOT EXISTS schedule_meeting_date_idx
  ON scheduling.scheduled_class_meeting (tenant_id, local_date, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS schedule_meeting_section_idx
  ON scheduling.scheduled_class_meeting (tenant_id, section_id, local_date);

CREATE TABLE IF NOT EXISTS scheduling.room_booking (
  tenant_id uuid NOT NULL,
  room_booking_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scheduled_meeting_id uuid NOT NULL,
  room_id uuid NOT NULL,
  local_date date NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, room_booking_id),
  UNIQUE (tenant_id, scheduled_meeting_id),
  FOREIGN KEY (tenant_id, scheduled_meeting_id)
    REFERENCES scheduling.scheduled_class_meeting (tenant_id, scheduled_meeting_id),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS schedule_room_booking_lookup_idx
  ON scheduling.room_booking (tenant_id, room_id, local_date, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS scheduling.schedule_conflict (
  tenant_id uuid NOT NULL,
  conflict_id uuid NOT NULL DEFAULT gen_random_uuid(),
  timetable_version_id uuid NOT NULL,
  left_meeting_id uuid NOT NULL,
  right_meeting_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('teacher', 'room', 'student', 'section')),
  resource_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('blocking', 'warning')),
  resolved_at timestamptz,
  resolution_note text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conflict_id),
  FOREIGN KEY (tenant_id, timetable_version_id)
    REFERENCES scheduling.timetable_version (tenant_id, timetable_version_id),
  FOREIGN KEY (tenant_id, left_meeting_id)
    REFERENCES scheduling.scheduled_class_meeting (tenant_id, scheduled_meeting_id),
  FOREIGN KEY (tenant_id, right_meeting_id)
    REFERENCES scheduling.scheduled_class_meeting (tenant_id, scheduled_meeting_id),
  CHECK (left_meeting_id <> right_meeting_id)
);
CREATE INDEX IF NOT EXISTS schedule_open_conflict_idx
  ON scheduling.schedule_conflict (tenant_id, timetable_version_id, severity)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS scheduling.substitution_assignment (
  tenant_id uuid NOT NULL,
  substitution_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scheduled_meeting_id uuid NOT NULL,
  substitute_teacher_id uuid,
  temporary_room_id uuid,
  reason_code text NOT NULL,
  effective_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, substitution_id),
  UNIQUE (tenant_id, scheduled_meeting_id),
  FOREIGN KEY (tenant_id, scheduled_meeting_id)
    REFERENCES scheduling.scheduled_class_meeting (tenant_id, scheduled_meeting_id),
  CHECK (substitute_teacher_id IS NOT NULL OR temporary_room_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION scheduling.reject_published_timetable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.publication_state = 'published' THEN
    RAISE EXCEPTION 'published timetable versions are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS published_timetable_immutable ON scheduling.timetable_version;
CREATE TRIGGER published_timetable_immutable
  BEFORE UPDATE OR DELETE ON scheduling.timetable_version
  FOR EACH ROW EXECUTE FUNCTION scheduling.reject_published_timetable_mutation();

CREATE OR REPLACE FUNCTION scheduling.reject_published_schedule_child_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE parent_state text;
DECLARE parent_id uuid;
DECLARE tenant uuid;
BEGIN
  tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
  parent_id := COALESCE(NEW.timetable_version_id, OLD.timetable_version_id);
  SELECT publication_state INTO parent_state
  FROM scheduling.timetable_version
  WHERE tenant_id = tenant AND timetable_version_id = parent_id;
  IF parent_state = 'published' THEN
    RAISE EXCEPTION 'published timetable meetings and patterns are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;

DROP TRIGGER IF EXISTS published_pattern_immutable ON scheduling.class_meeting_pattern;
CREATE TRIGGER published_pattern_immutable
  BEFORE UPDATE OR DELETE ON scheduling.class_meeting_pattern
  FOR EACH ROW EXECUTE FUNCTION scheduling.reject_published_schedule_child_mutation();
DROP TRIGGER IF EXISTS published_meeting_immutable ON scheduling.scheduled_class_meeting;
CREATE TRIGGER published_meeting_immutable
  BEFORE UPDATE OR DELETE ON scheduling.scheduled_class_meeting
  FOR EACH ROW EXECUTE FUNCTION scheduling.reject_published_schedule_child_mutation();

DO $scheduling_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'timetable_version', 'class_meeting_pattern', 'scheduled_class_meeting',
    'room_booking', 'schedule_conflict', 'substitution_assignment'
  ]
  LOOP
    EXECUTE format('ALTER TABLE scheduling.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE scheduling.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON scheduling.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON scheduling.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON scheduling.%I TO app_runtime', table_name);
  END LOOP;
END
$scheduling_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280202_ACAD-01_timetable',
  'ACAD-01',
  'Versioned timetables, resolved meetings, conflict evidence, rooms and substitutions'
)
ON CONFLICT (migration_id) DO NOTHING;
