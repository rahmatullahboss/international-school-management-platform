import { describe, expect, it } from 'vitest';

import {
  isMobileFamilyInteractionIdempotencyKey,
  parseFamilyConsentDecision,
  parseFamilyFormSubmission,
} from './mobile-family-forms-consents.js';

describe('mobile Family forms and consents request validation', () => {
  it('accepts an exact bounded form submission and rejects authority/unknown fields', () => {
    expect(
      parseFamilyFormSubmission(
        JSON.stringify({
          studentId: '40000000-0000-4000-8000-000000000010',
          schemaVersion: 3,
          baseVersion: 7,
          answers: {
            emergency_contact: 'Guardian',
            permission: true,
            trip_date: '2026-09-02',
            optional_note: null,
          },
        }),
      ),
    ).toEqual({
      studentId: '40000000-0000-4000-8000-000000000010',
      schemaVersion: 3,
      baseVersion: 7,
      answers: {
        emergency_contact: 'Guardian',
        permission: true,
        trip_date: '2026-09-02',
        optional_note: null,
      },
    });

    expect(
      parseFamilyFormSubmission(
        JSON.stringify({
          studentId: '40000000-0000-4000-8000-000000000010',
          schemaVersion: 3,
          baseVersion: 7,
          answers: {},
          approve: true,
        }),
      ),
    ).toBeUndefined();
    expect(
      parseFamilyFormSubmission(
        JSON.stringify({
          studentId: '40000000-0000-4000-8000-000000000010',
          schemaVersion: 3,
          baseVersion: 7,
          answers: { unsupported: 42 },
        }),
      ),
    ).toBeUndefined();
  });

  it('accepts exact guardian consent decisions and rejects changed shapes', () => {
    expect(
      parseFamilyConsentDecision(
        JSON.stringify({
          studentId: '40000000-0000-4000-8000-000000000010',
          policyVersion: 'trip-policy-2026.2',
          decision: 'grant',
        }),
      ),
    ).toEqual({
      studentId: '40000000-0000-4000-8000-000000000010',
      policyVersion: 'trip-policy-2026.2',
      decision: 'grant',
    });
    expect(
      parseFamilyConsentDecision(
        JSON.stringify({
          studentId: '40000000-0000-4000-8000-000000000010',
          policyVersion: 'trip-policy-2026.2',
          decision: 'withdraw',
        }),
      ),
    ).toBeUndefined();
  });

  it('requires a bounded strong idempotency key', () => {
    expect(isMobileFamilyInteractionIdempotencyKey('family-form-idempotency-0001')).toBe(true);
    expect(isMobileFamilyInteractionIdempotencyKey('short')).toBe(false);
    expect(isMobileFamilyInteractionIdempotencyKey('bad key with spaces')).toBe(false);
    expect(isMobileFamilyInteractionIdempotencyKey(undefined)).toBe(false);
  });
});
