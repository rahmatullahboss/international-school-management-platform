import { describe, expect, it } from 'vitest';

import { EnrollmentDomainError, EnrollmentRegistry } from '../../packages/modules/student-lifecycle/src/enrollment.js';

const tenantA = '00000000-0000-4000-8000-0000000000a1';
const tenantB = '00000000-0000-4000-8000-0000000000b1';

function createEnrollment(registry: EnrollmentRegistry, suffix = '1') {
  return registry.createEnrollment({
    tenantId: tenantA,
    idempotencyKey: `enrollment-${suffix}`,
    studentProfileId: '20000000-0000-4000-8000-0000000000a1',
    campusId: `80000000-0000-4000-8000-0000000000${suffix.padStart(2, '0')}`,
    programId: '81000000-0000-4000-8000-000000000001',
    academicYearId: `82000000-0000-4000-8000-0000000000${suffix.padStart(2, '0')}`,
    gradeLevelId: '83000000-0000-4000-8000-000000000001',
    effectiveFrom: `202${suffix}-08-01`,
    sourceApplicationId: '60000000-0000-4000-8000-0000000000a1',
    correlationId: `create-${suffix}`,
  });
}

describe('EnrollmentRegistry', () => {
  it('creates enrollment idempotently and rejects overlapping active duplicates', () => {
    const registry = new EnrollmentRegistry();
    const first = createEnrollment(registry);
    const replay = createEnrollment(registry);

    expect(replay.value.enrollmentId).toBe(first.value.enrollmentId);
    expect(replay.events).toHaveLength(0);
    expect(() =>
      registry.createEnrollment({
        tenantId: tenantA,
        idempotencyKey: 'another-key',
        studentProfileId: first.value.studentProfileId,
        campusId: first.value.campusId,
        programId: first.value.programId,
        academicYearId: first.value.academicYearId,
        effectiveFrom: first.value.effectiveFrom,
        correlationId: 'overlap',
      }),
    ).toThrowError(EnrollmentDomainError);
  });

  it('transfers by closing the source and appending a destination enrollment', () => {
    const registry = new EnrollmentRegistry();
    const source = createEnrollment(registry).value;
    const transfer = registry.transferEnrollment({
      tenantId: tenantA,
      sourceEnrollmentId: source.enrollmentId,
      idempotencyKey: 'transfer-1',
      destinationCampusId: '80000000-0000-4000-8000-000000000099',
      transferDate: '2022-01-01',
      reasonCode: 'campus-move',
      correlationId: 'transfer',
    });
    const replay = registry.transferEnrollment({
      tenantId: tenantA,
      sourceEnrollmentId: source.enrollmentId,
      idempotencyKey: 'transfer-1',
      destinationCampusId: '80000000-0000-4000-8000-000000000099',
      transferDate: '2022-01-01',
      reasonCode: 'campus-move',
      correlationId: 'transfer-retry',
    });

    expect(registry.getEnrollment(tenantA, source.enrollmentId)).toMatchObject({
      status: 'transferred',
      effectiveTo: '2022-01-01',
    });
    expect(registry.getEnrollmentHistory(tenantA, source.studentProfileId)).toHaveLength(2);
    expect(transfer.events[0]?.eventType).toBe('sis.lifecycle.student-transferred.v1');
    expect(replay.value).toEqual(transfer.value);
    expect(replay.events).toHaveLength(0);
  });

  it('withdraws, re-enrolls and preserves both historical records', () => {
    const registry = new EnrollmentRegistry();
    const source = createEnrollment(registry).value;
    registry.withdrawEnrollment({
      tenantId: tenantA,
      enrollmentId: source.enrollmentId,
      withdrawalDate: '2022-02-01',
      reasonCode: 'family-relocation',
      destinationSchool: 'New School',
      destinationCountryCode: 'BD',
      correlationId: 'withdraw',
    });
    const reEnrollment = registry.reEnrollStudent({
      tenantId: tenantA,
      priorEnrollmentId: source.enrollmentId,
      academicYearId: '82000000-0000-4000-8000-000000000002',
      effectiveFrom: '2022-08-01',
      reasonCode: 'returned',
      correlationId: 'reenroll',
    });

    expect(registry.getEnrollment(tenantA, source.enrollmentId).status).toBe('withdrawn');
    expect(registry.getEnrollment(tenantA, reEnrollment.newEnrollmentId).status).toBe('active');
    expect(registry.getEnrollmentHistory(tenantA, source.studentProfileId)).toHaveLength(2);
  });

  it('promotes without overwriting the prior year and supports alumni transition', () => {
    const registry = new EnrollmentRegistry();
    const source = createEnrollment(registry).value;
    const promotion = registry.promoteStudent({
      tenantId: tenantA,
      sourceEnrollmentId: source.enrollmentId,
      newAcademicYearId: '82000000-0000-4000-8000-000000000002',
      newGradeLevelId: '83000000-0000-4000-8000-000000000002',
      effectiveFrom: '2022-08-01',
      outcome: 'promoted',
      correlationId: 'promote',
    });
    registry.withdrawEnrollment({
      tenantId: tenantA,
      enrollmentId: promotion.destinationEnrollmentId,
      withdrawalDate: '2023-06-30',
      reasonCode: 'completed-program',
      correlationId: 'complete',
    });
    const alumni = registry.transitionToAlumni({
      tenantId: tenantA,
      finalEnrollmentId: promotion.destinationEnrollmentId,
      transitionDate: '2023-06-30',
      outcome: 'completed-program',
      alumniAccess: 'enabled',
    });

    expect(registry.getEnrollment(tenantA, source.enrollmentId).status).toBe('completed');
    expect(registry.getEnrollment(tenantA, promotion.destinationEnrollmentId).status).toBe('withdrawn');
    expect(alumni.studentProfileId).toBe(source.studentProfileId);
    expect(() => registry.getEnrollment(tenantB, source.enrollmentId)).toThrow('Enrollment was not found');
  });
});
