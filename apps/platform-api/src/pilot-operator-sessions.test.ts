import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  issuePilotOperatorSession,
  pilotOperatorSessionHeaders,
  verifyPilotOperatorSession,
} from './pilot-operator-sessions.js';

const secret = 'operator-session-coverage-secret-0123456789abcdef';
const baseNow = Date.parse('2026-08-01T00:00:00.000Z');
const baseNowSeconds = Math.floor(baseNow / 1000);

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function signPayload(payload: string): string {
  const encodedPayload = encode(payload);
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    issuer: 'international-school-platform-staging',
    audience: 'international-school-platform-api',
    role: 'admissions',
    tenantId: 'tenant-pilot-001',
    campusId: 'campus-main',
    subjectId: 'admissions-1',
    assurance: 'aal1',
    issuedAt: baseNowSeconds,
    expiresAt: baseNowSeconds + 15 * 60,
    sessionId: 'pilot-admissions-0123456789abcdef',
    ...overrides,
  };
}

describe('pilot operator sessions', () => {
  it('fails closed when issuance configuration is missing or too short', async () => {
    await expect(issuePilotOperatorSession(undefined, 'admissions', baseNow)).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
      message: 'The staging session issuer is not configured.',
    });
    await expect(issuePilotOperatorSession('short', 'admissions', baseNow)).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
      message: 'The staging session issuer is not configured.',
    });
  });

  it('rejects issuance for an unpublished role', async () => {
    await expect(issuePilotOperatorSession(secret, 'admin', baseNow)).resolves.toEqual({
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
      message: 'The requested pilot role is not available.',
    });
  });

  it.each(['admissions', 'finance', 'support'] as const)(
    'issues and verifies a scoped %s session',
    async (role) => {
      const issued = await issuePilotOperatorSession(secret, role, baseNow);
      expect(issued.ok).toBe(true);
      if (!issued.ok) throw new Error('expected session issuance');
      expect(issued.scope).toMatchObject({ role });
      expect(issued.expiresAt).toBe(new Date((baseNowSeconds + 15 * 60) * 1000).toISOString());

      const verified = await verifyPilotOperatorSession(
        secret,
        `Bearer ${issued.token}`,
        role,
        baseNow + 1000,
      );
      expect(verified.ok).toBe(true);
      if (!verified.ok) throw new Error('expected verified operator session');
      expect(verified.claims.role).toBe(role);
      expect(verified.claims.tenantId).toBe('tenant-pilot-001');
      expect(verified.claims.campusId).toBe('campus-main');
    },
  );

  it('accepts a manually signed claim set that matches the production contract', async () => {
    const token = signPayload(JSON.stringify(validClaims()));
    const verified = await verifyPilotOperatorSession(secret, `Bearer ${token}`, 'admissions', baseNow);
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error('expected manually signed claims to verify');
    expect(verified.claims).toMatchObject({
      role: 'admissions',
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      subjectId: 'admissions-1',
      assurance: 'aal1',
    });
  });

  it('fails closed when verifier configuration is missing or too short', async () => {
    await expect(
      verifyPilotOperatorSession(undefined, 'Bearer token', 'admissions', baseNow),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
      message: 'The staging session verifier is not configured.',
    });
    await expect(
      verifyPilotOperatorSession('short', 'Bearer token', 'admissions', baseNow),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
      message: 'The staging session verifier is not configured.',
    });
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer one two'])(
    'requires a correctly formed bearer authorization value: %s',
    async (authorization) => {
      await expect(
        verifyPilotOperatorSession(secret, authorization, 'admissions', baseNow),
      ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_required' });
    },
  );

  it.each(['payload', '.signature', 'payload.', 'a.b.c'])(
    'rejects malformed token structure %s',
    async (token) => {
      await expect(
        verifyPilotOperatorSession(secret, `Bearer ${token}`, 'admissions', baseNow),
      ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });
    },
  );

  it('rejects cross-role replay, expiry and future-issued sessions', async () => {
    const issued = await issuePilotOperatorSession(secret, 'admissions', baseNow);
    if (!issued.ok) throw new Error('expected session issuance');

    await expect(
      verifyPilotOperatorSession(secret, `Bearer ${issued.token}`, 'finance', baseNow + 1000),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });

    await expect(
      verifyPilotOperatorSession(
        secret,
        `Bearer ${issued.token}`,
        'admissions',
        baseNow + 15 * 60 * 1000,
      ),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });

    const future = await issuePilotOperatorSession(secret, 'admissions', baseNow + 2 * 60 * 1000);
    if (!future.ok) throw new Error('expected future session issuance');
    await expect(
      verifyPilotOperatorSession(secret, `Bearer ${future.token}`, 'admissions', baseNow),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });
  });

  it('rejects a tampered signature and signed invalid JSON', async () => {
    const issued = await issuePilotOperatorSession(secret, 'admissions', baseNow);
    if (!issued.ok) throw new Error('expected session issuance');
    const [payload, signature] = issued.token.split('.');
    if (payload === undefined || signature === undefined) throw new Error('expected token parts');
    const replacement = signature.startsWith('A') ? 'B' : 'A';
    const tampered = `${payload}.${replacement}${signature.slice(1)}`;

    await expect(
      verifyPilotOperatorSession(secret, `Bearer ${tampered}`, 'admissions', baseNow),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });

    const invalidJson = signPayload('{not-json');
    await expect(
      verifyPilotOperatorSession(secret, `Bearer ${invalidJson}`, 'admissions', baseNow),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });
  });

  it.each([
    ['role', 'admin'],
    ['version', 2],
    ['issuer', 'different-issuer'],
    ['audience', 'different-audience'],
    ['tenantId', 'tenant-other'],
    ['campusId', 'campus-other'],
    ['subjectId', 'different-subject'],
    ['assurance', 'aal2'],
    ['issuedAt', 'not-a-number'],
    ['expiresAt', 'not-a-number'],
    ['sessionId', 'short'],
  ])('rejects signed claims with invalid %s', async (field, value) => {
    const token = signPayload(JSON.stringify(validClaims({ [field]: value })));
    await expect(
      verifyPilotOperatorSession(secret, `Bearer ${token}`, 'admissions', baseNow + 1000),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });
  });

  it('maps verified claims into exact trusted session headers', async () => {
    const issued = await issuePilotOperatorSession(secret, 'support', baseNow);
    if (!issued.ok) throw new Error('expected session issuance');
    const verified = await verifyPilotOperatorSession(
      secret,
      `Bearer ${issued.token}`,
      'support',
      baseNow + 1000,
    );
    if (!verified.ok) throw new Error('expected verified support session');

    expect(Object.fromEntries(pilotOperatorSessionHeaders(verified.claims))).toEqual({
      'x-school-assurance': 'aal2',
      'x-school-campus-id': 'campus-main',
      'x-school-role': 'support',
      'x-school-subject-id': 'support-operator-1',
      'x-school-tenant-id': 'tenant-pilot-001',
    });
  });
});
