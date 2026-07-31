#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one marker in {path}, found {count}: {old[:120]!r}')
    path.write_text(source.replace(old, new), encoding='utf-8')


boundary = Path('apps/platform-api/src/auth-boundary.ts')
replace_once(
    boundary,
    "  readonly AUTH_PERMISSION_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
    "  readonly AUTH_PERMISSION_SOURCE?: string;\n  readonly RUNTIME_READ_MODEL_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
)
replace_once(
    boundary,
    "  | 'permission-source'\n  | 'allowed-web-origins';",
    "  | 'permission-source'\n  | 'runtime-read-model-source'\n  | 'allowed-web-origins';",
)
replace_once(
    boundary,
    "    readonly serverOwnedAuthorizationScope: true;\n  };",
    "    readonly serverOwnedAuthorizationScope: true;\n    readonly databaseReadModels: true;\n    readonly tenantSafeReadModelScope: true;\n    readonly revisionBoundEtags: true;\n    readonly boundedServerSnapshotCache: true;\n    readonly currentGrantSnapshotRevalidation: true;\n  };",
)
replace_once(
    boundary,
    "  | 'AUTH_PERMISSION_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
    "  | 'AUTH_PERMISSION_SOURCE'\n  | 'RUNTIME_READ_MODEL_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
)
replace_once(
    boundary,
    "  if (configuredValue(bindings, 'AUTH_PERMISSION_SOURCE') !== 'database') {\n    missingConfiguration.push('permission-source');\n  }\n  if (!hasValidAuthMutationOrigins",
    "  if (configuredValue(bindings, 'AUTH_PERMISSION_SOURCE') !== 'database') {\n    missingConfiguration.push('permission-source');\n  }\n  if (configuredValue(bindings, 'RUNTIME_READ_MODEL_SOURCE') !== 'database') {\n    missingConfiguration.push('runtime-read-model-source');\n  }\n  if (!hasValidAuthMutationOrigins",
)
replace_once(boundary, 'missingConfiguration.length === 12', 'missingConfiguration.length === 13')
replace_once(
    boundary,
    "      serverOwnedAuthorizationScope: true,\n    },",
    "      serverOwnedAuthorizationScope: true,\n      databaseReadModels: true,\n      tenantSafeReadModelScope: true,\n      revisionBoundEtags: true,\n      boundedServerSnapshotCache: true,\n      currentGrantSnapshotRevalidation: true,\n    },",
)

boundary_test = Path('apps/platform-api/src/auth-boundary.test.ts')
replace_once(
    boundary_test,
    "  AUTH_PERMISSION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    "  AUTH_PERMISSION_SOURCE: 'database',\n  RUNTIME_READ_MODEL_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
)
replace_once(
    boundary_test,
    "        serverOwnedAuthorizationScope: true,\n      },",
    "        serverOwnedAuthorizationScope: true,\n        databaseReadModels: true,\n        tenantSafeReadModelScope: true,\n        revisionBoundEtags: true,\n        boundedServerSnapshotCache: true,\n        currentGrantSnapshotRevalidation: true,\n      },",
)
replace_once(
    boundary_test,
    "        'permission-source',\n        'allowed-web-origins',",
    "        'permission-source',\n        'runtime-read-model-source',\n        'allowed-web-origins',",
)

