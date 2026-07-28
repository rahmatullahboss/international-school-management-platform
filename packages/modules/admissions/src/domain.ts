import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

import type { ApplicationStatus } from './contracts.js';

export interface AdmissionsCycle {
  tenantId: string;
  cycleId: string;
  name: string;
  opensAt: string;
  closesAt: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
}

export interface FormVersion {
  tenantId: string;
  formVersionId: string;
  formKey: string;
  version: number;
  schema: Readonly<Record<string, unknown>>;
  publishedAt: string;
}

export interface Enquiry {
  tenantId: string;
  enquiryId: string;
  contactPersonId: string;
  prospectiveStudentPersonId?: string;
  cycleId?: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'closed';
  createdAt: string;
}

export interface ApplicationResponseVersion {
  responseVersionId: string;
  version: number;
  answers: Readonly<Record<string, unknown>>;
  submitted: boolean;
  createdAt: string;
  supersedesResponseVersionId?: string;
}

export interface ChecklistItem {
  checklistItemId: string;
  requirementKey: string;
  label: string;
  required: boolean;
  status: 'pending' | 'received' | 'verified' | 'waived' | 'rejected';
  documentId?: string;
  verifiedAt?: string;
}

export interface ApplicationReview {
  reviewId: string;
  reviewerAccountId: string;
  recommendation: 'admit' | 'waitlist' | 'decline' | 'more-information';
  score?: number;
  notes?: string;
  confidential: boolean;
  recordedAt: string;
}

export interface InterviewEvent {
  interviewId: string;
  scheduledAt: string;
  campusId?: string;
  interviewerAccountIds: readonly string[];
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  outcome?: string;
}

export interface AdmissionsDecision {
  decisionId: string;
  decision: 'admit' | 'waitlist' | 'decline';
  reasonCode: string;
  decidedByAccountId: string;
  decidedAt: string;
}

export interface AdmissionOffer {
  offerId: string;
  programId: string;
  campusId: string;
  academicYearId: string;
  gradeLevelId?: string;
  expiresAt: string;
  status: 'issued' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  acceptedAt?: string;
}

export interface EnrollmentContract {
  contractId: string;
  templateVersion: string;
  documentId: string;
  status: 'issued' | 'signed' | 'void';
  signedAt?: string;
  signedByAccountId?: string;
  signedByPersonId?: string;
}

export interface DepositReference {
  depositReferenceId: string;
  externalBillingReference: string;
  status: 'pending' | 'confirmed' | 'waived' | 'refunded';
  amountMinor?: number;
  currency?: string;
}

export interface ApplicantConversion {
  conversionId: string;
  applicationId: string;
  studentProfileId: string;
  enrollmentId: string;
  fieldMapping: Readonly<Record<string, string>>;
  convertedByAccountId: string;
  convertedAt: string;
}

export interface Application {
  tenantId: string;
  applicationId: string;
  applicationNumber: string;
  cycleId: string;
  applicantPersonId: string;
  submittingGuardianPersonId: string;
  programChoiceIds: readonly string[];
  formVersionId: string;
  status: ApplicationStatus;
  version: number;
  responseVersions: readonly ApplicationResponseVersion[];
  checklist: readonly ChecklistItem[];
  reviews: readonly ApplicationReview[];
  interviews: readonly InterviewEvent[];
  decision?: AdmissionsDecision;
  offer?: AdmissionOffer;
  contract?: EnrollmentContract;
  depositReference?: DepositReference;
  conversion?: ApplicantConversion;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface MutableApplication extends Omit<
  Application,
  'responseVersions' | 'checklist' | 'reviews' | 'interviews'
> {
  responseVersions: ApplicationResponseVersion[];
  checklist: ChecklistItem[];
  reviews: ApplicationReview[];
  interviews: InterviewEvent[];
}

export interface AdmissionsCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export interface ListApplicationsOptions {
  status?: ApplicationStatus;
  cycleId?: string;
  applicantPersonId?: string;
  limit?: number;
}

export interface ChecklistReconciliation {
  applicationId: string;
  required: number;
  completed: number;
  pendingRequirementKeys: readonly string[];
  rejectedRequirementKeys: readonly string[];
  complete: boolean;
}

export class AdmissionsDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdmissionsDomainError';
  }
}

