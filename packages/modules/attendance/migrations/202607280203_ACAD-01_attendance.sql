CREATE SCHEMA IF NOT EXISTS attendance;

CREATE TABLE IF NOT EXISTS attendance.attendance_policy_version (
  tenant_id uuid NOT NULL,
  policy_version_id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  version_label text NOT NULL,
  minimum_present_minutes integer CHECK (minimum_present_minutes IS NULL OR minimum_present_minutes >= 0),
  late_after_minutes integer NOT NULL CHECK (late_after_minutes >= 0),
  chronic_absence_threshold_percent numeric(5,2) NOT NULL
    CHECK (chronic_absence_threshold_percent BETWEEN 0 AND 100),
  publication_state text NOT NULL DEFAULT 'draft'
    CHECK (publication_state IN ('draft', 'published')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, policy_version_id),
  UNIQUE (tenant_id, policy_key, version_label)
);

CREATE TABLE IF NOT EXISTS attendance.attendance_code (
  tenant_id uuid NOT NULL,
  attendance_code_id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  meaning text NOT NULL CHECK (meaning IN ('present', 'absent', 'late', 'excused', 'remote')),
  counts_as_present boolean NOT NULL,
  requires_reason boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, attendance_code_id),
  UNIQUE (tenant_id, policy_version_id, code),
  FOREIGN KEY (tenant_id, policy_version_id)
    REFERENCES attendance.attendance_policy_version (tenant_id, policy_version_id)
);

CREATE TABLE IF NOT EXISTS attendance.attendance_session (
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scheduled_meeting_id uuid NOT NULL,
  section_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  local_date date NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  timezone text NOT NULL,
  roster_student_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  session_state text NOT NULL DEFAULT 'open' CHECK (session_state IN ('open', 'finalized')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, session_id),
  UNIQUE (tenant_id, scheduled_meeting_id),
  CHECK (ends_at > starts_at),
  CHECK (jsonb_typeof(roster_student_ids) = 'array')
);
CREATE INDEX IF NOT EXISTS attendance_session_date_idx
  ON attendance.attendance_session (tenant_id, campus_id, local_date, session_state);

CREATE TABLE IF NOT EXISTS attendance.attendance_record (
  tenant_id uuid NOT NULL,
  attendance_record_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_record_id text NOT NULL,
  session_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  attendance_code_id uuid NOT NULL,
  minutes_present integer CHECK (minutes_present IS NULL OR minutes_present >= 0),
  minutes_absent integer CHECK (minutes_absent IS NULL OR minutes_absent >= 0),
  reason text,
  evidence_document_id uuid,
  record_source text NOT NULL CHECK (record_source IN ('teacher', 'office', 'device', 'import', 'guardian')),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, attendance_record_id),
  UNIQUE (tenant_id, client_record_id),
  UNIQUE (tenant_id, session_id, student_profile_id),
  FOREIGN KEY (tenant_id, session_id)
    REFERENCES attendance.attendance_session (tenant_id, session_id),
  FOREIGN KEY (tenant_id, attendance_code_id)
    REFERENCES attendance.attendance_code (tenant_id, attendance_code_id)
);
CREATE INDEX IF NOT EXISTS attendance_student_history_idx
  ON attendance.attendance_record (tenant_id, student_profile_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS attendance.attendance_amendment (
  tenant_id uuid NOT NULL,
  amendment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL,
  previous_attendance_code_id uuid NOT NULL,
  replacement_attendance_code_id uuid NOT NULL,
  previous_version bigint NOT NULL,
  replacement_version bigint NOT NULL,
  reason text NOT NULL,
  approved_by uuid,
  amended_by uuid NOT NULL,
  amended_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, amendment_id),
  FOREIGN KEY (tenant_id, attendance_record_id)
    REFERENCES attendance.attendance_record (tenant_id, attendance_record_id),
  FOREIGN KEY (tenant_id, previous_attendance_code_id)
    REFERENCES attendance.attendance_code (tenant_id, attendance_code_id),
  FOREIGN KEY (tenant_id, replacement_attendance_code_id)
    REFERENCES attendance.attendance_code (tenant_id, attendance_code_id),
  CHECK (replacement_version = previous_version + 1)
);

CREATE TABLE IF NOT EXISTS attendance.arrival_departure_event (
  tenant_id uuid NOT NULL,
  arrival_departure_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('arrival', 'departure', 'late-arrival', 'early-departure')),
  occurred_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('office', 'device', 'import', 'guardian')),
  evidence_ref text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, arrival_departure_event_id)
);
CREATE INDEX IF NOT EXISTS attendance_arrival_departure_idx
  ON attendance.arrival_departure_event (tenant_id, campus_id, occurred_at, student_profile_id);

