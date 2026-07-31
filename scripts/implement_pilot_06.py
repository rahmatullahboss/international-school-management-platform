from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one marker, got {count}: {old[:80]!r}")
    file_path.write_text(source.replace(old, new), encoding="utf-8")


def insert_before_once(path: str, marker: str, addition: str) -> None:
    replace_once(path, marker, addition + marker)


# Fix the nullable dead-letter audit actor before exercising the migration.
migration = "infra/database/post-integration-migrations/202607311101_PILOT-06_runtime_projection_worker.sql"
replace_once(
    migration,
    "  selected_campus_id uuid;\n  selected_expected_revision bigint;",
    "  selected_campus_id uuid;\n  selected_expected_revision bigint;\n  selected_actor_account_id uuid;",
)
replace_once(
    migration,
    "    selected_expected_revision := NULL;\n\n    BEGIN",
    "    selected_expected_revision := NULL;\n    selected_actor_account_id := NULL;\n\n    BEGIN",
)
replace_once(
    migration,
    "        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';\n      END IF;\n\n      IF EXISTS (",
    "        RAISE EXCEPTION 'invalid runtime projection event' USING ERRCODE = 'P1001';\n      END IF;\n      selected_actor_account_id := receipt_row.actor_account_id;\n\n      IF EXISTS (",
)
replace_once(
    migration,
    "        receipt_row.actor_account_id,\n        'runtime.snapshot.refresh.completed',",
    "        selected_actor_account_id,\n        'runtime.snapshot.refresh.completed',",
)
replace_once(
    migration,
    "          receipt_row.actor_account_id,\n          'runtime.snapshot.refresh.dead_lettered',",
    "          selected_actor_account_id,\n          'runtime.snapshot.refresh.dead_lettered',",
)

# Extend the provider-neutral readiness contract with the internal processor gate.
auth_boundary = "apps/platform-api/src/auth-boundary.ts"
replace_once(
    auth_boundary,
    "  readonly RUNTIME_MUTATION_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
    "  readonly RUNTIME_MUTATION_SOURCE?: string;\n  readonly RUNTIME_PROJECTION_WORKER_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
)
replace_once(
    auth_boundary,
    "  | 'runtime-mutation-source'\n  | 'allowed-web-origins';",
    "  | 'runtime-mutation-source'\n  | 'runtime-projection-worker-source'\n  | 'allowed-web-origins';",
)
replace_once(
    auth_boundary,
    "    readonly aal2MutationAuthorization: true;\n  };",
    "    readonly aal2MutationAuthorization: true;\n    readonly databaseNativeProjectionProcessing: true;\n    readonly exactProjectionEventAllowlist: true;\n    readonly concurrentProjectionClaims: true;\n    readonly appliedProjectionCommandDeduplication: true;\n    readonly boundedProjectionRetryBackoff: true;\n    readonly projectionDeadLetterIsolation: true;\n    readonly projectionSourceIntegrity: true;\n  };",
)
replace_once(
    auth_boundary,
    "  | 'RUNTIME_MUTATION_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
    "  | 'RUNTIME_MUTATION_SOURCE'\n  | 'RUNTIME_PROJECTION_WORKER_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
)
replace_once(
    auth_boundary,
    "  if (configuredValue(bindings, 'RUNTIME_MUTATION_SOURCE') !== 'database') {\n    missingConfiguration.push('runtime-mutation-source');\n  }\n  if (!hasValidAuthMutationOrigins",
    "  if (configuredValue(bindings, 'RUNTIME_MUTATION_SOURCE') !== 'database') {\n    missingConfiguration.push('runtime-mutation-source');\n  }\n  if (configuredValue(bindings, 'RUNTIME_PROJECTION_WORKER_SOURCE') !== 'database') {\n    missingConfiguration.push('runtime-projection-worker-source');\n  }\n  if (!hasValidAuthMutationOrigins",
)
replace_once(
    auth_boundary,
    "      missingConfiguration.length === 14",
    "      missingConfiguration.length === 15",
)
replace_once(
    auth_boundary,
    "      aal2MutationAuthorization: true,\n    },",
    "      aal2MutationAuthorization: true,\n      databaseNativeProjectionProcessing: true,\n      exactProjectionEventAllowlist: true,\n      concurrentProjectionClaims: true,\n      appliedProjectionCommandDeduplication: true,\n      boundedProjectionRetryBackoff: true,\n      projectionDeadLetterIsolation: true,\n      projectionSourceIntegrity: true,\n    },",
)

