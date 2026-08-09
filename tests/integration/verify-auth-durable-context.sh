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
if (manifest.gate !== 'GATE-PILOT-ADMISSIONS-ACCEPT-CONVERT-COMMANDS-V1') {
  throw new Error(`unexpected post-integration gate: ${manifest.gate}`);
}
if (manifest.baseManifest !== 'infra/database/migration-manifest.json') {
  throw new Error('post-integration manifest must name the canonical base manifest');
}
const migrations = manifest.migrations ?? [];
if (migrations.length !== 15) {
  throw new Error(`expected fifteen post-integration migrations, got ${migrations.length}`);
}
for (const [index, migration] of migrations.entries()) {
  if (migration.order !== index + 1) throw new Error('AUTH migration orders are not contiguous');
  if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12', 'PILOT-13', 'PILOT-14', 'PILOT-15'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);
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
  IF (SELECT count(*) FROM platform.schema_migration) <> 55 THEN
    RAISE EXCEPTION 'expected 55 total migration ledger rows';
  END IF;
  IF (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'AUTH-03') <> 1 THEN
    RAISE EXCEPTION 'expected three AUTH migrations ledger row';
  END IF;
  IF to_regclass('iam.oauth_transaction_consumption') IS NULL
     OR to_regclass('iam.oidc_membership_binding') IS NULL
     OR to_regclass('iam.oidc_membership_role_binding') IS NULL
     OR to_regclass('iam.browser_session_registry') IS NULL
     OR to_regclass('iam.oidc_logout_token_consumption') IS NULL
     OR to_regclass('iam.oidc_provider_cache') IS NULL
     OR to_regclass('platform.runtime_read_model_projection') IS NULL
     OR to_regclass('platform.runtime_command_receipt') IS NULL
     OR to_regclass('platform.runtime_projection_source') IS NULL
     OR to_regclass('platform.runtime_projection_applied_command') IS NULL
     OR to_regclass('platform.runtime_projection_dead_letter') IS NULL
     OR to_regclass('platform.runtime_projection_persona_role') IS NULL
     OR to_regclass('platform.runtime_projection_persona_role_event') IS NULL
     OR to_regclass('platform.runtime_projection_source_publication') IS NULL
     OR to_regclass('platform.runtime_projection_composition_run') IS NULL
     OR to_regprocedure('platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL
     OR to_regprocedure('platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL
     OR to_regprocedure('platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)') IS NULL
     OR to_regprocedure('platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)') IS NULL
     OR to_regclass('platform.operator_domain_command_receipt') IS NULL
     OR to_regprocedure('admissions.record_application_review_command(uuid,uuid,bigint,text,numeric,text,text,uuid)') IS NULL
     OR to_regprocedure('admissions.issue_application_offer_command(uuid,uuid,bigint,uuid,uuid,uuid,timestamptz,text,uuid)') IS NULL
     OR to_regprocedure('admissions.accept_application_offer_command(uuid,uuid,bigint,text,uuid)') IS NULL
     OR to_regprocedure('admissions.convert_accepted_applicant_command(uuid,uuid,bigint,date,text,uuid)') IS NULL
     OR to_regprocedure('billing.reconcile_bank_statement_line_command(uuid,uuid,uuid,text,text,uuid)') IS NULL
     OR to_regprocedure('iam.request_privileged_support_access_command(uuid,text,integer,text,uuid)') IS NULL THEN
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



INSERT INTO iam.permission(permission_key, description, required_assurance) VALUES
  ('finance.read', 'Read finance summaries', 'aal1'),
  ('records.approve', 'Approve academic records', 'aal2'),
  ('care.restricted.read', 'Read restricted care records', 'aal2')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description,
    required_assurance = EXCLUDED.required_assurance;

INSERT INTO iam.role_permission(tenant_id, role_id, permission_key) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'finance.read'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'records.approve'
  )
ON CONFLICT DO NOTHING;

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

INSERT INTO platform.runtime_read_model_projection (
  tenant_id,
  membership_id,
  campus_id,
  projection_key,
  persona,
  subject_ref,
  revision,
  payload,
  source_updated_at,
  generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'admin',
  'principal-dashboard',
  7,
  '{"metrics":[{"id":"students","value":42}],"source":"database"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
)
ON CONFLICT (tenant_id, membership_id, campus_id, projection_key) DO UPDATE
SET persona = EXCLUDED.persona,
    subject_ref = EXCLUDED.subject_ref,
    revision = EXCLUDED.revision,
    payload = EXCLUDED.payload,
    source_updated_at = EXCLUDED.source_updated_at,
    generated_at = EXCLUDED.generated_at;

SET ROLE app_runtime;

DO $runtime_verification$
DECLARE
  resolved_count integer;
  read_head record;
  read_payload jsonb;
BEGIN
  IF has_table_privilege(current_user, 'iam.oauth_transaction_consumption', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_membership_binding', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_membership_role_binding', 'SELECT')
     OR has_table_privilege(current_user, 'iam.browser_session_registry', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_logout_token_consumption', 'SELECT')
     OR has_table_privilege(current_user, 'iam.oidc_provider_cache', 'SELECT')
     OR has_table_privilege(current_user, 'platform.runtime_read_model_projection', 'SELECT') THEN
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

  SELECT * INTO read_head
  FROM platform.resolve_runtime_read_model_head(
    '30000000-0000-4000-8000-000000000009'
  );
  IF read_head.tenant_id <> '30000000-0000-4000-8000-000000000001'::uuid
     OR read_head.membership_id <> '30000000-0000-4000-8000-000000000006'::uuid
     OR read_head.campus_id <> '30000000-0000-4000-8000-000000000003'::uuid
     OR read_head.persona <> 'admin'
     OR read_head.subject_ref <> 'principal-dashboard'
     OR read_head.capabilities <> ARRAY['finance.read', 'records.approve']::text[]
     OR read_head.revision <> 7
     OR length(read_head.payload_digest) <> 64
     OR length(read_head.capability_digest) <> 64
     OR read_head.payload_bytes < 2 THEN
    RAISE EXCEPTION 'runtime read-model head did not preserve exact server-owned scope';
  END IF;

  SELECT payload INTO read_payload
  FROM platform.read_runtime_read_model_payload(
    '30000000-0000-4000-8000-000000000009',
    read_head.revision,
    read_head.payload_digest,
    read_head.capability_digest
  );
  IF read_payload <> '{"metrics":[{"id":"students","value":42}],"source":"database"}'::jsonb THEN
    RAISE EXCEPTION 'runtime read-model payload did not match the exact head tuple';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.read_runtime_read_model_payload(
      '30000000-0000-4000-8000-000000000009',
      read_head.revision,
      repeat('0', 64),
      read_head.capability_digest
    )
  ) OR EXISTS (
    SELECT 1
    FROM platform.read_runtime_read_model_payload(
      '30000000-0000-4000-8000-000000000009',
      read_head.revision,
      read_head.payload_digest,
      repeat('0', 64)
    )
  ) THEN
    RAISE EXCEPTION 'digest mismatch must deny runtime read-model payload access';
  END IF;

  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-000000000009',
    'finance.read'
  ) <> '{"allowed": true, "reason": "role-grant"}'::jsonb THEN
    RAISE EXCEPTION 'database-granted AAL1 permission must be allowed';
  END IF;
  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-000000000009',
    'care.restricted.read'
  ) <> '{"allowed": false, "reason": "permission-not-granted"}'::jsonb THEN
    RAISE EXCEPTION 'ungranted restricted permission must be denied';
  END IF;



  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-00000000000b',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-aal1',
    ARRAY['30000000-0000-4000-8000-000000000005'::uuid],
    'aal1',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'AAL1 browser session registration must succeed';
  END IF;
  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-00000000000b',
    'records.approve'
  ) <> '{"allowed": false, "reason": "step-up-required", "requiredAssurance": "aal2"}'::jsonb THEN
    RAISE EXCEPTION 'AAL1 session must require AAL2 step-up';
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

  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-00000000000a',
    'finance.read'
  ) <> '{"allowed": false, "reason": "session-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'role removal must invalidate permission evaluation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.resolve_runtime_read_model_head(
      '30000000-0000-4000-8000-00000000000a'
    )
  ) THEN
    RAISE EXCEPTION 'role removal must invalidate runtime read-model access';
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


INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000005',
  'runtime.snapshot.refresh'
)
ON CONFLICT DO NOTHING;

INSERT INTO iam.browser_session_registry (
  session_id, binding_id, account_id, tenant_id, membership_id, campus_id,
  role_ids, assurance_level, issued_at, expires_at
) VALUES (
  '30000000-0000-4000-8000-00000000000c',
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

SET ROLE app_runtime;
DO $mutation_verification$
DECLARE
  decision jsonb;
  first_receipt jsonb;
BEGIN
  IF has_table_privilege(current_user, 'platform.runtime_command_receipt', 'SELECT') THEN
    RAISE EXCEPTION 'app_runtime must not have direct runtime command receipt access';
  END IF;

  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0001',
    7,
    'Refresh after the approved timetable publication.',
    '30000000-0000-4000-8000-00000000000d'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'first runtime snapshot refresh must be accepted: %', decision;
  END IF;
  first_receipt := decision->'receipt';

  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0001',
    7,
    'Refresh after the approved timetable publication.',
    '30000000-0000-4000-8000-00000000000e'
  );
  IF decision->>'accepted' <> 'true'
     OR decision->>'replayed' <> 'true'
     OR decision->'receipt' <> first_receipt THEN
    RAISE EXCEPTION 'same idempotency request must replay the original receipt: %', decision;
  END IF;

  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0001',
    7,
    'A different request with the same key.',
    '30000000-0000-4000-8000-000000000010'
  );
  IF decision <> '{"accepted": false, "reason": "idempotency-conflict"}'::jsonb THEN
    RAISE EXCEPTION 'same key with a different request must conflict: %', decision;
  END IF;

  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0002',
    6,
    'Refresh after the approved timetable publication.',
    '30000000-0000-4000-8000-000000000011'
  );
  IF decision <> '{"accepted": false, "reason": "revision-conflict", "currentRevision": 7}'::jsonb THEN
    RAISE EXCEPTION 'stale revision must conflict without accepting a command: %', decision;
  END IF;

  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000b',
    'refresh-admin-home-0003',
    7,
    'Refresh after the approved timetable publication.',
    '30000000-0000-4000-8000-000000000012'
  );
  IF decision <> '{"accepted": false, "reason": "step-up-required", "requiredAssurance": "aal2"}'::jsonb THEN
    RAISE EXCEPTION 'AAL1 mutation must require AAL2: %', decision;
  END IF;
