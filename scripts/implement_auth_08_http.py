#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one marker, found {count}: {old[:120]!r}')
    target.write_text(source.replace(old, new), encoding='utf-8')


TEST_CONTENT = r'''import { describe, expect, it, vi } from 'vitest';

import {
  authorizeDatabasePermission,
  isPermissionDeclaredLengthAllowed,
  type PermissionAuthenticator,
  type PermissionEvaluator,
} from './auth-permission.js';

const allowedOrigins = 'https://school.test';
const sessionId = '40000000-0000-4000-8000-000000000006';

function authenticated(): PermissionAuthenticator {
  return vi.fn(async () => {
    await Promise.resolve();
    return { ok: true, sessionId };
  });
}

function evaluator(
  decision:
    | { readonly allowed: true; readonly reason: 'role-grant' }
    | {
        readonly allowed: false;
        readonly reason: 'permission-not-granted' | 'session-inactive';
      }
    | {
        readonly allowed: false;
        readonly reason: 'step-up-required';
        readonly requiredAssurance: 'aal2';
      },
): PermissionEvaluator {
  return vi.fn(async () => {
    await Promise.resolve();
    return decision;
  });
}

describe('database-backed permission HTTP boundary', () => {
  it('authorizes one exact permission using only the signed active session id', async () => {
    const authenticate = authenticated();
    const evaluate = evaluator({ allowed: true, reason: 'role-grant' });
    await expect(
      authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'finance.read' }),
        authenticate,
        evaluate,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 200,
      decision: { allowed: true, reason: 'role-grant' },
    });
    expect(authenticate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith(sessionId, 'finance.read');
  });

  it('returns current database denial and AAL2 step-up decisions without leaking grants', async () => {
    await expect(
      authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json; charset=utf-8',
        rawBody: JSON.stringify({ permission: 'care.restricted.read' }),
        authenticate: authenticated(),
        evaluate: evaluator({ allowed: false, reason: 'permission-not-granted' }),
      }),
    ).resolves.toEqual({
      ok: true,
      status: 403,
      decision: { allowed: false, reason: 'permission-not-granted' },
    });
    await expect(
      authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'records.approve' }),
        authenticate: authenticated(),
        evaluate: evaluator({
          allowed: false,
          reason: 'step-up-required',
          requiredAssurance: 'aal2',
        }),
      }),
    ).resolves.toEqual({
      ok: true,
      status: 403,
      decision: {
        allowed: false,
        reason: 'step-up-required',
        requiredAssurance: 'aal2',
      },
    });
  });

  it('rejects browser-declared scope, malformed keys and unsafe origins before authentication', async () => {
    for (const input of [
      {
        origin: 'https://evil.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'finance.read' }),
        status: 403,
      },
      {
        origin: 'https://school.test',
        contentType: 'text/plain',
        rawBody: JSON.stringify({ permission: 'finance.read' }),
        status: 400,
      },
      {
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'finance.read', tenantId: 'attacker' }),
        status: 400,
      },
      {
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'Finance Read' }),
        status: 400,
      },
    ] as const) {
      const authenticate = authenticated();
      const evaluate = evaluator({ allowed: true, reason: 'role-grant' });
      const result = await authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: input.origin,
        contentType: input.contentType,
        rawBody: input.rawBody,
        authenticate,
        evaluate,
      });
      expect(result).toMatchObject({ ok: false, status: input.status });
      expect(authenticate).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    }
  });

  it('fails closed for missing configuration, inactive cookies and database outages', async () => {
    const request = {
      allowedOrigins,
      origin: 'https://school.test',
      contentType: 'application/json',
      rawBody: JSON.stringify({ permission: 'finance.read' }),
    };
    await expect(
      authorizeDatabasePermission({
        ...request,
        configured: false,
        authenticate: authenticated(),
        evaluate: evaluator({ allowed: true, reason: 'role-grant' }),
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'permission_configuration_invalid',
    });
    await expect(
      authorizeDatabasePermission({
        ...request,
        configured: true,
        authenticate: async () => {
          await Promise.resolve();
          return {
            ok: false,
            status: 401,
            code: 'browser_session_revoked',
            message: 'The browser session is no longer active.',
          };
        },
        evaluate: evaluator({ allowed: true, reason: 'role-grant' }),
      }),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'browser_session_revoked' });
    await expect(
      authorizeDatabasePermission({
        ...request,
        configured: true,
        authenticate: authenticated(),
        evaluate: async () => {
          await Promise.resolve();
          throw new Error('database detail');
        },
      }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'permission_evaluation_unavailable',
      message: 'Permission evaluation is unavailable.',
    });
  });

  it('validates the declared body length before route body consumption', () => {
    expect(isPermissionDeclaredLengthAllowed(undefined)).toBe(true);
    expect(isPermissionDeclaredLengthAllowed('00042')).toBe(true);
    expect(isPermissionDeclaredLengthAllowed('42garbage')).toBe(false);
    expect(isPermissionDeclaredLengthAllowed('2049')).toBe(false);
  });
});
'''

