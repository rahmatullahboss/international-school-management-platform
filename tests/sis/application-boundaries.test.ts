import { describe, expect, it } from 'vitest';

import { PolicyEngine, type PermissionGrant } from '@school/policy';

import {
  SisApplicationService,
  type SisPermission,
  type SisRequestContext,
} from '../../packages/modules/admissions/src/application-service.js';

const tenantId = '00000000-0000-4000-8000-0000000000a1';
const registrarId = '10000000-0000-4000-8000-000000000001';
const campusA = '80000000-0000-4000-8000-000000000001';
const programA = '81000000-0000-4000-8000-000000000001';
const yearA = '82000000-0000-4000-8000-000000000001';
const yearB = '82000000-0000-4000-8000-000000000002';
const yearC = '82000000-0000-4000-8000-000000000003';
const gradeA = '83000000-0000-4000-8000-000000000001';
const gradeB = '83000000-0000-4000-8000-000000000002';

const permissions: readonly SisPermission[] = [
  'sis.people.read',
  'sis.people.manage',
  'sis.guardian.manage',
  'sis.admissions.read',
  'sis.admissions.manage',
  'sis.admissions.review',
  'sis.admissions.convert',
  'sis.enrollment.read',
  'sis.enrollment.manage',
  'sis.import.manage',
  'sis.export.read',
];

function serviceFixture(): SisApplicationService {
  const policy = new PolicyEngine();
  const grants: PermissionGrant[] = permissions.map((permission) => ({
    permission,
    assurance:
      permission === 'sis.admissions.review' || permission === 'sis.admissions.convert'
        ? 'aal2'
        : 'aal1',
  }));
  policy.registerRole('registrar', grants);
  policy.assignRole({ principalId: registrarId, tenantId, roleId: 'registrar' });
  return new SisApplicationService({ authorizer: policy });
}

function context(): SisRequestContext {
  return {
    tenantId,
    principalId: registrarId,
    assurance: 'aal2',
    correlationId: crypto.randomUUID(),
  };
}

function createPerson(
  service: SisApplicationService,
  request: SisRequestContext,
  givenName: string,
  familyName: string,
  dateOfBirth?: string,
  email?: string,
) {
  return service.createPerson(request, {
    names: [
      {
        usage: 'legal',
        givenName,
        familyName,
        effectiveFrom: '2026-01-01',
      },
    ],
    ...(dateOfBirth === undefined ? {} : { dateOfBirth }),
    ...(email === undefined
      ? {}
      : { contacts: [{ kind: 'email' as const, value: email, primary: true }] }),
  });
}

function createDraftApplication(service: SisApplicationService, request: SisRequestContext) {
  const student = createPerson(service, request, 'Amina', 'Rahman', '2015-05-10');
  const guardian = createPerson(service, request, 'Nadia', 'Rahman', '1984-01-01');
  service.setGuardianAuthority(request, {
    guardianPersonId: guardian.personId,
    studentPersonId: student.personId,
    authorities: ['legal', 'education', 'portal'],
    verificationStatus: 'verified',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2099-12-31',
  });
  const cycle = service.createAdmissionsCycle(request, {
    name: '2027 Entry',
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2027-01-01T00:00:00.000Z',
    status: 'open',
  });
  const form = service.publishApplicationForm(request, {
    formKey: 'standard',
    schema: { required: ['legalName'] },
  });
  const application = service.startApplication(request, {
    applicationNumber: `APP-${crypto.randomUUID()}`,
    cycleId: cycle.cycleId,
    applicantPersonId: student.personId,
    submittingGuardianPersonId: guardian.personId,
    programChoiceIds: [programA],
    formVersionId: form.formVersionId,
    initialAnswers: { legalName: 'Amina Rahman' },
  });
  return { student, guardian, cycle, application };
}

