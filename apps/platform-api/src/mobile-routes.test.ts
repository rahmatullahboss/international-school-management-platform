import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OidcJsonWebKey } from '@school/policy';

const databaseQuery = vi.hoisted(() => vi.fn());
vi.mock('@school/database', () => ({
  createHttpDatabase: () => ({ query: databaseQuery }),
}));

import app from './index.js';

const nowSeconds = Math.floor(Date.now() / 1000);
const readyEnvironment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  DATABASE_URL: 'postgresql://test.invalid/school',
  MOBILE_OIDC_ISSUER: 'https://mobile-identity.school.test',
  MOBILE_OIDC_AUDIENCE: 'school-platform-api',
  MOBILE_OIDC_JWKS_URI: 'https://mobile-identity.school.test/jwks',
  MOBILE_OIDC_JWKS_ORIGIN: 'https://mobile-identity.school.test',
  MOBILE_OIDC_REQUIRED_SCOPE: 'school_api',
  MOBILE_MEMBERSHIP_SOURCE: 'database',
};

let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signedCredential(
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const header = { alg: 'RS256', kid: 'mobile-route-key-1', typ: 'at+jwt' };
  const claims = {
    iss: readyEnvironment.MOBILE_OIDC_ISSUER,
    sub: 'provider-mobile-user-1',
    aud: readyEnvironment.MOBILE_OIDC_AUDIENCE,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    scope: 'openid profile school_api',
    ...overrides,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
  );
  return `${encodedHeader}.${encodedClaims}.${encodeBase64Url(signature)}`;
}

