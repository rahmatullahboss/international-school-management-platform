#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
PRODUCTION_MANIFEST="infra/database/production-migration-manifest.json"

mapfile -t migrations < <(
  node --input-type=module - "$PRODUCTION_MANIFEST" <<'NODE'
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.gate !== 'GATE-PRODUCTION-DEMO-RUNTIME-V1') {
  throw new Error(`unexpected production gate: ${manifest.gate}`);
}
if (manifest.baseManifest !== 'infra/database/post-integration-migration-manifest.json') {
  throw new Error('production manifest must extend the reviewed post-integration manifest');
}
const migrations = manifest.migrations ?? [];
if (migrations.length !== 4) {
  throw new Error(`expected four production migrations, got ${migrations.length}`);
}
for (const [index, migration] of migrations.entries()) {
  if (migration.order !== index + 1) throw new Error('production migration orders are not contiguous');
  const expectedStream = `PROD-${String(index + 1).padStart(2, '0')}`;
  if (migration.stream !== expectedStream) throw new Error(`unexpected stream: ${migration.stream}`);
  if (!existsSync(migration.path)) throw new Error(`missing migration: ${migration.path}`);
  console.log(migration.path);
}
NODE
)

for migration in "${migrations[@]}"; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done

"${PSQL[@]}" <<'SQL'
DO $verification$
BEGIN
  IF (SELECT count(*) FROM platform.schema_migration) <> 57 THEN
    RAISE EXCEPTION 'expected 57 total migration ledger rows after production hardening';
  END IF;
  IF to_regprocedure('iam.resolve_browser_workspace(uuid)') IS NULL THEN
    RAISE EXCEPTION 'browser workspace resolver is missing';
  END IF;
  IF to_regprocedure('platform.resolve_operator_work_queue(uuid)') IS NULL THEN
    RAISE EXCEPTION 'operator work queue resolver is missing';
  END IF;
  IF to_regprocedure('platform.production_runtime_credential_ready()') IS NULL THEN
    RAISE EXCEPTION 'production runtime credential readiness function is missing';
  END IF;
  IF NOT has_function_privilege(
    'app_production_runtime',
    'platform.production_runtime_credential_ready()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'production runtime capability role cannot execute credential readiness';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'app_production_runtime'
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolreplication
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'production runtime capability role flags are invalid';
  END IF;
  IF pg_has_role('app_production_runtime', 'app_runtime', 'MEMBER') THEN
    RAISE EXCEPTION 'production runtime role must not inherit app_runtime';
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
        has_table_privilege('app_production_runtime', relation.oid, 'SELECT')
        OR has_table_privilege('app_production_runtime', relation.oid, 'INSERT')
        OR has_table_privilege('app_production_runtime', relation.oid, 'UPDATE')
        OR has_table_privilege('app_production_runtime', relation.oid, 'DELETE')
      )
  ) THEN
    RAISE EXCEPTION 'production runtime role must not have application table CRUD';
  END IF;
  IF (
    SELECT count(*)
    FROM pg_proc AS function
    JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
    WHERE function.prosecdef
      AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public')
      AND has_function_privilege('app_production_runtime', function.oid, 'EXECUTE')
  ) <> 19 THEN
    RAISE EXCEPTION 'production runtime SECURITY DEFINER allowlist is not exact';
  END IF;
  IF has_function_privilege('app_production_runtime', 'billing.allocate_document_number(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('app_production_runtime', 'ledger.close_period(uuid,text)', 'EXECUTE')
     OR has_function_privilege('app_production_runtime', 'ledger.post_journal_entry(uuid,text)', 'EXECUTE')
     OR has_function_privilege('app_production_runtime', 'ledger.reopen_period(uuid,text,text)', 'EXECUTE')
     OR (
       to_regprocedure('public.show_db_tree()') IS NOT NULL
       AND has_function_privilege(
         'app_production_runtime',
         to_regprocedure('public.show_db_tree()'),
         'EXECUTE'
       )
     ) THEN
    RAISE EXCEPTION 'production runtime role can execute an unreviewed privileged helper';
  END IF;
  IF NOT has_function_privilege('app_runtime', 'iam.resolve_browser_workspace(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime must execute the workspace resolver';
  END IF;
  IF NOT has_function_privilege('app_runtime', 'platform.resolve_operator_work_queue(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime must execute the operator work queue resolver';
  END IF;
  IF has_table_privilege('app_runtime', 'iam.browser_session_registry', 'SELECT')
     OR has_table_privilege('app_runtime', 'iam.oidc_membership_binding', 'SELECT')
     OR has_table_privilege('app_runtime', 'iam.oidc_membership_role_binding', 'SELECT') THEN
    RAISE EXCEPTION 'app_runtime must not gain direct protected IAM session/binding table access';
  END IF;
END
$verification$;

INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile,
  database_binding, provisioning_status
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  'production-workspace-test',
  'Production Workspace Test School',
  'test',
  'regional-pooled',
  'test',
  'active'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  'Production Workspace Test School',
  'BD',
  'BDT'
)
ON CONFLICT (tenant_id, legal_entity_id) DO NOTHING;

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000003',
  '95000000-0000-4000-8000-000000000002',
  'PROD',
  'Production Test Campus',
  'Asia/Dhaka'
)
ON CONFLICT (tenant_id, campus_id) DO NOTHING;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '95000000-0000-4000-8000-000000000004',
  'https://identity.production.test',
  'production-admin',
  'production-admin@school.test',
  'aal2'
)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000005',
  'admin',
  'Production Test Administrator',
  true
)
ON CONFLICT (tenant_id, role_id) DO NOTHING;

