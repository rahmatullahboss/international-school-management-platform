import { describe, expect, test } from 'vitest';

import type { SafeguardingDomainError } from '../../packages/modules/safeguarding/src/index.js';
import {
  CareSecurityService,
  SafeguardingService,
  buildSafeguardingOperationalReport,
  type CareRequestContext,
  type SafeguardingAccessScope,
} from '../../packages/modules/safeguarding/src/index.js';

const now = new Date('2026-07-29T07:00:00.000Z');

function context(overrides: Partial<CareRequestContext> = {}): CareRequestContext {
  return {
    tenantId: 'tenant-a',
    principalId: 'safeguarding-lead-1',
    linkedPersonId: 'safeguarding-lead-person-1',
    persona: 'safeguarding-lead',
    assurance: 'aal2',
    purpose: 'safeguarding-assessment',
    correlationId: 'safeguarding-correlation-1',
    membershipActive: true,
    permissions: [
      'care.safeguarding.concern.create',
      'care.safeguarding.case.open',
      'care.safeguarding.read',
      'care.safeguarding.case.write',
      'care.safeguarding.membership.manage',
      'care.safeguarding.assessment.write',
      'care.safeguarding.plan.write',
      'care.safeguarding.report.approve',
      'care.safeguarding.report.submit',
      'care.safeguarding.disclosure.approve',
      'care.safeguarding.disclosure.generate',
      'care.safeguarding.document.write',
      'care.safeguarding.case.close',
    ],
    ...overrides,
  };
}

function relationship() {
  return { studentPersonId: 'student-1', active: true as const };
}

function access(overrides: Partial<SafeguardingAccessScope> = {}): SafeguardingAccessScope {
  return { context: context(), relationship: relationship(), ...overrides };
}

function submitAndOpen(service: SafeguardingService) {
  const teacherAccess: SafeguardingAccessScope = {
    context: context({
      principalId: 'teacher-1',
      linkedPersonId: 'teacher-person-1',
      persona: 'teacher',
      assurance: 'aal1',
      purpose: 'mandatory-reporting',
      permissions: ['care.safeguarding.concern.create', 'care.safeguarding.read'],
    }),
    relationship: relationship(),
  };
  const receipt = service.submitConcern(teacherAccess, {
    tenantId: 'tenant-a',
    studentPersonId: 'student-1',
    campusId: 'campus-1',
    concernCategory: 'student-safety',
    urgency: 'priority',
    concernNarrative: 'Restricted synthetic safeguarding concern narrative',
    reporterRelationship: 'teacher',
    idempotencyKey: 'safeguarding-concern-1',
  });
  const opened = service.openCase(access(), {
    tenantId: 'tenant-a',
    concernId: receipt.concernId,
    leadPrincipalId: 'safeguarding-lead-1',
    riskBand: 'elevated',
    initialMembershipExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
    approvalReference: 'synthetic-case-bootstrap-approval',
  });
  const leadAccess: SafeguardingAccessScope = {
    context: context(),
    caseMembership: opened.leadMembership,
  };
  return { teacherAccess, receipt, ...opened, leadAccess };
}

