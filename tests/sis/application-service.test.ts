import { describe, expect, it } from 'vitest';

import { PolicyEngine, type PermissionGrant } from '@school/policy';

import {
  SisApplicationService,
  type SisApplicationServiceError,
  type SisPermission,
  type SisRequestContext,
} from '../../packages/modules/admissions/src/application-service.js';

const tenantA = '00000000-0000-4000-8000-0000000000a1';
const tenantB = '00000000-0000-4000-8000-0000000000b1';
const registrarId = '10000000-0000-4000-8000-000000000001';
const guardianPrincipalId = '10000000-0000-4000-8000-000000000002';

const registrarPermissions: readonly SisPermission[] = [
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

function setupService() {
  const policy = new PolicyEngine();
  const grants: PermissionGrant[] = registrarPermissions.map((permission) => ({
    permission,
    assurance:
      permission === 'sis.admissions.review' || permission === 'sis.admissions.convert'
        ? 'aal2'
        : 'aal1',
  }));
  policy.registerRole('registrar', grants);
  policy.registerRole('family', [
    { permission: 'sis.family.application.read', assurance: 'aal1' },
    { permission: 'sis.family.contract.sign', assurance: 'aal1' },
  ]);
  policy.assignRole({ principalId: registrarId, tenantId: tenantA, roleId: 'registrar' });
  policy.assignRole({ principalId: guardianPrincipalId, tenantId: tenantA, roleId: 'family' });
  return { service: new SisApplicationService({ authorizer: policy }), policy };
}

function context(
  principalId = registrarId,
  assurance: SisRequestContext['assurance'] = 'aal2',
  tenantId = tenantA,
  personId?: string,
): SisRequestContext {
  return {
    tenantId,
    principalId,
    assurance,
    correlationId: crypto.randomUUID(),
    ...(personId === undefined ? {} : { personId }),
  };
}

function createPeopleAndApplication(service: SisApplicationService) {
  const registrar = context();
  const student = service.createPerson(registrar, {
    names: [
      {
        usage: 'legal',
        givenName: 'Amina',
        familyName: 'Rahman',
        effectiveFrom: '2026-01-01',
      },
    ],
    dateOfBirth: '2015-05-10',
  });
  const guardian = service.createPerson(registrar, {
    names: [
      {
        usage: 'legal',
        givenName: 'Nadia',
        familyName: 'Rahman',
        effectiveFrom: '2026-01-01',
      },
    ],
  });
  service.createHousehold(registrar, 'Rahman household', [
    { personId: guardian.personId, role: 'adult', effectiveFrom: '2026-01-01' },
    { personId: student.personId, role: 'child', effectiveFrom: '2026-01-01' },
  ]);
  service.setGuardianAuthority(registrar, {
    guardianPersonId: guardian.personId,
    studentPersonId: student.personId,
    authorities: ['legal', 'education', 'portal'],
    verificationStatus: 'verified',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2099-12-31',
  });
  const cycle = service.createAdmissionsCycle(registrar, {
    name: '2027 Entry',
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2027-01-01T00:00:00.000Z',
    status: 'open',
  });
  const form = service.publishApplicationForm(registrar, {
    formKey: 'standard',
    schema: { required: ['legalName'] },
  });
  const application = service.startApplication(registrar, {
    applicationNumber: 'APP-1001',
    cycleId: cycle.cycleId,
    applicantPersonId: student.personId,
    submittingGuardianPersonId: guardian.personId,
    programChoiceIds: ['81000000-0000-4000-8000-000000000001'],
    formVersionId: form.formVersionId,
    initialAnswers: { legalName: 'Amina Rahman' },
  });
  return { registrar, student, guardian, application };
}

describe('SisApplicationService', () => {
  it('executes the permission-aware application-to-enrollment workflow idempotently', () => {
    const { service } = setupService();
    const { registrar, student, guardian, application } = createPeopleAndApplication(service);
    const unrelatedAdult = service.createPerson(registrar, {
      names: [
        {
          usage: 'legal',
          givenName: 'Farid',
          familyName: 'Ahmed',
          effectiveFrom: '2026-01-01',
        },
      ],
    });
    expect(() =>
      service.recordConsent(registrar, {
        subjectPersonId: student.personId,
        grantedByPersonId: unrelatedAdult.personId,
        purpose: 'student-media',
        status: 'granted',
        effectiveFrom: '2026-01-01',
      }),
    ).toThrow('Consent grantor lacks verified legal authority for the subject');
    expect(
      service.recordConsent(registrar, {
        subjectPersonId: student.personId,
        grantedByPersonId: guardian.personId,
        purpose: 'student-media',
        status: 'granted',
        effectiveFrom: '2026-01-01',
      }),
    ).toMatchObject({ grantedByPersonId: guardian.personId, status: 'granted' });
    const checklist = service.addChecklistRequirement(registrar, application.applicationId, {
      requirementKey: 'passport',
      label: 'Passport',
      required: true,
    });
    service.updateChecklist(registrar, application.applicationId, {
      checklistItemId: checklist.checklistItemId,
      status: 'verified',
      documentId: '90000000-0000-4000-8000-000000000001',
    });
    service.submitApplication(registrar, application.applicationId);
    const review = service.recordReview(registrar, application.applicationId, {
      recommendation: 'admit',
      score: 93,
      confidential: true,
    });
    expect(review.reviewerAccountId).toBe(registrarId);
    const interview = service.scheduleInterview(registrar, application.applicationId, {
      scheduledAt: '2026-08-01T10:00:00.000Z',
      interviewerAccountIds: [registrarId],
    });
    expect(
      service.completeInterview(registrar, application.applicationId, {
        interviewId: interview.interviewId,
        status: 'completed',
        outcome: 'recommended',
      }),
    ).toMatchObject({ status: 'completed', outcome: 'recommended' });
    service.recordDecision(registrar, application.applicationId, {
      decision: 'admit',
      reasonCode: 'meets-criteria',
    });
    service.issueOffer(registrar, application.applicationId, {
      programId: '81000000-0000-4000-8000-000000000001',
      campusId: '80000000-0000-4000-8000-000000000001',
      academicYearId: '82000000-0000-4000-8000-000000000001',
      gradeLevelId: '83000000-0000-4000-8000-000000000001',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    service.issueContract(registrar, application.applicationId, {
      templateVersion: 'v1',
      documentId: '90000000-0000-4000-8000-000000000002',
    });
    expect(() =>
      service.signContractAsGuardian(
        context(guardianPrincipalId, 'aal1', tenantA, crypto.randomUUID()),
        application.applicationId,
      ),
    ).toThrow('Guardian contract signing authority was denied');
    const familyContext = context(guardianPrincipalId, 'aal1', tenantA, guardian.personId);
    const signedContract = service.signContractAsGuardian(familyContext, application.applicationId);
    expect(signedContract).toMatchObject({
      status: 'signed',
      signedByAccountId: guardianPrincipalId,
      signedByPersonId: guardian.personId,
    });
    service.acceptOffer(registrar, application.applicationId);

    const first = service.convertAcceptedApplication(registrar, {
      applicationId: application.applicationId,
      idempotencyKey: 'convert-app-1001',
      effectiveFrom: '2027-08-01',
    });
    const replay = service.convertAcceptedApplication(registrar, {
      applicationId: application.applicationId,
      idempotencyKey: 'convert-app-1001',
      effectiveFrom: '2027-08-01',
    });
    expect(() =>
      service.convertAcceptedApplication(registrar, {
        applicationId: application.applicationId,
        idempotencyKey: 'convert-app-1001',
        effectiveFrom: '2027-09-01',
      }),
    ).toThrow('Conversion retry does not match the original request');

    expect(first.application.status).toBe('converted');
    expect(replay.studentProfile.studentProfileId).toBe(first.studentProfile.studentProfileId);
    expect(replay.enrollment.enrollmentId).toBe(first.enrollment.enrollmentId);
    expect(
      service.getEnrollmentHistory(registrar, first.studentProfile.studentProfileId),
    ).toHaveLength(1);
    expect(service.listApplications(registrar, { status: 'converted' })).toHaveLength(1);
    expect(service.getChecklistReconciliation(registrar, application.applicationId)).toMatchObject({
      required: 1,
      completed: 1,
      complete: true,
    });

    expect(
      service.getGuardianApplicationStatus(familyContext, application.applicationId).status,
    ).toBe('converted');
  });

  it('enforces tenant scope, permission and assurance requirements', () => {
    const { service } = setupService();
    const { application } = createPeopleAndApplication(service);

    expect(() =>
      service.recordDecision(context(registrarId, 'aal1'), application.applicationId, {
        decision: 'admit',
        reasonCode: 'meets-criteria',
      }),
    ).toThrowError(
      expect.objectContaining<SisApplicationServiceError>({
        code: 'SIS_AUTHORIZATION_STEP_UP_REQUIRED',
      }),
    );
    expect(() => service.listApplications(context(registrarId, 'aal2', tenantB))).toThrowError(
      expect.objectContaining<SisApplicationServiceError>({ code: 'SIS_AUTHORIZATION_DENIED' }),
    );
    expect(() =>
      service.getGuardianApplicationStatus(
        context(guardianPrincipalId, 'aal1', tenantA, crypto.randomUUID()),
        application.applicationId,
      ),
    ).toThrow('Guardian application access was denied');
  });

  it('executes direct profile and enrollment lifecycle commands through the permission boundary', () => {
    const { service } = setupService();
    const registrar = context();
    const person = service.createPerson(registrar, {
      names: [
        {
          usage: 'legal',
          givenName: 'Omar',
          familyName: 'Khan',
          effectiveFrom: '2026-01-01',
        },
      ],
    });
    const profile = service.createStudentProfile(registrar, {
      personId: person.personId,
      effectiveFrom: '2026-01-01',
    });
    const active = service.changeStudentStatus(registrar, {
      studentProfileId: profile.studentProfileId,
      status: 'active',
      effectiveFrom: '2026-02-01',
      reasonCode: 'direct-enrollment',
    });
    service.assignProfileIdentifier(registrar, {
      profileKind: 'student',
      profileId: active.studentProfileId,
      identifierType: 'student-number',
      value: 'S-2001',
      effectiveFrom: '2026-02-01',
    });
    const source = service.createEnrollment(registrar, {
      idempotencyKey: 'direct-enrollment-1',
      studentProfileId: active.studentProfileId,
      campusId: '80000000-0000-4000-8000-000000000001',
      programId: '81000000-0000-4000-8000-000000000001',
      academicYearId: '82000000-0000-4000-8000-000000000001',
      effectiveFrom: '2026-02-01',
      status: 'active',
    });
    const transfer = service.transferEnrollment(registrar, {
      sourceEnrollmentId: source.enrollmentId,
      idempotencyKey: 'direct-transfer-1',
      destinationCampusId: '80000000-0000-4000-8000-000000000002',
      transferDate: '2026-06-01',
      reasonCode: 'campus-transfer',
    });
    service.withdrawEnrollment(registrar, {
      enrollmentId: transfer.destinationEnrollmentId,
      withdrawalDate: '2026-07-01',
      reasonCode: 'family-relocation',
    });

    expect(service.getStudentProfile(registrar, profile.studentProfileId)).toMatchObject({
      status: 'active',
      identifiers: [expect.objectContaining({ value: 'S-2001' })],
    });
    expect(
      service.getProfileAccessEffect(registrar, 'student', profile.studentProfileId),
    ).toMatchObject({
      interactiveAccess: 'enabled',
      guardianPortalVisibility: 'visible',
    });
    expect(service.getEnrollmentHistory(registrar, profile.studentProfileId)).toHaveLength(2);
    expect(service.listCurrentEnrollments(registrar, '2026-07-02')).toHaveLength(0);
  });

  it('applies validated person imports and creates field-allowlisted exports', async () => {
    const { service } = setupService();
    const registrar = context();
    const batch = service.stageImport(registrar, {
      entity: 'person',
      idempotencyKey: 'people-import-api-1',
      mappings: [
        { sourceColumn: 'first_name', targetField: 'givenName', required: true, transform: 'trim' },
        { sourceColumn: 'last_name', targetField: 'familyName', required: true, transform: 'trim' },
        { sourceColumn: 'email', targetField: 'email', transform: 'lowercase' },
      ],
      rows: [
        {
          rowNumber: 1,
          sourceKey: 'legacy-1',
          values: {
            first_name: ' Amina ',
            last_name: ' Rahman ',
            email: 'AMINA@EXAMPLE.TEST',
          },
        },
      ],
    });
    const applied = await service.applyPeopleImport(registrar, batch.importBatchId);
    const exported = service.exportPeople(registrar, {
      fields: ['personId', 'status', 'contacts'],
      purpose: 'Registrar reconciliation',
    });

    expect(applied.status).toBe('completed');
    expect(applied.rows[0]?.status).toBe('applied');
    expect(service.searchPeople(registrar, 'amina@example.test')).toHaveLength(1);
    expect(exported).toHaveLength(1);
    expect(exported[0]).toEqual(
      expect.objectContaining({
        status: 'active',
        contacts: [{ kind: 'email', value: 'amina@example.test', primary: true }],
      }),
    );
    expect(exported[0]).not.toHaveProperty('dateOfBirth');
  });
});