CREATE TABLE IF NOT EXISTS attendance.absence_notice (
  tenant_id uuid NOT NULL,
  notice_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  local_date date NOT NULL,
  reason text NOT NULL,
  evidence_document_id uuid,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, notice_id)
);
CREATE INDEX IF NOT EXISTS attendance_absence_notice_idx
  ON attendance.absence_notice (tenant_id, student_profile_id, local_date);

CREATE TABLE IF NOT EXISTS attendance.attendance_finalization (
  tenant_id uuid NOT NULL,
  finalization_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  finalized_by uuid NOT NULL,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  incomplete_override boolean NOT NULL DEFAULT false,
  override_reason text,
  PRIMARY KEY (tenant_id, finalization_id),
  UNIQUE (tenant_id, session_id),
  FOREIGN KEY (tenant_id, session_id)
    REFERENCES attendance.attendance_session (tenant_id, session_id),
  CHECK (NOT incomplete_override OR override_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS attendance.attendance_intervention (
  tenant_id uuid NOT NULL,
  intervention_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  trigger_percent numeric(5,2) NOT NULL CHECK (trigger_percent BETWEEN 0 AND 100),
  intervention_status text NOT NULL CHECK (intervention_status IN ('open', 'in-progress', 'closed')),
  owner_id uuid,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  PRIMARY KEY (tenant_id, intervention_id),
  FOREIGN KEY (tenant_id, policy_version_id)
    REFERENCES attendance.attendance_policy_version (tenant_id, policy_version_id),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

CREATE TABLE IF NOT EXISTS attendance.attendance_sync_batch (
  tenant_id uuid NOT NULL,
  sync_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_batch_id text NOT NULL,
  device_id text NOT NULL,
  payload_digest text NOT NULL,
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  replayed_count integer NOT NULL DEFAULT 0 CHECK (replayed_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, sync_batch_id),
  UNIQUE (tenant_id, client_batch_id)
);

CREATE OR REPLACE FUNCTION attendance.reject_published_policy_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.publication_state = 'published' THEN
    RAISE EXCEPTION 'published attendance policy versions are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS published_attendance_policy_immutable ON attendance.attendance_policy_version;
CREATE TRIGGER published_attendance_policy_immutable
  BEFORE UPDATE OR DELETE ON attendance.attendance_policy_version
  FOR EACH ROW EXECUTE FUNCTION attendance.reject_published_policy_mutation();

CREATE OR REPLACE FUNCTION attendance.reject_finalized_record_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE session_state text;
BEGIN
  SELECT s.session_state INTO session_state
  FROM attendance.attendance_session s
  WHERE s.tenant_id = OLD.tenant_id AND s.session_id = OLD.session_id;
  IF session_state = 'finalized' THEN
    RAISE EXCEPTION 'finalized attendance requires an approved amendment command';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
DROP TRIGGER IF EXISTS finalized_attendance_record_guard ON attendance.attendance_record;
CREATE TRIGGER finalized_attendance_record_guard
  BEFORE UPDATE OR DELETE ON attendance.attendance_record
  FOR EACH ROW EXECUTE FUNCTION attendance.reject_finalized_record_mutation();

CREATE OR REPLACE FUNCTION attendance.reject_append_only_change()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'attendance evidence is append-only';
END
$function$;
DROP TRIGGER IF EXISTS attendance_amendment_append_only ON attendance.attendance_amendment;
CREATE TRIGGER attendance_amendment_append_only
  BEFORE UPDATE OR DELETE ON attendance.attendance_amendment
  FOR EACH ROW EXECUTE FUNCTION attendance.reject_append_only_change();
DROP TRIGGER IF EXISTS attendance_finalization_append_only ON attendance.attendance_finalization;
CREATE TRIGGER attendance_finalization_append_only
  BEFORE UPDATE OR DELETE ON attendance.attendance_finalization
  FOR EACH ROW EXECUTE FUNCTION attendance.reject_append_only_change();

DO $attendance_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'attendance_policy_version', 'attendance_code', 'attendance_session', 'attendance_record',
    'attendance_amendment', 'arrival_departure_event', 'absence_notice',
    'attendance_finalization', 'attendance_intervention', 'attendance_sync_batch'
  ]
  LOOP
    EXECUTE format('ALTER TABLE attendance.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE attendance.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON attendance.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON attendance.%I FOR ALL TO app_runtime USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON attendance.%I TO app_runtime', table_name);
  END LOOP;
END
$attendance_rls$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607280203_ACAD-01_attendance',
  'ACAD-01',
  'Attendance policy, sessions, idempotent offline sync, amendments, finalization and interventions'
)
ON CONFLICT (migration_id) DO NOTHING;
