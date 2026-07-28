import { describe, expect, it } from 'vitest';

import { ProfileDomainError, ProfileRegistry } from '../../packages/modules/student-lifecycle/src/profiles.js';

const tenantA = '00000000-0000-4000-8000-0000000000a1';
const tenantB = '00000000-0000-4000-8000-0000000000b1';

describe('ProfileRegistry', () => {
  it('creates one idempotent student profile per tenant person', () => {
    const registry = new ProfileRegistry();
    const first = registry.createStudentProfile({
      tenantId: tenantA,
      personId: '10000000-0000-4000-8000-0000000000a1',
      effectiveFrom: '2026-07-28',
      correlationId: 'profile-1',
    });
    const replay = registry.createStudentProfile({
      tenantId: tenantA,
      personId: '10000000-0000-4000-8000-0000000000a1',
      effectiveFrom: '2026-07-28',
      correlationId: 'profile-1-retry',
    });

    expect(replay.value.studentProfileId).toBe(first.value.studentProfileId);
    expect(replay.events).toHaveLength(0);
    expect(first.events[0]?.eventType).toBe('sis.lifecycle.student-profile-created.v1');
  });

  it('preserves effective status history and closes access after withdrawal', () => {
    const registry = new ProfileRegistry();
    const profile = registry.createStudentProfile({
      tenantId: tenantA,
      personId: crypto.randomUUID(),
      effectiveFrom: '2026-01-01',
      correlationId: 'profile-2',
    }).value;
    registry.changeStudentStatus({
      tenantId: tenantA,
      studentProfileId: profile.studentProfileId,
      status: 'active',
      effectiveFrom: '2026-02-01',
      reasonCode: 'enrolled',
    });
    const withdrawn = registry.changeStudentStatus({
      tenantId: tenantA,
      studentProfileId: profile.studentProfileId,
      status: 'withdrawn',
      effectiveFrom: '2026-08-01',
      reasonCode: 'family-relocation',
    });

    expect(withdrawn.statusHistory).toHaveLength(3);
    expect(withdrawn.statusHistory[1]).toMatchObject({
      status: 'active',
      effectiveTo: '2026-08-01',
    });
    expect(registry.accessEffect(tenantA, 'student', profile.studentProfileId)).toMatchObject({
      interactiveAccess: 'revoked',
      guardianPortalVisibility: 'historical',
      futureOperationalExpectations: 'closed',
    });
  });

  it('enforces tenant-wide identifier uniqueness and document periods', () => {
    const registry = new ProfileRegistry();
    const first = registry.createStudentProfile({
      tenantId: tenantA,
      personId: crypto.randomUUID(),
      effectiveFrom: '2026-01-01',
      correlationId: 'profile-3',
    }).value;
    const second = registry.createStudentProfile({
      tenantId: tenantA,
      personId: crypto.randomUUID(),
      effectiveFrom: '2026-01-01',
      correlationId: 'profile-4',
    }).value;

    registry.assignIdentifier({
      tenantId: tenantA,
      profileKind: 'student',
      profileId: first.studentProfileId,
      identifierType: 'student-number',
      value: 'S-1001',
      effectiveFrom: '2026-01-01',
    });
    expect(() =>
      registry.assignIdentifier({
        tenantId: tenantA,
        profileKind: 'student',
        profileId: second.studentProfileId,
        identifierType: 'student-number',
        value: 's-1001',
        effectiveFrom: '2026-01-01',
      }),
    ).toThrowError(ProfileDomainError);
    expect(() =>
      registry.attachDocument({
        tenantId: tenantA,
        profileKind: 'student',
        profileId: first.studentProfileId,
        documentId: crypto.randomUUID(),
        documentType: 'passport',
        visibility: 'restricted',
        validFrom: '2027-01-01',
        validTo: '2026-01-01',
      }),
    ).toThrow('Document period is invalid');
  });

  it('applies staff status access effects without exposing cross-tenant profiles', () => {
    const registry = new ProfileRegistry();
    const staff = registry.createStaffProfile({
      tenantId: tenantA,
      personId: crypto.randomUUID(),
      effectiveFrom: '2026-01-01',
    });
    registry.changeStaffStatus({
      tenantId: tenantA,
      staffProfileId: staff.staffProfileId,
      status: 'leave',
      effectiveFrom: '2026-08-01',
      reasonCode: 'approved-leave',
    });

    expect(registry.accessEffect(tenantA, 'staff', staff.staffProfileId)).toMatchObject({
      interactiveAccess: 'suspended',
      futureOperationalExpectations: 'paused',
    });
    expect(() => registry.getStaff(tenantB, staff.staffProfileId)).toThrow('Staff profile was not found');
  });
});
