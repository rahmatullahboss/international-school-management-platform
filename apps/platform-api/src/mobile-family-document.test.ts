import { describe, expect, it } from 'vitest';

import {
  isMobileFamilyDocumentIdempotencyKey,
  parseMobileFamilyDocumentCursor,
  parseMobileFamilyDocumentLimit,
} from './mobile-family-document.js';

describe('mobile family document request validation', () => {
  it('accepts bounded paging inputs and rejects malformed cursors', () => {
    expect(parseMobileFamilyDocumentLimit(undefined)).toBe(25);
    expect(parseMobileFamilyDocumentLimit('1')).toBe(1);
    expect(parseMobileFamilyDocumentLimit('100')).toBe(100);
    expect(parseMobileFamilyDocumentLimit('0')).toBeUndefined();
    expect(parseMobileFamilyDocumentLimit('101')).toBeUndefined();
    expect(parseMobileFamilyDocumentLimit('01')).toBeUndefined();

    expect(parseMobileFamilyDocumentCursor(undefined)).toBeUndefined();
    expect(parseMobileFamilyDocumentCursor('40000000-0000-4000-8000-000000000010')).toBe(
      '40000000-0000-4000-8000-000000000010',
    );
    expect(parseMobileFamilyDocumentCursor('not-a-cursor')).toBeUndefined();
  });

  it('requires strong bounded idempotency keys', () => {
    expect(isMobileFamilyDocumentIdempotencyKey('family-document-idempotency-0001')).toBe(true);
    expect(isMobileFamilyDocumentIdempotencyKey('short')).toBe(false);
    expect(isMobileFamilyDocumentIdempotencyKey('bad key with spaces 0001')).toBe(false);
    expect(isMobileFamilyDocumentIdempotencyKey(undefined)).toBe(false);
  });
});
