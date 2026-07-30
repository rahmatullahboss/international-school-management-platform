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


TEST_FILE = r'''import { describe, expect, it, vi } from 'vitest';

import {
  handleOidcBackchannelLogoutRequest,
  type OidcBackchannelProcessor,
} from './auth-backchannel.js';

const token = 'header.claims.signature';

function successProcessor(): OidcBackchannelProcessor {
  return vi.fn(async () => {
    await Promise.resolve();
    return {
      ok: true,
      replayed: false,
      revokedSessions: 2,
      claims: {
        issuer: 'https://identity.school.test',
        subject: 'provider-user-123',
        providerSessionId: 'provider-session-abc',
        tokenId: 'logout-token-123',
        issuedAt: 1_785_382_400,
        expiresAt: 1_785_382_700,
      },
    };
  });
}

describe('OIDC back-channel HTTP boundary', () => {
  it('accepts one form-encoded Logout Token and returns an empty success', async () => {
    const processor = successProcessor();
    await expect(
      handleOidcBackchannelLogoutRequest({
        configured: true,
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${encodeURIComponent(token)}`,
        processor,
      }),
    ).resolves.toEqual({ ok: true, status: 200 });
    expect(processor).toHaveBeenCalledOnce();
    expect(processor).toHaveBeenCalledWith(token);
  });

  it('rejects wrong content types, duplicate, unknown, empty and oversized fields before processing', async () => {
    const processor = successProcessor();
    for (const input of [
      { contentType: 'application/json', rawBody: `logout_token=${token}` },
      { contentType: 'application/x-www-form-urlencoded', rawBody: 'logout_token=' },
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${token}&logout_token=${token}`,
      },
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${token}&state=browser-controlled`,
      },
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${'x'.repeat(16 * 1024 + 1)}`,
      },
    ]) {
      await expect(
        handleOidcBackchannelLogoutRequest({ configured: true, ...input, processor }),
      ).resolves.toEqual({
        ok: false,
        status: 400,
        code: 'backchannel_logout_request_invalid',
        message: 'The back-channel logout request is invalid.',
      });
    }
    expect(processor).not.toHaveBeenCalled();
  });

  it('fails closed before token processing when durable configuration is absent', async () => {
    const processor = successProcessor();
    await expect(
      handleOidcBackchannelLogoutRequest({
        configured: false,
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${token}`,
        processor,
      }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'backchannel_logout_configuration_invalid',
      message: 'Back-channel logout is not configured.',
    });
    expect(processor).not.toHaveBeenCalled();
  });

  it('sanitizes invalid tokens and durable processing outages', async () => {
    const invalid: OidcBackchannelProcessor = async () => {
      await Promise.resolve();
      return {
        ok: false,
        code: 'oidc_backchannel_signature_invalid',
        message: 'internal signature detail',
      };
    };
    const unavailable: OidcBackchannelProcessor = async () => {
      await Promise.resolve();
      return {
        ok: false,
        code: 'oidc_backchannel_replay_unavailable',
        message: 'internal database detail',
      };
    };
    const request = {
      configured: true,
      contentType: 'application/x-www-form-urlencoded',
      rawBody: `logout_token=${token}`,
    };
    await expect(
      handleOidcBackchannelLogoutRequest({ ...request, processor: invalid }),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'backchannel_logout_token_invalid',
      message: 'The Logout Token is invalid.',
    });
    await expect(
      handleOidcBackchannelLogoutRequest({ ...request, processor: unavailable }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'backchannel_logout_unavailable',
      message: 'Back-channel logout is unavailable.',
    });
  });
});
'''

