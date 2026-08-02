CREATE OR REPLACE FUNCTION iam.resolve_browser_workspace(p_session_id uuid)
RETURNS TABLE (
  role_key text,
  capabilities text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
  WITH active_session AS (
    SELECT
      session.binding_id,
      session.tenant_id,
      session.membership_id
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
      session.role_ids
    HAVING session.role_ids = array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  )
  SELECT
    min(role.role_key) AS role_key,
    coalesce(
      array_agg(DISTINCT role_permission.permission_key ORDER BY role_permission.permission_key)
        FILTER (WHERE role_permission.permission_key IS NOT NULL),
      ARRAY[]::text[]
    ) AS capabilities
  FROM active_session AS session
  JOIN iam.oidc_membership_role_binding AS role_binding
    ON role_binding.binding_id = session.binding_id
   AND role_binding.tenant_id = session.tenant_id
  JOIN iam.role AS role
    ON role.tenant_id = role_binding.tenant_id
   AND role.role_id = role_binding.role_id
  LEFT JOIN iam.role_permission AS role_permission
    ON role_permission.tenant_id = role.tenant_id
   AND role_permission.role_id = role.role_id
  GROUP BY session.binding_id
  HAVING count(DISTINCT role.role_key) = 1
     AND min(role.role_key) = ANY (
       ARRAY['admin', 'teacher', 'guardian', 'student', 'admissions', 'finance', 'support']::text[]
     );
$function$;

REVOKE ALL ON FUNCTION iam.resolve_browser_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.resolve_browser_workspace(uuid) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608020001_PROD-01_browser_workspace_resolution',
  'PROD-01',
  'Function-only current browser workspace and capability resolution'
)
ON CONFLICT (migration_id) DO NOTHING;
