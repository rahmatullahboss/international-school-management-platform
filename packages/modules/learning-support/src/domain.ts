import {
  CareSecurityService,
  type CarePublicationDecision,
  type CareRequestContext,
  type CareRelationshipScope,
  type GuardianAuthoritySnapshot,
} from '../../safeguarding/src/security.js';

export type LearningSupportLegalBasis =
  'consent' | 'legal-obligation' | 'public-task' | 'vital-interests';

export interface LearningSupportBasisEvidence {
  basis: LearningSupportLegalBasis;
  evidenceReference: string;
  status: 'active' | 'withdrawn' | 'expired';
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface LearningSupportAccessScope {
  context: CareRequestContext;
  relationship?: CareRelationshipScope;
  guardianAuthority?: GuardianAuthoritySnapshot;
  publication?: CarePublicationDecision;
}

export interface LearningSupportReferral {
  tenantId: string;
  referralId: string;
  studentPersonId: string;
  campusId: string;
  referralCategory: string;
  priority: 'routine' | 'priority' | 'urgent';
  classroomSummary: string;
  referredByPrincipalId: string;
  assignedLeadPrincipalId?: string;
  status: 'submitted' | 'accepted' | 'declined' | 'closed';
  idempotencyKey: string;
  version: number;
  createdAt: Date;
}

export interface LearningSupportAssessment {
  tenantId: string;
  assessmentId: string;
  referralId: string;
  studentPersonId: string;
  needCategories: readonly string[];
  strengths: readonly string[];
  restrictedFindings: string;
  assessedByPrincipalId: string;
  independentlyReviewedByPrincipalId: string;
  assessedAt: Date;
  status: 'active' | 'superseded' | 'closed';
  version: number;
}

export interface LearningAccommodation {
  tenantId: string;
  accommodationId: string;
  assessmentId: string;
  studentPersonId: string;
  accommodationCode: string;
  category: 'instruction' | 'environment' | 'assessment' | 'communication' | 'access';
  classroomInstruction: string;
  restrictedRationale: string;
  validFrom: Date;
  validTo?: Date;
  status: 'active' | 'superseded' | 'closed';
  approvedByPrincipalId: string;
  version: number;
}

export interface LearningSupportGoal {
  goalId: string;
  title: string;
  successMeasure: string;
  targetDate: Date;
  status: 'planned' | 'active' | 'achieved' | 'closed';
}

export interface LearningSupportPlan {
  tenantId: string;
  supportPlanId: string;
  referralId: string;
  studentPersonId: string;
  title: string;
  goals: readonly LearningSupportGoal[];
  accommodationIds: readonly string[];
  reviewAt: Date;
  status: 'draft' | 'active' | 'superseded' | 'closed';
  preparedByPrincipalId: string;
  approvedByPrincipalId?: string;
  version: number;
  createdAt: Date;
}

export interface LearningSupportPlanReview {
  tenantId: string;
  reviewId: string;
  supportPlanId: string;
  studentPersonId: string;
  outcomeCode: 'continue' | 'adjust' | 'close' | 'escalate';
  goalOutcomeCodes: Readonly<Record<string, 'progressing' | 'met' | 'not-met' | 'deferred'>>;
  nextReviewAt?: Date;
  restrictedNote?: string;
  reviewedByPrincipalId: string;
  independentlyApprovedByPrincipalId: string;
  reviewedAt: Date;
}

export interface AcademicAccommodationProjection {
  tenantId: string;
  studentPersonId: string;
  supportPlanId: string;
  supportPlanVersion: number;
  accommodations: readonly Readonly<{
    accommodationCode: string;
    category: LearningAccommodation['category'];
    classroomInstruction: string;
  }>[];
  generatedAt: Date;
  expiresAt: Date;
}

export interface LearningSupportPublication {
  tenantId: string;
  publicationId: string;
  supportPlanId: string;
  studentPersonId: string;
  audience: 'student' | 'guardian';
  version: number;
  supportSummary: string;
  goalSummaries: readonly string[];
  nextReviewAt?: Date;
  preparedByPrincipalId: string;
  approvedByPrincipalId: string;
  effectiveFrom: Date;
  expiresAt?: Date;
  status: 'released' | 'revoked';
}

export interface LearningSupportPublicView {
  supportPlanId: string;
  studentPersonId: string;
  supportSummary: string;
  goalSummaries: readonly string[];
  nextReviewAt?: Date;
  publicationVersion: number;
}

export interface LearningSupportEvent {
  eventType:
    | 'care.learning-support.referral.submitted.v1'
    | 'care.learning-support.plan.activated.v1'
    | 'care.learning-support.plan.reviewed.v1'
    | 'care.learning-support.academic-projection.generated.v1'
    | 'care.learning-support.publication.released.v1';
  tenantId: string;
  aggregateId: string;
  studentPersonId: string;
  occurredAt: Date;
  correlationId: string;
  payload: Readonly<Record<string, string | number>>;
}

export class LearningSupportDomainError extends Error {
  constructor(
    readonly code:
      | 'LEARNING_SUPPORT_NOT_FOUND'
      | 'LEARNING_SUPPORT_ACCESS_DENIED'
      | 'LEARNING_SUPPORT_BASIS_INVALID'
      | 'LEARNING_SUPPORT_INVALID_TRANSITION'
      | 'LEARNING_SUPPORT_AAL2_REQUIRED'
      | 'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED'
      | 'LEARNING_SUPPORT_RELATIONSHIP_REQUIRED'
      | 'LEARNING_SUPPORT_ACCOMMODATION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'LearningSupportDomainError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function basisActive(evidence: LearningSupportBasisEvidence, now: Date): boolean {
  return (
    evidence.status === 'active' &&
    evidence.effectiveFrom <= now &&
    (evidence.expiresAt === undefined || evidence.expiresAt > now) &&
    evidence.evidenceReference.trim().length > 0
  );
}

export class LearningSupportService {
  readonly #security: CareSecurityService;
  readonly #now: () => Date;
  #sequence = 0;
  readonly #referrals = new Map<string, LearningSupportReferral>();
  readonly #referralByIdempotency = new Map<string, string>();
  readonly #assessments = new Map<string, LearningSupportAssessment>();
  readonly #accommodations = new Map<string, LearningAccommodation>();
  readonly #plans = new Map<string, LearningSupportPlan>();
  readonly #reviews: LearningSupportPlanReview[] = [];
  readonly #publications = new Map<string, LearningSupportPublication>();
  readonly #events: LearningSupportEvent[] = [];

  constructor(security: CareSecurityService, now: () => Date = () => new Date()) {
    this.#security = security;
    this.#now = now;
  }

  submitReferral(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      studentPersonId: string;
      campusId: string;
      referralCategory: string;
      priority: LearningSupportReferral['priority'];
      classroomSummary: string;
      idempotencyKey: string;
      basisEvidence: LearningSupportBasisEvidence;
    },
  ): LearningSupportReferral {
    this.#assertBasis(input.basisEvidence);
    this.#assertRelationship(access, input.studentPersonId);
    const replayKey = this.#key(input.tenantId, input.idempotencyKey);
    const existingId = this.#referralByIdempotency.get(replayKey);
    if (existingId) {
      const existing = this.#referrals.get(this.#key(input.tenantId, existingId));
      if (!existing)
        throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Referral not found');
      return clone(existing);
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: `new:${input.idempotencyKey}`,
      studentPersonId: input.studentPersonId,
      classification: 'CARE-C2',
      permission: 'care.learning-support.referral.create',
      action: 'create',
      fields: ['referral-category', 'priority', 'classroom-summary'],
    });
    const referral: LearningSupportReferral = {
      tenantId: input.tenantId,
      referralId: this.#id('learning-support-referral'),
      studentPersonId: input.studentPersonId,
      campusId: input.campusId,
      referralCategory: input.referralCategory,
      priority: input.priority,
      classroomSummary: input.classroomSummary,
      referredByPrincipalId: access.context.principalId ?? 'missing-principal',
      status: 'submitted',
      idempotencyKey: input.idempotencyKey,
      version: 1,
      createdAt: this.#now(),
    };
    this.#referrals.set(this.#key(referral.tenantId, referral.referralId), referral);
    this.#referralByIdempotency.set(replayKey, referral.referralId);
    this.#emit(
      'care.learning-support.referral.submitted.v1',
      referral,
      referral.referralId,
      access.context.correlationId,
      { priority: referral.priority, referralCategory: referral.referralCategory },
    );
    return clone(referral);
  }

