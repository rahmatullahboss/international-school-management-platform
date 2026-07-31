#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one marker in {path}, found {count}: {old[:160]!r}')
    path.write_text(source.replace(old, new), encoding='utf-8')


# PostgreSQL conflict syntax and replay ordering.
sql = Path('infra/database/post-integration-migrations/202607311001_PILOT-05_safe_runtime_mutation.sql')
replace_once(sql, ') NULLS NOT DISTINCT DO NOTHING;', ') DO NOTHING;')
projection_block = """  SELECT projection.revision
  INTO current_revision
  FROM platform.runtime_read_model_projection AS projection
  WHERE projection.tenant_id = selected_tenant_id
    AND projection.membership_id = selected_membership_id
    AND projection.campus_id IS NOT DISTINCT FROM selected_campus_id
    AND projection.projection_key = 'home'
  FOR UPDATE;

  IF current_revision IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'projection-not-found');
  END IF;
  IF current_revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'revision-conflict',
      'currentRevision', current_revision
    );
  END IF;

"""
replace_once(sql, projection_block, '')
request_hash_end = """  request_hash := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'commandType', 'runtime.snapshot.refresh',
          'expectedRevision', p_expected_revision,
          'reason', p_reason
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

"""
precheck = request_hash_end + """  SELECT existing.request_hash, existing.response_body
  INTO existing_hash, existing_receipt
  FROM platform.runtime_command_receipt AS existing
  WHERE existing.tenant_id = selected_tenant_id
    AND existing.membership_id = selected_membership_id
    AND existing.campus_id IS NOT DISTINCT FROM selected_campus_id
    AND existing.command_type = 'runtime.snapshot.refresh'
    AND existing.idempotency_key = p_idempotency_key
  FOR SHARE;

  IF existing_hash IS NOT NULL THEN
    IF existing_hash <> request_hash THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    END IF;
    RETURN jsonb_build_object(
      'accepted', true,
      'replayed', true,
      'receipt', existing_receipt
    );
  END IF;

""" + projection_block
replace_once(sql, request_hash_end, precheck)

# Enforce receipt correlation/revision binding in the TypeScript store.
store = Path('apps/platform-api/src/database-mutation-store.ts')
replace_once(
    store,
    """    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    return validateDecision(row.value);
""",
    """    const row = rows[0];
    if (rows.length !== 1 || row === undefined) throw invalidResponse();
    const decision = validateDecision(row.value);
    if (
      decision.accepted &&
      (decision.receipt.expectedRevision !== expectedRevision ||
        decision.receipt.correlationId !== correlationId)
    ) {
      throw invalidResponse();
    }
    return decision;
""",
)

# Provider-neutral readiness contract.
boundary = Path('apps/platform-api/src/auth-boundary.ts')
replace_once(
    boundary,
    "  readonly RUNTIME_READ_MODEL_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
    "  readonly RUNTIME_READ_MODEL_SOURCE?: string;\n  readonly RUNTIME_MUTATION_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
)
replace_once(
    boundary,
    "  | 'runtime-read-model-source'\n  | 'allowed-web-origins';",
    "  | 'runtime-read-model-source'\n  | 'runtime-mutation-source'\n  | 'allowed-web-origins';",
)
replace_once(
    boundary,
    "    readonly currentGrantSnapshotRevalidation: true;\n  };",
    "    readonly currentGrantSnapshotRevalidation: true;\n    readonly safeDatabaseMutations: true;\n    readonly idempotentMutationReceipts: true;\n    readonly optimisticMutationConcurrency: true;\n    readonly atomicMutationAuditOutbox: true;\n    readonly aal2MutationAuthorization: true;\n  };",
)
replace_once(
    boundary,
    "  | 'RUNTIME_READ_MODEL_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
    "  | 'RUNTIME_READ_MODEL_SOURCE'\n  | 'RUNTIME_MUTATION_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
)
replace_once(
    boundary,
    """  if (configuredValue(bindings, 'RUNTIME_READ_MODEL_SOURCE') !== 'database') {
    missingConfiguration.push('runtime-read-model-source');
  }
  if (!hasValidAuthMutationOrigins(configuredValue(bindings, 'AUTH_ALLOWED_WEB_ORIGINS'))) {
""",
    """  if (configuredValue(bindings, 'RUNTIME_READ_MODEL_SOURCE') !== 'database') {
    missingConfiguration.push('runtime-read-model-source');
  }
  if (configuredValue(bindings, 'RUNTIME_MUTATION_SOURCE') !== 'database') {
    missingConfiguration.push('runtime-mutation-source');
  }
  if (!hasValidAuthMutationOrigins(configuredValue(bindings, 'AUTH_ALLOWED_WEB_ORIGINS'))) {
""",
)
replace_once(boundary, 'missingConfiguration.length === 13', 'missingConfiguration.length === 14')
replace_once(
    boundary,
    """      currentGrantSnapshotRevalidation: true,
    },
""",
    """      currentGrantSnapshotRevalidation: true,
      safeDatabaseMutations: true,
      idempotentMutationReceipts: true,
      optimisticMutationConcurrency: true,
      atomicMutationAuditOutbox: true,
      aal2MutationAuthorization: true,
    },
""",
)