INSERT INTO iam.permission (permission_key, description, required_assurance)
VALUES ('production.workspace.read', 'Production workspace test permission', 'aal1')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000005',
  'production.workspace.read'
)
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000006',
  '95000000-0000-4000-8000-000000000004',
  '95000000-0000-4000-8000-000000000003',
  'active'
)
ON CONFLICT (tenant_id, membership_id) DO NOTHING;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000006',
  '95000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '95000000-0000-4000-8000-000000000007',
  'https://identity.production.test',
  'production-admin',
  '95000000-0000-4000-8000-000000000004',
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000006',
  '95000000-0000-4000-8000-000000000003',
  'active'
)
ON CONFLICT (binding_id) DO NOTHING;

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000007',
  '95000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

DO $session$
BEGIN
  IF NOT iam.register_browser_session(
    '95000000-0000-4000-8000-000000000008',
    '95000000-0000-4000-8000-000000000004',
    '95000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000006',
    '95000000-0000-4000-8000-000000000003',
    'production-workspace-provider-session',
    ARRAY['95000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'production workspace test session was not registered';
  END IF;
END
$session$;
SQL

workspace="$("${PSQL[@]}" -Atqc "SET ROLE app_production_runtime; SELECT role_key || ':' || array_to_string(capabilities, ',') FROM iam.resolve_browser_workspace('95000000-0000-4000-8000-000000000008'::uuid);")"
if [[ "$workspace" != "admin:production.workspace.read" ]]; then
  echo "Unexpected production workspace result: $workspace" >&2
  exit 1
fi

admin_queue="$("${PSQL[@]}" -Atqc "SET ROLE app_production_runtime; SELECT COALESCE(platform.resolve_operator_work_queue('95000000-0000-4000-8000-000000000008'::uuid)::text, 'null');")"
if [[ "$admin_queue" != "null" ]]; then
  echo 'Non-operator admin session unexpectedly resolved an operator work queue.' >&2
  exit 1
fi

"${PSQL[@]}" -Atqc "SELECT iam.revoke_browser_session('95000000-0000-4000-8000-000000000008'::uuid, 'production workspace verification complete')" >/dev/null
post_revoke="$("${PSQL[@]}" -Atqc "SET ROLE app_production_runtime; SELECT count(*) FROM iam.resolve_browser_workspace('95000000-0000-4000-8000-000000000008'::uuid);")"
if [[ "$post_revoke" != "0" ]]; then
  echo 'Revoked session still resolved a production workspace.' >&2
  exit 1
fi

echo 'Production runtime migrations and scoped workspace/work-queue verification passed.'
