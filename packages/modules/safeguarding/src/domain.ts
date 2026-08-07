import {
  CareSecurityService,
  type CareCaseMembership,
  type CareRequestContext,
  type CareRelationshipScope,
} from './security.js';

export interface SafeguardingAccessScope {
  context: CareRequestContext;
  relationship?: CareRelationshipScope;
  caseMembership?: CareCaseMembership;
}

export interface SafeguardingConcernReceipt {
  tenantId: string;
  concernId: string;
  receiptReference: string;
  acceptedAt: Date;
  duplicate: boolean;
}

export interface SafeguardingConcern {
  tenantId: string;
  concernId: string;
  studentPersonId: string;
  campusId: string;
  concernCategory: string;
  urgency: 'routine' | 'priority' | 'immediate';
  concernNarrative: string;
  reporterPrincipalId: string;
  reporterRelationship: string;
  reportedAt: Date;
  idempotencyKey: string;
  status: 'received' | 'triaged' | 'linked-to-case' | 'closed-no-action';
}

export interface SafeguardingCaseFile {
  tenantId: string;
  caseId: string;
  studentPersonId: string;
  campusId: string;
  leadPrincipalId: string;
  openedFromConcernId: string;
  riskBand: 'standard' | 'elevated' | 'critical';
  status: 'open' | 'monitoring' | 'closed';
  openedAt: Date;
  closedAt?: Date;
  version: number;
}

export interface SafeguardingMembershipGrant extends CareCaseMembership {
  membershipId: string;
  caseRole: 'lead' | 'case-member' | 'reviewer';
  grantedByPrincipalId: string;
  approvalReference: string;
  revokedAt?: Date;
  revocationReason?: string;
}

export interface SafeguardingChronologyEntry {
  tenantId: string;
  chronologyEntryId: string;
  caseId: string;
  studentPersonId: string;
  occurredAt: Date;
  entryCategory: string;
  restrictedNarrative: string;
  sourceReference?: string;
  recordedByPrincipalId: string;
  recordedAt: Date;
}

export interface SafeguardingAssessment {
  tenantId: string;
  assessmentId: string;
  caseId: string;
  studentPersonId: string;
  riskLevel: 'standard' | 'elevated' | 'critical' | 'immediate';
  controlledFactors: readonly string[];
  requiredActions: readonly string[];
  assessedByPrincipalId: string;
  independentlyReviewedByPrincipalId: string;
  assessedAt: Date;
  status: 'active' | 'superseded' | 'closed';
  version: number;
}

export interface SafeguardingSafetyPlan {
  tenantId: string;
  safetyPlanId: string;
  caseId: string;
  studentPersonId: string;
  actions: readonly string[];
  responsibleRoleCodes: readonly string[];
  reviewAt: Date;
  status: 'draft' | 'active' | 'superseded' | 'closed';
  preparedByPrincipalId: string;
  approvedByPrincipalId?: string;
  version: number;
  createdAt: Date;
}

export interface MandatoryReport {
  tenantId: string;
  mandatoryReportId: string;
  caseId: string;
  studentPersonId: string;
  authorityCode: string;
  reportCategory: string;
  exactFieldCategories: readonly string[];
  recipientReference: string;
  requestedByPrincipalId: string;
  approvedByPrincipalId: string;
  status: 'approved' | 'submitted' | 'acknowledged' | 'failed';
  submittedAt?: Date;
  acknowledgmentReference?: string;
  createdAt: Date;
}

export interface SafeguardingDisclosure {
  tenantId: string;
  disclosureId: string;
  caseId: string;
  studentPersonId: string;
  legalBasis: 'legal-obligation' | 'vital-interests' | 'court-order';
  exactFieldCategories: readonly string[];
  recipientReference: string;
  purposeCode: 'mandatory-reporting' | 'approved-data-transfer';
  requestedByPrincipalId: string;
  approvedByPrincipalId: string;
  expiresAt: Date;
  status: 'approved' | 'generated' | 'delivered' | 'revoked' | 'expired';
  objectReference?: string;
  createdAt: Date;
}