END
$mutation_verification$;
RESET ROLE;

DO $mutation_persistence_verification$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_command_receipt
    WHERE idempotency_key = 'refresh-admin-home-0001'
  ) <> 1 THEN
    RAISE EXCEPTION 'idempotent mutation must persist exactly one receipt';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE action = 'runtime.snapshot.refresh.accepted'
      AND correlation_id = '30000000-0000-4000-8000-00000000000d'
  ) <> 1 THEN
    RAISE EXCEPTION 'accepted mutation must persist exactly one audit record';
  END IF;
  IF (
    SELECT count(*)
    FROM integration_core.outbox_event
    WHERE event_type = 'platform.runtime_snapshot_refresh_requested'
      AND correlation_id = '30000000-0000-4000-8000-00000000000d'
  ) <> 1 THEN
    RAISE EXCEPTION 'accepted mutation must persist exactly one outbox event';
  END IF;
END
$mutation_persistence_verification$;

DELETE FROM iam.role_permission
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND role_id = '30000000-0000-4000-8000-000000000005'
  AND permission_key = 'runtime.snapshot.refresh';

SET ROLE app_runtime;
DO $mutation_permission_change_verification$
DECLARE
  decision jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0004',
    7,
    'Refresh after the approved timetable publication.',
    '30000000-0000-4000-8000-000000000013'
  );
  IF decision <> '{"accepted": false, "reason": "permission-not-granted"}'::jsonb THEN
    RAISE EXCEPTION 'current permission removal must deny the mutation: %', decision;
  END IF;
END
$mutation_permission_change_verification$;
RESET ROLE;

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000005',
  'runtime.snapshot.refresh'
)
ON CONFLICT DO NOTHING;


INSERT INTO platform.runtime_projection_source (
  tenant_id,
  membership_id,
  campus_id,
  projection_key,
  persona,
  subject_ref,
  source_revision,
  payload,
  source_updated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'admin',
  'principal-dashboard',
  8,
  '{"metrics":[{"id":"students","value":43}],"source":"projection-worker"}'::jsonb,
  clock_timestamp()
)
ON CONFLICT (tenant_id, membership_id, campus_id, projection_key) DO UPDATE
SET persona = EXCLUDED.persona,
    subject_ref = EXCLUDED.subject_ref,
    source_revision = EXCLUDED.source_revision,
    payload = EXCLUDED.payload,
    source_updated_at = EXCLUDED.source_updated_at;

INSERT INTO integration_core.outbox_event (
  tenant_id,
  event_id,
  event_type,
  schema_version,
  aggregate_type,
  aggregate_id,
  aggregate_version,
  correlation_id,
  payload,
  occurred_at,
  available_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000014',
  'platform.unrelated_projection_event',
  1,
  'runtime_projection',
  'unrelated',
  1,
  '30000000-0000-4000-8000-000000000014',
  '{}'::jsonb,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (tenant_id, event_id) DO NOTHING;

SET ROLE app_runtime;
DO $projection_worker_success$
DECLARE
  result jsonb;
BEGIN
  IF has_table_privilege(current_user, 'platform.runtime_projection_source', 'SELECT')
     OR has_table_privilege(current_user, 'platform.runtime_projection_applied_command', 'SELECT')
     OR has_table_privilege(current_user, 'platform.runtime_projection_dead_letter', 'SELECT') THEN
    RAISE EXCEPTION 'app_runtime must not have direct runtime projection lifecycle table access';
  END IF;
  IF position(
    'SKIP LOCKED' IN upper(
      pg_get_functiondef(
        'platform.process_runtime_projection_refresh_batch(text,integer,integer)'::regprocedure
      )
    )
  ) = 0 THEN
    RAISE EXCEPTION 'runtime projection batch processor must use SKIP LOCKED';
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-01',
    20,
    5
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'runtime projection success batch was unexpected: %', result;
  END IF;
END
$projection_worker_success$;
RESET ROLE;

DO $projection_worker_success_persistence$
DECLARE
  refreshed_payload jsonb;
BEGIN
  SELECT payload INTO refreshed_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000006'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 8;
  IF refreshed_payload <> '{"metrics":[{"id":"students","value":43}],"source":"projection-worker"}'::jsonb THEN
    RAISE EXCEPTION 'runtime projection worker did not copy the exact bounded source';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-admin-home-0001'
  ) <> 1 THEN
    RAISE EXCEPTION 'runtime projection command must be applied exactly once';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE action = 'runtime.snapshot.refresh.completed'
      AND correlation_id = '30000000-0000-4000-8000-00000000000d'
  ) <> 1 THEN
    RAISE EXCEPTION 'completed runtime projection command must have one audit event';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE event_type = 'platform.runtime_snapshot_refresh_requested'
      AND correlation_id = '30000000-0000-4000-8000-00000000000d'
      AND (published_at IS NULL OR attempt_count <> 1 OR last_error IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'completed runtime projection event was not terminally published';
  END IF;
END
$projection_worker_success_persistence$;

INSERT INTO integration_core.outbox_event (
  tenant_id,
  event_id,
  event_type,
  schema_version,
  aggregate_type,
  aggregate_id,
  aggregate_version,
  correlation_id,
  causation_id,
  payload,
  occurred_at,
  available_at
)
SELECT
  receipt.tenant_id,
  '30000000-0000-4000-8000-000000000015'::uuid,
  'platform.runtime_snapshot_refresh_requested',
  1,
  'runtime_projection',
  receipt.membership_id::text,
  receipt.expected_revision + 1,
  receipt.correlation_id::text,
  receipt.command_id::text,
  jsonb_build_object(
    'commandId', receipt.command_id,
    'membershipId', receipt.membership_id,
    'campusId', receipt.campus_id,
    'expectedRevision', receipt.expected_revision,
    'reason', 'Refresh after the approved timetable publication.'
  ),
  clock_timestamp(),
  clock_timestamp()
FROM platform.runtime_command_receipt AS receipt
WHERE receipt.idempotency_key = 'refresh-admin-home-0001'
ON CONFLICT (tenant_id, event_id) DO NOTHING;

SET ROLE app_runtime;
DO $projection_worker_duplicate$
DECLARE
  result jsonb;
BEGIN
  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-02',
    20,
    5
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'duplicate delivery must complete idempotently: %', result;
  END IF;
END
$projection_worker_duplicate$;
RESET ROLE;

DO $projection_worker_duplicate_persistence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-admin-home-0001'
  ) <> 1 THEN
    RAISE EXCEPTION 'duplicate event must not duplicate the applied-command record';
  END IF;
  IF (
    SELECT revision
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 8 THEN
    RAISE EXCEPTION 'duplicate event must not advance the projection revision';
  END IF;
END
$projection_worker_duplicate_persistence$;


INSERT INTO integration_core.outbox_event (
  tenant_id,
  event_id,
  event_type,
  schema_version,
  aggregate_type,
  aggregate_id,
  aggregate_version,
  correlation_id,
  causation_id,
  payload,
  occurred_at,
  available_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000017',
  'platform.runtime_snapshot_refresh_requested',
  1,
  'runtime_projection',
  '30000000-0000-4000-8000-000000000006',
  9,
  '30000000-0000-4000-8000-000000000017',
  '30000000-0000-4000-8000-000000000018',
  jsonb_build_object(
    'commandId', '30000000-0000-4000-8000-000000000018',
    'membershipId', '30000000-0000-4000-8000-000000000006',
    'campusId', '30000000-0000-4000-8000-000000000003',
    'expectedRevision', 8,
    'reason', 'Reject an event that has no durable command receipt.'
  ),
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (tenant_id, event_id) DO NOTHING;

SET ROLE app_runtime;
DO $projection_worker_unknown_command$
DECLARE
  result jsonb;
BEGIN
  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-05',
    20,
    5
  );
  IF result <> '{"claimed": 1, "completed": 0, "retried": 0, "deadLettered": 1}'::jsonb THEN
    RAISE EXCEPTION 'unknown command event must be isolated as invalid: %', result;
  END IF;
END
$projection_worker_unknown_command$;
RESET ROLE;

DO $projection_worker_unknown_command_persistence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_dead_letter
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND event_id = '30000000-0000-4000-8000-000000000017'
      AND command_id IS NULL
      AND error_code = 'invalid-event'
      AND attempt_count = 1
  ) <> 1 THEN
    RAISE EXCEPTION 'unknown command event must persist one nullable invalid-event dead letter';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND event_id = '30000000-0000-4000-8000-000000000017'
      AND (published_at IS NULL OR attempt_count <> 1 OR last_error <> 'invalid-event')
  ) THEN
    RAISE EXCEPTION 'unknown command event must be terminally published';
  END IF;
END
$projection_worker_unknown_command_persistence$;

SET ROLE app_runtime;
DO $projection_worker_retry_command$
DECLARE
  decision jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0005',
    8,
    'Refresh while the projection source is temporarily unavailable.',
    '30000000-0000-4000-8000-000000000016'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'retry-path runtime command must be accepted: %', decision;
  END IF;
END
$projection_worker_retry_command$;
RESET ROLE;

DELETE FROM platform.runtime_projection_source
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006'
  AND campus_id = '30000000-0000-4000-8000-000000000003'
  AND projection_key = 'home';

SET ROLE app_runtime;
DO $projection_worker_retry$
DECLARE
  result jsonb;
BEGIN
  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-03',
    20,
    2
  );
  IF result <> '{"claimed": 1, "completed": 0, "retried": 1, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'missing projection source must schedule a bounded retry: %', result;
  END IF;
END
$projection_worker_retry$;
RESET ROLE;

UPDATE integration_core.outbox_event
SET available_at = clock_timestamp()
WHERE event_type = 'platform.runtime_snapshot_refresh_requested'
  AND correlation_id = '30000000-0000-4000-8000-000000000016';

SET ROLE app_runtime;
DO $projection_worker_dead_letter$
DECLARE
  result jsonb;
BEGIN
  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-04',
    20,
    2
  );
  IF result <> '{"claimed": 1, "completed": 0, "retried": 0, "deadLettered": 1}'::jsonb THEN
    RAISE EXCEPTION 'max-attempt projection event must be dead-lettered: %', result;
  END IF;
END
$projection_worker_dead_letter$;
RESET ROLE;

