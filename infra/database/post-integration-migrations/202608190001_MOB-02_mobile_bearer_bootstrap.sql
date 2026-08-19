INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES
  ('attendance.read', 'Read authorized attendance information', 'aal1'),
  ('attendance.take', 'Create authorized teacher attendance operations', 'aal1'),
  ('billing.read', 'Read authorized family billing and receipt information', 'aal1'),
  ('documents.read', 'Read authorized mobile document metadata', 'aal1'),
  ('forms.consent', 'Submit authorized guardian form and consent decisions', 'aal1'),
  ('grades.read.published', 'Read published authorized academic results', 'aal1'),
  ('grades.write', 'Create authorized teacher grade draft operations', 'aal1'),
  ('messages.read', 'Read authorized school conversations', 'aal1'),
  ('messages.send', 'Send authorized school conversation messages', 'aal1'),
  ('timetable.read', 'Read authorized timetable information', 'aal1')
ON CONFLICT (permission_key) DO NOTHING;

WITH mobile_grant(role_key, permission_key) AS (
  VALUES
    ('guardian', 'attendance.read'),
    ('guardian', 'billing.read'),
    ('guardian', 'documents.read'),
    ('guardian', 'forms.consent'),
    ('guardian', 'grades.read.published'),
    ('guardian', 'messages.read'),
    ('guardian', 'messages.send'),
    ('guardian', 'timetable.read'),
    ('student', 'attendance.read'),
    ('student', 'documents.read'),
    ('student', 'grades.read.published'),
    ('student', 'messages.read'),
    ('student', 'messages.send'),
    ('student', 'timetable.read'),
    ('teacher', 'attendance.read'),
    ('teacher', 'attendance.take'),
    ('teacher', 'documents.read'),
    ('teacher', 'grades.write'),
    ('teacher', 'messages.read'),
    ('teacher', 'messages.send'),
    ('teacher', 'timetable.read')
)
INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
SELECT role.tenant_id, role.role_id, mobile_grant.permission_key
FROM iam.role AS role
JOIN mobile_grant ON mobile_grant.role_key = role.role_key
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION iam.resolve_mobile_bootstrap_access(
  p_provider_issuer text,
  p_provider_subject text
)
RETURNS TABLE (
  account_id uuid,
  tenant_id uuid,
  tenant_name text,
  campus_id uuid,
  campus_name text,
  time_zone text,
  persona text,
  capabilities text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  WITH active_access AS (
    SELECT
      binding.account_id,
      binding.tenant_id,
      tenant.display_name AS tenant_name,
      binding.campus_id,
      campus.name AS campus_name,
      campus.time_zone,
      role.role_id,
      role.role_key AS persona
    FROM iam.oidc_membership_binding AS binding
    JOIN iam.account AS account
      ON account.account_id = binding.account_id
     AND account.provider = binding.provider_issuer
     AND account.provider_subject = binding.provider_subject
     AND account.disabled_at IS NULL
    JOIN iam.membership AS membership
      ON membership.tenant_id = binding.tenant_id
     AND membership.membership_id = binding.membership_id
     AND membership.account_id = binding.account_id
     AND membership.campus_id IS NOT DISTINCT FROM binding.campus_id
     AND membership.status = 'active'
    JOIN platform.tenant AS tenant
      ON tenant.tenant_id = binding.tenant_id
     AND tenant.provisioning_status = 'active'
    JOIN tenancy.campus AS campus
      ON campus.tenant_id = binding.tenant_id
     AND campus.campus_id = binding.campus_id
    JOIN iam.oidc_membership_role_binding AS role_binding
      ON role_binding.binding_id = binding.binding_id
     AND role_binding.tenant_id = binding.tenant_id
    JOIN iam.role AS role
      ON role.tenant_id = role_binding.tenant_id
     AND role.role_id = role_binding.role_id
     AND role.role_key = ANY (ARRAY['guardian', 'student', 'teacher']::text[])
    WHERE binding.provider_issuer = btrim(p_provider_issuer)
      AND binding.provider_subject = btrim(p_provider_subject)
      AND binding.status = 'active'
      AND binding.campus_id IS NOT NULL
      AND length(btrim(p_provider_issuer)) BETWEEN 1 AND 2048
      AND length(btrim(p_provider_subject)) BETWEEN 1 AND 512
  )
  SELECT
    access.account_id,
    access.tenant_id,
    access.tenant_name,
    access.campus_id,
    access.campus_name,
    access.time_zone,
    access.persona,
    coalesce(
      array_agg(DISTINCT permission.permission_key ORDER BY permission.permission_key)
        FILTER (
          WHERE permission.permission_key = ANY (
            CASE access.persona
              WHEN 'guardian' THEN ARRAY[
                'attendance.read',
                'billing.read',
                'documents.read',
                'forms.consent',
                'grades.read.published',
                'messages.read',
                'messages.send',
                'timetable.read'
              ]::text[]
              WHEN 'student' THEN ARRAY[
                'attendance.read',
                'documents.read',
                'grades.read.published',
                'messages.read',
                'messages.send',
                'timetable.read'
              ]::text[]
              WHEN 'teacher' THEN ARRAY[
                'attendance.read',
                'attendance.take',
                'documents.read',
                'grades.write',
                'messages.read',
                'messages.send',
                'timetable.read'
              ]::text[]
              ELSE ARRAY[]::text[]
            END
          )
        ),
      ARRAY[]::text[]
    ) AS capabilities
  FROM active_access AS access
  LEFT JOIN iam.role_permission AS permission
    ON permission.tenant_id = access.tenant_id
   AND permission.role_id = access.role_id
  GROUP BY
    access.account_id,
    access.tenant_id,
    access.tenant_name,
    access.campus_id,
    access.campus_name,
    access.time_zone,
    access.persona
  ORDER BY access.tenant_id, access.campus_id, access.persona;
$function$;

REVOKE ALL ON FUNCTION iam.resolve_mobile_bootstrap_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.resolve_mobile_bootstrap_access(text, text) TO app_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608190001_MOB-02_mobile_bearer_bootstrap',
  'MOB-02',
  'Mobile OIDC bearer bootstrap permissions and tenant-safe access projection'
)
ON CONFLICT (migration_id) DO NOTHING;
