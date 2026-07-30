#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -d "${PGDATABASE:-postgres}")
POST_MANIFEST="infra/database/post-integration-migration-manifest.json"

bash tests/integration/verify-wave2-migrations.sh >/dev/null

mapfile -t migrations < <(
  node --input-type=module - "$POST_MANIFEST" <<'NODE'
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.gate !== 'GATE-AUTH-BACKCHANNEL-LOGOUT-V1') {
  throw new Error(`unexpected post-integration gate: ${manifest.gate}`);
}
if (manifest.baseManifest !== 'infra/database/migration-manifest.json') {
  throw new Error('post-integration manifest must name the canonical base manifest');
}
const migrations = manifest.migrations ?? [];
if (migrations.length !== 2) {
  throw new Error(`expected two AUTH migrations, got ${migrations.length}`);
}
for (const [index, migration] of migrations.entries()) {
  if (migration.order !== index + 1) throw new Error('AUTH migration orders are not contiguous');
  if (!['AUTH-03', 'AUTH-07'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);
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
  IF (SELECT count(*) FROM platform.schema_migration) <> 42 THEN
    RAISE EXCEPTION 'expected 42 total migration ledger rows';
  END IF;
  IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'AUTH-03') <> 1 THEN
    RAISE EXCEPTION 'expected two AUTH migrations ledger row';
  END IF;
  IF to_regclass('iam.oauth_transaction_consumption') IS NULL
     OR to_regclass('iam.oidc_membership_binding') IS NULL
     OR to_regclass('iam.oidc_membership_role_binding') IS NULL
     OR to_regclass('iam.browser_session_registry') IS NULL
     OR to_regclass('iam.oidc_logout_token_consumption') IS NULL
     OR to_regclass('iam.oidc_provider_cache') IS NULL THEN
    RAISE EXCEPTION 'AUTH-03 durable tables are incomplete';
  END IF;
END
$verification$;

INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile,
  database_binding, provisioning_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  'auth-durable-test',
  'AUTH Durable Test School',
  'test',
  'regional-pooled',
  'test',
  'active'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'AUTH Durable Test School',
  'BD',
  'BDT'
)
ON CONFLICT (tenant_id, legal_entity_id) DO NOTHING;

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000002',
  'AUTH',
  'AUTH Campus',
  'Asia/Dhaka'
)
ON CONFLICT (tenant_id, campus_id) DO NOTHING;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-000000000004',
  'https://identity.school.test',
  'provider-user-123',
  'auth-test@school.test',
  'aal2'
)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000005',
  'auth-test-admin',
  'AUTH Test Administrator',
  false
)
ON CONFLICT (tenant_id, role_id) DO NOTHING;

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000003',
  'active'
)
ON CONFLICT (tenant_id, membership_id) DO NOTHING;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000007',
  'https://identity.school.test',
  'provider-user-123',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000003',
  'active'
)
ON CONFLICT (binding_id) DO NOTHING;

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

SET ROLE app_runtime;

DO $runtime_verification$
DECLARE
  resolved_count integer;
