import type { CareSecurityService } from '../../safeguarding/src/security.js';
import {
  type CarePublicationDecision,
  type CareRequestContext,
  type CareRelationshipScope,
  type GuardianAuthoritySnapshot,
} from '../../safeguarding/src/security.js';

export type WellbeingLegalBasis =
  'consent' | 'vital-interests' | 'legal-obligation' | 'public-task';

export interface WellbeingBasisEvidence {
  basis: WellbeingLegalBasis;
  evidenceReference: string;
  status: 'active' | 'withdrawn' | 'expired';
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface PastoralReferral {
  tenantId: string;
  referralId: string;
  studentPersonId: string;
  campusId: string;
  referralCategory: string;
  urgency: 'routine' | 'priority' | 'urgent';
  referralSummary: string;
  referredByPrincipalId: string;
  assignedCounselorPrincipalId?: string;
  status: 'submitted' | 'triaged' | 'accepted' | 'closed' | 'declined';
  idempotencyKey: string;
  version: number;
  createdAt: Date;
}

export interface CounsellingCase {
  tenantId: string;
  counsellingCaseId: string;
  referralId: string;
  studentPersonId: string;
  assignedCounselorPrincipalId: string;
  purposeCode: 'student-support-plan';
  status: 'open' | 'paused' | 'closed';
  openedAt: Date;
  closedAt?: Date;
  version: number;
}

export interface CounsellingSession {
  tenantId: string;
  sessionId: string;
  counsellingCaseId: string;
  studentPersonId: string;
  counselorPrincipalId: string;
  occurredAt: Date;
  sessionType: 'individual' | 'group' | 'check-in' | 'crisis';
  restrictedNote: string;
  controlledOutcomeCode: 'continue' | 'review' | 'escalate' | 'close';
  recordedAt: Date;
}

export interface CounsellingSessionCorrection {
  tenantId: string;
  correctionId: string;
  sessionId: string;
  replacementOutcomeCode?: CounsellingSession['controlledOutcomeCode'];
  replacementOccurredAt?: Date;
  reason: string;
  correctedByPrincipalId: string;
  recordedAt: Date;
}

export interface WellbeingRiskAssessment {
  tenantId: string;
  riskAssessmentId: string;
  counsellingCaseId: string;
  studentPersonId: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'immediate';
  factors: readonly string[];
  protectiveFactors: readonly string[];
  requiredActions: readonly string[];
  assessedByPrincipalId: string;
  assessedAt: Date;
  status: 'active' | 'superseded' | 'closed';
  version: number;
}

export interface WellbeingSupportPlan {
  tenantId: string;
  supportPlanId: string;
  counsellingCaseId: string;
  studentPersonId: string;
  goals: readonly string[];
  interventions: readonly string[];
  reviewAt: Date;
  status: 'draft' | 'active' | 'superseded' | 'closed';
  approvedByPrincipalId?: string;
  version: number;
  createdAt: Date;
}

export interface WellbeingPlanReview {
  tenantId: string;
  reviewId: string;
  supportPlanId: string;
  studentPersonId: string;
  outcomeCode: 'continue' | 'adjust' | 'close' | 'escalate';
  nextReviewAt?: Date;
  restrictedNote?: string;
  reviewedByPrincipalId: string;
  reviewedAt: Date;
}

export interface SafeguardingEscalationReference {
  tenantId: string;
  escalationId: string;
  counsellingCaseId: string;
  studentPersonId: string;
  urgency: 'high' | 'immediate';
  reasonCategory: string;
  safeguardingIntakeReference: string;
  status: 'requested' | 'accepted' | 'rejected';
  createdByPrincipalId: string;
  createdAt: Date;
}

export interface WellbeingPublication {
  tenantId: string;
  publicationId: string;
  counsellingCaseId: string;
  studentPersonId: string;
  audience: 'student' | 'guardian';
  version: number;
  supportSummary: string;
  nextReviewAt?: Date;
  status: 'released' | 'revoked';
  preparedByPrincipalId: string;
  approvedByPrincipalId: string;
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface WellbeingPublicView {
  counsellingCaseId: string;
  studentPersonId: string;
  supportSummary: string;
  nextReviewAt?: Date;
  publicationVersion: number;
}

export interface WellbeingEvent {
  eventType:
    | 'care.wellbeing.referral.submitted.v1'
    | 'care.wellbeing.risk.updated.v1'
    | 'care.wellbeing.safeguarding-escalation.requested.v1'
    | 'care.wellbeing.publication.released.v1';
  tenantId: string;
  aggregateId: string;
  studentPersonId: string;
  occurredAt: Date;
  correlationId: string;
  payload: Readonly<Record<string, string | number>>;
}

export interface WellbeingAccessScope {
  context: CareRequestContext;
  relationship?: CareRelationshipScope;
  guardianAuthority?: GuardianAuthoritySnapshot;
  publication?: CarePublicationDecision;
}

export class WellbeingDomainError extends Error {
  constructor(
    readonly code:
      | 'WELLBEING_NOT_FOUND'
      | 'WELLBEING_ACCESS_DENIED'
      | 'WELLBEING_BASIS_INVALID'
      | 'WELLBEING_INVALID_TRANSITION'
      | 'WELLBEING_COUNSELOR_MISMATCH'
      | 'WELLBEING_RISK_REQUIRES_AAL2'
      | 'WELLBEING_PUBLICATION_REQUIRES_AAL2'
      | 'WELLBEING_INDEPENDENT_APPROVAL_REQUIRED'
      | 'WELLBEING_CORRECTION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'WellbeingDomainError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function basisActive(evidence: WellbeingBasisEvidence, now: Date): boolean {
  return (
    evidence.status === 'active' &&
    evidence.effectiveFrom <= now &&
    (evidence.expiresAt === undefined || evidence.expiresAt > now) &&
    evidence.evidenceReference.trim().length > 0
  );
}

export class WellbeingService {
  readonly #security: CareSecurityService;
  readonly #now: () => Date;
  #sequence = 0;
  readonly #referrals = new Map<string, PastoralReferral>();
  readonly #referralByIdempotency = new Map<string, string>();
  readonly #cases = new Map<string, CounsellingCase>();
  readonly #sessions = new Map<string, CounsellingSession>();
  readonly #sessionCorrections: CounsellingSessionCorrection[] = [];
  readonly #riskAssessments = new Map<string, WellbeingRiskAssessment>();
  readonly #supportPlans = new Map<string, WellbeingSupportPlan>();
  readonly #reviews = new Map<string, WellbeingPlanReview>();
  readonly #escalations = new Map<string, SafeguardingEscalationReference>();
  readonly #publications = new Map<string, WellbeingPublication>();
  readonly #events: WellbeingEvent[] = [];

  constructor(security: CareSecurityService, now: () => Date = () => new Date()) {
    this.#security = security;
    this.#now = now;
  }

  submitReferral(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      studentPersonId: string;
      campusId: string;
      referralCategory: string;
      urgency: PastoralReferral['urgency'];
      referralSummary: string;
      idempotencyKey: string;
      basisEvidence: WellbeingBasisEvidence;
    },
  ): PastoralReferral {
    const now = this.#now();
    this.#assertBasis(input.basisEvidence, now);
    const replayKey = this.#key(input.tenantId, input.idempotencyKey);
    const existingId = this.#referralByIdempotency.get(replayKey);
    if (existingId) {
      const existing = this.#referrals.get(this.#key(input.tenantId, existingId));
      if (!existing) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Referral not found');
      return clone(existing);
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: `new:${input.idempotencyKey}`,
      studentPersonId: input.studentPersonId,
      classification: 'CARE-C2',
      permission: 'care.wellbeing.referral.create',
      action: 'create',
      fields: ['referral-category', 'urgency', 'referral-summary'],
    });
    const referral: PastoralReferral = {
      tenantId: input.tenantId,
      referralId: this.#id('pastoral-referral'),
      studentPersonId: input.studentPersonId,
      campusId: input.campusId,
      referralCategory: input.referralCategory,
      urgency: input.urgency,
      referralSummary: input.referralSummary,
      referredByPrincipalId: access.context.principalId ?? 'missing-principal',
      status: 'submitted',
      idempotencyKey: input.idempotencyKey,
      version: 1,
      createdAt: now,
    };
    this.#referrals.set(this.#key(referral.tenantId, referral.referralId), referral);
    this.#referralByIdempotency.set(replayKey, referral.referralId);
    this.#emit(
      'care.wellbeing.referral.submitted.v1',
      referral,
      referral.referralId,
      access.context.correlationId,
      {
        urgency: referral.urgency,
        referralCategory: referral.referralCategory,
      },
    );
    return clone(referral);
  }