STUB = r'''export type PermissionAuthenticator = () => Promise<
  | { readonly ok: true; readonly sessionId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    }
>;

export type PermissionEvaluator = (
  sessionId: string,
  permission: string,
) => Promise<
  | { readonly allowed: true; readonly reason: 'role-grant' }
  | {
      readonly allowed: false;
      readonly reason: 'permission-not-granted' | 'session-inactive';
    }
  | {
      readonly allowed: false;
      readonly reason: 'step-up-required';
      readonly requiredAssurance: 'aal2';
    }
>;

export function isPermissionDeclaredLengthAllowed(_value: string | undefined): boolean {
  return false;
}

export async function authorizeDatabasePermission(_input: unknown): Promise<{
  readonly ok: false;
  readonly status: 503;
  readonly code: string;
  readonly message: string;
}> {
  await Promise.resolve();
  return {
    ok: false,
    status: 503,
    code: 'permission_not_implemented',
    message: 'Permission evaluation is not implemented.',
  };
}
'''

IMPLEMENTATION = r'''import { hasValidAuthMutationOrigins, isAllowedAuthMutationOrigin } from './auth-logout.js';

const MAX_PERMISSION_REQUEST_LENGTH = 2048;
const PERMISSION_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;

export type PermissionAuthenticator = () => Promise<
  | { readonly ok: true; readonly sessionId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    }
>;

export type PermissionDecision =
  | { readonly allowed: true; readonly reason: 'role-grant' }
  | {
      readonly allowed: false;
      readonly reason: 'permission-not-granted' | 'session-inactive';
    }
  | {
      readonly allowed: false;
      readonly reason: 'step-up-required';
      readonly requiredAssurance: 'aal2';
    };

export type PermissionEvaluator = (
  sessionId: string,
  permission: string,
) => Promise<PermissionDecision>;

export interface AuthorizeDatabasePermissionInput {
  readonly configured: boolean;
  readonly allowedOrigins: string | undefined;
  readonly origin: string | undefined;
  readonly contentType: string | undefined;
  readonly contentLength?: string;
  readonly rawBody: string;
  readonly authenticate: PermissionAuthenticator;
  readonly evaluate: PermissionEvaluator;
}

export type DatabasePermissionHttpResult =
  | {
      readonly ok: true;
      readonly status: 200 | 403;
      readonly decision: Exclude<PermissionDecision, { readonly reason: 'session-inactive' }>;
    }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403 | 503;
      readonly code: string;
      readonly message: string;
    };

function isJsonContentType(value: string | undefined): boolean {
  if (value === undefined) return false;
  const [mediaType, ...parameters] = value.toLowerCase().split(';').map((part) => part.trim());
  if (mediaType !== 'application/json') return false;
  return parameters.every((parameter) => parameter === '' || parameter === 'charset=utf-8');
}

export function isPermissionDeclaredLengthAllowed(value: string | undefined): boolean {
  if (value === undefined) return true;
  if (!/^\d+$/u.test(value)) return false;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_PERMISSION_REQUEST_LENGTH;
}

function parsePermissionRequest(rawBody: string): string | undefined {
  if (rawBody.length === 0 || rawBody.length > MAX_PERMISSION_REQUEST_LENGTH) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 1 ||
    keys[0] !== 'permission' ||
    typeof record.permission !== 'string' ||
    !PERMISSION_KEY_PATTERN.test(record.permission)
  ) {
    return undefined;
  }
  return record.permission;
}

function failure(
  status: 400 | 401 | 403 | 503,
  code: string,
  message: string,
): DatabasePermissionHttpResult {
  return { ok: false, status, code, message };
}

export async function authorizeDatabasePermission(
  input: AuthorizeDatabasePermissionInput,
): Promise<DatabasePermissionHttpResult> {
  if (!input.configured || !hasValidAuthMutationOrigins(input.allowedOrigins)) {
    return failure(503, 'permission_configuration_invalid', 'Permission evaluation is not configured.');
  }
  if (!isAllowedAuthMutationOrigin(input.allowedOrigins, input.origin)) {
    return failure(403, 'permission_origin_denied', 'The requesting origin is not permitted.');
  }
  if (
    !isJsonContentType(input.contentType) ||
    !isPermissionDeclaredLengthAllowed(input.contentLength)
  ) {
    return failure(400, 'permission_request_invalid', 'The permission request is invalid.');
  }
  const permission = parsePermissionRequest(input.rawBody);
  if (permission === undefined) {
    return failure(400, 'permission_request_invalid', 'The permission request is invalid.');
  }

  let authentication: Awaited<ReturnType<PermissionAuthenticator>>;
  try {
    authentication = await input.authenticate();
  } catch {
    return failure(503, 'permission_session_unavailable', 'The browser session is unavailable.');
  }
  if (!authentication.ok) return authentication;

  let decision: PermissionDecision;
  try {
    decision = await input.evaluate(authentication.sessionId, permission);
  } catch {
    return failure(503, 'permission_evaluation_unavailable', 'Permission evaluation is unavailable.');
  }
  if (decision.allowed) return { ok: true, status: 200, decision };
  if (decision.reason === 'session-inactive') {
    return failure(401, 'browser_session_revoked', 'The browser session is no longer active.');
  }
  return { ok: true, status: 403, decision };
}
'''


