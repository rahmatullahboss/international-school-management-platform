import { describe, expect, test } from 'vitest';

import type { WellbeingDomainError } from '../../packages/modules/wellbeing/src/index.js';
import {
  WellbeingService,
  buildWellbeingOperationalReport,
  type WellbeingAccessScope,
  type WellbeingBasisEvidence,
} from '../../packages/modules/wellbeing/src/index.js';
import {
  CareSecurityService,
  type CareRequestContext,
} from '../../packages/modules/safeguarding/src/index.js';

const now = new Date('2026-07-29T06:00:00.000Z');
const basis: WellbeingBasisEvidence = {
  basis: 'public-task',
  evidenceReference: 'synthetic-wellbeing-policy-v1',
  status: 'active',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
};

function context(overrides: Partial<CareRequestContext> = {}): CareRequestContext {
  return {
    tenantId: 'tenant-a',
    principalId: 'counselor-1',
    linkedPersonId: 'counselor-person-1',
    persona: 'counselor',
    assurance: 'aal2',
    purpose: 'student-support-plan',
    correlationId: 'wellbeing-correlation-1',
    membershipActive: true,
    permissions: [
      'care.wellbeing.referral.create',
      'care.wellbeing.referral.triage',
      'care.wellbeing.case.create',
      'care.wellbeing.session.write',
      'care.wellbeing.session.read',
      'care.wellbeing.session.correct',
      'care.wellbeing.risk.assess',
      'care.wellbeing.plan.manage',
      'care.wellbeing.safeguarding.escalate',
      'care.wellbeing.publication.approve',
    ],
    ...overrides,
  };
}

function access(overrides: Partial<WellbeingAccessScope> = {}): WellbeingAccessScope {
  return {
    context: context(),
    relationship: { studentPersonId: 'student-1', active: true },
    ...overrides,
  };
}

function bootstrap(service: WellbeingService) {
  const referral = service.submitReferral(access(), {
    tenantId: 'tenant-a',
    studentPersonId: 'student-1',
    campusId: 'campus-1',
    referralCategory: 'pastoral-check-in',
    urgency: 'priority',
    referralSummary: 'Restricted synthetic pastoral referral summary',
    idempotencyKey: 'wellbeing-referral-1',
    basisEvidence: basis,
  });
  service.triageReferral(access(), {
    tenantId: 'tenant-a',
    referralId: referral.referralId,
    assignedCounselorPrincipalId: 'counselor-1',
    accept: true,
  });
  const counsellingCase = service.openCounsellingCase(access(), {
    tenantId: 'tenant-a',
    referralId: referral.referralId,
    basisEvidence: basis,
  });
  return { referral, counsellingCase };
}