auth_test = "apps/platform-api/src/auth-boundary.test.ts"
replace_once(
    auth_test,
    "  RUNTIME_MUTATION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    "  RUNTIME_MUTATION_SOURCE: 'database',\n  RUNTIME_PROJECTION_WORKER_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
)
replace_once(
    auth_test,
    "        aal2MutationAuthorization: true,\n      },",
    "        aal2MutationAuthorization: true,\n        databaseNativeProjectionProcessing: true,\n        exactProjectionEventAllowlist: true,\n        concurrentProjectionClaims: true,\n        appliedProjectionCommandDeduplication: true,\n        boundedProjectionRetryBackoff: true,\n        projectionDeadLetterIsolation: true,\n        projectionSourceIntegrity: true,\n      },",
)
replace_once(
    auth_test,
    "        'runtime-mutation-source',\n        'allowed-web-origins',",
    "        'runtime-mutation-source',\n        'runtime-projection-worker-source',\n        'allowed-web-origins',",
)

# Wire a no-store readiness route and an environment-scoped Cloudflare scheduled handler.
index_path = "apps/platform-api/src/index.ts"
replace_once(
    index_path,
    "import {\n  isRuntimeMutationContentTypeAllowed,",
    "import {\n  resolveRuntimeProjectionWorkerReadiness,\n} from './runtime-projection-worker.js';\nimport {\n  scheduleRuntimeProjectionWorker,\n  type RuntimeProjectionExecutionContext,\n} from './runtime-projection-scheduled.js';\nimport {\n  isRuntimeMutationContentTypeAllowed,",
)
replace_once(
    index_path,
    "  PILOT_SESSION_SECRET?: string;\n}",
    "  PILOT_SESSION_SECRET?: string;\n  RUNTIME_PROJECTION_WORKER_ID?: string;\n  RUNTIME_PROJECTION_WORKER_BATCH_SIZE?: string;\n  RUNTIME_PROJECTION_WORKER_MAX_ATTEMPTS?: string;\n}",
)
replace_once(
    index_path,
    "app.get('/auth/v1/readiness', (context) => {\n  context.header('cache-control', 'no-store');\n  return context.json(resolveAuthReadiness(context.env));\n});",
    "app.get('/auth/v1/readiness', (context) => {\n  context.header('cache-control', 'no-store');\n  return context.json(resolveAuthReadiness(context.env));\n});\n\napp.get('/auth/v1/runtime-projection-worker/readiness', (context) => {\n  context.header('cache-control', 'no-store');\n  return context.json(resolveRuntimeProjectionWorkerReadiness(context.env));\n});",
)
replace_once(
    index_path,
    "export default app;\n\nexport * from './auth-backchannel.js';",
    "const worker = Object.assign(app, {\n  scheduled: (\n    _controller: unknown,\n    environment: Bindings,\n    executionContext: RuntimeProjectionExecutionContext,\n  ): void => {\n    scheduleRuntimeProjectionWorker(environment, executionContext);\n  },\n});\n\nexport default worker;\n\nexport * from './auth-backchannel.js';",
)
replace_once(
    index_path,
    "export * from './runtime-mutation.js';",
    "export * from './runtime-mutation.js';\nexport * from './runtime-projection-worker.js';\nexport * from './runtime-projection-scheduled.js';\nexport * from './database-projection-worker-store.js';",
)