index = Path('apps/platform-api/src/index.ts')
replace_once(
    index,
    "import { isAllowedPilotWebOrigin, resolvePilotReadSnapshot } from './pilot-read-models.js';",
    "import {\n  resolveDatabaseReadModel,\n  RuntimeReadModelCache,\n} from './database-read-model.js';\nimport { DatabaseReadModelStore } from './database-read-model-store.js';\nimport { isAllowedPilotWebOrigin, resolvePilotReadSnapshot } from './pilot-read-models.js';",
)
replace_once(
    index,
    "const app = new Hono<{ Bindings: Bindings }>();",
    "const app = new Hono<{ Bindings: Bindings }>();\nconst runtimeReadModelCache = new RuntimeReadModelCache();",
)
read_cors = '''
function applyAuthReadCors(
  headers: (name: string, value: string) => void,
  allowedOrigins: string | undefined,
  origin: string | undefined,
): boolean {
  if (!isAllowedAuthMutationOrigin(allowedOrigins, origin) || origin === undefined) return false;
  headers('access-control-allow-origin', origin);
  headers('access-control-allow-credentials', 'true');
  headers('access-control-allow-methods', 'GET, OPTIONS');
  headers('access-control-allow-headers', 'if-none-match');
  headers('access-control-expose-headers', 'etag, x-correlation-id');
  headers('access-control-max-age', '600');
  return true;
}

'''
replace_once(index, "app.post('/auth/v1/backchannel-logout'", read_cors + "app.post('/auth/v1/backchannel-logout'")
route = '''
function durableReadModelStores(environment: Bindings):
  | { readonly auth: DurableAuthStore; readonly readModel: DatabaseReadModelStore }
  | undefined {
  if (
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    environment.RUNTIME_READ_MODEL_SOURCE !== 'database' ||
    environment.DATABASE_URL === undefined ||
    environment.DATABASE_URL.trim() === ''
  ) {
    return undefined;
  }
  const database = createHttpDatabase(environment.DATABASE_URL);
  return { auth: new DurableAuthStore(database), readModel: new DatabaseReadModelStore(database) };
}

app.options('/auth/v1/snapshot', (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin');
  const stores = durableReadModelStores(context.env);
  if (stores === undefined || !hasValidAuthMutationOrigins(context.env.AUTH_ALLOWED_WEB_ORIGINS)) {
    return context.json(
      {
        error: {
          code: 'runtime_read_model_configuration_invalid',
          message: 'Database read models are not configured.',
        },
      },
      503,
    );
  }
  if (
    !applyAuthReadCors(
      (name, value) => context.header(name, value),
      context.env.AUTH_ALLOWED_WEB_ORIGINS,
      context.req.header('origin'),
    )
  ) {
    return context.json(
      {
        error: {
          code: 'runtime_read_model_origin_denied',
          message: 'The requesting origin is not permitted.',
        },
      },
      403,
    );
  }
  return context.body(null, 204);
});

app.get('/auth/v1/snapshot', async (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin, Cookie, If-None-Match');
  const origin = context.req.header('origin');
  const stores = durableReadModelStores(context.env);
  const configured =
    stores !== undefined &&
    context.env.AUTH_SESSION_SECRET !== undefined &&
    context.env.AUTH_SESSION_SECRET.length >= 32 &&
    hasValidAuthMutationOrigins(context.env.AUTH_ALLOWED_WEB_ORIGINS);
  if (!configured || stores === undefined) {
    return context.json(
      {
        error: {
          code: 'runtime_read_model_configuration_invalid',
          message: 'Database read models are not configured.',
        },
      },
      503,
    );
  }
  if (
    !applyAuthReadCors(
      (name, value) => context.header(name, value),
      context.env.AUTH_ALLOWED_WEB_ORIGINS,
      origin,
    )
  ) {
    return context.json(
      {
        error: {
          code: 'runtime_read_model_origin_denied',
          message: 'The requesting origin is not permitted.',
        },
      },
      403,
    );
  }

  const session = await resolveAuthenticatedBrowserSessionContext(
    context.env,
    context.req.header('cookie'),
    (sessionId) => stores.auth.isSessionActive(sessionId),
  );
  if (!session.ok) {
    return context.json(
      { error: { code: session.code, message: session.message } },
      session.status,
    );
  }
  const resolution = await resolveDatabaseReadModel({
    sessionId: session.context.sessionId,
    store: stores.readModel,
    cache: runtimeReadModelCache,
    ...(context.req.header('if-none-match') === undefined
      ? {}
      : { ifNoneMatch: context.req.header('if-none-match') }),
  });
  if (!resolution.ok) {
    return context.json(
      { error: { code: resolution.code, message: resolution.message } },
      resolution.status,
    );
  }
  context.header('etag', resolution.etag);
  context.header('cache-control', 'private, max-age=0, must-revalidate');
  if (resolution.status === 304) return context.body(null, 304);
  return context.json(resolution.snapshot);
});

'''
replace_once(index, "app.options('/auth/v1/logout'", route + "app.options('/auth/v1/logout'")
replace_once(
    index,
    "export * from './auth-permission.js';\n",
    "export * from './auth-permission.js';\nexport * from './database-read-model.js';\nexport * from './database-read-model-store.js';\n",
)