boundary_test = Path('apps/platform-api/src/auth-boundary.test.ts')
replace_once(
    boundary_test,
    "  RUNTIME_READ_MODEL_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    "  RUNTIME_READ_MODEL_SOURCE: 'database',\n  RUNTIME_MUTATION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
)
replace_once(
    boundary_test,
    """        currentGrantSnapshotRevalidation: true,
      },
""",
    """        currentGrantSnapshotRevalidation: true,
        safeDatabaseMutations: true,
        idempotentMutationReceipts: true,
        optimisticMutationConcurrency: true,
        atomicMutationAuditOutbox: true,
        aal2MutationAuthorization: true,
      },
""",
)
replace_once(
    boundary_test,
    "        'runtime-read-model-source',\n        'allowed-web-origins',",
    "        'runtime-read-model-source',\n        'runtime-mutation-source',\n        'allowed-web-origins',",
)

# HTTP route, exact-origin CORS and exports.
index = Path('apps/platform-api/src/index.ts')
replace_once(
    index,
    "import { DatabaseReadModelStore } from './database-read-model-store.js';\n",
    "import { DatabaseMutationStore } from './database-mutation-store.js';\nimport { DatabaseReadModelStore } from './database-read-model-store.js';\n",
)
replace_once(
    index,
    """import { issuePilotSession, pilotSessionHeaders, verifyPilotSession } from './pilot-sessions.js';
""",
    """import { issuePilotSession, pilotSessionHeaders, verifyPilotSession } from './pilot-sessions.js';
import {
  isRuntimeMutationContentTypeAllowed,
  isRuntimeMutationDeclaredLengthAllowed,
  readBoundedRuntimeMutationBody,
  submitRuntimeSnapshotRefresh,
} from './runtime-mutation.js';
""",
)
replace_once(
    index,
    """function applyAuthMutationCors(
  headers: (name: string, value: string) => void,
  allowedOrigins: string | undefined,
  origin: string | undefined,
): boolean {
""",
    """function applyAuthMutationCors(
  headers: (name: string, value: string) => void,
  allowedOrigins: string | undefined,
  origin: string | undefined,
  allowedHeaders = 'content-type',
): boolean {
""",
)
replace_once(
    index,
    "  headers('access-control-allow-headers', 'content-type');\n",
    "  headers('access-control-allow-headers', allowedHeaders);\n",
)
mutation_route = r'''
function durableMutationStores(
  environment: Bindings,
): { readonly auth: DurableAuthStore; readonly mutation: DatabaseMutationStore } | undefined {
  if (
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    environment.AUTH_PERMISSION_SOURCE !== 'database' ||
    environment.RUNTIME_MUTATION_SOURCE !== 'database' ||
    environment.DATABASE_URL === undefined ||
    environment.DATABASE_URL.trim() === ''
  ) {
    return undefined;
  }
  const database = createHttpDatabase(environment.DATABASE_URL);
  return { auth: new DurableAuthStore(database), mutation: new DatabaseMutationStore(database) };
}

const runtimeSnapshotRefreshPath = '/auth/v1/commands/runtime.snapshot.refresh';

app.options(runtimeSnapshotRefreshPath, (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin');
  const stores = durableMutationStores(context.env);
  const configured =
    stores !== undefined &&
    context.env.AUTH_SESSION_SECRET !== undefined &&
    context.env.AUTH_SESSION_SECRET.length >= 32 &&
    hasValidAuthMutationOrigins(context.env.AUTH_ALLOWED_WEB_ORIGINS);
  if (!configured) {
    return context.json(
      {
        error: {
          code: 'runtime_mutation_configuration_invalid',
          message: 'Runtime mutations are not configured.',
        },
      },
      503,
    );
  }
  if (
    !applyAuthMutationCors(
      (name, value) => context.header(name, value),
      context.env.AUTH_ALLOWED_WEB_ORIGINS,
      context.req.header('origin'),
      'content-type, idempotency-key',
    )
  ) {
    return context.json(
      {
        error: {
          code: 'runtime_mutation_origin_denied',
          message: 'The requesting origin is not permitted.',
        },
      },
      403,
    );
  }
  return context.body(null, 204);
});

app.post(runtimeSnapshotRefreshPath, async (context) => {
  const correlationId = crypto.randomUUID();
  context.header('x-correlation-id', correlationId);
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin, Cookie, Idempotency-Key');
  const origin = context.req.header('origin');
  applyAuthMutationCors(
    (name, value) => context.header(name, value),
    context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    'content-type, idempotency-key',
  );

  const stores = durableMutationStores(context.env);
  const contentLength = context.req.header('content-length');
  const contentType = context.req.header('content-type');
  const configured =
    stores !== undefined &&
    context.env.AUTH_SESSION_SECRET !== undefined &&
    context.env.AUTH_SESSION_SECRET.length >= 32 &&
    hasValidAuthMutationOrigins(context.env.AUTH_ALLOWED_WEB_ORIGINS);
  let rawBody = '';
  if (
    configured &&
    isAllowedAuthMutationOrigin(context.env.AUTH_ALLOWED_WEB_ORIGINS, origin) &&
    isRuntimeMutationContentTypeAllowed(contentType) &&
    isRuntimeMutationDeclaredLengthAllowed(contentLength)
  ) {
    rawBody = (await readBoundedRuntimeMutationBody(context.req.raw.body)) ?? '';
  }

  const result = await submitRuntimeSnapshotRefresh({
    configured,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType,
    ...(contentLength === undefined ? {} : { contentLength }),
    rawBody,
    idempotencyKey: context.req.header('idempotency-key'),
    correlationId,
    authenticate: async () => {
      if (stores === undefined) throw new Error('Runtime mutation stores are unavailable.');
      const resolution = await resolveAuthenticatedBrowserSessionContext(
        context.env,
        context.req.header('cookie'),
        (sessionId) => stores.auth.isSessionActive(sessionId),
      );
      if (!resolution.ok) return resolution;
      return { ok: true, sessionId: resolution.context.sessionId };
    },
    submit: (command) => {
      if (stores === undefined) throw new Error('Runtime mutation stores are unavailable.');
      return stores.mutation.submitRuntimeSnapshotRefresh(command);
    },
  });
  if (!result.ok) {
    return context.json(
      {
        error: { code: result.code, message: result.message },
        ...(result.requiredAssurance === undefined
          ? {}
          : { requiredAssurance: result.requiredAssurance }),
        ...(result.currentRevision === undefined
          ? {}
          : { currentRevision: result.currentRevision }),
      },
      result.status,
    );
  }
  return context.json(
    { schemaVersion: 1, replayed: result.replayed, receipt: result.receipt },
    result.status,
  );
});

'''
replace_once(index, 'function durableReadModelStores(\n', mutation_route + 'function durableReadModelStores(\n')
replace_once(
    index,
    "export * from './database-read-model.js';\n",
    "export * from './database-mutation-store.js';\nexport * from './database-read-model.js';\n",
)
replace_once(
    index,
    "export * from './pilot-sessions.js';\n",
    "export * from './pilot-sessions.js';\nexport * from './runtime-mutation.js';\n",
)

