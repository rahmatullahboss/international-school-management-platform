ALTER TABLE iam.browser_session_registry
  ADD COLUMN IF NOT EXISTS provider_session_id text;

ALTER TABLE iam.browser_session_registry
  DROP CONSTRAINT IF EXISTS browser_session_registry_provider_session_id_check;
ALTER TABLE iam.browser_session_registry
  ADD CONSTRAINT browser_session_registry_provider_session_id_check
  CHECK (provider_session_id IS NULL OR (length(btrim(provider_session_id)) > 0 AND length(provider_session_id) <= 512));

CREATE INDEX IF NOT EXISTS browser_session_registry_provider_sid_active_idx
  ON iam.browser_session_registry (provider_session_id, expires_at)
  WHERE provider_session_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS iam.oidc_logout_token_consumption (
  provider_issuer text NOT NULL CHECK (length(btrim(provider_issuer)) > 0),
  token_id text NOT NULL CHECK (length(btrim(token_id)) > 0 AND length(token_id) <= 512),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider_issuer, token_id),
  CHECK (expires_at > issued_at),
  CHECK (expires_at > consumed_at - interval '1 minute')
);

CREATE INDEX IF NOT EXISTS oidc_logout_token_consumption_expiry_idx
  ON iam.oidc_logout_token_consumption (expires_at);

CREATE TABLE IF NOT EXISTS iam.oidc_provider_cache (
  cache_key text PRIMARY KEY CHECK (length(cache_key) > 0 AND length(cache_key) <= 512),
  cache_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON TABLE iam.oidc_logout_token_consumption FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE iam.oidc_provider_cache FROM PUBLIC, app_runtime;

DROP FUNCTION IF EXISTS iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, uuid[], text, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION iam.register_browser_session(
  p_session_id uuid,
  p_account_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_campus_id uuid,
  p_provider_session_id text,
  p_role_ids uuid[],
  p_assurance_level text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE
  selected_binding_id uuid;
  expected_role_ids uuid[];
BEGIN
  IF p_session_id IS NULL
     OR p_assurance_level NOT IN ('aal1', 'aal2')
     OR cardinality(p_role_ids) = 0
     OR (p_provider_session_id IS NOT NULL AND (length(btrim(p_provider_session_id)) = 0 OR length(p_provider_session_id) > 512))
     OR p_issued_at > clock_timestamp() + interval '1 minute'
     OR p_expires_at <= clock_timestamp()
     OR p_expires_at > p_issued_at + interval '8 hours' THEN
    RETURN false;
  END IF;

  SELECT binding.binding_id, array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  INTO selected_binding_id, expected_role_ids
  FROM iam.oidc_membership_binding AS binding
  JOIN iam.account AS account ON account.account_id = binding.account_id AND account.disabled_at IS NULL
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = binding.binding_id AND role_binding.tenant_id = binding.tenant_id
  WHERE binding.account_id = p_account_id
    AND binding.tenant_id = p_tenant_id
    AND binding.membership_id = p_membership_id
    AND binding.campus_id IS NOT DISTINCT FROM p_campus_id
    AND binding.status = 'active'
  GROUP BY binding.binding_id;

  IF selected_binding_id IS NULL OR expected_role_ids IS DISTINCT FROM (
    SELECT array_agg(role_id ORDER BY role_id) FROM unnest(p_role_ids) AS supplied(role_id)
  ) THEN RETURN false; END IF;

  INSERT INTO iam.browser_session_registry (
    session_id, binding_id, account_id, tenant_id, membership_id, campus_id,
    provider_session_id, role_ids, assurance_level, issued_at, expires_at
  ) VALUES (
    p_session_id, selected_binding_id, p_account_id, p_tenant_id, p_membership_id,
    p_campus_id, NULLIF(btrim(p_provider_session_id), ''), expected_role_ids,
    p_assurance_level, p_issued_at, p_expires_at
  ) ON CONFLICT (session_id) DO NOTHING;
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.consume_oidc_logout_token(
  p_token_id text,
  p_provider_issuer text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
BEGIN
  IF length(btrim(p_token_id)) = 0 OR length(p_token_id) > 512
     OR length(btrim(p_provider_issuer)) = 0
     OR p_issued_at > clock_timestamp() + interval '1 minute'
     OR p_issued_at < clock_timestamp() - interval '6 minutes'
     OR p_expires_at <= clock_timestamp() - interval '1 minute'
     OR p_expires_at > p_issued_at + interval '10 minutes' THEN RETURN false; END IF;
  INSERT INTO iam.oidc_logout_token_consumption(provider_issuer, token_id, issued_at, expires_at)
  VALUES (btrim(p_provider_issuer), btrim(p_token_id), p_issued_at, p_expires_at)
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.revoke_oidc_provider_sessions(
  p_provider_issuer text,
  p_provider_subject text,
  p_provider_session_id text,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE revoked_count integer;
BEGIN
  IF length(btrim(p_provider_issuer)) = 0 OR length(btrim(p_reason)) = 0
     OR (NULLIF(btrim(p_provider_subject), '') IS NULL AND NULLIF(btrim(p_provider_session_id), '') IS NULL)
     OR length(coalesce(p_provider_subject, '')) > 512 OR length(coalesce(p_provider_session_id, '')) > 512 THEN
    RETURN 0;
  END IF;
  UPDATE iam.browser_session_registry AS session
  SET revoked_at = clock_timestamp(), revoke_reason = btrim(p_reason)
  FROM iam.oidc_membership_binding AS binding
  WHERE binding.binding_id = session.binding_id
    AND binding.provider_issuer = btrim(p_provider_issuer)
    AND (NULLIF(btrim(p_provider_subject), '') IS NULL OR binding.provider_subject = btrim(p_provider_subject))
    AND (NULLIF(btrim(p_provider_session_id), '') IS NULL OR session.provider_session_id = btrim(p_provider_session_id))
    AND session.revoked_at IS NULL AND session.expires_at > clock_timestamp();
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END
$function$;

CREATE OR REPLACE FUNCTION iam.read_oidc_provider_cache(p_cache_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, iam AS $function$
  SELECT cache_value FROM iam.oidc_provider_cache WHERE cache_key = p_cache_key AND length(p_cache_key) <= 512;
$function$;

CREATE OR REPLACE FUNCTION iam.write_oidc_provider_cache(p_cache_key text, p_cache_value jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, iam AS $function$
BEGIN
  IF length(p_cache_key) = 0 OR length(p_cache_key) > 512 OR p_cache_value IS NULL THEN RETURN false; END IF;
  INSERT INTO iam.oidc_provider_cache(cache_key, cache_value, updated_at)
  VALUES (p_cache_key, p_cache_value, clock_timestamp())
  ON CONFLICT (cache_key) DO UPDATE SET cache_value = EXCLUDED.cache_value, updated_at = EXCLUDED.updated_at;
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, text, uuid[], text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.consume_oidc_logout_token(text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.revoke_oidc_provider_sessions(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.read_oidc_provider_cache(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.write_oidc_provider_cache(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, text, uuid[], text, timestamptz, timestamptz) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.consume_oidc_logout_token(text, text, timestamptz, timestamptz) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.revoke_oidc_provider_sessions(text, text, text, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.read_oidc_provider_cache(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.write_oidc_provider_cache(text, jsonb) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES ('202607310701_AUTH-07_backchannel_logout', 'AUTH-07', 'OIDC back-channel logout replay, provider session revocation and durable provider cache')
ON CONFLICT (migration_id) DO NOTHING;
