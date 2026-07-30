import { describe, expect, it, vi } from 'vitest';

import { BROWSER_SESSION_COOKIE_NAME, issueBrowserSession } from '@school/policy';

import {
  isAllowedAuthMutationOrigin,
  terminateBrowserSession,
  type LogoutRegistry,
} from './auth-logout.js';

const sessionSecret = 'browser-session-test-secret-with-at-least-32-characters';
const allowedOrigins = 'https://school.example,https://admin.school.example';

async function validCookie(): Promise<string> {
  const issued = await issueBrowserSession({
    secret: sessionSecret,
    identity: {
      issuer: 'https://identity.school.test',
      subject: 'provider-user-123',
      assurance: 'aal2',
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    },
    membership: {
      membershipId: '40000000-0000-4000-8000-000000000001',
      principalId: '40000000-0000-4000-8000-000000000002',
      tenantId: '40000000-0000-4000-8000-000000000003',
      campusId: '40000000-0000-4000-8000-000000000004',
      roleIds: ['40000000-0000-4000-8000-000000000005'],
    },
  });
  if (!issued.ok) throw new Error(issued.message);
  return `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}`;
}

function registry(overrides: Partial<LogoutRegistry> = {}): LogoutRegistry {
  return {
    isSessionActive: vi.fn(async () => {
      await Promise.resolve();
      return true;
    }),
    revokeSession: vi.fn(async () => {
      await Promise.resolve();
      return true;
    }),
    revokeAccountSessions: vi.fn(async () => {
      await Promise.resolve();
      return 3;
    }),
    ...overrides,
  };
}

describe('AUTH-04 browser logout', () => {
  it('accepts only exact configured HTTPS origins', () => {
    expect(isAllowedAuthMutationOrigin(allowedOrigins, 'https://school.example')).toBe(true);
    expect(isAllowedAuthMutationOrigin(allowedOrigins, 'https://evil.example')).toBe(false);
    expect(isAllowedAuthMutationOrigin('https://school.example/', 'https://school.example')).toBe(
      false,
    );
    expect(isAllowedAuthMutationOrigin('http://school.example', 'http://school.example')).toBe(
      false,
    );
  });

  it('revokes the current active session and clears the host cookie', async () => {
    const durableRegistry = registry();
    const result = await terminateBrowserSession({
      sessionSecret,
      registrySource: 'database',
      allowedOrigins,
      origin: 'https://school.example',
      contentType: 'application/json; charset=utf-8',
      cookieHeader: await validCookie(),
      scope: 'current',
      registry: durableRegistry,
    });

    expect(result).toMatchObject({
      ok: true,
      status: 204,
      revokedScope: 'current',
      revokedCount: 1,
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.setCookie).toContain(`${BROWSER_SESSION_COOKIE_NAME}=`);
    expect(result.setCookie).toContain('Max-Age=0');
    expect(durableRegistry.revokeSession).toHaveBeenCalledOnce();
    expect(durableRegistry.revokeAccountSessions).not.toHaveBeenCalled();
  });

  it('revokes every active account session without accepting a browser account id', async () => {
    const durableRegistry = registry();
    const result = await terminateBrowserSession({
      sessionSecret,
      registrySource: 'database',
      allowedOrigins,
      origin: 'https://admin.school.example',
      contentType: 'application/json',
      cookieHeader: await validCookie(),
      scope: 'all',
      registry: durableRegistry,
    });

    expect(result).toMatchObject({ ok: true, revokedScope: 'all', revokedCount: 3 });
    expect(durableRegistry.revokeAccountSessions).toHaveBeenCalledWith(
      '40000000-0000-4000-8000-000000000002',
      'user logout all sessions',
    );
  });

  it('denies untrusted origins and non-JSON requests before reading the session', async () => {
    const durableRegistry = registry();
    await expect(
      terminateBrowserSession({
        sessionSecret,
        registrySource: 'database',
        allowedOrigins,
        origin: 'https://evil.example',
        contentType: 'application/json',
        cookieHeader: await validCookie(),
        scope: 'current',
        registry: durableRegistry,
      }),
    ).resolves.toMatchObject({ ok: false, status: 403, code: 'logout_origin_denied' });
    await expect(
      terminateBrowserSession({
        sessionSecret,
        registrySource: 'database',
        allowedOrigins,
        origin: 'https://school.example',
        contentType: 'text/plain',
        cookieHeader: await validCookie(),
        scope: 'current',
        registry: durableRegistry,
      }),
    ).resolves.toMatchObject({ ok: false, status: 400, code: 'logout_content_type_invalid' });
    expect(durableRegistry.isSessionActive).not.toHaveBeenCalled();
  });

  it('fails closed for invalid configuration, missing cookies, revoked sessions and registry errors', async () => {
    await expect(
      terminateBrowserSession({
        sessionSecret,
        registrySource: 'database',
        allowedOrigins: undefined,
        origin: 'https://school.example',
        contentType: 'application/json',
        cookieHeader: await validCookie(),
        scope: 'current',
        registry: registry(),
      }),
    ).resolves.toMatchObject({ ok: false, status: 503, code: 'logout_configuration_invalid' });

    await expect(
      terminateBrowserSession({
        sessionSecret,
        registrySource: 'database',
        allowedOrigins,
        origin: 'https://school.example',
        contentType: 'application/json',
        cookieHeader: undefined,
        scope: 'current',
        registry: registry(),
      }),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'browser_session_missing' });

    await expect(
      terminateBrowserSession({
        sessionSecret,
        registrySource: 'database',
        allowedOrigins,
        origin: 'https://school.example',
        contentType: 'application/json',
        cookieHeader: await validCookie(),
        scope: 'current',
        registry: registry({
          isSessionActive: vi.fn(async () => {
            await Promise.resolve();
            return false;
          }),
        }),
      }),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'browser_session_revoked' });

    await expect(
      terminateBrowserSession({
        sessionSecret,
        registrySource: 'database',
        allowedOrigins,
        origin: 'https://school.example',
        contentType: 'application/json',
        cookieHeader: await validCookie(),
        scope: 'all',
        registry: registry({
          revokeAccountSessions: vi.fn(async () => {
            await Promise.resolve();
            throw new Error('database unavailable');
          }),
        }),
      }),
    ).resolves.toMatchObject({ ok: false, status: 503, code: 'session_registry_unavailable' });
  });
});