# HTTP route tests and readiness surface.
index_test = Path('apps/platform-api/src/index.test.ts')
replace_once(
    index_test,
    "  RUNTIME_READ_MODEL_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    "  RUNTIME_READ_MODEL_SOURCE: 'database',\n  RUNTIME_MUTATION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
)
replace_once(
    index_test,
    """        currentGrantSnapshotRevalidation: true,
      },
""",
    """        currentGrantSnapshotRevalidation: true,
        safeDatabaseMutations: true,
        idempotentMutationReceipts: true,
        optimisticMutationConcurrency: true,
        atomicMutationAuditOutbox: true,
        aal2MutationAuthorization: true,
      },
""",
)
http_tests = r'''
  it('accepts an exact-origin idempotent runtime refresh command with a durable receipt', async () => {
    databaseQuery.mockResolvedValueOnce([{ value: true }]).mockImplementationOnce(
      (_sql: unknown, parameters: unknown) => {
        if (!Array.isArray(parameters) || typeof parameters[4] !== 'string') {
          throw new Error('Expected typed runtime mutation parameters.');
        }
        return Promise.resolve([
          {
            value: {
              accepted: true,
              replayed: false,
              receipt: {
                commandId: '60000000-0000-4000-8000-000000000002',
                commandType: 'runtime.snapshot.refresh',
                state: 'accepted',
                expectedRevision: 7,
                correlationId: parameters[4],
                acceptedAt: '2026-07-31T05:10:00.000Z',
              },
            },
          },
        ]);
      },
    );
    const response = await app.request(
      '/auth/v1/commands/runtime.snapshot.refresh',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
          'idempotency-key': 'refresh-admin-home-0001',
          cookie: await issueBrowserCookie(),
        },
        body: JSON.stringify({
          expectedRevision: 7,
          reason: 'Refresh after the approved timetable publication.',
        }),
      },
      environment,
    );
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://school.test');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('set-cookie')).toBeNull();
    const correlationId = response.headers.get('x-correlation-id');
    expect(correlationId).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      replayed: false,
      receipt: {
        commandType: 'runtime.snapshot.refresh',
        expectedRevision: 7,
        correlationId,
      },
    });
    expect(databaseQuery).toHaveBeenCalledTimes(2);
    expect(databaseQuery.mock.calls[0]?.[0]).toContain('iam.is_browser_session_active');
    expect(databaseQuery.mock.calls[1]?.[0]).toContain('platform.submit_runtime_snapshot_refresh');
    expect(databaseQuery.mock.calls[1]?.[1]).toEqual([
      expect.any(String),
      'refresh-admin-home-0001',
      7,
      'Refresh after the approved timetable publication.',
      correlationId,
    ]);
  });

  it('allows only the exact mutation preflight and required request headers', async () => {
    const accepted = await app.request(
      '/auth/v1/commands/runtime.snapshot.refresh',
      { method: 'OPTIONS', headers: { origin: 'https://school.test' } },
      environment,
    );
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get('access-control-allow-origin')).toBe('https://school.test');
    expect(accepted.headers.get('access-control-allow-credentials')).toBe('true');
    expect(accepted.headers.get('access-control-allow-headers')).toBe(
      'content-type, idempotency-key',
    );

    const denied = await app.request(
      '/auth/v1/commands/runtime.snapshot.refresh',
      { method: 'OPTIONS', headers: { origin: 'https://evil.test' } },
      environment,
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('keeps runtime mutations fail-closed and rejects browser-controlled scope before database access', async () => {
    const unconfigured = await app.request(
      '/auth/v1/commands/runtime.snapshot.refresh',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
          'idempotency-key': 'refresh-admin-home-0001',
        },
        body: JSON.stringify({ expectedRevision: 7, reason: 'Approved refresh.' }),
      },
      { APP_ENV: 'test', APP_REGION: 'local' },
    );
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.headers.get('cache-control')).toBe('no-store');
    expect(unconfigured.headers.get('access-control-allow-origin')).toBeNull();
    expect(unconfigured.headers.get('set-cookie')).toBeNull();
    expect(databaseQuery).not.toHaveBeenCalled();

    const injected = await app.request(
      '/auth/v1/commands/runtime.snapshot.refresh',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
          'idempotency-key': 'refresh-admin-home-0001',
          cookie: await issueBrowserCookie(),
        },
        body: JSON.stringify({
          expectedRevision: 7,
          reason: 'Approved refresh.',
          tenantId: 'attacker-tenant',
        }),
      },
      environment,
    );
    expect(injected.status).toBe(400);
    expect(databaseQuery).not.toHaveBeenCalled();
  });

'''
replace_once(
    index_test,
    "  it('permits only the exact configured logout origin during preflight', async () => {\n",
    http_tests + "  it('permits only the exact configured logout origin during preflight', async () => {\n",
)