  triageReferral(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      referralId: string;
      assignedCounselorPrincipalId: string;
      accept: boolean;
    },
  ): PastoralReferral {
    const key = this.#key(input.tenantId, input.referralId);
    const referral = this.#referrals.get(key);
    if (!referral) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Referral not found');
    if (referral.status !== 'submitted') {
      throw new WellbeingDomainError(
        'WELLBEING_INVALID_TRANSITION',
        'Referral is not awaiting triage',
      );
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: referral.referralId,
      studentPersonId: referral.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.referral.triage',
      action: 'amend',
      fields: ['referral-triage'],
    });
    const updated: PastoralReferral = {
      ...referral,
      assignedCounselorPrincipalId: input.assignedCounselorPrincipalId,
      status: input.accept ? 'accepted' : 'declined',
      version: referral.version + 1,
    };
    this.#referrals.set(key, updated);
    return clone(updated);
  }

  openCounsellingCase(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      referralId: string;
      basisEvidence: WellbeingBasisEvidence;
    },
  ): CounsellingCase {
    const referral = this.#requireReferral(input.tenantId, input.referralId);
    const now = this.#now();
    this.#assertBasis(input.basisEvidence, now);
    if (referral.status !== 'accepted' || !referral.assignedCounselorPrincipalId) {
      throw new WellbeingDomainError('WELLBEING_INVALID_TRANSITION', 'Referral is not accepted');
    }
    this.#requireAssignedCounselor(access, referral.assignedCounselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: referral.referralId,
      studentPersonId: referral.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.case.create',
      action: 'create',
      fields: ['counselling-case'],
    });
    const existing = [...this.#cases.values()].find(
      (item) => item.tenantId === input.tenantId && item.referralId === input.referralId,
    );
    if (existing) return clone(existing);
    const counsellingCase: CounsellingCase = {
      tenantId: input.tenantId,
      counsellingCaseId: this.#id('counselling-case'),
      referralId: input.referralId,
      studentPersonId: referral.studentPersonId,
      assignedCounselorPrincipalId: referral.assignedCounselorPrincipalId,
      purposeCode: 'student-support-plan',
      status: 'open',
      openedAt: now,
      version: 1,
    };
    this.#cases.set(
      this.#key(counsellingCase.tenantId, counsellingCase.counsellingCaseId),
      counsellingCase,
    );
    return clone(counsellingCase);
  }

  recordSession(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      counsellingCaseId: string;
      occurredAt: Date;
      sessionType: CounsellingSession['sessionType'];
      restrictedNote: string;
      controlledOutcomeCode: CounsellingSession['controlledOutcomeCode'];
      basisEvidence: WellbeingBasisEvidence;
    },
  ): CounsellingSession {
    const counsellingCase = this.#requireCase(input.tenantId, input.counsellingCaseId);
    const now = this.#now();
    this.#assertBasis(input.basisEvidence, now);
    this.#requireAssignedCounselor(access, counsellingCase.assignedCounselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: counsellingCase.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.session.write',
      action: 'create',
      fields: ['counselling-session-note', 'controlled-outcome'],
    });
    if (counsellingCase.status !== 'open') {
      throw new WellbeingDomainError(
        'WELLBEING_INVALID_TRANSITION',
        'Counselling case is not open',
      );
    }
    const session: CounsellingSession = {
      tenantId: input.tenantId,
      sessionId: this.#id('counselling-session'),
      counsellingCaseId: input.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      counselorPrincipalId: counsellingCase.assignedCounselorPrincipalId,
      occurredAt: input.occurredAt,
      sessionType: input.sessionType,
      restrictedNote: input.restrictedNote,
      controlledOutcomeCode: input.controlledOutcomeCode,
      recordedAt: now,
    };
    this.#sessions.set(this.#key(session.tenantId, session.sessionId), session);
    return clone(session);
  }

  correctSession(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      sessionId: string;
      replacementOutcomeCode?: CounsellingSession['controlledOutcomeCode'];
      replacementOccurredAt?: Date;
      reason: string;
    },
  ): CounsellingSessionCorrection {
    const session = this.#sessions.get(this.#key(input.tenantId, input.sessionId));
    if (!session) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Session not found');
    if (
      input.reason.trim().length < 8 ||
      (input.replacementOutcomeCode === undefined && input.replacementOccurredAt === undefined)
    ) {
      throw new WellbeingDomainError(
        'WELLBEING_CORRECTION_INVALID',
        'Correction requires a reason and replacement value',
      );
    }
    this.#requireAssignedCounselor(access, session.counselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: session.sessionId,
      studentPersonId: session.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.session.correct',
      action: 'amend',
      fields: ['session-correction'],
    });
    const correction: CounsellingSessionCorrection = {
      tenantId: input.tenantId,
      correctionId: this.#id('counselling-correction'),
      sessionId: input.sessionId,
      ...(input.replacementOutcomeCode
        ? { replacementOutcomeCode: input.replacementOutcomeCode }
        : {}),
      ...(input.replacementOccurredAt
        ? { replacementOccurredAt: input.replacementOccurredAt }
        : {}),
      reason: input.reason.trim(),
      correctedByPrincipalId: access.context.principalId ?? 'missing-principal',
      recordedAt: this.#now(),
    };
    this.#sessionCorrections.push(correction);
    return clone(correction);
  }

  assessRisk(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      counsellingCaseId: string;
      riskLevel: WellbeingRiskAssessment['riskLevel'];
      factors: readonly string[];
      protectiveFactors: readonly string[];
      requiredActions: readonly string[];
    },
  ): WellbeingRiskAssessment {
    const counsellingCase = this.#requireCase(input.tenantId, input.counsellingCaseId);
    this.#requireAssignedCounselor(access, counsellingCase.assignedCounselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: counsellingCase.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.risk.assess',
      action: 'create',
      fields: ['risk-level', 'risk-actions'],
    });
    if (
      (input.riskLevel === 'high' || input.riskLevel === 'immediate') &&
      access.context.assurance !== 'aal2'
    ) {
      throw new WellbeingDomainError(
        'WELLBEING_RISK_REQUIRES_AAL2',
        'High-risk assessment requires AAL2',
      );
    }
    for (const current of this.#riskAssessments.values()) {
      if (
        current.tenantId === input.tenantId &&
        current.counsellingCaseId === input.counsellingCaseId &&
        current.status === 'active'
      ) {
        this.#riskAssessments.set(this.#key(current.tenantId, current.riskAssessmentId), {
          ...current,
          status: 'superseded',
        });
      }
    }
    const assessment: WellbeingRiskAssessment = {
      tenantId: input.tenantId,
      riskAssessmentId: this.#id('wellbeing-risk'),
      counsellingCaseId: input.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      riskLevel: input.riskLevel,
      factors: Object.freeze([...input.factors]),
      protectiveFactors: Object.freeze([...input.protectiveFactors]),
      requiredActions: Object.freeze([...input.requiredActions]),
      assessedByPrincipalId: access.context.principalId ?? 'missing-principal',
      assessedAt: this.#now(),
      status: 'active',
      version: 1,
    };
    this.#riskAssessments.set(
      this.#key(assessment.tenantId, assessment.riskAssessmentId),
      assessment,
    );
    this.#emit(
      'care.wellbeing.risk.updated.v1',
      counsellingCase,
      assessment.riskAssessmentId,
      access.context.correlationId,
      {
        riskLevel: assessment.riskLevel,
      },
    );
    return clone(assessment);
  }

  createSupportPlan(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      counsellingCaseId: string;
      goals: readonly string[];
      interventions: readonly string[];
      reviewAt: Date;
      approvedByPrincipalId?: string;
    },
  ): WellbeingSupportPlan {
    const counsellingCase = this.#requireCase(input.tenantId, input.counsellingCaseId);
    this.#requireAssignedCounselor(access, counsellingCase.assignedCounselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: counsellingCase.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.plan.manage',
      action: 'create',
      fields: ['support-plan'],
    });
    const plan: WellbeingSupportPlan = {
      tenantId: input.tenantId,
      supportPlanId: this.#id('wellbeing-plan'),
      counsellingCaseId: input.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      goals: Object.freeze([...input.goals]),
      interventions: Object.freeze([...input.interventions]),
      reviewAt: input.reviewAt,
      status: input.approvedByPrincipalId ? 'active' : 'draft',
      ...(input.approvedByPrincipalId
        ? { approvedByPrincipalId: input.approvedByPrincipalId }
        : {}),
      version: 1,
      createdAt: this.#now(),
    };
    this.#supportPlans.set(this.#key(plan.tenantId, plan.supportPlanId), plan);
    return clone(plan);
  }

  reviewSupportPlan(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      supportPlanId: string;
      outcomeCode: WellbeingPlanReview['outcomeCode'];
      nextReviewAt?: Date;
      restrictedNote?: string;
    },
  ): WellbeingPlanReview {
    const plan = this.#supportPlans.get(this.#key(input.tenantId, input.supportPlanId));
    if (!plan) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Support plan not found');
    const counsellingCase = this.#requireCase(input.tenantId, plan.counsellingCaseId);
    this.#requireAssignedCounselor(access, counsellingCase.assignedCounselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: plan.supportPlanId,
      studentPersonId: plan.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.plan.manage',
      action: 'amend',
      fields: ['support-plan-review'],
    });
    const review: WellbeingPlanReview = {
      tenantId: input.tenantId,
      reviewId: this.#id('wellbeing-plan-review'),
      supportPlanId: input.supportPlanId,
      studentPersonId: plan.studentPersonId,
      outcomeCode: input.outcomeCode,
      ...(input.nextReviewAt ? { nextReviewAt: input.nextReviewAt } : {}),
      ...(input.restrictedNote ? { restrictedNote: input.restrictedNote } : {}),
      reviewedByPrincipalId: access.context.principalId ?? 'missing-principal',
      reviewedAt: this.#now(),
    };
    this.#reviews.set(this.#key(review.tenantId, review.reviewId), review);
    return clone(review);
  }

  requestSafeguardingEscalation(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      counsellingCaseId: string;
      urgency: 'high' | 'immediate';
      reasonCategory: string;
      safeguardingIntakeReference: string;
    },
  ): SafeguardingEscalationReference {
    const counsellingCase = this.#requireCase(input.tenantId, input.counsellingCaseId);
    this.#requireAssignedCounselor(access, counsellingCase.assignedCounselorPrincipalId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: counsellingCase.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.safeguarding.escalate',
      action: 'create',
      fields: ['escalation-category', 'urgency', 'opaque-intake-reference'],
    });
    if (access.context.assurance !== 'aal2') {
      throw new WellbeingDomainError(
        'WELLBEING_RISK_REQUIRES_AAL2',
        'Safeguarding escalation requires AAL2',
      );
    }
    const escalation: SafeguardingEscalationReference = {
      tenantId: input.tenantId,
      escalationId: this.#id('wellbeing-escalation'),
      counsellingCaseId: input.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      urgency: input.urgency,
      reasonCategory: input.reasonCategory,
      safeguardingIntakeReference: input.safeguardingIntakeReference,
      status: 'requested',
      createdByPrincipalId: access.context.principalId ?? 'missing-principal',
      createdAt: this.#now(),
    };
    this.#escalations.set(this.#key(escalation.tenantId, escalation.escalationId), escalation);
    this.#emit(
      'care.wellbeing.safeguarding-escalation.requested.v1',
      counsellingCase,
      escalation.escalationId,
      access.context.correlationId,
      { urgency: escalation.urgency, reasonCategory: escalation.reasonCategory },
    );
    return clone(escalation);
  }

  publishSupportSummary(
    access: WellbeingAccessScope,
    input: {
      tenantId: string;
      counsellingCaseId: string;
      audience: 'student' | 'guardian';
      supportSummary: string;
      nextReviewAt?: Date;
      expiresAt?: Date;
    },
  ): WellbeingPublication {
    const counsellingCase = this.#requireCase(input.tenantId, input.counsellingCaseId);
    this.#requireAssignedCounselor(access, counsellingCase.assignedCounselorPrincipalId, false);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: counsellingCase.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.publication.approve',
      action: 'amend',
      fields: ['wellbeing-publication'],
    });
    if (access.context.assurance !== 'aal2') {
      throw new WellbeingDomainError(
        'WELLBEING_PUBLICATION_REQUIRES_AAL2',
        'Publication approval requires AAL2',
      );
    }
    const approver = access.context.principalId ?? 'missing-principal';
    if (approver === counsellingCase.assignedCounselorPrincipalId) {
      throw new WellbeingDomainError(
        'WELLBEING_INDEPENDENT_APPROVAL_REQUIRED',
        'Assigned counselor cannot approve publication',
      );
    }
    const prior = [...this.#publications.values()].filter(
      (item) =>
        item.tenantId === input.tenantId &&
        item.counsellingCaseId === input.counsellingCaseId &&
        item.audience === input.audience,
    );
    for (const item of prior) {
      if (item.status === 'released') {
        this.#publications.set(this.#key(item.tenantId, item.publicationId), {
          ...item,
          status: 'revoked',
        });
      }
    }
    const publication: WellbeingPublication = {
      tenantId: input.tenantId,
      publicationId: this.#id('wellbeing-publication'),
      counsellingCaseId: input.counsellingCaseId,
      studentPersonId: counsellingCase.studentPersonId,
      audience: input.audience,
      version: Math.max(0, ...prior.map((item) => item.version)) + 1,
      supportSummary: input.supportSummary,
      ...(input.nextReviewAt ? { nextReviewAt: input.nextReviewAt } : {}),
      status: 'released',
      preparedByPrincipalId: counsellingCase.assignedCounselorPrincipalId,
      approvedByPrincipalId: approver,
      effectiveFrom: this.#now(),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    };
    this.#publications.set(this.#key(publication.tenantId, publication.publicationId), publication);
    this.#emit(
      'care.wellbeing.publication.released.v1',
      counsellingCase,
      publication.publicationId,
      access.context.correlationId,
      {
        audience: publication.audience,
        version: publication.version,
      },
    );
    return clone(publication);
  }

  readPublishedSummary(
    access: WellbeingAccessScope,
    tenantId: string,
    publicationId: string,
  ): WellbeingPublicView {
    const publication = this.#publications.get(this.#key(tenantId, publicationId));
    if (
      !publication ||
      publication.status !== 'released' ||
      (publication.expiresAt !== undefined && publication.expiresAt <= this.#now())
    ) {
      throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Publication not found');
    }
    const release: CarePublicationDecision = {
      tenantId,
      studentPersonId: publication.studentPersonId,
      audience: publication.audience,
      version: publication.version,
      status: 'released',
      allowedFields: ['support-summary', 'next-review-at'],
      effectiveFrom: publication.effectiveFrom,
      ...(publication.expiresAt ? { expiresAt: publication.expiresAt } : {}),
    };
    this.#authorize(
      { ...access, publication: release },
      {
        tenantId,
        resourceId: publication.counsellingCaseId,
        studentPersonId: publication.studentPersonId,
        classification: 'CARE-C2',
        permission: 'care.portal.read',
        action: 'read',
        fields: release.allowedFields,
      },
    );
    return {
      counsellingCaseId: publication.counsellingCaseId,
      studentPersonId: publication.studentPersonId,
      supportSummary: publication.supportSummary,
      ...(publication.nextReviewAt ? { nextReviewAt: publication.nextReviewAt } : {}),
      publicationVersion: publication.version,
    };
  }

  readSession(
    access: WellbeingAccessScope,
    tenantId: string,
    sessionId: string,
  ): CounsellingSession {
    const session = this.#sessions.get(this.#key(tenantId, sessionId));
    if (!session) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Session not found');
    this.#requireAssignedCounselor(access, session.counselorPrincipalId);
    this.#authorize(access, {
      tenantId,
      resourceId: session.counsellingCaseId,
      studentPersonId: session.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.wellbeing.session.read',
      action: 'read',
      fields: ['counselling-session-note', 'controlled-outcome'],
    });
    return clone(session);
  }

  listSessionCorrections(
    tenantId: string,
    sessionId: string,
  ): readonly CounsellingSessionCorrection[] {
    return this.#sessionCorrections
      .filter((item) => item.tenantId === tenantId && item.sessionId === sessionId)
      .map(clone);
  }

  listEvents(tenantId: string): readonly WellbeingEvent[] {
    return this.#events.filter((item) => item.tenantId === tenantId).map(clone);
  }

  snapshotForReports(tenantId: string): Readonly<{
    referrals: readonly PastoralReferral[];
    cases: readonly CounsellingCase[];
    riskAssessments: readonly WellbeingRiskAssessment[];
    planReviews: readonly WellbeingPlanReview[];
  }> {
    return {
      referrals: [...this.#referrals.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
      cases: [...this.#cases.values()].filter((item) => item.tenantId === tenantId).map(clone),
      riskAssessments: [...this.#riskAssessments.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
      planReviews: [...this.#reviews.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
    };
  }

  #assertBasis(evidence: WellbeingBasisEvidence, now: Date): void {
    if (!basisActive(evidence, now)) {
      throw new WellbeingDomainError(
        'WELLBEING_BASIS_INVALID',
        'An active legal basis or consent record is required',
      );
    }
  }

  #requireAssignedCounselor(
    access: WellbeingAccessScope,
    assignedCounselorPrincipalId: string,
    requireMatch = true,
  ): void {
    if (
      requireMatch &&
      access.context.principalId !== assignedCounselorPrincipalId &&
      access.context.persona !== 'privacy-reviewer' &&
      access.context.persona !== 'security-reviewer'
    ) {
      throw new WellbeingDomainError(
        'WELLBEING_COUNSELOR_MISMATCH',
        'Only the assigned counselor can perform this action',
      );
    }
  }

  #authorize(
    access: WellbeingAccessScope,
    request: {
      tenantId: string;
      resourceId: string;
      studentPersonId: string;
      classification: 'CARE-C2' | 'CARE-C3';
      permission: string;
      action: 'read' | 'create' | 'amend';
      fields: readonly string[];
    },
  ): void {
    const decision = this.#security.authorize({
      context: access.context,
      resource: {
        tenantId: request.tenantId,
        resourceId: request.resourceId,
        studentPersonId: request.studentPersonId,
        classification: request.classification,
        fields: request.fields,
      },
      action: request.action,
      permission: request.permission,
      ...(access.relationship ? { relationship: access.relationship } : {}),
      ...(access.guardianAuthority ? { guardianAuthority: access.guardianAuthority } : {}),
      ...(access.publication ? { publication: access.publication } : {}),
    });
    if (!decision.allowed) {
      throw new WellbeingDomainError(
        'WELLBEING_ACCESS_DENIED',
        `Wellbeing operation denied: ${decision.reason}`,
      );
    }
  }

  #requireReferral(tenantId: string, referralId: string): PastoralReferral {
    const referral = this.#referrals.get(this.#key(tenantId, referralId));
    if (!referral) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Referral not found');
    return referral;
  }

  #requireCase(tenantId: string, counsellingCaseId: string): CounsellingCase {
    const counsellingCase = this.#cases.get(this.#key(tenantId, counsellingCaseId));
    if (!counsellingCase) throw new WellbeingDomainError('WELLBEING_NOT_FOUND', 'Case not found');
    return counsellingCase;
  }

  #emit(
    eventType: WellbeingEvent['eventType'],
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