index_test = "apps/platform-api/src/index.test.ts"
replace_once(
    index_test,
    "        aal2MutationAuthorization: true,\n      },",
    "        aal2MutationAuthorization: true,\n        databaseNativeProjectionProcessing: true,\n        exactProjectionEventAllowlist: true,\n        concurrentProjectionClaims: true,\n        appliedProjectionCommandDeduplication: true,\n        boundedProjectionRetryBackoff: true,\n        projectionDeadLetterIsolation: true,\n        projectionSourceIntegrity: true,\n      },",
)
insert_before_once(
    index_test,
    "  it('introspects only a valid HttpOnly-cookie session and denies missing configuration or cookie',",
    "  it('reports the internal projection worker as fail closed without database bindings', async () => {\n    const response = await app.request(\n      '/auth/v1/runtime-projection-worker/readiness',\n      {},\n      { APP_ENV: 'test', APP_REGION: 'local' },\n    );\n    expect(response.status).toBe(200);\n    expect(response.headers.get('cache-control')).toBe('no-store');\n    await expect(response.json()).resolves.toEqual({\n      schemaVersion: 1,\n      state: 'disabled',\n      controls: {\n        databaseNativeProcessing: true,\n        exactEventAllowlist: true,\n        concurrentSkipLockedClaims: true,\n        appliedCommandDeduplication: true,\n        boundedRetryBackoff: true,\n        deadLetterIsolation: true,\n        sourceProjectionIntegrity: true,\n      },\n      missingConfiguration: ['database-url', 'runtime-projection-worker-source'],\n    });\n  });\n\n",
)

# Staging owns a non-production Cron Trigger but intentionally lacks the database/source bindings.
wrangler = "apps/platform-api/wrangler.jsonc"
replace_once(
    wrangler,
    '        "APP_ENV": "staging",\n        "APP_REGION": "global",\n      },',
    '        "APP_ENV": "staging",\n        "APP_REGION": "global",\n        "RUNTIME_PROJECTION_WORKER_ID": "projection-worker-staging-01",\n        "RUNTIME_PROJECTION_WORKER_BATCH_SIZE": "20",\n        "RUNTIME_PROJECTION_WORKER_MAX_ATTEMPTS": "5",\n      },\n      "triggers": {\n        "crons": ["*/5 * * * *"],\n      },',
)

# Upgrade the fresh PostgreSQL verifier and exercise success, deduplication, retry and dead letter paths.
verifier = "tests/integration/verify-auth-durable-context.sh"
replace_once(
    verifier,
    "GATE-PILOT-SAFE-MUTATION-V1",
    "GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1",
)
replace_once(verifier, "migrations.length !== 5", "migrations.length !== 6")
replace_once(
    verifier,
    "expected five post-integration migrations",
    "expected six post-integration migrations",
)
replace_once(
    verifier,
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05']",
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06']",
)
replace_once(verifier, "<> 45", "<> 46")
replace_once(verifier, "expected 45 total migration ledger rows", "expected 46 total migration ledger rows")
replace_once(
    verifier,
    "     OR to_regclass('platform.runtime_command_receipt') IS NULL THEN",
    "     OR to_regclass('platform.runtime_command_receipt') IS NULL\n     OR to_regclass('platform.runtime_projection_source') IS NULL\n     OR to_regclass('platform.runtime_projection_applied_command') IS NULL\n     OR to_regclass('platform.runtime_projection_dead_letter') IS NULL THEN",
)

worker_probe = r'''
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

'''
insert_before_once(
    verifier,
    "SET ROLE app_runtime;\nDO $account_revoke_verification$",
    worker_probe,
)
replace_once(
    verifier,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05'))",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06'))",
)
replace_once(
    verifier,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05')),",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06')),",
)
replace_once(
    verifier,
    "      'platform.runtime_command_receipt'\n    ])",
    "      'platform.runtime_command_receipt',\n      'platform.runtime_projection_source',\n      'platform.runtime_projection_applied_command',\n      'platform.runtime_projection_dead_letter'\n    ])",
)

