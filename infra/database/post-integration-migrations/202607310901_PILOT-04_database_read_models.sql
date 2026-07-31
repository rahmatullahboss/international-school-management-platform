CREATE TABLE IF NOT EXISTS platform.runtime_read_model_projection (
  projection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenant (tenant_id),
  membership_id uuid NOT NULL,
  campus_id uuid,
  projection_key text NOT NULL DEFAULT 'home'
    CHECK (projection_key ~ '^[a-z][a-z0-9._:-]{0,63}$'),
  persona text NOT NULL CHECK (persona IN ('admin', 'teacher', 'guardian', 'student')),
  subject_ref text NOT NULL CHECK (subject_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  revision bigint NOT NULL CHECK (revision > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  source_updated_at timestamptz NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload_digest text GENERATED ALWAYS AS (
    encode(public.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex')
  ) STORED,
  payload_bytes integer GENERATED ALWAYS AS (
    octet_length(convert_to(payload::text, 'UTF8'))
  ) STORED,
  CHECK (octet_length(convert_to(payload::text, 'UTF8')) BETWEEN 2 AND 262144),
  CHECK (source_updated_at <= generated_at + interval '1 minute'),
  UNIQUE NULLS NOT DISTINCT (tenant_id, membership_id, campus_id, projection_key),
  FOREIGN KEY (tenant_id, membership_id)
    REFERENCES iam.membership (tenant_id, membership_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, campus_id)
    REFERENCES tenancy.campus (tenant_id, campus_id)
);

CREATE INDEX IF NOT EXISTS runtime_read_model_projection_scope_idx
  ON platform.runtime_read_model_projection (
    tenant_id,
    membership_id,
    campus_id,
    projection_key,
    revision
  );

REVOKE ALL ON TABLE platform.runtime_read_model_projection FROM PUBLIC, app_runtime;

CREATE OR REPLACE FUNCTION platform.resolve_runtime_read_model_head(p_session_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  membership_id uuid,
  campus_id uuid,
  persona text,
  subject_ref text,
  capabilities text[],
  revision bigint,
  generated_at timestamptz,
  source_updated_at timestamptz,
  payload_digest text,
  capability_digest text,
  payload_bytes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam
AS $function$
  WITH session_context AS (
    SELECT
      session.binding_id,
      session.tenant_id,
      session.membership_id,
      session.campus_id
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
    JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.binding_id = session.binding_id
     AND role_binding.tenant_id = session.tenant_id
    WHERE session.session_id = p_session_id
      AND session.revoked_at IS NULL
      AND session.expires_at > clock_timestamp()
    GROUP BY
      session.binding_id,
      session.tenant_id,
      session.membership_id,
      session.campus_id,
      session.role_ids
    HAVING session.role_ids = array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  ),
  capability_context AS (
    SELECT
      context.binding_id,
      context.tenant_id,
      context.membership_id,
      context.campus_id,
      COALESCE(
        array_agg(DISTINCT role_permission.permission_key ORDER BY role_permission.permission_key)
          FILTER (WHERE role_permission.permission_key IS NOT NULL),
        ARRAY[]::text[]
      ) AS capabilities
    FROM session_context AS context
    LEFT JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.binding_id = context.binding_id
     AND role_binding.tenant_id = context.tenant_id
    LEFT JOIN iam.role_permission AS role_permission
      ON role_permission.tenant_id = role_binding.tenant_id
     AND role_permission.role_id = role_binding.role_id
    GROUP BY
      context.binding_id,
      context.tenant_id,
      context.membership_id,
      context.campus_id
  )
  SELECT
    projection.tenant_id,
    projection.membership_id,
    projection.campus_id,
    projection.persona,
    projection.subject_ref,
    context.capabilities,
    projection.revision,
    projection.generated_at,
    projection.source_updated_at,
    projection.payload_digest,
    encode(
      public.digest(convert_to(to_jsonb(context.capabilities)::text, 'UTF8'), 'sha256'),
      'hex'
    ) AS capability_digest,
    projection.payload_bytes
  FROM capability_context AS context
  JOIN platform.runtime_read_model_projection AS projection
    ON projection.tenant_id = context.tenant_id
   AND projection.membership_id = context.membership_id
   AND projection.campus_id IS NOT DISTINCT FROM context.campus_id
   AND projection.projection_key = 'home';
$function$;

CREATE OR REPLACE FUNCTION platform.read_runtime_read_model_payload(
  p_session_id uuid,
  p_revision bigint,
  p_payload_digest text,
  p_capability_digest text
)
RETURNS TABLE (payload jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, platform, iam
AS $function$
  WITH session_context AS (
    SELECT
      session.binding_id,
      session.tenant_id,
      session.membership_id,
      session.campus_id
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
    JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.binding_id = session.binding_id
     AND role_binding.tenant_id = session.tenant_id
    WHERE session.session_id = p_session_id
      AND session.revoked_at IS NULL
      AND session.expires_at > clock_timestamp()
      AND p_revision > 0
      AND p_payload_digest ~ '^[0-9a-f]{64}$'
      AND p_capability_digest ~ '^[0-9a-f]{64}$'
    GROUP BY
      session.binding_id,
      session.tenant_id,
      session.membership_id,
      session.campus_id,
      session.role_ids
    HAVING session.role_ids = array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  ),
  capability_context AS (
    SELECT
      context.tenant_id,
      context.membership_id,
      context.campus_id,
      COALESCE(
        array_agg(DISTINCT role_permission.permission_key ORDER BY role_permission.permission_key)
          FILTER (WHERE role_permission.permission_key IS NOT NULL),
        ARRAY[]::text[]
      ) AS capabilities
    FROM session_context AS context
    LEFT JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.binding_id = context.binding_id
     AND role_binding.tenant_id = context.tenant_id
    LEFT JOIN iam.role_permission AS role_permission
      ON role_permission.tenant_id = role_binding.tenant_id
     AND role_permission.role_id = role_binding.role_id
    GROUP BY context.tenant_id, context.membership_id, context.campus_id
  )
  SELECT projection.payload
  FROM capability_context AS context
  JOIN platform.runtime_read_model_projection AS projection
    ON projection.tenant_id = context.tenant_id
   AND projection.membership_id = context.membership_id
   AND projection.campus_id IS NOT DISTINCT FROM context.campus_id
   AND projection.projection_key = 'home'
   AND projection.revision = p_revision
   AND projection.payload_digest = p_payload_digest
  WHERE encode(
    public.digest(convert_to(to_jsonb(context.capabilities)::text, 'UTF8'), 'sha256'),
    'hex'
  ) = p_capability_digest;
$function$;

REVOKE ALL ON FUNCTION platform.resolve_runtime_read_model_head(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.read_runtime_read_model_payload(uuid, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.resolve_runtime_read_model_head(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION platform.read_runtime_read_model_payload(uuid, bigint, text, text) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607310901_PILOT-04_database_read_models',
  'PILOT-04',
  'Tenant-safe database runtime read-model projection and exact-session access functions'
)
ON CONFLICT (migration_id) DO NOTHING;