DO $projection_worker_failure_persistence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_dead_letter AS dead_letter
    JOIN integration_core.outbox_event AS event
      ON event.tenant_id = dead_letter.tenant_id
     AND event.event_id = dead_letter.event_id
    WHERE event.correlation_id = '30000000-0000-4000-8000-000000000016'
      AND dead_letter.error_code = 'source-unavailable'
      AND dead_letter.attempt_count = 2
  ) <> 1 THEN
    RAISE EXCEPTION 'exhausted projection event must persist one sanitized dead letter';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE correlation_id = '30000000-0000-4000-8000-000000000016'
      AND (published_at IS NULL OR attempt_count <> 2 OR last_error <> 'source-unavailable')
  ) THEN
    RAISE EXCEPTION 'dead-lettered projection event must be terminally published';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM integration_core.outbox_event
    WHERE event_id = '30000000-0000-4000-8000-000000000014'
      AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'unrelated outbox event must remain untouched by the exact allowlist';
  END IF;
  IF (
    SELECT revision
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 8 THEN
    RAISE EXCEPTION 'retry/dead-letter failure must not mutate the projection';
  END IF;
END
$projection_worker_failure_persistence$;


DO $projection_source_privilege_contract$
BEGIN
  IF has_function_privilege(
       'app_runtime',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.configure_runtime_projection_persona_role(uuid,uuid,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'projection source role separation is not least privilege';
  END IF;

  IF NOT has_function_privilege(
       'app_projection_admin',
       'platform.configure_runtime_projection_persona_role(uuid,uuid,text,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'app_projection_publisher',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'projection source role grants are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['app_runtime', 'app_projection_admin', 'app_projection_publisher']) AS role_name
    CROSS JOIN unnest(ARRAY[
      'platform.runtime_projection_persona_role',
      'platform.runtime_projection_persona_role_event',
      'platform.runtime_projection_source_publication'
    ]) AS protected_table
    WHERE has_table_privilege(role_name, protected_table, 'SELECT')
       OR has_table_privilege(role_name, protected_table, 'INSERT')
       OR has_table_privilege(role_name, protected_table, 'UPDATE')
       OR has_table_privilege(role_name, protected_table, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'projection source roles must retain function-only table access';
  END IF;
END
$projection_source_privilege_contract$;

SET ROLE app_projection_admin;
DO $projection_source_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'admin',
    'governance:pilot-07'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'admin' THEN
    RAISE EXCEPTION 'reviewed admin persona mapping must configure: %', result;
  END IF;
END
$projection_source_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_publisher;
DO $projection_source_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    0,
    '{"metrics":[{"id":"students","value":43}],"source":"database-composer"}'::jsonb,
    clock_timestamp() - interval '30 seconds',
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000020'
  );
  IF result->>'published' <> 'true'
     OR result->'publication'->>'persona' <> 'admin'
     OR result->'publication'->>'subjectRef'
          <> 'account:30000000-0000-4000-8000-000000000004'
     OR (result->'publication'->>'sourceRevision')::bigint <> 1
     OR length(result->'publication'->>'payloadDigest') <> 64
     OR (result->'publication'->>'payloadBytes')::integer < 2 THEN
    RAISE EXCEPTION 'first controlled source publication failed: %', result;
  END IF;
END
$projection_source_first_publication$;

DO $projection_source_negative_contracts$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    0,
    '{"metrics":[]}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000021'
  );
  IF result <> '{"published": false, "reason": "revision-conflict", "currentRevision": 1}'::jsonb THEN
    RAISE EXCEPTION 'stale source revision must be rejected exactly: %', result;
  END IF;

  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    1,
    '{"scope":{"tenantId":"browser-selected"}}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000022'
  );
  IF result <> '{"published": false, "reason": "invalid-publication"}'::jsonb THEN
    RAISE EXCEPTION 'browser-like scope injection must be rejected: %', result;
  END IF;

  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    1,
    '{"metrics":[]}'::jsonb,
    clock_timestamp() - interval '5 minutes',
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000023'
  );
  IF result <> '{"published": false, "reason": "source-stale"}'::jsonb THEN
    RAISE EXCEPTION 'older source timestamps must be rejected: %', result;
  END IF;
END
$projection_source_negative_contracts$;

DO $projection_source_second_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    1,
    '{"metrics":[{"id":"students","value":44}],"source":"database-composer-v2"}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000024'
  );
  IF result->>'published' <> 'true'
     OR (result->'publication'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'second controlled source publication failed: %', result;
  END IF;
END
$projection_source_second_publication$;
RESET ROLE;

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000025',
  'auth-test-teacher',
  'AUTH Test Teacher',
  false
);
INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000025'
);

SET ROLE app_projection_admin;
SELECT platform.configure_runtime_projection_persona_role(
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000025',
  'teacher',
  'governance:pilot-07'
);
RESET ROLE;

SET ROLE app_projection_publisher;
DO $projection_source_ambiguous_persona$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    2,
    '{"metrics":[]}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000026'
  );
  IF result <> '{"published": false, "reason": "persona-ambiguous"}'::jsonb THEN
    RAISE EXCEPTION 'conflicting mapped personas must fail closed: %', result;
  END IF;
END
$projection_source_ambiguous_persona$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006'
  AND role_id = '30000000-0000-4000-8000-000000000025';

-- Keep the reviewed mapping and its append-only event as durable governance evidence.
-- The role fixture therefore remains present for the lifetime of this isolated test database.

UPDATE iam.membership
SET status = 'suspended'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_projection_publisher;
DO $projection_source_inactive_scope$
DECLARE
  result jsonb;
BEGIN
  result := platform.publish_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    2,
    '{"metrics":[]}'::jsonb,
    clock_timestamp(),
    'projection-composer-test-01',
    '30000000-0000-4000-8000-000000000027'
  );
  IF result <> '{"published": false, "reason": "scope-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'inactive memberships must not publish sources: %', result;
  END IF;
END
$projection_source_inactive_scope$;
RESET ROLE;

UPDATE iam.membership
SET status = 'active'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_runtime;
DO $projection_source_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0006',
    8,
    'Apply the reviewed database-owned source publication.',
    '30000000-0000-4000-8000-000000000028'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'published source refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-05',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'published source must apply through the durable worker: %', result;
  END IF;
END
$projection_source_end_to_end_refresh$;
RESET ROLE;

DO $projection_source_persistence$
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
  ) <> 2 THEN
    RAISE EXCEPTION 'exactly two successful source publications must persist';
  END IF;
  IF (
    SELECT source_revision
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 2 THEN
    RAISE EXCEPTION 'current source must retain the second monotonic revision';
  END IF;
  IF (
    SELECT revision
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 9 THEN
    RAISE EXCEPTION 'published source must advance the projection from revision 8 to 9';
  END IF;
  IF (
    SELECT payload
    FROM platform.runtime_read_model_projection
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> '{"metrics":[{"id":"students","value":44}],"source":"database-composer-v2"}'::jsonb THEN
    RAISE EXCEPTION 'projection payload must equal the second database-owned source';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.source.published'
  ) <> 2 THEN
    RAISE EXCEPTION 'every successful source publication must have atomic audit evidence';
  END IF;
END
$projection_source_persistence$;


DO $admin_composer_privilege_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'app_projection_composer'
      AND (rolcanlogin OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'projection composer role must be no-login and unable to bypass RLS';
  END IF;
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_admin_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'admin composer execute grants are not least privilege';
  END IF;
  IF has_function_privilege(
       'app_projection_composer',
       'platform.publish_runtime_projection_source(uuid,uuid,uuid,bigint,jsonb,timestamptz,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_composer',
       'platform.configure_runtime_projection_persona_role(uuid,uuid,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'composer role must not inherit publisher or mapping administration';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'platform.runtime_projection_composition_run',
      'platform.runtime_projection_source',
      'platform.runtime_projection_source_publication',
      'student_lifecycle.enrollment',
      'attendance.attendance_session',
      'billing.bank_statement_line',
      'billing.cashier_session'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'composer role must retain function-only database access';
  END IF;
END
$admin_composer_privilege_contract$;

INSERT INTO people.person (
  tenant_id,
  person_id,
  status,
  date_of_birth
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000030',
  'active',
  DATE '2012-04-15'
);

INSERT INTO student_lifecycle.student_profile (
  tenant_id,
  student_profile_id,
  person_id,
  status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000030',
  'active'
);

INSERT INTO student_lifecycle.enrollment (
  tenant_id,
  enrollment_id,
  student_profile_id,
  campus_id,
  program_id,
  academic_year_id,
  status,
  effective_from,
  idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000032',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000036',
  '30000000-0000-4000-8000-000000000037',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'pilot-08-admin-student-0001'
);

INSERT INTO attendance.attendance_session (
  tenant_id,
  session_id,
  scheduled_meeting_id,
  section_id,
  campus_id,
  local_date,
  starts_at,
  ends_at,
  timezone,
  roster_student_ids,
  session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000033',
  '30000000-0000-4000-8000-000000000038',
  '30000000-0000-4000-8000-000000000039',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '08:00',
  TIME '08:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);

INSERT INTO billing.bank_statement_line (
  tenant_id,
  legal_entity_id,
  bank_statement_line_id,
  bank_account_ref,
  statement_ref,
  line_number,
  booking_date,
  amount_minor,
  currency,
  description,
  external_reference,
  import_hash,
  status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000034',
  'pilot-bank-01',
  'pilot-statement-01',
  1,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  5000,
  'BDT',
  'Unmatched pilot deposit',
  'pilot-payment-01',
  repeat('a', 64),
  'unmatched'
);

INSERT INTO billing.cashier_session (
  tenant_id,
  legal_entity_id,
  cashier_session_id,
  cashier_id,
  opened_by,
  opening_float_minor,
  currency,
  status,
  expected_cash_minor
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000035',
  'pilot-cashier-01',
  'account:30000000-0000-4000-8000-000000000004',
  1000,
  'BDT',
  'open',
  1000
);

SET ROLE app_projection_composer;
DO $admin_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    2,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000040'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 3
     OR length(result->'composition'->>'payloadDigest') <> 64
     OR (result->'composition'->>'payloadBytes')::integer < 2 THEN
    RAISE EXCEPTION 'first admin composition must publish source revision three: %', result;
  END IF;
END
$admin_composer_first_publication$;

DO $admin_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    3,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000041'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 3 THEN
    RAISE EXCEPTION 'unchanged authoritative data must not advance source revision: %', result;
  END IF;
END
$admin_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_session
SET session_state = 'finalized',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND session_id = '30000000-0000-4000-8000-000000000033';

SET ROLE app_projection_composer;
DO $admin_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    3,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000042'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 4 THEN
    RAISE EXCEPTION 'changed authoritative data must publish source revision four: %', result;
  END IF;
END
$admin_composer_changed_publication$;

DO $admin_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    3,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000043'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 4}'::jsonb THEN
    RAISE EXCEPTION 'stale composer revision must fail exactly: %', result;
  END IF;
END
$admin_composer_revision_conflict$;
RESET ROLE;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000025'
);

SET ROLE app_projection_composer;
DO $admin_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    4,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000044'
  );
  IF result <> '{"composed": false, "reason": "persona-not-admin"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose an admin payload: %', result;
  END IF;
END
$admin_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006'
  AND role_id = '30000000-0000-4000-8000-000000000025';

UPDATE iam.membership
SET status = 'suspended'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_projection_composer;
DO $admin_composer_inactive_scope$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_admin_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    4,
    'admin-home-composer-test-01',
    '30000000-0000-4000-8000-000000000045'
  );
  IF result <> '{"composed": false, "reason": "scope-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'inactive membership must not compose an admin source: %', result;
  END IF;
END
$admin_composer_inactive_scope$;
RESET ROLE;

UPDATE iam.membership
SET status = 'active'
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000006';

SET ROLE app_runtime;
DO $admin_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-00000000000c',
    'refresh-admin-home-0007',
    9,
    'Apply the reviewed database-owned admin home composition.',
    '30000000-0000-4000-8000-000000000046'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'admin composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-06',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'admin composition must apply through the durable worker: %', result;
  END IF;
END
$admin_composer_end_to_end_refresh$;
RESET ROLE;

DO $admin_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE state = 'published'
  ) <> 2 OR (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE state = 'unchanged'
  ) <> 1 THEN
    RAISE EXCEPTION 'composition evidence must preserve two publications and one no-op';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
  ) <> 4 THEN
    RAISE EXCEPTION 'unchanged composition must not create a source publication';
  END IF;
  IF (
    SELECT source_revision
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000006'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 4 THEN
    RAISE EXCEPTION 'admin composer must retain source revision four';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000006'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 10;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'admin-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 1 THEN
    RAISE EXCEPTION 'projection revision ten must contain exact authoritative admin metrics: %', projection_payload;
  END IF;
  IF jsonb_array_length(projection_payload->'exceptions') <> 2 THEN
    RAISE EXCEPTION 'finalized attendance must remove only the attendance exception';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.admin.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful composition run must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-admin-home-0007'
      AND applied.source_revision = 4
      AND applied.projection_revision = 10
  ) <> 1 THEN
    RAISE EXCEPTION 'admin composer refresh must retain exact source/projection evidence';
  END IF;

  BEGIN
    UPDATE platform.runtime_projection_composition_run
    SET state = 'published'
    WHERE correlation_id = '30000000-0000-4000-8000-000000000041';
    RAISE EXCEPTION 'composition evidence mutation unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'audit records are append-only' THEN
        RAISE;
      END IF;
  END;
