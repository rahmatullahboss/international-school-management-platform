import { describe, expect, it, vi } from 'vitest';

import { resolveMobileFamilyDocumentObject } from './mobile-family-document-storage.js';

const claim = {
  status: 'claimed' as const,
  documentId: '40000000-0000-4000-8000-000000000010',
  objectKey: 'tenant/documents/student-report.pdf',
  contentType: 'application/pdf',
  sizeBytes: 6,
  sha256Hex: 'a'.repeat(64),
};

describe('mobile family document storage boundary', () => {
  it('accepts only an object whose size and immutable digest metadata match the claim', async () => {
    const body = new ReadableStream<Uint8Array>();
    const get = vi.fn().mockResolvedValue({
      body,
      size: 6,
      customMetadata: { 'school-sha256': 'a'.repeat(64) },
    });

    await expect(resolveMobileFamilyDocumentObject({ get }, claim)).resolves.toEqual({ body });
    expect(get).toHaveBeenCalledWith(claim.objectKey);
  });

  it('fails closed when the object is missing or integrity metadata drifts', async () => {
    await expect(
      resolveMobileFamilyDocumentObject({ get: vi.fn().mockResolvedValue(null) }, claim),
    ).resolves.toBeUndefined();

    await expect(
      resolveMobileFamilyDocumentObject(
        {
          get: vi.fn().mockResolvedValue({
            body: new ReadableStream<Uint8Array>(),
            size: 7,
            customMetadata: { 'school-sha256': 'a'.repeat(64) },
          }),
        },
        claim,
      ),
    ).resolves.toBeUndefined();

    await expect(
      resolveMobileFamilyDocumentObject(
        {
          get: vi.fn().mockResolvedValue({
            body: new ReadableStream<Uint8Array>(),
            size: 6,
            customMetadata: { 'school-sha256': 'b'.repeat(64) },
          }),
        },
        claim,
      ),
    ).resolves.toBeUndefined();
  });
});
