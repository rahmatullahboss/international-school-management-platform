DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_production_runtime') THEN
    CREATE ROLE app_production_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      INHERIT;
  END IF;
END
$role$;

ALTER ROLE app_production_runtime
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  INHERIT;

COMMENT ON ROLE app_production_runtime IS
  'Production API capability role. Attach only reviewed login credentials; direct application-table access is forbidden.';

REVOKE EXECUTE ON FUNCTION billing.allocate_document_number(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ledger.close_period(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ledger.post_journal_entry(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ledger.reopen_period(uuid, text, text) FROM PUBLIC;

DO $debug_helper$
BEGIN
  IF to_regprocedure('public.show_db_tree()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.show_db_tree() FROM PUBLIC;
  END IF;
END
$debug_helper$;

DO $tables$
DECLARE
  schema_name text;
BEGIN
  FOR schema_name IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND nspname NOT LIKE 'pg_temp_%'
      AND nspname NOT LIKE 'pg_toast_temp_%'
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM app_production_runtime',
      schema_name
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM app_production_runtime',
      schema_name
    );
  END LOOP;
END
$tables$;

GRANT USAGE ON SCHEMA iam, platform, admissions, billing TO app_production_runtime;

GRANT EXECUTE ON FUNCTION iam.consume_oauth_transaction(uuid, text, timestamptz)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.resolve_oidc_memberships(text, text)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.register_browser_session(
  uuid, uuid, uuid, uuid, uuid, text, uuid[], text, timestamptz, timestamptz
) TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.process_oidc_backchannel_logout(
  text, text, text, text, timestamptz, timestamptz, text
) TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.evaluate_browser_permission(uuid, text)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.is_browser_session_active(uuid)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.revoke_browser_session(uuid, text)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.revoke_account_browser_sessions(uuid, text)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.read_oidc_provider_cache(text)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.write_oidc_provider_cache(text, jsonb)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.resolve_browser_workspace(uuid)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION platform.resolve_runtime_read_model_head(uuid)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION platform.read_runtime_read_model_payload(uuid, bigint, text, text)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION platform.submit_runtime_snapshot_refresh(uuid, text, bigint, text, uuid)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION platform.resolve_operator_work_queue(uuid)
  TO app_production_runtime;
GRANT EXECUTE ON FUNCTION admissions.record_application_review_command(
  uuid, uuid, bigint, text, numeric, text, text, uuid
) TO app_production_runtime;
GRANT EXECUTE ON FUNCTION billing.reconcile_bank_statement_line_command(
  uuid, uuid, uuid, text, text, uuid
) TO app_production_runtime;
GRANT EXECUTE ON FUNCTION iam.request_privileged_support_access_command(
  uuid, text, integer, text, uuid
) TO app_production_runtime;

INSERT INTO platform.schema_migration (migration_id, stream_id, description)
VALUES (
  '202608020003_PROD-03_production_runtime_role',
  'PROD-03',
  'Least-privilege production API capability role and public security-definer hardening'
)
ON CONFLICT (migration_id) DO NOTHING;
