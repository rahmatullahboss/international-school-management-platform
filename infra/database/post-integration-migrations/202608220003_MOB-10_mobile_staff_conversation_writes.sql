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
  active_staff_count bigint;
BEGIN
  IF p_required_capability NOT IN ('grades.write', 'messages.read', 'messages.send') THEN
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

  SELECT count(*), min(staff.staff_id::text)::uuid
  INTO active_staff_count, selected_staff_id
  FROM hr.staff_profile AS staff
  WHERE staff.tenant_id = p_tenant_id
    AND staff.campus_id = p_campus_id
    AND staff.person_ref = selected_person_id::text
    AND staff.employment_status = 'active';

  IF active_staff_count <> 1 OR selected_staff_id IS NULL THEN
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

CREATE TABLE IF NOT EXISTS platform.mobile_teacher_conversation_command (
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  command_kind text NOT NULL CHECK (command_kind IN ('send', 'read')),
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  accepted_revision bigint NOT NULL CHECK (accepted_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES iam.account (account_id),
  FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES integration_core.conversation_thread (tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, conversation_id, message_id)
    REFERENCES integration_core.conversation_message (tenant_id, conversation_id, message_id)
);

REVOKE ALL ON TABLE platform.mobile_teacher_conversation_command FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_teacher_conversation_command FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.send_mobile_teacher_conversation_message(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_conversation_id uuid,
  p_body text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_staff_id uuid;
  selected_local_date date;
  selected_student_profile_id uuid;
  selected_status text;
  selected_version bigint;
  selected_display_label text;
  selected_can_reply boolean;
  previous_command platform.mobile_teacher_conversation_command%ROWTYPE;
  request_digest text;
  new_message_id uuid;
  accepted_revision bigint;
  selected_now timestamptz := clock_timestamp();
BEGIN
  IF p_conversation_id IS NULL
     OR p_body IS NULL
     OR p_body <> btrim(p_body)
     OR btrim(p_body) = ''
     OR char_length(p_body) > 4000
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.person_id, authority.staff_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_staff_id, selected_local_date
  FROM platform.resolve_mobile_teacher_read_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    'messages.send'
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_staff_id IS NULL
     OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-teacher-conversation:' || selected_account_id::text || ':' || p_idempotency_key,
      0
    )
  );

  SELECT
    thread.student_profile_id,
    thread.status,
    thread.version,
    participant.display_label,
    participant.can_reply
  INTO
    selected_student_profile_id,
    selected_status,
    selected_version,
    selected_display_label,
    selected_can_reply
  FROM integration_core.conversation_thread AS thread
  JOIN integration_core.conversation_participant AS participant
    ON participant.tenant_id = thread.tenant_id
   AND participant.conversation_id = thread.conversation_id
   AND participant.person_id = selected_viewer_person_id
   AND participant.participant_kind = 'staff'
   AND participant.joined_at <= selected_now
   AND (participant.left_at IS NULL OR participant.left_at > selected_now)
  WHERE thread.tenant_id = p_tenant_id
    AND thread.conversation_id = p_conversation_id
  FOR UPDATE OF thread, participant;

  IF selected_student_profile_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM student_lifecycle.student_profile AS student
       JOIN student_lifecycle.enrollment AS enrollment
         ON enrollment.tenant_id = student.tenant_id
        AND enrollment.student_profile_id = student.student_profile_id
        AND enrollment.campus_id = p_campus_id
        AND enrollment.status = 'active'
        AND enrollment.effective_from <= selected_local_date
        AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date)
       WHERE student.tenant_id = p_tenant_id
         AND student.student_profile_id = selected_student_profile_id
         AND student.status = 'active'
     ) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          'teacher-send',
          p_tenant_id::text,
          p_campus_id::text,
          p_conversation_id::text,
          p_body
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT command.*
  INTO previous_command
  FROM platform.mobile_teacher_conversation_command AS command
  WHERE command.tenant_id = p_tenant_id
    AND command.account_id = selected_account_id
    AND command.idempotency_key = p_idempotency_key;

  IF previous_command.idempotency_key IS NOT NULL THEN
    IF previous_command.command_kind <> 'send' OR previous_command.request_digest <> request_digest THEN
      RETURN jsonb_build_object('status', 'idempotency-conflict');
    END IF;
    RETURN (
      SELECT jsonb_build_object(
        'messageId', message.message_id,
        'authorLabel', message.author_label,
        'body', message.body,
        'sentAt', to_char(message.sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      FROM integration_core.conversation_message AS message
      WHERE message.tenant_id = p_tenant_id
        AND message.conversation_id = p_conversation_id
        AND message.message_id = previous_command.message_id
    );
  END IF;

  IF selected_status <> 'open' OR NOT selected_can_reply THEN
    RETURN jsonb_build_object('status', 'locked');
  END IF;

  new_message_id := gen_random_uuid();
  accepted_revision := selected_version + 1;

  INSERT INTO integration_core.conversation_message (
    tenant_id,
    conversation_id,
    message_id,
    author_person_id,
    author_label,
    body,
    sent_at
  ) VALUES (
    p_tenant_id,
    p_conversation_id,
    new_message_id,
    selected_viewer_person_id,
    selected_display_label,
    p_body,
    selected_now
  );

  UPDATE integration_core.conversation_thread
  SET version = accepted_revision,
      last_message_at = selected_now
  WHERE tenant_id = p_tenant_id
    AND conversation_id = p_conversation_id;

  INSERT INTO platform.mobile_teacher_conversation_command (
    tenant_id,
    account_id,
    idempotency_key,
    command_kind,
    conversation_id,
    message_id,
    request_digest,
    accepted_revision
  ) VALUES (
    p_tenant_id,
    selected_account_id,
    p_idempotency_key,
    'send',
    p_conversation_id,
    new_message_id,
    request_digest,
    accepted_revision
  );

  RETURN jsonb_build_object(
    'messageId', new_message_id,
    'authorLabel', selected_display_label,
    'body', p_body,
    'sentAt', to_char(selected_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END
$function$;

REVOKE ALL ON FUNCTION platform.send_mobile_teacher_conversation_message(
  text, text, uuid, uuid, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.send_mobile_teacher_conversation_message(
  text, text, uuid, uuid, uuid, text, text
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.mark_mobile_teacher_conversation_read(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_staff_id uuid;
  selected_local_date date;
  selected_student_profile_id uuid;
  selected_joined_at timestamptz;
  selected_last_read_at timestamptz;
  selected_last_read_message_id uuid;
  selected_read_revision bigint;
  selected_message_sent_at timestamptz;
  previous_command platform.mobile_teacher_conversation_command%ROWTYPE;
  request_digest text;
  accepted_revision bigint;
  selected_now timestamptz := clock_timestamp();
BEGIN
  IF p_conversation_id IS NULL
     OR p_message_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.person_id, authority.staff_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_staff_id, selected_local_date
  FROM platform.resolve_mobile_teacher_read_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    'messages.read'
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_staff_id IS NULL
     OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-teacher-conversation:' || selected_account_id::text || ':' || p_idempotency_key,
      0
    )
  );

  SELECT
    thread.student_profile_id,
    participant.joined_at,
    participant.last_read_at,
    participant.last_read_message_id,
    participant.read_revision
  INTO
    selected_student_profile_id,
    selected_joined_at,
    selected_last_read_at,
    selected_last_read_message_id,
    selected_read_revision
  FROM integration_core.conversation_thread AS thread
  JOIN integration_core.conversation_participant AS participant
    ON participant.tenant_id = thread.tenant_id
   AND participant.conversation_id = thread.conversation_id
   AND participant.person_id = selected_viewer_person_id
   AND participant.participant_kind = 'staff'
   AND participant.joined_at <= selected_now
   AND (participant.left_at IS NULL OR participant.left_at > selected_now)
  WHERE thread.tenant_id = p_tenant_id
    AND thread.conversation_id = p_conversation_id
  FOR UPDATE OF participant;

  IF selected_student_profile_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM student_lifecycle.student_profile AS student
       JOIN student_lifecycle.enrollment AS enrollment
         ON enrollment.tenant_id = student.tenant_id
        AND enrollment.student_profile_id = student.student_profile_id
        AND enrollment.campus_id = p_campus_id
        AND enrollment.status = 'active'
        AND enrollment.effective_from <= selected_local_date
        AND (enrollment.effective_to IS NULL OR enrollment.effective_to >= selected_local_date)
       WHERE student.tenant_id = p_tenant_id
         AND student.student_profile_id = selected_student_profile_id
         AND student.status = 'active'
     ) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          'teacher-read',
          p_tenant_id::text,
          p_campus_id::text,
          p_conversation_id::text,
          p_message_id::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT command.*
  INTO previous_command
  FROM platform.mobile_teacher_conversation_command AS command
  WHERE command.tenant_id = p_tenant_id
    AND command.account_id = selected_account_id
    AND command.idempotency_key = p_idempotency_key;

  IF previous_command.idempotency_key IS NOT NULL THEN
    IF previous_command.command_kind <> 'read' OR previous_command.request_digest <> request_digest THEN
      RETURN jsonb_build_object('status', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object('acceptedRevision', previous_command.accepted_revision);
  END IF;

  SELECT message.sent_at
  INTO selected_message_sent_at
  FROM integration_core.conversation_message AS message
  WHERE message.tenant_id = p_tenant_id
    AND message.conversation_id = p_conversation_id
    AND message.message_id = p_message_id
    AND message.sent_at >= selected_joined_at;

  IF selected_message_sent_at IS NULL THEN
    RETURN jsonb_build_object('status', 'message-not-found');
  END IF;

  accepted_revision := selected_read_revision;
  IF selected_last_read_at IS NULL
     OR (selected_message_sent_at, p_message_id) > (selected_last_read_at, selected_last_read_message_id) THEN
    accepted_revision := selected_read_revision + 1;
    UPDATE integration_core.conversation_participant
    SET last_read_at = selected_message_sent_at,
        last_read_message_id = p_message_id,
        read_revision = accepted_revision
    WHERE tenant_id = p_tenant_id
      AND conversation_id = p_conversation_id
      AND person_id = selected_viewer_person_id;
  END IF;

  INSERT INTO platform.mobile_teacher_conversation_command (
    tenant_id,
    account_id,
    idempotency_key,
    command_kind,
    conversation_id,
    message_id,
    request_digest,
    accepted_revision
  ) VALUES (
    p_tenant_id,
    selected_account_id,
    p_idempotency_key,
    'read',
    p_conversation_id,
    p_message_id,
    request_digest,
    accepted_revision
  );

  RETURN jsonb_build_object('acceptedRevision', accepted_revision);
END
$function$;

REVOKE ALL ON FUNCTION platform.mark_mobile_teacher_conversation_read(
  text, text, uuid, uuid, uuid, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.mark_mobile_teacher_conversation_read(
  text, text, uuid, uuid, uuid, uuid, text
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608220003_MOB-10_mobile_staff_conversation_writes',
  'MOB-10',
  'Add idempotent authoritative Teacher conversation sends and explicit read receipts on the shared ledger'
)
ON CONFLICT (migration_id) DO NOTHING;