describe('CARE-01 safeguarding domain', () => {
  test('accepts idempotent write-only concern intake and masks later teacher reads', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { teacherAccess, receipt, caseFile } = submitAndOpen(service);
    const replay = service.submitConcern(teacherAccess, {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      campusId: 'campus-1',
      concernCategory: 'ignored',
      urgency: 'immediate',
      concernNarrative: 'Ignored replay payload',
      reporterRelationship: 'teacher',
      idempotencyKey: 'safeguarding-concern-1',
    });
    expect(replay).toMatchObject({ concernId: receipt.concernId, duplicate: true });
    expect(() => service.readCase(teacherAccess, 'tenant-a', caseFile.caseId)).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_ACCESS_DENIED',
      }),
    );
  });

  test('requires current exact membership and honors revocation immediately', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess } = submitAndOpen(service);
    expect(service.readCase(leadAccess, 'tenant-a', caseFile.caseId)).toEqual(caseFile);

    const membership = service.grantMembership(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      principalId: 'case-member-2',
      caseRole: 'case-member',
      purpose: 'safeguarding-assessment',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      approvalReference: 'synthetic-membership-approval',
    });
    const memberAccess: SafeguardingAccessScope = {
      context: context({
        principalId: 'case-member-2',
        persona: 'safeguarding-case-member',
      }),
      caseMembership: membership,
    };
    expect(service.readCase(memberAccess, 'tenant-a', caseFile.caseId).caseId).toBe(
      caseFile.caseId,
    );
    service.revokeMembership(leadAccess, {
      tenantId: 'tenant-a',
      membershipId: membership.membershipId,
      reason: 'Synthetic immediate revocation',
    });
    expect(() => service.readCase(memberAccess, 'tenant-a', caseFile.caseId)).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_ACCESS_DENIED',
      }),
    );
  });

  test('fails closed for machine intake, expired bootstrap and unsafe membership changes', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const teacherAccess: SafeguardingAccessScope = {
      context: context({
        principalId: 'teacher-1',
        linkedPersonId: 'teacher-person-1',
        persona: 'teacher',
        assurance: 'aal1',
        purpose: 'mandatory-reporting',
        permissions: ['care.safeguarding.concern.create', 'care.safeguarding.read'],
        machineCredential: true,
      }),
      relationship: relationship(),
    };
    expect(() =>
      service.submitConcern(teacherAccess, {
        tenantId: 'tenant-a',
        studentPersonId: 'student-1',
        campusId: 'campus-1',
        concernCategory: 'student-safety',
        urgency: 'priority',
        concernNarrative: 'Synthetic denied machine concern',
        reporterRelationship: 'integration',
        idempotencyKey: 'machine-denied-concern',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_ACCESS_DENIED',
      }),
    );

    const humanAccess = {
      ...teacherAccess,
      context: { ...teacherAccess.context, machineCredential: false },
    };
    const receipt = service.submitConcern(humanAccess, {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      campusId: 'campus-1',
      concernCategory: 'student-safety',
      urgency: 'priority',
      concernNarrative: 'Synthetic bootstrap concern',
      reporterRelationship: 'teacher',
      idempotencyKey: 'bootstrap-concern',
    });
    expect(() =>
      service.openCase(access(), {
        tenantId: 'tenant-a',
        concernId: receipt.concernId,
        leadPrincipalId: 'safeguarding-lead-1',
        riskBand: 'elevated',
        initialMembershipExpiresAt: now,
        approvalReference: 'expired-bootstrap-approval',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_MEMBERSHIP_INVALID',
      }),
    );

    const opened = service.openCase(access(), {
      tenantId: 'tenant-a',
      concernId: receipt.concernId,
      leadPrincipalId: 'safeguarding-lead-1',
      riskBand: 'elevated',
      initialMembershipExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
      approvalReference: 'bootstrap-approval',
    });
    const replay = service.openCase(access(), {
      tenantId: 'tenant-a',
      concernId: receipt.concernId,
      leadPrincipalId: 'safeguarding-lead-1',
      riskBand: 'critical',
      initialMembershipExpiresAt: new Date('2026-08-02T00:00:00.000Z'),
      approvalReference: 'ignored-replay-approval',
    });
    expect(replay).toEqual(opened);

    const leadAccess: SafeguardingAccessScope = {
      context: context(),
      caseMembership: opened.leadMembership,
    };
    expect(() =>
      service.grantMembership(leadAccess, {
        tenantId: 'tenant-a',
        caseId: opened.caseFile.caseId,
        principalId: 'safeguarding-lead-1',
        caseRole: 'lead',
        purpose: 'safeguarding-assessment',
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        approvalReference: 'self-grant-denied',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );
    expect(() =>
      service.grantMembership(leadAccess, {
        tenantId: 'tenant-a',
        caseId: opened.caseFile.caseId,
        principalId: 'case-member-3',
        caseRole: 'case-member',
        purpose: 'safeguarding-assessment',
        expiresAt: now,
        approvalReference: 'expired-membership',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_MEMBERSHIP_INVALID',
      }),
    );

    const first = service.grantMembership(leadAccess, {
      tenantId: 'tenant-a',
      caseId: opened.caseFile.caseId,
      principalId: 'case-member-3',
      caseRole: 'case-member',
      purpose: 'safeguarding-assessment',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      approvalReference: 'membership-v1',
    });
    const replacement = service.grantMembership(leadAccess, {
      tenantId: 'tenant-a',
      caseId: opened.caseFile.caseId,
      principalId: 'case-member-3',
      caseRole: 'case-member',
      purpose: 'safeguarding-assessment',
      expiresAt: new Date('2026-08-02T00:00:00.000Z'),
      approvalReference: 'membership-v2',
    });
    expect(replacement.membershipId).not.toBe(first.membershipId);
    expect(
      service.activeMembership(
        'tenant-a',
        opened.caseFile.caseId,
        'case-member-3',
        'safeguarding-assessment',
      ),
    ).toEqual(replacement);

    expect(() =>
      service.revokeMembership(leadAccess, {
        tenantId: 'tenant-a',
        membershipId: 'missing-membership',
        reason: 'synthetic missing membership',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({ code: 'SAFEGUARDING_NOT_FOUND' }),
    );
  });

  test('keeps chronology append-only and requires independent AAL2 assessment review', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess } = submitAndOpen(service);
    const chronology = service.addChronology(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      occurredAt: now,
      entryCategory: 'contact',
      restrictedNarrative: 'Restricted synthetic chronology narrative',
    });
    expect(service.readChronology(leadAccess, 'tenant-a', caseFile.caseId)).toEqual([chronology]);
    expect(() =>
      service.assessCase(
        { ...leadAccess, context: context({ assurance: 'aal1' }) },
        {
          tenantId: 'tenant-a',
          caseId: caseFile.caseId,
          riskLevel: 'critical',
          controlledFactors: ['restricted-factor'],
          requiredActions: ['restricted-action'],
          independentlyReviewedByPrincipalId: 'reviewer-2',
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_AAL2_REQUIRED',
      }),
    );
    expect(() =>
      service.assessCase(leadAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        riskLevel: 'critical',
        controlledFactors: ['restricted-factor'],
        requiredActions: ['restricted-action'],
        independentlyReviewedByPrincipalId: 'safeguarding-lead-1',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );
    expect(
      service.assessCase(leadAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        riskLevel: 'critical',
        controlledFactors: ['restricted-factor'],
        requiredActions: ['restricted-action'],
        independentlyReviewedByPrincipalId: 'reviewer-2',
      }),
    ).toMatchObject({ status: 'active', riskLevel: 'critical' });
  });

  test('binds reports and disclosures to exact approved purpose, fields and recipient', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess } = submitAndOpen(service);
    const reportMembership = service.grantMembership(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      principalId: 'mandatory-reporter-2',
      caseRole: 'case-member',
      purpose: 'mandatory-reporting',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      approvalReference: 'synthetic-mandatory-membership',
    });
    const reportAccess: SafeguardingAccessScope = {
      context: context({
        principalId: 'mandatory-reporter-2',
        persona: 'safeguarding-case-member',
        purpose: 'mandatory-reporting',
        permissions: ['care.safeguarding.report.approve', 'care.safeguarding.report.submit'],
      }),
      caseMembership: reportMembership,
    };
    const report = service.approveMandatoryReport(reportAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      authorityCode: 'synthetic-authority',
      reportCategory: 'mandatory-report',
      exactFieldCategories: ['student-identifier', 'controlled-concern-category'],
      recipientReference: 'synthetic-recipient',
      approvedByPrincipalId: 'reviewer-2',
    });
    expect(
      service.submitMandatoryReport(reportAccess, 'tenant-a', report.mandatoryReportId),
    ).toMatchObject({
      status: 'submitted',
    });

    const transferMembership = service.grantMembership(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      principalId: 'transfer-officer-2',
      caseRole: 'case-member',
      purpose: 'approved-data-transfer',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      approvalReference: 'synthetic-transfer-membership',
    });
    const transferAccess: SafeguardingAccessScope = {
      context: context({
        principalId: 'transfer-officer-2',
        persona: 'safeguarding-case-member',
        purpose: 'approved-data-transfer',
        permissions: [
          'care.safeguarding.disclosure.approve',
          'care.safeguarding.disclosure.generate',
        ],
      }),
      caseMembership: transferMembership,
    };
    const disclosure = service.approveDisclosure(transferAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      legalBasis: 'legal-obligation',
      exactFieldCategories: ['student-identifier'],
      recipientReference: 'synthetic-authority-recipient',
      purposeCode: 'approved-data-transfer',
      approvedByPrincipalId: 'reviewer-2',
      expiresAt: new Date('2026-07-29T08:00:00.000Z'),
    });
    expect(() =>
      service.generateDisclosure(
        transferAccess,
        'tenant-a',
        disclosure.disclosureId,
        ['student-identifier', 'extra-field'],
        'synthetic-authority-recipient',
        'synthetic-object-reference',
      ),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_EXACT_SCOPE_REQUIRED',
      }),
    );
    expect(
      service.generateDisclosure(
        transferAccess,
        'tenant-a',
        disclosure.disclosureId,
        ['student-identifier'],
        'synthetic-authority-recipient',
        'synthetic-object-reference',
      ),
    ).toMatchObject({ status: 'generated' });
  });

  test('creates purpose-bound safety plans, restricted documents and active membership lookups', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess, leadMembership } = submitAndOpen(service);

    const draftPlan = service.createSafetyPlan(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      actions: ['Maintain supervised transition'],
      responsibleRoleCodes: ['safeguarding-lead'],
      reviewAt: new Date('2026-07-30T07:00:00.000Z'),
    });
    expect(draftPlan).toMatchObject({
      caseId: caseFile.caseId,
      status: 'draft',
      preparedByPrincipalId: 'safeguarding-lead-1',
    });
    expect(draftPlan.approvedByPrincipalId).toBeUndefined();

    expect(() =>
      service.createSafetyPlan(leadAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        actions: ['Escalate supervision'],
        responsibleRoleCodes: ['safeguarding-lead'],
        reviewAt: new Date('2026-07-30T08:00:00.000Z'),
        approvedByPrincipalId: 'safeguarding-lead-1',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );

    expect(
      service.createSafetyPlan(leadAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        actions: ['Escalate supervision'],
        responsibleRoleCodes: ['safeguarding-lead', 'principal'],
        reviewAt: new Date('2026-07-30T08:00:00.000Z'),
        approvedByPrincipalId: 'reviewer-2',
      }),
    ).toMatchObject({ status: 'active', approvedByPrincipalId: 'reviewer-2' });

    const document = service.attachRestrictedDocument(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      documentId: 'document-1',
      documentType: 'controlled-assessment',
    });
    expect(document).toMatchObject({
      caseId: caseFile.caseId,
      documentId: 'document-1',
      classification: 'CARE-C4',
      sourceClassification: 'CARE-C4',
      recordedByPrincipalId: 'safeguarding-lead-1',
    });

    expect(
      service.activeMembership(
        'tenant-a',
        caseFile.caseId,
        'safeguarding-lead-1',
        'safeguarding-assessment',
      ),
    ).toEqual(leadMembership);
    expect(
      service.activeMembership(
        'tenant-a',
        caseFile.caseId,
        'safeguarding-lead-1',
        'mandatory-reporting',
      ),
    ).toBeUndefined();
  });

  test('closes cases only with AAL2 independent approval and emits bounded closure evidence', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess } = submitAndOpen(service);

    expect(() =>
      service.closeCase(
        { ...leadAccess, context: context({ assurance: 'aal1' }) },
        {
          tenantId: 'tenant-a',
          caseId: caseFile.caseId,
          outcome: 'close',
          reasonCategory: 'safety-stabilised',
          independentlyApprovedByPrincipalId: 'reviewer-2',
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_AAL2_REQUIRED',
      }),
    );

    expect(() =>
      service.closeCase(leadAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        outcome: 'close',
        reasonCategory: 'safety-stabilised',
        independentlyApprovedByPrincipalId: 'safeguarding-lead-1',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );

    const monitoring = service.closeCase(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      outcome: 'continue-monitoring',
      reasonCategory: 'monitoring-required',
      independentlyApprovedByPrincipalId: 'reviewer-2',
    });
    expect(monitoring.caseFile).toMatchObject({ status: 'monitoring', version: 2 });
    expect(
      service
        .listEvents('tenant-a')
        .some((event) => event.eventType === 'care.safeguarding.case.closed.v1'),
    ).toBe(false);

    const closed = service.closeCase(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      outcome: 'close',
      reasonCategory: 'safety-stabilised',
      independentlyApprovedByPrincipalId: 'reviewer-3',
    });
    expect(closed.caseFile).toMatchObject({ status: 'closed', version: 3 });
    expect(closed.caseFile.closedAt).toEqual(now);
    expect(closed.review).toMatchObject({
      outcome: 'close',
      reasonCategory: 'safety-stabilised',
      reviewedByPrincipalId: 'safeguarding-lead-1',
      independentlyApprovedByPrincipalId: 'reviewer-3',
    });
    const closureEvent = service
      .listEvents('tenant-a')
      .find((event) => event.eventType === 'care.safeguarding.case.closed.v1');
    expect(closureEvent).toMatchObject({
      aggregateId: caseFile.caseId,
      correlationId: 'safeguarding-correlation-1',
      payload: { outcome: 'close', reasonCategory: 'safety-stabilised' },
    });
  });

  test('emits no allegation, reporter, chronology, factors, actions or recipient detail', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess } = submitAndOpen(service);
    service.addChronology(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      occurredAt: now,
      entryCategory: 'contact',
      restrictedNarrative: 'Highly restricted chronology narrative',
    });
    service.assessCase(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      riskLevel: 'elevated',
      controlledFactors: ['highly-restricted-factor'],
      requiredActions: ['highly-restricted-action'],
      independentlyReviewedByPrincipalId: 'reviewer-2',
    });
    const events = JSON.stringify(service.listEvents('tenant-a'));
    expect(events).not.toContain('Restricted synthetic safeguarding concern narrative');
    expect(events).not.toContain('Highly restricted chronology narrative');
    expect(events).not.toContain('highly-restricted-factor');
    expect(events).not.toContain('highly-restricted-action');
    expect(events).not.toContain('teacher-1');

    const report = buildSafeguardingOperationalReport({
      tenantId: 'tenant-a',
      ...service.snapshotForReports('tenant-a'),
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(report.concernsReceived).toEqual({ value: null, suppressed: true });
    expect(JSON.stringify(report)).not.toContain('concernNarrative');
    expect(JSON.stringify(report)).not.toContain('studentPersonId');
  });

  test('provides no default student or guardian case-publication path', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    expect('publishCase' in service).toBe(false);
    expect('readPublishedCase' in service).toBe(false);
  });
});
