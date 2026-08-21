import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileFamilyDocumentStore } from './database-mobile-family-document-store.js';

const identity = {
  issuer: 'https://identity.school.test',
  subject: 'family-user',
  assurance: 'aal1' as const,
};
const scope = {
  tenantId: '40000000-0000-4000-8000-000000000002',
  campusId: '40000000-0000-4000-8000-000000000003',
  persona: 'guardian' as const,
};

describe('database mobile family document store', () => {
  it('validates an exact authorized document page', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          documents: [
            {
              documentId: '40000000-0000-4000-8000-000000000010',
              title: 'Student report',
              fileName: 'student-report.pdf',
              sizeBytes: 1024,
              issuedAt: '2026-08-21T09:00:00.000Z',
              classification: 'restricted',
              cachePolicy: 'noStore',
            },
          ],
          nextCursor: null,
        },
      },
    ]);
    const store = new DatabaseMobileFamilyDocumentStore({ query });

    await expect(
      store.listDocuments(identity, scope, '40000000-0000-4000-8000-000000000011', undefined, 25),
    ).resolves.toEqual({
      documents: [
        {
          documentId: '40000000-0000-4000-8000-000000000010',
          title: 'Student report',
          fileName: 'student-report.pdf',
          sizeBytes: 1024,
          issuedAt: '2026-08-21T09:00:00.000Z',
          classification: 'restricted',
          cachePolicy: 'noStore',
        },
      ],
      nextCursor: null,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('resolve_mobile_family_documents'),
      expect.arrayContaining([
        identity.issuer,
        identity.subject,
        scope.tenantId,
        scope.campusId,
        scope.persona,
        '40000000-0000-4000-8000-000000000011',
      ]),
    );
  });

  it('issues an exact single-use grant and rejects unexpected credential fields', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          payload: {
            documentId: '40000000-0000-4000-8000-000000000010',
            expiresAt: '2026-08-21T09:05:00.000Z',
            grantId: '40000000-0000-4000-8000-000000000012',
            requiresStepUp: true,
            singleUse: true,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          payload: {
            documentId: '40000000-0000-4000-8000-000000000010',
            expiresAt: '2026-08-21T09:05:00.000Z',
            grantId: '40000000-0000-4000-8000-000000000012',
            requiresStepUp: true,
            singleUse: true,
            downloadUrl: 'https://unsafe.invalid/document',
          },
        },
      ]);
    const store = new DatabaseMobileFamilyDocumentStore({ query });

    await expect(
      store.issueDownloadGrant(
        identity,
        scope,
        '40000000-0000-4000-8000-000000000010',
        'family-document-idempotency-0001',
      ),
    ).resolves.toMatchObject({
      grantId: '40000000-0000-4000-8000-000000000012',
      requiresStepUp: true,
      singleUse: true,
    });

    await expect(
      store.issueDownloadGrant(
        identity,
        scope,
        '40000000-0000-4000-8000-000000000010',
        'family-document-idempotency-0002',
      ),
    ).rejects.toThrow('invalid database response');
  });

  it('claims a grant only through the verified identity and assurance contract', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        payload: {
          status: 'claimed',
          documentId: '40000000-0000-4000-8000-000000000010',
          objectKey: 'tenant/documents/student-report.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          sha256Hex: 'a'.repeat(64),
        },
      },
    ]);
    const store = new DatabaseMobileFamilyDocumentStore({ query });

    await expect(
      store.claimDownloadGrant(
        identity,
        scope,
        '40000000-0000-4000-8000-000000000012',
        'family-document-exchange-0001',
      ),
    ).resolves.toEqual({
      status: 'claimed',
      documentId: '40000000-0000-4000-8000-000000000010',
      objectKey: 'tenant/documents/student-report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      sha256Hex: 'a'.repeat(64),
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('claim_mobile_family_document_download_grant'),
      expect.arrayContaining(['aal1', 'family-document-exchange-0001']),
    );
  });

  it('accepts step-up-required claim status without exposing object metadata', async () => {
    const query = vi.fn().mockResolvedValue([{ payload: { status: 'step-up-required' } }]);
    const store = new DatabaseMobileFamilyDocumentStore({ query });

    await expect(
      store.claimDownloadGrant(
        identity,
        scope,
        '40000000-0000-4000-8000-000000000012',
        'family-document-exchange-0002',
      ),
    ).resolves.toEqual({ status: 'step-up-required' });
  });

  it('rejects malformed idempotency keys before any database query', async () => {
    const query = vi.fn();
    const store = new DatabaseMobileFamilyDocumentStore({ query });

    await expect(
      store.issueDownloadGrant(
        identity,
        scope,
        '40000000-0000-4000-8000-000000000010',
        'bad key with spaces',
      ),
    ).rejects.toThrow('grant request is invalid');
    await expect(
      store.claimDownloadGrant(
        identity,
        scope,
        '40000000-0000-4000-8000-000000000012',
        'bad key with spaces',
      ),
    ).rejects.toThrow('exchange request is invalid');
    expect(query).not.toHaveBeenCalled();
  });
});
