DO $mob09_verify$
DECLARE
  v_tenant_id constant uuid := '40000000-0000-4000-8000-000000000001';
  v_campus_id constant uuid := '40000000-0000-4000-8000-000000000003';
  v_teacher_role_id constant uuid := '40000000-0000-4000-8000-000000000053';
  v_teacher_person_id constant uuid := '40000000-0000-4000-8000-000000000054';
  v_teacher_assessment_id constant uuid := '40000000-0000-4000-8000-000000000077';
  v_unassigned_section_id constant uuid := '40000000-0000-4000-8000-000000000890';
  v_unassigned_assessment_id constant uuid := '40000000-0000-4000-8000-000000000901';
  v_conversation_id constant uuid := '40000000-0000-4000-8000-000000000810';
  v_staff_message_id constant uuid := '40000000-0000-4000-8000-000000000902';
  assessments jsonb;
  assessment_item jsonb;
  conversation_without_capability jsonb;
  conversations_before_participation jsonb;
  conversations_after_participation jsonb;
  conversations_after_message jsonb;
  messages_after_participation jsonb;
  messages_after_message jsonb;
  conversations_without_active_enrollment jsonb;
  messages_without_active_enrollment jsonb;
  conversations_after_leave jsonb;
  messages_after_leave jsonb;
  joined_at timestamptz;