# Live staging validates both readiness contracts while all production data bindings remain absent.
staging = ".github/workflows/deploy-cloudflare-staging.yml"
replace_once(
    staging,
    "      github.head_ref == 'pilot/safe-mutation-envelope-v1'",
    "      github.head_ref == 'pilot/safe-mutation-envelope-v1' ||\n      github.head_ref == 'pilot/runtime-projection-worker-v1'",
)
replace_once(
    staging,
    "          fetch_with_retry \"$API_URL/auth/v1/readiness\" auth-readiness.json 'OIDC readiness endpoint'\n\n          session_status=",
    "          fetch_with_retry \"$API_URL/auth/v1/readiness\" auth-readiness.json 'OIDC readiness endpoint'\n\n          projection_worker_status=$(curl --silent --show-error \\\n            --dump-header projection-worker-headers.txt \\\n            --output projection-worker-readiness.json \\\n            --write-out '%{http_code}' \\\n            \"$API_URL/auth/v1/runtime-projection-worker/readiness\")\n          test \"$projection_worker_status\" = '200'\n\n          session_status=",
)
replace_once(
    staging,
    "              'aal2MutationAuthorization',\n          ]",
    "              'aal2MutationAuthorization',\n              'databaseNativeProjectionProcessing', 'exactProjectionEventAllowlist',\n              'concurrentProjectionClaims', 'appliedProjectionCommandDeduplication',\n              'boundedProjectionRetryBackoff', 'projectionDeadLetterIsolation',\n              'projectionSourceIntegrity',\n          ]",
)
replace_once(
    staging,
    "              'runtime-mutation-source', 'allowed-web-origins',",
    "              'runtime-mutation-source', 'runtime-projection-worker-source',\n              'allowed-web-origins',",
)
replace_once(
    staging,
    "          serialized = json.dumps(readiness).lower()",
    "          worker_readiness = load('projection-worker-readiness.json')\n          assert worker_readiness == {\n              'schemaVersion': 1,\n              'state': 'disabled',\n              'controls': {\n                  'databaseNativeProcessing': True,\n                  'exactEventAllowlist': True,\n                  'concurrentSkipLockedClaims': True,\n                  'appliedCommandDeduplication': True,\n                  'boundedRetryBackoff': True,\n                  'deadLetterIsolation': True,\n                  'sourceProjectionIntegrity': True,\n              },\n              'missingConfiguration': [\n                  'database-url', 'runtime-projection-worker-source',\n              ],\n          }, worker_readiness\n          worker_headers = headers('projection-worker-headers.txt')\n          assert 'cache-control: no-store' in worker_headers, worker_headers\n          assert 'set-cookie:' not in worker_headers, worker_headers\n          assert 'access-control-allow-origin:' not in worker_headers, worker_headers\n\n          serialized = json.dumps(readiness).lower()",
)
replace_once(
    staging,
    "            echo \"- OIDC readiness: $API_URL/auth/v1/readiness\"",
    "            echo \"- OIDC readiness: $API_URL/auth/v1/readiness\"\n            echo \"- Projection worker readiness: $API_URL/auth/v1/runtime-projection-worker/readiness\"",
)
replace_once(
    staging,
    "            echo '- Scope: tenant-safe database reads and a single allowlisted AAL2 runtime refresh command are verified with current-grant authorization, exact revision checks, idempotent receipts and atomic audit/outbox persistence. Real provider login, production projection population, mutation consumers and production data access remain disabled until approved bindings and explicit production authorization are configured.'",
    "            echo '- Scope: tenant-safe reads, one allowlisted AAL2 refresh command and a database-native scheduled projection processor are verified with current-grant authorization, exact revisions, idempotent receipts, atomic audit/outbox persistence, SKIP LOCKED batches, retries and dead letters. The staging Cron Trigger remains fail closed because database/source bindings are intentionally absent; real provider login, production projection population and production promotion remain disabled until explicitly authorized.'",
)

print("PILOT-06 integration patch applied")