BEGIN
  IF has_table_privilege(current_user, 'iam.oauth_transaction_consumption', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_membership_binding', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_membership_role_binding', 'SELECT')
     OR has_table_privilege(current_user, 'iam.browser_session_registry', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_logout_token_consumption', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_provider_cache', 'SELECT') THEN
    RAISE EXCEPTION 'app_runtime must not have direct durable auth table access';
  END IF;

  SELECT count(*) INTO resolved_count
  FROM iam.resolve_oidc_memberships(
    'https://identity.school.test',
    'provider-user-123'
  )
  WHERE membership_id = '30000000-0000-4000-8000-000000000006'
    AND account_id = '30000000-0000-4000-8000-000000000004'
    AND tenant_id = '30000000-0000-4000-8000-000000000001'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND role_ids = ARRAY['30000000-0000-4000-8000-000000000005'::uuid];
  IF resolved_count <> 1 THEN
    RAISE EXCEPTION 'OIDC membership projection did not resolve exact scope';
  END IF;

  IF NOT iam.consume_oauth_transaction(
    '30000000-0000-4000-8000-000000000008',
    'https://identity.school.test',
    clock_timestamp() + interval '5 minutes'
  ) THEN
    RAISE EXCEPTION 'first OAuth transaction consumption must succeed';
  END IF;
  IF iam.consume_oauth_transaction(
    '30000000-0000-4000-8000-000000000008',
    'https://identity.school.test',
    clock_timestamp() + interval '5 minutes'
  ) THEN
    RAISE EXCEPTION 'OAuth replay must be denied';
  END IF;
  IF iam.consume_oauth_transaction(
    '30000000-0000-4000-8000-00000000000f',
    'https://identity.school.test',
    clock_timestamp() - interval '1 second'
  ) THEN
    RAISE EXCEPTION 'expired OAuth transaction must be denied';
  END IF;

  IF NOT iam.write_oidc_provider_cache('oidc-cache:test', '{"schemaVersion":1}'::jsonb) THEN
    RAISE EXCEPTION 'provider cache write must succeed';
  END IF;
  IF iam.read_oidc_provider_cache('oidc-cache:test') <> '{"schemaVersion":1}'::jsonb THEN
    RAISE EXCEPTION 'provider cache read must return exact value';
  END IF;

  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-abc',
    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'valid browser session registration must succeed';
  END IF;
  IF iam.register_browser_session(
    '30000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-abc',
    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'duplicate session id must be denied';
  END IF;
  IF NOT iam.is_browser_session_active('30000000-0000-4000-8000-000000000009') THEN
    RAISE EXCEPTION 'registered session must be active';
  END IF;
  IF iam.process_oidc_backchannel_logout(
    'logout-token-verification',
    'https://identity.school.test',
    'provider-user-123',
    'provider-session-abc',
    clock_timestamp() - interval '10 seconds',
    clock_timestamp() + interval '5 minutes',
    'provider back-channel logout'
  ) <> '{"replayed": false, "revokedSessions": 1}'::jsonb THEN
    RAISE EXCEPTION 'atomic Logout Token processing must revoke the exact session';
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-000000000009') THEN
    RAISE EXCEPTION 'provider-revoked session must be inactive';
  END IF;
  IF iam.process_oidc_backchannel_logout(
    'logout-token-verification',
    'https://identity.school.test',
    'provider-user-123',
    'provider-session-abc',
    clock_timestamp() - interval '10 seconds',
    clock_timestamp() + interval '5 minutes',
    'provider back-channel logout'
  ) <> '{"replayed": true, "revokedSessions": 0}'::jsonb THEN
    RAISE EXCEPTION 'Logout Token replay must be idempotent';
  END IF;
END
$runtime_verification$;

RESET ROLE;

INSERT INTO iam.browser_session_registry (
  session_id, binding_id, account_id, tenant_id, membership_id, campus_id,
  role_ids, assurance_level, issued_at, expires_at
) VALUES (
  '30000000-0000-4000-8000-00000000000a',
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000003',
  ARRAY['30000000-0000-4000-8000-000000000005'::uuid],
  'aal2',
  clock_timestamp(),
  clock_timestamp() + interval '30 minutes'
)
ON CONFLICT (session_id) DO NOTHING;

DELETE FROM iam.oidc_membership_role_binding
WHERE binding_id = '30000000-0000-4000-8000-000000000007'
  AND role_id = '30000000-0000-4000-8000-000000000005';

SET ROLE app_runtime;
DO $role_change_verification$
BEGIN
  IF iam.is_browser_session_active('30000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'role removal must invalidate the session';
  END IF;
END
$role_change_verification$;
RESET ROLE;

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000005'
)
ON CONFLICT DO NOTHING;

SET ROLE app_runtime;
DO $account_revoke_verification$
DECLARE
  revoked_count integer;
BEGIN
  revoked_count := iam.revoke_account_browser_sessions(
    '30000000-0000-4000-8000-000000000004',
    'verification logout all'
  );
  IF revoked_count <> 1 THEN
    RAISE EXCEPTION 'expected one active account session to be revoked, got %', revoked_count;
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-00000000000a') THEN
    RAISE EXCEPTION 'account-wide revocation must invalidate the session';
  END IF;
END
$account_revoke_verification$;
RESET ROLE;

SELECT json_build_object(
  'canonical_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id <> 'AUTH-03'),
  'auth_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'AUTH-03'),
  'oauth_transactions', (SELECT count(*) FROM iam.oauth_transaction_consumption),
  'membership_bindings', (SELECT count(*) FROM iam.oidc_membership_binding),
  'session_rows', (SELECT count(*) FROM iam.browser_session_registry),
  'app_runtime_direct_table_access', (
    SELECT bool_or(has_table_privilege('app_runtime', table_name, 'SELECT'))
    FROM unnest(ARRAY[
      'iam.oauth_transaction_consumption',
      'iam.oidc_membership_binding',
      'iam.oidc_membership_role_binding',
      'iam.browser_session_registry'
    ]) AS protected(table_name)
  )
);
SQL
