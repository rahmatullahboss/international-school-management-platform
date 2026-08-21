import type { MobileFamilyDocumentClaim } from './database-mobile-family-document-store.js';

interface MobileDocumentObject {
  readonly body: ReadableStream;
  readonly size: number;
  readonly customMetadata?: Record<string, string>;
}

export interface MobileDocumentBucket {
  get(key: string): Promise<MobileDocumentObject | null>;
}

export async function resolveMobileFamilyDocumentObject(
  bucket: MobileDocumentBucket,
  claim: Extract<MobileFamilyDocumentClaim, { readonly status: 'claimed' }>,
): Promise<{ readonly body: ReadableStream } | undefined> {
  const object = await bucket.get(claim.objectKey);
  if (object === null || object.size !== claim.sizeBytes) return undefined;
  if (object.customMetadata?.['school-sha256'] !== claim.sha256Hex) return undefined;
  return { body: object.body };
}