IMPLEMENTATION = r'''import type { OidcBackchannelLogoutProcessResult } from '@school/policy';

const MAX_LOGOUT_TOKEN_LENGTH = 16 * 1024;
const MAX_REQUEST_LENGTH = MAX_LOGOUT_TOKEN_LENGTH + 1024;

export type OidcBackchannelProcessor = (
  logoutToken: string,
) => Promise<OidcBackchannelLogoutProcessResult>;

export interface HandleOidcBackchannelLogoutRequestInput {
  readonly configured: boolean;
  readonly contentType: string | undefined;
  readonly contentLength?: string;
  readonly rawBody: string;
  readonly processor: OidcBackchannelProcessor;
}

export type OidcBackchannelHttpResult =
  | { readonly ok: true; readonly status: 200 }
  | {
      readonly ok: false;
      readonly status: 400 | 503;
      readonly code: string;
      readonly message: string;
    };

function invalidRequest(): OidcBackchannelHttpResult {
  return {
    ok: false,
    status: 400,
    code: 'backchannel_logout_request_invalid',
    message: 'The back-channel logout request is invalid.',
  };
}

function isFormContentType(value: string | undefined): boolean {
  if (value === undefined) return false;
  const [mediaType, ...parameters] = value.toLowerCase().split(';').map((part) => part.trim());
  if (mediaType !== 'application/x-www-form-urlencoded') return false;
  return parameters.every((parameter) => parameter === '' || parameter === 'charset=utf-8');
}

function parseLogoutToken(rawBody: string): string | undefined {
  if (rawBody.length === 0 || rawBody.length > MAX_REQUEST_LENGTH) return undefined;
  const params = new URLSearchParams(rawBody);
  const keys = [...params.keys()];
  if (keys.length !== 1 || keys[0] !== 'logout_token') return undefined;
  const values = params.getAll('logout_token');
  const token = values[0];
  if (
    values.length !== 1 ||
    token === undefined ||
    token.trim() === '' ||
    token.length > MAX_LOGOUT_TOKEN_LENGTH
  ) {
    return undefined;
  }
  return token;
}

function processingUnavailable(code: string): boolean {
  return (
    code === 'oidc_backchannel_configuration_invalid' ||
    code === 'oidc_backchannel_replay_unavailable' ||
    code === 'oidc_backchannel_revocation_unavailable'
  );
}

export async function handleOidcBackchannelLogoutRequest(
  input: HandleOidcBackchannelLogoutRequestInput,
): Promise<OidcBackchannelHttpResult> {
  if (!input.configured) {
    return {
      ok: false,
      status: 503,
      code: 'backchannel_logout_configuration_invalid',
      message: 'Back-channel logout is not configured.',
    };
  }
  if (!isFormContentType(input.contentType)) return invalidRequest();
  if (input.contentLength !== undefined) {
    const length = Number.parseInt(input.contentLength, 10);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_REQUEST_LENGTH) {
      return invalidRequest();
    }
  }
  const logoutToken = parseLogoutToken(input.rawBody);
  if (logoutToken === undefined) return invalidRequest();

  let result: OidcBackchannelLogoutProcessResult;
  try {
    result = await input.processor(logoutToken);
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'backchannel_logout_unavailable',
      message: 'Back-channel logout is unavailable.',
    };
  }
  if (result.ok) return { ok: true, status: 200 };
  if (processingUnavailable(result.code)) {
    return {
      ok: false,
      status: 503,
      code: 'backchannel_logout_unavailable',
      message: 'Back-channel logout is unavailable.',
    };
  }
  return {
    ok: false,
    status: 400,
    code: 'backchannel_logout_token_invalid',
    message: 'The Logout Token is invalid.',
  };
}
'''


def add_tests() -> None:
    (ROOT / 'apps/platform-api/src/auth-backchannel.test.ts').write_text(TEST_FILE, encoding='utf-8')
    boundary_test = ROOT / 'apps/platform-api/src/auth-boundary.test.ts'
    source = boundary_test.read_text(encoding='utf-8')
    source = source.replace(
        "  OIDC_PROVIDER_CACHE_SOURCE: 'durable-cache',",
        "  OIDC_PROVIDER_CACHE_SOURCE: 'database',\n  OIDC_BACKCHANNEL_LOGOUT_SOURCE: 'database',",
    )
    source = source.replace(
        "        reviewedAcrValues: true,",
        "        reviewedAcrValues: true,\n        backChannelLogout: true,\n        typedLogoutTokens: true,\n        logoutTokenReplayProtection: true,\n        providerSessionRevocation: true,\n        durableProviderCache: true,",
    )
    source = source.replace(
        "        'provider-cache-source',\n        'provider-client-credential',",
        "        'provider-cache-source',\n        'backchannel-logout-source',\n        'provider-client-credential',",
    )
    boundary_test.write_text(source, encoding='utf-8')

    index_test = ROOT / 'apps/platform-api/src/index.test.ts'
    source = index_test.read_text(encoding='utf-8')
    marker = "  it('keeps the logout route fail-closed when durable identity configuration is absent', async () => {"
    block = """  it('keeps provider back-channel logout fail-closed and free of browser CORS', async () => {
    const response = await app.request('/auth/v1/backchannel-logout', {
      method: 'POST',
      headers: {
        Origin: 'https://school.test',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'logout_token=header.claims.signature',
    }, testEnvironment);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'backchannel_logout_configuration_invalid',
        message: 'Back-channel logout is not configured.',
      },
    });
  });

"""
    if block not in source:
        if source.count(marker) != 1:
            raise SystemExit('index test marker missing')
        source = source.replace(marker, block + marker)
    index_test.write_text(source, encoding='utf-8')


