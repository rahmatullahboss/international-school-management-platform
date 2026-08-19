import { describe, expect, test } from 'vitest';

import type { LearningSupportDomainError } from '../../packages/modules/learning-support/src/index.js';
import {
  LearningSupportService,
  buildLearningSupportOperationalReport,
  type LearningSupportAccessScope,
  type LearningSupportBasisEvidence,
} from '../../packages/modules/learning-support/src/index.js';
import {
  CareSecurityService,
  type CareRequestContext,
} from '../../packages/modules/safeguarding/src/index.js';

const now = new Date('2026-07-29T08:00:00.000Z');
const basis: LearningSupportBasisEvidence = {
  basis: 'public-task',
  evidenceReference: 'synthetic-learning-support-policy-v1',
  status: 'active',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
};

function context(overrides: Partial<CareRequestContext> = {}): CareRequestContext {
  return {
    tenantId: 'tenant-a',
    principalId: 'learning-support-1',
    linkedPersonId: 'learning-support-person-1',
    persona: 'learning-support',
    assurance: 'aal2',
    purpose: 'student-support-plan',
    correlationId: 'learning-support-correlation-1',
    membershipActive: true,
    permissions: [
      'care.learning-support.referral.create',
      'care.learning-support.referral.triage',
      'care.learning-support.assessment.write',
      'care.learning-support.assessment.read',
      'care.learning-support.accommodation.write',
      'care.learning-support.plan.write',
      'care.learning-support.plan.review',
      'care.learning-support.academic-projection.read',
      'care.learning-support.publication.approve',
    ],
    ...overrides,
  };
}

function access(overrides: Partial<LearningSupportAccessScope> = {}): LearningSupportAccessScope {
  return {
    context: context(),
    relationship: { studentPersonId: 'student-1', active: true },
    ...overrides,
  };
}