export interface SafeguardingRestrictedDocument {
  tenantId: string;
  restrictedDocumentId: string;
  caseId: string;
  studentPersonId: string;
  documentId: string;
  documentType: string;
  classification: 'CARE-C4';
  sourceClassification: 'CARE-C4';
  status: 'active' | 'superseded' | 'quarantined';
  recordedByPrincipalId: string;
  recordedAt: Date;
}

export interface SafeguardingClosureReview {
  tenantId: string;
  closureReviewId: string;
  caseId: string;
  studentPersonId: string;
  outcome: 'close' | 'continue-monitoring' | 'reopen-assessment';
  reasonCategory: string;
  reviewedByPrincipalId: string;
  independentlyApprovedByPrincipalId: string;
  reviewedAt: Date;
}

export interface SafeguardingEvent {
  eventType:
    | 'care.safeguarding.concern.received.v1'
    | 'care.safeguarding.case.opened.v1'
    | 'care.safeguarding.membership.revoked.v1'
    | 'care.safeguarding.mandatory-report.submitted.v1'
    | 'care.safeguarding.case.closed.v1';
  tenantId: string;
  aggregateId: string;
  studentPersonId: string;
  occurredAt: Date;
  correlationId: string;
  payload: Readonly<Record<string, string | number>>;
}

