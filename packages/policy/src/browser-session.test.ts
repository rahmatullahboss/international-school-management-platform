import { describe, expect, it } from 'vitest';

import {
  BROWSER_SESSION_COOKIE_NAME,
  clearBrowserSessionCookie,
  issueBrowserSession,
  verifyBrowserSession,
} from './browser-session.js';

const secret = 'browser-session-test-secret-with-at-least-32-characters';
const now = Date.parse('2026-07-30T05:00:00Z');
const identity = {
  issuer: 'https://identity.school.test',
  subject: 'provider-user-123',
  providerSessionId: 'provider-session-abc',
  assurance: 'aal2' as const,
  authenticationTime: Math.floor(now / 1000) - 30,
  issuedAt: Math.floor(now / 1000),
  expiresAt: Math.floor(now / 1000) + 600,
};
const membership = {
  membershipId: 'membership-main-admin',
  principalId: 'principal-1',
  tenantId: 'tenant-pilot-001',
  campusId: 'campus-main',
  roleIds: ['school-admin'],
};

describe('browser session contract', () => {
  it('issues a short-lived signed __Host cookie without profile data', async () => {
    const result = await issueBrowserSession({
      identity,
      membership,
      secret,
      now,
      ttlSeconds: 900,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.setCookie).toContain(`${BROWSER_SESSION_COOKIE_NAME}=`);
    expect(result.setCookie).toContain('Path=/');
    expect(result.setCookie).toContain('HttpOnly');
    expect(result.setCookie).toContain('Secure');
    expect(result.setCookie).toContain('SameSite=Lax');
    expect(result.setCookie).toContain('Max-Age=900');
    expect(result.setCookie).not.toContain('principal@school.test');
    expect(result.claims).toMatchObject({
      principalId: 'principal-1',
      providerSessionId: 'provider-session-abc',
      membershipId: 'membership-main-admin',
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      roleIds: ['school-admin'],
      assurance: 'aal2',
      issuedAt: Math.floor(now / 1000),
      expiresAt: Math.floor(now / 1000) + 900,
    });
  });

  it('verifies the session from a Cookie header and ignores unrelated cookies', async () => {
    const issued = await issueBrowserSession({ identity, membership, secret, now });
    if (!issued.ok) throw new Error(issued.message);
    const result = await verifyBrowserSession(
      secret,
      `analytics=off; ${BROWSER_SESSION_COOKIE_NAME}=${issued.token}; preference=compact`,
      now + 1_000,
    );
    expect(result).toMatchObject({
      ok: true,
      claims: {
        principalId: 'principal-1',
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
      },
    });
  });

  it('denies tampering, wrong secrets and expiry', async () => {
    const issued = await issueBrowserSession({
      identity,
      membership,
      secret,
      now,
      ttlSeconds: 60,
    });
    if (!issued.ok) throw new Error(issued.message);

    const tampered = await verifyBrowserSession(
      secret,
      `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}x`,
      now,
    );
    expect(tampered).toMatchObject({ ok: false, code: 'browser_session_invalid' });

    const wrongSecret = await verifyBrowserSession(
      'another-browser-session-secret-with-at-least-32-characters',
      `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}`,
      now,
    );
    expect(wrongSecret).toMatchObject({ ok: false, code: 'browser_session_invalid' });

    const expired = await verifyBrowserSession(
      secret,
      `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}`,
      now + 60_000,
    );
    expect(expired).toMatchObject({ ok: false, code: 'browser_session_expired' });
  });

  it('fails closed for missing cookies, weak secrets and invalid lifetimes', async () => {
    expect(await verifyBrowserSession(secret, undefined, now)).toMatchObject({
      ok: false,
      code: 'browser_session_required',
    });
    expect(
      await verifyBrowserSession('weak', `${BROWSER_SESSION_COOKIE_NAME}=value`, now),
    ).toMatchObject({
      ok: false,
      code: 'browser_session_configuration_invalid',
    });
    expect(
      await issueBrowserSession({ identity, membership, secret, now, ttlSeconds: 59 }),
    ).toMatchObject({ ok: false, code: 'browser_session_input_invalid' });
    expect(
      await issueBrowserSession({ identity, membership, secret, now, ttlSeconds: 8 * 60 * 60 + 1 }),
    ).toMatchObject({ ok: false, code: 'browser_session_input_invalid' });
  });

  it('creates an explicit secure deletion cookie', () => {
    expect(clearBrowserSessionCookie()).toBe(
      `${BROWSER_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    );
  });
});
