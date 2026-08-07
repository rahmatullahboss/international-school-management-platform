import { describe, expect, test } from 'vitest';

import {
  CareSecurityService,
  SafeguardingDomainError,
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
  test('accepts idempotent write-only concern intake and masks subsequent teacher reads', () => {
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

  test('requires exact active case membership and immediately honors revocation', () => {
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
    expect(service.readCase(memberAccess, 'tenant-a', caseFile.caseId).caseId).toBe(caseFile.caseId);
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

  test('requires exact purpose-bound independently approved report and disclosure scopes', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    const { caseFile, leadAccess } = submitAndOpen(service);
    const reportMembership = service.grantMembership(leadAccess, {
      tenantId: 'tenant-a',
      caseId: caseFile.caseId,
      principalId: 'mandatory-reporter-2',
      caseRole: 'case-member',
      purpose: 'mandatory-reporting',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      approvalReference: 'synthetic-mandatory-report-membership',
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
    expect(() =>
      service.approveMandatoryReport(leadAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        authorityCode: 'synthetic-authority',
        reportCategory: 'mandatory-report',
        exactFieldCategories: ['student-identifier'],
        recipientReference: 'synthetic-recipient',
        approvedByPrincipalId: 'reviewer-2',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_ACCESS_DENIED',
      }),
    );
    expect(() =>
      service.approveMandatoryReport(reportAccess, {
        tenantId: 'tenant-a',
        caseId: caseFile.caseId,
        authorityCode: 'synthetic-authority',
        reportCategory: 'mandatory-report',
        exactFieldCategories: [],
        recipientReference: 'synthetic-recipient',
        approvedByPrincipalId: 'reviewer-2',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SafeguardingDomainError>>({
        code: 'SAFEGUARDING_EXACT_SCOPE_REQUIRED',
      }),
    );
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
    ).toMatchObject({ status: 'submitted' });

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

  test('emits no allegation, reporter, chronology or assessment narrative and suppresses tiny cohorts', () => {
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

  test('provides no default student or guardian case publication path', () => {
    const service = new SafeguardingService(new CareSecurityService({ now: () => now }), () => now);
    expect('publishCase' in service).toBe(false);
    expect('readPublishedCase' in service).toBe(false);
  });
});