def add_tests() -> None:
    (ROOT / 'apps/platform-api/src/auth-permission.ts').write_text(STUB, encoding='utf-8')
    (ROOT / 'apps/platform-api/src/auth-permission.test.ts').write_text(TEST_CONTENT, encoding='utf-8')

    boundary_test = ROOT / 'apps/platform-api/src/auth-boundary.test.ts'
    source = boundary_test.read_text(encoding='utf-8')
    source = source.replace(
        "import { resolveAuthenticatedBrowserSession, resolveAuthReadiness } from './auth-boundary.js';",
        "import {\n  resolveAuthenticatedBrowserSession,\n  resolveAuthenticatedBrowserSessionContext,\n  resolveAuthReadiness,\n} from './auth-boundary.js';",
    )
    source = source.replace(
        "  AUTH_MEMBERSHIP_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
        "  AUTH_MEMBERSHIP_SOURCE: 'database',\n  AUTH_PERMISSION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    )
    source = source.replace(
        "        durableProviderCache: true,",
        "        durableProviderCache: true,\n        databasePermissionEvaluation: true,\n        currentRoleRevalidation: true,\n        assuranceAwarePermissionDecision: true,\n        serverOwnedAuthorizationScope: true,",
    )
    source = source.replace(
        "        'membership-source',\n        'allowed-web-origins',",
        "        'membership-source',\n        'permission-source',\n        'allowed-web-origins',",
    )
    marker = "    await expect(\n      resolveAuthenticatedBrowserSession(completeBindings, cookie, async () => {"
    context_block = """    const contextResolution = await resolveAuthenticatedBrowserSessionContext(
      completeBindings,
      cookie,
      async () => {
        await Promise.resolve();
        return true;
      },
    );
    expect(contextResolution).toMatchObject({
      ok: true,
      context: { sessionId: issued.claims.sessionId },
    });

"""
    if context_block not in source:
        if source.count(marker) != 1:
            raise SystemExit('boundary session context marker missing')
        source = source.replace(marker, context_block + marker)
    boundary_test.write_text(source, encoding='utf-8')

    index_test = ROOT / 'apps/platform-api/src/index.test.ts'
    source = index_test.read_text(encoding='utf-8')
    source = source.replace(
        "  AUTH_SESSION_REGISTRY_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
        "  AUTH_SESSION_REGISTRY_SOURCE: 'database',\n  AUTH_PERMISSION_SOURCE: 'database',\n  AUTH_ALLOWED_WEB_ORIGINS:",
    )
    marker = "  it('permits only the exact configured logout origin during preflight', async () => {"
    block = """  it('authorizes permissions from the active database session and current grants', async () => {
    databaseQuery
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([{ value: { allowed: true, reason: 'role-grant' } }]);
    const response = await app.request(
      '/auth/v1/authorize',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
          cookie: await issueBrowserCookie(),
        },
        body: JSON.stringify({ permission: 'finance.read' }),
      },
      environment,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://school.test');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      allowed: true,
      reason: 'role-grant',
    });
    expect(databaseQuery.mock.calls[0]?.[0]).toContain('iam.is_browser_session_active');
    expect(databaseQuery.mock.calls[1]?.[0]).toContain('iam.evaluate_browser_permission');
    expect(databaseQuery.mock.calls[1]?.[1]?.[1]).toBe('finance.read');
  });

  it('returns step-up and rejects browser-supplied authorization scope', async () => {
    databaseQuery
      .mockResolvedValueOnce([{ value: true }])
      .mockResolvedValueOnce([
        { value: { allowed: false, reason: 'step-up-required', requiredAssurance: 'aal2' } },
      ]);
    const stepUp = await app.request(
      '/auth/v1/authorize',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
          cookie: await issueBrowserCookie(),
        },
        body: JSON.stringify({ permission: 'records.approve' }),
      },
      environment,
    );
    expect(stepUp.status).toBe(403);
    await expect(stepUp.json()).resolves.toEqual({
      schemaVersion: 1,
      allowed: false,
      reason: 'step-up-required',
      requiredAssurance: 'aal2',
    });

    databaseQuery.mockReset();
    const injected = await app.request(
      '/auth/v1/authorize',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
          cookie: await issueBrowserCookie(),
        },
        body: JSON.stringify({
          permission: 'finance.read',
          tenantId: 'attacker-tenant',
          roleId: 'attacker-role',
        }),
      },
      environment,
    );
    expect(injected.status).toBe(400);
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('keeps database permission evaluation fail-closed without approved bindings', async () => {
    const response = await app.request(
      '/auth/v1/authorize',
      {
        method: 'POST',
        headers: {
          origin: 'https://school.test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ permission: 'finance.read' }),
      },
      { APP_ENV: 'test', APP_REGION: 'local' },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(databaseQuery).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'permission_configuration_invalid',
        message: 'Permission evaluation is not configured.',
      },
    });
  });

"""
    if block not in source:
        if source.count(marker) != 1:
            raise SystemExit('index permission route marker missing')
        source = source.replace(marker, block + marker)
    index_test.write_text(source, encoding='utf-8')


def apply_implementation() -> None:
    (ROOT / 'apps/platform-api/src/auth-permission.ts').write_text(IMPLEMENTATION, encoding='utf-8')

    boundary = ROOT / 'apps/platform-api/src/auth-boundary.ts'
    source = boundary.read_text(encoding='utf-8')
    source = source.replace(
        "  readonly AUTH_MEMBERSHIP_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
        "  readonly AUTH_MEMBERSHIP_SOURCE?: string;\n  readonly AUTH_PERMISSION_SOURCE?: string;\n  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;",
    )
    source = source.replace(
        "  | 'membership-source'\n  | 'allowed-web-origins';",
        "  | 'membership-source'\n  | 'permission-source'\n  | 'allowed-web-origins';",
    )
    source = source.replace(
        "    readonly durableProviderCache: true;",
        "    readonly durableProviderCache: true;\n    readonly databasePermissionEvaluation: true;\n    readonly currentRoleRevalidation: true;\n    readonly assuranceAwarePermissionDecision: true;\n    readonly serverOwnedAuthorizationScope: true;",
    )
    source = source.replace(
        "  | 'AUTH_MEMBERSHIP_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
        "  | 'AUTH_MEMBERSHIP_SOURCE'\n  | 'AUTH_PERMISSION_SOURCE'\n  | 'AUTH_ALLOWED_WEB_ORIGINS';",
    )
    source = source.replace(
        "  if (configuredValue(bindings, 'AUTH_MEMBERSHIP_SOURCE') === undefined) {\n    missingConfiguration.push('membership-source');\n  }",
        "  if (configuredValue(bindings, 'AUTH_MEMBERSHIP_SOURCE') === undefined) {\n    missingConfiguration.push('membership-source');\n  }\n  if (configuredValue(bindings, 'AUTH_PERMISSION_SOURCE') !== 'database') {\n    missingConfiguration.push('permission-source');\n  }",
    )
    source = source.replace('missingConfiguration.length === 11', 'missingConfiguration.length === 12')
    source = source.replace(
        "      durableProviderCache: true,",
        "      durableProviderCache: true,\n      databasePermissionEvaluation: true,\n      currentRoleRevalidation: true,\n      assuranceAwarePermissionDecision: true,\n      serverOwnedAuthorizationScope: true,",
    )

    start = source.find('export async function resolveAuthenticatedBrowserSession(')
    if start < 0:
        raise SystemExit('browser session resolver marker missing')
    replacement = r'''export interface AuthenticatedBrowserSessionContext {
  readonly sessionId: string;
  readonly principalId: string;
  readonly membershipId: string;
  readonly tenantId: string;
  readonly campusId?: string;
  readonly roleIds: readonly string[];
  readonly assurance: 'aal1' | 'aal2';
  readonly expiresAt: string;
}

export type AuthenticatedBrowserSessionContextResult =
  | { readonly ok: true; readonly context: AuthenticatedBrowserSessionContext }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    };

export async function resolveAuthenticatedBrowserSessionContext(
  bindings: AuthBindings,
  cookieHeader: string | undefined,
  isSessionActive?: (sessionId: string) => Promise<boolean>,
): Promise<AuthenticatedBrowserSessionContextResult> {
  const verification = await verifyBrowserSession(bindings.AUTH_SESSION_SECRET, cookieHeader);
  if (!verification.ok) {
    return {
      ok: false,
      status: verification.code === 'browser_session_configuration_invalid' ? 503 : 401,
      code: verification.code,
      message: verification.message,
    };
  }
  if (
    configuredValue(bindings, 'AUTH_SESSION_REGISTRY_SOURCE') === undefined ||
    isSessionActive === undefined
  ) {
    return {
      ok: false,
      status: 503,
      code: 'session_registry_unavailable',
      message: 'The browser session registry is unavailable.',
    };
  }

  let active: boolean;
  try {
    active = await isSessionActive(verification.claims.sessionId);
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'session_registry_unavailable',
      message: 'The browser session registry is unavailable.',
    };
  }
  if (!active) {
    return {
      ok: false,
      status: 401,
      code: 'browser_session_revoked',
      message: 'The browser session is no longer active.',
    };
  }

  return {
    ok: true,
    context: {
      sessionId: verification.claims.sessionId,
      principalId: verification.claims.principalId,
      membershipId: verification.claims.membershipId,
      tenantId: verification.claims.tenantId,
      ...(verification.claims.campusId === undefined
        ? {}
        : { campusId: verification.claims.campusId }),
      roleIds: verification.claims.roleIds,
      assurance: verification.claims.assurance,
      expiresAt: new Date(verification.claims.expiresAt * 1000).toISOString(),
    },
  };
}

export async function resolveAuthenticatedBrowserSession(
  bindings: AuthBindings,
  cookieHeader: string | undefined,
  isSessionActive?: (sessionId: string) => Promise<boolean>,
): Promise<
  | {
      readonly ok: true;
      readonly session: Omit<AuthenticatedBrowserSessionContext, 'sessionId'>;
    }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    }
> {
  const resolution = await resolveAuthenticatedBrowserSessionContext(
    bindings,
    cookieHeader,
    isSessionActive,
  );
  if (!resolution.ok) return resolution;
  const { sessionId: _sessionId, ...session } = resolution.context;
  return { ok: true, session };
}
'''
    boundary.write_text(source[:start] + replacement, encoding='utf-8')

    index = ROOT / 'apps/platform-api/src/index.ts'
    source = index.read_text(encoding='utf-8')
    source = source.replace(
        "  resolveAuthenticatedBrowserSession,\n  resolveAuthProviderConfiguration,",
        "  resolveAuthenticatedBrowserSession,\n  resolveAuthenticatedBrowserSessionContext,\n  resolveAuthProviderConfiguration,",
    )
    source = source.replace(
        "import { DurableAuthStore, DurableOidcProviderCacheStore } from './auth-durable-store.js';",
        "import { DurableAuthStore, DurableOidcProviderCacheStore } from './auth-durable-store.js';\nimport {\n  authorizeDatabasePermission,\n  isPermissionDeclaredLengthAllowed,\n} from './auth-permission.js';",
    )
    route_marker = "app.options('/auth/v1/logout', (context) => {"
    route = r'''function durablePermissionStore(environment: Bindings): DurableAuthStore | undefined {
  if (
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    environment.AUTH_PERMISSION_SOURCE !== 'database' ||
    environment.DATABASE_URL === undefined ||
    environment.DATABASE_URL.trim() === ''
  ) {
    return undefined;
  }
  return new DurableAuthStore(createHttpDatabase(environment.DATABASE_URL));
}

app.options('/auth/v1/authorize', (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin');
  const store = durablePermissionStore(context.env);
  if (store === undefined || !hasValidAuthMutationOrigins(context.env.AUTH_ALLOWED_WEB_ORIGINS)) {
    return context.json(
      {
        error: {
          code: 'permission_configuration_invalid',
          message: 'Permission evaluation is not configured.',
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
    )
  ) {
    return context.json(
      {
        error: {
          code: 'permission_origin_denied',
          message: 'The requesting origin is not permitted.',
        },
      },
      403,
    );
  }
  return context.body(null, 204);
});

app.post('/auth/v1/authorize', async (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Origin, Cookie');
  const origin = context.req.header('origin');
  applyAuthMutationCors(
    (name, value) => context.header(name, value),
    context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
  );

  const store = durablePermissionStore(context.env);
  const contentLength = context.req.header('content-length');
  const declaredLengthAllowed = isPermissionDeclaredLengthAllowed(contentLength);
  const configured =
    store !== undefined &&
    context.env.AUTH_SESSION_SECRET !== undefined &&
    context.env.AUTH_SESSION_SECRET.length >= 32;
  let rawBody = '';
  if (
    configured &&
    isAllowedAuthMutationOrigin(context.env.AUTH_ALLOWED_WEB_ORIGINS, origin) &&
    declaredLengthAllowed
  ) {
    try {
      rawBody = await context.req.text();
    } catch {
      rawBody = '';
    }
  }

  const result = await authorizeDatabasePermission({
    configured,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType: context.req.header('content-type'),
    ...(contentLength === undefined ? {} : { contentLength }),
    rawBody,
    authenticate: async () => {
      if (store === undefined) {
        throw new Error('Permission store is unavailable.');
      }
      const resolution = await resolveAuthenticatedBrowserSessionContext(
        context.env,
        context.req.header('cookie'),
        (sessionId) => store.isSessionActive(sessionId),
      );
      if (!resolution.ok) return resolution;
      return { ok: true, sessionId: resolution.context.sessionId };
    },
    evaluate: (sessionId, permission) => {
      if (store === undefined) throw new Error('Permission store is unavailable.');
      return store.evaluatePermission(sessionId, permission);
    },
  });
  if (!result.ok) {
    return context.json(
      { error: { code: result.code, message: result.message } },
      result.status,
    );
  }
  return context.json(
    { schemaVersion: 1, ...result.decision },
    result.status,
  );
});

'''
    if route not in source:
        if source.count(route_marker) != 1:
            raise SystemExit('permission route marker missing')
        source = source.replace(route_marker, route + route_marker)
    source = source.replace(
        "export * from './auth-logout.js';",
        "export * from './auth-logout.js';\nexport * from './auth-permission.js';",
    )
    index.write_text(source, encoding='utf-8')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'test', 'implementation'}:
        raise SystemExit('usage: implement_auth_08_http.py test|implementation')
    if sys.argv[1] == 'test':
        add_tests()
    else:
        apply_implementation()


if __name__ == '__main__':
    main()