def apply_implementation() -> None:
    (ROOT / 'apps/platform-api/src/auth-backchannel.ts').write_text(IMPLEMENTATION, encoding='utf-8')

    boundary = ROOT / 'apps/platform-api/src/auth-boundary.ts'
    source = boundary.read_text(encoding='utf-8')
    source = source.replace(
        "  readonly OIDC_PROVIDER_CACHE_SOURCE?: string;",
        "  readonly OIDC_PROVIDER_CACHE_SOURCE?: string;\n  readonly OIDC_BACKCHANNEL_LOGOUT_SOURCE?: string;",
    )
    source = source.replace(
        "  | 'provider-cache-source'\n  | 'provider-client-credential'",
        "  | 'provider-cache-source'\n  | 'backchannel-logout-source'\n  | 'provider-client-credential'",
    )
    source = source.replace(
        "    readonly reviewedAcrValues: true;",
        "    readonly reviewedAcrValues: true;\n    readonly backChannelLogout: true;\n    readonly typedLogoutTokens: true;\n    readonly logoutTokenReplayProtection: true;\n    readonly providerSessionRevocation: true;\n    readonly durableProviderCache: true;",
    )
    source = source.replace(
        "  | 'OIDC_PROVIDER_CACHE_SOURCE'\n  | 'AUTH_TRANSACTION_SECRET'",
        "  | 'OIDC_PROVIDER_CACHE_SOURCE'\n  | 'OIDC_BACKCHANNEL_LOGOUT_SOURCE'\n  | 'AUTH_TRANSACTION_SECRET'",
    )
    source = source.replace(
        "function providerConfiguration(bindings: AuthBindings): OidcProviderConfiguration | undefined {",
        "export function resolveAuthProviderConfiguration(\n  bindings: AuthBindings,\n): OidcProviderConfiguration | undefined {",
    )
    source = source.replace("  const configuration = providerConfiguration(bindings);", "  const configuration = resolveAuthProviderConfiguration(bindings);")
    source = source.replace(
        "function exactHttpsOrigins(value: string | undefined): readonly string[] | undefined {",
        "function exactHttpsOrigins(value: string | undefined): readonly string[] | undefined {",
    )
    helper_marker = "function hasValidProviderEndpointOrigins("
    helper = """export function resolveAuthProviderEndpointOrigins(
  bindings: AuthBindings,
): readonly string[] | undefined {
  return exactHttpsOrigins(configuredValue(bindings, 'OIDC_ENDPOINT_ORIGINS'));
}

"""
    if helper not in source:
        source = source.replace(helper_marker, helper + helper_marker)
    source = source.replace(
        "  if (configuredValue(bindings, 'OIDC_PROVIDER_CACHE_SOURCE') === undefined) {\n    missingConfiguration.push('provider-cache-source');\n  }",
        "  if (configuredValue(bindings, 'OIDC_PROVIDER_CACHE_SOURCE') !== 'database') {\n    missingConfiguration.push('provider-cache-source');\n  }\n  if (configuredValue(bindings, 'OIDC_BACKCHANNEL_LOGOUT_SOURCE') !== 'database') {\n    missingConfiguration.push('backchannel-logout-source');\n  }",
    )
    source = source.replace("missingConfiguration.length === 10", "missingConfiguration.length === 11")
    source = source.replace(
        "      reviewedAcrValues: true,",
        "      reviewedAcrValues: true,\n      backChannelLogout: true,\n      typedLogoutTokens: true,\n      logoutTokenReplayProtection: true,\n      providerSessionRevocation: true,\n      durableProviderCache: true,",
    )
    boundary.write_text(source, encoding='utf-8')

    index = ROOT / 'apps/platform-api/src/index.ts'
    source = index.read_text(encoding='utf-8')
    source = source.replace(
        "import { createHttpDatabase } from '@school/database';",
        "import { createHttpDatabase } from '@school/database';\nimport { OidcProviderCache, processOidcBackchannelLogout } from '@school/policy';",
    )
    source = source.replace(
        "  resolveAuthenticatedBrowserSession,\n  resolveAuthReadiness,",
        "  resolveAuthenticatedBrowserSession,\n  resolveAuthProviderConfiguration,\n  resolveAuthProviderEndpointOrigins,\n  resolveAuthReadiness,",
    )
    source = source.replace(
        "import { DurableAuthStore } from './auth-durable-store.js';",
        "import { handleOidcBackchannelLogoutRequest } from './auth-backchannel.js';\nimport { DurableAuthStore, DurableOidcProviderCacheStore } from './auth-durable-store.js';",
    )
    route_marker = "app.options('/auth/v1/logout', (context) => {"
    route = """app.post('/auth/v1/backchannel-logout', async (context) => {
  context.header('cache-control', 'no-store');
  context.header('vary', 'Content-Type');
  const configuration = resolveAuthProviderConfiguration(context.env);
  const allowedOrigins = resolveAuthProviderEndpointOrigins(context.env);
  const configured =
    configuration !== undefined &&
    allowedOrigins !== undefined &&
    context.env.OIDC_PROVIDER_CACHE_SOURCE === 'database' &&
    context.env.OIDC_BACKCHANNEL_LOGOUT_SOURCE === 'database' &&
    context.env.DATABASE_URL !== undefined &&
    context.env.DATABASE_URL.trim() !== '';

  let rawBody = '';
  if (configured) {
    try {
      rawBody = await context.req.text();
    } catch {
      rawBody = '';
    }
  }
  const result = await handleOidcBackchannelLogoutRequest({
    configured,
    contentType: context.req.header('content-type'),
    ...(context.req.header('content-length') === undefined
      ? {}
      : { contentLength: context.req.header('content-length')! }),
    rawBody,
    processor: async (logoutToken) => {
      if (configuration === undefined || allowedOrigins === undefined || context.env.DATABASE_URL === undefined) {
        throw new Error('Back-channel logout configuration disappeared.');
      }
      const database = createHttpDatabase(context.env.DATABASE_URL);
      const durableAuth = new DurableAuthStore(database);
      const cache = new OidcProviderCache({
        store: new DurableOidcProviderCacheStore(database),
        allowedEndpointOrigins: allowedOrigins,
      });
      return processOidcBackchannelLogout({
        logoutToken,
        configuration,
        resolveJwks: (forceRefresh) =>
          cache.resolveJwks({ configuration, ...(forceRefresh ? { forceRefresh: true } : {}) }),
        consumeToken: (claims) => durableAuth.consumeBackchannelLogoutToken(claims),
        revokeSessions: (claims) =>
          durableAuth.revokeProviderSessions(claims, 'provider back-channel logout'),
      });
    },
  });
  if (result.ok) return context.body(null, result.status);
  return context.json(
    { error: { code: result.code, message: result.message } },
    result.status,
  );
});

"""
    if route not in source:
        if source.count(route_marker) != 1:
            raise SystemExit('index route marker missing')
        source = source.replace(route_marker, route + route_marker)
    source = source.replace(
        "export * from './auth-boundary.js';",
        "export * from './auth-backchannel.js';\nexport * from './auth-boundary.js';",
    )
    index.write_text(source, encoding='utf-8')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'test', 'implementation'}:
        raise SystemExit('usage: implement_auth_07_endpoint.py test|implementation')
    if sys.argv[1] == 'test':
        add_tests()
    else:
        apply_implementation()


if __name__ == '__main__':
    main()
