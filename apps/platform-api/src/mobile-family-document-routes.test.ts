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

const baseEnvironment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  DATABASE_URL: 'postgresql://test.invalid/school',
  MOBILE_MEMBERSHIP_SOURCE: 'database',
};
const familyHeaders = {
  authorization: 'Bearer test-credential',
  'x-tenant-id': '40000000-0000-4000-8000-000000000002',
  'x-campus-id': '40000000-0000-4000-8000-000000000003',
  'x-persona': 'guardian',
};

beforeEach(() => {
  databaseQuery.mockReset();
  authenticateMobileBearer.mockReset();
  authenticateMobileBearer.mockResolvedValue({
    ok: true,
    identity: {
      issuer: 'https://identity.school.test',
      subject: 'family-user',
      assurance: 'aal1',
      issuedAt: 1,
      expiresAt: 2,
    },
  });
});

describe('mobile Family document routes', () => {
  it('lists authorized document metadata and issues a single-use grant', async () => {
    databaseQuery.mockResolvedValueOnce([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          documents: [
            {
              documentId: '40000000-0000-4000-8000-000000000050',
              title: 'Student report',
              fileName: 'student-report.pdf',
              sizeBytes: 6,
              issuedAt: '2026-08-21T09:00:00.000Z',
              classification: 'restricted',
              cachePolicy: 'noStore',
            },
          ],
          nextCursor: null,
        },
      },
    ]);
    const list = await app.request(
      '/v1/mobile/family/students/40000000-0000-4000-8000-000000000010/documents?limit=25',
      { headers: familyHeaders },
      baseEnvironment,
    );
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      documents: [
        {
          documentId: '40000000-0000-4000-8000-000000000050',
          classification: 'restricted',
          cachePolicy: 'noStore',
        },
      ],
      nextCursor: null,
    });

    databaseQuery.mockResolvedValueOnce([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          documentId: '40000000-0000-4000-8000-000000000050',
          expiresAt: '2026-08-21T09:05:00.000Z',
          grantId: '40000000-0000-4000-8000-000000000051',
          requiresStepUp: true,
          singleUse: true,
        },
      },
    ]);
    const grant = await app.request(
      '/v1/mobile/family/documents/40000000-0000-4000-8000-000000000050/download-grants',
      {
        method: 'POST',
        headers: {
          ...familyHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-document-idempotency-route-0001',
        },
        body: '{}',
      },
      baseEnvironment,
    );
    expect(grant.status).toBe(200);
    await expect(grant.json()).resolves.toEqual({
      documentId: '40000000-0000-4000-8000-000000000050',
      expiresAt: '2026-08-21T15:05:00.000+06:00',
      grantId: '40000000-0000-4000-8000-000000000051',
      requiresStepUp: true,
      singleUse: true,
      timeZoneId: 'Asia/Dhaka',
    });
  });

  it('requires AAL2 before serving a restricted grant and does not touch storage', async () => {
    const bucketGet = vi.fn();
    databaseQuery.mockResolvedValue([{ payload: { status: 'step-up-required' } }]);
    const response = await app.request(
      '/v1/mobile/family/document-download-grants/40000000-0000-4000-8000-000000000051/exchange',
      {
        method: 'POST',
        headers: {
          ...familyHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-document-exchange-route-0001',
        },
        body: '{}',
      },
      { ...baseEnvironment, MOBILE_DOCUMENT_BUCKET: { get: bucketGet } },
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'mobile_document_step_up_required' },
    });
    expect(bucketGet).not.toHaveBeenCalled();
  });

  it('does not claim a grant when secure document storage is not configured', async () => {
    const response = await app.request(
      '/v1/mobile/family/document-download-grants/40000000-0000-4000-8000-000000000051/exchange',
      {
        method: 'POST',
        headers: {
          ...familyHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-document-exchange-route-no-storage',
        },
        body: '{}',
      },
      baseEnvironment,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'mobile_document_storage_unavailable' },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
    expect(authenticateMobileBearer).toHaveBeenCalledOnce();
  });

  it('maps changed grant idempotency reuse to conflict without credential leakage', async () => {
    databaseQuery.mockResolvedValue([{ payload: { status: 'idempotency-conflict' } }]);
    const response = await app.request(
      '/v1/mobile/family/documents/40000000-0000-4000-8000-000000000050/download-grants',
      {
        method: 'POST',
        headers: {
          ...familyHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-document-idempotency-route-conflict',
        },
        body: '{}',
      },
      baseEnvironment,
    );
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toMatchObject({ error: { code: 'mobile_document_idempotency_conflict' } });
    expect(JSON.stringify(payload)).not.toContain('objectKey');
    expect(JSON.stringify(payload)).not.toContain('downloadUrl');
  });

  it('streams a claimed document only when storage size and digest metadata match', async () => {
    authenticateMobileBearer.mockResolvedValue({
      ok: true,
      identity: {
        issuer: 'https://identity.school.test',
        subject: 'family-user',
        assurance: 'aal2',
        issuedAt: 1,
        expiresAt: 2,
      },
    });
    const bytes = new TextEncoder().encode('report');
    const bucketGet = vi.fn().mockResolvedValue({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      size: bytes.length,
      customMetadata: { 'school-sha256': 'a'.repeat(64) },
    });
    databaseQuery.mockResolvedValue([
      {
        timeZoneId: 'Asia/Dhaka',
        payload: {
          status: 'claimed',
          documentId: '40000000-0000-4000-8000-000000000050',
          objectKey: 'tenant/documents/student-report.pdf',
          contentType: 'application/pdf',
          sizeBytes: bytes.length,
          sha256Hex: 'a'.repeat(64),
        },
      },
    ]);
    const response = await app.request(
      '/v1/mobile/family/document-download-grants/40000000-0000-4000-8000-000000000051/exchange',
      {
        method: 'POST',
        headers: {
          ...familyHeaders,
          'content-type': 'application/json',
          'idempotency-key': 'family-document-exchange-route-0002',
        },
        body: '{}',
      },
      { ...baseEnvironment, MOBILE_DOCUMENT_BUCKET: { get: bucketGet } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(response.headers.get('x-document-id')).toBe('40000000-0000-4000-8000-000000000050');
    expect(response.headers.get('x-content-sha256')).toBe('a'.repeat(64));
    await expect(response.text()).resolves.toBe('report');
  });
});
