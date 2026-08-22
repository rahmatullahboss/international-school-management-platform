DO $mob10_verify$
DECLARE
  v_tenant_id constant uuid := '40000000-0000-4000-8000-000000000001';
  v_campus_id constant uuid := '40000000-0000-4000-8000-000000000003';
  v_teacher_account_id constant uuid := '40000000-0000-4000-8000-000000000050';
  v_teacher_role_id constant uuid := '40000000-0000-4000-8000-000000000053';
  v_teacher_person_id constant uuid := '40000000-0000-4000-8000-000000000054';
  v_student_profile_id constant uuid := '40000000-0000-4000-8000-000000000013';
  v_enrollment_id constant uuid := '40000000-0000-4000-8000-000000000014';
  v_conversation_id constant uuid := '40000000-0000-4000-8000-000000000910';
  v_prejoin_message_id constant uuid := '40000000-0000-4000-8000-000000000911';
  send_without_capability jsonb;
  accepted_send jsonb;
  replay_send jsonb;
  changed_reuse jsonb;
  locked_send jsonb;
  read_prejoin jsonb;
  accepted_read jsonb;
  replay_read jsonb;
  older_read jsonb;
  replay_after_enrollment_revoke jsonb;
  replay_after_leave jsonb;
  sent_message_id uuid;
  message_count_before bigint;
  message_count_after bigint;
  command_count_before bigint;
  command_count_after bigint;
  first_read_revision bigint;
  joined_at timestamptz;