# Fresh PostgreSQL verification: manifest, grants, atomic command and privilege probes.
verify = Path('tests/integration/verify-auth-durable-context.sh')
replace_once(
    verify,
    "manifest.gate !== 'GATE-PILOT-DATABASE-READ-MODEL-V1'",
    "manifest.gate !== 'GATE-PILOT-SAFE-MUTATION-V1'",
)
replace_once(verify, 'migrations.length !== 4', 'migrations.length !== 5')
replace_once(
    verify,
    "expected four post-integration migrations, got ${migrations.length}",
    "expected five post-integration migrations, got ${migrations.length}",
)
replace_once(
    verify,
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04'].includes(migration.stream)",
    "['AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05'].includes(migration.stream)",
)
replace_once(verify, "<> 44", "<> 45")
replace_once(verify, "expected 44 total migration ledger rows", "expected 45 total migration ledger rows")
replace_once(
    verify,
    """     OR to_regclass('platform.runtime_read_model_projection') IS NULL THEN
""",
    """     OR to_regclass('platform.runtime_read_model_projection') IS NULL
     OR to_regclass('platform.runtime_command_receipt') IS NULL THEN
""",
)
replace_once(
    verify,
    """  )
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership (
""",
    """  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005',
    'runtime.snapshot.refresh'
  )
ON CONFLICT DO NOTHING;

INSERT INTO iam.membership (
""",
)
mutation_verification = r'''
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

'''
replace_once(
    verify,
    "SET ROLE app_runtime;\nDO $account_revoke_verification$\n",
    mutation_verification + "SET ROLE app_runtime;\nDO $account_revoke_verification$\n",
)
replace_once(verify, 'IF revoked_count <> 2 THEN', 'IF revoked_count <> 3 THEN')
replace_once(
    verify,
    "expected two active account sessions to be revoked",
    "expected three active account sessions to be revoked",
)
replace_once(
    verify,
    """     OR iam.is_browser_session_active('30000000-0000-4000-8000-00000000000b') THEN
""",
    """     OR iam.is_browser_session_active('30000000-0000-4000-8000-00000000000b')
     OR iam.is_browser_session_active('30000000-0000-4000-8000-00000000000c') THEN
""",
)
replace_once(
    verify,
    "stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04')",
    "stream_id NOT IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05')",
)
replace_once(
    verify,
    "stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04')",
    "stream_id IN ('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05')",
)
replace_once(
    verify,
    "      'platform.runtime_read_model_projection'\n",
    "      'platform.runtime_read_model_projection',\n      'platform.runtime_command_receipt'\n",
)