describe('SisApplicationService boundary coverage', () => {
  it('keeps identity mutations, household reads and duplicate merges behind the SIS permission boundary', () => {
    const service = serviceFixture();
    const request = context();
    const first = createPerson(service, request, 'Lina', 'Ahmed', '2010-08-08');

    service.addPersonName(request, first.personId, {
      usage: 'preferred',
      givenName: 'Lina',
      familyName: 'Ahmed',
      effectiveFrom: '2026-02-01',
    });
    service.addIdentifier(request, first.personId, {
      identifierType: 'legacy-student-number',
      value: 'LS-1001',
      effectiveFrom: '2026-01-01',
    });
    service.addContactPoint(request, first.personId, {
      kind: 'email',
      value: 'family@example.test',
      primary: true,
    });
    expect(service.getPerson(request, first.personId)).toMatchObject({
      personId: first.personId,
      status: 'active',
      identifiers: [expect.objectContaining({ value: 'LS-1001' })],
      contacts: [expect.objectContaining({ value: 'family@example.test' })],
    });

    const guardian = createPerson(service, request, 'Nadia', 'Ahmed', '1980-01-01');
    const household = service.createHousehold(request, 'Ahmed household', [
      { personId: guardian.personId, role: 'adult', effectiveFrom: '2026-01-01' },
      { personId: first.personId, role: 'child', effectiveFrom: '2026-01-01' },
    ]);
    service.setGuardianAuthority(request, {
      guardianPersonId: guardian.personId,
      studentPersonId: first.personId,
      authorities: ['legal', 'portal'],
      verificationStatus: 'verified',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2099-12-31',
    });
    expect(service.getHousehold(request, household.householdId).householdId).toBe(
      household.householdId,
    );
    expect(service.listStudentGuardians(request, first.personId, '2026-08-19')).toEqual([
      expect.objectContaining({ guardianPersonId: guardian.personId }),
    ]);

    const duplicate = createPerson(
      service,
      request,
      'Lina',
      'Ahmed',
      '2010-08-08',
      'family@example.test',
    );
    const candidates = service.listDuplicateCandidates(request, 90);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.score).toBeGreaterThanOrEqual(90);
    const merged = service.mergePeople(
      request,
      first.personId,
      duplicate.personId,
      'Verified duplicate during registrar reconciliation',
    );
    expect(merged).toMatchObject({
      survivingPersonId: first.personId,
      mergedPersonId: duplicate.personId,
      reason: 'Verified duplicate during registrar reconciliation',
    });
    expect(service.getPerson(request, duplicate.personId)).toMatchObject({
      status: 'merged',
      mergedIntoPersonId: first.personId,
    });
  });

  it('validates enquiry person references and preserves application response-version history when amending', () => {
    const service = serviceFixture();
    const request = context();
    const { student, guardian, cycle, application } = createDraftApplication(service, request);

    expect(
      service.createEnquiry(request, {
        contactPersonId: guardian.personId,
        prospectiveStudentPersonId: student.personId,
        cycleId: cycle.cycleId,
        source: 'website',
      }),
    ).toMatchObject({
      contactPersonId: guardian.personId,
      prospectiveStudentPersonId: student.personId,
      source: 'website',
      status: 'new',
    });

    const amended = service.amendApplication(request, application.applicationId, {
      legalName: 'Amina Noor Rahman',
      preferredCampus: campusA,
    });
    expect(amended).toMatchObject({
      version: 2,
      answers: { legalName: 'Amina Noor Rahman', preferredCampus: campusA },
      submitted: false,
      supersedesResponseVersionId: application.responseVersions[0]?.responseVersionId,
    });
    const current = service.getApplication(request, application.applicationId);
    expect(current.responseVersions).toHaveLength(2);
    expect(current.responseVersions.at(-1)).toEqual(amended);
  });

  it('binds registrar contract signing to the authenticated account after an admitted application', () => {
    const service = serviceFixture();
    const request = context();
    const { application } = createDraftApplication(service, request);

    service.amendApplication(request, application.applicationId, { legalName: 'Amina Rahman' });
    service.submitApplication(request, application.applicationId);
    service.recordReview(request, application.applicationId, {
      recommendation: 'admit',
      score: 91,
      confidential: true,
    });
    service.recordDecision(request, application.applicationId, {
      decision: 'admit',
      reasonCode: 'meets-criteria',
    });
    service.issueOffer(request, application.applicationId, {
      programId: programA,
      campusId: campusA,
      academicYearId: yearA,
      gradeLevelId: gradeA,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    service.issueContract(request, application.applicationId, {
      templateVersion: 'v2',
      documentId: '90000000-0000-4000-8000-000000000099',
    });

    expect(service.signContract(request, application.applicationId)).toMatchObject({
      status: 'signed',
      signedByAccountId: registrarId,
    });
    expect(service.getApplication(request, application.applicationId).contract).not.toHaveProperty(
      'signedByPersonId',
    );
  });

  it('covers staff-profile and student promotion, re-enrollment, prior-school and alumni application boundaries', () => {
    const service = serviceFixture();
    const request = context();

    const staffPerson = createPerson(service, request, 'Sara', 'Khan');
    const staff = service.createStaffProfile(request, {
      personId: staffPerson.personId,
      effectiveFrom: '2026-01-01',
    });
    service.changeStaffStatus(request, {
      staffProfileId: staff.staffProfileId,
      status: 'leave',
      effectiveFrom: '2026-08-01',
      reasonCode: 'approved-leave',
    });
    service.attachProfileDocument(request, {
      profileKind: 'staff',
      profileId: staff.staffProfileId,
      documentId: 'staff-document-1',
      documentType: 'employment-record',
      visibility: 'restricted',
      validFrom: '2026-01-01',
    });
    expect(service.getStaffProfile(request, staff.staffProfileId)).toMatchObject({
      status: 'leave',
      documents: [expect.objectContaining({ documentId: 'staff-document-1' })],
    });

    const studentPerson = createPerson(service, request, 'Omar', 'Khan', '2014-02-02');
    const student = service.createStudentProfile(request, {
      personId: studentPerson.personId,
      effectiveFrom: '2026-01-01',
    });
    service.changeStudentStatus(request, {
      studentProfileId: student.studentProfileId,
      status: 'active',
      effectiveFrom: '2026-02-01',
      reasonCode: 'direct-enrollment',
    });
    const source = service.createEnrollment(request, {
      idempotencyKey: 'lifecycle-source',
      studentProfileId: student.studentProfileId,
      campusId: campusA,
      programId: programA,
      academicYearId: yearA,
      gradeLevelId: gradeA,
      effectiveFrom: '2026-02-01',
      status: 'active',
    });
    const promotion = service.promoteStudent(request, {
      sourceEnrollmentId: source.enrollmentId,
      newAcademicYearId: yearB,
      newGradeLevelId: gradeB,
      effectiveFrom: '2026-08-01',
      outcome: 'promoted',
    });
    service.withdrawEnrollment(request, {
      enrollmentId: promotion.destinationEnrollmentId,
      withdrawalDate: '2027-06-30',
      reasonCode: 'family-relocation',
    });
    const reEnrollment = service.reEnrollStudent(request, {
      priorEnrollmentId: promotion.destinationEnrollmentId,
      academicYearId: yearC,
      campusId: campusA,
      effectiveFrom: '2027-08-01',
      reasonCode: 'returned',
    });
    service.recordPreviousSchool(request, {
      studentProfileId: student.studentProfileId,
      schoolName: 'Previous International School',
      countryCode: 'BD',
      gradeLevel: 'Year 6',
      attendedFrom: '2024-01-01',
      attendedTo: '2025-12-31',
      transcriptDocumentId: 'previous-school-transcript-1',
    });
    service.withdrawEnrollment(request, {
      enrollmentId: reEnrollment.newEnrollmentId,
      withdrawalDate: '2028-06-30',
      reasonCode: 'completed-program',
    });
    const alumni = service.transitionToAlumni(request, {
      finalEnrollmentId: reEnrollment.newEnrollmentId,
      transitionDate: '2028-06-30',
      outcome: 'completed-program',
      alumniAccess: 'enabled',
    });

    expect(alumni.studentProfileId).toBe(student.studentProfileId);
    expect(service.getEnrollmentHistory(request, student.studentProfileId)).toHaveLength(3);
  });
});
