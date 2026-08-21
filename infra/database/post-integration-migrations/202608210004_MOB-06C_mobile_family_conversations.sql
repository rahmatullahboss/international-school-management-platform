CREATE TABLE IF NOT EXISTS integration_core.conversation_thread (
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL,
  subject text NOT NULL CHECK (btrim(subject) <> '' AND subject = btrim(subject) AND char_length(subject) <= 512),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  PRIMARY KEY (tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, student_profile_id)
    REFERENCES student_lifecycle.student_profile (tenant_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS conversation_thread_student_idx
  ON integration_core.conversation_thread (
    tenant_id,
    student_profile_id,
    last_message_at DESC,
    conversation_id DESC
  );

CREATE TABLE IF NOT EXISTS integration_core.conversation_participant (
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  person_id uuid NOT NULL,
  participant_kind text NOT NULL CHECK (participant_kind IN ('guardian', 'student', 'staff')),
  display_label text NOT NULL CHECK (
    btrim(display_label) <> ''
    AND display_label = btrim(display_label)
    AND char_length(display_label) <= 512
  ),
  can_reply boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  last_read_at timestamptz,
  last_read_message_id uuid,
  read_revision bigint NOT NULL DEFAULT 1 CHECK (read_revision > 0),
  PRIMARY KEY (tenant_id, conversation_id, person_id),
  FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES integration_core.conversation_thread (tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, person_id)
    REFERENCES people.person (tenant_id, person_id),
  CHECK (left_at IS NULL OR left_at >= joined_at),
  CHECK (last_read_at IS NULL OR last_read_at >= joined_at),
  CHECK ((last_read_at IS NULL) = (last_read_message_id IS NULL))
);

CREATE INDEX IF NOT EXISTS conversation_participant_person_idx
  ON integration_core.conversation_participant (
    tenant_id,
    person_id,
    conversation_id
  );

CREATE TABLE IF NOT EXISTS integration_core.conversation_message (
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_person_id uuid NOT NULL,
  author_label text NOT NULL CHECK (
    btrim(author_label) <> ''
    AND author_label = btrim(author_label)
    AND char_length(author_label) <= 512
  ),
  body text NOT NULL CHECK (
    btrim(body) <> ''
    AND body = btrim(body)
    AND char_length(body) <= 4000
  ),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, conversation_id, message_id),
  FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES integration_core.conversation_thread (tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, author_person_id)
    REFERENCES people.person (tenant_id, person_id)
);

CREATE INDEX IF NOT EXISTS conversation_message_page_idx
  ON integration_core.conversation_message (
    tenant_id,
    conversation_id,
    sent_at DESC,
    message_id DESC
  );

DO $conversation_read_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'conversation_participant_last_read_message_fk'
      AND conrelid = 'integration_core.conversation_participant'::regclass
  ) THEN
    ALTER TABLE integration_core.conversation_participant
      ADD CONSTRAINT conversation_participant_last_read_message_fk
      FOREIGN KEY (tenant_id, conversation_id, last_read_message_id)
      REFERENCES integration_core.conversation_message (tenant_id, conversation_id, message_id);
  END IF;
END
$conversation_read_fk$;

CREATE OR REPLACE FUNCTION integration_core.prevent_conversation_message_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'CONVERSATION_MESSAGE_APPEND_ONLY' USING ERRCODE = '23514';
END
$function$;

REVOKE ALL ON FUNCTION integration_core.prevent_conversation_message_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION integration_core.prevent_conversation_message_mutation() FROM app_runtime;

DROP TRIGGER IF EXISTS conversation_message_append_only ON integration_core.conversation_message;
CREATE TRIGGER conversation_message_append_only
BEFORE UPDATE OR DELETE ON integration_core.conversation_message
FOR EACH ROW EXECUTE FUNCTION integration_core.prevent_conversation_message_mutation();

