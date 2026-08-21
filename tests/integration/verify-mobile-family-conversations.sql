INSERT INTO people.person (tenant_id, person_id, status)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000800',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000830',
    'active'
  );

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '40000000-0000-4000-8000-000000000840',
  'https://identity.school.test',
  'provider-mobile-student-1',
  'student-mobile@example.test',
  'aal1'
);

INSERT INTO iam.role (tenant_id, role_id, role_key, display_name, system_role)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000841',
  'student',
  'Student',
  true
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000842',
  '40000000-0000-4000-8000-000000000840',
  '40000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id, tenant_id,
  membership_id, campus_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000843',
  'https://identity.school.test',
  'provider-mobile-student-1',
  '40000000-0000-4000-8000-000000000840',
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000842',
  '40000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000843',
  '40000000-0000-4000-8000-000000000841'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000841',
    'messages.read'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000841',
    'messages.send'
  );

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000840',
  '40000000-0000-4000-8000-000000000010'
);

INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000831',
  '40000000-0000-4000-8000-000000000830',
  'active'
);

INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000832',
  '40000000-0000-4000-8000-000000000831',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000015',
  '40000000-0000-4000-8000-000000000016',
  'active', current_date - 10, 'mobile-family-conversation-alt-student'
);

INSERT INTO integration_core.conversation_thread (
  tenant_id, conversation_id, student_profile_id, subject, status, version, created_at, last_message_at
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000013',
    'Class updates',
    'open',
    2,
    '2026-08-21T12:00:00.000Z'::timestamptz,
    '2026-08-21T12:35:00.000Z'::timestamptz
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000811',
    '40000000-0000-4000-8000-000000000013',
    'Archived notice',
    'locked',
    1,
    '2026-08-21T11:00:00.000Z'::timestamptz,
    '2026-08-21T12:20:00.000Z'::timestamptz
  );

INSERT INTO integration_core.conversation_participant (
  tenant_id, conversation_id, person_id, participant_kind, display_label,
  can_reply, joined_at, last_read_at, last_read_message_id, read_revision
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000009',
    'guardian', 'Guardian Tester', true,
    '2026-08-21T11:50:00.000Z'::timestamptz,
    NULL,
    NULL,
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000800',
    'staff', 'Teacher One', true,
    '2026-08-21T11:50:00.000Z'::timestamptz,
    NULL,
    NULL,
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000010',
    'student', 'Student Tester', true,
    '2026-08-21T11:50:00.000Z'::timestamptz,
    NULL,
    NULL,
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000811',
    '40000000-0000-4000-8000-000000000009',
    'guardian', 'Guardian Tester', false,
    '2026-08-21T10:50:00.000Z'::timestamptz,
    NULL,
    NULL,
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000811',
    '40000000-0000-4000-8000-000000000800',
    'staff', 'Teacher One', true,
    '2026-08-21T10:50:00.000Z'::timestamptz,
    NULL,
    NULL,
    1
  );

INSERT INTO integration_core.conversation_message (
  tenant_id, conversation_id, message_id, author_person_id, author_label, body, sent_at
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000819',
    '40000000-0000-4000-8000-000000000800',
    'Teacher One', 'Historical message before this participant joined.',
    '2026-08-21T11:40:00.000Z'::timestamptz
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000820',
    '40000000-0000-4000-8000-000000000800',
    'Teacher One', 'Welcome to the class thread.',
    '2026-08-21T12:30:00.000Z'::timestamptz
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000821',
    '40000000-0000-4000-8000-000000000009',
    'Guardian Tester', 'Thank you.',
    '2026-08-21T12:31:00.000Z'::timestamptz
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000822',
    '40000000-0000-4000-8000-000000000800',
    'Teacher One', 'Please bring the signed form.',
    '2026-08-21T12:35:00.000Z'::timestamptz
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000811',
    '40000000-0000-4000-8000-000000000823',
    '40000000-0000-4000-8000-000000000800',
    'Teacher One', 'This thread is now read-only.',
    '2026-08-21T12:20:00.000Z'::timestamptz
  );

UPDATE integration_core.conversation_participant
SET last_read_at = '2026-08-21T12:30:00.000Z'::timestamptz,
    last_read_message_id = '40000000-0000-4000-8000-000000000820'
WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
  AND conversation_id = '40000000-0000-4000-8000-000000000810'
  AND person_id = '40000000-0000-4000-8000-000000000009';

