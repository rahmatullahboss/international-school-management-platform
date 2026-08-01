import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  issuePilotOperatorSession,
  operatorSnapshotHeaders,
  verifyPilotOperatorSession,
} from './pilot-operator-sessions.js';

const secret = 'operator-session-coverage-secret-0123456789abcdef';
const baseNow = Date.parse('2026-08-01T00:00:00.000Z');

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

async function signPayload(payload: string): Promise<string> {
  const encodedPayload = encode(payload);
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    issuer: 'school-platform-pilot',
    audience: 'school-platform-pilot-web',
    role: 'admissions',
    tenantId: 'tenant-alpha',
    campusId: 'campus-main',
    subjectId: 'admissions-pilot',
    assurance: 'aal1',
    issuedAt: new Date(baseNow).toISOString(),
    expiresAt: new Date(baseNow + 10 * 60 * 1000).toISOString(),
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
    });
    await expect(issuePilotOperatorSession('short', 'admissions', baseNow)).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
    });
  });

  it('rejects issuance for an unpublished role', async () => {
    await expect(issuePilotOperatorSession(secret, 'admin' as 'admissions', baseNow)).resolves.toEqual({
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
    });
  });

  it.each(['admissions', 'finance', 'support'] as const)(
    'issues and verifies a scoped %s session',
    async (role) => {
      const issued = await issuePilotOperatorSession(secret, role, baseNow);
      expect(issued.ok).toBe(true);
      if (!issued.ok) throw new Error('expected session issuance');
      expect(issued.claims).toMatchObject({ role, assurance: 'aal1' });
      expect(issued.expiresAt).toBe(new Date(baseNow + 10 * 60 * 1000).toISOString());

      const verified = await verifyPilotOperatorSession(
        secret,
        `Bearer ${issued.token}`,
        role,
        baseNow + 1000,
      );
      expect(verified.ok).toBe(true);
      if (!verified.ok) throw new Error('expected verified operator session');
      expect(verified.claims).toEqual(issued.claims);
    },
  );

  it('fails closed when verifier configuration is missing or too short', async () => {
    await expect(
      verifyPilotOperatorSession(undefined, 'Bearer token', 'admissions', baseNow),
    ).resolves.toEqual({ ok: false, status: 503, code: 'pilot_session_unavailable' });
    await expect(
      verifyPilotOperatorSession('short', 'Bearer token', 'admissions', baseNow),
    ).resolves.toEqual({ ok: false, status: 503, code: 'pilot_session_unavailable' });
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

    const invalidJson = await signPayload('{not-json');
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
    ['issuedAt', 'not-a-date'],
    ['expiresAt', 'not-a-date'],
    ['sessionId', 'short'],
  ])('rejects signed claims with invalid %s', async (field, value) => {
    const token = await signPayload(JSON.stringify(validClaims({ [field]: value })));
    await expect(
      verifyPilotOperatorSession(secret, `Bearer ${token}`, 'admissions', baseNow + 1000),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'pilot_session_invalid' });
  });

  it('maps verified claims into exact trusted snapshot headers', async () => {
    const issued = await issuePilotOperatorSession(secret, 'support', baseNow);
    if (!issued.ok) throw new Error('expected session issuance');
    const verified = await verifyPilotOperatorSession(
      secret,
      `Bearer ${issued.token}`,
      'support',
      baseNow + 1000,
    );
    if (!verified.ok) throw new Error('expected verified support session');

    const headers = operatorSnapshotHeaders(verified.claims);
    expect(headers).toEqual({
      'x-pilot-role': 'support',
      'x-pilot-tenant-id': verified.claims.tenantId,
      'x-pilot-campus-id': verified.claims.campusId,
      'x-pilot-subject-id': verified.claims.subjectId,
      'x-pilot-assurance': verified.claims.assurance,
    });
  });
});
