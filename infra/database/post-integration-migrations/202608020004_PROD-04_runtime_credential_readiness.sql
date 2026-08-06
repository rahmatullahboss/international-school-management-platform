CREATE OR REPLACE FUNCTION platform.production_runtime_credential_ready()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform
AS $function$
DECLARE
  login_role_name text := session_user;
  login_role pg_roles%ROWTYPE;
  executable_security_definer_count bigint;
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

  IF NOT pg_has_role(login_role_name, 'app_production_runtime', 'MEMBER')
     OR pg_has_role(login_role_name, 'app_runtime', 'MEMBER') THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser') THEN
    IF pg_has_role(login_role_name, 'neon_superuser', 'MEMBER') THEN
      RETURN false;
    END IF;
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

  SELECT count(*)
  INTO executable_security_definer_count
  FROM pg_proc AS callable
  JOIN pg_namespace AS namespace ON namespace.oid = callable.pronamespace
  WHERE callable.prosecdef
    AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public')
    AND has_function_privilege(login_role_name, callable.oid, 'EXECUTE');

  IF executable_security_definer_count <> 19 THEN
    RETURN false;
  END IF;

  IF has_function_privilege(login_role_name, 'billing.allocate_document_number(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege(login_role_name, 'ledger.close_period(uuid,text)', 'EXECUTE')
     OR has_function_privilege(login_role_name, 'ledger.post_journal_entry(uuid,text)', 'EXECUTE')
     OR has_function_privilege(login_role_name, 'ledger.reopen_period(uuid,text,text)', 'EXECUTE') THEN
    RETURN false;
  END IF;

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION platform.production_runtime_credential_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.production_runtime_credential_ready()
  TO app_production_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608020004_PROD-04_runtime_credential_readiness',
  'PROD-04',
  'Fail-closed production database login identity and privilege readiness assertion'
)
ON CONFLICT (migration_id) DO NOTHING;
