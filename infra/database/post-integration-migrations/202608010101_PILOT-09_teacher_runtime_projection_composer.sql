ALTER TABLE platform.runtime_projection_composition_run
  ADD COLUMN IF NOT EXISTS persona text NOT NULL DEFAULT 'admin';

DO $teacher_composition_persona_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'platform.runtime_projection_composition_run'::regclass
      AND conname = 'runtime_projection_composition_run_persona_check'
  ) THEN
    ALTER TABLE platform.runtime_projection_composition_run
      ADD CONSTRAINT runtime_projection_composition_run_persona_check
      CHECK (persona IN ('admin', 'teacher'));
  END IF;
END
$teacher_composition_persona_constraint$;

CREATE OR REPLACE FUNCTION platform.compose_teacher_runtime_projection_source(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_campus_id uuid,
  p_expected_previous_revision bigint,
  p_composer_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam, tenancy, people, hr, scheduling,
                  attendance, gradebook, audit
AS $function$
DECLARE
  selected_account_id uuid;
  selected_person_id uuid;
  selected_staff_id uuid;
  selected_persona text;
  persona_count integer;
  selected_time_zone text;
  selected_local_date date;
  today_class_count bigint;
  open_attendance_count bigint;
  upcoming_assessment_count bigint;
  missing_result_count bigint;
  today_classes jsonb;
  current_source_revision bigint := 0;
  current_payload_digest text;
  current_payload_bytes integer;
  composed_payload jsonb;
  composed_payload_digest text;
  composed_payload_bytes integer;
  selected_state text;
  selected_source_revision bigint;
  selected_payload_digest text;
  selected_payload_bytes integer;
  selected_composition_id uuid := gen_random_uuid();
  selected_composed_at timestamptz := clock_timestamp();
  publisher_result jsonb;
  publisher_reason text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_membership_id IS NULL
     OR p_campus_id IS NULL
     OR p_expected_previous_revision IS NULL
     OR p_expected_previous_revision < 0
     OR p_composer_id IS NULL
     OR p_composer_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$'
     OR p_correlation_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'invalid-composition');
  END IF;

  SELECT membership.account_id
  INTO selected_account_id
  FROM iam.membership AS membership
  JOIN iam.account AS account
    ON account.account_id = membership.account_id
   AND account.disabled_at IS NULL
  WHERE membership.tenant_id = p_tenant_id
    AND membership.membership_id = p_membership_id
    AND membership.campus_id = p_campus_id
    AND membership.status = 'active'
  FOR UPDATE OF membership, account;

  IF selected_account_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'scope-inactive');
  END IF;

  SELECT campus.time_zone
  INTO selected_time_zone
  FROM tenancy.campus AS campus
  WHERE campus.tenant_id = p_tenant_id
    AND campus.campus_id = p_campus_id
  FOR SHARE OF campus;

  IF selected_time_zone IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'scope-inactive');
  END IF;

  PERFORM 1
  FROM iam.membership_role AS membership_role
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id
  FOR SHARE OF membership_role;

  PERFORM 1
  FROM platform.runtime_projection_persona_role AS mapping
  JOIN iam.membership_role AS membership_role
    ON membership_role.tenant_id = mapping.tenant_id
   AND membership_role.role_id = mapping.role_id
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id
  FOR SHARE OF mapping;

  SELECT count(DISTINCT mapping.persona), min(mapping.persona)
  INTO persona_count, selected_persona
  FROM iam.membership_role AS membership_role
  JOIN platform.runtime_projection_persona_role AS mapping
    ON mapping.tenant_id = membership_role.tenant_id
   AND mapping.role_id = membership_role.role_id
  WHERE membership_role.tenant_id = p_tenant_id
    AND membership_role.membership_id = p_membership_id;

  IF persona_count <> 1 OR selected_persona <> 'teacher' THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-teacher');
  END IF;

  SELECT person_link.person_id
  INTO selected_person_id
  FROM iam.person_link AS person_link
  JOIN people.person AS person
    ON person.tenant_id = person_link.tenant_id
   AND person.person_id = person_link.person_id
   AND person.status = 'active'
  WHERE person_link.tenant_id = p_tenant_id
    AND person_link.account_id = selected_account_id
  FOR SHARE OF person_link, person;

  IF selected_person_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'staff-unlinked');
  END IF;

  SELECT staff.staff_id
  INTO selected_staff_id
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active'
  FOR SHARE OF staff;

  IF selected_staff_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'staff-unlinked');
  END IF;

  SELECT source.source_revision, source.payload_digest, source.payload_bytes
  INTO current_source_revision, current_payload_digest, current_payload_bytes
  FROM platform.runtime_projection_source AS source
  WHERE source.tenant_id = p_tenant_id
    AND source.membership_id = p_membership_id
    AND source.campus_id = p_campus_id
    AND source.projection_key = 'home'
  FOR UPDATE OF source;

  IF NOT FOUND THEN
    current_source_revision := 0;
    current_payload_digest := NULL;
    current_payload_bytes := NULL;
  END IF;

  IF current_source_revision <> p_expected_previous_revision THEN
    RETURN jsonb_build_object(
      'composed', false,
      'reason', 'revision-conflict',
      'currentRevision', current_source_revision
    );
  END IF;

  selected_local_date := (selected_composed_at AT TIME ZONE selected_time_zone)::date;

  SELECT count(*)
  INTO today_class_count
  FROM scheduling.scheduled_class_meeting AS meeting
  WHERE meeting.tenant_id = p_tenant_id
    AND meeting.local_date = selected_local_date
    AND meeting.meeting_status = 'scheduled'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
      WHERE teacher.value = selected_staff_id::text
    );

  SELECT count(*)
  INTO open_attendance_count
  FROM attendance.attendance_session AS attendance_session
  JOIN scheduling.scheduled_class_meeting AS meeting
    ON meeting.tenant_id = attendance_session.tenant_id
   AND meeting.scheduled_meeting_id = attendance_session.scheduled_meeting_id
  WHERE attendance_session.tenant_id = p_tenant_id
    AND attendance_session.campus_id = p_campus_id
    AND attendance_session.local_date = selected_local_date
    AND attendance_session.session_state = 'open'
    AND meeting.meeting_status = 'scheduled'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
      WHERE teacher.value = selected_staff_id::text
    );

  SELECT count(*)
  INTO upcoming_assessment_count
  FROM gradebook.assessment AS assessment
  WHERE assessment.tenant_id = p_tenant_id
    AND assessment.assessment_state = 'published'
    AND (assessment.due_at AT TIME ZONE selected_time_zone)::date
      BETWEEN selected_local_date AND selected_local_date + 7
    AND EXISTS (
      SELECT 1
      FROM scheduling.class_meeting_pattern AS pattern
      WHERE pattern.tenant_id = assessment.tenant_id
        AND pattern.section_id = assessment.section_id
        AND pattern.valid_from <= selected_local_date
        AND (pattern.valid_to IS NULL OR pattern.valid_to >= selected_local_date)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(pattern.teacher_ids) AS teacher(value)
          WHERE teacher.value = selected_staff_id::text
        )
    );

  SELECT count(*)
  INTO missing_result_count
  FROM gradebook.assessment_result AS result
  JOIN gradebook.assessment AS assessment
    ON assessment.tenant_id = result.tenant_id
   AND assessment.assessment_id = result.assessment_id
  WHERE result.tenant_id = p_tenant_id
    AND result.result_state = 'missing'
    AND assessment.assessment_state IN ('published', 'closed')
    AND EXISTS (
      SELECT 1
      FROM scheduling.class_meeting_pattern AS pattern
      WHERE pattern.tenant_id = assessment.tenant_id
        AND pattern.section_id = assessment.section_id
        AND pattern.valid_from <= selected_local_date
        AND (pattern.valid_to IS NULL OR pattern.valid_to >= selected_local_date)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(pattern.teacher_ids) AS teacher(value)
          WHERE teacher.value = selected_staff_id::text
        )
    );

  SELECT COALESCE(jsonb_agg(item ORDER BY starts_at, scheduled_meeting_id), '[]'::jsonb)
  INTO today_classes
  FROM (
    SELECT
      meeting.starts_at,
      meeting.scheduled_meeting_id,
      jsonb_build_object(
        'id', meeting.scheduled_meeting_id,
        'sectionId', meeting.section_id,
        'startsAt', to_char(meeting.starts_at, 'HH24:MI'),
        'endsAt', to_char(meeting.ends_at, 'HH24:MI'),
        'roomId', meeting.room_id,
        'status', meeting.meeting_status
      ) AS item
    FROM scheduling.scheduled_class_meeting AS meeting
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.local_date = selected_local_date
      AND meeting.meeting_status = 'scheduled'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
        WHERE teacher.value = selected_staff_id::text
      )
    ORDER BY meeting.starts_at, meeting.scheduled_meeting_id
    LIMIT 8
  ) AS assigned_classes;

  composed_payload := jsonb_build_object(
    'schemaVersion', 1,
    'view', 'teacher-home',
    'localDate', selected_local_date,
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'id', 'today-classes',
        'label', 'Today''s classes',
        'value', today_class_count,
        'definition', 'Scheduled classes assigned to the linked teacher for the campus-local date.',
        'tone', 'information',
        'href', '/teacher/classes',
        'capability', 'classes.assigned.read'
      ),
      jsonb_build_object(
        'id', 'open-attendance',
        'label', 'Open attendance',
        'value', open_attendance_count,
        'definition', 'Assigned attendance sessions for today that are not finalized.',
        'tone', CASE WHEN open_attendance_count = 0 THEN 'stable' ELSE 'warning' END,
        'href', '/teacher/attendance',
        'capability', 'attendance.manage'
      ),
      jsonb_build_object(
        'id', 'upcoming-assessments',
        'label', 'Assessments due in 7 days',
        'value', upcoming_assessment_count,
        'definition', 'Published assessments in currently assigned sections due within seven local days.',
        'tone', 'information',
        'href', '/teacher/gradebook',
        'capability', 'gradebook.manage'
      ),
      jsonb_build_object(
        'id', 'missing-results',
        'label', 'Missing results',
        'value', missing_result_count,
        'definition', 'Explicit missing results in assessments for currently assigned sections.',
        'tone', CASE WHEN missing_result_count = 0 THEN 'stable' ELSE 'error' END,
        'href', '/teacher/gradebook',
        'capability', 'gradebook.manage'
      )
    ),
    'today', jsonb_build_object('classes', today_classes),
    'exceptions',
      CASE WHEN open_attendance_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'teacher-attendance-open',
          'area', 'Attendance',
          'title', 'Attendance requires finalization',
          'summary', open_attendance_count::text || ' assigned session(s) remain open.',
          'severity', 'warning',
          'status', 'Open',
          'href', '/teacher/attendance',
          'capability', 'attendance.manage'
        ))
      ELSE '[]'::jsonb END
      || CASE WHEN missing_result_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'teacher-results-missing',
          'area', 'Gradebook',
          'title', 'Missing results require review',
          'summary', missing_result_count::text || ' result(s) are marked missing.',
          'severity', 'error',
          'status', 'Review',
          'href', '/teacher/gradebook',
          'capability', 'gradebook.manage'
        ))
      ELSE '[]'::jsonb END,
    'source', 'database-teacher-composer-v1'
  );

  composed_payload_bytes := octet_length(convert_to(composed_payload::text, 'UTF8'));
  composed_payload_digest := encode(
    public.digest(convert_to(composed_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  IF current_payload_digest IS NOT NULL
     AND current_payload_digest = composed_payload_digest THEN
    selected_state := 'unchanged';
    selected_source_revision := current_source_revision;
    selected_payload_digest := current_payload_digest;
    selected_payload_bytes := current_payload_bytes;
  ELSE
    publisher_result := platform.publish_runtime_projection_source(
      p_tenant_id,
      p_membership_id,
      p_campus_id,
      p_expected_previous_revision,
      composed_payload,
      selected_composed_at,
      p_composer_id,
      p_correlation_id
    );

    IF publisher_result->>'published' <> 'true' THEN
      publisher_reason := publisher_result->>'reason';
      IF publisher_reason = 'revision-conflict' THEN
        RETURN jsonb_build_object(
          'composed', false,
          'reason', 'revision-conflict',
          'currentRevision', COALESCE(
            (publisher_result->>'currentRevision')::bigint,
            current_source_revision
          )
        );
      ELSIF publisher_reason = 'scope-inactive' THEN
        RETURN jsonb_build_object('composed', false, 'reason', 'scope-inactive');
      ELSIF publisher_reason IN ('persona-unmapped', 'persona-ambiguous') THEN
        RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-teacher');
      END IF;
      RETURN jsonb_build_object('composed', false, 'reason', 'publisher-rejected');
    END IF;

    selected_state := 'published';
    selected_source_revision := (publisher_result->'publication'->>'sourceRevision')::bigint;
    selected_payload_digest := publisher_result->'publication'->>'payloadDigest';
    selected_payload_bytes := (publisher_result->'publication'->>'payloadBytes')::integer;
  END IF;

  INSERT INTO platform.runtime_projection_composition_run (
    composition_id,
    tenant_id,
    membership_id,
    campus_id,
    persona,
    state,
    expected_previous_revision,
    source_revision,
    payload_digest,
    payload_bytes,
    composer_id,
    correlation_id,
    composed_at
  ) VALUES (
    selected_composition_id,
    p_tenant_id,
    p_membership_id,
    p_campus_id,
    'teacher',
    selected_state,
    p_expected_previous_revision,
    selected_source_revision,
    selected_payload_digest,
    selected_payload_bytes,
    p_composer_id,
    p_correlation_id,
    selected_composed_at
  );

  INSERT INTO audit.audit_event (
    tenant_id,
    actor_account_id,
    action,
    subject_type,
    subject_id,
    correlation_id,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    selected_account_id,
    'runtime.projection.teacher.composed',
    'runtime_projection_source',
    p_membership_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'compositionId', selected_composition_id,
      'campusId', p_campus_id,
      'staffId', selected_staff_id,
      'state', selected_state,
      'sourceRevision', selected_source_revision,
      'payloadDigest', selected_payload_digest,
      'payloadBytes', selected_payload_bytes,
      'composerId', p_composer_id
    ),
    selected_composed_at
  );

  RETURN jsonb_build_object(
    'composed', true,
    'composition', jsonb_build_object(
      'compositionId', selected_composition_id,
      'tenantId', p_tenant_id,
      'membershipId', p_membership_id,
      'campusId', p_campus_id,
      'state', selected_state,
      'sourceRevision', selected_source_revision,
      'payloadDigest', selected_payload_digest,
      'payloadBytes', selected_payload_bytes,
      'correlationId', p_correlation_id,
      'composedAt', to_char(
        selected_composed_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.compose_teacher_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;
GRANT EXECUTE ON FUNCTION platform.compose_teacher_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) TO app_projection_composer;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608010101_PILOT-09_teacher_runtime_projection_composer',
  'PILOT-09',
  'Database-owned teacher home composition from linked staff, timetable, attendance and gradebook state'
)
ON CONFLICT (migration_id) DO NOTHING;
