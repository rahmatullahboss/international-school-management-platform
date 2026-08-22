import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseQuery = vi.hoisted(() => vi.fn());
const authenticateMobileBearer = vi.hoisted(() => vi.fn());

vi.mock('@school/database', () => ({
  createHttpDatabase: () => ({ query: databaseQuery }),
}));
vi.mock('./mobile-auth.js', () => ({
  authenticateMobileBearer,
  resolveMobileAuthReadiness: vi.fn(() => ({
    schemaVersion: 1,
    mode: 'oidc-bearer',
    state: 'ready',
    tokenValidationEnabled: true,
    controls: {
      rs256Only: true,
      issuerValidation: true,
      audienceValidation: true,
      exactScopeValidation: true,
      boundedJwks: true,
      jwksOriginPin: true,
      redirectDenied: true,
      boundedJwksCache: true,
      unknownKidSingleRefresh: true,
      databaseMembershipProjection: true,
    },
    missingConfiguration: [],
  })),
}));

import app from './index.js';

const environment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  DATABASE_URL: 'postgresql://test.invalid/school',
  MOBILE_MEMBERSHIP_SOURCE: 'database',
};
const guardianHeaders = {
  authorization: 'Bearer test-credential',
  'x-tenant-id': '40000000-0000-4000-8000-000000000002',
  'x-campus-id': '40000000-0000-4000-8000-000000000003',
  'x-persona': 'guardian',
};
const studentId = '40000000-0000-4000-8000-000000000010';
const formId = '40000000-0000-4000-8000-000000000020';
const consentId = '40000000-0000-4000-8000-000000000030';

beforeEach(() => {
  databaseQuery.mockReset();
  authenticateMobileBearer.mockReset();
  authenticateMobileBearer.mockResolvedValue({
    ok: true,
    identity: {
      issuer: 'https://identity.school.test',
      subject: 'guardian-user',
      assurance: 'aal1',
      issuedAt: 1,
      expiresAt: 2,
    },
  });
});

describe('mobile Family forms and consents routes', () => {
  it('lists and loads authorized form contracts', async () => {
    databaseQuery.mockResolvedValueOnce([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          forms: [{ formId, title: 'Emergency update', status: 'open', dueAt: null }],
        },
      },
    ]);
    const list = await app.request(
      `/v1/mobile/family/students/${studentId}/forms`,
      { headers: guardianHeaders },
      environment,
    );
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    await expect(list.json()).resolves.toEqual({
      forms: [{ formId, title: 'Emergency update', status: 'open', dueAt: null }],
      timeZoneId: 'Asia/Dhaka',
    });

    databaseQuery.mockResolvedValueOnce([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          formId,
          title: 'Emergency update',
          status: 'open',
          dueAt: null,
          baseVersion: 3,
          schemaVersion: 1,
          fields: [
            {
              fieldId: 'contact_name',
              label: 'Contact name',
              type: 'text',
              required: true,
              options: [],
            },
          ],
        },
      },
    ]);
    const load = await app.request(
      `/v1/mobile/family/forms/${formId}`,
      { headers: guardianHeaders },
      environment,
    );
    expect(load.status).toBe(200);
    await expect(load.json()).resolves.toMatchObject({ formId, baseVersion: 3, schemaVersion: 1 });
  });

  it('submits a form and maps stale conflicts without exposing internals', async () => {
    databaseQuery.mockResolvedValueOnce([{ payload: { acceptedRevision: 4 } }]);
    const accepted = await app.request(
      `/v1/mobile/family/forms/${formId}/submit`,
      {
        method: 'POST',
        headers: {
          ...guardianHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-form-route-idempotency-0001',
        },
        body: JSON.stringify({
          studentId,
          schemaVersion: 1,
          baseVersion: 3,
          answers: { contact_name: 'Guardian' },
        }),
      },
      environment,
    );
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toEqual({ acceptedRevision: 4 });

    databaseQuery.mockResolvedValueOnce([{ payload: { status: 'stale' } }]);
    const stale = await app.request(
      `/v1/mobile/family/forms/${formId}/submit`,
      {
        method: 'POST',
        headers: {
          ...guardianHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-form-route-idempotency-0002',
        },
        body: JSON.stringify({ studentId, schemaVersion: 1, baseVersion: 3, answers: {} }),
      },
      environment,
    );
    expect(stale.status).toBe(409);
    const payload = await stale.json();
    expect(payload).toMatchObject({ error: { code: 'mobile_family_form_stale' } });
    expect(JSON.stringify(payload)).not.toContain('requestDigest');
  });

  it('lists consents and records an authorized guardian decision', async () => {
    databaseQuery.mockResolvedValueOnce([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          consents: [
            {
              consentId,
              studentId,
              title: 'Trip consent',
              policyVersion: 'trip-policy-2026.2',
              status: 'pending',
              dueAt: null,
            },
          ],
        },
      },
    ]);
    const list = await app.request(
      `/v1/mobile/family/students/${studentId}/consents`,
      { headers: guardianHeaders },
      environment,
    );
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      consents: [{ consentId, status: 'pending' }],
    });

    databaseQuery.mockResolvedValueOnce([{ payload: { acceptedRevision: 2 } }]);
    const decision = await app.request(
      `/v1/mobile/family/consents/${consentId}/decisions`,
      {
        method: 'POST',
        headers: {
          ...guardianHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-consent-route-idempotency-0001',
        },
        body: JSON.stringify({
          studentId,
          policyVersion: 'trip-policy-2026.2',
          decision: 'grant',
        }),
      },
      environment,
    );
    expect(decision.status).toBe(200);
    await expect(decision.json()).resolves.toEqual({ acceptedRevision: 2 });
  });

  it('rejects student persona and malformed answers before database mutation', async () => {
    const studentPersona = await app.request(
      `/v1/mobile/family/students/${studentId}/forms`,
      { headers: { ...guardianHeaders, 'x-persona': 'student' } },
      environment,
    );
    expect(studentPersona.status).toBe(403);

    const invalid = await app.request(
      `/v1/mobile/family/forms/${formId}/submit`,
      {
        method: 'POST',
        headers: {
          ...guardianHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-form-route-idempotency-0003',
        },
        body: JSON.stringify({
          studentId,
          schemaVersion: 1,
          baseVersion: 3,
          answers: { unsupported: 42 },
        }),
      },
      environment,
    );
    expect(invalid.status).toBe(400);
    expect(databaseQuery).not.toHaveBeenCalled();
  });
});