END
$admin_composer_persistence$;


DO $teacher_composer_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_teacher_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'teacher composer execute grants are not least privilege';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_composition_run
    WHERE persona <> 'admin'
  ) THEN
    RAISE EXCEPTION 'existing admin composition evidence must backfill as admin';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.person_link',
      'hr.staff_profile',
      'scheduling.class_meeting_pattern',
      'scheduling.scheduled_class_meeting',
      'attendance.attendance_session',
      'gradebook.assessment',
      'gradebook.assessment_result'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'teacher composer role must retain function-only domain access';
  END IF;
END
$teacher_composer_privilege_contract$;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-000000000050',
  'https://identity.school.test',
  'provider-teacher-123',
  'teacher-test@school.test',
  'aal2'
);

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000053',
  'pilot-test-teacher',
  'Pilot Test Teacher',
  false
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000050',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000053'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000053',
  'runtime.snapshot.refresh'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000054',
  'https://identity.school.test',
  'provider-teacher-123',
  '30000000-0000-4000-8000-000000000050',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000054',
  '30000000-0000-4000-8000-000000000053'
);

SET ROLE app_projection_admin;
DO $teacher_composer_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000053',
    'teacher',
    'governance:pilot-09'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'teacher' THEN
    RAISE EXCEPTION 'teacher persona mapping must configure: %', result;
  END IF;
END
$teacher_composer_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $teacher_composer_unlinked_staff$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    0,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000070'
  );
  IF result <> '{"composed": false, "reason": "staff-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'teacher without database-owned staff linkage must fail: %', result;
  END IF;
END
$teacher_composer_unlinked_staff$;
RESET ROLE;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000051',
  'active'
);

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000050',
  '30000000-0000-4000-8000-000000000051'
);

INSERT INTO hr.staff_profile (
  tenant_id, legal_entity_id, campus_id, staff_id, person_ref,
  staff_number, display_name, work_email, employment_status, joined_on
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000055',
  '30000000-0000-4000-8000-000000000051',
  'PILOT-T-001',
  'Pilot Teacher',
  'pilot-teacher@school.test',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 365
);

INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, publication_state, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000063',
  '30000000-0000-4000-8000-000000000061',
  '30000000-0000-4000-8000-000000000062',
  '30000000-0000-4000-8000-000000000003',
  'Pilot Teacher Timetable',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'published',
  'pilot-09-teacher-timetable-01'
);

INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id,
  weekday, starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000064',
  '30000000-0000-4000-8000-000000000063',
  '30000000-0000-4000-8000-000000000065',
  extract(dow FROM (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date)::smallint,
  TIME '09:00',
  TIME '09:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id,
  section_id, local_date, starts_at, ends_at, timezone, teacher_ids,
  student_ids, meeting_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000066',
  '30000000-0000-4000-8000-000000000063',
  '30000000-0000-4000-8000-000000000064',
  '30000000-0000-4000-8000-000000000065',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '09:00',
  TIME '09:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'scheduled'
);

INSERT INTO attendance.attendance_session (
  tenant_id, session_id, scheduled_meeting_id, section_id, campus_id,
  local_date, starts_at, ends_at, timezone, roster_student_ids, session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000067',
  '30000000-0000-4000-8000-000000000066',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '09:00',
  TIME '09:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);

INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  calculation_mode, missing_score_treatment, rounding_decimals, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000068',
  'pilot-09-teacher-policy',
  'v1',
  'traditional',
  'exclude',
  2,
  'published'
);

INSERT INTO gradebook.assessment_category (
  tenant_id, category_id, policy_version_id, category_code, category_label, weight_percent
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000069',
  '30000000-0000-4000-8000-000000000068',
  'QUIZ',
  'Quiz',
  100
);

INSERT INTO gradebook.assessment (
  tenant_id, assessment_id, section_id, reporting_period_id,
  policy_version_id, category_id, assessment_title, maximum_points,
  due_at, assessment_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000006a',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000068',
  '30000000-0000-4000-8000-000000000069',
  'Pilot Teacher Quiz',
  10,
  clock_timestamp() + interval '2 days',
  'published'
);

INSERT INTO gradebook.assessment_result (
  tenant_id, assessment_result_id, assessment_id, student_profile_id,
  result_state, raw_score, entered_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000006b',
  '30000000-0000-4000-8000-00000000006a',
  '30000000-0000-4000-8000-000000000031',
  'missing',
  NULL,
  '30000000-0000-4000-8000-000000000050'
);

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000078',
  '30000000-0000-4000-8000-000000000002',
  'PILOT-X',
  'Pilot Secondary Campus',
  'Asia/Dhaka'
);

INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, publication_state, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000079',
  '30000000-0000-4000-8000-000000000061',
  '30000000-0000-4000-8000-000000000062',
  '30000000-0000-4000-8000-000000000078',
  'Cross-campus Teacher Timetable',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'published',
  'pilot-09-cross-campus-timetable-01'
);

INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id,
  weekday, starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007a',
  '30000000-0000-4000-8000-000000000079',
  '30000000-0000-4000-8000-00000000007b',
  extract(dow FROM (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date)::smallint,
  TIME '11:00',
  TIME '11:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id,
  section_id, local_date, starts_at, ends_at, timezone, teacher_ids,
  student_ids, meeting_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007c',
  '30000000-0000-4000-8000-000000000079',
  '30000000-0000-4000-8000-00000000007a',
  '30000000-0000-4000-8000-00000000007b',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '11:00',
  TIME '11:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'scheduled'
);

-- The schema permits imported attendance data to carry an inconsistent campus.
-- The composer must trust the canonical timetable campus and exclude this row.
INSERT INTO attendance.attendance_session (
  tenant_id, session_id, scheduled_meeting_id, section_id, campus_id,
  local_date, starts_at, ends_at, timezone, roster_student_ids, session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007f',
  '30000000-0000-4000-8000-00000000007c',
  '30000000-0000-4000-8000-00000000007b',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '11:00',
  TIME '11:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);

INSERT INTO gradebook.assessment (
  tenant_id, assessment_id, section_id, reporting_period_id,
  policy_version_id, category_id, assessment_title, maximum_points,
  due_at, assessment_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007d',
  '30000000-0000-4000-8000-00000000007b',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000068',
  '30000000-0000-4000-8000-000000000069',
  'Cross-campus Teacher Quiz',
  10,
  clock_timestamp() + interval '2 days',
  'published'
);

INSERT INTO gradebook.assessment_result (
  tenant_id, assessment_result_id, assessment_id, student_profile_id,
  result_state, raw_score, entered_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007e',
  '30000000-0000-4000-8000-00000000007d',
  '30000000-0000-4000-8000-000000000031',
  'missing',
  NULL,
  '30000000-0000-4000-8000-000000000050'
);

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'teacher',
  'person:30000000-0000-4000-8000-000000000051',
  4,
  '{"view":"teacher-home","source":"bootstrap"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
);

SET ROLE app_runtime;
DO $teacher_browser_session_registration$
BEGIN
  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-000000000056',
    '30000000-0000-4000-8000-000000000050',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-teacher-01',
    ARRAY['30000000-0000-4000-8000-000000000053'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'teacher browser session registration must succeed';
  END IF;
END
$teacher_browser_session_registration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $teacher_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    0,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000071'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first teacher composition must publish source revision one: %', result;
  END IF;
END
$teacher_composer_first_publication$;

DO $teacher_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    1,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000072'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'unchanged teacher workload must not advance source revision: %', result;
  END IF;
END
$teacher_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_session
SET session_state = 'finalized', version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND session_id = '30000000-0000-4000-8000-000000000067';

UPDATE gradebook.assessment_result
SET result_state = 'scored', raw_score = 8, version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND assessment_result_id = '30000000-0000-4000-8000-00000000006b';

SET ROLE app_projection_composer;
DO $teacher_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    1,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000073'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'changed teacher workload must publish source revision two: %', result;
  END IF;
END
$teacher_composer_changed_publication$;

DO $teacher_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    1,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000074'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 2}'::jsonb THEN
    RAISE EXCEPTION 'stale teacher composer revision must fail exactly: %', result;
  END IF;
END
$teacher_composer_revision_conflict$;
RESET ROLE;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
  '30000000-0000-4000-8000-000000000005'
);