CREATE OR REPLACE FUNCTION integration_core.enforce_conversation_thread_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id THEN
    RAISE EXCEPTION 'CONVERSATION_STUDENT_SCOPE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.version < OLD.version THEN
    RAISE EXCEPTION 'CONVERSATION_VERSION_REGRESSION' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.last_message_at IS NOT NULL
     AND NEW.last_message_at IS DISTINCT FROM OLD.last_message_at
     AND (NEW.last_message_at IS NULL OR NEW.last_message_at < OLD.last_message_at) THEN
    RAISE EXCEPTION 'CONVERSATION_LAST_MESSAGE_REGRESSION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION integration_core.enforce_conversation_thread_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION integration_core.enforce_conversation_thread_scope() FROM app_runtime;

DROP TRIGGER IF EXISTS conversation_thread_scope_guard ON integration_core.conversation_thread;
CREATE TRIGGER conversation_thread_scope_guard
BEFORE UPDATE ON integration_core.conversation_thread
FOR EACH ROW EXECUTE FUNCTION integration_core.enforce_conversation_thread_scope();

CREATE OR REPLACE FUNCTION integration_core.enforce_conversation_participant_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CONVERSATION_PARTICIPANT_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.participant_kind IS DISTINCT FROM OLD.participant_kind
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'CONVERSATION_PARTICIPANT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD.left_at IS NOT NULL AND NEW.left_at IS DISTINCT FROM OLD.left_at THEN
    RAISE EXCEPTION 'CONVERSATION_PARTICIPANT_LEAVE_EVIDENCE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.read_revision < OLD.read_revision THEN
    RAISE EXCEPTION 'CONVERSATION_READ_REVISION_REGRESSION' USING ERRCODE = '23514';
  END IF;
  IF OLD.last_read_at IS NOT NULL
     AND (
       NEW.last_read_at IS NULL
       OR NEW.last_read_message_id IS NULL
       OR (NEW.last_read_at, NEW.last_read_message_id) < (OLD.last_read_at, OLD.last_read_message_id)
     ) THEN
    RAISE EXCEPTION 'CONVERSATION_LAST_READ_REGRESSION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION integration_core.enforce_conversation_participant_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION integration_core.enforce_conversation_participant_state() FROM app_runtime;

DROP TRIGGER IF EXISTS conversation_participant_state_guard ON integration_core.conversation_participant;
CREATE TRIGGER conversation_participant_state_guard
BEFORE UPDATE OR DELETE ON integration_core.conversation_participant
FOR EACH ROW EXECUTE FUNCTION integration_core.enforce_conversation_participant_state();

