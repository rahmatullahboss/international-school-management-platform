import type { AssuranceLevel, AuthorizationDecision, AuthorizationRequest } from '@school/policy';

import {
  PeopleDirectory,
  type ContactPointInput,
  type CreatePersonInput,
  type GuardianAuthorityInput,
  type HouseholdMemberInput,
  type PersonIdentifierInput,
  type PersonNameInput,
  type PersonRecord,
} from '../../people/src/domain.js';
import {
  ImportPipeline,
  createPrivacyAwareExport,
  type ExportPermission,
  type ImportBatch,
  type ImportColumnMapping,
  type ImportRow,
} from '../../people/src/imports.js';
import {
  EnrollmentRegistry,
  type EnrollmentRecord,
} from '../../student-lifecycle/src/enrollment.js';
import { ProfileRegistry, type StudentProfile } from '../../student-lifecycle/src/profiles.js';
import {
  AdmissionsRegistry,
  type AdmissionOffer,
  type AdmissionsCycle,
  type Application,
  type ChecklistItem,
  type FormVersion,
  type ListApplicationsOptions,
} from './domain.js';

export const sisPermissions = [
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
  'sis.family.application.read',
  'sis.family.contract.sign',
] as const;

export type SisPermission = (typeof sisPermissions)[number];

export const sisApplicationServiceContract = Object.freeze({
  version: 'v1',
  permissions: sisPermissions,
  boundaries: Object.freeze({
    tenantScoped: true,
    permissionChecked: true,
    authenticatedActorDerived: true,
    registriesPrivate: true,
  }),
});

export interface SisRequestContext {
  tenantId: string;
  principalId: string;
  assurance: AssuranceLevel;
  correlationId: string;
  campusId?: string;
  personId?: string;
}

export interface SisAuthorizationPort {
  authorize(request: AuthorizationRequest): AuthorizationDecision;
}

export interface SisApplicationServiceDependencies {
  authorizer: SisAuthorizationPort;
}

export interface ApplicantConversionResult {
  application: Application;
  studentProfile: StudentProfile;
  enrollment: EnrollmentRecord;
}

export class SisApplicationServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SisApplicationServiceError';
  }
}

function requiredString(
  values: Readonly<Record<string, unknown>>,
  field: string,
  code: string,
): string {
  const value = values[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new SisApplicationServiceError(code, `${field} is required`);
  }
  return value.trim();
}

function sameStringRecord(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        key === rightEntries[index]?.[0] && value === rightEntries[index]?.[1],
    )
  );
}

export class SisApplicationService {
  readonly #people: PeopleDirectory;
  readonly #admissions: AdmissionsRegistry;
  readonly #profiles: ProfileRegistry;
  readonly #enrollments: EnrollmentRegistry;
  readonly #imports: ImportPipeline;
  readonly #authorizer: SisAuthorizationPort;

  constructor(dependencies: SisApplicationServiceDependencies) {
    this.#authorizer = dependencies.authorizer;
    this.#people = new PeopleDirectory();
    this.#admissions = new AdmissionsRegistry();
    this.#profiles = new ProfileRegistry();
    this.#enrollments = new EnrollmentRegistry();
    this.#imports = new ImportPipeline();
  }

  createPerson(
    context: SisRequestContext,
    input: Omit<CreatePersonInput, 'tenantId' | 'correlationId'>,
  ): PersonRecord {
    this.#require(context, 'sis.people.manage');
    return this.#people.createPerson({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    }).value;
  }

  addPersonName(context: SisRequestContext, personId: string, name: PersonNameInput): PersonRecord {
    this.#require(context, 'sis.people.manage');
    return this.#people.addPersonName(context.tenantId, personId, name);
  }

  addIdentifier(
    context: SisRequestContext,
    personId: string,
    identifier: PersonIdentifierInput,
  ): PersonRecord {
    this.#require(context, 'sis.people.manage');
    return this.#people.addIdentifier(context.tenantId, personId, identifier);
  }

