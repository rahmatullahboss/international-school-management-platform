CREATE OR REPLACE FUNCTION platform.resolve_mobile_request_scope(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text
)
RETURNS TABLE (
  account_id uuid,
  time_zone text,
  capabilities text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT
    access.account_id,
    access.time_zone,
    access.capabilities
  FROM iam.resolve_mobile_bootstrap_access(
    btrim(p_provider_issuer),
    btrim(p_provider_subject)
  ) AS access
  WHERE access.tenant_id = p_tenant_id
    AND access.campus_id = p_campus_id
    AND access.persona = p_persona
    AND p_persona = ANY (ARRAY['guardian', 'student', 'teacher']::text[])
    AND length(btrim(p_provider_issuer)) BETWEEN 1 AND 2048
    AND length(btrim(p_provider_subject)) BETWEEN 1 AND 512
  ORDER BY access.account_id
  LIMIT 2;
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_request_scope(text, text, uuid, uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_request_scope(text, text, uuid, uuid, text)
  TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_profiles(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_time_zone text;
  selected_capabilities text[];
  selected_person_id uuid;
  selected_local_date date;
  profiles jsonb;
  active_student_id text;
  linked_person_count bigint;
BEGIN
  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, p_persona
  ) AS scope;

  IF selected_account_id IS NULL OR selected_time_zone IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_persona NOT IN ('guardian', 'student') THEN RETURN NULL; END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = selected_account_id;

  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN NULL; END IF;
  selected_local_date := (clock_timestamp() AT TIME ZONE selected_time_zone)::date;

  WITH authorized AS (
    SELECT DISTINCT
      student_profile.student_profile_id,
      student_profile.person_id,
      enrollment.grade_level_id,
      CASE WHEN p_persona = 'student' THEN 'Self' ELSE 'Guardian' END AS relationship_label
    FROM student_lifecycle.student_profile AS student_profile
    JOIN student_lifecycle.enrollment AS enrollment
      ON enrollment.tenant_id = student_profile.tenant_id
     AND enrollment.student_profile_id = student_profile.student_profile_id
     AND enrollment.campus_id = p_campus_id
     AND enrollment.status = 'active'
     AND enrollment.effective_from <= selected_local_date
     AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date)
    WHERE student_profile.tenant_id = p_tenant_id
      AND student_profile.status = 'active'
      AND (
        (p_persona = 'student' AND student_profile.person_id = selected_person_id)
        OR
        (p_persona = 'guardian' AND EXISTS (
          SELECT 1
          FROM people.guardian_student_authority AS authority
          WHERE authority.tenant_id = p_tenant_id
            AND authority.guardian_person_id = selected_person_id
            AND authority.student_person_id = student_profile.person_id
            AND authority.portal_access = true
            AND authority.verification_status = 'verified'
            AND authority.effective_from <= selected_local_date
            AND (authority.effective_to IS NULL OR authority.effective_to >= selected_local_date)
        ))
      )
  ), profiles_source AS (
    SELECT
      authorized.student_profile_id,
      trim(concat_ws(' ', name.given_name, name.family_name)) AS display_name,
      'Current grade'::text AS grade_label,
      authorized.relationship_label
    FROM authorized
    JOIN LATERAL (
      SELECT person_name.given_name, person_name.family_name
      FROM people.person_name AS person_name
      WHERE person_name.tenant_id = p_tenant_id
        AND person_name.person_id = authorized.person_id
        AND person_name.effective_from <= selected_local_date
        AND (person_name.effective_to IS NULL OR person_name.effective_to >= selected_local_date)
      ORDER BY
        CASE person_name.usage WHEN 'preferred' THEN 0 WHEN 'legal' THEN 1 ELSE 2 END,
        person_name.effective_from DESC,
        person_name.person_name_id
      LIMIT 1
    ) AS name ON true
  )
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'studentId', source.student_profile_id,
          'campusId', p_campus_id,
          'displayName', source.display_name,
          'gradeLabel', source.grade_label,
          'relationshipLabel', source.relationship_label
        ) ORDER BY source.display_name, source.student_profile_id
      ),
      '[]'::jsonb
    ),
    (array_agg(source.student_profile_id::text ORDER BY source.display_name, source.student_profile_id))[1]
  INTO profiles, active_student_id
  FROM profiles_source AS source;

  IF active_student_id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'accountId', selected_account_id,
    'activeStudentId', active_student_id,
    'students', profiles
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_profiles(text, text, uuid, uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_profiles(text, text, uuid, uuid, text)
  TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_dashboard(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_student_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_time_zone text;
  selected_capabilities text[];
  selected_person_id uuid;
  selected_local_date date;
  selected_student_person_id uuid;
  selected_enrollment_id uuid;
  selected_grade_level_id uuid;
  selected_display_name text;
  selected_grade_label text;
  selected_relationship_label text;
  linked_person_count bigint;
  timetable_payload jsonb := '[]'::jsonb;
  attendance_payload jsonb := NULL;
  results_payload jsonb := '[]'::jsonb;
BEGIN
  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, p_persona
  ) AS scope;

  IF selected_account_id IS NULL OR selected_time_zone IS NULL THEN RETURN NULL; END IF;
  IF p_persona NOT IN ('guardian', 'student') OR p_student_profile_id IS NULL THEN RETURN NULL; END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id
    AND link.account_id = selected_account_id;
  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN NULL; END IF;

  selected_local_date := (clock_timestamp() AT TIME ZONE selected_time_zone)::date;

  SELECT
    student_profile.person_id,
    enrollment.enrollment_id,
    enrollment.grade_level_id,
    trim(concat_ws(' ', name.given_name, name.family_name)),
    'Current grade'::text,
    CASE WHEN p_persona = 'student' THEN 'Self' ELSE 'Guardian' END
  INTO
    selected_student_person_id,
    selected_enrollment_id,
    selected_grade_level_id,
    selected_display_name,
    selected_grade_label,
    selected_relationship_label
  FROM student_lifecycle.student_profile AS student_profile
  JOIN student_lifecycle.enrollment AS enrollment
    ON enrollment.tenant_id = student_profile.tenant_id
   AND enrollment.student_profile_id = student_profile.student_profile_id
   AND enrollment.campus_id = p_campus_id
   AND enrollment.status = 'active'
   AND enrollment.effective_from <= selected_local_date
   AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date)
  JOIN LATERAL (
    SELECT person_name.given_name, person_name.family_name
    FROM people.person_name AS person_name
    WHERE person_name.tenant_id = p_tenant_id
      AND person_name.person_id = student_profile.person_id
      AND person_name.effective_from <= selected_local_date
      AND (person_name.effective_to IS NULL OR person_name.effective_to >= selected_local_date)
    ORDER BY CASE person_name.usage WHEN 'preferred' THEN 0 WHEN 'legal' THEN 1 ELSE 2 END,
      person_name.effective_from DESC, person_name.person_name_id
    LIMIT 1
  ) AS name ON true
  WHERE student_profile.tenant_id = p_tenant_id
    AND student_profile.student_profile_id = p_student_profile_id
    AND student_profile.status = 'active'
    AND (
      (p_persona = 'student' AND student_profile.person_id = selected_person_id)
      OR
      (p_persona = 'guardian' AND EXISTS (
        SELECT 1
        FROM people.guardian_student_authority AS authority
        WHERE authority.tenant_id = p_tenant_id
          AND authority.guardian_person_id = selected_person_id
          AND authority.student_person_id = student_profile.person_id
          AND authority.portal_access = true
          AND authority.verification_status = 'verified'
          AND authority.effective_from <= selected_local_date
          AND (authority.effective_to IS NULL OR authority.effective_to >= selected_local_date)
      ))
    )
  ORDER BY enrollment.effective_from DESC, enrollment.enrollment_id
  LIMIT 1;

  IF selected_student_person_id IS NULL OR selected_enrollment_id IS NULL THEN RETURN NULL; END IF;

  IF 'timetable.read' = ANY(selected_capabilities) THEN
    SELECT coalesce(jsonb_agg(item ORDER BY starts_at, item_id), '[]'::jsonb)
    INTO timetable_payload
    FROM (
      SELECT
        meeting.starts_at,
        meeting.scheduled_meeting_id AS item_id,
        jsonb_build_object(
          'itemId', meeting.scheduled_meeting_id,
          'subjectLabel', course.course_title,
          'locationLabel', CASE WHEN meeting.room_id IS NULL THEN 'Room not assigned' ELSE 'Room ' || meeting.room_id::text END,
          'startsAt', to_char(((meeting.local_date + meeting.starts_at) AT TIME ZONE meeting.timezone) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'endsAt', to_char(((meeting.local_date + meeting.ends_at) AT TIME ZONE meeting.timezone) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) AS item
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
       AND roster.student_profile_id = p_student_profile_id
       AND roster.enrollment_id = selected_enrollment_id
       AND roster.joined_on <= selected_local_date
       AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
      WHERE meeting.tenant_id = p_tenant_id
        AND meeting.local_date = selected_local_date
        AND meeting.meeting_status = 'scheduled'
      ORDER BY meeting.starts_at, meeting.scheduled_meeting_id
      LIMIT 16
    ) AS timetable_item;
  END IF;

  IF 'attendance.read' = ANY(selected_capabilities) THEN
    SELECT jsonb_build_object(
      'presentSessions', count(*) FILTER (WHERE code.meaning IN ('present', 'excused', 'remote')),
      'absentSessions', count(*) FILTER (WHERE code.meaning = 'absent'),
      'lateSessions', count(*) FILTER (WHERE code.meaning = 'late'),
      'totalSessions', count(*),
      'summaryLabel', 'Finalized attendance'
    )
    INTO attendance_payload
    FROM attendance.attendance_session AS session
    LEFT JOIN attendance.attendance_record AS record
      ON record.tenant_id = session.tenant_id
     AND record.session_id = session.session_id
     AND record.student_profile_id = p_student_profile_id
    LEFT JOIN attendance.attendance_code AS code
      ON code.tenant_id = record.tenant_id
     AND code.attendance_code_id = record.attendance_code_id
    WHERE session.tenant_id = p_tenant_id
      AND session.campus_id = p_campus_id
      AND session.session_state = 'finalized'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(session.roster_student_ids) AS roster(value)
        WHERE roster.value = p_student_profile_id::text
      );
  END IF;

  IF 'grades.read.published' = ANY(selected_capabilities) THEN
    SELECT coalesce(jsonb_agg(item ORDER BY published_at DESC, result_id), '[]'::jsonb)
    INTO results_payload
    FROM (
      SELECT
        publication.published_at,
        snapshot.snapshot_id AS result_id,
        jsonb_build_object(
          'resultId', snapshot.snapshot_id,
          'assessmentLabel', reporting_period.period_name,
          'subjectLabel', course.course_title,
          'gradeLabel', snapshot.displayed_grade,
          'publishedAt', to_char(publication.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) AS item
      FROM gradebook.grade_publication AS publication
      JOIN gradebook.grade_calculation_snapshot AS snapshot
        ON snapshot.tenant_id = publication.tenant_id
       AND snapshot.snapshot_id = publication.snapshot_id
       AND snapshot.student_profile_id = p_student_profile_id
      JOIN records.reporting_period AS reporting_period
        ON reporting_period.tenant_id = snapshot.tenant_id
       AND reporting_period.reporting_period_id = snapshot.reporting_period_id
       AND reporting_period.period_state = 'closed'
      JOIN academics.class_section AS section
        ON section.tenant_id = snapshot.tenant_id
       AND section.section_id = snapshot.section_id
       AND section.campus_id = p_campus_id
       AND section.publication_state = 'published'
      JOIN academics.course_version AS course
        ON course.tenant_id = section.tenant_id
       AND course.course_version_id = section.course_version_id
       AND course.publication_state = 'published'
      WHERE publication.tenant_id = p_tenant_id
        AND publication.available_from <= clock_timestamp()
        AND (publication.available_to IS NULL OR publication.available_to >= clock_timestamp())
      ORDER BY publication.published_at DESC, snapshot.snapshot_id
      LIMIT 24
    ) AS published_result;
  END IF;

  RETURN jsonb_build_object(
    'student', jsonb_build_object(
      'studentId', p_student_profile_id,
      'campusId', p_campus_id,
      'displayName', selected_display_name,
      'gradeLabel', selected_grade_label,
      'relationshipLabel', selected_relationship_label
    ),
    'timetable', timetable_payload,
    'attendance', attendance_payload,
    'publishedResults', results_payload,
    'fees', NULL,
    'messages', NULL,
    'generatedAt', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_dashboard(text, text, uuid, uuid, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_dashboard(text, text, uuid, uuid, text, uuid)
  TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_today(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_time_zone text;
  selected_capabilities text[];
  selected_person_id uuid;
  selected_staff_id uuid;
  selected_teacher_name text;
  selected_local_date date;
  linked_person_count bigint;
  meetings_payload jsonb := '[]'::jsonb;
BEGIN
  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, 'teacher'
  ) AS scope;
  IF selected_account_id IS NULL OR selected_time_zone IS NULL THEN RETURN NULL; END IF;
  IF NOT ('timetable.read' = ANY(selected_capabilities)) THEN RETURN NULL; END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id AND link.account_id = selected_account_id;
  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN NULL; END IF;

  SELECT staff.staff_id, staff.display_name
  INTO selected_staff_id, selected_teacher_name
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active'
  LIMIT 1;
  IF selected_staff_id IS NULL OR selected_teacher_name IS NULL THEN RETURN NULL; END IF;

  selected_local_date := (clock_timestamp() AT TIME ZONE selected_time_zone)::date;

  SELECT coalesce(jsonb_agg(item ORDER BY starts_at, meeting_id), '[]'::jsonb)
  INTO meetings_payload
  FROM (
    SELECT
      meeting.starts_at,
      meeting.scheduled_meeting_id AS meeting_id,
      jsonb_build_object(
        'meetingId', meeting.scheduled_meeting_id,
        'sectionId', section.section_id,
        'sectionLabel', section.section_title,
        'subjectLabel', course.course_title,
        'roomLabel', CASE WHEN coalesce(substitution.temporary_room_id, meeting.room_id) IS NULL THEN 'Room not assigned' ELSE 'Room ' || coalesce(substitution.temporary_room_id, meeting.room_id)::text END,
        'startsAt', to_char(((meeting.local_date + meeting.starts_at) AT TIME ZONE meeting.timezone) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'endsAt', to_char(((meeting.local_date + meeting.ends_at) AT TIME ZONE meeting.timezone) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'rosterCount', (
          SELECT count(*)
          FROM academics.section_roster AS roster_count
          WHERE roster_count.tenant_id = meeting.tenant_id
            AND roster_count.section_id = meeting.section_id
            AND roster_count.joined_on <= meeting.local_date
            AND (roster_count.left_on IS NULL OR roster_count.left_on >= meeting.local_date)
        ),
        'attendanceStatus', CASE
          WHEN attendance_session.session_state = 'finalized' THEN 'locked'
          WHEN attendance_session.session_id IS NOT NULL THEN 'draft'
          ELSE 'notStarted'
        END,
        'substitutionForTeacherLabel', CASE WHEN substitution.substitute_teacher_id = selected_staff_id THEN 'Assigned substitution' ELSE NULL END
      ) AS item
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
    LEFT JOIN scheduling.substitution_assignment AS substitution
      ON substitution.tenant_id = meeting.tenant_id
     AND substitution.scheduled_meeting_id = meeting.scheduled_meeting_id
     AND substitution.effective_date = meeting.local_date
    LEFT JOIN attendance.attendance_session AS attendance_session
      ON attendance_session.tenant_id = meeting.tenant_id
     AND attendance_session.scheduled_meeting_id = meeting.scheduled_meeting_id
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.local_date = selected_local_date
      AND meeting.meeting_status = 'scheduled'
      AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
          WHERE teacher.value = selected_staff_id::text
        )
        OR substitution.substitute_teacher_id = selected_staff_id
      )
    ORDER BY meeting.starts_at, meeting.scheduled_meeting_id
    LIMIT 24
  ) AS meeting_item;

  RETURN jsonb_build_object(
    'campusId', p_campus_id,
    'generatedAt', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'teacherDisplayName', selected_teacher_name,
    'meetings', meetings_payload
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_today(text, text, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_teacher_today(text, text, uuid, uuid)
  TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_roster(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_meeting_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_time_zone text;
  selected_capabilities text[];
  selected_person_id uuid;
  selected_staff_id uuid;
  selected_section_id uuid;
  selected_meeting_version bigint;
  linked_person_count bigint;
  students_payload jsonb := '[]'::jsonb;
BEGIN
  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer, p_provider_subject, p_tenant_id, p_campus_id, 'teacher'
  ) AS scope;
  IF selected_account_id IS NULL OR selected_time_zone IS NULL THEN RETURN NULL; END IF;
  IF NOT ('attendance.take' = ANY(selected_capabilities)) OR p_meeting_id IS NULL THEN RETURN NULL; END IF;

  SELECT count(*), min(link.person_id::text)::uuid
  INTO linked_person_count, selected_person_id
  FROM iam.person_link AS link
  JOIN people.person AS person
    ON person.tenant_id = link.tenant_id
   AND person.person_id = link.person_id
   AND person.status = 'active'
  WHERE link.tenant_id = p_tenant_id AND link.account_id = selected_account_id;
  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN RETURN NULL; END IF;

  SELECT staff.staff_id
  INTO selected_staff_id
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active'
  LIMIT 1;
  IF selected_staff_id IS NULL THEN RETURN NULL; END IF;

  SELECT meeting.section_id, coalesce(attendance_session.version, meeting.version)
  INTO selected_section_id, selected_meeting_version
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
        SELECT 1 FROM jsonb_array_elements_text(meeting.teacher_ids) AS teacher(value)
        WHERE teacher.value = selected_staff_id::text
      )
      OR substitution.substitute_teacher_id = selected_staff_id
    )
  LIMIT 1;
  IF selected_section_id IS NULL OR selected_meeting_version IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY display_name, student_id), '[]'::jsonb)
  INTO students_payload
  FROM (
    SELECT
      profile.student_profile_id AS student_id,
      trim(concat_ws(' ', name.given_name, name.family_name)) AS display_name,
      coalesce(identifier.identifier_value::text, profile.student_profile_id::text) AS roll_label,
      jsonb_build_object(
        'studentId', profile.student_profile_id,
        'displayName', trim(concat_ws(' ', name.given_name, name.family_name)),
        'rollLabel', coalesce(identifier.identifier_value::text, profile.student_profile_id::text)
      ) AS item
    FROM scheduling.scheduled_class_meeting AS meeting
    JOIN academics.section_roster AS section_roster
      ON section_roster.tenant_id = meeting.tenant_id
     AND section_roster.section_id = meeting.section_id
     AND section_roster.joined_on <= meeting.local_date
     AND (section_roster.left_on IS NULL OR section_roster.left_on >= meeting.local_date)
    JOIN student_lifecycle.student_profile AS profile
      ON profile.tenant_id = section_roster.tenant_id
     AND profile.student_profile_id = section_roster.student_profile_id
     AND profile.status = 'active'
    JOIN LATERAL (
      SELECT person_name.given_name, person_name.family_name
      FROM people.person_name AS person_name
      WHERE person_name.tenant_id = profile.tenant_id
        AND person_name.person_id = profile.person_id
        AND person_name.effective_from <= meeting.local_date
        AND (person_name.effective_to IS NULL OR person_name.effective_to >= meeting.local_date)
      ORDER BY CASE person_name.usage WHEN 'preferred' THEN 0 WHEN 'legal' THEN 1 ELSE 2 END,
        person_name.effective_from DESC, person_name.person_name_id
      LIMIT 1
    ) AS name ON true
    LEFT JOIN LATERAL (
      SELECT profile_identifier.identifier_value
      FROM student_lifecycle.profile_identifier AS profile_identifier
      WHERE profile_identifier.tenant_id = profile.tenant_id
        AND profile_identifier.profile_kind = 'student'
        AND profile_identifier.profile_id = profile.student_profile_id
        AND (profile_identifier.campus_id IS NULL OR profile_identifier.campus_id = p_campus_id)
        AND profile_identifier.effective_from <= meeting.local_date
        AND (profile_identifier.effective_to IS NULL OR profile_identifier.effective_to >= meeting.local_date)
      ORDER BY CASE WHEN profile_identifier.campus_id = p_campus_id THEN 0 ELSE 1 END,
        profile_identifier.effective_from DESC, profile_identifier.profile_identifier_id
      LIMIT 1
    ) AS identifier ON true
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.scheduled_meeting_id = p_meeting_id
  ) AS roster_student;

  RETURN jsonb_build_object(
    'meetingId', p_meeting_id,
    'sectionId', selected_section_id,
    'version', selected_meeting_version,
    'students', students_payload
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_roster(text, text, uuid, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_teacher_roster(text, text, uuid, uuid, uuid)
  TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608190002_MOB-03_mobile_core_read_models',
  'MOB-03',
  'Tenant-safe Family profiles/dashboard and Teacher today/roster mobile read models'
)
ON CONFLICT (migration_id) DO NOTHING;