function cloneApplication(application: MutableApplication): Application {
  return {
    ...application,
    programChoiceIds: [...application.programChoiceIds],
    responseVersions: application.responseVersions.map((response) => ({
      ...response,
      answers: { ...response.answers },
    })),
    checklist: application.checklist.map((item) => ({ ...item })),
    reviews: application.reviews.map((review) => ({ ...review })),
    interviews: application.interviews.map((interview) => ({
      ...interview,
      interviewerAccountIds: [...interview.interviewerAccountIds],
    })),
    ...(application.decision === undefined ? {} : { decision: { ...application.decision } }),
    ...(application.offer === undefined ? {} : { offer: { ...application.offer } }),
    ...(application.contract === undefined ? {} : { contract: { ...application.contract } }),
    ...(application.depositReference === undefined
      ? {}
      : { depositReference: { ...application.depositReference } }),
    ...(application.conversion === undefined
      ? {}
      : {
          conversion: {
            ...application.conversion,
            fieldMapping: { ...application.conversion.fieldMapping },
          },
        }),
  };
}

function requireNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new AdmissionsDomainError(code, 'A required value was empty');
  return normalized;
}

export class AdmissionsRegistry {
  readonly #cycles = new Map<string, AdmissionsCycle>();
  readonly #forms = new Map<string, FormVersion>();
  readonly #formVersionsByKey = new Map<string, number>();
  readonly #enquiries = new Map<string, Enquiry>();
  readonly #applications = new Map<string, MutableApplication>();
  readonly #applicationNumbers = new Set<string>();
  readonly #conversionByApplication = new Map<string, ApplicantConversion>();
  readonly #conversionByIdempotency = new Map<string, ApplicantConversion>();
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createCycle(input: Omit<AdmissionsCycle, 'cycleId'>): AdmissionsCycle {
    if (input.closesAt <= input.opensAt) {
      throw new AdmissionsDomainError(
        'SIS_ADMISSIONS_CYCLE_PERIOD_INVALID',
        'Cycle period is invalid',
      );
    }
    const cycle: AdmissionsCycle = { ...input, cycleId: crypto.randomUUID() };
    this.#cycles.set(cycle.cycleId, cycle);
    return { ...cycle };
  }

  publishFormVersion(input: {
    tenantId: string;
    formKey: string;
    schema: Readonly<Record<string, unknown>>;
  }): FormVersion {
    const key = `${input.tenantId}:${requireNonEmpty(input.formKey, 'SIS_FORM_KEY_REQUIRED')}`;
    const version = (this.#formVersionsByKey.get(key) ?? 0) + 1;
    const form: FormVersion = Object.freeze({
      tenantId: input.tenantId,
      formVersionId: crypto.randomUUID(),
      formKey: input.formKey,
      version,
      schema: Object.freeze({ ...input.schema }),
      publishedAt: new Date().toISOString(),
    });
    this.#forms.set(form.formVersionId, form);
    this.#formVersionsByKey.set(key, version);
    return { ...form, schema: { ...form.schema } };
  }

  createEnquiry(input: Omit<Enquiry, 'enquiryId' | 'status' | 'createdAt'>): Enquiry {
    const enquiry: Enquiry = {
      ...input,
      enquiryId: crypto.randomUUID(),
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    this.#enquiries.set(enquiry.enquiryId, enquiry);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.admissions.enquiry-created',
      subjectId: enquiry.enquiryId,
    });
    return { ...enquiry };
  }

