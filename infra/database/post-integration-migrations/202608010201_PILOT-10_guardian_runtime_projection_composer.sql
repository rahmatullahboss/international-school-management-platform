ALTER TABLE platform.runtime_projection_composition_run
  DROP CONSTRAINT IF EXISTS runtime_projection_composition_run_persona_check;
ALTER TABLE platform.runtime_projection_composition_run
  ADD CONSTRAINT runtime_projection_composition_run_persona_check
  CHECK (persona IN ('admin', 'teacher', 'guardian'));

CREATE OR REPLACE FUNCTION platform.compose_guardian_runtime_projection_source(
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
                  scheduling, attendance, gradebook, billing, audit
AS $function$
DECLARE
  selected_account_id uuid;
  selected_guardian_person_id uuid;
  selected_persona text;
  persona_count integer;
  selected_legal_entity_id uuid;
  selected_time_zone text;
  selected_currency text;
  selected_local_date date;
  authorized_child_count bigint;
  education_student_profile_ids uuid[] := ARRAY[]::uuid[];
  billing_student_person_refs text[] := ARRAY[]::text[];
  attendance_alert_count bigint := 0;
  published_grade_count bigint := 0;
  outstanding_balance_minor bigint := 0;
  children_payload jsonb := '[]'::jsonb;
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

  SELECT campus.legal_entity_id, campus.time_zone, legal_entity.default_currency
  INTO selected_legal_entity_id, selected_time_zone, selected_currency
  FROM tenancy.campus AS campus
  JOIN tenancy.legal_entity AS legal_entity
    ON legal_entity.tenant_id = campus.tenant_id
   AND legal_entity.legal_entity_id = campus.legal_entity_id
  WHERE campus.tenant_id = p_tenant_id
    AND campus.campus_id = p_campus_id
  FOR SHARE OF campus, legal_entity;

  IF selected_legal_entity_id IS NULL
     OR selected_time_zone IS NULL
     OR selected_currency IS NULL THEN
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

  IF persona_count <> 1 OR selected_persona <> 'guardian' THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-guardian');
  END IF;

  SELECT person_link.person_id
  INTO selected_guardian_person_id
  FROM iam.person_link AS person_link
  JOIN people.person AS guardian_person
    ON guardian_person.tenant_id = person_link.tenant_id
   AND guardian_person.person_id = person_link.person_id
   AND guardian_person.status = 'active'
  WHERE person_link.tenant_id = p_tenant_id
    AND person_link.account_id = selected_account_id
  FOR SHARE OF person_link, guardian_person;

  IF selected_guardian_person_id IS NULL THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'guardian-unlinked');
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

  WITH authority AS (
    SELECT
      guardian_authority.student_person_id,
      bool_or(guardian_authority.education_authority) AS education_authority,
      bool_or(guardian_authority.billing_authority) AS billing_authority
    FROM people.guardian_student_authority AS guardian_authority
    WHERE guardian_authority.tenant_id = p_tenant_id
      AND guardian_authority.guardian_person_id = selected_guardian_person_id
      AND guardian_authority.portal_access
      AND guardian_authority.verification_status = 'verified'
      AND guardian_authority.effective_from <= selected_local_date
      AND (
        guardian_authority.effective_to IS NULL
        OR guardian_authority.effective_to >= selected_local_date
      )
    GROUP BY guardian_authority.student_person_id
  ), eligible AS (
    SELECT
      student_profile.student_profile_id,
      student_profile.person_id,
      enrollment.grade_level_id,
      authority.education_authority,
      authority.billing_authority
    FROM authority
    JOIN people.person AS child_person
      ON child_person.tenant_id = p_tenant_id
     AND child_person.person_id = authority.student_person_id
     AND child_person.status = 'active'
    JOIN student_lifecycle.student_profile AS student_profile
      ON student_profile.tenant_id = child_person.tenant_id
     AND student_profile.person_id = child_person.person_id
     AND student_profile.status = 'active'
    JOIN LATERAL (
      SELECT child_enrollment.grade_level_id
      FROM student_lifecycle.enrollment AS child_enrollment
      WHERE child_enrollment.tenant_id = p_tenant_id
        AND child_enrollment.student_profile_id = student_profile.student_profile_id
        AND child_enrollment.campus_id = p_campus_id
        AND child_enrollment.status = 'active'
        AND child_enrollment.effective_from <= selected_local_date
        AND (
          child_enrollment.effective_to IS NULL
          OR child_enrollment.effective_to >= selected_local_date
        )
      ORDER BY child_enrollment.effective_from DESC, child_enrollment.enrollment_id
      LIMIT 1
    ) AS enrollment ON true
  )
  SELECT
    count(*),
    COALESCE(
      array_agg(student_profile_id ORDER BY student_profile_id)
        FILTER (WHERE education_authority),
      ARRAY[]::uuid[]
    ),
    COALESCE(
      array_agg(person_id::text ORDER BY person_id)
        FILTER (WHERE billing_authority),
      ARRAY[]::text[]
    )
  INTO
    authorized_child_count,
    education_student_profile_ids,
    billing_student_person_refs
  FROM eligible;

  IF authorized_child_count = 0 THEN
    RETURN jsonb_build_object('composed', false, 'reason', 'authority-unavailable');
  END IF;

  WITH authority AS (
    SELECT
      guardian_authority.student_person_id,
      bool_or(guardian_authority.education_authority) AS education_authority,
      bool_or(guardian_authority.billing_authority) AS billing_authority
    FROM people.guardian_student_authority AS guardian_authority
    WHERE guardian_authority.tenant_id = p_tenant_id
      AND guardian_authority.guardian_person_id = selected_guardian_person_id
      AND guardian_authority.portal_access
      AND guardian_authority.verification_status = 'verified'
      AND guardian_authority.effective_from <= selected_local_date
      AND (
        guardian_authority.effective_to IS NULL
        OR guardian_authority.effective_to >= selected_local_date
      )
    GROUP BY guardian_authority.student_person_id
  ), eligible AS (
    SELECT
      student_profile.student_profile_id,
      student_profile.person_id,
      enrollment.grade_level_id,
      authority.education_authority,
      authority.billing_authority
    FROM authority
    JOIN people.person AS child_person
      ON child_person.tenant_id = p_tenant_id
     AND child_person.person_id = authority.student_person_id
     AND child_person.status = 'active'
    JOIN student_lifecycle.student_profile AS student_profile
      ON student_profile.tenant_id = child_person.tenant_id
     AND student_profile.person_id = child_person.person_id
     AND student_profile.status = 'active'
    JOIN LATERAL (
      SELECT child_enrollment.grade_level_id
      FROM student_lifecycle.enrollment AS child_enrollment
      WHERE child_enrollment.tenant_id = p_tenant_id
        AND child_enrollment.student_profile_id = student_profile.student_profile_id
        AND child_enrollment.campus_id = p_campus_id
        AND child_enrollment.status = 'active'
        AND child_enrollment.effective_from <= selected_local_date
        AND (
          child_enrollment.effective_to IS NULL
          OR child_enrollment.effective_to >= selected_local_date
        )
      ORDER BY child_enrollment.effective_from DESC, child_enrollment.enrollment_id
      LIMIT 1
    ) AS enrollment ON true
  ), bounded AS (
    SELECT
      eligible.*,
      COALESCE(current_name.display_name, 'Student') AS display_name
    FROM eligible
    LEFT JOIN LATERAL (
      SELECT concat_ws(' ', person_name.given_name, person_name.family_name) AS display_name
      FROM people.person_name AS person_name
      WHERE person_name.tenant_id = p_tenant_id
        AND person_name.person_id = eligible.person_id
        AND person_name.usage IN ('preferred', 'legal')
        AND person_name.effective_from <= selected_local_date
        AND (
          person_name.effective_to IS NULL
          OR person_name.effective_to >= selected_local_date
        )
      ORDER BY
        CASE WHEN person_name.usage = 'preferred' THEN 0 ELSE 1 END,
        person_name.effective_from DESC,
        person_name.person_name_id
      LIMIT 1
    ) AS current_name ON true
    ORDER BY eligible.student_profile_id
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'childId', bounded.student_profile_id,
        'displayName', bounded.display_name,
        'gradeLevelId', bounded.grade_level_id,
        'profileHref', '/family/children',
        'requiredCapability', 'student.household.read'
      )
      ORDER BY bounded.student_profile_id
    ),
    '[]'::jsonb
  )
  INTO children_payload
  FROM bounded;

  SELECT count(*)
  INTO attendance_alert_count
  FROM attendance.attendance_record AS attendance_record
  JOIN attendance.attendance_session AS attendance_session
    ON attendance_session.tenant_id = attendance_record.tenant_id
   AND attendance_session.session_id = attendance_record.session_id
   AND attendance_session.campus_id = p_campus_id
   AND attendance_session.local_date = selected_local_date
  JOIN scheduling.scheduled_class_meeting AS scheduled_meeting
    ON scheduled_meeting.tenant_id = attendance_session.tenant_id
   AND scheduled_meeting.scheduled_meeting_id = attendance_session.scheduled_meeting_id
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = scheduled_meeting.tenant_id
   AND timetable.timetable_version_id = scheduled_meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  JOIN attendance.attendance_code AS attendance_code
    ON attendance_code.tenant_id = attendance_record.tenant_id
   AND attendance_code.attendance_code_id = attendance_record.attendance_code_id
   AND attendance_code.meaning IN ('absent', 'late')
  WHERE attendance_record.tenant_id = p_tenant_id
    AND attendance_record.student_profile_id = ANY(education_student_profile_ids);

  SELECT count(*)
  INTO published_grade_count
  FROM gradebook.grade_publication AS grade_publication
  JOIN gradebook.grade_calculation_snapshot AS grade_snapshot
    ON grade_snapshot.tenant_id = grade_publication.tenant_id
   AND grade_snapshot.snapshot_id = grade_publication.snapshot_id
  WHERE grade_publication.tenant_id = p_tenant_id
    AND grade_snapshot.student_profile_id = ANY(education_student_profile_ids)
    AND EXISTS (
      SELECT 1
      FROM scheduling.class_meeting_pattern AS class_pattern
      JOIN scheduling.timetable_version AS timetable
        ON timetable.tenant_id = class_pattern.tenant_id
       AND timetable.timetable_version_id = class_pattern.timetable_version_id
       AND timetable.campus_id = p_campus_id
       AND timetable.publication_state = 'published'
      WHERE class_pattern.tenant_id = grade_snapshot.tenant_id
        AND class_pattern.section_id = grade_snapshot.section_id
    )
    AND grade_publication.available_from <= selected_composed_at
    AND (
      grade_publication.available_to IS NULL
      OR grade_publication.available_to >= selected_composed_at
    );

  SELECT COALESCE(
    sum(
      (
        invoice.balance_minor::numeric
        * responsible_party.responsibility_basis_points::numeric
        / 10000
      )::bigint
    ),
    0
  )
  INTO outstanding_balance_minor
  FROM billing.billing_account AS billing_account
  JOIN billing.responsible_party AS responsible_party
    ON responsible_party.tenant_id = billing_account.tenant_id
   AND responsible_party.legal_entity_id = billing_account.legal_entity_id
   AND responsible_party.billing_account_id = billing_account.billing_account_id
   AND responsible_party.person_ref = selected_guardian_person_id::text
  JOIN billing.invoice AS invoice
    ON invoice.tenant_id = billing_account.tenant_id
   AND invoice.legal_entity_id = billing_account.legal_entity_id
   AND invoice.billing_account_id = billing_account.billing_account_id
   AND invoice.status IN ('posted', 'partially-paid')
   AND invoice.balance_minor > 0
   AND invoice.currency = selected_currency
  WHERE billing_account.tenant_id = p_tenant_id
    AND billing_account.legal_entity_id = selected_legal_entity_id
    AND billing_account.status = 'active'
    AND billing_account.currency = selected_currency
    AND billing_account.account_holder_ref = ANY(billing_student_person_refs);

  composed_payload := jsonb_build_object(
    'schemaVersion', 1,
    'view', 'guardian-home',
    'localDate', selected_local_date,
    'currency', selected_currency,
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'id', 'authorized-children',
        'label', 'Children',
        'value', authorized_child_count,
        'definition', 'Active campus students with current verified portal authority.',
        'tone', 'stable',
        'href', '/family/children',
        'capability', 'student.household.read'
      ),
      jsonb_build_object(
        'id', 'attendance-alerts',
        'label', 'Attendance alerts',
        'value', attendance_alert_count,
        'definition', 'Current-day absent or late records for education-authorized children.',
        'tone', CASE WHEN attendance_alert_count = 0 THEN 'stable' ELSE 'warning' END,
        'href', '/family/attendance',
        'capability', 'attendance.household.read'
      ),
      jsonb_build_object(
        'id', 'published-grades',
        'label', 'Published grades',
        'value', published_grade_count,
        'definition', 'Currently available grade publications for education-authorized children.',
        'tone', 'information',
        'href', '/family/grades',
        'capability', 'records.household.read'
      ),
      jsonb_build_object(
        'id', 'open-balance-minor',
        'label', 'Open balance',
        'value', outstanding_balance_minor,
        'currency', selected_currency,
        'definition', 'Open posted invoice balance attributable to the responsible guardian.',
        'tone', CASE WHEN outstanding_balance_minor = 0 THEN 'stable' ELSE 'warning' END,
        'href', '/family/finance',
        'capability', 'finance.household.read'
      )
    ),
    'children', children_payload,
    'exceptions',
      CASE WHEN attendance_alert_count > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'guardian-attendance-alert',
          'area', 'Attendance',
          'title', 'Attendance requires review',
          'summary', attendance_alert_count::text || ' absent or late record(s) are visible today.',
          'severity', 'warning',
          'status', 'Review',
          'href', '/family/attendance',
          'capability', 'attendance.household.read'
        ))
      ELSE '[]'::jsonb END
      || CASE WHEN outstanding_balance_minor > 0 THEN
        jsonb_build_array(jsonb_build_object(
          'id', 'guardian-open-balance',
          'area', 'Finance',
          'title', 'An open balance is available',
          'summary', outstanding_balance_minor::text || ' ' || selected_currency || ' minor units remain open.',
          'severity', 'information',
          'status', 'Due',
          'href', '/family/finance',
          'capability', 'finance.household.read'
        ))
      ELSE '[]'::jsonb END,
    'source', 'database-guardian-composer-v1'
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
        RETURN jsonb_build_object('composed', false, 'reason', 'persona-not-guardian');
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
    'guardian',
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
    'runtime.projection.guardian.composed',
    'runtime_projection_source',
    p_membership_id::text,
    p_correlation_id::text,
    jsonb_build_object(
      'compositionId', selected_composition_id,
      'campusId', p_campus_id,
      'guardianPersonId', selected_guardian_person_id,
      'authorizedChildCount', authorized_child_count,
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

REVOKE ALL ON FUNCTION platform.compose_guardian_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) FROM PUBLIC, app_runtime, app_projection_admin, app_projection_publisher;
GRANT EXECUTE ON FUNCTION platform.compose_guardian_runtime_projection_source(
  uuid, uuid, uuid, bigint, text, uuid
) TO app_projection_composer;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608010201_PILOT-10_guardian_runtime_projection_composer',
  'PILOT-10',
  'Database-owned guardian home composition from verified child authority, attendance, grade publication and responsible-party billing scope'
)
ON CONFLICT (migration_id) DO NOTHING;
