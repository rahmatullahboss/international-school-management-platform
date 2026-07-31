#!/usr/bin/env python3
from pathlib import Path

path = Path('tests/integration/verify-auth-durable-context.sh')
source = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one verification marker, found {count}: {old[:100]!r}')
    source = source.replace(old, new)


replace_once(
    "if (manifest.gate !== 'GATE-AUTH-DATABASE-PERMISSION-V1') {",
    "if (manifest.gate !== 'GATE-PILOT-DATABASE-READ-MODEL-V1') {",
)
replace_once(
    'if (migrations.length !== 3) {\n  throw new Error(`expected three AUTH migrations, got ${migrations.length}`);\n}',
    'if (migrations.length !== 4) {\n  throw new Error(`expected four post-integration migrations, got ${migrations.length}`);\n}',
)
replace_once(
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);",
    "if (!['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04'].includes(migration.stream)) throw new Error(`unexpected stream: ${migration.stream}`);",
)
replace_once(
    "IF (SELECT count(*) FROM platform.schema_migration) <> 43 THEN\n    RAISE EXCEPTION 'expected 43 total migration ledger rows';",
    "IF (SELECT count(*) FROM platform.schema_migration) <> 44 THEN\n    RAISE EXCEPTION 'expected 44 total migration ledger rows';",
)
replace_once(
    "OR to_regclass('iam.oidc_provider_cache') IS NULL THEN",
    "OR to_regclass('iam.oidc_provider_cache') IS NULL\n     OR to_regclass('platform.runtime_read_model_projection') IS NULL THEN",
)
replace_once(
    "OR has_table_privilege(current_user, 'iam.oidc_provider_cache', 'SELECT') THEN",
    "OR has_table_privilege(current_user, 'iam.oidc_provider_cache', 'SELECT')\n     OR has_table_privilege(current_user, 'platform.runtime_read_model_projection', 'SELECT') THEN",
)
replace_once(
    'DECLARE\n  resolved_count integer;\nBEGIN',
    'DECLARE\n  resolved_count integer;\n  read_head record;\n  read_payload jsonb;\nBEGIN',
)

fixture_marker = 'SET ROLE app_runtime;\n\nDO $runtime_verification$'
fixture = '''INSERT INTO platform.runtime_read_model_projection (
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

DO $runtime_verification$'''
replace_once(fixture_marker, fixture)

head_marker = '''  IF NOT iam.is_browser_session_active('30000000-0000-4000-8000-000000000009') THEN
    RAISE EXCEPTION 'registered session must be active';
  END IF;

  IF iam.evaluate_browser_permission('''
head_tests = '''  IF NOT iam.is_browser_session_active('30000000-0000-4000-8000-000000000009') THEN
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

  IF iam.evaluate_browser_permission('''
replace_once(head_marker, head_tests)

role_marker = '''  IF iam.evaluate_browser_permission(
    '30000000-0000-4000-8000-00000000000a',
    'finance.read'
  ) <> '{"allowed": false, "reason": "session-inactive"}'::jsonb THEN
    RAISE EXCEPTION 'role removal must invalidate permission evaluation';
  END IF;

END
$role_change_verification$;'''
role_tests = '''  IF iam.evaluate_browser_permission(
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
$role_change_verification$;'''
replace_once(role_marker, role_tests)

replace_once(
    "'canonical_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id <> 'AUTH-03'),\n  'auth_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id = 'AUTH-03'),",
    "'canonical_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04')),\n  'post_integration_migrations', (SELECT count(*) FROM platform.schema_migration WHERE stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04')),",
)
replace_once(
    "'iam.browser_session_registry'\n    ]) AS protected(table_name)",
    "'iam.browser_session_registry',\n      'iam.oidc_logout_token_consumption',\n      'iam.oidc_provider_cache',\n      'platform.runtime_read_model_projection'\n    ]) AS protected(table_name)",
)

path.write_text(source, encoding='utf-8')
