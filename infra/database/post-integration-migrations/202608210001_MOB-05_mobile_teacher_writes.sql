CREATE TABLE IF NOT EXISTS platform.mobile_teacher_write_command (
  account_id uuid NOT NULL REFERENCES iam.account (account_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  campus_id uuid NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('attendance', 'grade-draft')),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  operation_id text NOT NULL CHECK (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_digest text NOT NULL CHECK (length(request_digest) = 64),
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id, operation_type, idempotency_key),
  UNIQUE (account_id, operation_type, operation_id)
);

CREATE TABLE IF NOT EXISTS platform.mobile_teacher_grade_revision (
  tenant_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES gradebook.assessment (tenant_id, assessment_id) ON DELETE CASCADE
);

REVOKE ALL ON TABLE platform.mobile_teacher_write_command FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE platform.mobile_teacher_grade_revision FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_write_authority(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_required_capability text
)
RETURNS TABLE (
  account_id uuid,
  staff_id uuid,
  time_zone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_capabilities text[];
  selected_time_zone text;
  selected_person_id uuid;
  selected_staff_id uuid;
  linked_person_count bigint;
BEGIN
  SELECT scope.account_id, scope.capabilities, scope.time_zone
  INTO selected_account_id, selected_capabilities, selected_time_zone
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, 'teacher'
  ) AS scope;

  IF selected_account_id IS NULL
     OR selected_time_zone IS NULL
     OR p_required_capability IS NULL
     OR NOT (p_required_capability = ANY(selected_capabilities)) THEN
    RETURN;
  END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = selected_account_id;

  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN; END IF;

  SELECT staff.staff_id
  INTO selected_staff_id
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active'
  ORDER BY staff.staff_id
  LIMIT 1;

  IF selected_staff_id IS NULL THEN RETURN; END IF;

  RETURN QUERY SELECT selected_account_id, selected_staff_id, selected_time_zone;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_write_authority(text, text, uuid, uuid, text)
  FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.submit_mobile_teacher_attendance(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_idempotency_key text,
  p_operation_id text,
  p_meeting_id uuid,
  p_base_version bigint,
  p_client_created_at timestamptz,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_staff_id uuid;
  selected_time_zone text;
  selected_section_id uuid;
  selected_meeting_version bigint;
  selected_local_date date;
  selected_starts_at time;
  selected_ends_at time;
  selected_meeting_timezone text;
  selected_session_id uuid;
  selected_session_version bigint;
  selected_session_state text;
  request_digest text;
  previous_command platform.mobile_teacher_write_command%ROWTYPE;
  response_payload jsonb;
  line_item jsonb;
  selected_student_id uuid;
  selected_mark text;
  selected_code_id uuid;
  selected_code_count bigint;
  next_revision bigint;
  now_at timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_meeting_id IS NULL
     OR p_base_version IS NULL
     OR p_base_version < 0
     OR p_client_created_at IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
     OR p_operation_id IS NULL
     OR p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_lines IS NULL
     OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 256 THEN
    RETURN jsonb_build_object(
      'operationId', coalesce(p_operation_id, 'invalid-operation'),
      'acceptedRevision', greatest(coalesce(p_base_version, 0), 0),
      'status', 'rejected',
      'reasonCode', 'invalid-request'
    );
  END IF;

  SELECT authority.account_id, authority.staff_id, authority.time_zone
  INTO selected_account_id, selected_staff_id, selected_time_zone
  FROM platform.resolve_mobile_teacher_write_authority(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, 'attendance.take'
  ) AS authority;
  IF selected_account_id IS NULL OR selected_staff_id IS NULL THEN RETURN NULL; END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p_tenant_id::text,
          p_campus_id::text,
          p_operation_id,
          p_meeting_id::text,
          p_base_version::text,
          to_char(p_client_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          p_lines::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended('mobile-teacher-command:' || selected_account_id::text || ':attendance:' || p_idempotency_key, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('mobile-teacher-attendance:' || p_tenant_id::text || ':' || p_meeting_id::text, 0)
  );

  SELECT * INTO previous_command
  FROM platform.mobile_teacher_write_command AS command
  WHERE command.account_id = selected_account_id
    AND command.operation_type = 'attendance'
    AND command.idempotency_key = p_idempotency_key;

  IF previous_command.account_id IS NOT NULL THEN
    IF previous_command.request_digest = request_digest
       AND previous_command.operation_id = p_operation_id THEN
      RETURN previous_command.response_body;
    END IF;
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce((previous_command.response_body->>'acceptedRevision')::bigint, p_base_version),
      'status', 'conflict',
      'reasonCode', 'idempotency-conflict'
    );
  END IF;

  SELECT * INTO previous_command
  FROM platform.mobile_teacher_write_command AS command
  WHERE command.account_id = selected_account_id
    AND command.operation_type = 'attendance'
    AND command.operation_id = p_operation_id;

  IF previous_command.account_id IS NOT NULL THEN
    IF previous_command.request_digest = request_digest THEN RETURN previous_command.response_body; END IF;
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce((previous_command.response_body->>'acceptedRevision')::bigint, p_base_version),
      'status', 'conflict',
      'reasonCode', 'operation-conflict'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) AS entry(value)
    WHERE jsonb_typeof(entry.value) <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(entry.value)) <> 2
       OR NOT (entry.value ? 'studentId')
       OR NOT (entry.value ? 'mark')
       OR (entry.value->>'studentId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR (entry.value->>'mark') NOT IN ('present', 'absent', 'late', 'excused')
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'rejected',
      'reasonCode', 'invalid-lines'
    );
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_array_elements(p_lines) AS entry(value)
  ) <> (
    SELECT count(DISTINCT entry.value->>'studentId')
    FROM jsonb_array_elements(p_lines) AS entry(value)
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'rejected',
      'reasonCode', 'duplicate-student'
    );
  END IF;

  SELECT
    meeting.section_id,
    meeting.version,
    meeting.local_date,
    meeting.starts_at,
    meeting.ends_at,
    meeting.timezone,
    attendance_session.session_id,
    attendance_session.version,
    attendance_session.session_state
  INTO
    selected_section_id,
    selected_meeting_version,
    selected_local_date,
    selected_starts_at,
    selected_ends_at,
    selected_meeting_timezone,
    selected_session_id,
    selected_session_version,
    selected_session_state
  FROM scheduling.scheduled_class_meeting AS meeting
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = meeting.tenant_id
   AND timetable.timetable_version_id = meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  LEFT JOIN scheduling.substitution_assignment AS substitution
    ON substitution.tenant_id = meeting.tenant_id
   AND substitution.scheduled_meeting_id = meeting.scheduled_meeting_id
   AND substitution.effective_date = meeting.local_date
  LEFT JOIN attendance.attendance_session AS attendance_session
    ON attendance_session.tenant_id = meeting.tenant_id
   AND attendance_session.scheduled_meeting_id = meeting.scheduled_meeting_id
  WHERE meeting.tenant_id = p_tenant_id
    AND meeting.scheduled_meeting_id = p_meeting_id
    AND meeting.meeting_status = 'scheduled'
    AND (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
        WHERE teacher.value = selected_staff_id::text
      )
      OR substitution.substitute_teacher_id = selected_staff_id
    )
  LIMIT 1;

  IF selected_section_id IS NULL OR selected_meeting_version IS NULL THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) AS entry(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM academics.section_roster AS roster
      WHERE roster.tenant_id = p_tenant_id
        AND roster.section_id = selected_section_id
        AND roster.student_profile_id = (entry.value->>'studentId')::uuid
        AND roster.joined_on <= selected_local_date
        AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
    )
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce(selected_session_version, selected_meeting_version),
      'status', 'rejected',
      'reasonCode', 'roster-mismatch'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT entry.value->>'mark' AS mark
      FROM jsonb_array_elements(p_lines) AS entry(value)
    ) AS requested_mark
    LEFT JOIN LATERAL (
      SELECT count(*) AS code_count
      FROM attendance.attendance_code AS code
      JOIN attendance.attendance_policy_version AS policy
        ON policy.tenant_id = code.tenant_id
       AND policy.policy_version_id = code.policy_version_id
       AND policy.publication_state = 'published'
      WHERE code.tenant_id = p_tenant_id
        AND code.meaning = requested_mark.mark
    ) AS code_match ON true
    WHERE code_match.code_count <> 1
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce(selected_session_version, selected_meeting_version),
      'status', 'requiresReconciliation',
      'reasonCode', 'attendance-code-unavailable'
    );
  END IF;

  IF coalesce(selected_session_version, selected_meeting_version) <> p_base_version THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce(selected_session_version, selected_meeting_version),
      'status', 'conflict',
      'reasonCode', 'revision-conflict'
    );
  END IF;

  IF selected_session_id IS NULL THEN
    INSERT INTO attendance.attendance_session (
      tenant_id,
      scheduled_meeting_id,
      section_id,
      campus_id,
      local_date,
      starts_at,
      ends_at,
      timezone,
      roster_student_ids,
      session_state,
      version
    )
    SELECT
      p_tenant_id,
      p_meeting_id,
      selected_section_id,
      p_campus_id,
      selected_local_date,
      selected_starts_at,
      selected_ends_at,
      selected_meeting_timezone,
      coalesce(
        jsonb_agg(roster.student_profile_id ORDER BY roster.student_profile_id)
          FILTER (WHERE roster.student_profile_id IS NOT NULL),
        '[]'::jsonb
      ),
      'open',
      selected_meeting_version
    FROM academics.section_roster AS roster
    WHERE roster.tenant_id = p_tenant_id
      AND roster.section_id = selected_section_id
      AND roster.joined_on <= selected_local_date
      AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
    RETURNING session_id, version, session_state
    INTO selected_session_id, selected_session_version, selected_session_state;
  END IF;

  SELECT session.version, session.session_state
  INTO selected_session_version, selected_session_state
  FROM attendance.attendance_session AS session
  WHERE session.tenant_id = p_tenant_id
    AND session.session_id = selected_session_id
  FOR UPDATE;

  IF selected_session_state <> 'open' THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', selected_session_version,
      'status', 'conflict',
      'reasonCode', 'attendance-locked'
    );
  END IF;

  IF selected_session_version <> p_base_version THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', selected_session_version,
      'status', 'conflict',
      'reasonCode', 'revision-conflict'
    );
  END IF;

  FOR line_item IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    selected_student_id := (line_item->>'studentId')::uuid;
    selected_mark := line_item->>'mark';

    SELECT min(code.attendance_code_id::text)::uuid, count(*)
    INTO selected_code_id, selected_code_count
    FROM attendance.attendance_code AS code
    JOIN attendance.attendance_policy_version AS policy
      ON policy.tenant_id = code.tenant_id
     AND policy.policy_version_id = code.policy_version_id
     AND policy.publication_state = 'published'
    WHERE code.tenant_id = p_tenant_id
      AND code.meaning = selected_mark;

    IF selected_code_count <> 1 OR selected_code_id IS NULL THEN
      RAISE EXCEPTION 'MOBILE_TEACHER_ATTENDANCE_CODE_CHANGED';
    END IF;

    INSERT INTO attendance.attendance_record (
      tenant_id,
      client_record_id,
      session_id,
      student_profile_id,
      attendance_code_id,
      record_source,
      recorded_by,
      recorded_at,
      version
    ) VALUES (
      p_tenant_id,
      'mobile:' || p_operation_id || ':' || selected_student_id::text,
      selected_session_id,
      selected_student_id,
      selected_code_id,
      'teacher',
      selected_staff_id,
      now_at,
      1
    )
    ON CONFLICT (tenant_id, session_id, student_profile_id)
    DO UPDATE SET
      attendance_code_id = EXCLUDED.attendance_code_id,
      record_source = 'teacher',
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = EXCLUDED.recorded_at,
      version = attendance.attendance_record.version + 1;
  END LOOP;

  UPDATE attendance.attendance_session AS session
  SET version = session.version + 1
  WHERE session.tenant_id = p_tenant_id
    AND session.session_id = selected_session_id
  RETURNING session.version INTO next_revision;

  response_payload := jsonb_build_object(
    'operationId', p_operation_id,
    'acceptedRevision', next_revision,
    'status', 'accepted'
  );

  INSERT INTO platform.mobile_teacher_write_command (
    account_id,
    tenant_id,
    campus_id,
    operation_type,
    idempotency_key,
    operation_id,
    request_digest,
    response_body
  ) VALUES (
    selected_account_id,
    p_tenant_id,
    p_campus_id,
    'attendance',
    p_idempotency_key,
    p_operation_id,
    request_digest,
    response_payload
  );

  RETURN response_payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.submit_mobile_teacher_attendance(
  text, text, uuid, uuid, text, text, uuid, bigint, timestamptz, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.submit_mobile_teacher_attendance(
  text, text, uuid, uuid, text, text, uuid, bigint, timestamptz, jsonb
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.save_mobile_teacher_grade_draft(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_idempotency_key text,
  p_operation_id text,
  p_assessment_id uuid,
  p_base_version bigint,
  p_score_scale integer,
  p_maximum_score_units bigint,
  p_entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_staff_id uuid;
  selected_time_zone text;
  selected_section_id uuid;
  selected_reporting_period_id uuid;
  selected_assessment_state text;
  selected_assessment_version bigint;
  selected_maximum_points numeric(12,4);
  selected_local_date date;
  request_digest text;
  previous_command platform.mobile_teacher_write_command%ROWTYPE;
  response_payload jsonb;
  current_revision bigint;
  next_revision bigint;
  entry_item jsonb;
  selected_student_id uuid;
  selected_status text;
  selected_score_units bigint;
  selected_raw_score numeric(18,6);
  now_at timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL
     OR p_campus_id IS NULL
     OR p_assessment_id IS NULL
     OR p_base_version IS NULL
     OR p_base_version < 0
     OR p_score_scale IS NULL
     OR p_score_scale < 1
     OR p_score_scale > 1000000
     OR p_maximum_score_units IS NULL
     OR p_maximum_score_units < 1
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
     OR p_operation_id IS NULL
     OR p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_entries IS NULL
     OR jsonb_typeof(p_entries) <> 'array'
     OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 512 THEN
    RETURN jsonb_build_object(
      'operationId', coalesce(p_operation_id, 'invalid-operation'),
      'acceptedRevision', greatest(coalesce(p_base_version, 0), 0),
      'status', 'rejected',
      'reasonCode', 'invalid-request'
    );
  END IF;

  SELECT authority.account_id, authority.staff_id, authority.time_zone
  INTO selected_account_id, selected_staff_id, selected_time_zone
  FROM platform.resolve_mobile_teacher_write_authority(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, 'grades.write'
  ) AS authority;
  IF selected_account_id IS NULL OR selected_staff_id IS NULL OR selected_time_zone IS NULL THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p_tenant_id::text,
          p_campus_id::text,
          p_operation_id,
          p_assessment_id::text,
          p_base_version::text,
          p_score_scale::text,
          p_maximum_score_units::text,
          p_entries::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended('mobile-teacher-command:' || selected_account_id::text || ':grade-draft:' || p_idempotency_key, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('mobile-teacher-grade:' || p_tenant_id::text || ':' || p_assessment_id::text, 0)
  );

  SELECT * INTO previous_command
  FROM platform.mobile_teacher_write_command AS command
  WHERE command.account_id = selected_account_id
    AND command.operation_type = 'grade-draft'
    AND command.idempotency_key = p_idempotency_key;

  IF previous_command.account_id IS NOT NULL THEN
    IF previous_command.request_digest = request_digest
       AND previous_command.operation_id = p_operation_id THEN
      RETURN previous_command.response_body;
    END IF;
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce((previous_command.response_body->>'acceptedRevision')::bigint, p_base_version),
      'status', 'conflict',
      'reasonCode', 'idempotency-conflict'
    );
  END IF;

  SELECT * INTO previous_command
  FROM platform.mobile_teacher_write_command AS command
  WHERE command.account_id = selected_account_id
    AND command.operation_type = 'grade-draft'
    AND command.operation_id = p_operation_id;

  IF previous_command.account_id IS NOT NULL THEN
    IF previous_command.request_digest = request_digest THEN RETURN previous_command.response_body; END IF;
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', coalesce((previous_command.response_body->>'acceptedRevision')::bigint, p_base_version),
      'status', 'conflict',
      'reasonCode', 'operation-conflict'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_entries) AS entry(value)
    WHERE jsonb_typeof(entry.value) <> 'object'
       OR NOT (entry.value ? 'studentId')
       OR NOT (entry.value ? 'status')
       OR (entry.value->>'studentId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR (entry.value->>'status') NOT IN ('scored', 'missing', 'exempt')
       OR (
         entry.value->>'status' = 'scored'
         AND (
           NOT (entry.value ? 'scoreUnits')
           OR (entry.value->>'scoreUnits') !~ '^[0-9]+$'
           OR (entry.value->>'scoreUnits')::numeric > p_maximum_score_units
           OR (SELECT count(*) FROM jsonb_object_keys(entry.value)) <> 3
         )
       )
       OR (
         entry.value->>'status' IN ('missing', 'exempt')
         AND ((entry.value ? 'scoreUnits') OR (SELECT count(*) FROM jsonb_object_keys(entry.value)) <> 2)
       )
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'rejected',
      'reasonCode', 'invalid-entries'
    );
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_array_elements(p_entries) AS entry(value)
  ) <> (
    SELECT count(DISTINCT entry.value->>'studentId')
    FROM jsonb_array_elements(p_entries) AS entry(value)
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'rejected',
      'reasonCode', 'duplicate-student'
    );
  END IF;

  selected_local_date := (now_at AT TIME ZONE selected_time_zone)::date;

  SELECT
    assessment.section_id,
    assessment.reporting_period_id,
    assessment.assessment_state,
    assessment.version,
    assessment.maximum_points
  INTO
    selected_section_id,
    selected_reporting_period_id,
    selected_assessment_state,
    selected_assessment_version,
    selected_maximum_points
  FROM gradebook.assessment AS assessment
  JOIN academics.class_section AS section
    ON section.tenant_id = assessment.tenant_id
   AND section.section_id = assessment.section_id
   AND section.campus_id = p_campus_id
  WHERE assessment.tenant_id = p_tenant_id
    AND assessment.assessment_id = p_assessment_id
    AND EXISTS (
      SELECT 1
      FROM academics.staff_assignment AS assignment
      WHERE assignment.tenant_id = assessment.tenant_id
        AND assignment.section_id = assessment.section_id
        AND assignment.staff_profile_id = selected_staff_id
        AND assignment.assignment_role IN ('teacher', 'co-teacher')
        AND assignment.effective_from <= selected_local_date
        AND (assignment.effective_to IS NULL OR assignment.effective_to >= selected_local_date)
    )
  LIMIT 1;

  IF selected_section_id IS NULL
     OR selected_reporting_period_id IS NULL
     OR selected_assessment_version IS NULL THEN
    RETURN NULL;
  END IF;

  IF selected_assessment_state = 'closed' THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'rejected',
      'reasonCode', 'assessment-closed'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM gradebook.gradebook_lock AS grade_lock
    WHERE grade_lock.tenant_id = p_tenant_id
      AND grade_lock.section_id = selected_section_id
      AND grade_lock.reporting_period_id = selected_reporting_period_id
      AND grade_lock.lock_state = 'locked'
  ) THEN
    SELECT coalesce(
      (
        SELECT revision.revision
        FROM platform.mobile_teacher_grade_revision AS revision
        WHERE revision.tenant_id = p_tenant_id
          AND revision.assessment_id = p_assessment_id
      ),
      selected_assessment_version
    )
    INTO current_revision;
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', current_revision,
      'status', 'conflict',
      'reasonCode', 'gradebook-locked'
    );
  END IF;

  IF selected_maximum_points * p_score_scale::numeric <> p_maximum_score_units::numeric THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'requiresReconciliation',
      'reasonCode', 'score-scale-mismatch'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_entries) AS entry(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM academics.section_roster AS roster
      WHERE roster.tenant_id = p_tenant_id
        AND roster.section_id = selected_section_id
        AND roster.student_profile_id = (entry.value->>'studentId')::uuid
        AND roster.joined_on <= selected_local_date
        AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
    )
  ) THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', p_base_version,
      'status', 'rejected',
      'reasonCode', 'roster-mismatch'
    );
  END IF;

  SELECT revision
  INTO current_revision
  FROM platform.mobile_teacher_grade_revision
  WHERE tenant_id = p_tenant_id
    AND assessment_id = p_assessment_id
  FOR UPDATE;

  current_revision := coalesce(current_revision, selected_assessment_version);
  IF current_revision <> p_base_version THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', current_revision,
      'status', 'conflict',
      'reasonCode', 'revision-conflict'
    );
  END IF;

  INSERT INTO platform.mobile_teacher_grade_revision (tenant_id, assessment_id, revision)
  VALUES (p_tenant_id, p_assessment_id, selected_assessment_version)
  ON CONFLICT (tenant_id, assessment_id) DO NOTHING;

  SELECT revision
  INTO current_revision
  FROM platform.mobile_teacher_grade_revision
  WHERE tenant_id = p_tenant_id
    AND assessment_id = p_assessment_id
  FOR UPDATE;

  IF current_revision <> p_base_version THEN
    RETURN jsonb_build_object(
      'operationId', p_operation_id,
      'acceptedRevision', current_revision,
      'status', 'conflict',
      'reasonCode', 'revision-conflict'
    );
  END IF;

  FOR entry_item IN SELECT value FROM jsonb_array_elements(p_entries)
  LOOP
    selected_student_id := (entry_item->>'studentId')::uuid;
    selected_status := entry_item->>'status';
    IF selected_status = 'scored' THEN
      selected_score_units := (entry_item->>'scoreUnits')::bigint;
      selected_raw_score := selected_score_units::numeric / p_score_scale::numeric;
    ELSE
      selected_score_units := NULL;
      selected_raw_score := NULL;
    END IF;

    INSERT INTO gradebook.assessment_result (
      tenant_id,
      assessment_id,
      student_profile_id,
      result_state,
      raw_score,
      entered_by,
      entered_at,
      version
    ) VALUES (
      p_tenant_id,
      p_assessment_id,
      selected_student_id,
      selected_status,
      selected_raw_score,
      selected_staff_id,
      now_at,
      1
    )
    ON CONFLICT (tenant_id, assessment_id, student_profile_id)
    DO UPDATE SET
      result_state = EXCLUDED.result_state,
      raw_score = EXCLUDED.raw_score,
      entered_by = EXCLUDED.entered_by,
      entered_at = EXCLUDED.entered_at,
      version = gradebook.assessment_result.version + 1;
  END LOOP;

  UPDATE platform.mobile_teacher_grade_revision AS revision
  SET revision = revision.revision + 1,
      updated_at = now_at
  WHERE revision.tenant_id = p_tenant_id
    AND revision.assessment_id = p_assessment_id
  RETURNING revision.revision INTO next_revision;

  response_payload := jsonb_build_object(
    'operationId', p_operation_id,
    'acceptedRevision', next_revision,
    'status', 'accepted'
  );

  INSERT INTO platform.mobile_teacher_write_command (
    account_id,
    tenant_id,
    campus_id,
    operation_type,
    idempotency_key,
    operation_id,
    request_digest,
    response_body
  ) VALUES (
    selected_account_id,
    p_tenant_id,
    p_campus_id,
    'grade-draft',
    p_idempotency_key,
    p_operation_id,
    request_digest,
    response_payload
  );

  RETURN response_payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.save_mobile_teacher_grade_draft(
  text, text, uuid, uuid, text, text, uuid, bigint, integer, bigint, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.save_mobile_teacher_grade_draft(
  text, text, uuid, uuid, text, text, uuid, bigint, integer, bigint, jsonb
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608210001_MOB-05_mobile_teacher_writes',
  'MOB-05',
  'Idempotent tenant-safe teacher attendance and grade draft writes without finalization or publication authority'
)
ON CONFLICT (migration_id) DO NOTHING;