  acceptReferral(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      referralId: string;
      assignedLeadPrincipalId: string;
      accept: boolean;
    },
  ): LearningSupportReferral {
    const key = this.#key(input.tenantId, input.referralId);
    const referral = this.#referrals.get(key);
    if (!referral)
      throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Referral not found');
    this.#authorizeSource(access, referral, 'care.learning-support.referral.triage', 'amend', [
      'referral-triage',
    ]);
    if (referral.status !== 'submitted') {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_INVALID_TRANSITION',
        'Referral is not awaiting triage',
      );
    }
    const updated: LearningSupportReferral = {
      ...referral,
      assignedLeadPrincipalId: input.assignedLeadPrincipalId,
      status: input.accept ? 'accepted' : 'declined',
      version: referral.version + 1,
    };
    this.#referrals.set(key, updated);
    return clone(updated);
  }

  recordAssessment(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      referralId: string;
      needCategories: readonly string[];
      strengths: readonly string[];
      restrictedFindings: string;
      independentlyReviewedByPrincipalId: string;
      basisEvidence: LearningSupportBasisEvidence;
    },
  ): LearningSupportAssessment {
    this.#assertBasis(input.basisEvidence);
    const referral = this.#requireReferral(input.tenantId, input.referralId);
    if (referral.status !== 'accepted') {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_INVALID_TRANSITION',
        'Referral is not accepted',
      );
    }
    this.#authorizeSource(access, referral, 'care.learning-support.assessment.write', 'create', [
      'need-categories',
      'strengths',
      'restricted-findings',
    ]);
    const actor = access.context.principalId ?? 'missing-principal';
    if (actor === input.independentlyReviewedByPrincipalId) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
        'Assessment requires an independent reviewer',
      );
    }
    for (const current of this.#assessments.values()) {
      if (
        current.tenantId === input.tenantId &&
        current.referralId === input.referralId &&
        current.status === 'active'
      ) {
        this.#assessments.set(this.#key(current.tenantId, current.assessmentId), {
          ...current,
          status: 'superseded',
        });
      }
    }
    const assessment: LearningSupportAssessment = {
      tenantId: input.tenantId,
      assessmentId: this.#id('learning-support-assessment'),
      referralId: input.referralId,
      studentPersonId: referral.studentPersonId,
      needCategories: Object.freeze([...input.needCategories]),
      strengths: Object.freeze([...input.strengths]),
      restrictedFindings: input.restrictedFindings,
      assessedByPrincipalId: actor,
      independentlyReviewedByPrincipalId: input.independentlyReviewedByPrincipalId,
      assessedAt: this.#now(),
      status: 'active',
      version: 1,
    };
    this.#assessments.set(this.#key(assessment.tenantId, assessment.assessmentId), assessment);
    return clone(assessment);
  }

  createAccommodation(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      assessmentId: string;
      accommodationCode: string;
      category: LearningAccommodation['category'];
      classroomInstruction: string;
      restrictedRationale: string;
      validFrom: Date;
      validTo?: Date;
      approvedByPrincipalId: string;
    },
  ): LearningAccommodation {
    const assessment = this.#requireAssessment(input.tenantId, input.assessmentId);
    const referral = this.#requireReferral(input.tenantId, assessment.referralId);
    this.#authorizeSource(access, referral, 'care.learning-support.accommodation.write', 'create', [
      'accommodation-source',
    ]);
    if (input.validTo !== undefined && input.validTo <= input.validFrom) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_ACCOMMODATION_INVALID',
        'Accommodation validity is invalid',
      );
    }
    const actor = access.context.principalId ?? 'missing-principal';
    if (actor === input.approvedByPrincipalId) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
        'Accommodation requires an independent approver',
      );
    }
    const accommodation: LearningAccommodation = {
      tenantId: input.tenantId,
      accommodationId: this.#id('learning-accommodation'),
      assessmentId: input.assessmentId,
      studentPersonId: assessment.studentPersonId,
      accommodationCode: input.accommodationCode,
      category: input.category,
      classroomInstruction: input.classroomInstruction,
      restrictedRationale: input.restrictedRationale,
      validFrom: input.validFrom,
      ...(input.validTo ? { validTo: input.validTo } : {}),
      status: 'active',
      approvedByPrincipalId: input.approvedByPrincipalId,
      version: 1,
    };
    this.#accommodations.set(
      this.#key(accommodation.tenantId, accommodation.accommodationId),
      accommodation,
    );
    return clone(accommodation);
  }

  createPlan(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      referralId: string;
      title: string;
      goals: readonly Omit<LearningSupportGoal, 'goalId' | 'status'>[];
      accommodationIds: readonly string[];
      reviewAt: Date;
      approvedByPrincipalId?: string;
    },
  ): LearningSupportPlan {
    const referral = this.#requireReferral(input.tenantId, input.referralId);
    this.#authorizeSource(access, referral, 'care.learning-support.plan.write', 'create', [
      'support-plan',
    ]);
    const actor = access.context.principalId ?? 'missing-principal';
    if (input.approvedByPrincipalId !== undefined) {
      this.#requireAal2(access);
      if (input.approvedByPrincipalId === actor) {
        throw new LearningSupportDomainError(
          'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
          'Plan approver must differ from preparer',
        );
      }
    }
    for (const accommodationId of input.accommodationIds) {
      const accommodation = this.#accommodations.get(this.#key(input.tenantId, accommodationId));
      if (!accommodation || accommodation.studentPersonId !== referral.studentPersonId) {
        throw new LearningSupportDomainError(
          'LEARNING_SUPPORT_ACCOMMODATION_INVALID',
          'Plan accommodation is not valid for this student',
        );
      }
    }
    for (const current of this.#plans.values()) {
      if (
        current.tenantId === input.tenantId &&
        current.referralId === input.referralId &&
        current.status === 'active'
      ) {
        this.#plans.set(this.#key(current.tenantId, current.supportPlanId), {
          ...current,
          status: 'superseded',
        });
      }
    }
    const plan: LearningSupportPlan = {
      tenantId: input.tenantId,
      supportPlanId: this.#id('learning-support-plan'),
      referralId: input.referralId,
      studentPersonId: referral.studentPersonId,
      title: input.title,
      goals: Object.freeze(
        input.goals.map((goal) =>
          Object.freeze({
            ...goal,
            goalId: this.#id('learning-goal'),
            status: 'active' as const,
          }),
        ),
      ),
      accommodationIds: Object.freeze([...input.accommodationIds]),
      reviewAt: input.reviewAt,
      status: input.approvedByPrincipalId ? 'active' : 'draft',
      preparedByPrincipalId: actor,
      ...(input.approvedByPrincipalId
        ? { approvedByPrincipalId: input.approvedByPrincipalId }
        : {}),
      version: 1,
      createdAt: this.#now(),
    };
    this.#plans.set(this.#key(plan.tenantId, plan.supportPlanId), plan);
    if (plan.status === 'active') {
      this.#emit(
        'care.learning-support.plan.activated.v1',
        plan,
        plan.supportPlanId,
        access.context.correlationId,
        { planVersion: plan.version, goalCount: plan.goals.length },
      );
    }
    return clone(plan);
  }

  reviewPlan(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      supportPlanId: string;
      outcomeCode: LearningSupportPlanReview['outcomeCode'];
      goalOutcomeCodes: LearningSupportPlanReview['goalOutcomeCodes'];
      nextReviewAt?: Date;
      restrictedNote?: string;
      independentlyApprovedByPrincipalId: string;
    },
  ): LearningSupportPlanReview {
    const plan = this.#requirePlan(input.tenantId, input.supportPlanId);
    const referral = this.#requireReferral(input.tenantId, plan.referralId);
    this.#authorizeSource(access, referral, 'care.learning-support.plan.review', 'amend', [
      'plan-review',
    ]);
    const actor = access.context.principalId ?? 'missing-principal';
    if (actor === input.independentlyApprovedByPrincipalId) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
        'Plan review requires an independent approver',
      );
    }
    const review: LearningSupportPlanReview = {
      tenantId: input.tenantId,
      reviewId: this.#id('learning-plan-review'),
      supportPlanId: input.supportPlanId,
      studentPersonId: plan.studentPersonId,
      outcomeCode: input.outcomeCode,
      goalOutcomeCodes: Object.freeze({ ...input.goalOutcomeCodes }),
      ...(input.nextReviewAt ? { nextReviewAt: input.nextReviewAt } : {}),
      ...(input.restrictedNote ? { restrictedNote: input.restrictedNote } : {}),
      reviewedByPrincipalId: actor,
      independentlyApprovedByPrincipalId: input.independentlyApprovedByPrincipalId,
      reviewedAt: this.#now(),
    };
    this.#reviews.push(review);
    this.#emit(
      'care.learning-support.plan.reviewed.v1',
      plan,
      review.reviewId,
      access.context.correlationId,
      { outcomeCode: review.outcomeCode, planVersion: plan.version },
    );
    return clone(review);
  }

  readAssessment(
    access: LearningSupportAccessScope,
    tenantId: string,
    assessmentId: string,
  ): LearningSupportAssessment {
    const assessment = this.#requireAssessment(tenantId, assessmentId);
    const referral = this.#requireReferral(tenantId, assessment.referralId);
    this.#authorizeSource(access, referral, 'care.learning-support.assessment.read', 'read', [
      'need-categories',
      'strengths',
      'restricted-findings',
    ]);
    return clone(assessment);
  }

  readAcademicProjection(
    access: LearningSupportAccessScope,
    tenantId: string,
    supportPlanId: string,
  ): AcademicAccommodationProjection {
    const plan = this.#requirePlan(tenantId, supportPlanId);
    if (plan.status !== 'active') {
      throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Active plan not found');
    }
    this.#assertRelationship(access, plan.studentPersonId);
    this.#authorize(access, {
      tenantId,
      resourceId: plan.supportPlanId,
      studentPersonId: plan.studentPersonId,
      classification: 'CARE-C2',
      permission: 'care.learning-support.academic-projection.read',
      action: 'read',
      fields: ['accommodation-code', 'category', 'classroom-instruction'],
    });
    const now = this.#now();
    const accommodations = plan.accommodationIds
      .map((id) => this.#accommodations.get(this.#key(tenantId, id)))
      .filter(
        (item): item is LearningAccommodation =>
          item !== undefined &&
          item.status === 'active' &&
          item.validFrom <= now &&
          (item.validTo === undefined || item.validTo > now),
      )
      .map((item) =>
        Object.freeze({
          accommodationCode: item.accommodationCode,
          category: item.category,
          classroomInstruction: item.classroomInstruction,
        }),
      );
    const projection: AcademicAccommodationProjection = {
      tenantId,
      studentPersonId: plan.studentPersonId,
      supportPlanId: plan.supportPlanId,
      supportPlanVersion: plan.version,
      accommodations: Object.freeze(accommodations),
      generatedAt: now,
      expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    };
    this.#emit(
      'care.learning-support.academic-projection.generated.v1',
      plan,
      plan.supportPlanId,
      access.context.correlationId,
      { planVersion: plan.version, accommodationCount: accommodations.length },
    );
    return clone(projection);
  }

  publishSummary(
    access: LearningSupportAccessScope,
    input: {
      tenantId: string;
      supportPlanId: string;
      audience: 'student' | 'guardian';
      supportSummary: string;
      goalSummaries: readonly string[];
      nextReviewAt?: Date;
      expiresAt?: Date;
    },
  ): LearningSupportPublication {
    const plan = this.#requirePlan(input.tenantId, input.supportPlanId);
    const referral = this.#requireReferral(input.tenantId, plan.referralId);
    this.#requireAal2(access);
    this.#authorizeSource(access, referral, 'care.learning-support.publication.approve', 'amend', [
      'publication-projection',
    ]);
    const actor = access.context.principalId ?? 'missing-principal';
    if (actor === plan.preparedByPrincipalId) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
        'Plan preparer cannot approve publication',
      );
    }
    const prior = [...this.#publications.values()].filter(
      (item) =>
        item.tenantId === input.tenantId &&
        item.supportPlanId === input.supportPlanId &&
        item.audience === input.audience,
    );
    for (const current of prior) {
      if (current.status === 'released') {
        this.#publications.set(this.#key(current.tenantId, current.publicationId), {
          ...current,
          status: 'revoked',
        });
      }
    }
    const publication: LearningSupportPublication = {
      tenantId: input.tenantId,
      publicationId: this.#id('learning-publication'),
      supportPlanId: input.supportPlanId,
      studentPersonId: plan.studentPersonId,
      audience: input.audience,
      version: Math.max(0, ...prior.map((item) => item.version)) + 1,
      supportSummary: input.supportSummary,
      goalSummaries: Object.freeze([...input.goalSummaries]),
      ...(input.nextReviewAt ? { nextReviewAt: input.nextReviewAt } : {}),
      preparedByPrincipalId: plan.preparedByPrincipalId,
      approvedByPrincipalId: actor,
      effectiveFrom: this.#now(),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      status: 'released',
    };
    this.#publications.set(this.#key(publication.tenantId, publication.publicationId), publication);
    this.#emit(
      'care.learning-support.publication.released.v1',
      plan,
      publication.publicationId,
      access.context.correlationId,
      { audience: publication.audience, version: publication.version },
    );
    return clone(publication);
  }

  readPublishedSummary(
    access: LearningSupportAccessScope,
    tenantId: string,
    publicationId: string,
  ): LearningSupportPublicView {
    const publication = this.#publications.get(this.#key(tenantId, publicationId));
    if (
      !publication ||
      publication.status !== 'released' ||
      (publication.expiresAt !== undefined && publication.expiresAt <= this.#now())
    ) {
      throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Publication not found');
    }
    const release: CarePublicationDecision = {
      tenantId,
      studentPersonId: publication.studentPersonId,
      audience: publication.audience,
      version: publication.version,
      status: 'released',
      allowedFields: ['support-summary', 'goal-summaries', 'next-review-at'],
      effectiveFrom: publication.effectiveFrom,
      ...(publication.expiresAt ? { expiresAt: publication.expiresAt } : {}),
    };
    this.#authorize(
      { ...access, publication: release },
      {
        tenantId,
        resourceId: publication.supportPlanId,
        studentPersonId: publication.studentPersonId,
        classification: 'CARE-C2',
        permission: 'care.portal.read',
        action: 'read',
        fields: release.allowedFields,
      },
    );
    return {
      supportPlanId: publication.supportPlanId,
      studentPersonId: publication.studentPersonId,
      supportSummary: publication.supportSummary,
      goalSummaries: Object.freeze([...publication.goalSummaries]),
      ...(publication.nextReviewAt ? { nextReviewAt: publication.nextReviewAt } : {}),
      publicationVersion: publication.version,
    };
  }

  listEvents(tenantId: string): readonly LearningSupportEvent[] {
    return this.#events.filter((event) => event.tenantId === tenantId).map(clone);
  }

  snapshotForReports(tenantId: string): Readonly<{
    referrals: readonly LearningSupportReferral[];
    plans: readonly LearningSupportPlan[];
    reviews: readonly LearningSupportPlanReview[];
  }> {
    return {
      referrals: [...this.#referrals.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
      plans: [...this.#plans.values()].filter((item) => item.tenantId === tenantId).map(clone),
      reviews: this.#reviews.filter((item) => item.tenantId === tenantId).map(clone),
    };
  }

  #assertBasis(evidence: LearningSupportBasisEvidence): void {
    if (!basisActive(evidence, this.#now())) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_BASIS_INVALID',
        'An active legal basis is required',
      );
    }
  }

  #assertRelationship(access: LearningSupportAccessScope, studentPersonId: string): void {
    const relationship = access.relationship;
    if (
      !relationship ||
      relationship.studentPersonId !== studentPersonId ||
      !relationship.active ||
      (relationship.expiresAt !== undefined && relationship.expiresAt <= this.#now())
    ) {
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_RELATIONSHIP_REQUIRED',
        'A current student relationship is required',
      );
    }
  }

  #requireAal2(access: LearningSupportAccessScope): void {
    if (access.context.assurance !== 'aal2') {
      throw new LearningSupportDomainError('LEARNING_SUPPORT_AAL2_REQUIRED', 'AAL2 is required');
    }
  }

  #authorizeSource(
    access: LearningSupportAccessScope,
    source: { tenantId: string; studentPersonId: string; referralId: string },
    permission: string,
    action: 'read' | 'create' | 'amend',
    fields: readonly string[],
  ): void {
    this.#authorize(access, {
      tenantId: source.tenantId,
      resourceId: source.referralId,
      studentPersonId: source.studentPersonId,
      classification: 'CARE-C3',
      permission,
      action,
      fields,
    });
  }

  #authorize(
    access: LearningSupportAccessScope,
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
      throw new LearningSupportDomainError(
        'LEARNING_SUPPORT_ACCESS_DENIED',
        `Learning-support operation denied: ${decision.reason}`,
      );
    }
  }

  #requireReferral(tenantId: string, referralId: string): LearningSupportReferral {
    const referral = this.#referrals.get(this.#key(tenantId, referralId));
    if (!referral)
      throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Referral not found');
    return referral;
  }

  #requireAssessment(tenantId: string, assessmentId: string): LearningSupportAssessment {
    const assessment = this.#assessments.get(this.#key(tenantId, assessmentId));
    if (!assessment) {
      throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Assessment not found');
    }
    return assessment;
  }

  #requirePlan(tenantId: string, supportPlanId: string): LearningSupportPlan {
    const plan = this.#plans.get(this.#key(tenantId, supportPlanId));
    if (!plan) throw new LearningSupportDomainError('LEARNING_SUPPORT_NOT_FOUND', 'Plan not found');
    return plan;
  }

  #emit(
    eventType: LearningSupportEvent['eventType'],
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
