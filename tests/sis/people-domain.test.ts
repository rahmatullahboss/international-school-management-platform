import { describe, expect, it } from 'vitest';

import { PeopleDirectory, PeopleDomainError } from '../../packages/modules/people/src/domain.js';

const tenantA = '00000000-0000-4000-8000-0000000000a1';
const tenantB = '00000000-0000-4000-8000-0000000000b1';

function createPerson(
  directory: PeopleDirectory,
  tenantId: string,
  givenName: string,
  familyName: string,
  dateOfBirth: string,
  email?: string,
) {
  return directory.createPerson({
    tenantId,
    names: [
      {
        usage: 'legal',
        givenName,
        familyName,
        effectiveFrom: '2020-01-01',
      },
    ],
    dateOfBirth,
    ...(email === undefined
      ? {}
      : { contacts: [{ kind: 'email' as const, value: email, primary: true }] }),
    correlationId: crypto.randomUUID(),
  }).value;
}

describe('PeopleDirectory', () => {
  it('supports multiple households without flattening guardian authority', () => {
    const directory = new PeopleDirectory();
    const student = createPerson(directory, tenantA, 'Amina', 'Rahman', '2015-05-10');
    const guardianOne = createPerson(directory, tenantA, 'Nadia', 'Rahman', '1984-01-01');
    const guardianTwo = createPerson(directory, tenantA, 'Karim', 'Ali', '1982-01-01');

    const primaryHome = directory.createHousehold(tenantA, 'Rahman household', [
      { personId: guardianOne.personId, role: 'adult', effectiveFrom: '2020-01-01' },
      { personId: student.personId, role: 'child', effectiveFrom: '2020-01-01' },
    ]);
    const secondHome = directory.createHousehold(tenantA, 'Ali household', [
      { personId: guardianTwo.personId, role: 'adult', effectiveFrom: '2023-01-01' },
      { personId: student.personId, role: 'child', effectiveFrom: '2023-01-01' },
    ]);

    expect(primaryHome.householdId).not.toBe(secondHome.householdId);
    expect(primaryHome.members.some((member) => member.personId === student.personId)).toBe(true);
    expect(secondHome.members.some((member) => member.personId === student.personId)).toBe(true);
  });

  it('enforces verified and effective guardian capabilities', () => {
    const directory = new PeopleDirectory();
    const student = createPerson(directory, tenantA, 'Omar', 'Khan', '2014-02-02');
    const guardian = createPerson(directory, tenantA, 'Samira', 'Khan', '1985-03-03');

    directory.setGuardianAuthority({
      tenantId: tenantA,
      guardianPersonId: guardian.personId,
      studentPersonId: student.personId,
      authorities: ['communication', 'portal'],
      verificationStatus: 'verified',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      correlationId: crypto.randomUUID(),
    });

    expect(
      directory.canGuardian(tenantA, guardian.personId, student.personId, 'portal', '2026-07-28'),
    ).toBe(true);
    expect(
      directory.canGuardian(tenantA, guardian.personId, student.personId, 'pickup', '2026-07-28'),
    ).toBe(false);
    expect(
      directory.canGuardian(tenantA, guardian.personId, student.personId, 'portal', '2027-01-01'),
    ).toBe(false);
  });

  it('detects duplicates and merges without deleting historical identity', () => {
    const directory = new PeopleDirectory();
    const first = createPerson(
      directory,
      tenantA,
      'Lina',
      'Ahmed',
      '2010-08-08',
      'family@example.test',
    );
    const duplicate = createPerson(
      directory,
      tenantA,
      'Lina',
      'Ahmed',
      '2010-08-08',
      'family@example.test',
    );

    const candidates = directory.findDuplicateCandidates(tenantA);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.score).toBeGreaterThanOrEqual(90);

    const result = directory.mergePeople(
      tenantA,
      first.personId,
      duplicate.personId,
      'Verified duplicate during import reconciliation',
      crypto.randomUUID(),
    );

    expect(result.events[0]?.eventType).toBe('sis.people.person-merged.v1');
    expect(directory.getPerson(tenantA, duplicate.personId)).toMatchObject({
      status: 'merged',
      mergedIntoPersonId: first.personId,
    });
    expect(directory.listMerges(tenantA)).toHaveLength(1);
    expect(directory.auditLog.entries().map((entry) => entry.action)).toContain(
      'sis.people.person-merged',
    );
  });

  it('implements the published person mutation and search queries', () => {
    const directory = new PeopleDirectory();
    const person = createPerson(directory, tenantA, 'Amina', 'Rahman', '2015-05-10');

    directory.addPersonName(tenantA, person.personId, {
      usage: 'preferred',
      givenName: 'Mina',
      familyName: 'Rahman',
      effectiveFrom: '2026-01-01',
    });
    directory.addIdentifier(tenantA, person.personId, {
      identifierType: 'legacy-student-number',
      value: 'LS-1001',
      effectiveFrom: '2026-01-01',
    });
    const updated = directory.addContactPoint(tenantA, person.personId, {
      kind: 'email',
      value: 'amina@example.test',
      primary: true,
    });

    expect(updated.version).toBe(4);
    expect(directory.searchPeople(tenantA, { query: 'Mina' })).toHaveLength(1);
    expect(directory.searchPeople(tenantA, { query: 'LS-1001' })[0]?.personId).toBe(
      person.personId,
    );
    expect(directory.searchPeople(tenantB, { query: 'Mina' })).toHaveLength(0);
  });

  it('returns tenant-scoped household and effective guardian query results', () => {
    const directory = new PeopleDirectory();
    const student = createPerson(directory, tenantA, 'Omar', 'Khan', '2014-02-02');
    const guardian = createPerson(directory, tenantA, 'Samira', 'Khan', '1985-03-03');
    const household = directory.createHousehold(tenantA, 'Khan household', [
      { personId: guardian.personId, role: 'adult', effectiveFrom: '2020-01-01' },
      { personId: student.personId, role: 'child', effectiveFrom: '2020-01-01' },
    ]);
    directory.setGuardianAuthority({
      tenantId: tenantA,
      guardianPersonId: guardian.personId,
      studentPersonId: student.personId,
      authorities: ['portal'],
      verificationStatus: 'verified',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      correlationId: crypto.randomUUID(),
    });

    expect(directory.getHousehold(tenantA, household.householdId).members).toHaveLength(2);
    expect(directory.listStudentGuardians(tenantA, student.personId, '2026-07-28')).toHaveLength(1);
    expect(directory.listStudentGuardians(tenantA, student.personId, '2027-01-01')).toHaveLength(0);
    expect(() => directory.getHousehold(tenantB, household.householdId)).toThrow(
      'Household was not found',
    );
  });

  it('rejects identifier reuse across active people in a tenant', () => {
    const directory = new PeopleDirectory();
    const first = createPerson(directory, tenantA, 'First', 'Student', '2010-01-01');
    const second = createPerson(directory, tenantA, 'Second', 'Student', '2011-01-01');
    const identifier = {
      identifierType: 'student-number',
      value: 'S-1001',
      effectiveFrom: '2026-01-01',
    } as const;

    directory.addIdentifier(tenantA, first.personId, identifier);
    expect(() => directory.addIdentifier(tenantA, second.personId, identifier)).toThrow(
      'Identifier is already assigned within the tenant',
    );
  });

  it('does not disclose whether a person exists in another tenant', () => {
    const directory = new PeopleDirectory();
    const person = createPerson(directory, tenantA, 'Tenant', 'Scoped', '2000-01-01');

    expect(() => directory.getPerson(tenantB, person.personId)).toThrowError(PeopleDomainError);
    try {
      directory.getPerson(tenantB, person.personId);
    } catch (error) {
      expect((error as PeopleDomainError).code).toBe('SIS_PERSON_NOT_FOUND');
    }
  });
});
