DO $projection_worker_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_projection_worker') THEN
    CREATE ROLE app_projection_worker NOLOGIN NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT app_projection_worker TO %I', current_user);
END
$projection_worker_role$;

ALTER ROLE app_projection_worker
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;

GRANT USAGE ON SCHEMA platform TO app_projection_worker;
REVOKE ALL ON ALL TABLES IN SCHEMA platform FROM app_projection_worker;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA platform FROM app_projection_worker;

REVOKE ALL ON FUNCTION platform.process_runtime_projection_refresh_batch(text, integer, integer)
  FROM app_projection_worker;
GRANT EXECUTE ON FUNCTION platform.process_runtime_projection_refresh_batch(text, integer, integer)
  TO app_projection_worker;

CREATE OR REPLACE FUNCTION platform.projection_worker_credential_ready()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform
AS $function$
DECLARE
  login_role_name text := session_user;
  login_role pg_roles%ROWTYPE;
BEGIN
  SELECT *
  INTO login_role
  FROM pg_roles
  WHERE rolname = login_role_name;

  IF NOT FOUND
     OR NOT login_role.rolcanlogin
     OR login_role.rolsuper
     OR login_role.rolcreatedb
     OR login_role.rolcreaterole
     OR login_role.rolreplication
     OR login_role.rolbypassrls THEN
    RETURN false;
  END IF;

  IF NOT pg_has_role(login_role_name, 'app_projection_worker', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_runtime', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_production_runtime', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_projection_recovery', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_projection_monitor', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_projection_admin', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_projection_publisher', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_projection_composer', 'MEMBER') THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser')
     AND pg_has_role(login_role_name, 'neon_superuser', 'MEMBER') THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND namespace.nspname NOT LIKE 'pg_temp_%'
      AND namespace.nspname NOT LIKE 'pg_toast_temp_%'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (
        has_table_privilege(login_role_name, relation.oid, 'SELECT')
        OR has_table_privilege(login_role_name, relation.oid, 'INSERT')
        OR has_table_privilege(login_role_name, relation.oid, 'UPDATE')
        OR has_table_privilege(login_role_name, relation.oid, 'DELETE')
      )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS sequence
    JOIN pg_namespace AS namespace ON namespace.oid = sequence.relnamespace
    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND namespace.nspname NOT LIKE 'pg_temp_%'
      AND namespace.nspname NOT LIKE 'pg_toast_temp_%'
      AND sequence.relkind = 'S'
      AND (
        has_sequence_privilege(login_role_name, sequence.oid, 'USAGE')
        OR has_sequence_privilege(login_role_name, sequence.oid, 'SELECT')
        OR has_sequence_privilege(login_role_name, sequence.oid, 'UPDATE')
      )
  ) THEN
    RETURN false;
  END IF;

  IF NOT has_function_privilege(
    login_role_name,
    'platform.process_runtime_projection_refresh_batch(text,integer,integer)',
    'EXECUTE'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc AS callable
    JOIN pg_namespace AS namespace ON namespace.oid = callable.pronamespace
    WHERE callable.prosecdef
      AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public')
      AND has_function_privilege(login_role_name, callable.oid, 'EXECUTE')
      AND callable.oid IS DISTINCT FROM to_regprocedure(
        'platform.process_runtime_projection_refresh_batch(text,integer,integer)'
      )
      AND callable.oid IS DISTINCT FROM to_regprocedure(
        'platform.projection_worker_credential_ready()'
      )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END
$function$;

ALTER FUNCTION platform.projection_worker_credential_ready() OWNER TO neondb_owner;
REVOKE ALL ON FUNCTION platform.projection_worker_credential_ready()
  FROM PUBLIC, app_runtime, app_production_runtime, app_projection_recovery,
       app_projection_monitor, app_projection_admin, app_projection_publisher,
       app_projection_composer;
GRANT EXECUTE ON FUNCTION platform.projection_worker_credential_ready()
  TO app_projection_worker;

DO $projection_worker_contract$
BEGIN
  IF NOT has_function_privilege(
    'app_projection_worker',
    'platform.process_runtime_projection_refresh_batch(text,integer,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_projection_worker must execute only the projection batch boundary';
  END IF;

  IF has_function_privilege(
    'app_production_runtime',
    'platform.process_runtime_projection_refresh_batch(text,integer,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_production_runtime must not execute the projection batch boundary';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members AS membership
    JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles AS member_role ON member_role.oid = membership.member
    WHERE member_role.rolname = 'app_projection_worker'
      AND granted_role.rolname <> 'app_projection_worker'
  ) THEN
    RAISE EXCEPTION 'app_projection_worker must not inherit any service or runtime role';
  END IF;
END
$projection_worker_contract$;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608140001_PROD-09_projection_worker_credential',
  'PROD-09',
  'Dedicated function-only runtime projection worker role and fail-closed credential readiness boundary'
)
ON CONFLICT (migration_id) DO NOTHING;