BEGIN
  send_without_capability := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'Capability must be required.',
    'teacher-send-capability-0001'
  );
  IF send_without_capability IS NOT NULL THEN
    RAISE EXCEPTION 'MOB10_MESSAGES_SEND_CAPABILITY_BYPASS:%', send_without_capability;
  END IF;

  INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
  VALUES (v_tenant_id, v_teacher_role_id, 'messages.send')
  ON CONFLICT DO NOTHING;

  INSERT INTO integration_core.conversation_thread (
    tenant_id,
    conversation_id,
    student_profile_id,
    subject,
    status,
    version,
    created_at,
    last_message_at
  ) VALUES (
    v_tenant_id,
    v_conversation_id,
    v_student_profile_id,
    'MOB-10 Teacher conversation',
    'open',
    1,
    clock_timestamp() - interval '5 minutes',
    clock_timestamp() - interval '4 minutes'
  );

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
    v_prejoin_message_id,
    '40000000-0000-4000-8000-000000000009',
    'Guardian Tester',
    'This message predates staff participation.',
    clock_timestamp() - interval '4 minutes'
  );

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

  SELECT count(*) INTO message_count_before
  FROM integration_core.conversation_message
  WHERE tenant_id = v_tenant_id
    AND conversation_id = v_conversation_id;

  accepted_send := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'Please review the assignment update.',
    'teacher-send-idempotency-0001'
  );

  IF accepted_send IS NULL
     OR accepted_send->>'body' <> 'Please review the assignment update.'
     OR accepted_send->>'authorLabel' <> 'Teacher Tester'
     OR NOT (accepted_send ?& ARRAY['messageId', 'authorLabel', 'body', 'sentAt'])
     OR (SELECT count(*) FROM jsonb_object_keys(accepted_send)) <> 4 THEN
    RAISE EXCEPTION 'MOB10_ACCEPTED_SEND_INVALID:%', accepted_send;
  END IF;
  sent_message_id := (accepted_send->>'messageId')::uuid;

  SELECT count(*) INTO message_count_after
  FROM integration_core.conversation_message
  WHERE tenant_id = v_tenant_id
    AND conversation_id = v_conversation_id;
  IF message_count_after <> message_count_before + 1 THEN
    RAISE EXCEPTION 'MOB10_ACCEPTED_SEND_DID_NOT_APPEND_EXACTLY_ONCE';
  END IF;

  replay_send := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'Please review the assignment update.',
    'teacher-send-idempotency-0001'
  );
  IF replay_send IS DISTINCT FROM accepted_send THEN
    RAISE EXCEPTION 'MOB10_SEND_REPLAY_CHANGED_RECEIPT: first=% replay=%', accepted_send, replay_send;
  END IF;
  IF (
    SELECT count(*)
    FROM integration_core.conversation_message
    WHERE tenant_id = v_tenant_id
      AND conversation_id = v_conversation_id
  ) <> message_count_after THEN
    RAISE EXCEPTION 'MOB10_SEND_REPLAY_DUPLICATED_MESSAGE';
  END IF;

  changed_reuse := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'Changed body must conflict.',
    'teacher-send-idempotency-0001'
  );
  IF changed_reuse <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB10_CHANGED_IDEMPOTENCY_REUSE_NOT_CONFLICT:%', changed_reuse;
  END IF;
  IF (
    SELECT count(*)
    FROM integration_core.conversation_message
    WHERE tenant_id = v_tenant_id
      AND conversation_id = v_conversation_id
  ) <> message_count_after THEN
    RAISE EXCEPTION 'MOB10_CHANGED_IDEMPOTENCY_REUSE_MUTATED_MESSAGES';
  END IF;

  UPDATE integration_core.conversation_participant
  SET can_reply = false
  WHERE tenant_id = v_tenant_id
    AND conversation_id = v_conversation_id
    AND person_id = v_teacher_person_id;

  locked_send := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'This must not be accepted while reply is locked.',
    'teacher-send-idempotency-0002'
  );
  IF locked_send <> jsonb_build_object('status', 'locked') THEN
    RAISE EXCEPTION 'MOB10_CAN_REPLY_LOCK_NOT_ENFORCED:%', locked_send;
  END IF;

  UPDATE integration_core.conversation_participant
  SET can_reply = true
  WHERE tenant_id = v_tenant_id
    AND conversation_id = v_conversation_id
    AND person_id = v_teacher_person_id;

  read_prejoin := platform.mark_mobile_teacher_conversation_read(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    v_prejoin_message_id,
    'teacher-read-idempotency-0001'
  );
  IF read_prejoin <> jsonb_build_object('status', 'message-not-found') THEN
    RAISE EXCEPTION 'MOB10_PREJOIN_READ_BOUNDARY_BYPASSED:%', read_prejoin;
  END IF;

  SELECT count(*) INTO command_count_before
  FROM platform.mobile_teacher_conversation_command
  WHERE tenant_id = v_tenant_id
    AND account_id = v_teacher_account_id;

  accepted_read := platform.mark_mobile_teacher_conversation_read(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    sent_message_id,
    'teacher-read-idempotency-0002'
  );
  IF accepted_read IS NULL OR NOT (accepted_read ? 'acceptedRevision') THEN
    RAISE EXCEPTION 'MOB10_ACCEPTED_READ_INVALID:%', accepted_read;
  END IF;
  first_read_revision := (accepted_read->>'acceptedRevision')::bigint;
  IF first_read_revision <= 1 THEN
    RAISE EXCEPTION 'MOB10_READ_REVISION_DID_NOT_ADVANCE:%', accepted_read;
  END IF;

  replay_read := platform.mark_mobile_teacher_conversation_read(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    sent_message_id,
    'teacher-read-idempotency-0002'
  );
  IF replay_read IS DISTINCT FROM accepted_read THEN
    RAISE EXCEPTION 'MOB10_READ_REPLAY_CHANGED_RECEIPT: first=% replay=%', accepted_read, replay_read;
  END IF;

  older_read := platform.mark_mobile_teacher_conversation_read(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    sent_message_id,
    'teacher-read-idempotency-0003'
  );
  IF (older_read->>'acceptedRevision')::bigint <> first_read_revision THEN
    RAISE EXCEPTION 'MOB10_READ_REVISION_REGRESSED_OR_ADVANCED_ON_SAME_MESSAGE:%', older_read;
  END IF;

  SELECT count(*) INTO command_count_after
  FROM platform.mobile_teacher_conversation_command
  WHERE tenant_id = v_tenant_id
    AND account_id = v_teacher_account_id;
  IF command_count_after <> command_count_before + 2 THEN
    RAISE EXCEPTION 'MOB10_EXPLICIT_READ_COMMAND_EVIDENCE_INVALID: before=% after=%',
      command_count_before, command_count_after;
  END IF;

  UPDATE student_lifecycle.enrollment
  SET status = 'transferred'
  WHERE tenant_id = v_tenant_id
    AND enrollment_id = v_enrollment_id;

  replay_after_enrollment_revoke := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'Please review the assignment update.',
    'teacher-send-idempotency-0001'
  );
  IF replay_after_enrollment_revoke IS NOT NULL THEN
    RAISE EXCEPTION 'MOB10_REPLAY_BYPASSED_ENROLLMENT_REVOCATION:%', replay_after_enrollment_revoke;
  END IF;

  UPDATE student_lifecycle.enrollment
  SET status = 'active'
  WHERE tenant_id = v_tenant_id
    AND enrollment_id = v_enrollment_id;

  UPDATE integration_core.conversation_participant
  SET left_at = clock_timestamp()
  WHERE tenant_id = v_tenant_id
    AND conversation_id = v_conversation_id
    AND person_id = v_teacher_person_id;

  replay_after_leave := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    v_tenant_id,
    v_campus_id,
    v_conversation_id,
    'Please review the assignment update.',
    'teacher-send-idempotency-0001'
  );
  IF replay_after_leave IS NOT NULL THEN
    RAISE EXCEPTION 'MOB10_REPLAY_BYPASSED_PARTICIPANT_LEAVE:%', replay_after_leave;
  END IF;

  IF has_function_privilege(
    'public',
    'platform.send_mobile_teacher_conversation_message(text,text,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'public',
    'platform.mark_mobile_teacher_conversation_read(text,text,uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB10_PUBLIC_WRITE_FUNCTION_EXPOSED';
  END IF;

  IF NOT has_function_privilege(
    'app_runtime',
    'platform.send_mobile_teacher_conversation_message(text,text,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'app_runtime',
    'platform.mark_mobile_teacher_conversation_read(text,text,uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB10_APP_RUNTIME_WRITE_FUNCTION_NOT_EXECUTABLE';
  END IF;

  IF has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_teacher_read_authority(text,text,uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'MOB10_INTERNAL_AUTHORITY_HELPER_EXPOSED';
  END IF;

  IF has_table_privilege('app_runtime', 'platform.mobile_teacher_conversation_command', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_teacher_conversation_command', 'INSERT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_message', 'INSERT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_participant', 'UPDATE') THEN
    RAISE EXCEPTION 'MOB10_DIRECT_CONVERSATION_WRITE_ACCESS_EXPOSED';
  END IF;
END
$mob10_verify$;

BEGIN;
SET LOCAL ROLE app_runtime;
DO $runtime$
DECLARE
  denied jsonb;
BEGIN
  denied := platform.send_mobile_teacher_conversation_message(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000910',
    'Participant already left.',
    'teacher-runtime-idempotency-0001'
  );
  IF denied IS NOT NULL THEN
    RAISE EXCEPTION 'MOB10_APP_RUNTIME_AUTHORITY_BYPASS:%', denied;
  END IF;
END
$runtime$;
ROLLBACK;
