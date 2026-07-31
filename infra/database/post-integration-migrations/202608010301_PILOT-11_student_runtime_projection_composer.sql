ALTER TABLE platform.runtime_projection_composition_run
  DROP CONSTRAINT IF EXISTS runtime_projection_composition_run_persona_check;
ALTER TABLE platform.runtime_projection_composition_run
  ADD CONSTRAINT runtime_projection_composition_run_persona_check
  CHECK (persona IN ('admin', 'teacher', 'guardian', 'student'));

CREATE OR REPLACE FUNCTION platform.compose_student_runtime_projection_source(
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
SET search_path = pg_catalog, platform, iam, tenancy, people, student_lifecycle,
                  academics, scheduling, attendance, gradebook, audit
AS $function$
DECLARE
  selected_account_id uuid;
  selected_person_id uuid;
  selected_student_profile_id uuid;
  selected_enrollment_id uuid;
  selected_persona text;
  persona_count integer;
  selected_time_zone text;
  selected_local_date date;
  student_candidate_count integer;
  lesson_count bigint;
  attendance_alert_count bigint;
  upcoming_assessment_count bigint;
  published_grade_count bigint;
  lessons_payload jsonb := '[]'::jsonb;
  results_payload jsonb := '[]'::jsonb;
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

  IF persona_count <> 1 OR selected_persona <> 'student' THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-student');
  END IF;

  selected_local_date := (selected_composed_at AT TIME ZONE selected_time_zone)::date;

  WITH candidates AS (
    SELECT
      person_link.person_id,
      student_profile.student_profile_id,
      enrollment.enrollment_id
    FROM iam.person_link AS person_link
    JOIN people.person AS person
      ON person.tenant_id = person_link.tenant_id
     AND person.person_id = person_link.person_id
     AND person.status = 'active'
    JOIN student_lifecycle.student_profile AS student_profile
      ON student_profile.tenant_id = person.tenant_id
     AND student_profile.person_id = person.person_id
     AND student_profile.status = 'active'
    JOIN LATERAL (
      SELECT student_enrollment.enrollment_id
      FROM student_lifecycle.enrollment AS student_enrollment
      WHERE student_enrollment.tenant_id = p_tenant_id
        AND student_enrollment.student_profile_id = student_profile.student_profile_id
        AND student_enrollment.campus_id = p_campus_id
        AND student_enrollment.status = 'active'
        AND student_enrollment.effective_from <= selected_local_date
        AND (
          student_enrollment.effective_to IS NULL
          OR student_enrollment.effective_to >= selected_local_date
        )
      ORDER BY student_enrollment.effective_from DESC, student_enrollment.enrollment_id
      LIMIT 1
    ) AS enrollment ON true
    WHERE person_link.tenant_id = p_tenant_id
      AND person_link.account_id = selected_account_id
  )
  SELECT
    count(*),
    min(person_id),
    min(student_profile_id),
    min(enrollment_id)
  INTO
    student_candidate_count,
    selected_person_id,
    selected_student_profile_id,
    selected_enrollment_id
  FROM candidates;

  IF student_candidate_count <> 1
     OR selected_person_id IS NULL
     OR selected_student_profile_id IS NULL
     OR selected_enrollment_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'student-unlinked');
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

  SELECT count(*)
  INTO lesson_count
  FROM scheduling.scheduled_class_meeting AS meeting
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = meeting.tenant_id
   AND timetable.timetable_version_id = meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  JOIN academics.class_section AS section
    ON section.tenant_id = meeting.tenant_id
   AND section.section_id = meeting.section_id
   AND section.campus_id = p_campus_id
   AND section.publication_state = 'published'
  JOIN academics.section_roster AS roster
    ON roster.tenant_id = section.tenant_id
   AND roster.section_id = section.section_id
   AND roster.student_profile_id = selected_student_profile_id
   AND roster.enrollment_id = selected_enrollment_id
   AND roster.joined_on <= selected_local_date
   AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
  WHERE meeting.tenant_id = p_tenant_id
    AND meeting.local_date = selected_local_date
    AND meeting.meeting_status = 'scheduled';

  SELECT count(*)
  INTO attendance_alert_count
  FROM attendance.attendance_record AS attendance_record
  JOIN attendance.attendance_session AS attendance_session
    ON attendance_session.tenant_id = attendance_record.tenant_id
   AND attendance_session.session_id = attendance_record.session_id
   AND attendance_session.local_date = selected_local_date
  JOIN scheduling.scheduled_class_meeting AS meeting
    ON meeting.tenant_id = attendance_session.tenant_id
   AND meeting.scheduled_meeting_id = attendance_session.scheduled_meeting_id
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = meeting.tenant_id
   AND timetable.timetable_version_id = meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  JOIN academics.class_section AS section
    ON section.tenant_id = meeting.tenant_id
   AND section.section_id = meeting.section_id
   AND section.campus_id = p_campus_id
   AND section.publication_state = 'published'
  JOIN academics.section_roster AS roster
    ON roster.tenant_id = section.tenant_id
   AND roster.section_id = section.section_id
   AND roster.student_profile_id = selected_student_profile_id
   AND roster.enrollment_id = selected_enrollment_id
   AND roster.joined_on <= selected_local_date
   AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
  JOIN attendance.attendance_code AS attendance_code
    ON attendance_code.tenant_id = attendance_record.tenant_id
   AND attendance_code.attendance_code_id = attendance_record.attendance_code_id
   AND attendance_code.meaning IN ('absent', 'late')
  WHERE attendance_record.tenant_id = p_tenant_id
    AND attendance_record.student_profile_id = selected_student_profile_id;

  SELECT count(*)
  INTO upcoming_assessment_count
  FROM gradebook.assessment AS assessment
  JOIN academics.class_section AS section
    ON section.tenant_id = assessment.tenant_id
   AND section.section_id = assessment.section_id
   AND section.campus_id = p_campus_id
   AND section.publication_state = 'published'
  JOIN academics.section_roster AS roster
    ON roster.tenant_id = section.tenant_id
   AND roster.section_id = section.section_id
   AND roster.student_profile_id = selected_student_profile_id
   AND roster.enrollment_id = selected_enrollment_id
   AND roster.joined_on <= selected_local_date
   AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
  WHERE assessment.tenant_id = p_tenant_id
    AND assessment.assessment_state = 'published'
    AND assessment.due_at >= selected_composed_at
    AND assessment.due_at < selected_composed_at + interval '7 days';

  SELECT count(*)
  INTO published_grade_count
  FROM gradebook.grade_publication AS grade_publication
  JOIN gradebook.grade_calculation_snapshot AS grade_snapshot
    ON grade_snapshot.tenant_id = grade_publication.tenant_id
   AND grade_snapshot.snapshot_id = grade_publication.snapshot_id
   AND grade_snapshot.student_profile_id = selected_student_profile_id
  JOIN academics.class_section AS section
    ON section.tenant_id = grade_snapshot.tenant_id
   AND section.section_id = grade_snapshot.section_id
   AND section.campus_id = p_campus_id
   AND section.publication_state = 'published'
  JOIN academics.section_roster AS roster
    ON roster.tenant_id = section.tenant_id
   AND roster.section_id = section.section_id
   AND roster.student_profile_id = selected_student_profile_id
   AND roster.enrollment_id = selected_enrollment_id
   AND roster.joined_on <= selected_local_date
   AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
  WHERE grade_publication.tenant_id = p_tenant_id
    AND grade_publication.available_from <= selected_composed_at
    AND (
      grade_publication.available_to IS NULL
      OR grade_publication.available_to >= selected_composed_at
    );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'lessonId', lesson.lesson_id,
        'sectionId', lesson.section_id,
        'sectionTitle', lesson.section_title,
        'courseTitle', lesson.course_title,
        'startsAt', lesson.starts_at,
        'endsAt', lesson.ends_at,
        'roomId', lesson.room_id,
        'state', 'scheduled',
        'href', '/student/timetable',
        'requiredCapability', 'timetable.self.read'
      )
      ORDER BY lesson.starts_at, lesson.lesson_id
    ),
    '[]'::jsonb
  )
  INTO lessons_payload
  FROM (
    SELECT
      meeting.scheduled_meeting_id AS lesson_id,
      meeting.section_id,
      section.section_title,
      course.course_title,
      meeting.starts_at,
      meeting.ends_at,
      meeting.room_id
    FROM scheduling.scheduled_class_meeting AS meeting
    JOIN scheduling.timetable_version AS timetable
      ON timetable.tenant_id = meeting.tenant_id
     AND timetable.timetable_version_id = meeting.timetable_version_id
     AND timetable.campus_id = p_campus_id
     AND timetable.publication_state = 'published'
    JOIN academics.class_section AS section
      ON section.tenant_id = meeting.tenant_id
     AND section.section_id = meeting.section_id
     AND section.campus_id = p_campus_id
     AND section.publication_state = 'published'
    JOIN academics.course_version AS course
      ON course.tenant_id = section.tenant_id
     AND course.course_version_id = section.course_version_id
     AND course.publication_state = 'published'
    JOIN academics.section_roster AS roster
      ON roster.tenant_id = section.tenant_id
     AND roster.section_id = section.section_id
     AND roster.student_profile_id = selected_student_profile_id
     AND roster.enrollment_id = selected_enrollment_id
     AND roster.joined_on <= selected_local_date
     AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.local_date = selected_local_date
      AND meeting.meeting_status = 'scheduled'
    ORDER BY meeting.starts_at, meeting.scheduled_meeting_id
    LIMIT 8
  ) AS lesson;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'resultId', result.result_id,
        'sectionId', result.section_id,
        'sectionTitle', result.section_title,
        'grade', result.displayed_grade,
        'publishedAt', result.published_at,
        'href', '/student/results',
        'requiredCapability', 'records.self.read'
      )
      ORDER BY result.published_at DESC, result.result_id
    ),
    '[]'::jsonb
  )
  INTO results_payload
  FROM (
    SELECT
      grade_snapshot.snapshot_id AS result_id,
      grade_snapshot.section_id,
      section.section_title,
      grade_snapshot.displayed_grade,
      grade_publication.published_at
    FROM gradebook.grade_publication AS grade_publication
    JOIN gradebook.grade_calculation_snapshot AS grade_snapshot
      ON grade_snapshot.tenant_id = grade_publication.tenant_id
     AND grade_snapshot.snapshot_id = grade_publication.snapshot_id
     AND grade_snapshot.student_profile_id = selected_student_profile_id
    JOIN academics.class_section AS section
      ON section.tenant_id = grade_snapshot.tenant_id
     AND section.section_id = grade_snapshot.section_id
     AND section.campus_id = p_campus_id
     AND section.publication_state = 'published'
    JOIN academics.section_roster AS roster
      ON roster.tenant_id = section.tenant_id
     AND roster.section_id = section.section_id
     AND roster.student_profile_id = selected_student_profile_id
     AND roster.enrollment_id = selected_enrollment_id
     AND roster.joined_on <= selected_local_date
     AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
    WHERE grade_publication.tenant_id = p_tenant_id
      AND grade_publication.available_from <= selected_composed_at
      AND (
        grade_publication.available_to IS NULL
        OR grade_publication.available_to >= selected_composed_at
      )
    ORDER BY grade_publication.published_at DESC, grade_snapshot.snapshot_id
    LIMIT 8
  ) AS result;

  composed_payload := jsonb_build_object(
    'schemaVersion', 1,
    'view', 'student-home',
    'localDate', selected_local_date,
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'id', 'today-lessons',
        'label', 'Lessons today',
        'value', lesson_count,
        'definition', 'Scheduled lessons for the current exact-campus roster.',
        'tone', 'information',
        'href', '/student/timetable',
        'capability', 'timetable.self.read'
      ),
      jsonb_build_object(
        'id', 'attendance-alerts',
        'label', 'Attendance alerts',
        'value', attendance_alert_count,
        'definition', 'Current-day absent or late attendance records for this student.',
        'tone', CASE WHEN attendance_alert_count = 0 THEN 'stable' ELSE 'warning' END,
        'href', '/student/attendance',
        'capability', 'attendance.self.read'
      ),
      jsonb_build_object(
        'id', 'upcoming-assessments',
        'label', 'Upcoming assessments',
        'value', upcoming_assessment_count,
        'definition', 'Published assessments due within the next seven days for current sections.',
        'tone', CASE WHEN upcoming_assessment_count = 0 THEN 'stable' ELSE 'information' END,
        'href', '/student/results',
        'capability', 'records.self.read'
      ),
      jsonb_build_object(
        'id', 'published-grades',
        'label', 'Published grades',
        'value', published_grade_count,
        'definition', 'Currently available grade publications for this student.',
        'tone', 'stable',
        'href', '/student/results',
        'capability', 'records.self.read'
      )
    ),
    'lessons', lessons_payload,
    'results', results_payload,
    'exceptions',
      CASE WHEN attendance_alert_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'student-attendance-alert',
          'area', 'Attendance',
          'title', 'Attendance requires review',
          'summary', attendance_alert_count::text || ' absent or late record(s) are visible today.',
          'severity', 'warning',
          'status', 'Review',
          'href', '/student/attendance',
          'capability', 'attendance.self.read'
        ))
      ELSE '[]'::jsonb END,
    'source', 'database-student-composer-v1'
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
        RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-student');
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
    'student',
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
    'runtime.projection.student.composed',
    'runtime_projection_source',
    p_membership_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'compositionId', selected_composition_id,
      'campusId', p_campus_id,
      'studentProfileId', selected_student_profile_id,
      'enrollmentId', selected_enrollment_id,
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

REVOKE ALL ON FUNCTION platform.compose_student_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;
GRANT EXECUTE ON FUNCTION platform.compose_student_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) TO app_projection_composer;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608010301_PILOT-11_student_runtime_projection_composer',
  'PILOT-11',
  'Database-owned student home composition from exact profile, campus enrollment, current roster, timetable, attendance, assessments and published grades'
)
ON CONFLICT (migration_id) DO NOTHING;