DO $mob06c_verify$
DECLARE
  first_page jsonb;
  second_page jsonb;
  first_cursor text;
  messages_page jsonb;
  older_messages jsonb;
  messages_cursor text;
  read_result jsonb;
  read_retry jsonb;
  read_conflict jsonb;
  prejoin_read jsonb;
  same_timestamp_read jsonb;
  sent_result jsonb;
  sent_retry jsonb;
  send_conflict jsonb;
  locked_result jsonb;
  student_page jsonb;
  student_messages jsonb;
  student_sent jsonb;
  privacy_page jsonb;
  sent_message_id uuid;
  last_read_before timestamptz;
  last_read_message_before uuid;
  message_count_before integer;
BEGIN
  SELECT last_read_at, last_read_message_id
  INTO last_read_before, last_read_message_before
  FROM integration_core.conversation_participant
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND conversation_id = '40000000-0000-4000-8000-000000000810'
    AND person_id = '40000000-0000-4000-8000-000000000009';

  first_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013',
    NULL,
    1
  );

  IF first_page IS NULL
     OR jsonb_array_length(first_page->'conversations') <> 1
     OR first_page->'conversations'->0->>'conversationId' <> '40000000-0000-4000-8000-000000000810'
     OR (first_page->'conversations'->0->>'unreadCount')::integer <> 1
     OR first_page->>'nextCursor' IS NULL THEN
    RAISE EXCEPTION 'MOB-06C first conversation page invalid: %', first_page;
  END IF;
  first_cursor := first_page->>'nextCursor';

  IF platform.resolve_mobile_family_conversations(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013',
    '20260821123456789.AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    1
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06C accepted a noncanonical uppercase cursor';
  END IF;

  second_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013',
    first_cursor,
    1
  );
  IF second_page->'conversations'->0->>'conversationId' <> '40000000-0000-4000-8000-000000000811'
     OR second_page->>'nextCursor' IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06C second conversation page invalid: %', second_page;
  END IF;

  messages_page := platform.resolve_mobile_family_conversation_messages(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000810',
    NULL,
    2
  );
  IF messages_page IS NULL
     OR messages_page->>'conversationId' <> '40000000-0000-4000-8000-000000000810'
     OR jsonb_array_length(messages_page->'messages') <> 2
     OR messages_page->'messages'->0->>'messageId' <> '40000000-0000-4000-8000-000000000822'
     OR messages_page->'messages'->1->>'messageId' <> '40000000-0000-4000-8000-000000000821'
     OR messages_page->>'nextCursor' IS NULL THEN
    RAISE EXCEPTION 'MOB-06C first message page invalid: %', messages_page;
  END IF;
  messages_cursor := messages_page->>'nextCursor';

  older_messages := platform.resolve_mobile_family_conversation_messages(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000810',
    messages_cursor,
    2
  );
  IF jsonb_array_length(older_messages->'messages') <> 1
     OR older_messages->'messages'->0->>'messageId' <> '40000000-0000-4000-8000-000000000820'
     OR older_messages->>'nextCursor' IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06C older message page invalid: %', older_messages;
  END IF;

  IF (SELECT last_read_at
      FROM integration_core.conversation_participant
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND conversation_id = '40000000-0000-4000-8000-000000000810'
        AND person_id = '40000000-0000-4000-8000-000000000009') IS DISTINCT FROM last_read_before
     OR (SELECT last_read_message_id
         FROM integration_core.conversation_participant
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND conversation_id = '40000000-0000-4000-8000-000000000810'
           AND person_id = '40000000-0000-4000-8000-000000000009') IS DISTINCT FROM last_read_message_before THEN
    RAISE EXCEPTION 'MOB-06C GET message listing mutated read state';
  END IF;

  prejoin_read := platform.mark_mobile_family_conversation_read(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000819',
    'family-conversation-read-db-prejoin-0001'
  );
  IF prejoin_read <> jsonb_build_object('status', 'message-not-found') THEN
    RAISE EXCEPTION 'MOB-06C pre-join message was readable by a later participant: %', prejoin_read;
  END IF;

  read_result := platform.mark_mobile_family_conversation_read(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000822',
    'family-conversation-read-db-0001'
  );
  IF read_result <> jsonb_build_object('acceptedRevision', 2) THEN
    RAISE EXCEPTION 'MOB-06C read receipt did not advance revision: %', read_result;
  END IF;

  IF (SELECT last_read_at
      FROM integration_core.conversation_participant
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND conversation_id = '40000000-0000-4000-8000-000000000810'
        AND person_id = '40000000-0000-4000-8000-000000000009')
     <> '2026-08-21T12:35:00.000Z'::timestamptz
     OR (SELECT last_read_message_id
         FROM integration_core.conversation_participant
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND conversation_id = '40000000-0000-4000-8000-000000000810'
           AND person_id = '40000000-0000-4000-8000-000000000009')
        <> '40000000-0000-4000-8000-000000000822'::uuid THEN
    RAISE EXCEPTION 'MOB-06C explicit read receipt did not persist the exact target cursor';
  END IF;

  first_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000013', NULL, 10
  );
  IF (SELECT (value->>'unreadCount')::integer
      FROM jsonb_array_elements(first_page->'conversations') AS item(value)
      WHERE value->>'conversationId' = '40000000-0000-4000-8000-000000000810') <> 0 THEN
    RAISE EXCEPTION 'MOB-06C unread count did not clear after explicit read receipt';
  END IF;

  read_retry := platform.mark_mobile_family_conversation_read(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000822',
    'family-conversation-read-db-0001'
  );
  IF read_retry <> read_result
     OR (SELECT read_revision
         FROM integration_core.conversation_participant
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND conversation_id = '40000000-0000-4000-8000-000000000810'
           AND person_id = '40000000-0000-4000-8000-000000000009') <> 2 THEN
    RAISE EXCEPTION 'MOB-06C exact read replay was not stable';
  END IF;

  read_conflict := platform.mark_mobile_family_conversation_read(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000820',
    'family-conversation-read-db-0001'
  );
  IF read_conflict <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB-06C changed read idempotency reuse did not conflict';
  END IF;

  INSERT INTO integration_core.conversation_message (
    tenant_id, conversation_id, message_id, author_person_id, author_label, body, sent_at
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000824',
    '40000000-0000-4000-8000-000000000800',
    'Teacher One', 'Same-timestamp follow-up.',
    '2026-08-21T12:35:00.000Z'::timestamptz
  );

  first_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000013', NULL, 10
  );
  IF (SELECT (value->>'unreadCount')::integer
      FROM jsonb_array_elements(first_page->'conversations') AS item(value)
      WHERE value->>'conversationId' = '40000000-0000-4000-8000-000000000810') <> 1 THEN
    RAISE EXCEPTION 'MOB-06C same-timestamp message was incorrectly treated as read';
  END IF;

  same_timestamp_read := platform.mark_mobile_family_conversation_read(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    '40000000-0000-4000-8000-000000000824',
    'family-conversation-read-db-0003'
  );
  IF same_timestamp_read <> jsonb_build_object('acceptedRevision', 3) THEN
    RAISE EXCEPTION 'MOB-06C same-timestamp read cursor did not advance: %', same_timestamp_read;
  END IF;

  first_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000013', NULL, 10
  );
  IF (SELECT (value->>'unreadCount')::integer
      FROM jsonb_array_elements(first_page->'conversations') AS item(value)
      WHERE value->>'conversationId' = '40000000-0000-4000-8000-000000000810') <> 0 THEN
    RAISE EXCEPTION 'MOB-06C same-timestamp read cursor did not clear the exact next message';
  END IF;

  SELECT count(*) INTO message_count_before
  FROM integration_core.conversation_message
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND conversation_id = '40000000-0000-4000-8000-000000000810';

  sent_result := platform.send_mobile_family_conversation_message(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    'A new guardian reply.',
    'family-conversation-send-db-0001'
  );
  IF sent_result IS NULL
     OR sent_result->>'authorLabel' <> 'Guardian Tester'
     OR sent_result->>'body' <> 'A new guardian reply.' THEN
    RAISE EXCEPTION 'MOB-06C authorized send failed: %', sent_result;
  END IF;
  sent_message_id := (sent_result->>'messageId')::uuid;

  IF (SELECT count(*)
      FROM integration_core.conversation_message
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND conversation_id = '40000000-0000-4000-8000-000000000810') <> message_count_before + 1
     OR (SELECT version
         FROM integration_core.conversation_thread
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND conversation_id = '40000000-0000-4000-8000-000000000810') <> 3 THEN
    RAISE EXCEPTION 'MOB-06C send did not append exactly one message/revision';
  END IF;

  sent_retry := platform.send_mobile_family_conversation_message(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    'A new guardian reply.',
    'family-conversation-send-db-0001'
  );
  IF sent_retry <> sent_result
     OR (SELECT count(*)
         FROM integration_core.conversation_message
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND conversation_id = '40000000-0000-4000-8000-000000000810') <> message_count_before + 1 THEN
    RAISE EXCEPTION 'MOB-06C exact send replay duplicated or changed the message';
  END IF;

  send_conflict := platform.send_mobile_family_conversation_message(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    'Changed body.',
    'family-conversation-send-db-0001'
  );
  IF send_conflict <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB-06C changed send idempotency reuse did not conflict';
  END IF;

  locked_result := platform.send_mobile_family_conversation_message(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000811',
    'This must not be appended.',
    'family-conversation-send-db-0002'
  );
  IF locked_result <> jsonb_build_object('status', 'locked') THEN
    RAISE EXCEPTION 'MOB-06C locked conversation accepted a send: %', locked_result;
  END IF;

  UPDATE people.guardian_student_authority
  SET portal_access = false
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  IF platform.send_mobile_family_conversation_message(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810',
    'A new guardian reply.',
    'family-conversation-send-db-0001'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06C stored send receipt bypassed current guardian authority revocation';
  END IF;

  IF platform.resolve_mobile_family_conversation_messages(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000810', NULL, 50
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06C revoked guardian still read conversation messages';
  END IF;

  UPDATE people.guardian_student_authority
  SET portal_access = true
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  student_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test', 'provider-mobile-student-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'student',
    '40000000-0000-4000-8000-000000000013', NULL, 25
  );
  IF student_page IS NULL
     OR jsonb_array_length(student_page->'conversations') <> 1
     OR student_page->'conversations'->0->>'conversationId' <> '40000000-0000-4000-8000-000000000810' THEN
    RAISE EXCEPTION 'MOB-06C student persona could not resolve its authorized conversation: %', student_page;
  END IF;

  student_messages := platform.resolve_mobile_family_conversation_messages(
    'https://identity.school.test', 'provider-mobile-student-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'student',
    '40000000-0000-4000-8000-000000000810', NULL, 50
  );
  IF student_messages IS NULL
     OR jsonb_array_length(student_messages->'messages') < 1 THEN
    RAISE EXCEPTION 'MOB-06C student persona could not read its authorized messages: %', student_messages;
  END IF;

  student_sent := platform.send_mobile_family_conversation_message(
    'https://identity.school.test', 'provider-mobile-student-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'student',
    '40000000-0000-4000-8000-000000000810',
    'Student reply.',
    'family-conversation-student-send-db-0001'
  );
  IF student_sent IS NULL
     OR student_sent->>'authorLabel' <> 'Student Tester'
     OR student_sent->>'body' <> 'Student reply.' THEN
    RAISE EXCEPTION 'MOB-06C student persona could not send to its authorized conversation: %', student_sent;
  END IF;

  INSERT INTO integration_core.conversation_thread (
    tenant_id, conversation_id, student_profile_id, subject, status, version, created_at, last_message_at
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000850',
    '40000000-0000-4000-8000-000000000013',
    'Late join privacy', 'open', 1,
    '2026-08-21T11:00:00.000Z'::timestamptz,
    '2026-08-21T11:40:00.000Z'::timestamptz
  );
  INSERT INTO integration_core.conversation_participant (
    tenant_id, conversation_id, person_id, participant_kind, display_label,
    can_reply, joined_at, last_read_at, last_read_message_id, read_revision
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000850',
    '40000000-0000-4000-8000-000000000009',
    'guardian', 'Guardian Tester', true,
    '2026-08-21T11:50:00.000Z'::timestamptz,
    NULL, NULL, 1
  );
  INSERT INTO integration_core.conversation_message (
    tenant_id, conversation_id, message_id, author_person_id, author_label, body, sent_at
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000850',
    '40000000-0000-4000-8000-000000000851',
    '40000000-0000-4000-8000-000000000800',
    'Teacher One', 'Hidden before guardian joined.',
    '2026-08-21T11:40:00.000Z'::timestamptz
  );

  privacy_page := platform.resolve_mobile_family_conversations(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000013', NULL, 25
  );
  IF (SELECT value->>'latestMessageAt'
      FROM jsonb_array_elements(privacy_page->'conversations') AS item(value)
      WHERE value->>'conversationId' = '40000000-0000-4000-8000-000000000850')
        <> '2026-08-21T11:50:00.000Z'
     OR (SELECT (value->>'unreadCount')::integer
         FROM jsonb_array_elements(privacy_page->'conversations') AS item(value)
         WHERE value->>'conversationId' = '40000000-0000-4000-8000-000000000850') <> 0 THEN
    RAISE EXCEPTION 'MOB-06C conversation summary leaked pre-join history: %', privacy_page;
  END IF;

  messages_page := platform.resolve_mobile_family_conversation_messages(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000850', NULL, 50
  );
  IF messages_page IS NULL OR jsonb_array_length(messages_page->'messages') <> 0 THEN
    RAISE EXCEPTION 'MOB-06C message listing leaked pre-join history: %', messages_page;
  END IF;

  BEGIN
    DELETE FROM integration_core.conversation_participant
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND conversation_id = '40000000-0000-4000-8000-000000000850'
      AND person_id = '40000000-0000-4000-8000-000000000009';
    RAISE EXCEPTION 'MOB-06C allowed participant history deletion';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  UPDATE integration_core.conversation_participant
  SET left_at = '2026-08-21T12:00:00.000Z'::timestamptz
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND conversation_id = '40000000-0000-4000-8000-000000000850'
    AND person_id = '40000000-0000-4000-8000-000000000009';
  BEGIN
    UPDATE integration_core.conversation_participant
    SET left_at = NULL
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND conversation_id = '40000000-0000-4000-8000-000000000850'
      AND person_id = '40000000-0000-4000-8000-000000000009';
    RAISE EXCEPTION 'MOB-06C allowed participant leave evidence reopening';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE integration_core.conversation_message
    SET body = 'tampered'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND conversation_id = '40000000-0000-4000-8000-000000000810'
      AND message_id = sent_message_id;
    RAISE EXCEPTION 'MOB-06C allowed historical message mutation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE integration_core.conversation_thread
    SET student_profile_id = '40000000-0000-4000-8000-000000000831'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND conversation_id = '40000000-0000-4000-8000-000000000810';
    RAISE EXCEPTION 'MOB-06C allowed conversation student-scope reassignment';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE integration_core.conversation_participant
    SET participant_kind = 'student'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND conversation_id = '40000000-0000-4000-8000-000000000810'
      AND person_id = '40000000-0000-4000-8000-000000000009';
    RAISE EXCEPTION 'MOB-06C allowed participant identity-kind mutation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE integration_core.conversation_participant
    SET read_revision = 1,
        last_read_at = '2026-08-21T12:30:00.000Z'::timestamptz,
        last_read_message_id = '40000000-0000-4000-8000-000000000820'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND conversation_id = '40000000-0000-4000-8000-000000000810'
      AND person_id = '40000000-0000-4000-8000-000000000009';
    RAISE EXCEPTION 'MOB-06C allowed read evidence regression';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF has_function_privilege('public', 'platform.resolve_mobile_family_conversations(text,text,uuid,uuid,text,uuid,text,integer)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.resolve_mobile_family_conversation_messages(text,text,uuid,uuid,text,uuid,text,integer)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.send_mobile_family_conversation_message(text,text,uuid,uuid,text,uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.mark_mobile_family_conversation_read(text,text,uuid,uuid,text,uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC received MOB-06C API function authority';
  END IF;

  IF NOT has_function_privilege('app_runtime', 'platform.resolve_mobile_family_conversations(text,text,uuid,uuid,text,uuid,text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.resolve_mobile_family_conversation_messages(text,text,uuid,uuid,text,uuid,text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.send_mobile_family_conversation_message(text,text,uuid,uuid,text,uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.mark_mobile_family_conversation_read(text,text,uuid,uuid,text,uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime is missing MOB-06C API function authority';
  END IF;

  IF has_function_privilege('app_runtime', 'platform.mobile_family_conversation_cursor(timestamptz,uuid)', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'platform.resolve_mobile_family_conversation_identity_authority(text,text,uuid,uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'platform.mobile_family_conversation_is_authorized(uuid,uuid,text,uuid,uuid,date)', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'integration_core.prevent_conversation_message_mutation()', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'integration_core.enforce_conversation_thread_scope()', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'integration_core.enforce_conversation_participant_state()', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime received MOB-06C internal helper authority';
  END IF;

  IF has_table_privilege('app_runtime', 'integration_core.conversation_thread', 'SELECT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_participant', 'SELECT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_message', 'SELECT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_message', 'INSERT')
     OR has_table_privilege('app_runtime', 'integration_core.conversation_participant', 'UPDATE')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_conversation_command', 'SELECT') THEN
    RAISE EXCEPTION 'app_runtime received direct MOB-06C table authority';
  END IF;
END
$mob06c_verify$;