  addContactPoint(
    context: SisRequestContext,
    personId: string,
    contact: ContactPointInput,
  ): PersonRecord {
    this.#require(context, 'sis.people.manage');
    return this.#people.addContactPoint(context.tenantId, personId, contact);
  }

  getPerson(context: SisRequestContext, personId: string): PersonRecord {
    this.#require(context, 'sis.people.read');
    return this.#people.getPerson(context.tenantId, personId);
  }

  searchPeople(context: SisRequestContext, query = '', limit = 50): readonly PersonRecord[] {
    this.#require(context, 'sis.people.read');
    return this.#people.searchPeople(context.tenantId, { query, limit });
  }

  createHousehold(
    context: SisRequestContext,
    displayName: string,
    members: readonly HouseholdMemberInput[],
  ) {
    this.#require(context, 'sis.people.manage');
    return this.#people.createHousehold(context.tenantId, displayName, members);
  }

  setGuardianAuthority(
    context: SisRequestContext,
    input: Omit<GuardianAuthorityInput, 'tenantId' | 'correlationId'>,
  ) {
    this.#require(context, 'sis.guardian.manage');
    return this.#people.setGuardianAuthority({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    }).value;
  }

  getHousehold(context: SisRequestContext, householdId: string) {
    this.#require(context, 'sis.people.read');
    return this.#people.getHousehold(context.tenantId, householdId);
  }

  listStudentGuardians(context: SisRequestContext, studentPersonId: string, at: string) {
    this.#require(context, 'sis.people.read');
    return this.#people.listStudentGuardians(context.tenantId, studentPersonId, at);
  }