export class SafeguardingDomainError extends Error {
  constructor(
    readonly code:
      | 'SAFEGUARDING_NOT_FOUND'
      | 'SAFEGUARDING_ACCESS_DENIED'
      | 'SAFEGUARDING_AAL2_REQUIRED'
      | 'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED'
      | 'SAFEGUARDING_INVALID_TRANSITION'
      | 'SAFEGUARDING_MEMBERSHIP_INVALID'
      | 'SAFEGUARDING_EXACT_SCOPE_REQUIRED'
      | 'SAFEGUARDING_DISCLOSURE_EXPIRED',
    message: string,
  ) {
    super(message);
    this.name = 'SafeguardingDomainError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class SafeguardingService {
  readonly #security: CareSecurityService;
  readonly #now: () => Date;
  #sequence = 0;
  readonly #concerns = new Map<string, SafeguardingConcern>();
  readonly #concernByIdempotency = new Map<string, string>();
  readonly #cases = new Map<string, SafeguardingCaseFile>();
  readonly #memberships = new Map<string, SafeguardingMembershipGrant>();
  readonly #chronology: SafeguardingChronologyEntry[] = [];
  readonly #assessments = new Map<string, SafeguardingAssessment>();
  readonly #safetyPlans = new Map<string, SafeguardingSafetyPlan>();
  readonly #mandatoryReports = new Map<string, MandatoryReport>();
  readonly #disclosures = new Map<string, SafeguardingDisclosure>();
  readonly #documents = new Map<string, SafeguardingRestrictedDocument>();
  readonly #closureReviews: SafeguardingClosureReview[] = [];
  readonly #events: SafeguardingEvent[] = [];

  constructor(security: CareSecurityService, now: () => Date = () => new Date()) {
    this.#security = security;
    this.#now = now;
  }

  submitConcern(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      studentPersonId: string;
      campusId: string;
      concernCategory: string;
      urgency: SafeguardingConcern['urgency'];
      concernNarrative: string;
      reporterRelationship: string;
      idempotencyKey: string;
    },
  ): SafeguardingConcernReceipt {
    const replayKey = this.#key(input.tenantId, input.idempotencyKey);
    const existingId = this.#concernByIdempotency.get(replayKey);
    if (existingId) {
      const existing = this.#concerns.get(this.#key(input.tenantId, existingId));
      if (!existing) throw new SafeguardingDomainError('SAFEGUARDING_NOT_FOUND', 'Concern not found');
      return {
        tenantId: input.tenantId,
        concernId: existing.concernId,
        receiptReference: `receipt:${existing.concernId}`,
        acceptedAt: existing.reportedAt,
        duplicate: true,
      };
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: `concern:${input.idempotencyKey}`,
      studentPersonId: input.studentPersonId,
      permission: 'care.safeguarding.concern.create',
      action: 'create',
      fields: ['concern-category', 'urgency', 'concern-narrative'],
    });
    const now = this.#now();
    const concern: SafeguardingConcern = {
      tenantId: input.tenantId,
      concernId: this.#id('safeguarding-concern'),
      studentPersonId: input.studentPersonId,
      campusId: input.campusId,
      concernCategory: input.concernCategory,
      urgency: input.urgency,
      concernNarrative: input.concernNarrative,
      reporterPrincipalId: access.context.principalId ?? 'missing-principal',
      reporterRelationship: input.reporterRelationship,
      reportedAt: now,
      idempotencyKey: input.idempotencyKey,
      status: 'received',
    };
    this.#concerns.set(this.#key(concern.tenantId, concern.concernId), concern);
    this.#concernByIdempotency.set(replayKey, concern.concernId);
    this.#emit(
      'care.safeguarding.concern.received.v1',
      concern,
      concern.concernId,
      access.context.correlationId,
      { urgency: concern.urgency, concernCategory: concern.concernCategory },
    );
    return {
      tenantId: concern.tenantId,
      concernId: concern.concernId,
      receiptReference: `receipt:${concern.concernId}`,
      acceptedAt: now,
      duplicate: false,
    };
  }

  openCase(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      concernId: string;
      leadPrincipalId: string;
      riskBand: SafeguardingCaseFile['riskBand'];
      initialMembershipExpiresAt: Date;
      approvalReference: string;
    },
  ): { caseFile: SafeguardingCaseFile; leadMembership: SafeguardingMembershipGrant } {
    this.#requireAal2(access);
    const concern = this.#requireConcern(input.tenantId, input.concernId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: concern.concernId,
      studentPersonId: concern.studentPersonId,
      permission: 'care.safeguarding.case.open',
      action: 'create',
      fields: ['case-shell', 'risk-band'],
      allowConcernIntakeRelationship: true,
    });
    const existing = [...this.#cases.values()].find(
      (item) => item.tenantId === input.tenantId && item.openedFromConcernId === input.concernId,
    );
    if (existing) {
      const membership = this.#activeMembership(
        input.tenantId,
        existing.caseId,
        existing.leadPrincipalId,
        'safeguarding-assessment',
      );
      if (!membership) {
        throw new SafeguardingDomainError(
          'SAFEGUARDING_MEMBERSHIP_INVALID',
          'Lead membership is missing',
        );
      }
      return { caseFile: clone(existing), leadMembership: clone(membership) };
    }
    const now = this.#now();
    if (input.initialMembershipExpiresAt <= now) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_MEMBERSHIP_INVALID',
        'Membership expiry must be in the future',
      );
    }
    const caseFile: SafeguardingCaseFile = {
      tenantId: input.tenantId,
      caseId: this.#id('safeguarding-case'),
      studentPersonId: concern.studentPersonId,
      campusId: concern.campusId,
      leadPrincipalId: input.leadPrincipalId,
      openedFromConcernId: concern.concernId,
      riskBand: input.riskBand,
      status: 'open',
      openedAt: now,
      version: 1,
    };
    const leadMembership = this.#grantMembershipUnchecked({
      tenantId: input.tenantId,
      caseId: caseFile.caseId,
      principalId: input.leadPrincipalId,
      caseRole: 'lead',
      purpose: 'safeguarding-assessment',
      effectiveFrom: now,
      expiresAt: input.initialMembershipExpiresAt,
      grantedByPrincipalId: access.context.principalId ?? 'missing-principal',
      approvalReference: input.approvalReference,
    });
    this.#cases.set(this.#key(caseFile.tenantId, caseFile.caseId), caseFile);
    this.#concerns.set(this.#key(concern.tenantId, concern.concernId), {
      ...concern,
      status: 'linked-to-case',
    });
    this.#emit(
      'care.safeguarding.case.opened.v1',
      caseFile,
      caseFile.caseId,
      access.context.correlationId,
      { riskBand: caseFile.riskBand },
    );
    return { caseFile: clone(caseFile), leadMembership: clone(leadMembership) };
  }

  grantMembership(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      principalId: string;
      caseRole: SafeguardingMembershipGrant['caseRole'];
      purpose: 'safeguarding-assessment' | 'mandatory-reporting' | 'approved-data-transfer';
      expiresAt: Date;
      approvalReference: string;
    },
  ): SafeguardingMembershipGrant {
    this.#requireAal2(access);
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.membership.manage', 'membership-manage');
    if (input.expiresAt <= this.#now()) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_MEMBERSHIP_INVALID',
        'Membership expiry must be in the future',
      );
    }
    if (input.principalId === access.context.principalId) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
        'Actors cannot grant their own case membership',
      );
    }
    return clone(
      this.#grantMembershipUnchecked({
        tenantId: input.tenantId,
        caseId: input.caseId,
        principalId: input.principalId,
        caseRole: input.caseRole,
        purpose: input.purpose,
        effectiveFrom: this.#now(),
        expiresAt: input.expiresAt,
        grantedByPrincipalId: access.context.principalId ?? 'missing-principal',
        approvalReference: input.approvalReference,
      }),
    );
  }

  revokeMembership(
    access: SafeguardingAccessScope,
    input: { tenantId: string; membershipId: string; reason: string },
  ): SafeguardingMembershipGrant {
    this.#requireAal2(access);
    const key = this.#key(input.tenantId, input.membershipId);
    const membership = this.#memberships.get(key);
    if (!membership) {
      throw new SafeguardingDomainError('SAFEGUARDING_NOT_FOUND', 'Membership not found');
    }
    const caseFile = this.#requireCase(input.tenantId, membership.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.membership.manage', 'membership-manage');
    const revoked: SafeguardingMembershipGrant = {
      ...membership,
      status: 'revoked',
      revokedAt: this.#now(),
      revocationReason: input.reason,
    };
    this.#memberships.set(key, revoked);
    this.#emit(
      'care.safeguarding.membership.revoked.v1',
      caseFile,
      membership.membershipId,
      access.context.correlationId,
      { caseRole: membership.caseRole },
    );
    return clone(revoked);
  }

  addChronology(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      occurredAt: Date;
      entryCategory: string;
      restrictedNarrative: string;
      sourceReference?: string;
    },
  ): SafeguardingChronologyEntry {
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.case.write', 'chronology');
    const entry: SafeguardingChronologyEntry = {
      tenantId: input.tenantId,
      chronologyEntryId: this.#id('safeguarding-chronology'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      occurredAt: input.occurredAt,
      entryCategory: input.entryCategory,
      restrictedNarrative: input.restrictedNarrative,
      ...(input.sourceReference ? { sourceReference: input.sourceReference } : {}),
      recordedByPrincipalId: access.context.principalId ?? 'missing-principal',
      recordedAt: this.#now(),
    };
    this.#chronology.push(entry);
    return clone(entry);
  }

  assessCase(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      riskLevel: SafeguardingAssessment['riskLevel'];
      controlledFactors: readonly string[];
      requiredActions: readonly string[];
      independentlyReviewedByPrincipalId: string;
    },
  ): SafeguardingAssessment {
    this.#requireAal2(access);
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.assessment.write', 'assessment');
    const assessor = access.context.principalId ?? 'missing-principal';
    if (assessor === input.independentlyReviewedByPrincipalId) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
        'Assessment requires an independent reviewer',
      );
    }
    for (const existing of this.#assessments.values()) {
      if (
        existing.tenantId === input.tenantId &&
        existing.caseId === input.caseId &&
        existing.status === 'active'
      ) {
        this.#assessments.set(this.#key(existing.tenantId, existing.assessmentId), {
          ...existing,
          status: 'superseded',
        });
      }
    }
    const assessment: SafeguardingAssessment = {
      tenantId: input.tenantId,
      assessmentId: this.#id('safeguarding-assessment'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      riskLevel: input.riskLevel,
      controlledFactors: Object.freeze([...input.controlledFactors]),
      requiredActions: Object.freeze([...input.requiredActions]),
      assessedByPrincipalId: assessor,
      independentlyReviewedByPrincipalId: input.independentlyReviewedByPrincipalId,
      assessedAt: this.#now(),
      status: 'active',
      version: 1,
    };
    this.#assessments.set(this.#key(assessment.tenantId, assessment.assessmentId), assessment);
    return clone(assessment);
  }

  createSafetyPlan(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      actions: readonly string[];
      responsibleRoleCodes: readonly string[];
      reviewAt: Date;
      approvedByPrincipalId?: string;
    },
  ): SafeguardingSafetyPlan {
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.plan.write', 'safety-plan');
    const preparer = access.context.principalId ?? 'missing-principal';
    if (input.approvedByPrincipalId === preparer) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
        'Safety-plan approver must differ from preparer',
      );
    }
    const plan: SafeguardingSafetyPlan = {
      tenantId: input.tenantId,
      safetyPlanId: this.#id('safeguarding-safety-plan'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      actions: Object.freeze([...input.actions]),
      responsibleRoleCodes: Object.freeze([...input.responsibleRoleCodes]),
      reviewAt: input.reviewAt,
      status: input.approvedByPrincipalId ? 'active' : 'draft',
      preparedByPrincipalId: preparer,
      ...(input.approvedByPrincipalId
        ? { approvedByPrincipalId: input.approvedByPrincipalId }
        : {}),
      version: 1,
      createdAt: this.#now(),
    };
    this.#safetyPlans.set(this.#key(plan.tenantId, plan.safetyPlanId), plan);
    return clone(plan);
  }

  approveMandatoryReport(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      authorityCode: string;
      reportCategory: string;
      exactFieldCategories: readonly string[];
      recipientReference: string;
      approvedByPrincipalId: string;
    },
  ): MandatoryReport {
    this.#requireAal2(access);
    this.#requirePurpose(access, 'mandatory-reporting');
    this.#assertExactScope(input.exactFieldCategories, input.recipientReference);
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.report.approve', 'mandatory-report');
    const requester = access.context.principalId ?? 'missing-principal';
    if (requester === input.approvedByPrincipalId) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
        'Mandatory report requires independent approval',
      );
    }
    const report: MandatoryReport = {
      tenantId: input.tenantId,
      mandatoryReportId: this.#id('mandatory-report'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      authorityCode: input.authorityCode,
      reportCategory: input.reportCategory,
      exactFieldCategories: Object.freeze([...input.exactFieldCategories]),
      recipientReference: input.recipientReference,
      requestedByPrincipalId: requester,
      approvedByPrincipalId: input.approvedByPrincipalId,
      status: 'approved',
      createdAt: this.#now(),
    };
    this.#mandatoryReports.set(this.#key(report.tenantId, report.mandatoryReportId), report);
    return clone(report);
  }

  submitMandatoryReport(
    access: SafeguardingAccessScope,
    tenantId: string,
    mandatoryReportId: string,
  ): MandatoryReport {
    this.#requireAal2(access);
    this.#requirePurpose(access, 'mandatory-reporting');
    const key = this.#key(tenantId, mandatoryReportId);
    const report = this.#mandatoryReports.get(key);
    if (!report) throw new SafeguardingDomainError('SAFEGUARDING_NOT_FOUND', 'Report not found');
    const caseFile = this.#requireCase(tenantId, report.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.report.submit', 'mandatory-report');
    if (report.status !== 'approved') {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INVALID_TRANSITION',
        'Only approved reports can be submitted',
      );
    }
    const submitted: MandatoryReport = {
      ...report,
      status: 'submitted',
      submittedAt: this.#now(),
    };
    this.#mandatoryReports.set(key, submitted);
    this.#emit(
      'care.safeguarding.mandatory-report.submitted.v1',
      caseFile,
      report.mandatoryReportId,
      access.context.correlationId,
      { authorityCode: report.authorityCode, reportCategory: report.reportCategory },
    );
    return clone(submitted);
  }

  approveDisclosure(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      legalBasis: SafeguardingDisclosure['legalBasis'];
      exactFieldCategories: readonly string[];
      recipientReference: string;
      purposeCode: SafeguardingDisclosure['purposeCode'];
      approvedByPrincipalId: string;
      expiresAt: Date;
    },
  ): SafeguardingDisclosure {
    this.#requireAal2(access);
    this.#requirePurpose(access, input.purposeCode);
    this.#assertExactScope(input.exactFieldCategories, input.recipientReference);
    if (input.expiresAt <= this.#now()) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_DISCLOSURE_EXPIRED',
        'Disclosure expiry must be in the future',
      );
    }
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.disclosure.approve', 'external-disclosure');
    const requester = access.context.principalId ?? 'missing-principal';
    if (requester === input.approvedByPrincipalId) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
        'Disclosure requires independent approval',
      );
    }
    const disclosure: SafeguardingDisclosure = {
      tenantId: input.tenantId,
      disclosureId: this.#id('safeguarding-disclosure'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      legalBasis: input.legalBasis,
      exactFieldCategories: Object.freeze([...input.exactFieldCategories]),
      recipientReference: input.recipientReference,
      purposeCode: input.purposeCode,
      requestedByPrincipalId: requester,
      approvedByPrincipalId: input.approvedByPrincipalId,
      expiresAt: input.expiresAt,
      status: 'approved',
      createdAt: this.#now(),
    };
    this.#disclosures.set(this.#key(disclosure.tenantId, disclosure.disclosureId), disclosure);
    return clone(disclosure);
  }

  generateDisclosure(
    access: SafeguardingAccessScope,
    tenantId: string,
    disclosureId: string,
    exactFieldCategories: readonly string[],
    recipientReference: string,
    objectReference: string,
  ): SafeguardingDisclosure {
    this.#requireAal2(access);
    const key = this.#key(tenantId, disclosureId);
    const disclosure = this.#disclosures.get(key);
    if (!disclosure) {
      throw new SafeguardingDomainError('SAFEGUARDING_NOT_FOUND', 'Disclosure not found');
    }
    this.#requirePurpose(access, disclosure.purposeCode);
    const caseFile = this.#requireCase(tenantId, disclosure.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.disclosure.generate', 'external-disclosure');
    if (disclosure.expiresAt <= this.#now()) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_DISCLOSURE_EXPIRED',
        'Disclosure approval has expired',
      );
    }
    if (
      recipientReference !== disclosure.recipientReference ||
      exactFieldCategories.length !== disclosure.exactFieldCategories.length ||
      exactFieldCategories.some((field) => !disclosure.exactFieldCategories.includes(field))
    ) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_EXACT_SCOPE_REQUIRED',
        'Disclosure generation must match exact approval scope',
      );
    }
    const generated: SafeguardingDisclosure = {
      ...disclosure,
      status: 'generated',
      objectReference,
    };
    this.#disclosures.set(key, generated);
    return clone(generated);
  }

  attachRestrictedDocument(
    access: SafeguardingAccessScope,
    input: { tenantId: string; caseId: string; documentId: string; documentType: string },
  ): SafeguardingRestrictedDocument {
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.document.write', 'document');
    const document: SafeguardingRestrictedDocument = {
      tenantId: input.tenantId,
      restrictedDocumentId: this.#id('safeguarding-document'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      documentId: input.documentId,
      documentType: input.documentType,
      classification: 'CARE-C4',
      sourceClassification: 'CARE-C4',
      status: 'active',
      recordedByPrincipalId: access.context.principalId ?? 'missing-principal',
      recordedAt: this.#now(),
    };
    this.#documents.set(this.#key(document.tenantId, document.restrictedDocumentId), document);
    return clone(document);
  }

  closeCase(
    access: SafeguardingAccessScope,
    input: {
      tenantId: string;
      caseId: string;
      outcome: SafeguardingClosureReview['outcome'];
      reasonCategory: string;
      independentlyApprovedByPrincipalId: string;
    },
  ): { caseFile: SafeguardingCaseFile; review: SafeguardingClosureReview } {
    this.#requireAal2(access);
    const caseFile = this.#requireCase(input.tenantId, input.caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.case.close', 'closure-review');
    const reviewer = access.context.principalId ?? 'missing-principal';
    if (reviewer === input.independentlyApprovedByPrincipalId) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
        'Closure requires independent approval',
      );
    }
    const review: SafeguardingClosureReview = {
      tenantId: input.tenantId,
      closureReviewId: this.#id('safeguarding-closure-review'),
      caseId: input.caseId,
      studentPersonId: caseFile.studentPersonId,
      outcome: input.outcome,
      reasonCategory: input.reasonCategory,
      reviewedByPrincipalId: reviewer,
      independentlyApprovedByPrincipalId: input.independentlyApprovedByPrincipalId,
      reviewedAt: this.#now(),
    };
    this.#closureReviews.push(review);
    const closed: SafeguardingCaseFile =
      input.outcome === 'close'
        ? {
            ...caseFile,
            status: 'closed',
            closedAt: this.#now(),
            version: caseFile.version + 1,
          }
        : {
            ...caseFile,
            status: 'monitoring',
            version: caseFile.version + 1,
          };
    this.#cases.set(this.#key(closed.tenantId, closed.caseId), closed);
    if (closed.status === 'closed') {
      this.#emit(
        'care.safeguarding.case.closed.v1',
        closed,
        closed.caseId,
        access.context.correlationId,
        { outcome: review.outcome, reasonCategory: review.reasonCategory },
      );
    }
    return { caseFile: clone(closed), review: clone(review) };
  }

  readCase(access: SafeguardingAccessScope, tenantId: string, caseId: string): SafeguardingCaseFile {
    const caseFile = this.#requireCase(tenantId, caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.read', 'case-read');
    return clone(caseFile);
  }

  readChronology(
    access: SafeguardingAccessScope,
    tenantId: string,
    caseId: string,
  ): readonly SafeguardingChronologyEntry[] {
    const caseFile = this.#requireCase(tenantId, caseId);
    this.#authorizeCase(access, caseFile, 'care.safeguarding.read', 'chronology-read');
    return this.#chronology
      .filter((item) => item.tenantId === tenantId && item.caseId === caseId)
      .map(clone);
  }

  activeMembership(
    tenantId: string,
    caseId: string,
    principalId: string,
    purpose: CareCaseMembership['purpose'],
  ): SafeguardingMembershipGrant | undefined {
    const membership = this.#activeMembership(tenantId, caseId, principalId, purpose);
    return membership ? clone(membership) : undefined;
  }

  listEvents(tenantId: string): readonly SafeguardingEvent[] {
    return this.#events.filter((item) => item.tenantId === tenantId).map(clone);
  }

  snapshotForReports(tenantId: string): Readonly<{
    concerns: readonly SafeguardingConcern[];
    cases: readonly SafeguardingCaseFile[];
    mandatoryReports: readonly MandatoryReport[];
    closureReviews: readonly SafeguardingClosureReview[];
  }> {
    return {
      concerns: [...this.#concerns.values()].filter((item) => item.tenantId === tenantId).map(clone),
      cases: [...this.#cases.values()].filter((item) => item.tenantId === tenantId).map(clone),
      mandatoryReports: [...this.#mandatoryReports.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
      closureReviews: this.#closureReviews.filter((item) => item.tenantId === tenantId).map(clone),
    };
  }

  #authorizeCase(
    access: SafeguardingAccessScope,
    caseFile: SafeguardingCaseFile,
    permission: string,
    field: string,
  ): void {
    const principalId = access.context.principalId;
    const currentMembership = principalId
      ? this.#activeMembership(
          caseFile.tenantId,
          caseFile.caseId,
          principalId,
          access.context.purpose,
        )
      : undefined;
    const scopedAccess: SafeguardingAccessScope = currentMembership
      ? { ...access, caseMembership: currentMembership }
      : {
          context: access.context,
          ...(access.relationship ? { relationship: access.relationship } : {}),
        };
    this.#authorize(
      scopedAccess,
      {
        tenantId: caseFile.tenantId,
        resourceId: caseFile.caseId,
        studentPersonId: caseFile.studentPersonId,
        permission,
        action: permission === 'care.safeguarding.read' ? 'read' : 'amend',
        fields: [field],
        caseId: caseFile.caseId,
      },
    );
  }

  #authorize(
    access: SafeguardingAccessScope,
    request: {
      tenantId: string;
      resourceId: string;
      studentPersonId: string;
      permission: string;
      action: 'read' | 'create' | 'amend';
      fields: readonly string[];
      caseId?: string;
      allowConcernIntakeRelationship?: boolean;
    },
  ): void {
    const decision = this.#security.authorize({
      context: access.context,
      resource: {
        tenantId: request.tenantId,
        resourceId: request.resourceId,
        studentPersonId: request.studentPersonId,
        classification: 'CARE-C4',
        fields: request.fields,
        ...(request.caseId ? { caseId: request.caseId } : {}),
      },
      action: request.action,
      permission: request.permission,
      ...(access.relationship ? { relationship: access.relationship } : {}),
      ...(access.caseMembership ? { caseMembership: access.caseMembership } : {}),
    });
    if (!decision.allowed) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_ACCESS_DENIED',
        `Safeguarding operation denied: ${decision.reason}`,
      );
    }
  }

  #requireAal2(access: SafeguardingAccessScope): void {
    if (access.context.assurance !== 'aal2') {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_AAL2_REQUIRED',
        'Safeguarding high-risk action requires AAL2',
      );
    }
  }

  #requirePurpose(
    access: SafeguardingAccessScope,
    purpose: 'mandatory-reporting' | 'approved-data-transfer',
  ): void {
    if (access.context.purpose !== purpose) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_ACCESS_DENIED',
        'Safeguarding operation purpose does not match the approved purpose',
      );
    }
  }

  #assertExactScope(fields: readonly string[], recipientReference: string): void {
    if (
      fields.length === 0 ||
      new Set(fields).size !== fields.length ||
      fields.some((field) => field.trim() === '') ||
      recipientReference.trim() === ''
    ) {
      throw new SafeguardingDomainError(
        'SAFEGUARDING_EXACT_SCOPE_REQUIRED',
        'Exact non-empty disclosure scope and recipient are required',
      );
    }
  }

  #grantMembershipUnchecked(input: {
    tenantId: string;
    caseId: string;
    principalId: string;
    caseRole: SafeguardingMembershipGrant['caseRole'];
    purpose: CareCaseMembership['purpose'];
    effectiveFrom: Date;
    expiresAt: Date;
    grantedByPrincipalId: string;
    approvalReference: string;
  }): SafeguardingMembershipGrant {
    for (const membership of this.#memberships.values()) {
      if (
        membership.tenantId === input.tenantId &&
        membership.caseId === input.caseId &&
        membership.principalId === input.principalId &&
        membership.purpose === input.purpose &&
        membership.status === 'active'
      ) {
        this.#memberships.set(this.#key(membership.tenantId, membership.membershipId), {
          ...membership,
          status: 'revoked',
          revokedAt: this.#now(),
          revocationReason: 'superseded',
        });
      }
    }
    const membership: SafeguardingMembershipGrant = {
      tenantId: input.tenantId,
      membershipId: this.#id('case-membership'),
      caseId: input.caseId,
      principalId: input.principalId,
      caseRole: input.caseRole,
      purpose: input.purpose,
      status: 'active',
      effectiveFrom: input.effectiveFrom,
      expiresAt: input.expiresAt,
      grantedByPrincipalId: input.grantedByPrincipalId,
      approvalReference: input.approvalReference,
    };
    this.#memberships.set(this.#key(membership.tenantId, membership.membershipId), membership);
    return membership;
  }

  #activeMembership(
    tenantId: string,
    caseId: string,
    principalId: string,
    purpose: CareCaseMembership['purpose'],
  ): SafeguardingMembershipGrant | undefined {
    const now = this.#now();
    return [...this.#memberships.values()].find(
      (item) =>
        item.tenantId === tenantId &&
        item.caseId === caseId &&
        item.principalId === principalId &&
        item.purpose === purpose &&
        item.status === 'active' &&
        item.effectiveFrom <= now &&
        (item.expiresAt === undefined || item.expiresAt > now),
    );
  }

  #requireConcern(tenantId: string, concernId: string): SafeguardingConcern {
    const concern = this.#concerns.get(this.#key(tenantId, concernId));
    if (!concern) throw new SafeguardingDomainError('SAFEGUARDING_NOT_FOUND', 'Concern not found');
    return concern;
  }

  #requireCase(tenantId: string, caseId: string): SafeguardingCaseFile {
    const caseFile = this.#cases.get(this.#key(tenantId, caseId));
    if (!caseFile) throw new SafeguardingDomainError('SAFEGUARDING_NOT_FOUND', 'Case not found');
    return caseFile;
  }

  #emit(
    eventType: SafeguardingEvent['eventType'],
    aggregate: { tenantId: string; studentPersonId: string },
    aggregateId: string,
    correlationId: string,
    payload: Readonly<Record<string, string | number>>,
  ): void {
    this.#events.push({
      eventType,
      tenantId: aggregate.tenantId,
      aggregateId,
      studentPersonId: aggregate.studentPersonId,
      occurredAt: this.#now(),
      correlationId,
      payload: Object.freeze({ ...payload }),
    });
  }

  #key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  #id(prefix: string): string {
    this.#sequence += 1;
    return `${prefix}-${this.#sequence}`;
  }
}