SET ROLE app_projection_composer;
DO $teacher_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    2,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000075'
  );
  IF result <> '{"composed": false, "reason": "persona-not-teacher"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose a teacher payload: %', result;
  END IF;
END
$teacher_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000052'
  AND role_id = '30000000-0000-4000-8000-000000000005';

UPDATE hr.staff_profile
SET employment_status = 'suspended', version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND staff_id = '30000000-0000-4000-8000-000000000055';

SET ROLE app_projection_composer;
DO $teacher_composer_inactive_staff$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_teacher_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000052',
    '30000000-0000-4000-8000-000000000003',
    2,
    'teacher-home-composer-test-01',
    '30000000-0000-4000-8000-000000000076'
  );
  IF result <> '{"composed": false, "reason": "staff-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'inactive linked staff must fail closed: %', result;
  END IF;
END
$teacher_composer_inactive_staff$;
RESET ROLE;

UPDATE hr.staff_profile
SET employment_status = 'active', version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND staff_id = '30000000-0000-4000-8000-000000000055';

SET ROLE app_runtime;
DO $teacher_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-000000000056',
    'refresh-teacher-home-0001',
    4,
    'Apply the reviewed database-owned teacher home composition.',
    '30000000-0000-4000-8000-000000000077'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'teacher composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-07',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'teacher composition must apply through the durable worker: %', result;
  END IF;
END
$teacher_composer_end_to_end_refresh$;
RESET ROLE;

DO $teacher_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
      AND persona = 'teacher'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful teacher composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
  ) <> 2 THEN
    RAISE EXCEPTION 'teacher unchanged composition must not publish a source';
  END IF;
  IF (
    SELECT persona
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'teacher' THEN
    RAISE EXCEPTION 'teacher source must retain database-owned persona';
  END IF;
  IF (
    SELECT subject_ref
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000052'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'person:30000000-0000-4000-8000-000000000051' THEN
    RAISE EXCEPTION 'teacher source subject must derive from person linkage';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000052'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 5;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'teacher-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 0
     OR jsonb_array_length(projection_payload->'today'->'classes') <> 1
     OR jsonb_array_length(projection_payload->'exceptions') <> 0
     OR projection_payload->'metrics'->0->>'capability' <> 'classes.assigned.read'
     OR projection_payload->'metrics'->1->>'capability' <> 'attendance.assigned.write'
     OR projection_payload->'metrics'->2->>'capability' <> 'gradebook.assigned.write'
     OR projection_payload->'metrics'->3->>'capability' <> 'gradebook.assigned.write' THEN
    RAISE EXCEPTION 'projection revision five must contain exact teacher metrics and capabilities: %', projection_payload;
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.teacher.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful teacher composition must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-teacher-home-0001'
      AND applied.source_revision = 2
      AND applied.projection_revision = 5
  ) <> 1 THEN
    RAISE EXCEPTION 'teacher composer refresh must retain exact source/projection evidence';
  END IF;
END
$teacher_composer_persistence$;



DO $guardian_composer_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_guardian_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'guardian composer execute grants are not least privilege';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_composition_run
    WHERE persona NOT IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'existing composition evidence persona backfill changed unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.person_link',
      'people.guardian_student_authority',
      'student_lifecycle.student_profile',
      'student_lifecycle.enrollment',
      'attendance.attendance_record',
      'gradebook.grade_publication',
      'billing.responsible_party',
      'billing.invoice'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'guardian composer role must retain function-only domain access';
  END IF;
END
$guardian_composer_privilege_contract$;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-000000000080',
  'https://identity.school.test',
  'provider-guardian-123',
  'guardian-test@school.test',
  'aal2'
);

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000082',
  'pilot-test-guardian',
  'Pilot Test Guardian',
  false
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000080',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000082'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000082',
  'runtime.snapshot.refresh'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000084',
  'https://identity.school.test',
  'provider-guardian-123',
  '30000000-0000-4000-8000-000000000080',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000084',
  '30000000-0000-4000-8000-000000000082'
);

SET ROLE app_projection_admin;
DO $guardian_composer_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000082',
    'guardian',
    'governance:pilot-10'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'guardian' THEN
    RAISE EXCEPTION 'guardian persona mapping must configure: %', result;
  END IF;
END
$guardian_composer_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $guardian_composer_unlinked_person$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    0,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a0'
  );
  IF result <> '{"composed": false, "reason": "guardian-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'guardian without database-owned person linkage must fail: %', result;
  END IF;
END
$guardian_composer_unlinked_person$;
RESET ROLE;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000081',
  'active'
);

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000080',
  '30000000-0000-4000-8000-000000000081'
);

SET ROLE app_projection_composer;
DO $guardian_composer_without_authority$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    0,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a1'
  );
  IF result <> '{"composed": false, "reason": "authority-unavailable"}'::jsonb THEN
    RAISE EXCEPTION 'guardian without verified child authority must fail: %', result;
  END IF;
END
$guardian_composer_without_authority$;
RESET ROLE;

INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, billing_authority, portal_access,
  verification_status, effective_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000086',
  '30000000-0000-4000-8000-000000000081',
  '30000000-0000-4000-8000-000000000030',
  true,
  true,
  true,
  'verified',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

-- A same-campus child without verified authority must remain invisible.
INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b4',
  'active'
);
INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b5',
  '30000000-0000-4000-8000-0000000000b4',
  'active'
);
INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b6',
  '30000000-0000-4000-8000-0000000000b5',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000036',
  '30000000-0000-4000-8000-000000000037',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'pilot-10-unverified-child-01'
);
INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, portal_access, verification_status, effective_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b7',
  '30000000-0000-4000-8000-000000000081',
  '30000000-0000-4000-8000-0000000000b4',
  true,
  true,
  'pending',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

-- A verified child enrolled in another campus must remain outside this membership scope.
INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b0',
  'active'
);
INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b1',
  '30000000-0000-4000-8000-0000000000b0',
  'active'
);
INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b2',
  '30000000-0000-4000-8000-0000000000b1',
  '30000000-0000-4000-8000-000000000078',
  '30000000-0000-4000-8000-000000000036',
  '30000000-0000-4000-8000-000000000037',
  'active',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'pilot-10-cross-campus-child-01'
);
INSERT INTO people.guardian_student_authority (
  tenant_id, authority_id, guardian_person_id, student_person_id,
  education_authority, billing_authority, portal_access,
  verification_status, effective_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b3',
  '30000000-0000-4000-8000-000000000081',
  '30000000-0000-4000-8000-0000000000b0',
  true,
  true,
  true,
  'verified',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, publication_state, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000061',
  '30000000-0000-4000-8000-000000000062',
  '30000000-0000-4000-8000-000000000003',
  'Pilot Guardian Timetable',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'published',
  'pilot-10-guardian-timetable-01'
);
INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id,
  weekday, starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000009a',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000065',
  extract(dow FROM (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date)::smallint,
  TIME '12:00',
  TIME '12:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);
INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id,
  section_id, local_date, starts_at, ends_at, timezone, teacher_ids,
  student_ids, meeting_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000009b',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-00000000009a',
  '30000000-0000-4000-8000-000000000065',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '12:00',
  TIME '12:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'scheduled'
);

INSERT INTO attendance.attendance_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  minimum_present_minutes, late_after_minutes,
  chronic_absence_threshold_percent, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000087',
  'pilot-10-guardian-attendance',
  'v1',
  1,
  5,
  10,
  'published'
);
INSERT INTO attendance.attendance_code (
  tenant_id, attendance_code_id, policy_version_id, code, label,
  meaning, counts_as_present
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000088',
    '30000000-0000-4000-8000-000000000087',
    'A',
    'Absent',
    'absent',
    false
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000089',
    '30000000-0000-4000-8000-000000000087',
    'P',
    'Present',
    'present',
    true
  );
INSERT INTO attendance.attendance_session (
  tenant_id, session_id, scheduled_meeting_id, section_id, campus_id,
  local_date, starts_at, ends_at, timezone, roster_student_ids, session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008a',
  '30000000-0000-4000-8000-00000000009b',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '12:00',
  TIME '12:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'open'
);
INSERT INTO attendance.attendance_record (
  tenant_id, attendance_record_id, client_record_id, session_id,
  student_profile_id, attendance_code_id, record_source, recorded_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008b',
  'pilot-10-guardian-attendance-01',
  '30000000-0000-4000-8000-00000000008a',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000088',
  'guardian',
  '30000000-0000-4000-8000-000000000080'
);

-- Same-child attendance with a forged selected-campus field but a cross-campus timetable must remain invisible.
INSERT INTO attendance.attendance_record (
  tenant_id, attendance_record_id, client_record_id, session_id,
  student_profile_id, attendance_code_id, record_source, recorded_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000ba',
  'pilot-10-cross-campus-attendance-01',
  '30000000-0000-4000-8000-00000000007f',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000088',
  'guardian',
  '30000000-0000-4000-8000-000000000080'
);

INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  calculation_mode, missing_score_treatment, rounding_decimals, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008d',
  'pilot-10-guardian-grade-policy',
  'v1',
  'traditional',
  'exclude',
  2,
  'published'
);
INSERT INTO gradebook.grade_calculation_snapshot (
  tenant_id, snapshot_id, section_id, reporting_period_id,
  student_profile_id, policy_version_id, category_percentages,
  calculated_percent, displayed_grade, formula
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008e',
  '30000000-0000-4000-8000-000000000065',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-00000000008d',
  '{"coursework":85}'::jsonb,
  85,
  'A',
  'published guardian fixture'
);
INSERT INTO gradebook.grade_publication (
  tenant_id, publication_id, snapshot_id, available_from, published_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008f',
  '30000000-0000-4000-8000-00000000008e',
  clock_timestamp() - interval '1 day',
  '30000000-0000-4000-8000-000000000080'
);

-- A published grade for the same child in a cross-campus section must remain invisible.
INSERT INTO gradebook.grade_calculation_snapshot (
  tenant_id, snapshot_id, section_id, reporting_period_id,
  student_profile_id, policy_version_id, category_percentages,
  calculated_percent, displayed_grade, formula
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b8',
  '30000000-0000-4000-8000-00000000007b',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-00000000008d',
  '{"coursework":90}'::jsonb,
  90,
  'A+',
  'cross-campus guardian fixture'
);
INSERT INTO gradebook.grade_publication (
  tenant_id, publication_id, snapshot_id, available_from, published_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b9',
  '30000000-0000-4000-8000-0000000000b8',
  clock_timestamp() - interval '1 day',
  '30000000-0000-4000-8000-000000000080'
);