function bootstrap(service: LearningSupportService) {
  const teacherAccess = access({
    context: context({
      principalId: 'teacher-1',
      linkedPersonId: 'teacher-person-1',
      persona: 'teacher',
      assurance: 'aal1',
      permissions: ['care.learning-support.referral.create'],
    }),
  });
  const referral = service.submitReferral(teacherAccess, {
    tenantId: 'tenant-a',
    studentPersonId: 'student-1',
    campusId: 'campus-1',
    referralCategory: 'classroom-access',
    priority: 'priority',
    classroomSummary: 'Restricted synthetic classroom summary',
    idempotencyKey: 'learning-referral-1',
    basisEvidence: basis,
  });
  service.acceptReferral(access(), {
    tenantId: 'tenant-a',
    referralId: referral.referralId,
    assignedLeadPrincipalId: 'learning-support-1',
    accept: true,
  });
  const assessment = service.recordAssessment(access(), {
    tenantId: 'tenant-a',
    referralId: referral.referralId,
    needCategories: ['synthetic-access-need'],
    strengths: ['synthetic-strength'],
    restrictedFindings: 'Restricted synthetic assessment findings',
    independentlyReviewedByPrincipalId: 'learning-reviewer-2',
    basisEvidence: basis,
  });
  const accommodation = service.createAccommodation(access(), {
    tenantId: 'tenant-a',
    assessmentId: assessment.assessmentId,
    accommodationCode: 'extra-processing-time',
    category: 'instruction',
    classroomInstruction: 'Allow approved additional processing time.',
    restrictedRationale: 'Restricted synthetic rationale',
    validFrom: new Date('2026-07-01T00:00:00.000Z'),
    approvedByPrincipalId: 'learning-reviewer-2',
  });
  const plan = service.createPlan(access(), {
    tenantId: 'tenant-a',
    referralId: referral.referralId,
    title: 'Synthetic access plan',
    goals: [
      {
        title: 'Use approved classroom supports',
        successMeasure: 'Controlled synthetic measure',
        targetDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    ],
    accommodationIds: [accommodation.accommodationId],
    reviewAt: new Date('2026-09-01T00:00:00.000Z'),
    approvedByPrincipalId: 'learning-reviewer-2',
  });
  return { teacherAccess, referral, assessment, accommodation, plan };
}

describe('CARE-01 learning-support domain', () => {
  test('requires active legal basis, current relationship and idempotent referral intake', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    expect(() =>
      service.submitReferral(access(), {
        tenantId: 'tenant-a',
        studentPersonId: 'student-1',
        campusId: 'campus-1',
        referralCategory: 'classroom-access',
        priority: 'routine',
        classroomSummary: 'Synthetic summary',
        idempotencyKey: 'invalid-basis',
        basisEvidence: { ...basis, status: 'withdrawn' },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_BASIS_INVALID',
      }),
    );
    const { teacherAccess, referral } = bootstrap(service);
    const replay = service.submitReferral(teacherAccess, {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      campusId: 'campus-1',
      referralCategory: 'ignored',
      priority: 'urgent',
      classroomSummary: 'Ignored replay',
      idempotencyKey: 'learning-referral-1',
      basisEvidence: basis,
    });
    expect(replay).toMatchObject({
      referralId: referral.referralId,
      idempotencyKey: referral.idempotencyKey,
      status: 'accepted',
      version: 2,
      assignedLeadPrincipalId: 'learning-support-1',
    });
  });

  test('denies teachers access to CARE-C3 assessment source', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { teacherAccess, assessment } = bootstrap(service);
    expect(() =>
      service.readAssessment(
        {
          ...teacherAccess,
          context: context({
            principalId: 'teacher-1',
            persona: 'teacher',
            assurance: 'aal1',
            permissions: ['care.learning-support.assessment.read'],
          }),
        },
        'tenant-a',
        assessment.assessmentId,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_ACCESS_DENIED',
      }),
    );
    expect(service.readAssessment(access(), 'tenant-a', assessment.assessmentId)).toEqual(
      assessment,
    );
  });

  test('requires AAL2 and independent approval for active plans', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { referral, accommodation } = bootstrap(service);
    expect(() =>
      service.createPlan(access({ context: context({ assurance: 'aal1' }) }), {
        tenantId: 'tenant-a',
        referralId: referral.referralId,
        title: 'Invalid plan',
        goals: [],
        accommodationIds: [accommodation.accommodationId],
        reviewAt: new Date('2026-09-01T00:00:00.000Z'),
        approvedByPrincipalId: 'learning-reviewer-2',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_AAL2_REQUIRED',
      }),
    );
    expect(() =>
      service.createPlan(access(), {
        tenantId: 'tenant-a',
        referralId: referral.referralId,
        title: 'Invalid self-approved plan',
        goals: [],
        accommodationIds: [accommodation.accommodationId],
        reviewAt: new Date('2026-09-01T00:00:00.000Z'),
        approvedByPrincipalId: 'learning-support-1',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );
  });

  test('requires independent approval for plan reviews and records only controlled review outcomes', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { plan } = bootstrap(service);

    expect(() =>
      service.reviewPlan(access(), {
        tenantId: 'tenant-a',
        supportPlanId: plan.supportPlanId,
        outcomeCode: 'continue',
        goalOutcomeCodes: { 'goal-1': 'continue' },
        independentlyApprovedByPrincipalId: 'learning-support-1',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );

    const review = service.reviewPlan(access(), {
      tenantId: 'tenant-a',
      supportPlanId: plan.supportPlanId,
      outcomeCode: 'continue',
      goalOutcomeCodes: { 'goal-1': 'continue' },
      nextReviewAt: new Date('2026-10-01T00:00:00.000Z'),
      restrictedNote: 'Synthetic restricted plan-review note',
      independentlyApprovedByPrincipalId: 'learning-reviewer-3',
    });
    expect(review).toMatchObject({
      supportPlanId: plan.supportPlanId,
      outcomeCode: 'continue',
      goalOutcomeCodes: { 'goal-1': 'continue' },
      reviewedByPrincipalId: 'learning-support-1',
      independentlyApprovedByPrincipalId: 'learning-reviewer-3',
    });
    expect(review.nextReviewAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(review.restrictedNote).toBe('Synthetic restricted plan-review note');

    expect(() =>
      service.reviewPlan(access(), {
        tenantId: 'tenant-a',
        supportPlanId: 'missing-plan',
        outcomeCode: 'continue',
        goalOutcomeCodes: {},
        independentlyApprovedByPrincipalId: 'learning-reviewer-3',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_NOT_FOUND',
      }),
    );
  });

  test('keeps draft plans out of the minimized academic projection', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { referral, accommodation } = bootstrap(service);
    const draft = service.createPlan(access(), {
      tenantId: 'tenant-a',
      referralId: referral.referralId,
      title: 'Draft synthetic access plan',
      goals: [],
      accommodationIds: [accommodation.accommodationId],
      reviewAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(draft.status).toBe('draft');

    const teacherProjectionAccess = access({
      context: context({
        principalId: 'teacher-2',
        persona: 'teacher',
        assurance: 'aal1',
        permissions: ['care.learning-support.academic-projection.read'],
      }),
    });
    expect(() =>
      service.readAcademicProjection(teacherProjectionAccess, 'tenant-a', draft.supportPlanId),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_NOT_FOUND',
      }),
    );
  });

  test('returns only minimized classroom accommodations through the academic contract', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { plan } = bootstrap(service);
    const teacherProjectionAccess = access({
      context: context({
        principalId: 'teacher-2',
        persona: 'teacher',
        assurance: 'aal1',
        permissions: ['care.learning-support.academic-projection.read'],
      }),
    });
    const projection = service.readAcademicProjection(
      teacherProjectionAccess,
      'tenant-a',
      plan.supportPlanId,
    );
    expect(projection.accommodations).toEqual([
      {
        accommodationCode: 'extra-processing-time',
        category: 'instruction',
        classroomInstruction: 'Allow approved additional processing time.',
      },
    ]);
    expect(JSON.stringify(projection)).not.toContain('Restricted synthetic rationale');
    expect(JSON.stringify(projection)).not.toContain('Restricted synthetic assessment findings');
    expect(JSON.stringify(projection)).not.toContain('needCategories');
  });

  test('publishes only independently approved minimized guardian projection', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { plan } = bootstrap(service);
    expect(() =>
      service.publishSummary(access(), {
        tenantId: 'tenant-a',
        supportPlanId: plan.supportPlanId,
        audience: 'guardian',
        supportSummary: 'Approved supports are active.',
        goalSummaries: ['Review progress at the scheduled date.'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );
    const publication = service.publishSummary(
      access({
        context: context({
          principalId: 'privacy-reviewer-1',
          persona: 'privacy-reviewer',
        }),
      }),
      {
        tenantId: 'tenant-a',
        supportPlanId: plan.supportPlanId,
        audience: 'guardian',
        supportSummary: 'Approved supports are active.',
        goalSummaries: ['Review progress at the scheduled date.'],
        nextReviewAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    );
    const guardianAccess: LearningSupportAccessScope = {
      context: context({
        principalId: 'guardian-account-1',
        linkedPersonId: 'guardian-1',
        persona: 'guardian',
        assurance: 'aal1',
        purpose: 'legal-rights-response',
        permissions: ['care.portal.read'],
      }),
      guardianAuthority: {
        tenantId: 'tenant-a',
        guardianPersonId: 'guardian-1',
        studentPersonId: 'student-1',
        authorities: ['portal'],
        verificationStatus: 'verified',
        portalAccess: true,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      },
    };
    const view = service.readPublishedSummary(
      guardianAccess,
      'tenant-a',
      publication.publicationId,
    );
    expect(view.supportSummary).toBe('Approved supports are active.');
    expect(JSON.stringify(view)).not.toContain('restrictedFindings');
    expect(JSON.stringify(view)).not.toContain('restrictedRationale');
    expect(JSON.stringify(view)).not.toContain('needCategories');
  });

  test('versions minimized publication, revokes prior releases and denies low-assurance or expired views', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    const { plan } = bootstrap(service);
    const reviewerAccess = access({
      context: context({
        principalId: 'privacy-reviewer-1',
        persona: 'privacy-reviewer',
      }),
    });

    expect(() =>
      service.publishSummary(
        { ...reviewerAccess, context: { ...reviewerAccess.context, assurance: 'aal1' } },
        {
          tenantId: 'tenant-a',
          supportPlanId: plan.supportPlanId,
          audience: 'guardian',
          supportSummary: 'Synthetic denied low-assurance publication.',
          goalSummaries: [],
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_AAL2_REQUIRED',
      }),
    );

    const first = service.publishSummary(reviewerAccess, {
      tenantId: 'tenant-a',
      supportPlanId: plan.supportPlanId,
      audience: 'guardian',
      supportSummary: 'Approved support summary version one.',
      goalSummaries: ['Use the approved classroom support.'],
    });
    const second = service.publishSummary(reviewerAccess, {
      tenantId: 'tenant-a',
      supportPlanId: plan.supportPlanId,
      audience: 'guardian',
      supportSummary: 'Approved support summary version two.',
      goalSummaries: ['Continue the approved classroom support.'],
      nextReviewAt: new Date('2026-10-01T00:00:00.000Z'),
      expiresAt: new Date('2026-10-15T00:00:00.000Z'),
    });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const guardianAccess: LearningSupportAccessScope = {
      context: context({
        principalId: 'guardian-account-1',
        linkedPersonId: 'guardian-1',
        persona: 'guardian',
        assurance: 'aal1',
        purpose: 'legal-rights-response',
        permissions: ['care.portal.read'],
      }),
      guardianAuthority: {
        tenantId: 'tenant-a',
        guardianPersonId: 'guardian-1',
        studentPersonId: 'student-1',
        authorities: ['portal'],
        verificationStatus: 'verified',
        portalAccess: true,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      },
    };
    expect(() =>
      service.readPublishedSummary(guardianAccess, 'tenant-a', first.publicationId),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_NOT_FOUND',
      }),
    );
    expect(
      service.readPublishedSummary(guardianAccess, 'tenant-a', second.publicationId),
    ).toMatchObject({
      supportSummary: 'Approved support summary version two.',
      publicationVersion: 2,
      nextReviewAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    const expired = service.publishSummary(reviewerAccess, {
      tenantId: 'tenant-a',
      supportPlanId: plan.supportPlanId,
      audience: 'student',
      supportSummary: 'Expired synthetic learning-support publication.',
      goalSummaries: [],
      expiresAt: now,
    });
    expect(() =>
      service.readPublishedSummary(guardianAccess, 'tenant-a', expired.publicationId),
    ).toThrowError(
      expect.objectContaining<Partial<LearningSupportDomainError>>({
        code: 'LEARNING_SUPPORT_NOT_FOUND',
      }),
    );
  });

  test('emits minimum events and suppresses small operational cohorts', () => {
    const service = new LearningSupportService(
      new CareSecurityService({ now: () => now }),
      () => now,
    );
    bootstrap(service);
    const events = JSON.stringify(service.listEvents('tenant-a'));
    expect(events).not.toContain('Restricted synthetic classroom summary');
    expect(events).not.toContain('Restricted synthetic assessment findings');
    expect(events).not.toContain('Restricted synthetic rationale');

    const report = buildLearningSupportOperationalReport({
      tenantId: 'tenant-a',
      ...service.snapshotForReports('tenant-a'),
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(report.referrals).toEqual({ value: null, suppressed: true });
    expect(JSON.stringify(report)).not.toContain('classroomSummary');
    expect(JSON.stringify(report)).not.toContain('goals');
  });
});