CREATE TABLE IF NOT EXISTS platform.mobile_family_conversation_command (
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

REVOKE ALL ON TABLE integration_core.conversation_thread FROM PUBLIC;
REVOKE ALL ON TABLE integration_core.conversation_thread FROM app_runtime;
REVOKE ALL ON TABLE integration_core.conversation_participant FROM PUBLIC;
REVOKE ALL ON TABLE integration_core.conversation_participant FROM app_runtime;
REVOKE ALL ON TABLE integration_core.conversation_message FROM PUBLIC;
REVOKE ALL ON TABLE integration_core.conversation_message FROM app_runtime;
REVOKE ALL ON TABLE platform.mobile_family_conversation_command FROM PUBLIC;
REVOKE ALL ON TABLE platform.mobile_family_conversation_command FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_family_conversation_cursor(
  p_timestamp timestamptz,
  p_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT to_char(p_timestamp AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSMS') || '.' || p_id::text
$function$;

REVOKE ALL ON FUNCTION platform.mobile_family_conversation_cursor(timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_family_conversation_cursor(timestamptz, uuid) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_conversation_identity_authority(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_required_capability text
)
RETURNS TABLE (
  account_id uuid,
  viewer_person_id uuid,
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
  linked_person_count bigint;
BEGIN
  IF p_persona NOT IN ('guardian', 'student')
     OR p_required_capability NOT IN ('messages.read', 'messages.send') THEN
    RETURN;
  END IF;

  SELECT scope.account_id, scope.time_zone, scope.capabilities
  INTO selected_account_id, selected_time_zone, selected_capabilities
  FROM platform.resolve_mobile_request_scope(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona
  ) AS scope;

  IF selected_account_id IS NULL
     OR selected_time_zone IS NULL
     OR NOT (p_required_capability = ANY(coalesce(selected_capabilities, ARRAY[]::text[]))) THEN
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

  account_id := selected_account_id;
  viewer_person_id := selected_person_id;
  local_date := (clock_timestamp() AT TIME ZONE selected_time_zone)::date;
  RETURN NEXT;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_conversation_identity_authority(
  text, text, uuid, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.resolve_mobile_family_conversation_identity_authority(
  text, text, uuid, uuid, text, text
) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.mobile_family_conversation_is_authorized(
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_viewer_person_id uuid,
  p_conversation_id uuid,
  p_local_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM integration_core.conversation_thread AS thread
    JOIN integration_core.conversation_participant AS participant
      ON participant.tenant_id = thread.tenant_id
     AND participant.conversation_id = thread.conversation_id
     AND participant.person_id = p_viewer_person_id
     AND participant.joined_at <= clock_timestamp()
     AND (participant.left_at IS NULL OR participant.left_at > clock_timestamp())
    WHERE thread.tenant_id = p_tenant_id
      AND thread.conversation_id = p_conversation_id
      AND platform.mobile_family_student_is_authorized(
        p_tenant_id,
        p_campus_id,
        p_persona,
        p_viewer_person_id,
        thread.student_profile_id,
        p_local_date
      )
  )
$function$;

REVOKE ALL ON FUNCTION platform.mobile_family_conversation_is_authorized(
  uuid, uuid, text, uuid, uuid, date
) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.mobile_family_conversation_is_authorized(
  uuid, uuid, text, uuid, uuid, date
) FROM app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_conversations(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_student_profile_id uuid,
  p_cursor text,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  payload jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR (p_cursor IS NOT NULL AND p_cursor !~ '^[0-9]{17}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_conversation_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona,
    'messages.read'
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       p_persona,
       selected_viewer_person_id,
       p_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  WITH candidate AS (
    SELECT
      thread.conversation_id,
      thread.subject,
      coalesce(visible_message.sent_at, greatest(thread.created_at, participant.joined_at)) AS latest_message_at,
      participant.last_read_at,
      participant.last_read_message_id,
      participant.joined_at,
      platform.mobile_family_conversation_cursor(
        coalesce(visible_message.sent_at, greatest(thread.created_at, participant.joined_at)),
        thread.conversation_id
      ) AS page_cursor
    FROM integration_core.conversation_thread AS thread
    JOIN integration_core.conversation_participant AS participant
      ON participant.tenant_id = thread.tenant_id
     AND participant.conversation_id = thread.conversation_id
     AND participant.person_id = selected_viewer_person_id
     AND participant.joined_at <= clock_timestamp()
     AND (participant.left_at IS NULL OR participant.left_at > clock_timestamp())
    LEFT JOIN LATERAL (
      SELECT message.sent_at
      FROM integration_core.conversation_message AS message
      WHERE message.tenant_id = thread.tenant_id
        AND message.conversation_id = thread.conversation_id
        AND message.sent_at >= participant.joined_at
      ORDER BY message.sent_at DESC, message.message_id DESC
      LIMIT 1
    ) AS visible_message ON true
    WHERE thread.tenant_id = p_tenant_id
      AND thread.student_profile_id = p_student_profile_id
      AND (
        p_cursor IS NULL
        OR platform.mobile_family_conversation_cursor(
          coalesce(visible_message.sent_at, greatest(thread.created_at, participant.joined_at)),
          thread.conversation_id
        ) < p_cursor
      )
    ORDER BY page_cursor DESC
    LIMIT p_limit + 1
  ), numbered AS (
    SELECT candidate.*, row_number() OVER (ORDER BY page_cursor DESC) AS row_number
    FROM candidate
  ), page AS (
    SELECT numbered.*,
      (
        SELECT count(*)
        FROM integration_core.conversation_message AS message
        WHERE message.tenant_id = p_tenant_id
          AND message.conversation_id = numbered.conversation_id
          AND message.author_person_id <> selected_viewer_person_id
          AND message.sent_at >= numbered.joined_at
          AND (
            numbered.last_read_at IS NULL
            OR (message.sent_at, message.message_id) > (numbered.last_read_at, numbered.last_read_message_id)
          )
      )::integer AS unread_count
    FROM numbered
    WHERE numbered.row_number <= p_limit
  )
  SELECT jsonb_build_object(
    'conversations',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'conversationId', page.conversation_id,
          'subject', page.subject,
          'unreadCount', page.unread_count,
          'latestMessageAt', to_char(
            page.latest_message_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        ) ORDER BY page.page_cursor DESC
      ),
      '[]'::jsonb
    ),
    'nextCursor',
    CASE
      WHEN EXISTS (SELECT 1 FROM numbered WHERE row_number = p_limit + 1)
      THEN (SELECT page_cursor FROM page ORDER BY row_number DESC LIMIT 1)
      ELSE NULL
    END
  )
  INTO payload
  FROM page;

  RETURN payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_conversations(
  text, text, uuid, uuid, text, uuid, text, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_conversations(
  text, text, uuid, uuid, text, uuid, text, integer
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_family_conversation_messages(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
  p_conversation_id uuid,
  p_cursor text,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  selected_viewer_person_id uuid;
  selected_local_date date;
  selected_joined_at timestamptz;
  payload jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR (p_cursor IS NOT NULL AND p_cursor !~ '^[0-9]{17}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RETURN NULL;
  END IF;

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_conversation_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona,
    'messages.read'
  ) AS authority;

  IF selected_account_id IS NULL
     OR selected_viewer_person_id IS NULL
     OR selected_local_date IS NULL
     OR NOT platform.mobile_family_conversation_is_authorized(
       p_tenant_id,
       p_campus_id,
       p_persona,
       selected_viewer_person_id,
       p_conversation_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  SELECT participant.joined_at
  INTO selected_joined_at
  FROM integration_core.conversation_participant AS participant
  WHERE participant.tenant_id = p_tenant_id
    AND participant.conversation_id = p_conversation_id
    AND participant.person_id = selected_viewer_person_id
    AND participant.joined_at <= clock_timestamp()
    AND (participant.left_at IS NULL OR participant.left_at > clock_timestamp());

  IF selected_joined_at IS NULL THEN RETURN NULL; END IF;

  WITH candidate AS (
    SELECT
      message.message_id,
      message.author_label,
      message.body,
      message.sent_at,
      platform.mobile_family_conversation_cursor(message.sent_at, message.message_id) AS page_cursor
    FROM integration_core.conversation_message AS message
    WHERE message.tenant_id = p_tenant_id
      AND message.conversation_id = p_conversation_id
      AND message.sent_at >= selected_joined_at
      AND (
        p_cursor IS NULL
        OR platform.mobile_family_conversation_cursor(message.sent_at, message.message_id) < p_cursor
      )
    ORDER BY page_cursor DESC
    LIMIT p_limit + 1
  ), numbered AS (
    SELECT candidate.*, row_number() OVER (ORDER BY page_cursor DESC) AS row_number
    FROM candidate
  ), page AS (
    SELECT * FROM numbered WHERE row_number <= p_limit
  )
  SELECT jsonb_build_object(
    'conversationId', p_conversation_id,
    'messages',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'messageId', page.message_id,
          'authorLabel', page.author_label,
          'body', page.body,
          'sentAt', to_char(page.sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) ORDER BY page.page_cursor DESC
      ),
      '[]'::jsonb
    ),
    'nextCursor',
    CASE
      WHEN EXISTS (SELECT 1 FROM numbered WHERE row_number = p_limit + 1)
      THEN (SELECT page_cursor FROM page ORDER BY row_number DESC LIMIT 1)
      ELSE NULL
    END
  )
  INTO payload
  FROM page;

  RETURN payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_family_conversation_messages(
  text, text, uuid, uuid, text, uuid, text, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_family_conversation_messages(
  text, text, uuid, uuid, text, uuid, text, integer
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.send_mobile_family_conversation_message(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
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
  selected_local_date date;
  selected_student_profile_id uuid;
  selected_status text;
  selected_version bigint;
  selected_display_label text;
  selected_can_reply boolean;
  previous_command platform.mobile_family_conversation_command%ROWTYPE;
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

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_conversation_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona,
    'messages.send'
  ) AS authority;

  IF selected_account_id IS NULL OR selected_viewer_person_id IS NULL OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-family-conversation:' || selected_account_id::text || ':' || p_idempotency_key,
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
   AND participant.joined_at <= selected_now
   AND (participant.left_at IS NULL OR participant.left_at > selected_now)
  WHERE thread.tenant_id = p_tenant_id
    AND thread.conversation_id = p_conversation_id
  FOR UPDATE OF thread, participant;

  IF selected_student_profile_id IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       p_persona,
       selected_viewer_person_id,
       selected_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          'send',
          p_tenant_id::text,
          p_campus_id::text,
          p_persona,
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
  FROM platform.mobile_family_conversation_command AS command
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

  INSERT INTO platform.mobile_family_conversation_command (
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

REVOKE ALL ON FUNCTION platform.send_mobile_family_conversation_message(
  text, text, uuid, uuid, text, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.send_mobile_family_conversation_message(
  text, text, uuid, uuid, text, uuid, text, text
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.mark_mobile_family_conversation_read(
  p_provider_issuer text,
  p_provider_subject text,
  p_tenant_id uuid,
  p_campus_id uuid,
  p_persona text,
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
  selected_local_date date;
  selected_student_profile_id uuid;
  selected_joined_at timestamptz;
  selected_last_read_at timestamptz;
  selected_last_read_message_id uuid;
  selected_read_revision bigint;
  selected_message_sent_at timestamptz;
  previous_command platform.mobile_family_conversation_command%ROWTYPE;
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

  SELECT authority.account_id, authority.viewer_person_id, authority.local_date
  INTO selected_account_id, selected_viewer_person_id, selected_local_date
  FROM platform.resolve_mobile_family_conversation_identity_authority(
    p_provider_issuer,
    p_provider_subject,
    p_tenant_id,
    p_campus_id,
    p_persona,
    'messages.read'
  ) AS authority;

  IF selected_account_id IS NULL OR selected_viewer_person_id IS NULL OR selected_local_date IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'mobile-family-conversation:' || selected_account_id::text || ':' || p_idempotency_key,
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
   AND participant.joined_at <= selected_now
   AND (participant.left_at IS NULL OR participant.left_at > selected_now)
  WHERE thread.tenant_id = p_tenant_id
    AND thread.conversation_id = p_conversation_id
  FOR UPDATE OF participant;

  IF selected_student_profile_id IS NULL
     OR NOT platform.mobile_family_student_is_authorized(
       p_tenant_id,
       p_campus_id,
       p_persona,
       selected_viewer_person_id,
       selected_student_profile_id,
       selected_local_date
     ) THEN
    RETURN NULL;
  END IF;

  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          'read',
          p_tenant_id::text,
          p_campus_id::text,
          p_persona,
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
  FROM platform.mobile_family_conversation_command AS command
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

  INSERT INTO platform.mobile_family_conversation_command (
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

REVOKE ALL ON FUNCTION platform.mark_mobile_family_conversation_read(
  text, text, uuid, uuid, text, uuid, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.mark_mobile_family_conversation_read(
  text, text, uuid, uuid, text, uuid, uuid, text
) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608210004_MOB-06C_mobile_family_conversations',
  'MOB-06C',
  'Shared authoritative conversation ledger with scoped Family reads, sends and explicit read receipts'
)
ON CONFLICT (migration_id) DO NOTHING;
