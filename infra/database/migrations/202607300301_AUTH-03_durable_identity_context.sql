CREATE TABLE IF NOT EXISTS iam.oauth_transaction_consumption (
  transaction_id uuid PRIMARY KEY,
  provider_issuer text NOT NULL CHECK (length(btrim(provider_issuer)) > 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > consumed_at)
);

CREATE INDEX IF NOT EXISTS oauth_transaction_consumption_expiry_idx
  ON iam.oauth_transaction_consumption (expires_at);

CREATE TABLE IF NOT EXISTS iam.oidc_membership_binding (
  binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_issuer text NOT NULL CHECK (length(btrim(provider_issuer)) > 0),
  provider_subject text NOT NULL CHECK (length(btrim(provider_subject)) > 0),
  account_id uuid NOT NULL REFERENCES iam.account (account_id),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_issuer, provider_subject, tenant_id, membership_id),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE INDEX IF NOT EXISTS oidc_membership_binding_identity_idx
  ON iam.oidc_membership_binding (provider_issuer, provider_subject)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS iam.oidc_membership_role_binding (
  tenant_id uuid NOT NULL,
  binding_id uuid NOT NULL REFERENCES iam.oidc_membership_binding (binding_id) ON DELETE CASCADE,
  role_id uuid NOT NULL,
  PRIMARY KEY (binding_id, role_id),
  FOREIGN KEY (tenant_id, role_id)
    REFERENCES iam.role (tenant_id, role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.browser_session_registry (
  session_id uuid PRIMARY KEY,
  binding_id uuid NOT NULL REFERENCES iam.oidc_membership_binding (binding_id),
  account_id uuid NOT NULL REFERENCES iam.account (account_id),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  role_ids uuid[] NOT NULL CHECK (cardinality(role_ids) > 0),
  assurance_level text NOT NULL CHECK (assurance_level IN ('aal1', 'aal2')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at),
  CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL)),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE INDEX IF NOT EXISTS browser_session_registry_account_active_idx
  ON iam.browser_session_registry (account_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS browser_session_registry_expiry_idx
  ON iam.browser_session_registry (expires_at);

REVOKE ALL ON TABLE iam.oauth_transaction_consumption FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE iam.oidc_membership_binding FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE iam.oidc_membership_role_binding FROM PUBLIC, app_runtime;
REVOKE ALL ON TABLE iam.browser_session_registry FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION iam.consume_oauth_transaction(
  p_transaction_id uuid,
  p_provider_issuer text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
BEGIN
  IF p_transaction_id IS NULL
     OR length(btrim(p_provider_issuer)) = 0
     OR p_expires_at <= clock_timestamp()
     OR p_expires_at > clock_timestamp() + interval '10 minutes' THEN
    RETURN false;
  END IF;

  INSERT INTO iam.oauth_transaction_consumption (
    transaction_id,
    provider_issuer,
    expires_at
  ) VALUES (
    p_transaction_id,
    btrim(p_provider_issuer),
    p_expires_at
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.resolve_oidc_memberships(
  p_provider_issuer text,
  p_provider_subject text
)
RETURNS TABLE (
  binding_id uuid,
  membership_id uuid,
  account_id uuid,
  tenant_id uuid,
  campus_id uuid,
  role_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
  SELECT
    binding.binding_id,
    binding.membership_id,
    binding.account_id,
    binding.tenant_id,
    binding.campus_id,
    array_agg(role_binding.role_id ORDER BY role_binding.role_id) AS role_ids
  FROM iam.oidc_membership_binding AS binding
  JOIN iam.account AS account
    ON account.account_id = binding.account_id
   AND account.provider = binding.provider_issuer
   AND account.provider_subject = binding.provider_subject
   AND account.disabled_at IS NULL
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = binding.binding_id
   AND role_binding.tenant_id = binding.tenant_id
  WHERE binding.provider_issuer = btrim(p_provider_issuer)
    AND binding.provider_subject = btrim(p_provider_subject)
    AND binding.status = 'active'
  GROUP BY
    binding.binding_id,
    binding.membership_id,
    binding.account_id,
    binding.tenant_id,
    binding.campus_id
  ORDER BY binding.tenant_id, binding.membership_id;
$function$;

CREATE OR REPLACE FUNCTION iam.register_browser_session(
  p_session_id uuid,
  p_account_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_campus_id uuid,
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
     OR p_issued_at > clock_timestamp() + interval '1 minute'
     OR p_expires_at <= clock_timestamp()
     OR p_expires_at > p_issued_at + interval '8 hours' THEN
    RETURN false;
  END IF;

  SELECT
    binding.binding_id,
    array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  INTO selected_binding_id, expected_role_ids
  FROM iam.oidc_membership_binding AS binding
  JOIN iam.account AS account
    ON account.account_id = binding.account_id
   AND account.disabled_at IS NULL
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = binding.binding_id
   AND role_binding.tenant_id = binding.tenant_id
  WHERE binding.account_id = p_account_id
    AND binding.tenant_id = p_tenant_id
    AND binding.membership_id = p_membership_id
    AND binding.campus_id IS NOT DISTINCT FROM p_campus_id
    AND binding.status = 'active'
  GROUP BY binding.binding_id;

  IF selected_binding_id IS NULL
     OR expected_role_ids IS DISTINCT FROM (
       SELECT array_agg(role_id ORDER BY role_id)
       FROM unnest(p_role_ids) AS supplied(role_id)
     ) THEN
    RETURN false;
  END IF;

  INSERT INTO iam.browser_session_registry (
    session_id,
    binding_id,
    account_id,
    tenant_id,
    membership_id,
    campus_id,
    role_ids,
    assurance_level,
    issued_at,
    expires_at
  ) VALUES (
    p_session_id,
    selected_binding_id,
    p_account_id,
    p_tenant_id,
    p_membership_id,
    p_campus_id,
    expected_role_ids,
    p_assurance_level,
    p_issued_at,
    p_expires_at
  )
  ON CONFLICT (session_id) DO NOTHING;

  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.is_browser_session_active(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM iam.browser_session_registry AS session
    JOIN iam.oidc_membership_binding AS binding
      ON binding.binding_id = session.binding_id
     AND binding.account_id = session.account_id
     AND binding.tenant_id = session.tenant_id
     AND binding.membership_id = session.membership_id
     AND binding.campus_id IS NOT DISTINCT FROM session.campus_id
     AND binding.status = 'active'
    JOIN iam.account AS account
      ON account.account_id = session.account_id
     AND account.disabled_at IS NULL
    WHERE session.session_id = p_session_id
      AND session.revoked_at IS NULL
      AND session.expires_at > clock_timestamp()
      AND session.role_ids = (
        SELECT array_agg(role_binding.role_id ORDER BY role_binding.role_id)
        FROM iam.oidc_membership_role_binding AS role_binding
        WHERE role_binding.binding_id = session.binding_id
          AND role_binding.tenant_id = session.tenant_id
      )
  );
$function$;

CREATE OR REPLACE FUNCTION iam.revoke_browser_session(
  p_session_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
BEGIN
  IF length(btrim(p_reason)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE iam.browser_session_registry
  SET revoked_at = clock_timestamp(),
      revoke_reason = btrim(p_reason)
  WHERE session_id = p_session_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION iam.revoke_account_browser_sessions(
  p_account_id uuid,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE
  revoked_count integer;
BEGIN
  IF length(btrim(p_reason)) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE iam.browser_session_registry
  SET revoked_at = clock_timestamp(),
      revoke_reason = btrim(p_reason)
  WHERE account_id = p_account_id
    AND revoked_at IS NULL
    AND expires_at > clock_timestamp();

  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END
$function$;

REVOKE ALL ON FUNCTION iam.consume_oauth_transaction(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.resolve_oidc_memberships(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, uuid[], text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.is_browser_session_active(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.revoke_browser_session(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.revoke_account_browser_sessions(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION iam.consume_oauth_transaction(uuid, text, timestamptz) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.resolve_oidc_memberships(text, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.register_browser_session(uuid, uuid, uuid, uuid, uuid, uuid[], text, timestamptz, timestamptz) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.is_browser_session_active(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.revoke_browser_session(uuid, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION iam.revoke_account_browser_sessions(uuid, text) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607300301_AUTH-03_durable_identity_context',
  'AUTH-03',
  'Durable OAuth replay, OIDC membership projection and browser session registry'
)
ON CONFLICT (migration_id) DO NOTHING;
