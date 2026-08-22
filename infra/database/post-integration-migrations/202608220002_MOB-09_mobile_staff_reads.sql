CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_read_authority(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_required_capability text
)
RETURNS TABLE (
  account_id uuid,
  person_id uuid,
  staff_id uuid,
  local_date date
)
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
  linked_person_count bigint;
BEGIN
  IF p_required_capability NOT IN ('grades.write', 'messages.read') THEN
    RETURN;
  END IF;

  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    'teacher'
  ) AS scope;

  IF selected_account_id IS NULL
     OR selected_time_zone IS NULL
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

  IF linked_person_count <> 1 OR selected_person_id IS NULL THEN
    RETURN;
  END IF;

  SELECT staff.staff_id
  INTO selected_staff_id
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active'
  ORDER BY staff.staff_id
  LIMIT 2;

  IF selected_staff_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    selected_account_id,
    selected_person_id,
    selected_staff_id,
    (clock_timestamp() AT TIME ZONE selected_time_zone)::date;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_read_authority(text, text, uuid, uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_read_authority(text, text, uuid, uuid, text)
  FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_assessments(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_limit integer DEFAULT 64
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_staff_id uuid;
  selected_local_date date;
  generated_at timestamptz := date_trunc('milliseconds', clock_timestamp());
  assessment_rows jsonb;
  has_more boolean;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 64 THEN
    RETURN NULL;
  END IF;

  SELECT authority.staff_id, authority.local_date
  INTO selected_staff_id, selected_local_date
  FROM platform.resolve_mobile_teacher_read_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    'grades.write'
  ) AS authority;

  IF selected_staff_id IS NULL OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  WITH authorized AS (
    SELECT
      assessment.assessment_id,
      assessment.section_id,
      section.section_title,
      course.course_title,
      assessment.assessment_title,
      category.category_label,
      assessment.due_at,
      assessment.assessment_state,
      coalesce(grade_lock.lock_state, 'open') AS lock_state,
      coalesce(revision.revision, assessment.version) AS mobile_version,
      (assessment.maximum_points * 10000)::bigint AS maximum_score_units,
      (
        SELECT count(*)
        FROM academics.section_roster AS roster
        WHERE roster.tenant_id = assessment.tenant_id
          AND roster.section_id = assessment.section_id
          AND roster.joined_on <= selected_local_date
          AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
      ) AS roster_count,
      (
        SELECT count(*)
        FROM gradebook.assessment_result AS result
        JOIN academics.section_roster AS roster
          ON roster.tenant_id = result.tenant_id
         AND roster.section_id = assessment.section_id
         AND roster.student_profile_id = result.student_profile_id
         AND roster.joined_on <= selected_local_date
         AND (roster.left_on IS NULL OR roster.left_on >= selected_local_date)
        WHERE result.tenant_id = assessment.tenant_id
          AND result.assessment_id = assessment.assessment_id
      ) AS entered_count
    FROM gradebook.assessment AS assessment
    JOIN academics.class_section AS section
      ON section.tenant_id = assessment.tenant_id
     AND section.section_id = assessment.section_id
     AND section.campus_id = p_campus_id
    JOIN academics.course_version AS course
      ON course.tenant_id = section.tenant_id
     AND course.course_version_id = section.course_version_id
    JOIN gradebook.assessment_category AS category
      ON category.tenant_id = assessment.tenant_id
     AND category.category_id = assessment.category_id
    LEFT JOIN gradebook.gradebook_lock AS grade_lock
      ON grade_lock.tenant_id = assessment.tenant_id
     AND grade_lock.section_id = assessment.section_id
     AND grade_lock.reporting_period_id = assessment.reporting_period_id
    LEFT JOIN platform.mobile_teacher_grade_revision AS revision
      ON revision.tenant_id = assessment.tenant_id
     AND revision.assessment_id = assessment.assessment_id
    WHERE assessment.tenant_id = p_tenant_id
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
    ORDER BY assessment.due_at DESC, assessment.assessment_id DESC
    LIMIT p_limit + 1
  ), page AS (
    SELECT *
    FROM authorized
    ORDER BY due_at DESC, assessment_id DESC
    LIMIT p_limit
  )
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'assessmentId', page.assessment_id,
          'sectionId', page.section_id,
          'sectionLabel', page.section_title,
          'subjectLabel', page.course_title,
          'assessmentTitle', page.assessment_title,
          'categoryLabel', page.category_label,
          'dueAt', to_char(date_trunc('milliseconds', page.due_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'state', page.assessment_state,
          'lockState', page.lock_state,
          'version', page.mobile_version,
          'scoreScale', 10000,
          'maximumScoreUnits', page.maximum_score_units,
          'rosterCount', page.roster_count,
          'enteredCount', page.entered_count
        )
        ORDER BY page.due_at DESC, page.assessment_id DESC
      ),
      '[]'::jsonb
    ),
    (SELECT count(*) > p_limit FROM authorized)
  INTO assessment_rows, has_more
  FROM page;

  RETURN jsonb_build_object(
    'assessments', assessment_rows,
    'generatedAt', to_char(generated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'hasMore', coalesce(has_more, false)
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_assessments(text, text, uuid, uuid, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_teacher_assessments(text, text, uuid, uuid, integer)
  TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_conversations(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_person_id uuid;
  selected_local_date date;
  generated_at timestamptz := date_trunc('milliseconds', clock_timestamp());
  conversation_rows jsonb;
  has_more boolean;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RETURN NULL;
  END IF;

  SELECT authority.person_id, authority.local_date
  INTO selected_person_id, selected_local_date
  FROM platform.resolve_mobile_teacher_read_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    'messages.read'
  ) AS authority;

  IF selected_person_id IS NULL OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  WITH authorized AS (
    SELECT
      thread.conversation_id,
      thread.student_profile_id,
      thread.subject,
      participant.can_reply AND thread.status = 'open' AS can_reply,
      greatest(
        thread.created_at,
        participant.joined_at,
        coalesce(visible.latest_message_at, participant.joined_at)
      ) AS latest_message_at,
      trim(concat_ws(' ', student_name.given_name, student_name.family_name)) AS student_display_name
    FROM integration_core.conversation_participant AS participant
    JOIN integration_core.conversation_thread AS thread
      ON thread.tenant_id = participant.tenant_id
     AND thread.conversation_id = participant.conversation_id
    JOIN student_lifecycle.student_profile AS student
      ON student.tenant_id = thread.tenant_id
     AND student.student_profile_id = thread.student_profile_id
     AND student.status = 'active'
    JOIN LATERAL (
      SELECT name.given_name, name.family_name
      FROM people.person_name AS name
      WHERE name.tenant_id = student.tenant_id
        AND name.person_id = student.person_id
        AND name.effective_from <= selected_local_date
        AND (name.effective_to IS NULL OR name.effective_to >= selected_local_date)
      ORDER BY
        CASE name.usage WHEN 'preferred' THEN 0 WHEN 'legal' THEN 1 ELSE 2 END,
        name.effective_from DESC,
        name.person_name_id
      LIMIT 1
    ) AS student_name ON true
    LEFT JOIN LATERAL (
      SELECT max(message.sent_at) AS latest_message_at
      FROM integration_core.conversation_message AS message
      WHERE message.tenant_id = participant.tenant_id
        AND message.conversation_id = participant.conversation_id
        AND message.sent_at >= participant.joined_at
    ) AS visible ON true
    WHERE participant.tenant_id = p_tenant_id
      AND participant.person_id = selected_person_id
      AND participant.participant_kind = 'staff'
      AND participant.left_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM student_lifecycle.enrollment AS enrollment
        WHERE enrollment.tenant_id = student.tenant_id
          AND enrollment.student_profile_id = student.student_profile_id
          AND enrollment.campus_id = p_campus_id
          AND enrollment.status = 'active'
          AND enrollment.effective_from <= selected_local_date
          AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date)
      )
    ORDER BY latest_message_at DESC, thread.conversation_id DESC
    LIMIT p_limit + 1
  ), page AS (
    SELECT *
    FROM authorized
    ORDER BY latest_message_at DESC, conversation_id DESC
    LIMIT p_limit
  )
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'conversationId', page.conversation_id,
          'studentId', page.student_profile_id,
          'studentDisplayName', page.student_display_name,
          'subject', page.subject,
          'latestMessageAt', to_char(date_trunc('milliseconds', page.latest_message_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'canReply', page.can_reply
        )
        ORDER BY page.latest_message_at DESC, page.conversation_id DESC
      ),
      '[]'::jsonb
    ),
    (SELECT count(*) > p_limit FROM authorized)
  INTO conversation_rows, has_more
  FROM page;

  RETURN jsonb_build_object(
    'conversations', conversation_rows,
    'generatedAt', to_char(generated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'hasMore', coalesce(has_more, false)
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_conversations(text, text, uuid, uuid, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_teacher_conversations(text, text, uuid, uuid, integer)
  TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_teacher_conversation_messages(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_conversation_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_person_id uuid;
  selected_local_date date;
  selected_joined_at timestamptz;
  selected_subject text;
  selected_student_display_name text;
  message_rows jsonb;
  has_more boolean;
BEGIN
  IF p_conversation_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RETURN NULL;
  END IF;

  SELECT authority.person_id, authority.local_date
  INTO selected_person_id, selected_local_date
  FROM platform.resolve_mobile_teacher_read_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    'messages.read'
  ) AS authority;

  IF selected_person_id IS NULL OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    participant.joined_at,
    thread.subject,
    trim(concat_ws(' ', student_name.given_name, student_name.family_name))
  INTO selected_joined_at, selected_subject, selected_student_display_name
  FROM integration_core.conversation_participant AS participant
  JOIN integration_core.conversation_thread AS thread
    ON thread.tenant_id = participant.tenant_id
   AND thread.conversation_id = participant.conversation_id
  JOIN student_lifecycle.student_profile AS student
    ON student.tenant_id = thread.tenant_id
   AND student.student_profile_id = thread.student_profile_id
   AND student.status = 'active'
  JOIN LATERAL (
    SELECT name.given_name, name.family_name
    FROM people.person_name AS name
    WHERE name.tenant_id = student.tenant_id
      AND name.person_id = student.person_id
      AND name.effective_from <= selected_local_date
      AND (name.effective_to IS NULL OR name.effective_to >= selected_local_date)
    ORDER BY
      CASE name.usage WHEN 'preferred' THEN 0 WHEN 'legal' THEN 1 ELSE 2 END,
      name.effective_from DESC,
      name.person_name_id
    LIMIT 1
  ) AS student_name ON true
  WHERE participant.tenant_id = p_tenant_id
    AND participant.conversation_id = p_conversation_id
    AND participant.person_id = selected_person_id
    AND participant.participant_kind = 'staff'
    AND participant.left_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM student_lifecycle.enrollment AS enrollment
      WHERE enrollment.tenant_id = student.tenant_id
        AND enrollment.student_profile_id = student.student_profile_id
        AND enrollment.campus_id = p_campus_id
        AND enrollment.status = 'active'
        AND enrollment.effective_from <= selected_local_date
        AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date)
    );

  IF selected_joined_at IS NULL OR selected_subject IS NULL OR selected_student_display_name IS NULL THEN
    RETURN NULL;
  END IF;

  WITH authorized AS (
    SELECT
      message.message_id,
      message.author_label,
      message.body,
      message.sent_at,
      message.author_person_id = selected_person_id AS authored_by_viewer
    FROM integration_core.conversation_message AS message
    WHERE message.tenant_id = p_tenant_id
      AND message.conversation_id = p_conversation_id
      AND message.sent_at >= selected_joined_at
    ORDER BY message.sent_at DESC, message.message_id DESC
    LIMIT p_limit + 1
  ), page AS (
    SELECT *
    FROM authorized
    ORDER BY sent_at DESC, message_id DESC
    LIMIT p_limit
  )
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'messageId', page.message_id,
          'authorLabel', page.author_label,
          'body', page.body,
          'sentAt', to_char(date_trunc('milliseconds', page.sent_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'authoredByViewer', page.authored_by_viewer
        )
        ORDER BY page.sent_at DESC, page.message_id DESC
      ),
      '[]'::jsonb
    ),
    (SELECT count(*) > p_limit FROM authorized)
  INTO message_rows, has_more
  FROM page;

  RETURN jsonb_build_object(
    'conversationId', p_conversation_id,
    'studentDisplayName', selected_student_display_name,
    'subject', selected_subject,
    'messages', message_rows,
    'hasMore', coalesce(has_more, false)
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_teacher_conversation_messages(text, text, uuid, uuid, uuid, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_teacher_conversation_messages(text, text, uuid, uuid, uuid, integer)
  TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608220002_MOB-09_mobile_staff_reads',
  'MOB-09',
  'Add authoritative bounded Teacher assessment and shared conversation read models'
)
ON CONFLICT (migration_id) DO NOTHING;
