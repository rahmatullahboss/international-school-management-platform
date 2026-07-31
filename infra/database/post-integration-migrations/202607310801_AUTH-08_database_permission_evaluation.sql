CREATE OR REPLACE FUNCTION iam.evaluate_browser_permission(
  p_session_id uuid,
  p_permission_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
DECLARE
  session_binding_id uuid;
  session_tenant_id uuid;
  session_assurance text;
  current_role_ids uuid[];
  required_assurance text;
BEGIN
  IF p_session_id IS NULL
     OR p_permission_key IS NULL
     OR p_permission_key !~ '^[a-z0-9][a-z0-9._:-]{0,127}$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'permission-not-granted');
  END IF;

  SELECT
    session.binding_id,
    session.tenant_id,
    session.assurance_level,
    array_agg(role_binding.role_id ORDER BY role_binding.role_id)
  INTO
    session_binding_id,
    session_tenant_id,
    session_assurance,
    current_role_ids
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
  GROUP BY session.binding_id, session.tenant_id, session.assurance_level, session.role_ids
  HAVING session.role_ids = array_agg(role_binding.role_id ORDER BY role_binding.role_id);

  IF session_binding_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'session-inactive');
  END IF;

  SELECT permission.required_assurance
  INTO required_assurance
  FROM iam.permission AS permission
  WHERE permission.permission_key = p_permission_key
    AND EXISTS (
      SELECT 1
      FROM iam.oidc_membership_role_binding AS role_binding
      JOIN iam.role_permission AS role_permission
        ON role_permission.tenant_id = role_binding.tenant_id
       AND role_permission.role_id = role_binding.role_id
       AND role_permission.permission_key = permission.permission_key
      WHERE role_binding.binding_id = session_binding_id
        AND role_binding.tenant_id = session_tenant_id
    );

  IF required_assurance IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'permission-not-granted');
  END IF;
  IF required_assurance = 'aal2' AND session_assurance <> 'aal2' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'step-up-required',
      'requiredAssurance', 'aal2'
    );
  END IF;
  RETURN jsonb_build_object('allowed', true, 'reason', 'role-grant');
END
$function$;

REVOKE ALL ON FUNCTION iam.evaluate_browser_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.evaluate_browser_permission(uuid, text) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202607310801_AUTH-08_database_permission_evaluation',
  'AUTH-08',
  'Database-backed assurance-aware browser permission evaluation'
)
ON CONFLICT (migration_id) DO NOTHING;