BEGIN
  assessments := platform.resolve_mobile_teacher_assessments(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    64
  );

  IF assessments IS NULL
     OR (SELECT count(*) FROM jsonb_object_keys(assessments)) <> 3
     OR NOT (assessments ?& ARRAY['assessments', 'generatedAt', 'hasMore'])
     OR jsonb_array_length(assessments->'assessments') <> 1 THEN
    RAISE EXCEPTION 'MOB09_ASSESSMENT_LIST_INVALID:%', assessments;
  END IF;

  assessment_item := assessments->'assessments'->0;
  IF assessment_item->>'assessmentId' <> v_teacher_assessment_id::text
     OR assessment_item->>'sectionId' <> '40000000-0000-4000-8000-000000000064'
     OR assessment_item->>'sectionLabel' <> 'Mobile Grade 5A'
     OR assessment_item->>'subjectLabel' <> 'Mobile Mathematics'
     OR assessment_item->>'assessmentTitle' <> 'Mobile Quiz'
     OR assessment_item->>'categoryLabel' <> 'Quiz'
     OR assessment_item->>'state' <> 'draft'
     OR assessment_item->>'lockState' <> 'locked'
     OR (assessment_item->>'version')::bigint <> 2
     OR (assessment_item->>'scoreScale')::integer <> 10000
     OR (assessment_item->>'maximumScoreUnits')::bigint <> 1000000
     OR (assessment_item->>'rosterCount')::bigint <> 1
     OR (assessment_item->>'enteredCount')::bigint <> 1
     OR (SELECT count(*) FROM jsonb_object_keys(assessment_item)) <> 14 THEN
    RAISE EXCEPTION 'MOB09_ASSESSMENT_SUMMARY_INVALID:%', assessment_item;
  END IF;

  INSERT INTO gradebook.assessment (
    tenant_id,
    assessment_id,
    section_id,
    reporting_period_id,
    policy_version_id,
    category_id,
    assessment_title,
    maximum_points,
    due_at,
    assessment_state,
    version
  ) VALUES (
    v_tenant_id,
    v_unassigned_assessment_id,
    v_unassigned_section_id,
    '40000000-0000-4000-8000-000000000078',
    '40000000-0000-4000-8000-000000000075',
    '40000000-0000-4000-8000-000000000076',
    'Unassigned Mobile Quiz',
    20.1250,
    clock_timestamp() + interval '2 days',
    'draft',
    1
  );

  assessments := platform.resolve_mobile_teacher_assessments(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    64
  );
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(assessments->'assessments') AS item(value)
    WHERE item.value->>'assessmentId' = v_unassigned_assessment_id::text
  ) THEN
    RAISE EXCEPTION 'MOB09_UNASSIGNED_ASSESSMENT_EXPOSED:%', assessments;
  END IF;

  conversation_without_capability := platform.resolve_mobile_teacher_conversations(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    50
  );
  IF conversation_without_capability IS NOT NULL THEN
    RAISE EXCEPTION 'MOB09_MESSAGES_CAPABILITY_BYPASS:%', conversation_without_capability;
  END IF;

  INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
  VALUES (v_tenant_id, v_teacher_role_id, 'messages.read')
  ON CONFLICT DO NOTHING;

  conversations_before_participation := platform.resolve_mobile_teacher_conversations(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    50
  );
  IF conversations_before_participation IS NULL
     OR jsonb_array_length(conversations_before_participation->'conversations') <> 0 THEN
    RAISE EXCEPTION 'MOB09_EXPLICIT_PARTICIPANT_BOUNDARY_INVALID:%', conversations_before_participation;
  END IF;

  joined_at := date_trunc('milliseconds', clock_timestamp());
  INSERT INTO integration_core.conversation_participant (
    tenant_id,
    conversation_id,
    person_id,
    participant_kind,
    display_label,
    can_reply,
    joined_at
  ) VALUES (
    v_tenant_id,
    v_conversation_id,
    v_teacher_person_id,
    'staff',
    'Teacher Tester',
    true,
    joined_at
  );

  conversations_after_participation := platform.resolve_mobile_teacher_conversations(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    50
  );
  IF jsonb_array_length(conversations_after_participation->'conversations') <> 1
     OR conversations_after_participation->'conversations'->0->>'conversationId' <> v_conversation_id::text
     OR conversations_after_participation->'conversations'->0->>'canReply' <> 'true'
     OR (conversations_after_participation->'conversations'->0->>'latestMessageAt')::timestamptz < joined_at
     OR (SELECT count(*) FROM jsonb_object_keys(conversations_after_participation->'conversations'->0)) <> 6 THEN
    RAISE EXCEPTION 'MOB09_STAFF_CONVERSATION_SUMMARY_INVALID:%', conversations_after_participation;
  END IF;

  messages_after_participation := platform.resolve_mobile_teacher_conversation_messages(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    100
  );
  IF messages_after_participation IS NULL
     OR jsonb_array_length(messages_after_participation->'messages') <> 0 THEN
    RAISE EXCEPTION 'MOB09_PREJOIN_MESSAGE_LEAKED:%', messages_after_participation;
  END IF;

  INSERT INTO integration_core.conversation_message (
    tenant_id,
    conversation_id,
    message_id,
    author_person_id,
    author_label,
    body,
    sent_at
  ) VALUES (
    v_tenant_id,
    v_conversation_id,
    v_staff_message_id,
    v_teacher_person_id,
    'Teacher Tester',
    'Please review the homework note.',
    date_trunc('milliseconds', clock_timestamp() + interval '1 second')
  );

  conversations_after_message := platform.resolve_mobile_teacher_conversations(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    50
  );
  messages_after_message := platform.resolve_mobile_teacher_conversation_messages(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    100
  );
  IF jsonb_array_length(messages_after_message->'messages') <> 1
     OR messages_after_message->'messages'->0->>'messageId' <> v_staff_message_id::text
     OR messages_after_message->'messages'->0->>'authoredByViewer' <> 'true'
     OR messages_after_message->'messages'->0->>'body' <> 'Please review the homework note.'
     OR (SELECT count(*) FROM jsonb_object_keys(messages_after_message->'messages'->0)) <> 5
     OR conversations_after_message->'conversations'->0->>'latestMessageAt'
        <> messages_after_message->'messages'->0->>'sentAt' THEN
    RAISE EXCEPTION 'MOB09_POSTJOIN_MESSAGE_INVALID: conversations=% messages=%',
      conversations_after_message, messages_after_message;
  END IF;

  UPDATE student_lifecycle.enrollment
  SET status = 'transferred'
  WHERE tenant_id = v_tenant_id
    AND enrollment_id = '40000000-0000-4000-8000-000000000014';

  conversations_without_active_enrollment := platform.resolve_mobile_teacher_conversations(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    50
  );
  messages_without_active_enrollment := platform.resolve_mobile_teacher_conversation_messages(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    100
  );
  IF jsonb_array_length(conversations_without_active_enrollment->'conversations') <> 0
     OR messages_without_active_enrollment IS NOT NULL THEN
    RAISE EXCEPTION 'MOB09_INACTIVE_CAMPUS_ENROLLMENT_RETAINED_ACCESS: conversations=% messages=%',
      conversations_without_active_enrollment, messages_without_active_enrollment;
  END IF;

  UPDATE student_lifecycle.enrollment
  SET status = 'active'
  WHERE tenant_id = v_tenant_id
    AND enrollment_id = '40000000-0000-4000-8000-000000000014';

  UPDATE integration_core.conversation_participant
  SET left_at = clock_timestamp()
  WHERE tenant_id = v_tenant_id
    AND conversation_id = v_conversation_id
    AND person_id = v_teacher_person_id;

  conversations_after_leave := platform.resolve_mobile_teacher_conversations(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    50
  );
  messages_after_leave := platform.resolve_mobile_teacher_conversation_messages(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    100
  );
  IF jsonb_array_length(conversations_after_leave->'conversations') <> 0
     OR messages_after_leave IS NOT NULL THEN
    RAISE EXCEPTION 'MOB09_LEFT_PARTICIPANT_RETAINED_ACCESS: conversations=% messages=%',
      conversations_after_leave, messages_after_leave;
  END IF;

  IF has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_teacher_read_authority(text,text,uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB09_INTERNAL_AUTHORITY_HELPER_EXPOSED';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_teacher_assessments(text,text,uuid,uuid,integer)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_teacher_conversations(text,text,uuid,uuid,integer)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_teacher_conversation_messages(text,text,uuid,uuid,uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB09_REVIEWED_READ_FUNCTION_NOT_EXECUTABLE';
  END IF;

  IF has_table_privilege('app_runtime', 'integration_core.conversation_thread', 'SELECT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_participant', 'SELECT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_message', 'SELECT') THEN
    RAISE EXCEPTION 'MOB09_CONVERSATION_LEDGER_DIRECT_ACCESS_EXPOSED';
  END IF;
END
$mob09_verify$;
