CREATE TABLE IF NOT EXISTS platform.mobile_sync_invalidation (
  tenant_id uuid NOT NULL,
  invalidation_sequence bigint GENERATED ALWAYS AS IDENTITY,
  campus_id uuid NOT NULL,
  application text NOT NULL CHECK (application IN ('family', 'staff')),
  subject_kind text NOT NULL CHECK (subject_kind IN ('student', 'section')),
  subject_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, invalidation_sequence),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  CHECK (
    (application = 'family' AND subject_kind = 'student')
    OR (application = 'staff' AND subject_kind = 'section')
  )
);

CREATE INDEX IF NOT EXISTS mobile_sync_invalidation_scope_idx
  ON platform.mobile_sync_invalidation (
    tenant_id,
    campus_id,
    application,
    subject_kind,
    subject_id,
    invalidation_sequence DESC
  );

CREATE TABLE IF NOT EXISTS platform.mobile_sync_cursor (
  tenant_id uuid NOT NULL,
  cursor_id uuid NOT NULL DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL,
  account_id uuid NOT NULL,
  persona text NOT NULL CHECK (persona IN ('guardian', 'student', 'teacher')),
  revision bigint NOT NULL CHECK (revision >= 0),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, cursor_id),
  FOREIGN KEY (tenant_id, campus_id) REFERENCES tenancy.campus (tenant_id, campus_id),
  FOREIGN KEY (account_id) REFERENCES iam.account (account_id),
  CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS mobile_sync_cursor_scope_idx
  ON platform.mobile_sync_cursor (
    tenant_id,
    campus_id,
    account_id,
    persona,
    revision,
    expires_at DESC,
    issued_at DESC,
    cursor_id DESC
  );

REVOKE ALL ON TABLE platform.mobile_sync_invalidation FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_sync_invalidation FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_sync_cursor FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_sync_cursor FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.prevent_mobile_sync_invalidation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'MOBILE_SYNC_INVALIDATION_APPEND_ONLY' USING ERRCODE = '23514';
END
$function$;

REVOKE ALL ON FUNCTION platform.prevent_mobile_sync_invalidation_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.prevent_mobile_sync_invalidation_mutation() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_invalidation_append_only ON platform.mobile_sync_invalidation;
CREATE TRIGGER mobile_sync_invalidation_append_only
BEFORE UPDATE OR DELETE ON platform.mobile_sync_invalidation
FOR EACH ROW EXECUTE FUNCTION platform.prevent_mobile_sync_invalidation_mutation();

CREATE OR REPLACE FUNCTION platform.enforce_mobile_sync_cursor_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id
     OR NEW.cursor_id <> OLD.cursor_id
     OR NEW.campus_id <> OLD.campus_id
     OR NEW.account_id <> OLD.account_id
     OR NEW.persona <> OLD.persona
     OR NEW.revision <> OLD.revision
     OR NEW.issued_at <> OLD.issued_at THEN
    RAISE EXCEPTION 'MOBILE_SYNC_CURSOR_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.expires_at < OLD.expires_at THEN
    RAISE EXCEPTION 'MOBILE_SYNC_CURSOR_EXPIRY_REGRESSION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION platform.enforce_mobile_sync_cursor_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.enforce_mobile_sync_cursor_state() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_cursor_state_guard ON platform.mobile_sync_cursor;
CREATE TRIGGER mobile_sync_cursor_state_guard
BEFORE UPDATE ON platform.mobile_sync_cursor
FOR EACH ROW EXECUTE FUNCTION platform.enforce_mobile_sync_cursor_state();