INSERT INTO ledger.book (
  tenant_id, legal_entity_id, book_id, code, name, base_currency
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000090',
  'PILOT10',
  'Pilot 10 Book',
  'BDT'
);
INSERT INTO ledger.fiscal_period (
  tenant_id, legal_entity_id, book_id, fiscal_period_id,
  period_code, starts_on, ends_on, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000090',
  '30000000-0000-4000-8000-000000000091',
  'PILOT10',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 30,
  'open'
);
INSERT INTO ledger.account (
  tenant_id, legal_entity_id, book_id, account_id,
  account_code, account_name, account_type, natural_balance
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000090',
    '30000000-0000-4000-8000-000000000092',
    'AR-P10',
    'Guardian receivable',
    'asset',
    'debit'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000090',
    '30000000-0000-4000-8000-000000000093',
    'REV-P10',
    'Guardian fee income',
    'income',
    'credit'
  );
INSERT INTO ledger.journal_entry (
  tenant_id, legal_entity_id, book_id, fiscal_period_id, journal_entry_id,
  entry_date, description, source_document_type, source_document_id,
  correlation_id, idempotency_key, status, created_by, posted_by, posted_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000090',
  '30000000-0000-4000-8000-000000000091',
  '30000000-0000-4000-8000-000000000094',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  'Pilot guardian invoice',
  'invoice',
  'PILOT-10-INV-001',
  'pilot-10-guardian-invoice',
  'pilot-10-guardian-journal-01',
  'posted',
  'finance-preparer',
  'finance-approver',
  clock_timestamp()
);
INSERT INTO ledger.journal_line (
  tenant_id, legal_entity_id, journal_entry_id, journal_line_id,
  line_number, account_id, side, amount_minor, currency
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000094',
    '30000000-0000-4000-8000-000000000095',
    1,
    '30000000-0000-4000-8000-000000000092',
    'debit',
    1850000,
    'BDT'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000094',
    '30000000-0000-4000-8000-000000000096',
    2,
    '30000000-0000-4000-8000-000000000093',
    'credit',
    1850000,
    'BDT'
  );
INSERT INTO billing.billing_account (
  tenant_id, legal_entity_id, billing_account_id,
  account_holder_ref, currency, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000097',
  '30000000-0000-4000-8000-000000000030',
  'BDT',
  'active'
);
INSERT INTO billing.responsible_party (
  tenant_id, legal_entity_id, billing_account_id, person_ref,
  responsibility_basis_points, priority
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000097',
  '30000000-0000-4000-8000-000000000081',
  10000,
  1
);
INSERT INTO billing.invoice (
  tenant_id, legal_entity_id, invoice_id, billing_account_id,
  invoice_number, issue_date, due_date, currency, status,
  subtotal_minor, adjustment_minor, tax_minor, total_minor,
  allocated_minor, credited_minor, balance_minor, created_by,
  posted_by, posted_at, journal_entry_id, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000098',
  '30000000-0000-4000-8000-000000000097',
  'PILOT-10-INV-001',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 5,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 5,
  'BDT',
  'posted',
  1850000,
  0,
  0,
  1850000,
  0,
  0,
  1850000,
  'finance-preparer',
  'finance-approver',
  clock_timestamp(),
  '30000000-0000-4000-8000-000000000094',
  'pilot-10-guardian-invoice-01'
);

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'guardian',
  'person:30000000-0000-4000-8000-000000000081',
  3,
  '{"view":"guardian-home","source":"bootstrap"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
);

SET ROLE app_runtime;
DO $guardian_browser_session_registration$
BEGIN
  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-000000000085',
    '30000000-0000-4000-8000-000000000080',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-guardian-01',
    ARRAY['30000000-0000-4000-8000-000000000082'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'guardian browser session registration must succeed';
  END IF;
END
$guardian_browser_session_registration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $guardian_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    0,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a2'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first guardian composition must publish source revision one: %', result;
  END IF;
END
$guardian_composer_first_publication$;

DO $guardian_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    1,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a3'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'unchanged guardian data must not advance source revision: %', result;
  END IF;
END
$guardian_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_record
SET attendance_code_id = '30000000-0000-4000-8000-000000000089',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND attendance_record_id = '30000000-0000-4000-8000-00000000008b';

SET ROLE app_projection_composer;
DO $guardian_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    1,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a4'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'changed guardian data must publish source revision two: %', result;
  END IF;
END
$guardian_composer_changed_publication$;

DO $guardian_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    1,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a5'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 2}'::jsonb THEN
    RAISE EXCEPTION 'stale guardian composer revision must fail exactly: %', result;
  END IF;
END
$guardian_composer_revision_conflict$;
RESET ROLE;

UPDATE people.guardian_student_authority
SET effective_to = (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 1,
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND authority_id = '30000000-0000-4000-8000-000000000086';

SET ROLE app_projection_composer;
DO $guardian_composer_expired_authority$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    2,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a6'
  );
  IF result <> '{"composed": false, "reason": "authority-unavailable"}'::jsonb THEN
    RAISE EXCEPTION 'expired exact-campus authority must fail closed: %', result;
  END IF;
END
$guardian_composer_expired_authority$;
RESET ROLE;

UPDATE people.guardian_student_authority
SET effective_to = NULL,
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND authority_id = '30000000-0000-4000-8000-000000000086';

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000083',
  '30000000-0000-4000-8000-000000000005'
);

SET ROLE app_projection_composer;
DO $guardian_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_guardian_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000083',
    '30000000-0000-4000-8000-000000000003',
    2,
    'guardian-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000a7'
  );
  IF result <> '{"composed": false, "reason": "persona-not-guardian"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose a guardian payload: %', result;
  END IF;
END
$guardian_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-000000000083'
  AND role_id = '30000000-0000-4000-8000-000000000005';

SET ROLE app_runtime;
DO $guardian_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-000000000085',
    'refresh-guardian-home-0001',
    3,
    'Apply the reviewed database-owned guardian home composition.',
    '30000000-0000-4000-8000-0000000000a8'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'guardian composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-08',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'guardian composition must apply through the durable worker: %', result;
  END IF;
END
$guardian_composer_end_to_end_refresh$;
RESET ROLE;

DO $guardian_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
      AND persona = 'guardian'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful guardian composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
  ) <> 2 THEN
    RAISE EXCEPTION 'guardian unchanged composition must not publish a source';
  END IF;
  IF (
    SELECT persona
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'guardian' THEN
    RAISE EXCEPTION 'guardian source must retain database-owned persona';
  END IF;
  IF (
    SELECT subject_ref
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-000000000083'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'person:30000000-0000-4000-8000-000000000081' THEN
    RAISE EXCEPTION 'guardian source subject must derive from person linkage';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-000000000083'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 4;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'guardian-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 1850000
     OR jsonb_array_length(projection_payload->'children') <> 1
     OR projection_payload->'children'->0->>'childId' <> '30000000-0000-4000-8000-000000000031'
     OR jsonb_array_length(projection_payload->'exceptions') <> 1
     OR projection_payload->'metrics'->0->>'capability' <> 'student.household.read'
     OR projection_payload->'metrics'->1->>'capability' <> 'attendance.household.read'
     OR projection_payload->'metrics'->2->>'capability' <> 'records.household.read'
     OR projection_payload->'metrics'->3->>'capability' <> 'finance.household.read' THEN
    RAISE EXCEPTION 'projection revision four must contain exact guardian metrics, authority and capabilities: %', projection_payload;
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.guardian.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful guardian composition must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-guardian-home-0001'
      AND applied.source_revision = 2
      AND applied.projection_revision = 4
  ) <> 1 THEN
    RAISE EXCEPTION 'guardian composer refresh must retain exact source/projection evidence';
  END IF;
END
$guardian_composer_persistence$;



DO $student_composer_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_composer',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.compose_student_runtime_projection_source(uuid,uuid,uuid,bigint,text,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'student composer execute grants are not least privilege';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM platform.runtime_projection_composition_run
    WHERE persona NOT IN ('admin', 'teacher', 'guardian')
  ) THEN
    RAISE EXCEPTION 'existing composition evidence persona backfill changed unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.person_link',
      'student_lifecycle.student_profile',
      'student_lifecycle.enrollment',
      'academics.section_roster',
      'scheduling.scheduled_class_meeting',
      'attendance.attendance_record',
      'gradebook.assessment',
      'gradebook.grade_publication'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_composer', table_name, 'SELECT')
       OR has_table_privilege('app_projection_composer', table_name, 'INSERT')
       OR has_table_privilege('app_projection_composer', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_composer', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'student composer role must retain function-only domain access';
  END IF;
END
$student_composer_privilege_contract$;

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '30000000-0000-4000-8000-0000000000c0',
  'https://identity.school.test',
  'provider-student-123',
  'student-test@school.test',
  'aal2'
);

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c1',
  'pilot-test-student',
  'Pilot Test Student',
  false
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-0000000000c0',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-0000000000c1'
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c1',
  'runtime.snapshot.refresh'
);

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id,
  tenant_id, membership_id, campus_id, status
) VALUES (
  '30000000-0000-4000-8000-0000000000c3',
  'https://identity.school.test',
  'provider-student-123',
  '30000000-0000-4000-8000-0000000000c0',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c3',
  '30000000-0000-4000-8000-0000000000c1'
);

SET ROLE app_projection_admin;
DO $student_composer_persona_configuration$
DECLARE
  result jsonb;
BEGIN
  result := platform.configure_runtime_projection_persona_role(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c1',
    'student',
    'governance:pilot-11'
  );
  IF result->>'configured' <> 'true' OR result->>'persona' <> 'student' THEN
    RAISE EXCEPTION 'student persona mapping must configure: %', result;
  END IF;
END
$student_composer_persona_configuration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $student_composer_unlinked_profile$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    0,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d0'
  );
  IF result <> '{"composed": false, "reason": "student-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'student without database-owned person/profile linkage must fail: %', result;
  END IF;
END
$student_composer_unlinked_profile$;
RESET ROLE;

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c0',
  '30000000-0000-4000-8000-000000000030'
);

INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name,
  starts_on, ends_on, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c7',
  'PILOT-11-AY',
  'PILOT-11 Academic Year',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 60,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 300,
  'published'
);

INSERT INTO academics.academic_term (
  tenant_id, term_id, academic_year_id, term_code, term_name,
  starts_on, ends_on, sequence_no
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c8',
  '30000000-0000-4000-8000-0000000000c7',
  'PILOT-11-T1',
  'PILOT-11 Term 1',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 60,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 120,
  1
);