index_test = Path('apps/platform-api/src/index.test.ts')
replace_once(
    index_test,
    "  AUTH_PERMISSION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    "  AUTH_PERMISSION_SOURCE: 'database',\n  RUNTIME_READ_MODEL_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
)
replace_once(
    index_test,
    "        stepUpAssurance: true,\n      },",
    "        stepUpAssurance: true,\n        databaseReadModels: true,\n        tenantSafeReadModelScope: true,\n        revisionBoundEtags: true,\n        boundedServerSnapshotCache: true,\n        currentGrantSnapshotRevalidation: true,\n      },",
)
snapshot_tests = '''

  it('serves an exact database snapshot with private revision-bound revalidation', async () => {
    const head = {
      tenantId: '40000000-0000-4000-8000-000000000003',
      membershipId: '40000000-0000-4000-8000-000000000001',
      campusId: '40000000-0000-4000-8000-000000000004',
      persona: 'admin',
      subjectRef: 'principal-dashboard',
      capabilities: ['finance.read'],
      revision: 7,
      generatedAt: '2026-07-31T03:40:00.000Z',
      sourceUpdatedAt: '2026-07-31T03:39:30.000Z',
      payloadDigest: 'a'.repeat(64),
      capabilityDigest: 'b'.repeat(64),
      payloadBytes: 128,
    };
    databaseQuery
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([head])
      .mockResolvedValueOnce([{ payload: { metrics: [{ id: 'students', value: 42 }] } }]);
    const response = await app.request(
      '/auth/v1/snapshot',
      {
        headers: {
          origin: 'https://school.test',
          cookie: await issueBrowserCookie(),
        },
      },
      environment,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate');
    expect(response.headers.get('vary')).toBe('Origin, Cookie, If-None-Match');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://school.test');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('etag')).toMatch(/^"rm1-[A-Za-z0-9_-]+"$/u);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      scope: {
        tenantId: head.tenantId,
        membershipId: head.membershipId,
        campusId: head.campusId,
        capabilities: ['finance.read'],
      },
      revision: 7,
      data: { metrics: [{ id: 'students', value: 42 }] },
    });
  });

  it('returns 304 only after current session and database head revalidation', async () => {
    const head = {
      tenantId: '40000000-0000-4000-8000-000000000003',
      membershipId: '40000000-0000-4000-8000-000000000001',
      campusId: '40000000-0000-4000-8000-000000000004',
      persona: 'admin',
      subjectRef: 'principal-dashboard',
      capabilities: ['finance.read'],
      revision: 8,
      generatedAt: '2026-07-31T03:41:00.000Z',
      sourceUpdatedAt: '2026-07-31T03:40:30.000Z',
      payloadDigest: 'c'.repeat(64),
      capabilityDigest: 'd'.repeat(64),
      payloadBytes: 128,
    };
    databaseQuery
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([head])
      .mockResolvedValueOnce([{ payload: { metrics: [] } }]);
    const first = await app.request(
      '/auth/v1/snapshot',
      { headers: { origin: 'https://school.test', cookie: await issueBrowserCookie() } },
      environment,
    );
    const etag = first.headers.get('etag');
    expect(first.status).toBe(200);
    expect(etag).not.toBeNull();

    databaseQuery.mockReset();
    databaseQuery.mockResolvedValueOnce([{ value: true }]).mockResolvedValueOnce([head]);
    const revalidated = await app.request(
      '/auth/v1/snapshot',
      {
        headers: {
          origin: 'https://school.test',
          cookie: await issueBrowserCookie(),
          'if-none-match': etag ?? '',
        },
      },
      environment,
    );
    expect(revalidated.status).toBe(304);
    expect(databaseQuery).toHaveBeenCalledTimes(2);
  });

  it('keeps database snapshots fail-closed for missing bindings and wrong origins', async () => {
    const unconfigured = await app.request(
      '/auth/v1/snapshot',
      { headers: { origin: 'https://school.test' } },
      { APP_ENV: 'test', APP_REGION: 'local' },
    );
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.headers.get('access-control-allow-origin')).toBeNull();

    const denied = await app.request(
      '/auth/v1/snapshot',
      { headers: { origin: 'https://evil.test', cookie: await issueBrowserCookie() } },
      environment,
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    expect(databaseQuery).not.toHaveBeenCalled();
  });
'''
replace_once(
    index_test,
    "\n  it('permits only the exact configured logout origin during preflight'",
    snapshot_tests + "\n  it('permits only the exact configured logout origin during preflight'",
)