CREATE OR REPLACE FUNCTION platform.record_mobile_sync_invalidation(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_application text,
  p_subject_kind text,
  p_subject_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_subject_id IS NULL
     OR (p_application, p_subject_kind) NOT IN (('family', 'student'), ('staff', 'section')) THEN
    RAISE EXCEPTION 'MOBILE_SYNC_INVALIDATION_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;

  IF p_application = 'family' AND NOT EXISTS (
    SELECT 1
    FROM student_lifecycle.student_profile AS profile
    JOIN student_lifecycle.enrollment AS enrollment
      ON enrollment.tenant_id = profile.tenant_id
     AND enrollment.student_profile_id = profile.student_profile_id
     AND enrollment.campus_id = p_campus_id
    WHERE profile.tenant_id = p_tenant_id
      AND profile.student_profile_id = p_subject_id
  ) THEN
    RETURN;
  END IF;

  IF p_application = 'staff' AND NOT EXISTS (
    SELECT 1
    FROM academics.class_section AS section
    WHERE section.tenant_id = p_tenant_id
      AND section.section_id = p_subject_id
      AND section.campus_id = p_campus_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO platform.mobile_sync_invalidation (
    tenant_id,
    campus_id,
    application,
    subject_kind,
    subject_id
  ) VALUES (
    p_tenant_id,
    p_campus_id,
    p_application,
    p_subject_kind,
    p_subject_id
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.record_mobile_sync_invalidation(uuid, uuid, text, text, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.record_mobile_sync_invalidation(uuid, uuid, text, text, uuid)
  FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.record_mobile_sync_student_invalidation(
  p_tenant_id uuid,
  p_student_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_campus_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_student_profile_id IS NULL THEN
    RAISE EXCEPTION 'MOBILE_SYNC_STUDENT_INVALIDATION_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;

  FOR selected_campus_id IN
    SELECT DISTINCT enrollment.campus_id
    FROM student_lifecycle.enrollment AS enrollment
    WHERE enrollment.tenant_id = p_tenant_id
      AND enrollment.student_profile_id = p_student_profile_id
      AND enrollment.status = 'active'
  LOOP
    PERFORM platform.record_mobile_sync_invalidation(
      p_tenant_id,
      selected_campus_id,
      'family',
      'student',
      p_student_profile_id
    );
  END LOOP;
END
$function$;

REVOKE ALL ON FUNCTION platform.record_mobile_sync_student_invalidation(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.record_mobile_sync_student_invalidation(uuid, uuid)
  FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.record_mobile_sync_section_invalidation(
  p_tenant_id uuid,
  p_section_id uuid,
  p_include_family boolean,
  p_include_staff boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_campus_id uuid;
  selected_student_profile_id uuid;
BEGIN
  SELECT section.campus_id
  INTO selected_campus_id
  FROM academics.class_section AS section
  WHERE section.tenant_id = p_tenant_id
    AND section.section_id = p_section_id;

  IF selected_campus_id IS NULL THEN RETURN; END IF;

  IF p_include_family THEN
    FOR selected_student_profile_id IN
      SELECT DISTINCT roster.student_profile_id
      FROM academics.section_roster AS roster
      WHERE roster.tenant_id = p_tenant_id
        AND roster.section_id = p_section_id
        AND roster.joined_on <= current_date
        AND (roster.left_on IS NULL OR roster.left_on >= current_date)
    LOOP
      PERFORM platform.record_mobile_sync_invalidation(
        p_tenant_id,
        selected_campus_id,
        'family',
        'student',
        selected_student_profile_id
      );
    END LOOP;
  END IF;

  IF p_include_staff THEN
    PERFORM platform.record_mobile_sync_invalidation(
      p_tenant_id,
      selected_campus_id,
      'staff',
      'section',
      p_section_id
    );
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION platform.record_mobile_sync_section_invalidation(uuid, uuid, boolean, boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.record_mobile_sync_section_invalidation(uuid, uuid, boolean, boolean)
  FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_sync_student_family_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_student_profile_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    selected_tenant_id := OLD.tenant_id;
    selected_student_profile_id := OLD.student_profile_id;
  ELSE
    selected_tenant_id := NEW.tenant_id;
    selected_student_profile_id := NEW.student_profile_id;
  END IF;

  PERFORM platform.record_mobile_sync_student_invalidation(
    selected_tenant_id,
    selected_student_profile_id
  );

  IF TG_OP = 'UPDATE'
     AND (OLD.tenant_id, OLD.student_profile_id)
         IS DISTINCT FROM (NEW.tenant_id, NEW.student_profile_id) THEN
    PERFORM platform.record_mobile_sync_student_invalidation(
      OLD.tenant_id,
      OLD.student_profile_id
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_student_family_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_student_family_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_family_document_invalidation
  ON platform.mobile_family_document_publication;
CREATE TRIGGER mobile_sync_family_document_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  student_profile_id,
  title,
  file_name,
  size_bytes,
  issued_at,
  classification,
  cache_policy,
  publication_state,
  withdrawn_at,
  version
ON platform.mobile_family_document_publication
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_student_family_trigger();

DROP TRIGGER IF EXISTS mobile_sync_family_form_invalidation
  ON platform.mobile_family_form_request;
CREATE TRIGGER mobile_sync_family_form_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  student_profile_id,
  title,
  status,
  due_at,
  schema_version,
  fields,
  version,
  submitted_at,
  closed_at
ON platform.mobile_family_form_request
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_student_family_trigger();

DROP TRIGGER IF EXISTS mobile_sync_family_consent_invalidation
  ON platform.mobile_family_consent_request;
CREATE TRIGGER mobile_sync_family_consent_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  student_profile_id,
  title,
  policy_version,
  purpose,
  status,
  due_at,
  version,
  decided_at
ON platform.mobile_family_consent_request
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_student_family_trigger();

DROP TRIGGER IF EXISTS mobile_sync_conversation_thread_invalidation
  ON integration_core.conversation_thread;
CREATE TRIGGER mobile_sync_conversation_thread_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  student_profile_id,
  subject,
  status,
  version,
  last_message_at
ON integration_core.conversation_thread
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_student_family_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_conversation_participant_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_conversation_id uuid;
  selected_student_profile_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    selected_tenant_id := OLD.tenant_id;
    selected_conversation_id := OLD.conversation_id;
  ELSE
    selected_tenant_id := NEW.tenant_id;
    selected_conversation_id := NEW.conversation_id;
  END IF;

  SELECT thread.student_profile_id
  INTO selected_student_profile_id
  FROM integration_core.conversation_thread AS thread
  WHERE thread.tenant_id = selected_tenant_id
    AND thread.conversation_id = selected_conversation_id;

  IF selected_student_profile_id IS NOT NULL THEN
    PERFORM platform.record_mobile_sync_student_invalidation(
      selected_tenant_id,
      selected_student_profile_id
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_conversation_participant_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_conversation_participant_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_conversation_participant_invalidation
  ON integration_core.conversation_participant;
CREATE TRIGGER mobile_sync_conversation_participant_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  person_id,
  participant_kind,
  display_label,
  can_reply,
  joined_at,
  left_at
ON integration_core.conversation_participant
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_conversation_participant_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_enrollment_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM platform.record_mobile_sync_invalidation(
      OLD.tenant_id,
      OLD.campus_id,
      'family',
      'student',
      OLD.student_profile_id
    );
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM platform.record_mobile_sync_invalidation(
      NEW.tenant_id,
      NEW.campus_id,
      'family',
      'student',
      NEW.student_profile_id
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_enrollment_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_enrollment_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_enrollment_invalidation ON student_lifecycle.enrollment;
CREATE TRIGGER mobile_sync_enrollment_invalidation
AFTER INSERT OR DELETE OR UPDATE OF status, effective_from, effective_to, version
ON student_lifecycle.enrollment
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_enrollment_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_section_roster_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_section_id uuid;
  selected_student_profile_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM platform.record_mobile_sync_section_invalidation(
      OLD.tenant_id,
      OLD.section_id,
      false,
      true
    );
    PERFORM platform.record_mobile_sync_student_invalidation(
      OLD.tenant_id,
      OLD.student_profile_id
    );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    selected_tenant_id := NEW.tenant_id;
    selected_section_id := NEW.section_id;
    selected_student_profile_id := NEW.student_profile_id;
    PERFORM platform.record_mobile_sync_section_invalidation(
      selected_tenant_id,
      selected_section_id,
      false,
      true
    );
    PERFORM platform.record_mobile_sync_student_invalidation(
      selected_tenant_id,
      selected_student_profile_id
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_section_roster_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_section_roster_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_section_roster_invalidation ON academics.section_roster;
CREATE TRIGGER mobile_sync_section_roster_invalidation
AFTER INSERT OR DELETE OR UPDATE OF section_id, student_profile_id, joined_on, left_on
ON academics.section_roster
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_section_roster_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_scheduled_meeting_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_campus_id uuid;
  selected_student_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT section.campus_id
    INTO selected_campus_id
    FROM academics.class_section AS section
    WHERE section.tenant_id = OLD.tenant_id
      AND section.section_id = OLD.section_id;

    IF selected_campus_id IS NOT NULL THEN
      FOR selected_student_id IN
        SELECT student.value::uuid
        FROM jsonb_array_elements_text(OLD.student_ids) AS student(value)
        WHERE student.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      LOOP
        PERFORM platform.record_mobile_sync_invalidation(
          OLD.tenant_id,
          selected_campus_id,
          'family',
          'student',
          selected_student_id
        );
      END LOOP;
      PERFORM platform.record_mobile_sync_invalidation(
        OLD.tenant_id,
        selected_campus_id,
        'staff',
        'section',
        OLD.section_id
      );
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT section.campus_id
    INTO selected_campus_id
    FROM academics.class_section AS section
    WHERE section.tenant_id = NEW.tenant_id
      AND section.section_id = NEW.section_id;

    IF selected_campus_id IS NOT NULL THEN
      FOR selected_student_id IN
        SELECT student.value::uuid
        FROM jsonb_array_elements_text(NEW.student_ids) AS student(value)
        WHERE student.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      LOOP
        PERFORM platform.record_mobile_sync_invalidation(
          NEW.tenant_id,
          selected_campus_id,
          'family',
          'student',
          selected_student_id
        );
      END LOOP;
      PERFORM platform.record_mobile_sync_invalidation(
        NEW.tenant_id,
        selected_campus_id,
        'staff',
        'section',
        NEW.section_id
      );
    END IF;
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_scheduled_meeting_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_scheduled_meeting_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_scheduled_meeting_invalidation
  ON scheduling.scheduled_class_meeting;
CREATE TRIGGER mobile_sync_scheduled_meeting_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  section_id,
  local_date,
  starts_at,
  ends_at,
  timezone,
  teacher_ids,
  student_ids,
  room_id,
  meeting_status,
  version
ON scheduling.scheduled_class_meeting
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_scheduled_meeting_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_attendance_session_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_campus_id uuid;
  selected_section_id uuid;
  selected_roster jsonb;
  selected_state text;
  selected_student_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    selected_tenant_id := OLD.tenant_id;
    selected_campus_id := OLD.campus_id;
    selected_section_id := OLD.section_id;
    selected_roster := OLD.roster_student_ids;
    selected_state := OLD.session_state;
  ELSE
    selected_tenant_id := NEW.tenant_id;
    selected_campus_id := NEW.campus_id;
    selected_section_id := NEW.section_id;
    selected_roster := NEW.roster_student_ids;
    selected_state := NEW.session_state;
  END IF;

  IF selected_state = 'finalized' THEN
    FOR selected_student_id IN
      SELECT roster.value::uuid
      FROM jsonb_array_elements_text(selected_roster) AS roster(value)
      WHERE roster.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    LOOP
      PERFORM platform.record_mobile_sync_invalidation(
        selected_tenant_id,
        selected_campus_id,
        'family',
        'student',
        selected_student_id
      );
    END LOOP;
  END IF;

  PERFORM platform.record_mobile_sync_invalidation(
    selected_tenant_id,
    selected_campus_id,
    'staff',
    'section',
    selected_section_id
  );
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_attendance_session_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_attendance_session_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_attendance_session_invalidation ON attendance.attendance_session;
CREATE TRIGGER mobile_sync_attendance_session_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  section_id,
  campus_id,
  local_date,
  starts_at,
  ends_at,
  roster_student_ids,
  session_state,
  version
ON attendance.attendance_session
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_attendance_session_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_attendance_record_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_session_id uuid;
  selected_section_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    selected_tenant_id := OLD.tenant_id;
    selected_session_id := OLD.session_id;
  ELSE
    selected_tenant_id := NEW.tenant_id;
    selected_session_id := NEW.session_id;
  END IF;

  SELECT session.section_id
  INTO selected_section_id
  FROM attendance.attendance_session AS session
  WHERE session.tenant_id = selected_tenant_id
    AND session.session_id = selected_session_id;

  IF selected_section_id IS NOT NULL THEN
    PERFORM platform.record_mobile_sync_section_invalidation(
      selected_tenant_id,
      selected_section_id,
      false,
      true
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_attendance_record_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_attendance_record_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_attendance_record_invalidation ON attendance.attendance_record;
CREATE TRIGGER mobile_sync_attendance_record_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  session_id,
  student_profile_id,
  attendance_code_id,
  minutes_present,
  minutes_absent,
  reason,
  evidence_document_id,
  version
ON attendance.attendance_record
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_attendance_record_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_assessment_result_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_assessment_id uuid;
  selected_section_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    selected_tenant_id := OLD.tenant_id;
    selected_assessment_id := OLD.assessment_id;
  ELSE
    selected_tenant_id := NEW.tenant_id;
    selected_assessment_id := NEW.assessment_id;
  END IF;

  SELECT assessment.section_id
  INTO selected_section_id
  FROM gradebook.assessment AS assessment
  WHERE assessment.tenant_id = selected_tenant_id
    AND assessment.assessment_id = selected_assessment_id;

  IF selected_section_id IS NOT NULL THEN
    PERFORM platform.record_mobile_sync_section_invalidation(
      selected_tenant_id,
      selected_section_id,
      false,
      true
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_assessment_result_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_assessment_result_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_assessment_result_invalidation ON gradebook.assessment_result;
CREATE TRIGGER mobile_sync_assessment_result_invalidation
AFTER INSERT OR DELETE OR UPDATE OF
  assessment_id,
  student_profile_id,
  result_state,
  raw_score,
  comment,
  version
ON gradebook.assessment_result
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_assessment_result_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_grade_publication_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_tenant_id uuid;
  selected_snapshot_id uuid;
  selected_student_profile_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    selected_tenant_id := OLD.tenant_id;
    selected_snapshot_id := OLD.snapshot_id;
  ELSE
    selected_tenant_id := NEW.tenant_id;
    selected_snapshot_id := NEW.snapshot_id;
  END IF;

  SELECT snapshot.student_profile_id
  INTO selected_student_profile_id
  FROM gradebook.grade_calculation_snapshot AS snapshot
  WHERE snapshot.tenant_id = selected_tenant_id
    AND snapshot.snapshot_id = selected_snapshot_id;

  IF selected_student_profile_id IS NOT NULL THEN
    PERFORM platform.record_mobile_sync_student_invalidation(
      selected_tenant_id,
      selected_student_profile_id
    );
  END IF;
  RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_grade_publication_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_grade_publication_trigger() FROM app_runtime;

DROP TRIGGER IF EXISTS mobile_sync_grade_publication_invalidation ON gradebook.grade_publication;
CREATE TRIGGER mobile_sync_grade_publication_invalidation
AFTER INSERT OR DELETE OR UPDATE OF snapshot_id, available_from, available_to, published_at
ON gradebook.grade_publication
FOR EACH ROW EXECUTE FUNCTION platform.mobile_sync_grade_publication_trigger();

CREATE OR REPLACE FUNCTION platform.mobile_sync_scope_is_authorized(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_account_id uuid,
  p_persona text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_person_id uuid;
  linked_person_count bigint;
  selected_local_date date;
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_account_id IS NULL
     OR p_persona NOT IN ('guardian', 'student', 'teacher') THEN
    RETURN false;
  END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = p_account_id;

  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN false; END IF;

  SELECT (clock_timestamp() AT TIME ZONE campus.time_zone)::date
  INTO selected_local_date
  FROM tenancy.campus AS campus
  WHERE campus.tenant_id = p_tenant_id
    AND campus.campus_id = p_campus_id;
  IF selected_local_date IS NULL THEN RETURN false; END IF;

  IF p_persona = 'teacher' THEN
    RETURN EXISTS (
      SELECT 1
      FROM hr.staff_profile AS staff
      WHERE staff.tenant_id = p_tenant_id
        AND staff.campus_id = p_campus_id
        AND staff.person_ref = selected_person_id::text
        AND staff.employment_status = 'active'
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM student_lifecycle.student_profile AS profile
    WHERE profile.tenant_id = p_tenant_id
      AND platform.mobile_family_student_is_authorized(
        p_tenant_id,
        p_campus_id,
        p_persona,
        selected_person_id,
        profile.student_profile_id,
        selected_local_date
      )
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_scope_is_authorized(uuid, uuid, uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_scope_is_authorized(uuid, uuid, uuid, text)
  FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_sync_invalidation_is_visible(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_account_id uuid,
  p_persona text,
  p_application text,
  p_subject_kind text,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_person_id uuid;
  selected_staff_id uuid;
  linked_person_count bigint;
  selected_local_date date;
BEGIN
  IF p_application = 'family' THEN
    IF p_persona NOT IN ('guardian', 'student') OR p_subject_kind <> 'student' THEN
      RETURN false;
    END IF;
  ELSIF p_application = 'staff' THEN
    IF p_persona <> 'teacher' OR p_subject_kind <> 'section' THEN
      RETURN false;
    END IF;
  ELSE
    RETURN false;
  END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = p_account_id;
  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN false; END IF;

  SELECT (clock_timestamp() AT TIME ZONE campus.time_zone)::date
  INTO selected_local_date
  FROM tenancy.campus AS campus
  WHERE campus.tenant_id = p_tenant_id
    AND campus.campus_id = p_campus_id;
  IF selected_local_date IS NULL THEN RETURN false; END IF;

  IF p_application = 'family' THEN
    RETURN platform.mobile_family_student_is_authorized(
      p_tenant_id,
      p_campus_id,
      p_persona,
      selected_person_id,
      p_subject_id,
      selected_local_date
    );
  END IF;

  SELECT staff.staff_id
  INTO selected_staff_id
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active'
  LIMIT 1;
  IF selected_staff_id IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM academics.staff_assignment AS assignment
    WHERE assignment.tenant_id = p_tenant_id
      AND assignment.section_id = p_subject_id
      AND assignment.staff_profile_id = selected_staff_id
      AND assignment.effective_from <= selected_local_date
      AND (assignment.effective_to IS NULL OR assignment.effective_to >= selected_local_date)
  ) OR EXISTS (
    SELECT 1
    FROM scheduling.scheduled_class_meeting AS meeting
    LEFT JOIN scheduling.substitution_assignment AS substitution
      ON substitution.tenant_id = meeting.tenant_id
     AND substitution.scheduled_meeting_id = meeting.scheduled_meeting_id
     AND substitution.effective_date = meeting.local_date
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.section_id = p_subject_id
      AND meeting.local_date = selected_local_date
      AND meeting.meeting_status = 'scheduled'
      AND (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
          WHERE teacher.value = selected_staff_id::text
        )
        OR substitution.substitute_teacher_id = selected_staff_id
      )
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.mobile_sync_invalidation_is_visible(
  uuid, uuid, uuid, text, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_sync_invalidation_is_visible(
  uuid, uuid, uuid, text, text, text, uuid
) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_sync_delta(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_cursor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_scope_count bigint;
  selected_application text;
  prior_revision bigint;
  current_revision bigint;
  selected_cursor_id uuid;
  response_time timestamptz := date_trunc('milliseconds', clock_timestamp());
  cursor_expiry timestamptz := date_trunc('milliseconds', clock_timestamp()) + interval '30 days';
BEGIN
  SELECT count(*), min(scope.account_id::text)::uuid
  INTO selected_scope_count, selected_account_id
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS scope;

  IF selected_scope_count <> 1 OR selected_account_id IS NULL THEN RETURN NULL; END IF;

  selected_application := CASE
    WHEN p_persona IN ('guardian', 'student') THEN 'family'
    WHEN p_persona = 'teacher' THEN 'staff'
    ELSE NULL
  END;
  IF selected_application IS NULL THEN RETURN NULL; END IF;

  IF NOT platform.mobile_sync_scope_is_authorized(
    p_tenant_id,
    p_campus_id,
    selected_account_id,
    p_persona
  ) THEN
    RETURN NULL;
  END IF;

  IF p_cursor_id IS NOT NULL THEN
    SELECT cursor.revision
    INTO prior_revision
    FROM platform.mobile_sync_cursor AS cursor
    WHERE cursor.tenant_id = p_tenant_id
      AND cursor.cursor_id = p_cursor_id
      AND cursor.campus_id = p_campus_id
      AND cursor.account_id = selected_account_id
      AND cursor.persona = p_persona
      AND cursor.expires_at > response_time;

    IF prior_revision IS NULL THEN
      RETURN jsonb_build_object('status', 'cursor-invalid');
    END IF;
  END IF;

  SELECT COALESCE(max(invalidation.invalidation_sequence), 0)
  INTO current_revision
  FROM platform.mobile_sync_invalidation AS invalidation
  WHERE invalidation.tenant_id = p_tenant_id
    AND invalidation.campus_id = p_campus_id
    AND invalidation.application = selected_application
    AND platform.mobile_sync_invalidation_is_visible(
      p_tenant_id,
      p_campus_id,
      selected_account_id,
      p_persona,
      invalidation.application,
      invalidation.subject_kind,
      invalidation.subject_id
    );

  DELETE FROM platform.mobile_sync_cursor AS cursor
  WHERE cursor.tenant_id = p_tenant_id
    AND cursor.campus_id = p_campus_id
    AND cursor.account_id = selected_account_id
    AND cursor.persona = p_persona
    AND cursor.expires_at <= response_time;

  IF p_cursor_id IS NOT NULL AND current_revision = prior_revision THEN
    selected_cursor_id := p_cursor_id;
  ELSE
    SELECT cursor.cursor_id
    INTO selected_cursor_id
    FROM platform.mobile_sync_cursor AS cursor
    WHERE cursor.tenant_id = p_tenant_id
      AND cursor.campus_id = p_campus_id
      AND cursor.account_id = selected_account_id
      AND cursor.persona = p_persona
      AND cursor.revision = current_revision
      AND cursor.expires_at > response_time
    ORDER BY cursor.issued_at DESC, cursor.cursor_id DESC
    LIMIT 1;
  END IF;

  IF selected_cursor_id IS NULL THEN
    INSERT INTO platform.mobile_sync_cursor (
      tenant_id,
      campus_id,
      account_id,
      persona,
      revision,
      issued_at,
      expires_at
    ) VALUES (
      p_tenant_id,
      p_campus_id,
      selected_account_id,
      p_persona,
      current_revision,
      response_time,
      cursor_expiry
    )
    RETURNING cursor_id INTO selected_cursor_id;
  ELSE
    UPDATE platform.mobile_sync_cursor AS cursor
    SET expires_at = GREATEST(cursor.expires_at, cursor_expiry)
    WHERE cursor.tenant_id = p_tenant_id
      AND cursor.cursor_id = selected_cursor_id;
  END IF;

  RETURN jsonb_build_object(
    'cursor', selected_cursor_id::text,
    'changed', p_cursor_id IS NOT NULL AND current_revision > prior_revision,
    'serverTime', to_char(response_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_sync_delta(text, text, uuid, uuid, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_sync_delta(text, text, uuid, uuid, text, uuid)
  TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608220001_MOB-08_mobile_sync_delta',
  'MOB-08',
  'Add subject-scoped data-free mobile sync invalidations and opaque cursor authority'
)
ON CONFLICT (migration_id) DO NOTHING;
