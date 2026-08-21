CREATE TABLE IF NOT EXISTS platform.mobile_device_session (
  device_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES iam.account (account_id) ON DELETE CASCADE,
  installation_id text NOT NULL CHECK (installation_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  application text NOT NULL CHECK (application IN ('family', 'staff')),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version text NOT NULL CHECK (length(btrim(app_version)) BETWEEN 1 AND 64),
  push_provider text NOT NULL CHECK (push_provider IN ('firebase', 'apns')),
  notification_environment text NOT NULL CHECK (notification_environment IN ('development', 'production')),
  push_token text NOT NULL CHECK (length(push_token) BETWEEN 1 AND 4096),
  push_token_digest text NOT NULL CHECK (length(push_token_digest) = 64),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  UNIQUE (account_id, application, installation_id),
  CHECK (
    (platform = 'android' AND push_provider = 'firebase')
    OR (platform = 'ios' AND push_provider = 'apns')
  )
);

CREATE INDEX IF NOT EXISTS mobile_device_session_active_account_idx
  ON platform.mobile_device_session (account_id, application, updated_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS mobile_device_session_active_token_idx
  ON platform.mobile_device_session (
    application,
    notification_environment,
    push_provider,
    push_token_digest
  )
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS mobile_device_session_active_installation_idx
  ON platform.mobile_device_session (application, installation_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS platform.mobile_device_session_command (
  account_id uuid NOT NULL REFERENCES iam.account (account_id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('register', 'revoke')),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  request_digest text NOT NULL CHECK (length(request_digest) = 64),
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id, operation, idempotency_key)
);

REVOKE ALL ON TABLE platform.mobile_device_session FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE platform.mobile_device_session_command FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_mobile_account_id(
  p_provider_issuer text,
  p_provider_subject text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  account_count bigint;
BEGIN
  IF p_provider_issuer IS NULL
     OR p_provider_subject IS NULL
     OR length(btrim(p_provider_issuer)) NOT BETWEEN 1 AND 2048
     OR length(btrim(p_provider_subject)) NOT BETWEEN 1 AND 512 THEN
    RETURN NULL;
  END IF;

  SELECT count(DISTINCT binding.account_id), min(binding.account_id::text)::uuid
  INTO account_count, selected_account_id
  FROM iam.oidc_membership_binding AS binding
  JOIN iam.account AS account
    ON account.account_id = binding.account_id
   AND account.disabled_at IS NULL
  JOIN platform.tenant AS tenant
    ON tenant.tenant_id = binding.tenant_id
   AND tenant.provisioning_status = 'active'
  JOIN iam.membership AS membership
    ON membership.tenant_id = binding.tenant_id
   AND membership.membership_id = binding.membership_id
   AND membership.account_id = binding.account_id
   AND membership.status = 'active'
  WHERE binding.provider_issuer = btrim(p_provider_issuer)
    AND binding.provider_subject = btrim(p_provider_subject)
    AND binding.status = 'active';

  IF account_count <> 1 THEN RETURN NULL; END IF;
  RETURN selected_account_id;
END
$function$;

REVOKE ALL ON FUNCTION platform.resolve_mobile_account_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_mobile_account_id(text, text) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.register_mobile_device_session(
  p_provider_issuer text,
  p_provider_subject text,
  p_idempotency_key text,
  p_installation_id text,
  p_application text,
  p_platform text,
  p_app_version text,
  p_push_provider text,
  p_notification_environment text,
  p_push_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  normalized_installation_id text := btrim(p_installation_id);
  normalized_application text := lower(btrim(p_application));
  normalized_platform text := lower(btrim(p_platform));
  normalized_app_version text := btrim(p_app_version);
  normalized_push_provider text := lower(btrim(p_push_provider));
  normalized_environment text := lower(btrim(p_notification_environment));
  normalized_idempotency_key text := btrim(p_idempotency_key);
  request_digest text;
  token_digest text;
  installation_lock_key bigint;
  token_lock_key bigint;
  previous_command platform.mobile_device_session_command%ROWTYPE;
  selected_session platform.mobile_device_session%ROWTYPE;
  response_payload jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  selected_account_id := platform.resolve_mobile_account_id(p_provider_issuer, p_provider_subject);
  IF selected_account_id IS NULL THEN RETURN NULL; END IF;

  IF normalized_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
     OR normalized_installation_id !~ '^[A-Za-z0-9_-]{16,128}$'
     OR normalized_application NOT IN ('family', 'staff')
     OR normalized_platform NOT IN ('android', 'ios')
     OR length(normalized_app_version) NOT BETWEEN 1 AND 64
     OR normalized_push_provider NOT IN ('firebase', 'apns')
     OR normalized_environment NOT IN ('development', 'production')
     OR p_push_token IS NULL
     OR length(p_push_token) NOT BETWEEN 1 AND 4096
     OR (normalized_platform = 'android' AND normalized_push_provider <> 'firebase')
     OR (normalized_platform = 'ios' AND normalized_push_provider <> 'apns') THEN
    RAISE EXCEPTION 'MOBILE_DEVICE_SESSION_INPUT_INVALID';
  END IF;

  token_digest := encode(public.digest(convert_to(p_push_token, 'UTF8'), 'sha256'), 'hex');
  installation_lock_key := hashtextextended(
    concat_ws(E'\x1f', 'mobile-device-installation', normalized_application, normalized_installation_id),
    0
  );
  token_lock_key := hashtextextended(
    concat_ws(
      E'\x1f',
      'mobile-device-token',
      normalized_application,
      normalized_environment,
      normalized_push_provider,
      token_digest
    ),
    0
  );
  request_digest := encode(
    public.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          normalized_installation_id,
          normalized_application,
          normalized_platform,
          normalized_app_version,
          normalized_push_provider,
          normalized_environment,
          token_digest
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(selected_account_id::text, 0));
  PERFORM pg_advisory_xact_lock(least(installation_lock_key, token_lock_key));
  IF installation_lock_key <> token_lock_key THEN
    PERFORM pg_advisory_xact_lock(greatest(installation_lock_key, token_lock_key));
  END IF;

  SELECT * INTO previous_command
  FROM platform.mobile_device_session_command AS command
  WHERE command.account_id = selected_account_id
    AND command.operation = 'register'
    AND command.idempotency_key = normalized_idempotency_key;

  IF previous_command.account_id IS NOT NULL THEN
    IF previous_command.request_digest <> request_digest THEN
      RAISE EXCEPTION 'MOBILE_DEVICE_SESSION_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN previous_command.response_body;
  END IF;

  UPDATE platform.mobile_device_session AS competing
  SET revoked_at = now_at,
      updated_at = now_at,
      revision = competing.revision + 1
  WHERE competing.revoked_at IS NULL
    AND competing.application = normalized_application
    AND competing.account_id <> selected_account_id
    AND (
      competing.installation_id = normalized_installation_id
      OR (
        competing.notification_environment = normalized_environment
        AND competing.push_provider = normalized_push_provider
        AND competing.push_token_digest = token_digest
      )
    );

  INSERT INTO platform.mobile_device_session (
    account_id,
    installation_id,
    application,
    platform,
    app_version,
    push_provider,
    notification_environment,
    push_token,
    push_token_digest,
    registered_at,
    updated_at,
    revoked_at,
    revision
  ) VALUES (
    selected_account_id,
    normalized_installation_id,
    normalized_application,
    normalized_platform,
    normalized_app_version,
    normalized_push_provider,
    normalized_environment,
    p_push_token,
    token_digest,
    now_at,
    now_at,
    NULL,
    1
  )
  ON CONFLICT (account_id, application, installation_id)
  DO UPDATE SET
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    push_provider = EXCLUDED.push_provider,
    notification_environment = EXCLUDED.notification_environment,
    push_token = EXCLUDED.push_token,
    push_token_digest = EXCLUDED.push_token_digest,
    registered_at = EXCLUDED.registered_at,
    updated_at = EXCLUDED.updated_at,
    revoked_at = NULL,
    revision = platform.mobile_device_session.revision + 1
  RETURNING * INTO selected_session;

  response_payload := jsonb_build_object(
    'deviceSessionId', selected_session.device_session_id,
    'installationId', selected_session.installation_id,
    'registeredAt', to_char(selected_session.registered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'revision', selected_session.revision
  );

  INSERT INTO platform.mobile_device_session_command (
    account_id, operation, idempotency_key, request_digest, response_body
  ) VALUES (
    selected_account_id, 'register', normalized_idempotency_key, request_digest, response_payload
  );

  RETURN response_payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.register_mobile_device_session(
  text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.register_mobile_device_session(
  text, text, text, text, text, text, text, text, text, text
) TO app_runtime;

CREATE OR REPLACE FUNCTION platform.revoke_mobile_device_session(
  p_provider_issuer text,
  p_provider_subject text,
  p_idempotency_key text,
  p_device_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  selected_account_id uuid;
  normalized_idempotency_key text := btrim(p_idempotency_key);
  request_digest text;
  previous_command platform.mobile_device_session_command%ROWTYPE;
  selected_session platform.mobile_device_session%ROWTYPE;
  response_payload jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  selected_account_id := platform.resolve_mobile_account_id(p_provider_issuer, p_provider_subject);
  IF selected_account_id IS NULL THEN RETURN NULL; END IF;

  IF normalized_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
     OR p_device_session_id IS NULL THEN
    RAISE EXCEPTION 'MOBILE_DEVICE_SESSION_INPUT_INVALID';
  END IF;

  request_digest := encode(
    public.digest(convert_to(p_device_session_id::text, 'UTF8'), 'sha256'),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(selected_account_id::text, 0));

  SELECT * INTO previous_command
  FROM platform.mobile_device_session_command AS command
  WHERE command.account_id = selected_account_id
    AND command.operation = 'revoke'
    AND command.idempotency_key = normalized_idempotency_key;

  IF previous_command.account_id IS NOT NULL THEN
    IF previous_command.request_digest <> request_digest THEN
      RAISE EXCEPTION 'MOBILE_DEVICE_SESSION_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN previous_command.response_body;
  END IF;

  SELECT * INTO selected_session
  FROM platform.mobile_device_session AS session
  WHERE session.device_session_id = p_device_session_id
    AND session.account_id = selected_account_id
  FOR UPDATE;

  IF selected_session.device_session_id IS NULL THEN RETURN NULL; END IF;

  IF selected_session.revoked_at IS NULL THEN
    UPDATE platform.mobile_device_session AS session
    SET revoked_at = now_at,
        updated_at = now_at,
        revision = session.revision + 1
    WHERE session.device_session_id = p_device_session_id
    RETURNING * INTO selected_session;
  END IF;

  response_payload := jsonb_build_object(
    'deviceSessionId', selected_session.device_session_id,
    'revokedAt', to_char(selected_session.revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'revision', selected_session.revision
  );

  INSERT INTO platform.mobile_device_session_command (
    account_id, operation, idempotency_key, request_digest, response_body
  ) VALUES (
    selected_account_id, 'revoke', normalized_idempotency_key, request_digest, response_payload
  );

  RETURN response_payload;
END
$function$;

REVOKE ALL ON FUNCTION platform.revoke_mobile_device_session(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.revoke_mobile_device_session(text, text, text, uuid) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608190003_MOB-04_mobile_device_sessions',
  'MOB-04',
  'Account-scoped idempotent mobile push device sessions with defensive token transfer revocation'
)
ON CONFLICT (migration_id) DO NOTHING;
