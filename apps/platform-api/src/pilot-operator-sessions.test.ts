import { describe, expect, it } from 'vitest';

import {
  issuePilotOperatorSession,
  pilotOperatorSessionHeaders,
  verifyPilotOperatorSession,
} from './pilot-operator-sessions.js';

const secret = 'pilot-operator-session-test-secret-0123456789abcdef';
const baseNow = Date.UTC(2026, 7, 1, 8, 0, 0);

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function decodeBase64UrlText(value: string): string {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

async function signPayload(payload: string): Promise<string> {
  const encoded = encodeBase64Url(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded)),
  );
  return `${encoded}.${encodeBase64Url(signature)}`;
}

async function validClaims() {
  const issued = await issuePilotOperatorSession(secret, 'admissions', baseNow);
  if (!issued.ok) throw new Error('expected session issuance');
  const [payload] = issued.token.split('.');
  if (payload === undefined) throw new Error('expected payload');
  return JSON.parse(decodeBase64UrlText(payload)) as Record<string, unknown>;
}

describe('pilot operator sessions', () => {
  it('fails closed when issuance configuration is missing or too short', async () => {
    await expect(
      issuePilotOperatorSession(undefined, 'admissions', baseNow),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
    });
    await expect(
      issuePilotOperatorSession('too-short', 'admissions', baseNow),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
    });
  });

  it('rejects issuance for an unpublished role', async () => {
    await expect(issuePilotOperatorSession(secret, 'admin', baseNow)).resolves.toMatchObject({
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
    });
  });

  it.each([
    ['admissions', 'admissions-1', 'aal1'],
    ['finance', 'cashier-1', 'aal1'],
    ['support', 'support-operator-1', 'aal2'],
  ] as const)('issues and verifies a scoped %s session', async (role, subjectId, assurance) => {
    const issued = await issuePilotOperatorSession(secret, role, baseNow);
    expect(issued.ok).toBe(true);
    if (!issued.ok) throw new Error('expected session issuance');
    expect(issued.scope).toEqual({
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      role,
      subjectId,
      assurance,
    });
    expect(issued.expiresAt).toBe(new Date((baseNow / 1000 + 15 * 60) * 1000).toISOString());

    const verified = await verifyPilotOperatorSession(
      secret,
      `Bearer ${issued.token}`,
      role,
      baseNow + 1000,
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error('expected valid session');
    expect(verified.claims).toMatchObject({ role, subjectId, assurance });
    expect(verified.claims.sessionId.length).toBeGreaterThanOrEqual(8);
  });

  it('fails closed when verifier configuration is missing or too short', async () => {
    await expect(
      verifyPilotOperatorSession(undefined, 'Bearer token', 'admissions'),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
    });
    await expect(
      verifyPilotOperatorSession('short', 'Bearer token', 'admissions'),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
    });
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer one two'])(
    'requires a correctly formed bearer authorization value: %s',
    async (authorization) => {
      await expect(
        verifyPilotOperatorSession(secret, authorization, 'admissions', baseNow),
      ).resolves.toMatchObject({
        ok: false,
        status: 401,
        code: 'pilot_session_required',
      });
    },
  );

  it.each(['payload', '.signature', 'payload.', 'a.b.c'])(
    'rejects malformed token structure %s',
    async (token) => {
      await expect(
        verifyPilotOperatorSession(secret, `Bearer ${token}`, 'admissions', baseNow),
      ).resolves.toMatchObject({
        ok: false,
        status: 401,
        code: 'pilot_session_invalid',
      });
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
    const replacement = signature.endsWith('A') ? 'B' : 'A';
    const tampered = `${payload}.${signature.slice(0, -1)}${replacement}`;

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
    ['issuedAt', 'not-a-number'],
    ['expiresAt', 'not-a-number'],
    ['sessionId', 'short'],
  ] as const)('rejects signed claims with invalid %s', async (field, value) => {
    const claims = await validClaims();
    claims[field] = value;
    const token = await signPayload(JSON.stringify(claims));
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
    if (!verified.ok) throw new Error('expected verified session');

    expect(Object.fromEntries(pilotOperatorSessionHeaders(verified.claims).entries())).toEqual({
      'x-school-assurance': 'aal2',
      'x-school-campus-id': 'campus-main',
      'x-school-role': 'support',
      'x-school-subject-id': 'support-operator-1',
      'x-school-tenant-id': 'tenant-pilot-001',
    });
  });
});
