import { describe, expect, it, vi } from 'vitest';

import {
  composeTeacherRuntimeProjection,
  type TeacherRuntimeProjectionComposerStore,
} from './runtime-teacher-projection-composer.js';

const tenantId = '30000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000006';
const campusId = '30000000-0000-4000-8000-000000000003';
const correlationId = '30000000-0000-4000-8000-000000000050';

function input() {
  return {
    tenantId,
    membershipId,
    campusId,
    expectedPreviousRevision: 4,
    composerId: 'teacher-home-composer-staging-01',
    correlationId,
  } as const;
}

function storeWith(result: unknown) {
  const compose = vi.fn().mockResolvedValue(result);
  const store: TeacherRuntimeProjectionComposerStore = { compose };
  return { compose, store };
}

describe('teacher runtime projection composer', () => {
  it('composes one validated database-owned teacher home source', async () => {
    const result = {
      composed: true as const,
      composition: {
        compositionId: '30000000-0000-4000-8000-000000000051',
        tenantId,
        membershipId,
        campusId,
        state: 'published' as const,
        sourceRevision: 5,
        payloadDigest: 'a'.repeat(64),
        payloadBytes: 2048,
        correlationId,
        composedAt: '2026-07-31T18:30:00.000Z',
      },
    };
    const { compose, store } = storeWith(result);

    await expect(
      composeTeacherRuntimeProjection({ configured: true, input: input(), store }),
    ).resolves.toEqual(result);
    expect(compose).toHaveBeenCalledWith(input());
  });

  it('stays disabled without an explicitly configured privileged composer', async () => {
    const { compose, store } = storeWith({ composed: true });
    await expect(
      composeTeacherRuntimeProjection({ configured: false, input: input(), store }),
    ).resolves.toEqual({ composed: false, reason: 'composer-disabled' });
    expect(compose).not.toHaveBeenCalled();
  });

  it('rejects malformed or caller-expanded composition inputs before storage', async () => {
    const { compose, store } = storeWith({ composed: true });
    const invalidInputs = [
      { ...input(), tenantId: 'tenant-browser-selected' },
      { ...input(), membershipId: 'membership-browser-selected' },
      { ...input(), campusId: null },
      { ...input(), expectedPreviousRevision: -1 },
      { ...input(), composerId: 'bad composer id' },
      { ...input(), correlationId: 'not-a-uuid' },
      { ...input(), payload: { sessions: [] } },
      { ...input(), persona: 'teacher' },
      { ...input(), staffId: 'browser-selected-staff' },
      { ...input(), capabilities: ['classes.assigned.read'] },
    ];

    for (const candidate of invalidInputs) {
      await expect(
        composeTeacherRuntimeProjection({ configured: true, input: candidate, store }),
      ).resolves.toEqual({ composed: false, reason: 'invalid-composition' });
    }
    expect(compose).not.toHaveBeenCalled();
  });

  it('sanitizes privileged composer outages', async () => {
    const compose = vi
      .fn()
      .mockRejectedValue(new Error('postgres://secret@database.internal/teacher-composer'));
    const store: TeacherRuntimeProjectionComposerStore = { compose };

    await expect(
      composeTeacherRuntimeProjection({ configured: true, input: input(), store }),
    ).resolves.toEqual({ composed: false, reason: 'composer-unavailable' });
  });
});
