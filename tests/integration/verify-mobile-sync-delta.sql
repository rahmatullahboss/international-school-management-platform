DO $mob08_verify$
DECLARE
  v_tenant_id constant uuid := '40000000-0000-4000-8000-000000000001';
  v_campus_id constant uuid := '40000000-0000-4000-8000-000000000003';
  v_guardian_student_id constant uuid := '40000000-0000-4000-8000-000000000013';
  v_unrelated_student_id constant uuid := '40000000-0000-4000-8000-000000000831';
  v_teacher_section_id constant uuid := '40000000-0000-4000-8000-000000000064';
  v_unrelated_section_id constant uuid := '40000000-0000-4000-8000-000000000890';
  guardian_baseline jsonb;
  guardian_unchanged jsonb;
  guardian_changed jsonb;
  guardian_after_enrollment jsonb;
  teacher_baseline jsonb;
  teacher_unchanged jsonb;
  teacher_changed jsonb;
  teacher_after_enrollment jsonb;
  foreign_cursor jsonb;
  expired_cursor_result jsonb;
  unauthorized jsonb;
  replay_result jsonb;
  guardian_after_meeting_insert jsonb;
  guardian_after_meeting_removal jsonb;
  guardian_cursor uuid;
  guardian_changed_cursor uuid;
  teacher_cursor uuid;
  teacher_changed_cursor uuid;
  selected_cursor_id uuid;
  selected_invalidation_sequence bigint;
  affected_rows bigint;