  recordConsent(
    context: SisRequestContext,
    input: Omit<Parameters<PeopleDirectory['recordConsent']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.guardian.manage');
    this.#people.getPerson(context.tenantId, input.subjectPersonId);
    this.#people.getPerson(context.tenantId, input.grantedByPersonId);
    if (
      input.grantedByPersonId !== input.subjectPersonId &&
      !this.#people.canGuardian(
        context.tenantId,
        input.grantedByPersonId,
        input.subjectPersonId,
        'legal',
        input.effectiveFrom,
      )
    ) {
      throw new SisApplicationServiceError(
        'SIS_CONSENT_GRANTOR_UNAUTHORIZED',
        'Consent grantor lacks verified legal authority for the subject',
      );
    }
    return this.#people.recordConsent({ ...input, tenantId: context.tenantId });
  }

  listDuplicateCandidates(context: SisRequestContext, minimumScore = 50) {
    this.#require(context, 'sis.people.read');
    return this.#people.findDuplicateCandidates(context.tenantId, minimumScore);
  }

  mergePeople(
    context: SisRequestContext,
    survivingPersonId: string,
    mergedPersonId: string,
    reason: string,
  ) {
    this.#require(context, 'sis.people.manage');
    return this.#people.mergePeople(
      context.tenantId,
      survivingPersonId,
      mergedPersonId,
      reason,
      context.correlationId,
    ).value;
  }

  createAdmissionsCycle(
    context: SisRequestContext,
    input: Omit<AdmissionsCycle, 'tenantId' | 'cycleId'>,
  ): AdmissionsCycle {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.createCycle({ ...input, tenantId: context.tenantId });
  }

  publishApplicationForm(
    context: SisRequestContext,
    input: { formKey: string; schema: Readonly<Record<string, unknown>> },
  ): FormVersion {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.publishFormVersion({ ...input, tenantId: context.tenantId });
  }

  createEnquiry(
    context: SisRequestContext,
    input: Omit<Parameters<AdmissionsRegistry['createEnquiry']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.admissions.manage');
    this.#people.getPerson(context.tenantId, input.contactPersonId);
    if (input.prospectiveStudentPersonId !== undefined) {
      this.#people.getPerson(context.tenantId, input.prospectiveStudentPersonId);
    }
    return this.#admissions.createEnquiry({ ...input, tenantId: context.tenantId });
  }

  startApplication(
    context: SisRequestContext,
    input: {
      applicationNumber: string;
      cycleId: string;
      applicantPersonId: string;
      submittingGuardianPersonId: string;
      programChoiceIds: readonly string[];
      formVersionId: string;
      initialAnswers?: Readonly<Record<string, unknown>>;
    },
  ): Application {
    this.#require(context, 'sis.admissions.manage');
    this.#people.getPerson(context.tenantId, input.applicantPersonId);
    this.#people.getPerson(context.tenantId, input.submittingGuardianPersonId);
    const at = new Date().toISOString().slice(0, 10);
    const authorizedGuardian =
      this.#people.canGuardian(
        context.tenantId,
        input.submittingGuardianPersonId,
        input.applicantPersonId,
        'legal',
        at,
      ) ||
      this.#people.canGuardian(
        context.tenantId,
        input.submittingGuardianPersonId,
        input.applicantPersonId,
        'education',
        at,
      );
    if (!authorizedGuardian) {
      throw new SisApplicationServiceError(
        'SIS_SUBMITTING_GUARDIAN_UNAUTHORIZED',
        'Submitting guardian lacks verified legal or education authority',
      );
    }
    return this.#admissions.startApplication({ ...input, tenantId: context.tenantId });
  }

  amendApplication(
    context: SisRequestContext,
    applicationId: string,
    answers: Readonly<Record<string, unknown>>,
  ) {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.amendApplication({
      tenantId: context.tenantId,
      applicationId,
      answers,
    });
  }

  addChecklistRequirement(
    context: SisRequestContext,
    applicationId: string,
    input: { requirementKey: string; label: string; required: boolean },
  ): ChecklistItem {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.addChecklistRequirement({
      ...input,
      tenantId: context.tenantId,
      applicationId,
    });
  }

  updateChecklist(
    context: SisRequestContext,
    applicationId: string,
    input: { checklistItemId: string; status: ChecklistItem['status']; documentId?: string },
  ): ChecklistItem {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.updateChecklist({
      ...input,
      tenantId: context.tenantId,
      applicationId,
    });
  }

  submitApplication(context: SisRequestContext, applicationId: string): Application {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.submitApplication({
      tenantId: context.tenantId,
      applicationId,
      correlationId: context.correlationId,
    }).value;
  }

  recordReview(
    context: SisRequestContext,
    applicationId: string,
    input: Omit<
      Parameters<AdmissionsRegistry['recordReview']>[0],
      'tenantId' | 'applicationId' | 'reviewerAccountId'
    >,
  ) {
    this.#require(context, 'sis.admissions.review');
    return this.#admissions.recordReview({
      ...input,
      tenantId: context.tenantId,
      applicationId,
      reviewerAccountId: context.principalId,
    });
  }

  scheduleInterview(
    context: SisRequestContext,
    applicationId: string,
    input: Omit<
      Parameters<AdmissionsRegistry['scheduleInterview']>[0],
      'tenantId' | 'applicationId'
    >,
  ) {
    this.#require(context, 'sis.admissions.review');
    return this.#admissions.scheduleInterview({
      ...input,
      tenantId: context.tenantId,
      applicationId,
    });
  }

  completeInterview(
    context: SisRequestContext,
    applicationId: string,
    input: Omit<
      Parameters<AdmissionsRegistry['completeInterview']>[0],
      'tenantId' | 'applicationId'
    >,
  ) {
    this.#require(context, 'sis.admissions.review');
    return this.#admissions.completeInterview({
      ...input,
      tenantId: context.tenantId,
      applicationId,
    });
  }

  recordDecision(
    context: SisRequestContext,
    applicationId: string,
    input: {
      decision: 'admit' | 'waitlist' | 'decline';
      reasonCode: string;
    },
  ): Application {
    this.#require(context, 'sis.admissions.review');
    this.#admissions.recordDecision({
      tenantId: context.tenantId,
      applicationId,
      decision: input.decision,
      reasonCode: input.reasonCode,
      decidedByAccountId: context.principalId,
      correlationId: context.correlationId,
    });
    return this.#admissions.getApplication(context.tenantId, applicationId);
  }

  issueOffer(
    context: SisRequestContext,
    applicationId: string,
    input: {
      programId: string;
      campusId: string;
      academicYearId: string;
      gradeLevelId?: string;
      expiresAt: string;
    },
  ): AdmissionOffer {
    this.#require(context, 'sis.admissions.manage', input.campusId);
    return this.#admissions.issueOffer({
      ...input,
      tenantId: context.tenantId,
      applicationId,
    });
  }

  issueContract(
    context: SisRequestContext,
    applicationId: string,
    input: { templateVersion: string; documentId: string },
  ) {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.issueContract({
      ...input,
      tenantId: context.tenantId,
      applicationId,
    });
  }

  signContract(context: SisRequestContext, applicationId: string) {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.signContract({
      tenantId: context.tenantId,
      applicationId,
      signedByAccountId: context.principalId,
      ...(context.personId === undefined ? {} : { signedByPersonId: context.personId }),
    });
  }

  signContractAsGuardian(context: SisRequestContext, applicationId: string) {
    this.#require(context, 'sis.family.contract.sign');
    if (!context.personId) {
      throw new SisApplicationServiceError(
        'SIS_PERSON_CONTEXT_REQUIRED',
        'Guardian person context is required',
      );
    }
    const application = this.#admissions.getApplication(context.tenantId, applicationId);
    const at = new Date().toISOString().slice(0, 10);
    const authorized =
      application.submittingGuardianPersonId === context.personId &&
      (this.#people.canGuardian(
        context.tenantId,
        context.personId,
        application.applicantPersonId,
        'legal',
        at,
      ) ||
        this.#people.canGuardian(
          context.tenantId,
          context.personId,
          application.applicantPersonId,
          'education',
          at,
        ));
    if (!authorized) {
      throw new SisApplicationServiceError(
        'SIS_GUARDIAN_CONTRACT_SIGN_DENIED',
        'Guardian contract signing authority was denied',
      );
    }
    return this.#admissions.signContract({
      tenantId: context.tenantId,
      applicationId,
      signedByAccountId: context.principalId,
      signedByPersonId: context.personId,
    });
  }

  acceptOffer(context: SisRequestContext, applicationId: string): AdmissionOffer {
    this.#require(context, 'sis.admissions.manage');
    return this.#admissions.acceptOffer({
      tenantId: context.tenantId,
      applicationId,
      correlationId: context.correlationId,
    }).value;
  }

  getApplication(context: SisRequestContext, applicationId: string): Application {
    this.#require(context, 'sis.admissions.read');
    return this.#admissions.getApplication(context.tenantId, applicationId);
  }

  listApplications(
    context: SisRequestContext,
    options: ListApplicationsOptions = {},
  ): readonly Application[] {
    this.#require(context, 'sis.admissions.read');
    return this.#admissions.listApplications(context.tenantId, options);
  }

  getChecklistReconciliation(context: SisRequestContext, applicationId: string) {
    this.#require(context, 'sis.admissions.read');
    return this.#admissions.getChecklistReconciliation(context.tenantId, applicationId);
  }

  getGuardianApplicationStatus(context: SisRequestContext, applicationId: string) {
    this.#require(context, 'sis.family.application.read');
    if (!context.personId) {
      throw new SisApplicationServiceError(
        'SIS_PERSON_CONTEXT_REQUIRED',
        'Guardian person context is required',
      );
    }
    const application = this.#admissions.getApplication(context.tenantId, applicationId);
    const hasAuthority = this.#people.canGuardian(
      context.tenantId,
      context.personId,
      application.applicantPersonId,
      'portal',
      new Date().toISOString().slice(0, 10),
    );
    if (!hasAuthority) {
      throw new SisApplicationServiceError(
        'SIS_GUARDIAN_APPLICATION_ACCESS_DENIED',
        'Guardian application access was denied',
      );
    }
    return this.#admissions.getGuardianApplicationStatus(
      context.tenantId,
      applicationId,
      context.personId,
    );
  }

  createStudentProfile(
    context: SisRequestContext,
    input: Omit<
      Parameters<ProfileRegistry['createStudentProfile']>[0],
      'tenantId' | 'correlationId'
    >,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    this.#people.getPerson(context.tenantId, input.personId);
    return this.#profiles.createStudentProfile({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    }).value;
  }

  createStaffProfile(
    context: SisRequestContext,
    input: Omit<Parameters<ProfileRegistry['createStaffProfile']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    this.#people.getPerson(context.tenantId, input.personId);
    return this.#profiles.createStaffProfile({ ...input, tenantId: context.tenantId });
  }

  changeStudentStatus(
    context: SisRequestContext,
    input: Omit<Parameters<ProfileRegistry['changeStudentStatus']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#profiles.changeStudentStatus({ ...input, tenantId: context.tenantId });
  }

  changeStaffStatus(
    context: SisRequestContext,
    input: Omit<Parameters<ProfileRegistry['changeStaffStatus']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#profiles.changeStaffStatus({ ...input, tenantId: context.tenantId });
  }

  assignProfileIdentifier(
    context: SisRequestContext,
    input: Omit<Parameters<ProfileRegistry['assignIdentifier']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#profiles.assignIdentifier({ ...input, tenantId: context.tenantId });
  }

  attachProfileDocument(
    context: SisRequestContext,
    input: Omit<Parameters<ProfileRegistry['attachDocument']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#profiles.attachDocument({ ...input, tenantId: context.tenantId });
  }

  getStudentProfile(context: SisRequestContext, studentProfileId: string) {
    this.#require(context, 'sis.enrollment.read');
    return this.#profiles.getStudent(context.tenantId, studentProfileId);
  }

  getStaffProfile(context: SisRequestContext, staffProfileId: string) {
    this.#require(context, 'sis.enrollment.read');
    return this.#profiles.getStaff(context.tenantId, staffProfileId);
  }

  getProfileAccessEffect(
    context: SisRequestContext,
    profileKind: 'student' | 'staff',
    profileId: string,
  ) {
    this.#require(context, 'sis.enrollment.read');
    return this.#profiles.accessEffect(context.tenantId, profileKind, profileId);
  }

  convertAcceptedApplication(
    context: SisRequestContext,
    input: {
      applicationId: string;
      idempotencyKey: string;
      effectiveFrom: string;
      fieldMapping?: Readonly<Record<string, string>>;
    },
  ): ApplicantConversionResult {
    this.#require(context, 'sis.admissions.convert');
    this.#require(context, 'sis.enrollment.manage');
    const application = this.#admissions.getApplication(context.tenantId, input.applicationId);
    const fieldMapping = input.fieldMapping ?? {
      applicantPersonId: 'studentProfile.personId',
      offer: 'enrollment.placement',
    };
    const replay = this.#admissions.resolveApplicantConversionReplay(
      context.tenantId,
      input.applicationId,
      input.idempotencyKey,
    );
    if (replay) {
      const replayEnrollment = this.#enrollments.getEnrollment(
        context.tenantId,
        replay.enrollmentId,
      );
      if (
        replayEnrollment.effectiveFrom !== input.effectiveFrom ||
        !sameStringRecord(replay.fieldMapping, fieldMapping)
      ) {
        throw new SisApplicationServiceError(
          'SIS_CONVERSION_IDEMPOTENCY_CONFLICT',
          'Conversion retry does not match the original request',
        );
      }
      return {
        application,
        studentProfile: this.#profiles.getStudent(context.tenantId, replay.studentProfileId),
        enrollment: replayEnrollment,
      };
    }
    const offer = application.offer;
    if (!offer || offer.status !== 'accepted') {
      throw new SisApplicationServiceError(
        'SIS_APPLICATION_NOT_CONVERTIBLE',
        'Application must have an accepted offer',
      );
    }
    const prospectiveFrom = application.createdAt.slice(0, 10);
    if (input.effectiveFrom <= prospectiveFrom) {
      throw new SisApplicationServiceError(
        'SIS_CONVERSION_EFFECTIVE_DATE_INVALID',
        'Enrollment must begin after the prospective profile start date',
      );
    }
    const studentProfile = this.#profiles.createStudentProfile({
      tenantId: context.tenantId,
      personId: application.applicantPersonId,
      effectiveFrom: prospectiveFrom,
      correlationId: context.correlationId,
    }).value;
    const activeProfile = this.#profiles.changeStudentStatus({
      tenantId: context.tenantId,
      studentProfileId: studentProfile.studentProfileId,
      status: 'active',
      effectiveFrom: input.effectiveFrom,
      reasonCode: 'admissions-conversion',
    });
    const enrollment = this.#enrollments.createEnrollment({
      tenantId: context.tenantId,
      idempotencyKey: `${input.idempotencyKey}:enrollment`,
      studentProfileId: activeProfile.studentProfileId,
      campusId: offer.campusId,
      programId: offer.programId,
      academicYearId: offer.academicYearId,
      ...(offer.gradeLevelId === undefined ? {} : { gradeLevelId: offer.gradeLevelId }),
      effectiveFrom: input.effectiveFrom,
      sourceApplicationId: application.applicationId,
      status: 'active',
      correlationId: context.correlationId,
    }).value;
    this.#admissions.convertApplicant({
      tenantId: context.tenantId,
      applicationId: application.applicationId,
      idempotencyKey: input.idempotencyKey,
      studentProfileId: activeProfile.studentProfileId,
      enrollmentId: enrollment.enrollmentId,
      fieldMapping,
      convertedByAccountId: context.principalId,
      correlationId: context.correlationId,
    });
    return {
      application: this.#admissions.getApplication(context.tenantId, application.applicationId),
      studentProfile: this.#profiles.getStudent(context.tenantId, activeProfile.studentProfileId),
      enrollment: this.#enrollments.getEnrollment(context.tenantId, enrollment.enrollmentId),
    };
  }

  createEnrollment(
    context: SisRequestContext,
    input: Omit<
      Parameters<EnrollmentRegistry['createEnrollment']>[0],
      'tenantId' | 'correlationId'
    >,
  ) {
    this.#require(context, 'sis.enrollment.manage', input.campusId);
    return this.#enrollments.createEnrollment({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    }).value;
  }

  transferEnrollment(
    context: SisRequestContext,
    input: Omit<
      Parameters<EnrollmentRegistry['transferEnrollment']>[0],
      'tenantId' | 'correlationId'
    >,
  ) {
    this.#require(context, 'sis.enrollment.manage', input.destinationCampusId);
    return this.#enrollments.transferEnrollment({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    }).value;
  }

  withdrawEnrollment(
    context: SisRequestContext,
    input: Omit<
      Parameters<EnrollmentRegistry['withdrawEnrollment']>[0],
      'tenantId' | 'correlationId'
    >,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#enrollments.withdrawEnrollment({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    }).value;
  }

  promoteStudent(
    context: SisRequestContext,
    input: Omit<Parameters<EnrollmentRegistry['promoteStudent']>[0], 'tenantId' | 'correlationId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#enrollments.promoteStudent({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    });
  }

  reEnrollStudent(
    context: SisRequestContext,
    input: Omit<Parameters<EnrollmentRegistry['reEnrollStudent']>[0], 'tenantId' | 'correlationId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage', input.campusId);
    return this.#enrollments.reEnrollStudent({
      ...input,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    });
  }

  recordPreviousSchool(
    context: SisRequestContext,
    input: Omit<Parameters<EnrollmentRegistry['recordPreviousSchool']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#enrollments.recordPreviousSchool({ ...input, tenantId: context.tenantId });
  }

  transitionToAlumni(
    context: SisRequestContext,
    input: Omit<Parameters<EnrollmentRegistry['transitionToAlumni']>[0], 'tenantId'>,
  ) {
    this.#require(context, 'sis.enrollment.manage');
    return this.#enrollments.transitionToAlumni({ ...input, tenantId: context.tenantId });
  }

  listCurrentEnrollments(context: SisRequestContext, at: string) {
    this.#require(context, 'sis.enrollment.read');
    return this.#enrollments.currentEnrollments(context.tenantId, at);
  }

  getEnrollmentHistory(
    context: SisRequestContext,
    studentProfileId: string,
  ): readonly EnrollmentRecord[] {
    this.#require(context, 'sis.enrollment.read');
    return this.#enrollments.getEnrollmentHistory(context.tenantId, studentProfileId);
  }

  stageImport(
    context: SisRequestContext,
    input: {
      entity: 'person';
      idempotencyKey: string;
      mappings: readonly ImportColumnMapping[];
      rows: readonly ImportRow[];
      dryRun?: boolean;
    },
  ): ImportBatch {
    this.#require(context, 'sis.import.manage');
    return this.#imports.stage({ ...input, tenantId: context.tenantId });
  }

  async applyPeopleImport(context: SisRequestContext, importBatchId: string): Promise<ImportBatch> {
    this.#require(context, 'sis.import.manage');
    return this.#imports.apply(context.tenantId, importBatchId, (entity, values) => {
      if (entity !== 'person') {
        throw new SisApplicationServiceError(
          'SIS_IMPORT_ENTITY_UNSUPPORTED',
          'This application service currently applies person imports only',
        );
      }
      const givenName = requiredString(values, 'givenName', 'SIS_IMPORT_GIVEN_NAME_REQUIRED');
      const familyName = requiredString(values, 'familyName', 'SIS_IMPORT_FAMILY_NAME_REQUIRED');
      const dateOfBirth = values.dateOfBirth;
      const email = values.email;
      const names: PersonNameInput[] = [
        {
          usage: 'legal',
          givenName,
          familyName,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        },
      ];
      const contacts: ContactPointInput[] =
        typeof email === 'string' && email.trim()
          ? [{ kind: 'email', value: email.trim(), primary: true }]
          : [];
      const person = this.#people.createPerson({
        tenantId: context.tenantId,
        names,
        ...(typeof dateOfBirth === 'string' ? { dateOfBirth } : {}),
        contacts,
        correlationId: context.correlationId,
      }).value;
      return Promise.resolve({ resultReference: person.personId });
    });
  }

  exportPeople(
    context: SisRequestContext,
    permission: ExportPermission,
    query = '',
  ): readonly Readonly<Record<string, unknown>>[] {
    this.#require(context, 'sis.export.read');
    const records = this.#people
      .searchPeople(context.tenantId, { query, limit: 100 })
      .map((person) => ({
        personId: person.personId,
        status: person.status,
        names: person.names,
        identifiers: person.identifiers,
        contacts: person.contacts,
        addresses: person.addresses,
        dateOfBirth: person.dateOfBirth,
      }));
    return createPrivacyAwareExport(records, permission);
  }

  #require(context: SisRequestContext, permission: SisPermission, campusId?: string): void {
    const decision = this.#authorizer.authorize({
      principalId: context.principalId,
      tenantId: context.tenantId,
      ...((campusId ?? context.campusId) ? { campusId: campusId ?? context.campusId } : {}),
      permission,
      assurance: context.assurance,
    });
    if (!decision.allowed) {
      throw new SisApplicationServiceError(
        decision.reason === 'step-up-required'
          ? 'SIS_AUTHORIZATION_STEP_UP_REQUIRED'
          : 'SIS_AUTHORIZATION_DENIED',
        'The requested SIS operation is not permitted',
      );
    }
  }
}