INSERT INTO academics.curriculum_version (
  tenant_id, curriculum_version_id, curriculum_key, version_label,
  curriculum_name, effective_from, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c9',
  'pilot-11-student',
  'v1',
  'PILOT-11 Student Curriculum',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 60,
  'published'
);

INSERT INTO academics.course_version (
  tenant_id, course_version_id, course_key, version_label,
  curriculum_version_id, course_code, course_title,
  credits, prerequisite_course_keys, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000ca',
  'pilot-11-student-home',
  'v1',
  '30000000-0000-4000-8000-0000000000c9',
  'P11-HOME',
  'PILOT-11 Student Home Course',
  0,
  '[]'::jsonb,
  'published'
);

INSERT INTO academics.class_section (
  tenant_id, section_id, course_version_id, academic_year_id,
  term_id, campus_id, section_code, section_title,
  capacity, publication_state
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000065',
    '30000000-0000-4000-8000-0000000000ca',
    '30000000-0000-4000-8000-0000000000c7',
    '30000000-0000-4000-8000-0000000000c8',
    '30000000-0000-4000-8000-000000000003',
    'P11-PRIMARY',
    'PILOT-11 Primary Campus Section',
    30,
    'published'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-00000000007b',
    '30000000-0000-4000-8000-0000000000ca',
    '30000000-0000-4000-8000-0000000000c7',
    '30000000-0000-4000-8000-0000000000c8',
    '30000000-0000-4000-8000-000000000078',
    'P11-CROSS',
    'PILOT-11 Cross-campus Section',
    30,
    'published'
  );

-- Current selected-campus and cross-campus rosters intentionally coexist.
INSERT INTO academics.section_roster (
  tenant_id, roster_entry_id, section_id, student_profile_id,
  enrollment_id, joined_on
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c5',
    '30000000-0000-4000-8000-000000000065',
    '30000000-0000-4000-8000-000000000031',
    '30000000-0000-4000-8000-000000000032',
    (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c6',
    '30000000-0000-4000-8000-00000000007b',
    '30000000-0000-4000-8000-000000000031',
    '30000000-0000-4000-8000-000000000032',
    (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
  );

UPDATE attendance.attendance_record
SET attendance_code_id = '30000000-0000-4000-8000-000000000088',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND attendance_record_id = '30000000-0000-4000-8000-00000000008b';

INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-000000000003',
  'home',
  'student',
  'person:30000000-0000-4000-8000-000000000030',
  2,
  '{"view":"student-home","source":"bootstrap"}'::jsonb,
  clock_timestamp() - interval '30 seconds',
  clock_timestamp()
);

SET ROLE app_runtime;
DO $student_browser_session_registration$
BEGIN
  IF NOT iam.register_browser_session(
    '30000000-0000-4000-8000-0000000000c4',
    '30000000-0000-4000-8000-0000000000c0',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    'provider-session-student-01',
    ARRAY['30000000-0000-4000-8000-0000000000c1'::uuid],
    'aal2',
    clock_timestamp(),
    clock_timestamp() + interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'student browser session registration must succeed';
  END IF;
END
$student_browser_session_registration$;
RESET ROLE;

SET ROLE app_projection_composer;
DO $student_composer_first_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    0,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d1'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'first student composition must publish source revision one: %', result;
  END IF;
END
$student_composer_first_publication$;

DO $student_composer_unchanged$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    1,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d2'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'unchanged'
     OR (result->'composition'->>'sourceRevision')::bigint <> 1 THEN
    RAISE EXCEPTION 'unchanged student data must not advance source revision: %', result;
  END IF;
END
$student_composer_unchanged$;
RESET ROLE;

UPDATE attendance.attendance_record
SET attendance_code_id = '30000000-0000-4000-8000-000000000089',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND attendance_record_id = '30000000-0000-4000-8000-00000000008b';

SET ROLE app_projection_composer;
DO $student_composer_changed_publication$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    1,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d3'
  );
  IF result->>'composed' <> 'true'
     OR result->'composition'->>'state' <> 'published'
     OR (result->'composition'->>'sourceRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'changed student data must publish source revision two: %', result;
  END IF;
END
$student_composer_changed_publication$;

DO $student_composer_revision_conflict$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    1,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d4'
  );
  IF result <> '{"composed": false, "reason": "revision-conflict", "currentRevision": 2}'::jsonb THEN
    RAISE EXCEPTION 'stale student composer revision must fail exactly: %', result;
  END IF;
END
$student_composer_revision_conflict$;
RESET ROLE;

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c2',
  '30000000-0000-4000-8000-000000000005'
);

SET ROLE app_projection_composer;
DO $student_composer_persona_denial$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    2,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d5'
  );
  IF result <> '{"composed": false, "reason": "persona-not-student"}'::jsonb THEN
    RAISE EXCEPTION 'ambiguous persona must not compose a student payload: %', result;
  END IF;
END
$student_composer_persona_denial$;
RESET ROLE;

DELETE FROM iam.membership_role
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND membership_id = '30000000-0000-4000-8000-0000000000c2'
  AND role_id = '30000000-0000-4000-8000-000000000005';

UPDATE student_lifecycle.student_profile
SET status = 'withdrawn',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND student_profile_id = '30000000-0000-4000-8000-000000000031';

SET ROLE app_projection_composer;
DO $student_composer_withdrawn_profile$
DECLARE
  result jsonb;
BEGIN
  result := platform.compose_student_runtime_projection_source(
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-0000000000c2',
    '30000000-0000-4000-8000-000000000003',
    2,
    'student-home-composer-test-01',
    '30000000-0000-4000-8000-0000000000d6'
  );
  IF result <> '{"composed": false, "reason": "student-unlinked"}'::jsonb THEN
    RAISE EXCEPTION 'withdrawn student profile must fail closed: %', result;
  END IF;
END
$student_composer_withdrawn_profile$;
RESET ROLE;

UPDATE student_lifecycle.student_profile
SET status = 'active',
    version = version + 1
WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
  AND student_profile_id = '30000000-0000-4000-8000-000000000031';

SET ROLE app_runtime;
DO $student_composer_end_to_end_refresh$
DECLARE
  decision jsonb;
  result jsonb;
BEGIN
  decision := platform.submit_runtime_snapshot_refresh(
    '30000000-0000-4000-8000-0000000000c4',
    'refresh-student-home-0001',
    2,
    'Apply the reviewed database-owned student home composition.',
    '30000000-0000-4000-8000-0000000000d7'
  );
  IF decision->>'accepted' <> 'true' OR decision->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'student composition refresh command must be accepted: %', decision;
  END IF;

  result := platform.process_runtime_projection_refresh_batch(
    'projection-worker-test-09',
    20,
    3
  );
  IF result <> '{"claimed": 1, "completed": 1, "retried": 0, "deadLettered": 0}'::jsonb THEN
    RAISE EXCEPTION 'student composition must apply through the durable worker: %', result;
  END IF;
END
$student_composer_end_to_end_refresh$;
RESET ROLE;

DO $student_composer_persistence$
DECLARE
  projection_payload jsonb;
BEGIN
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_composition_run
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-0000000000c2'
      AND persona = 'student'
  ) <> 3 THEN
    RAISE EXCEPTION 'exactly three successful student composition runs must persist';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_source_publication
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-0000000000c2'
  ) <> 2 THEN
    RAISE EXCEPTION 'student unchanged composition must not publish a source';
  END IF;
  IF (
    SELECT subject_ref
    FROM platform.runtime_projection_source
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND membership_id = '30000000-0000-4000-8000-0000000000c2'
      AND campus_id = '30000000-0000-4000-8000-000000000003'
      AND projection_key = 'home'
  ) <> 'person:30000000-0000-4000-8000-000000000030' THEN
    RAISE EXCEPTION 'student source subject must derive from person linkage';
  END IF;

  SELECT payload INTO projection_payload
  FROM platform.runtime_read_model_projection
  WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
    AND membership_id = '30000000-0000-4000-8000-0000000000c2'
    AND campus_id = '30000000-0000-4000-8000-000000000003'
    AND projection_key = 'home'
    AND revision = 3;

  IF projection_payload IS NULL
     OR projection_payload->>'view' <> 'student-home'
     OR (projection_payload->'metrics'->0->>'value')::bigint <> 2
     OR (projection_payload->'metrics'->1->>'value')::bigint <> 0
     OR (projection_payload->'metrics'->2->>'value')::bigint <> 1
     OR (projection_payload->'metrics'->3->>'value')::bigint <> 1
     OR jsonb_array_length(projection_payload->'lessons') <> 2
     OR jsonb_array_length(projection_payload->'results') <> 1
     OR jsonb_array_length(projection_payload->'exceptions') <> 0
     OR projection_payload->'metrics'->0->>'capability' <> 'timetable.self.read'
     OR projection_payload->'metrics'->1->>'capability' <> 'attendance.self.read'
     OR projection_payload->'metrics'->2->>'capability' <> 'records.self.read'
     OR projection_payload->'metrics'->3->>'capability' <> 'records.self.read' THEN
    RAISE EXCEPTION 'projection revision three must contain exact student metrics, campus scope and capabilities: %', projection_payload;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(projection_payload->'lessons') AS lesson
    WHERE lesson->>'sectionId' = '30000000-0000-4000-8000-00000000007b'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(projection_payload->'results') AS result
    WHERE result->>'sectionId' = '30000000-0000-4000-8000-00000000007b'
  ) THEN
    RAISE EXCEPTION 'cross-campus roster data must not appear in student projection';
  END IF;
  IF (
    SELECT count(*)
    FROM audit.audit_event
    WHERE tenant_id = '30000000-0000-4000-8000-000000000001'
      AND action = 'runtime.projection.student.composed'
  ) <> 3 THEN
    RAISE EXCEPTION 'every successful student composition must have audit evidence';
  END IF;
  IF (
    SELECT count(*)
    FROM platform.runtime_projection_applied_command AS applied
    JOIN platform.runtime_command_receipt AS receipt
      ON receipt.command_id = applied.command_id
    WHERE receipt.idempotency_key = 'refresh-student-home-0001'
      AND applied.source_revision = 2
      AND applied.projection_revision = 3
  ) <> 1 THEN
    RAISE EXCEPTION 'student composer refresh must retain exact source/projection evidence';
  END IF;
END
$student_composer_persistence$;