BEGIN
  INSERT INTO academics.class_section (
    tenant_id,
    section_id,
    course_version_id,
    academic_year_id,
    term_id,
    campus_id,
    section_code,
    section_title,
    capacity,
    publication_state
  ) VALUES (
    v_tenant_id,
    v_unrelated_section_id,
    '40000000-0000-4000-8000-000000000063',
    '40000000-0000-4000-8000-000000000060',
    '40000000-0000-4000-8000-000000000061',
    v_campus_id,
    'MOB-OTHER',
    'Unassigned Mobile Section',
    30,
    'published'
  );

  guardian_baseline := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    NULL
  );
  IF guardian_baseline IS NULL
     OR guardian_baseline->>'changed' <> 'false'
     OR (SELECT count(*) FROM jsonb_object_keys(guardian_baseline)) <> 3
     OR NOT (guardian_baseline ?& ARRAY['cursor', 'changed', 'serverTime'])
     OR guardian_baseline->>'cursor' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR guardian_baseline->>'serverTime' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN
    RAISE EXCEPTION 'MOB08_GUARDIAN_BASELINE_INVALID:%', guardian_baseline;
  END IF;
  guardian_cursor := (guardian_baseline->>'cursor')::uuid;

  teacher_baseline := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    'teacher',
    NULL
  );
  IF teacher_baseline IS NULL OR teacher_baseline->>'changed' <> 'false' THEN
    RAISE EXCEPTION 'MOB08_TEACHER_BASELINE_INVALID:%', teacher_baseline;
  END IF;
  teacher_cursor := (teacher_baseline->>'cursor')::uuid;

  PERFORM platform.record_mobile_sync_invalidation(
    v_tenant_id,
    v_campus_id,
    'family',
    'student',
    v_unrelated_student_id
  );
  PERFORM platform.record_mobile_sync_invalidation(
    v_tenant_id,
    v_campus_id,
    'staff',
    'section',
    v_unrelated_section_id
  );

  guardian_unchanged := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    guardian_cursor
  );
  teacher_unchanged := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    'teacher',
    teacher_cursor
  );
  IF guardian_unchanged->>'changed' <> 'false'
     OR guardian_unchanged->>'cursor' <> guardian_cursor::text THEN
    RAISE EXCEPTION 'MOB08_UNRELATED_STUDENT_ACTIVITY_LEAKED:%', guardian_unchanged;
  END IF;
  IF teacher_unchanged->>'changed' <> 'false'
     OR teacher_unchanged->>'cursor' <> teacher_cursor::text THEN
    RAISE EXCEPTION 'MOB08_UNRELATED_SECTION_ACTIVITY_LEAKED:%', teacher_unchanged;
  END IF;

  PERFORM platform.record_mobile_sync_invalidation(
    v_tenant_id,
    v_campus_id,
    'family',
    'student',
    v_guardian_student_id
  );

  guardian_changed := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    guardian_cursor
  );
  IF guardian_changed->>'changed' <> 'true'
     OR guardian_changed->>'cursor' = guardian_cursor::text THEN
    RAISE EXCEPTION 'MOB08_AUTHORIZED_STUDENT_INVALIDATION_NOT_VISIBLE:%', guardian_changed;
  END IF;
  guardian_changed_cursor := (guardian_changed->>'cursor')::uuid;

  teacher_unchanged := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    'teacher',
    teacher_cursor
  );
  IF teacher_unchanged->>'changed' <> 'false'
     OR teacher_unchanged->>'cursor' <> teacher_cursor::text THEN
    RAISE EXCEPTION 'MOB08_FAMILY_ACTIVITY_LEAKED_TO_STAFF:%', teacher_unchanged;
  END IF;

  PERFORM platform.record_mobile_sync_invalidation(
    v_tenant_id,
    v_campus_id,
    'staff',
    'section',
    v_teacher_section_id
  );
  teacher_changed := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    'teacher',
    teacher_cursor
  );
  IF teacher_changed->>'changed' <> 'true'
     OR teacher_changed->>'cursor' = teacher_cursor::text THEN
    RAISE EXCEPTION 'MOB08_ASSIGNED_SECTION_INVALIDATION_NOT_VISIBLE:%', teacher_changed;
  END IF;
  teacher_changed_cursor := (teacher_changed->>'cursor')::uuid;

  foreign_cursor := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    'teacher',
    guardian_changed_cursor
  );
  IF foreign_cursor <> '{"status":"cursor-invalid"}'::jsonb THEN
    RAISE EXCEPTION 'MOB08_FOREIGN_CURSOR_NOT_REJECTED:%', foreign_cursor;
  END IF;

  INSERT INTO platform.mobile_sync_cursor (
    tenant_id,
    cursor_id,
    campus_id,
    account_id,
    persona,
    revision,
    issued_at,
    expires_at
  ) VALUES (
    v_tenant_id,
    '40000000-0000-4000-8000-000000000891',
    v_campus_id,
    '40000000-0000-4000-8000-000000000004',
    'guardian',
    0,
    clock_timestamp() - interval '2 days',
    clock_timestamp() - interval '1 day'
  );
  expired_cursor_result := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    '40000000-0000-4000-8000-000000000891'
  );
  IF expired_cursor_result <> '{"status":"cursor-invalid"}'::jsonb THEN
    RAISE EXCEPTION 'MOB08_EXPIRED_CURSOR_NOT_REJECTED:%', expired_cursor_result;
  END IF;

  unauthorized := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-unknown',
    v_tenant_id,
    v_campus_id,
    'guardian',
    NULL
  );
  IF unauthorized IS NOT NULL THEN
    RAISE EXCEPTION 'MOB08_UNAUTHORIZED_SCOPE_EXPOSED:%', unauthorized;
  END IF;

  UPDATE student_lifecycle.enrollment
  SET version = version + 1,
      updated_at = clock_timestamp()
  WHERE tenant_id = v_tenant_id
    AND enrollment_id = '40000000-0000-4000-8000-000000000014';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'MOB08_ENROLLMENT_TRIGGER_FIXTURE_MISSING';
  END IF;

  guardian_after_enrollment := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    guardian_changed_cursor
  );
  teacher_after_enrollment := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    'teacher',
    teacher_changed_cursor
  );
  IF guardian_after_enrollment->>'changed' <> 'true' THEN
    RAISE EXCEPTION 'MOB08_ENROLLMENT_TRIGGER_NOT_VISIBLE_TO_FAMILY:%', guardian_after_enrollment;
  END IF;
  IF teacher_after_enrollment->>'changed' <> 'false'
     OR teacher_after_enrollment->>'cursor' <> teacher_changed_cursor::text THEN
    RAISE EXCEPTION 'MOB08_ENROLLMENT_ACTIVITY_LEAKED_TO_STAFF:%', teacher_after_enrollment;
  END IF;

  replay_result := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    guardian_changed_cursor
  );
  IF replay_result->>'changed' <> 'true'
     OR replay_result->>'cursor' <> guardian_after_enrollment->>'cursor' THEN
    RAISE EXCEPTION 'MOB08_REPLAY_NOT_IDEMPOTENT:%', replay_result;
  END IF;

  INSERT INTO scheduling.timetable_version (
    tenant_id,
    timetable_version_id,
    academic_year_id,
    term_id,
    campus_id,
    timetable_name,
    effective_from,
    effective_to,
    publication_state,
    idempotency_key
  ) VALUES (
    v_tenant_id,
    '40000000-0000-4000-8000-000000000892',
    '40000000-0000-4000-8000-000000000060',
    '40000000-0000-4000-8000-000000000061',
    v_campus_id,
    'MOB-08 draft trigger verifier',
    current_date - 1,
    current_date + 1,
    'draft',
    'mob08-draft-trigger-verifier'
  );
  INSERT INTO scheduling.class_meeting_pattern (
    tenant_id,
    meeting_pattern_id,
    timetable_version_id,
    section_id,
    weekday,
    starts_at,
    ends_at,
    timezone,
    teacher_ids,
    student_ids,
    valid_from,
    valid_to
  ) VALUES (
    v_tenant_id,
    '40000000-0000-4000-8000-000000000893',
    '40000000-0000-4000-8000-000000000892',
    v_teacher_section_id,
    extract(dow from current_date)::smallint,
    '13:00',
    '14:00',
    'Asia/Dhaka',
    '["40000000-0000-4000-8000-000000000056"]'::jsonb,
    jsonb_build_array(v_guardian_student_id::text),
    current_date - 1,
    current_date + 1
  );
  INSERT INTO scheduling.scheduled_class_meeting (
    tenant_id,
    scheduled_meeting_id,
    timetable_version_id,
    meeting_pattern_id,
    section_id,
    local_date,
    starts_at,
    ends_at,
    timezone,
    teacher_ids,
    student_ids,
    meeting_status,
    version
  ) VALUES (
    v_tenant_id,
    '40000000-0000-4000-8000-000000000894',
    '40000000-0000-4000-8000-000000000892',
    '40000000-0000-4000-8000-000000000893',
    v_teacher_section_id,
    current_date,
    '13:00',
    '14:00',
    'Asia/Dhaka',
    '["40000000-0000-4000-8000-000000000056"]'::jsonb,
    jsonb_build_array(v_guardian_student_id::text),
    'scheduled',
    1
  );

  guardian_after_meeting_insert := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    (guardian_after_enrollment->>'cursor')::uuid
  );
  IF guardian_after_meeting_insert->>'changed' <> 'true' THEN
    RAISE EXCEPTION 'MOB08_MEETING_INSERT_DID_NOT_INVALIDATE_EXACT_STUDENT:%',
      guardian_after_meeting_insert;
  END IF;

  UPDATE scheduling.scheduled_class_meeting
  SET student_ids = jsonb_build_array(v_unrelated_student_id::text),
      version = version + 1
  WHERE tenant_id = v_tenant_id
    AND scheduled_meeting_id = '40000000-0000-4000-8000-000000000894';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'MOB08_MEETING_UPDATE_FIXTURE_MISSING';
  END IF;

  guardian_after_meeting_removal := platform.resolve_mobile_sync_delta(
    'https://identity.school.test',
    'provider-mobile-user-1',
    v_tenant_id,
    v_campus_id,
    'guardian',
    (guardian_after_meeting_insert->>'cursor')::uuid
  );
  IF guardian_after_meeting_removal->>'changed' <> 'true' THEN
    RAISE EXCEPTION 'MOB08_REMOVED_MEETING_STUDENT_NOT_INVALIDATED:%',
      guardian_after_meeting_removal;
  END IF;

  SELECT invalidation.invalidation_sequence
  INTO selected_invalidation_sequence
  FROM platform.mobile_sync_invalidation AS invalidation
  WHERE invalidation.tenant_id = v_tenant_id
    AND invalidation.campus_id = v_campus_id
  ORDER BY invalidation.invalidation_sequence DESC
  LIMIT 1;

  BEGIN
    UPDATE platform.mobile_sync_invalidation
    SET occurred_at = occurred_at + interval '1 second'
    WHERE platform.mobile_sync_invalidation.tenant_id = v_tenant_id
      AND invalidation_sequence = selected_invalidation_sequence;
    RAISE EXCEPTION 'MOB08_INVALIDATION_MUTATION_WAS_ALLOWED';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  selected_cursor_id := (guardian_after_enrollment->>'cursor')::uuid;
  BEGIN
    UPDATE platform.mobile_sync_cursor
    SET revision = revision + 1
    WHERE platform.mobile_sync_cursor.tenant_id = v_tenant_id
      AND cursor_id = selected_cursor_id;
    RAISE EXCEPTION 'MOB08_CURSOR_IDENTITY_MUTATION_WAS_ALLOWED';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM platform.record_mobile_sync_invalidation(
      v_tenant_id,
      v_campus_id,
      'family',
      'section',
      v_teacher_section_id
    );
    RAISE EXCEPTION 'MOB08_INVALID_SUBJECT_KIND_WAS_ALLOWED';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF has_table_privilege('app_runtime', 'platform.mobile_sync_invalidation', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_sync_cursor', 'SELECT') THEN
    RAISE EXCEPTION 'MOB08_APP_RUNTIME_TABLE_ACCESS_EXPOSED';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_sync_delta(text,text,uuid,uuid,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB08_REVIEWED_FUNCTION_NOT_EXECUTABLE';
  END IF;
  IF has_function_privilege(
    'app_runtime',
    'platform.record_mobile_sync_invalidation(uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'app_runtime',
    'platform.record_mobile_sync_student_invalidation(uuid,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'app_runtime',
    'platform.record_mobile_sync_section_invalidation(uuid,uuid,boolean,boolean)',
    'EXECUTE'
  ) OR has_function_privilege(
    'app_runtime',
    'platform.mobile_sync_invalidation_is_visible(uuid,uuid,uuid,text,text,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB08_INTERNAL_SYNC_HELPER_EXPOSED';
  END IF;
END
$mob08_verify$;