describe('CARE-01 wellbeing and counselling domain', () => {
  test('requires active legal basis and supports idempotent scoped referrals', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    expect(() =>
      service.submitReferral(access(), {
        tenantId: 'tenant-a',
        studentPersonId: 'student-1',
        campusId: 'campus-1',
        referralCategory: 'pastoral-check-in',
        urgency: 'routine',
        referralSummary: 'Synthetic referral',
        idempotencyKey: 'invalid-basis-referral',
        basisEvidence: { ...basis, status: 'withdrawn' },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({ code: 'WELLBEING_BASIS_INVALID' }),
    );
    const teacherAccess = access({
      context: context({
        principalId: 'teacher-1',
        persona: 'teacher',
        assurance: 'aal1',
        permissions: ['care.wellbeing.referral.create'],
      }),
    });
    const referral = service.submitReferral(teacherAccess, {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      campusId: 'campus-1',
      referralCategory: 'pastoral-check-in',
      urgency: 'routine',
      referralSummary: 'Synthetic referral',
      idempotencyKey: 'teacher-referral-1',
      basisEvidence: basis,
    });
    expect(
      service.submitReferral(teacherAccess, {
        tenantId: 'tenant-a',
        studentPersonId: 'student-1',
        campusId: 'campus-1',
        referralCategory: 'ignored',
        urgency: 'urgent',
        referralSummary: 'Ignored replay',
        idempotencyKey: 'teacher-referral-1',
        basisEvidence: basis,
      }),
    ).toEqual(referral);
  });

  test('allows only assigned counselor to create and read confidential sessions', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);
    expect(() =>
      service.recordSession(access({ context: context({ principalId: 'counselor-2' }) }), {
        tenantId: 'tenant-a',
        counsellingCaseId: counsellingCase.counsellingCaseId,
        occurredAt: now,
        sessionType: 'check-in',
        restrictedNote: 'Restricted synthetic counselling note',
        controlledOutcomeCode: 'continue',
        basisEvidence: basis,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({
        code: 'WELLBEING_COUNSELOR_MISMATCH',
      }),
    );
    const session = service.recordSession(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      occurredAt: now,
      sessionType: 'check-in',
      restrictedNote: 'Restricted synthetic counselling note',
      controlledOutcomeCode: 'continue',
      basisEvidence: basis,
    });
    expect(() =>
      service.readSession(
        access({
          context: context({
            principalId: 'teacher-1',
            persona: 'teacher',
            permissions: ['care.wellbeing.session.read'],
          }),
        }),
        'tenant-a',
        session.sessionId,
      ),
    ).toThrow();
    expect(service.readSession(access(), 'tenant-a', session.sessionId)).toEqual(session);
    expect(() => service.readSession(access(), 'tenant-a', 'missing-session')).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({ code: 'WELLBEING_NOT_FOUND' }),
    );
  });

  test('records session corrections without rewriting source notes', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);
    const session = service.recordSession(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      occurredAt: now,
      sessionType: 'individual',
      restrictedNote: 'Original restricted note',
      controlledOutcomeCode: 'continue',
      basisEvidence: basis,
    });
    const correction = service.correctSession(access(), {
      tenantId: 'tenant-a',
      sessionId: session.sessionId,
      replacementOutcomeCode: 'review',
      reason: 'Synthetic outcome correction',
    });
    expect(service.readSession(access(), 'tenant-a', session.sessionId).controlledOutcomeCode).toBe(
      'continue',
    );
    expect(service.listSessionCorrections('tenant-a', session.sessionId)).toEqual([correction]);
  });

  test('keeps support plans draft until approved and records controlled plan reviews', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);

    const draft = service.createSupportPlan(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      goals: ['Maintain a predictable check-in routine'],
      interventions: ['Weekly counselor check-in'],
      reviewAt: new Date('2026-08-15T00:00:00.000Z'),
    });
    expect(draft).toMatchObject({
      counsellingCaseId: counsellingCase.counsellingCaseId,
      status: 'draft',
      version: 1,
    });
    expect(draft.approvedByPrincipalId).toBeUndefined();

    const active = service.createSupportPlan(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      goals: ['Maintain a predictable check-in routine'],
      interventions: ['Weekly counselor check-in'],
      reviewAt: new Date('2026-08-20T00:00:00.000Z'),
      approvedByPrincipalId: 'wellbeing-reviewer-1',
    });
    expect(active).toMatchObject({
      status: 'active',
      approvedByPrincipalId: 'wellbeing-reviewer-1',
    });

    const review = service.reviewSupportPlan(access(), {
      tenantId: 'tenant-a',
      supportPlanId: active.supportPlanId,
      outcomeCode: 'continue',
      nextReviewAt: new Date('2026-09-01T00:00:00.000Z'),
      restrictedNote: 'Synthetic restricted review note',
    });
    expect(review).toMatchObject({
      supportPlanId: active.supportPlanId,
      outcomeCode: 'continue',
      reviewedByPrincipalId: 'counselor-1',
    });
    expect(review.nextReviewAt).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(review.restrictedNote).toBe('Synthetic restricted review note');
  });

  test('fails closed when support-plan access is unassigned or the plan does not exist', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);

    expect(() =>
      service.createSupportPlan(access({ context: context({ principalId: 'counselor-2' }) }), {
        tenantId: 'tenant-a',
        counsellingCaseId: counsellingCase.counsellingCaseId,
        goals: ['Synthetic denied goal'],
        interventions: ['Synthetic denied intervention'],
        reviewAt: new Date('2026-08-15T00:00:00.000Z'),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({
        code: 'WELLBEING_COUNSELOR_MISMATCH',
      }),
    );

    expect(() =>
      service.reviewSupportPlan(access(), {
        tenantId: 'tenant-a',
        supportPlanId: 'missing-plan',
        outcomeCode: 'continue',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({ code: 'WELLBEING_NOT_FOUND' }),
    );
  });

  test('requires AAL2 for high risk and safeguarding escalation while emitting no narrative', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);
    expect(() =>
      service.assessRisk(access({ context: context({ assurance: 'aal1' }) }), {
        tenantId: 'tenant-a',
        counsellingCaseId: counsellingCase.counsellingCaseId,
        riskLevel: 'high',
        factors: ['restricted-factor'],
        protectiveFactors: ['restricted-protective-factor'],
        requiredActions: ['restricted-action'],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({
        code: 'WELLBEING_RISK_REQUIRES_AAL2',
      }),
    );
    service.assessRisk(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      riskLevel: 'high',
      factors: ['restricted-factor'],
      protectiveFactors: ['restricted-protective-factor'],
      requiredActions: ['restricted-action'],
    });
    service.assessRisk(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      riskLevel: 'immediate',
      factors: ['updated-restricted-factor'],
      protectiveFactors: ['updated-protective-factor'],
      requiredActions: ['updated-restricted-action'],
    });
    expect(() =>
      service.requestSafeguardingEscalation(access({ context: context({ assurance: 'aal1' }) }), {
        tenantId: 'tenant-a',
        counsellingCaseId: counsellingCase.counsellingCaseId,
        urgency: 'immediate',
        reasonCategory: 'student-safety',
        safeguardingIntakeReference: 'opaque-safeguarding-intake-denied',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({
        code: 'WELLBEING_RISK_REQUIRES_AAL2',
      }),
    );
    const escalation = service.requestSafeguardingEscalation(access(), {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      urgency: 'high',
      reasonCategory: 'student-safety',
      safeguardingIntakeReference: 'opaque-safeguarding-intake-1',
    });
    expect(escalation.status).toBe('requested');
    const events = JSON.stringify(service.listEvents('tenant-a'));
    expect(events).not.toContain('restricted-factor');
    expect(events).not.toContain('restricted-action');
    expect(events).not.toContain('Restricted synthetic pastoral referral summary');
  });

  test('requires independent AAL2 approval and returns only minimized guardian release', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);
    expect(() =>
      service.publishSupportSummary(access(), {
        tenantId: 'tenant-a',
        counsellingCaseId: counsellingCase.counsellingCaseId,
        audience: 'guardian',
        supportSummary: 'Approved support is active.',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({
        code: 'WELLBEING_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );
    const publication = service.publishSupportSummary(
      access({
        context: context({
          principalId: 'privacy-reviewer-1',
          persona: 'privacy-reviewer',
        }),
      }),
      {
        tenantId: 'tenant-a',
        counsellingCaseId: counsellingCase.counsellingCaseId,
        audience: 'guardian',
        supportSummary: 'Approved support is active.',
        nextReviewAt: new Date('2026-08-15T00:00:00.000Z'),
      },
    );
    const guardianAccess: WellbeingAccessScope = {
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
    expect(view.supportSummary).toBe('Approved support is active.');
    expect(JSON.stringify(view)).not.toContain('Restricted synthetic pastoral referral summary');
    expect(JSON.stringify(view)).not.toContain('riskLevel');
  });

  test('versions publication releases, revokes prior releases and fails closed for AAL1 or expired views', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    const { counsellingCase } = bootstrap(service);
    const reviewerAccess = access({
      context: context({
        principalId: 'privacy-reviewer-1',
        persona: 'privacy-reviewer',
      }),
    });

    expect(() =>
      service.publishSupportSummary(
        {
          ...reviewerAccess,
          context: { ...reviewerAccess.context, assurance: 'aal1' },
        },
        {
          tenantId: 'tenant-a',
          counsellingCaseId: counsellingCase.counsellingCaseId,
          audience: 'guardian',
          supportSummary: 'Synthetic denied low-assurance release.',
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({
        code: 'WELLBEING_PUBLICATION_REQUIRES_AAL2',
      }),
    );

    const first = service.publishSupportSummary(reviewerAccess, {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      audience: 'guardian',
      supportSummary: 'Approved support summary version one.',
    });
    const second = service.publishSupportSummary(reviewerAccess, {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      audience: 'guardian',
      supportSummary: 'Approved support summary version two.',
      nextReviewAt: new Date('2026-08-20T00:00:00.000Z'),
      expiresAt: new Date('2026-08-30T00:00:00.000Z'),
    });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const guardianAccess: WellbeingAccessScope = {
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
      expect.objectContaining<Partial<WellbeingDomainError>>({ code: 'WELLBEING_NOT_FOUND' }),
    );
    expect(
      service.readPublishedSummary(guardianAccess, 'tenant-a', second.publicationId),
    ).toMatchObject({
      supportSummary: 'Approved support summary version two.',
      publicationVersion: 2,
      nextReviewAt: new Date('2026-08-20T00:00:00.000Z'),
    });

    const expired = service.publishSupportSummary(reviewerAccess, {
      tenantId: 'tenant-a',
      counsellingCaseId: counsellingCase.counsellingCaseId,
      audience: 'student',
      supportSummary: 'Expired synthetic release.',
      expiresAt: now,
    });
    expect(() =>
      service.readPublishedSummary(guardianAccess, 'tenant-a', expired.publicationId),
    ).toThrowError(
      expect.objectContaining<Partial<WellbeingDomainError>>({ code: 'WELLBEING_NOT_FOUND' }),
    );
  });

  test('suppresses small operational cohorts and excludes restricted fields', () => {
    const service = new WellbeingService(new CareSecurityService({ now: () => now }), () => now);
    bootstrap(service);
    const report = buildWellbeingOperationalReport({
      tenantId: 'tenant-a',
      ...service.snapshotForReports('tenant-a'),
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(report.referrals).toEqual({ value: null, suppressed: true });
    expect(JSON.stringify(report)).not.toContain('referralSummary');
    expect(JSON.stringify(report)).not.toContain('factors');
  });
});