function installJwksFetcher(): ReturnType<typeof vi.fn> {
  const fetcher = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function activeGuardianRow(): Record<string, unknown> {
  return {
    accountId: '40000000-0000-4000-8000-000000000001',
    tenantId: '40000000-0000-4000-8000-000000000002',
    tenantName: 'International School',
    campusId: '40000000-0000-4000-8000-000000000003',
    campusName: 'Main Campus',
    timeZone: 'Asia/Dhaka',
    persona: 'guardian',
    capabilities: [
      'attendance.read',
      'billing.read',
      'documents.read',
      'forms.consent',
      'grades.read.published',
      'messages.read',
      'messages.send',
      'timetable.read',
    ],
  };
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
    kid: 'mobile-route-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

beforeEach(() => {
  databaseQuery.mockReset();
  vi.unstubAllGlobals();
});

describe('platform mobile routes', () => {
  it('reports mobile auth readiness without configuration values', async () => {
    const response = await app.request(
      '/v1/mobile/readiness',
      {},
      {
        APP_ENV: 'test',
        APP_REGION: 'local',
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      schemaVersion: 1,
      mode: 'oidc-bearer',
      state: 'disabled',
      tokenValidationEnabled: false,
      missingConfiguration: [
        'issuer',
        'audience',
        'jwks-uri',
        'jwks-origin',
        'required-scope',
        'membership-source',
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('mobile-identity.school.test');
  });

  it('fails closed when mobile provider configuration or bearer credential is absent', async () => {
    const missingConfiguration = await app.request(
      '/v1/mobile/bootstrap',
      {},
      {
        APP_ENV: 'test',
        APP_REGION: 'local',
        DATABASE_URL: readyEnvironment.DATABASE_URL,
        MOBILE_MEMBERSHIP_SOURCE: 'database',
      },
    );
    expect(missingConfiguration.status).toBe(503);
    await expect(missingConfiguration.json()).resolves.toMatchObject({
      error: { code: 'mobile_auth_configuration_unavailable' },
    });

    const fetcher = installJwksFetcher();
    const missingCredential = await app.request('/v1/mobile/bootstrap', {}, readyEnvironment);
    expect(missingCredential.status).toBe(401);
    await expect(missingCredential.json()).resolves.toMatchObject({
      error: { code: 'mobile_bearer_required' },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('returns tenant-safe campus-specific mobile access for a valid credential', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([activeGuardianRow()]);
    const credential = await signedCredential();
    const response = await app.request(
      '/v1/mobile/bootstrap',
      { headers: { authorization: `Bearer ${credential}` } },
      readyEnvironment,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      accountId: '40000000-0000-4000-8000-000000000001',
      locale: 'en',
      schools: [
        {
          tenantId: '40000000-0000-4000-8000-000000000002',
          tenantName: 'International School',
          campuses: [
            {
              campusId: '40000000-0000-4000-8000-000000000003',
              campusName: 'Main Campus',
              timeZone: 'Asia/Dhaka',
              personas: [
                {
                  persona: 'guardian',
                  capabilities: activeGuardianRow().capabilities,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(databaseQuery).toHaveBeenCalledWith(
      expect.stringContaining('resolve_mobile_bootstrap_access'),
      [readyEnvironment.MOBILE_OIDC_ISSUER, 'provider-mobile-user-1'],
    );
  });

  it('returns 403 for a verified account with no active mobile access', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([]);
    const response = await app.request(
      '/v1/mobile/bootstrap',
      { headers: { authorization: `Bearer ${await signedCredential()}` } },
      readyEnvironment,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'mobile_access_unavailable' },
    });
  });

  it('redacts database failures behind a temporary-unavailable response', async () => {
    installJwksFetcher();
    databaseQuery.mockRejectedValue(new Error('database host password=do-not-expose'));
    const response = await app.request(
      '/v1/mobile/bootstrap',
      { headers: { authorization: `Bearer ${await signedCredential()}` } },
      readyEnvironment,
    );

    expect(response.status).toBe(503);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      error: { code: 'mobile_access_temporarily_unavailable' },
    });
    expect(JSON.stringify(payload)).not.toContain('do-not-expose');
  });

  it('returns authorized Family profiles only for an explicit family scope', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          accountId: '40000000-0000-4000-8000-000000000001',
          activeStudentId: '40000000-0000-4000-8000-000000000010',
          students: [
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              campusId: '40000000-0000-4000-8000-000000000003',
              displayName: 'Student Tester',
              gradeLabel: 'Current grade',
              relationshipLabel: 'Guardian',
            },
          ],
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/family/profiles',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'guardian',
        },
      },
      readyEnvironment,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      activeStudentId: '40000000-0000-4000-8000-000000000010',
      students: [{ displayName: 'Student Tester' }],
    });
    expect(databaseQuery).toHaveBeenCalledWith(
      expect.stringContaining('resolve_mobile_family_profiles'),
      [
        readyEnvironment.MOBILE_OIDC_ISSUER,
        'provider-mobile-user-1',
        '40000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000003',
        'guardian',
      ],
    );
  });

  it('rejects missing scope and wrong persona before database access', async () => {
    const missingScope = await app.request(
      '/v1/mobile/family/profiles',
      { headers: { authorization: `Bearer ${await signedCredential()}` } },
      readyEnvironment,
    );
    expect(missingScope.status).toBe(400);
    await expect(missingScope.json()).resolves.toMatchObject({
      error: { code: 'mobile_scope_required' },
    });

    const wrongPersona = await app.request(
      '/v1/mobile/family/profiles',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
      },
      readyEnvironment,
    );
    expect(wrongPersona.status).toBe(403);
    await expect(wrongPersona.json()).resolves.toMatchObject({
      error: { code: 'mobile_persona_denied' },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('returns Teacher Today and validates database response shape', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          campusId: '40000000-0000-4000-8000-000000000003',
          generatedAt: '2026-08-19T13:00:00.000Z',
          teacherDisplayName: 'Teacher Tester',
          meetings: [
            {
              meetingId: '40000000-0000-4000-8000-000000000020',
              sectionId: '40000000-0000-4000-8000-000000000021',
              sectionLabel: 'Grade 5A',
              subjectLabel: 'Mathematics',
              roomLabel: 'Room 204',
              startsAt: '2026-08-19T03:00:00.000Z',
              endsAt: '2026-08-19T04:00:00.000Z',
              rosterCount: 30,
              attendanceStatus: 'draft',
            },
          ],
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/teacher/today',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
      },
      readyEnvironment,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      teacherDisplayName: 'Teacher Tester',
      meetings: [{ attendanceStatus: 'draft', rosterCount: 30 }],
    });
  });

  it('fails closed when a mobile read model is malformed and does not leak database errors', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([{ payload: { accountId: 'not-a-uuid' } }]);
    const malformed = await app.request(
      '/v1/mobile/family/profiles',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'guardian',
        },
      },
      readyEnvironment,
    );
    expect(malformed.status).toBe(503);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: 'mobile_read_temporarily_unavailable' },
    });

    databaseQuery.mockReset();
    databaseQuery.mockRejectedValue(new Error('secret database detail password=do-not-leak'));
    const failed = await app.request(
      '/v1/mobile/teacher/today',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
      },
      readyEnvironment,
    );
    expect(failed.status).toBe(503);
    const payload: unknown = await failed.json();
    expect(payload).toMatchObject({ error: { code: 'mobile_read_temporarily_unavailable' } });
    expect(JSON.stringify(payload)).not.toContain('do-not-leak');
  });

  it('rejects malformed teacher meeting identifiers before database access', async () => {
    const response = await app.request(
      '/v1/mobile/teacher/meetings/not-a-uuid/roster',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
      },
      readyEnvironment,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'mobile_meeting_invalid' },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('returns an authorized Family dashboard with exact bounded read fields', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          student: {
            studentId: '40000000-0000-4000-8000-000000000010',
            campusId: '40000000-0000-4000-8000-000000000003',
            displayName: 'Student Tester',
            gradeLabel: 'Current grade',
            relationshipLabel: 'Guardian',
          },
          timetable: [
            {
              itemId: '40000000-0000-4000-8000-000000000030',
              subjectLabel: 'Mathematics',
              locationLabel: 'Room 204',
              startsAt: '2026-08-19T03:00:00.000Z',
              endsAt: '2026-08-19T04:00:00.000Z',
            },
          ],
          attendance: {
            presentSessions: 10,
            absentSessions: 1,
            lateSessions: 2,
            totalSessions: 13,
            summaryLabel: 'Finalized attendance',
          },
          publishedResults: [
            {
              resultId: '40000000-0000-4000-8000-000000000031',
              assessmentLabel: 'Grade 5A',
              subjectLabel: 'Mathematics',
              gradeLabel: 'A',
              publishedAt: '2026-08-18T12:00:00.000Z',
            },
          ],
          fees: null,
          messages: null,
          generatedAt: '2026-08-19T13:00:00.000Z',
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/family/students/40000000-0000-4000-8000-000000000010/dashboard',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'guardian',
        },
      },
      readyEnvironment,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      student: { displayName: 'Student Tester' },
      attendance: { totalSessions: 13 },
      publishedResults: [{ gradeLabel: 'A' }],
      fees: null,
      messages: null,
    });
  });

  it('returns an assigned Teacher roster and keeps roster version exact', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          meetingId: '40000000-0000-4000-8000-000000000020',
          sectionId: '40000000-0000-4000-8000-000000000021',
          version: 7,
          students: [
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              displayName: 'Student Tester',
              rollLabel: 'ST-001',
            },
          ],
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/teacher/meetings/40000000-0000-4000-8000-000000000020/roster',
      {
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
      },
      readyEnvironment,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      meetingId: '40000000-0000-4000-8000-000000000020',
      sectionId: '40000000-0000-4000-8000-000000000021',
      version: 7,
      students: [
        {
          studentId: '40000000-0000-4000-8000-000000000010',
          displayName: 'Student Tester',
          rollLabel: 'ST-001',
        },
      ],
    });
  });

  it('accepts scoped Teacher attendance and grade-draft writes without client finalization authority', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          operationId: 'attendance-operation-route-0001',
          acceptedRevision: 8,
          status: 'accepted',
        },
      },
    ]);
    const attendance = await app.request(
      '/v1/mobile/teacher/attendance-batches',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'attendance-idempotency-route-0001',
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
        body: JSON.stringify({
          operationId: 'attendance-operation-route-0001',
          meetingId: '40000000-0000-4000-8000-000000000020',
          baseVersion: 7,
          clientCreatedAt: '2026-08-21T09:00:00.000Z',
          lines: [
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              mark: 'present',
            },
          ],
        }),
      },
      readyEnvironment,
    );
    expect(attendance.status).toBe(200);
    await expect(attendance.json()).resolves.toEqual({
      operationId: 'attendance-operation-route-0001',
      acceptedRevision: 8,
      status: 'accepted',
    });
    expect(databaseQuery).toHaveBeenCalledWith(
      expect.stringContaining('submit_mobile_teacher_attendance'),
      expect.any(Array),
    );

    databaseQuery.mockReset();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          operationId: 'grade-operation-route-0001',
          acceptedRevision: 5,
          status: 'duplicate',
        },
      },
    ]);
    const gradeDraft = await app.request(
      '/v1/mobile/teacher/assessments/40000000-0000-4000-8000-000000000040/grade-drafts',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'grade-idempotency-route-0001',
          'x-tenant-id': '40000000-0000-4000-8000-000000000002',
          'x-campus-id': '40000000-0000-4000-8000-000000000003',
          'x-persona': 'teacher',
        },
        body: JSON.stringify({
          operationId: 'grade-operation-route-0001',
          baseVersion: 4,
          scoreScale: 100,
          maximumScoreUnits: 10000,
          entries: [
            {
              studentId: '40000000-0000-4000-8000-000000000010',
              status: 'scored',
              scoreUnits: 8750,
            },
          ],
        }),
      },
      readyEnvironment,
    );
    expect(gradeDraft.status).toBe(200);
    await expect(gradeDraft.json()).resolves.toEqual({
      operationId: 'grade-operation-route-0001',
      acceptedRevision: 5,
      status: 'duplicate',
    });
    expect(databaseQuery).toHaveBeenCalledWith(
      expect.stringContaining('save_mobile_teacher_grade_draft'),
      expect.any(Array),
    );
  });

  it('registers an account-scoped Android FCM device session without echoing the token', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          deviceSessionId: '40000000-0000-4000-8000-000000000040',
          installationId: 'installation_000001',
          registeredAt: '2026-08-19T14:00:00.000Z',
          revision: 1,
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/device-sessions',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'device-register-0001',
        },
        body: JSON.stringify({
          installationId: 'installation_000001',
          application: 'family',
          platform: 'android',
          appVersion: '0.1.0+2',
          pushProvider: 'firebase',
          notificationEnvironment: 'development',
          pushToken: 'firebase-token-secret-value',
        }),
      },
      readyEnvironment,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload: unknown = await response.json();
    expect(payload).toEqual({
      deviceSessionId: '40000000-0000-4000-8000-000000000040',
      installationId: 'installation_000001',
      registeredAt: '2026-08-19T14:00:00.000Z',
      revision: 1,
    });
    expect(JSON.stringify(payload)).not.toContain('firebase-token-secret-value');
    expect(databaseQuery).toHaveBeenCalledWith(
      expect.stringContaining('register_mobile_device_session'),
      expect.arrayContaining([
        readyEnvironment.MOBILE_OIDC_ISSUER,
        'provider-mobile-user-1',
        'device-register-0001',
        'installation_000001',
        'family',
        'android',
        'firebase',
        'development',
        'firebase-token-secret-value',
      ]),
    );
  });

  it('rejects invalid provider/platform pairing before database access', async () => {
    installJwksFetcher();
    const response = await app.request(
      '/v1/mobile/device-sessions',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'device-register-0002',
        },
        body: JSON.stringify({
          installationId: 'installation_000001',
          application: 'family',
          platform: 'android',
          appVersion: '0.1.0+2',
          pushProvider: 'apns',
          notificationEnvironment: 'development',
          pushToken: 'provider-token',
        }),
      },
      readyEnvironment,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'mobile_device_session_invalid' },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('maps device registration idempotency conflicts to a stable 409 without leaking database detail', async () => {
    installJwksFetcher();
    databaseQuery.mockRejectedValue(
      new Error('MOBILE_DEVICE_SESSION_IDEMPOTENCY_CONFLICT token=do-not-leak'),
    );
    const response = await app.request(
      '/v1/mobile/device-sessions',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'device-register-0003',
        },
        body: JSON.stringify({
          installationId: 'installation_000001',
          application: 'family',
          platform: 'android',
          appVersion: '0.1.0+2',
          pushProvider: 'firebase',
          notificationEnvironment: 'development',
          pushToken: 'firebase-token-value',
        }),
      },
      readyEnvironment,
    );
    expect(response.status).toBe(409);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      error: { code: 'mobile_device_session_idempotency_conflict' },
    });
    expect(JSON.stringify(payload)).not.toContain('do-not-leak');
  });

  it('revokes only an authenticated account-owned device session', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          deviceSessionId: '40000000-0000-4000-8000-000000000040',
          revokedAt: '2026-08-19T14:10:00.000Z',
          revision: 2,
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/device-sessions/40000000-0000-4000-8000-000000000040/revoke',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'device-revoke-00001',
        },
        body: '{}',
      },
      readyEnvironment,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deviceSessionId: '40000000-0000-4000-8000-000000000040',
      revokedAt: '2026-08-19T14:10:00.000Z',
      revision: 2,
    });
  });

  it('fails closed if a device registration database response contains provider credentials', async () => {
    installJwksFetcher();
    databaseQuery.mockResolvedValue([
      {
        payload: {
          deviceSessionId: '40000000-0000-4000-8000-000000000040',
          installationId: 'installation_000001',
          registeredAt: '2026-08-19T14:00:00.000Z',
          revision: 1,
          pushToken: 'must-never-leave-database-boundary',
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/device-sessions',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await signedCredential()}`,
          'content-type': 'application/json',
          'idempotency-key': 'device-register-0004',
        },
        body: JSON.stringify({
          installationId: 'installation_000001',
          application: 'family',
          platform: 'android',
          appVersion: '0.1.0+2',
          pushProvider: 'firebase',
          notificationEnvironment: 'development',
          pushToken: 'firebase-token-value',
        }),
      },
      readyEnvironment,
    );
    expect(response.status).toBe(503);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      error: { code: 'mobile_device_session_temporarily_unavailable' },
    });
    expect(JSON.stringify(payload)).not.toContain('must-never-leave-database-boundary');
  });
});