DO $projection_monitor_privilege_contract$
BEGIN
  IF NOT has_function_privilege(
       'app_projection_monitor',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_admin',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_publisher',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_projection_composer',
       'platform.read_runtime_projection_operations_snapshot(uuid,integer,integer)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'projection monitor execute grants are not least privilege';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'iam.membership',
      'platform.runtime_projection_persona_role',
      'platform.runtime_projection_source',
      'platform.runtime_projection_applied_command',
      'platform.runtime_projection_dead_letter',
      'integration_core.outbox_event'
    ]) AS protected(table_name)
    WHERE has_table_privilege('app_projection_monitor', table_name, 'SELECT')
       OR has_table_privilege('app_projection_monitor', table_name, 'INSERT')
       OR has_table_privilege('app_projection_monitor', table_name, 'UPDATE')
       OR has_table_privilege('app_projection_monitor', table_name, 'DELETE')
  ) THEN
    RAISE EXCEPTION 'projection monitor role must retain function-only access';
  END IF;
END
$projection_monitor_privilege_contract$;

INSERT INTO platform.tenant (
  tenant_id, slug, display_name, home_region, deployment_profile,
  database_binding, provisioning_status
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  'projection-monitor-test',
  'Projection Monitor Test School',
  'test',
  'regional-pooled',
  'test',
  'active'
);

INSERT INTO tenancy.legal_entity (
  tenant_id, legal_entity_id, legal_name, country_code, default_currency
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'Projection Monitor Test School',
  'BD',
  'BDT'
);

INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000002',
  'MON',
  'Monitor Campus',
  'Asia/Dhaka'
);

INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES
  ('50000000-0000-4000-8000-000000000010', 'monitor-test', 'unique-source', 'monitor-unique@school.test', 'aal2'),
  ('50000000-0000-4000-8000-000000000011', 'monitor-test', 'unmapped', 'monitor-unmapped@school.test', 'aal2'),
  ('50000000-0000-4000-8000-000000000012', 'monitor-test', 'ambiguous', 'monitor-ambiguous@school.test', 'aal2'),
  ('50000000-0000-4000-8000-000000000013', 'monitor-test', 'missing-source', 'monitor-missing@school.test', 'aal2');

INSERT INTO iam.role (
  tenant_id, role_id, role_key, display_name, system_role
) VALUES
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000020', 'monitor-unique', 'Monitor Unique', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000021', 'monitor-unmapped', 'Monitor Unmapped', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000022', 'monitor-ambiguous-a', 'Monitor Ambiguous A', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000023', 'monitor-ambiguous-b', 'Monitor Ambiguous B', false),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000024', 'monitor-missing', 'Monitor Missing Source', false);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000030', '50000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000003', 'active'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000003', 'active'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000032', '50000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000003', 'active'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000033', '50000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000003', 'active');

INSERT INTO iam.membership_role (tenant_id, membership_id, role_id)
VALUES
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000030', '50000000-0000-4000-8000-000000000020'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000031', '50000000-0000-4000-8000-000000000021'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000032', '50000000-0000-4000-8000-000000000022'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000032', '50000000-0000-4000-8000-000000000023'),
  ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000033', '50000000-0000-4000-8000-000000000024');

SET ROLE app_projection_admin;
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000020',
  'admin',
  'governance:pilot-12'
);
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000022',
  'teacher',
  'governance:pilot-12'
);
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000023',
  'guardian',
  'governance:pilot-12'
);
SELECT platform.configure_runtime_projection_persona_role(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000024',
  'student',
  'governance:pilot-12'
);
RESET ROLE;

INSERT INTO platform.runtime_projection_source (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, source_revision, payload, source_updated_at,
  payload_digest, payload_bytes
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000030',
  '50000000-0000-4000-8000-000000000003',
  'home',
  'admin',
  'account:50000000-0000-4000-8000-000000000010',
  1,
  '{"view":"monitor-fixture","source":"database"}'::jsonb,
  clock_timestamp() - interval '2 hours',
  repeat('0', 64),
  2
);

INSERT INTO integration_core.outbox_event (
  tenant_id, event_id, event_type, schema_version, aggregate_type,
  aggregate_id, aggregate_version, correlation_id, causation_id,
  payload, occurred_at, available_at, published_at, attempt_count, last_error
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000040',
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    '50000000-0000-4000-8000-000000000030',
    2,
    '50000000-0000-4000-8000-000000000050',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '10 minutes',
    clock_timestamp() - interval '10 minutes',
    NULL,
    0,
    NULL
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000041',
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    '50000000-0000-4000-8000-000000000030',
    2,
    '50000000-0000-4000-8000-000000000051',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '2 minutes',
    clock_timestamp() + interval '10 minutes',
    NULL,
    1,
    'source-unavailable'
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000042',
    'unrelated.event',
    1,
    'unrelated',
    'ignore',
    1,
    '50000000-0000-4000-8000-000000000052',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '30 minutes',
    clock_timestamp() - interval '30 minutes',
    NULL,
    0,
    NULL
  ),
  (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000043',
    'platform.runtime_snapshot_refresh_requested',
    1,
    'runtime_projection',
    '50000000-0000-4000-8000-000000000030',
    2,
    '50000000-0000-4000-8000-000000000053',
    NULL,
    '{}'::jsonb,
    clock_timestamp() - interval '1 minute',
    clock_timestamp() - interval '1 minute',
    clock_timestamp(),
    1,
    'invalid-event'
  );

INSERT INTO platform.runtime_projection_dead_letter (
  tenant_id, event_id, command_id, error_code,
  attempt_count, worker_id, failed_at
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000043',
  NULL,
  'invalid-event',
  1,
  'projection-monitor-test-01',
  clock_timestamp()
);

SET ROLE app_projection_monitor;
DO $projection_monitor_snapshot$
DECLARE
  snapshot jsonb;
BEGIN
  snapshot := platform.read_runtime_projection_operations_snapshot(
    '50000000-0000-4000-8000-000000000001',
    300,
    300
  );

  IF snapshot->>'health' <> 'critical'
     OR snapshot->'controls' <> '{"exactEventAllowlist":true,"tenantScoped":true,"payloadRedacted":true,"functionOnlyAccess":true}'::jsonb
     OR (snapshot->'backlog'->>'eligible')::bigint <> 1
     OR (snapshot->'backlog'->>'retryScheduled')::bigint <> 1
     OR (snapshot->'backlog'->>'oldestEligibleSeconds')::bigint < 590
     OR (snapshot->'delivery'->>'appliedLastHour')::bigint <> 0
     OR (snapshot->'delivery'->>'deadLetterTotal')::bigint <> 1
     OR (snapshot->'delivery'->>'deadLettersLast24Hours')::bigint <> 1
     OR (snapshot->'delivery'->'byCode'->>'invalidEvent')::bigint <> 1
     OR (snapshot->'delivery'->'byCode'->>'sourceUnavailable')::bigint <> 0
     OR (snapshot->'delivery'->'byCode'->>'projectionStateConflict')::bigint <> 0
     OR (snapshot->'delivery'->'byCode'->>'processorError')::bigint <> 0
     OR (snapshot->'sources'->>'current')::bigint <> 1
     OR (snapshot->'sources'->>'stale')::bigint <> 1
     OR (snapshot->'sources'->>'unapplied')::bigint <> 1
     OR (snapshot->'sources'->>'missingForMappedMemberships')::bigint <> 1
     OR (snapshot->'mappings'->>'activeUnique')::bigint <> 2
     OR (snapshot->'mappings'->>'unmapped')::bigint <> 1
     OR (snapshot->'mappings'->>'ambiguous')::bigint <> 1 THEN
    RAISE EXCEPTION 'projection monitor snapshot did not retain exact redacted counts: %', snapshot;
  END IF;

  IF snapshot::text LIKE '%50000000-0000-4000-8000-000000000030%'
     OR snapshot ? 'payload'
     OR snapshot ? 'events'
     OR snapshot ? 'memberships'
     OR snapshot ? 'databaseUrl' THEN
    RAISE EXCEPTION 'projection monitor snapshot leaked scoped identifiers or payloads: %', snapshot;
  END IF;
END
$projection_monitor_snapshot$;

DO $projection_monitor_invalid_settings$
BEGIN
  BEGIN
    PERFORM platform.read_runtime_projection_operations_snapshot(
      '50000000-0000-4000-8000-000000000001',
      59,
      300
    );
    RAISE EXCEPTION 'invalid monitor threshold unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'invalid runtime projection monitor settings' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM platform.read_runtime_projection_operations_snapshot(
      '50000000-0000-4000-8000-000000000099',
      300,
      300
    );
    RAISE EXCEPTION 'unknown monitor tenant unexpectedly succeeded';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'runtime projection monitor tenant is unavailable' THEN
        RAISE;
      END IF;
  END;
END
$projection_monitor_invalid_settings$;
RESET ROLE;

SET ROLE app_runtime;
DO $account_revoke_verification$
DECLARE
  revoked_count integer;
BEGIN
  revoked_count := iam.revoke_account_browser_sessions(
    '30000000-0000-4000-8000-000000000004',
    'verification logout all'
  );
  IF revoked_count <> 3 THEN
    RAISE EXCEPTION 'expected three active account sessions to be revoked, got %', revoked_count;
  END IF;
  IF iam.is_browser_session_active('30000000-0000-4000-8000-00000000000a')
     OR iam.is_browser_session_active('30000000-0000-4000-8000-00000000000b')
     OR iam.is_browser_session_active('30000000-0000-4000-8000-00000000000c') THEN
    RAISE EXCEPTION 'account-wide revocation must invalidate every active session';
  END IF;
END
$account_revoke_verification$;
RESET ROLE;

SELECT json_build_object(
  'canonical_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12', 'PILOT-13', 'PILOT-14', 'PILOT-15')),
  'post_integration_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08', 'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12', 'PILOT-13', 'PILOT-14', 'PILOT-15')),
  'oauth_transactions', (SELECT count(*) FROM iam.oauth_transaction_consumption),
  'membership_bindings', (SELECT count(*) FROM iam.oidc_membership_binding),
  'session_rows', (SELECT count(*) FROM iam.browser_session_registry),
  'app_runtime_direct_table_access', (
    SELECT bool_or(has_table_privilege('app_runtime', table_name, 'SELECT'))
    FROM unnest(ARRAY[
      'iam.oauth_transaction_consumption',
      'iam.oidc_membership_binding',
      'iam.oidc_membership_role_binding',
      'iam.browser_session_registry',
      'iam.oidc_logout_token_consumption',
      'iam.oidc_provider_cache',
      'platform.runtime_read_model_projection',
      'platform.runtime_command_receipt',
      'platform.runtime_projection_source',
      'platform.runtime_projection_applied_command',
      'platform.runtime_projection_dead_letter',
      'platform.runtime_projection_persona_role',
      'platform.runtime_projection_persona_role_event',
      'platform.runtime_projection_source_publication',
      'platform.runtime_projection_composition_run',
      'platform.operator_domain_command_receipt'
    ]) AS protected(table_name)
  )
);
SQL