  startApplication(input: {
    tenantId: string;
    applicationNumber: string;
    cycleId: string;
    applicantPersonId: string;
    submittingGuardianPersonId: string;
    programChoiceIds: readonly string[];
    formVersionId: string;
    initialAnswers?: Readonly<Record<string, unknown>>;
  }): Application {
    const cycle = this.#cycles.get(input.cycleId);
    if (!cycle || cycle.tenantId !== input.tenantId || !['draft', 'open'].includes(cycle.status)) {
      throw new AdmissionsDomainError(
        'SIS_ADMISSIONS_CYCLE_UNAVAILABLE',
        'Admissions cycle is unavailable',
      );
    }
    const form = this.#forms.get(input.formVersionId);
    if (!form || form.tenantId !== input.tenantId) {
      throw new AdmissionsDomainError(
        'SIS_ADMISSIONS_FORM_VERSION_NOT_FOUND',
        'Form version was not found',
      );
    }
    const numberKey = `${input.tenantId}:${input.applicationNumber.trim().toLowerCase()}`;
    if (this.#applicationNumbers.has(numberKey)) {
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_NUMBER_DUPLICATE',
        'Application number already exists',
      );
    }
    if (input.programChoiceIds.length === 0) {
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_PROGRAM_REQUIRED',
        'A program choice is required',
      );
    }
    const now = new Date().toISOString();
    const application: MutableApplication = {
      tenantId: input.tenantId,
      applicationId: crypto.randomUUID(),
      applicationNumber: input.applicationNumber,
      cycleId: input.cycleId,
      applicantPersonId: input.applicantPersonId,
      submittingGuardianPersonId: input.submittingGuardianPersonId,
      programChoiceIds: [...input.programChoiceIds],
      formVersionId: input.formVersionId,
      status: 'draft',
      version: 1,
      responseVersions: [
        {
          responseVersionId: crypto.randomUUID(),
          version: 1,
          answers: Object.freeze({ ...(input.initialAnswers ?? {}) }),
          submitted: false,
          createdAt: now,
        },
      ],
      checklist: [],
      reviews: [],
      interviews: [],
      createdAt: now,
      updatedAt: now,
    };
    this.#applications.set(application.applicationId, application);
    this.#applicationNumbers.add(numberKey);
    return cloneApplication(application);
  }

  amendApplication(input: {
    tenantId: string;
    applicationId: string;
    answers: Readonly<Record<string, unknown>>;
  }): ApplicationResponseVersion {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (['withdrawn', 'converted'].includes(application.status)) {
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_NOT_AMENDABLE',
        'Application cannot be amended',
      );
    }
    const previous = application.responseVersions.at(-1);
    const response: ApplicationResponseVersion = {
      responseVersionId: crypto.randomUUID(),
      version: (previous?.version ?? 0) + 1,
      answers: Object.freeze({ ...input.answers }),
      submitted: false,
      createdAt: new Date().toISOString(),
      ...(previous === undefined
        ? {}
        : { supersedesResponseVersionId: previous.responseVersionId }),
    };
    application.responseVersions.push(response);
    application.version += 1;
    application.updatedAt = response.createdAt;
    return { ...response, answers: { ...response.answers } };
  }

  addChecklistRequirement(input: {
    tenantId: string;
    applicationId: string;
    requirementKey: string;
    label: string;
    required: boolean;
  }): ChecklistItem {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (application.checklist.some((item) => item.requirementKey === input.requirementKey)) {
      throw new AdmissionsDomainError(
        'SIS_CHECKLIST_REQUIREMENT_DUPLICATE',
        'Checklist item already exists',
      );
    }
    const item: ChecklistItem = {
      checklistItemId: crypto.randomUUID(),
      requirementKey: input.requirementKey,
      label: input.label,
      required: input.required,
      status: 'pending',
    };
    application.checklist.push(item);
    application.version += 1;
    return { ...item };
  }

  updateChecklist(input: {
    tenantId: string;
    applicationId: string;
    checklistItemId: string;
    status: ChecklistItem['status'];
    documentId?: string;
  }): ChecklistItem {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    const item = application.checklist.find(
      (candidate) => candidate.checklistItemId === input.checklistItemId,
    );
    if (!item)
      throw new AdmissionsDomainError(
        'SIS_CHECKLIST_ITEM_NOT_FOUND',
        'Checklist item was not found',
      );
    item.status = input.status;
    if (input.documentId !== undefined) item.documentId = input.documentId;
    if (input.status === 'verified' || input.status === 'waived')
      item.verifiedAt = new Date().toISOString();
    application.version += 1;
    return { ...item };
  }

  submitApplication(input: {
    tenantId: string;
    applicationId: string;
    correlationId: string;
  }): AdmissionsCommandResult<Application> {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (application.status !== 'draft') {
      if (application.status === 'submitted' || application.status === 'under-review') {
        return { value: cloneApplication(application), events: [] };
      }
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_NOT_SUBMITTABLE',
        'Application cannot be submitted',
      );
    }
    const currentResponse = application.responseVersions.at(-1);
    if (!currentResponse)
      throw new AdmissionsDomainError('SIS_APPLICATION_RESPONSE_REQUIRED', 'Response is required');
    currentResponse.submitted = true;
    application.status = 'submitted';
    application.submittedAt = new Date().toISOString();
    application.updatedAt = application.submittedAt;
    application.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.admissions.application-submitted',
      subjectId: application.applicationId,
    });
    return {
      value: cloneApplication(application),
      events: [
        createDomainEvent({
          eventType: 'sis.admissions.application-submitted.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'application',
          aggregateId: application.applicationId,
          aggregateVersion: application.version,
          correlationId: input.correlationId,
          payload: {
            applicationId: application.applicationId,
            applicantPersonId: application.applicantPersonId,
            formVersionId: application.formVersionId,
          },
        }),
      ],
    };
  }

  recordReview(
    input: Omit<ApplicationReview, 'reviewId' | 'recordedAt'> & {
      tenantId: string;
      applicationId: string;
    },
  ): ApplicationReview {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (!['submitted', 'under-review', 'waitlisted'].includes(application.status)) {
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_NOT_REVIEWABLE',
        'Application is not reviewable',
      );
    }
    const review: ApplicationReview = {
      reviewerAccountId: input.reviewerAccountId,
      recommendation: input.recommendation,
      ...(input.score === undefined ? {} : { score: input.score }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      confidential: input.confidential,
      reviewId: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
    };
    application.reviews.push(review);
    application.status = 'under-review';
    application.version += 1;
    return { ...review };
  }

  scheduleInterview(input: {
    tenantId: string;
    applicationId: string;
    scheduledAt: string;
    campusId?: string;
    interviewerAccountIds: readonly string[];
  }): InterviewEvent {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (input.interviewerAccountIds.length === 0) {
      throw new AdmissionsDomainError('SIS_INTERVIEWER_REQUIRED', 'An interviewer is required');
    }
    const interview: InterviewEvent = {
      interviewId: crypto.randomUUID(),
      scheduledAt: input.scheduledAt,
      ...(input.campusId === undefined ? {} : { campusId: input.campusId }),
      interviewerAccountIds: [...input.interviewerAccountIds],
      status: 'scheduled',
    };
    application.interviews.push(interview);
    application.version += 1;
    return { ...interview, interviewerAccountIds: [...interview.interviewerAccountIds] };
  }

  completeInterview(input: {
    tenantId: string;
    applicationId: string;
    interviewId: string;
    status: Extract<InterviewEvent['status'], 'completed' | 'cancelled' | 'no-show'>;
    outcome?: string;
  }): InterviewEvent {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    const interview = application.interviews.find(
      (candidate) => candidate.interviewId === input.interviewId,
    );
    if (!interview)
      throw new AdmissionsDomainError('SIS_INTERVIEW_NOT_FOUND', 'Interview was not found');
    interview.status = input.status;
    if (input.outcome !== undefined) interview.outcome = input.outcome;
    application.version += 1;
    return { ...interview, interviewerAccountIds: [...interview.interviewerAccountIds] };
  }

  recordDecision(input: {
    tenantId: string;
    applicationId: string;
    decision: AdmissionsDecision['decision'];
    reasonCode: string;
    decidedByAccountId: string;
    correlationId: string;
  }): AdmissionsCommandResult<AdmissionsDecision> {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (!['submitted', 'under-review', 'waitlisted'].includes(application.status)) {
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_DECISION_INVALID',
        'Decision cannot be recorded',
      );
    }
    const decision: AdmissionsDecision = {
      decisionId: crypto.randomUUID(),
      decision: input.decision,
      reasonCode: input.reasonCode,
      decidedByAccountId: input.decidedByAccountId,
      decidedAt: new Date().toISOString(),
    };
    application.decision = decision;
    application.status =
      input.decision === 'waitlist'
        ? 'waitlisted'
        : input.decision === 'decline'
          ? 'declined'
          : 'under-review';
    application.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.admissions.decision-recorded',
      subjectId: application.applicationId,
    });
    return {
      value: { ...decision },
      events: [
        createDomainEvent({
          eventType: 'sis.admissions.decision-recorded.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'application',
          aggregateId: application.applicationId,
          aggregateVersion: application.version,
          correlationId: input.correlationId,
          payload: { applicationId: application.applicationId, decision: input.decision },
        }),
      ],
    };
  }

  issueOffer(input: {
    tenantId: string;
    applicationId: string;
    programId: string;
    campusId: string;
    academicYearId: string;
    gradeLevelId?: string;
    expiresAt: string;
  }): AdmissionOffer {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (application.decision?.decision !== 'admit') {
      throw new AdmissionsDomainError(
        'SIS_OFFER_REQUIRES_ADMIT_DECISION',
        'Offer requires an admit decision',
      );
    }
    if (application.offer) {
      const existing = application.offer;
      if (
        existing.programId !== input.programId ||
        existing.campusId !== input.campusId ||
        existing.academicYearId !== input.academicYearId ||
        existing.gradeLevelId !== input.gradeLevelId ||
        existing.expiresAt !== input.expiresAt
      ) {
        throw new AdmissionsDomainError(
          'SIS_OFFER_REISSUE_CONFLICT',
          'Existing offer does not match the reissue request',
        );
      }
      return { ...existing };
    }
    const offer: AdmissionOffer = {
      offerId: crypto.randomUUID(),
      programId: input.programId,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      ...(input.gradeLevelId === undefined ? {} : { gradeLevelId: input.gradeLevelId }),
      expiresAt: input.expiresAt,
      status: 'issued',
    };
    application.offer = offer;
    application.status = 'offered';
    application.version += 1;
    return { ...offer };
  }

  issueContract(input: {
    tenantId: string;
    applicationId: string;
    templateVersion: string;
    documentId: string;
  }): EnrollmentContract {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (!application.offer)
      throw new AdmissionsDomainError('SIS_CONTRACT_REQUIRES_OFFER', 'Contract requires an offer');
    if (application.contract) {
      const existing = application.contract;
      if (
        existing.templateVersion !== input.templateVersion ||
        existing.documentId !== input.documentId
      ) {
        throw new AdmissionsDomainError(
          'SIS_CONTRACT_REISSUE_CONFLICT',
          'Existing contract does not match the reissue request',
        );
      }
      return { ...existing };
    }
    const contract: EnrollmentContract = {
      contractId: crypto.randomUUID(),
      templateVersion: input.templateVersion,
      documentId: input.documentId,
      status: 'issued',
    };
    application.contract = contract;
    application.version += 1;
    return { ...contract };
  }

  setDepositReference(input: {
    tenantId: string;
    applicationId: string;
    externalBillingReference: string;
    status: DepositReference['status'];
    amountMinor?: number;
    currency?: string;
  }): DepositReference {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    const deposit: DepositReference = {
      depositReferenceId: application.depositReference?.depositReferenceId ?? crypto.randomUUID(),
      externalBillingReference: requireNonEmpty(
        input.externalBillingReference,
        'SIS_DEPOSIT_REFERENCE_REQUIRED',
      ),
      status: input.status,
      ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
    };
    application.depositReference = deposit;
    application.version += 1;
    return { ...deposit };
  }

  acceptOffer(input: {
    tenantId: string;
    applicationId: string;
    correlationId: string;
  }): AdmissionsCommandResult<AdmissionOffer> {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    const offer = application.offer;
    if (!offer) throw new AdmissionsDomainError('SIS_OFFER_NOT_FOUND', 'Offer was not found');
    if (offer.status === 'accepted') return { value: { ...offer }, events: [] };
    if (offer.status !== 'issued' || offer.expiresAt < new Date().toISOString()) {
      throw new AdmissionsDomainError('SIS_OFFER_NOT_ACCEPTABLE', 'Offer cannot be accepted');
    }
    if (
      application.checklist.some(
        (item) => item.required && !['verified', 'waived'].includes(item.status),
      )
    ) {
      throw new AdmissionsDomainError(
        'SIS_REQUIRED_CHECKLIST_INCOMPLETE',
        'Required checklist is incomplete',
      );
    }
    if (application.contract && application.contract.status !== 'signed') {
      throw new AdmissionsDomainError(
        'SIS_CONTRACT_NOT_SIGNED',
        'Enrollment contract is not signed',
      );
    }
    offer.status = 'accepted';
    offer.acceptedAt = new Date().toISOString();
    application.status = 'accepted';
    application.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.admissions.offer-accepted',
      subjectId: offer.offerId,
    });
    return {
      value: { ...offer },
      events: [
        createDomainEvent({
          eventType: 'sis.admissions.offer-accepted.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'application',
          aggregateId: application.applicationId,
          aggregateVersion: application.version,
          correlationId: input.correlationId,
          payload: { applicationId: application.applicationId, offerId: offer.offerId },
        }),
      ],
    };
  }

  signContract(input: {
    tenantId: string;
    applicationId: string;
    signedByAccountId: string;
    signedByPersonId?: string;
  }): EnrollmentContract {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    if (!application.contract)
      throw new AdmissionsDomainError('SIS_CONTRACT_NOT_FOUND', 'Contract was not found');
    if (application.contract.status === 'signed') return { ...application.contract };
    if (application.contract.status !== 'issued') {
      throw new AdmissionsDomainError(
        'SIS_CONTRACT_NOT_SIGNABLE',
        'Only an issued contract can be signed',
      );
    }
    application.contract.status = 'signed';
    application.contract.signedAt = new Date().toISOString();
    application.contract.signedByAccountId = input.signedByAccountId;
    if (input.signedByPersonId !== undefined) {
      application.contract.signedByPersonId = input.signedByPersonId;
    }
    application.version += 1;
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.admissions.contract-signed',
      subjectId: application.contract.contractId,
    });
    return { ...application.contract };
  }

  resolveApplicantConversionReplay(
    tenantId: string,
    applicationId: string,
    idempotencyKey: string,
  ): ApplicantConversion | undefined {
    this.#requireApplication(tenantId, applicationId);
    const scopedKey = `${tenantId}:${idempotencyKey}`;
    const replay = this.#conversionByIdempotency.get(scopedKey);
    if (replay && replay.applicationId !== applicationId) {
      throw new AdmissionsDomainError(
        'SIS_CONVERSION_IDEMPOTENCY_CONFLICT',
        'Conversion idempotency key is already bound to another application',
      );
    }
    if (replay) return { ...replay, fieldMapping: { ...replay.fieldMapping } };
    const prior = this.#conversionByApplication.get(applicationId);
    if (!prior) return undefined;
    this.#conversionByIdempotency.set(scopedKey, prior);
    return { ...prior, fieldMapping: { ...prior.fieldMapping } };
  }

  convertApplicant(input: {
    tenantId: string;
    applicationId: string;
    idempotencyKey: string;
    studentProfileId: string;
    enrollmentId: string;
    fieldMapping: Readonly<Record<string, string>>;
    convertedByAccountId: string;
    correlationId: string;
  }): AdmissionsCommandResult<ApplicantConversion> {
    const application = this.#requireApplication(input.tenantId, input.applicationId);
    const replay = this.resolveApplicantConversionReplay(
      input.tenantId,
      input.applicationId,
      input.idempotencyKey,
    );
    if (replay) return { value: replay, events: [] };
    const idempotencyKey = `${input.tenantId}:${input.idempotencyKey}`;
    if (application.status !== 'accepted' || application.offer?.status !== 'accepted') {
      throw new AdmissionsDomainError(
        'SIS_APPLICATION_NOT_CONVERTIBLE',
        'Application must have an accepted offer',
      );
    }
    const conversion: ApplicantConversion = {
      conversionId: crypto.randomUUID(),
      applicationId: application.applicationId,
      studentProfileId: input.studentProfileId,
      enrollmentId: input.enrollmentId,
      fieldMapping: Object.freeze({ ...input.fieldMapping }),
      convertedByAccountId: input.convertedByAccountId,
      convertedAt: new Date().toISOString(),
    };
    application.conversion = conversion;
    application.status = 'converted';
    application.version += 1;
    this.#conversionByApplication.set(application.applicationId, conversion);
    this.#conversionByIdempotency.set(idempotencyKey, conversion);
    this.#audit.append({
      tenantId: input.tenantId,
      action: 'sis.admissions.applicant-converted',
      subjectId: conversion.conversionId,
    });
    return {
      value: { ...conversion, fieldMapping: { ...conversion.fieldMapping } },
      events: [
        createDomainEvent({
          eventType: 'sis.admissions.applicant-converted.v1',
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregateType: 'application',
          aggregateId: application.applicationId,
          aggregateVersion: application.version,
          correlationId: input.correlationId,
          payload: {
            applicationId: application.applicationId,
            studentProfileId: input.studentProfileId,
            enrollmentId: input.enrollmentId,
          },
        }),
      ],
    };
  }

  getApplication(tenantId: string, applicationId: string): Application {
    return cloneApplication(this.#requireApplication(tenantId, applicationId));
  }

  listApplications(
    tenantId: string,
    options: ListApplicationsOptions = {},
  ): readonly Application[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    return [...this.#applications.values()]
      .filter((application) => application.tenantId === tenantId)
      .filter(
        (application) => options.status === undefined || application.status === options.status,
      )
      .filter(
        (application) => options.cycleId === undefined || application.cycleId === options.cycleId,
      )
      .filter(
        (application) =>
          options.applicantPersonId === undefined ||
          application.applicantPersonId === options.applicantPersonId,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit)
      .map(cloneApplication);
  }

  getChecklistReconciliation(tenantId: string, applicationId: string): ChecklistReconciliation {
    const application = this.#requireApplication(tenantId, applicationId);
    const required = application.checklist.filter((item) => item.required);
    const completed = required.filter((item) => ['verified', 'waived'].includes(item.status));
    const pendingRequirementKeys = required
      .filter((item) => !['verified', 'waived', 'rejected'].includes(item.status))
      .map((item) => item.requirementKey);
    const rejectedRequirementKeys = required
      .filter((item) => item.status === 'rejected')
      .map((item) => item.requirementKey);
    return {
      applicationId,
      required: required.length,
      completed: completed.length,
      pendingRequirementKeys,
      rejectedRequirementKeys,
      complete: required.length === completed.length,
    };
  }

  getGuardianApplicationStatus(
    tenantId: string,
    applicationId: string,
    guardianPersonId: string,
  ): Pick<
    Application,
    'applicationId' | 'applicationNumber' | 'status' | 'checklist' | 'decision' | 'offer'
  > {
    const application = this.#requireApplication(tenantId, applicationId);
    if (application.submittingGuardianPersonId !== guardianPersonId) {
      throw new AdmissionsDomainError(
        'SIS_GUARDIAN_APPLICATION_ACCESS_DENIED',
        'Guardian cannot access application',
      );
    }
    return {
      applicationId: application.applicationId,
      applicationNumber: application.applicationNumber,
      status: application.status,
      checklist: application.checklist.map((item) => ({ ...item })),
      ...(application.decision === undefined ? {} : { decision: { ...application.decision } }),
      ...(application.offer === undefined ? {} : { offer: { ...application.offer } }),
    };
  }

  admissionsFunnel(tenantId: string): Readonly<Record<ApplicationStatus, number>> {
    const counts: Record<ApplicationStatus, number> = {
      draft: 0,
      submitted: 0,
      'under-review': 0,
      waitlisted: 0,
      offered: 0,
      accepted: 0,
      declined: 0,
      withdrawn: 0,
      converted: 0,
    };
    for (const application of this.#applications.values()) {
      if (application.tenantId === tenantId) counts[application.status] += 1;
    }
    return counts;
  }

  #requireApplication(tenantId: string, applicationId: string): MutableApplication {
    const application = this.#applications.get(applicationId);
    if (!application || application.tenantId !== tenantId) {
      throw new AdmissionsDomainError('SIS_APPLICATION_NOT_FOUND', 'Application was not found');
    }
    return application;
  }
}
