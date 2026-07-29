import { describe, expect, test } from 'vitest';

import {
  BehaviorDomainError,
  BehaviorService,
  buildBehaviorOperationalReport,
  type BehaviorAccessScope,
} from '../../packages/modules/behavior/src/index.js';
import {
  CareSecurityService,
  type CareRequestContext,
} from '../../packages/modules/safeguarding/src/index.js';

const now = new Date('2026-07-29T05:00:00.000Z');

function context(overrides: Partial<CareRequestContext> = {}): CareRequestContext {
  return {
    tenantId: 'tenant-a',
    principalId: 'behavior-lead-1',
    linkedPersonId: 'behavior-lead-person-1',
    persona: 'behavior-lead',
    assurance: 'aal2',
    purpose: 'behavior-management',
    correlationId: 'behavior-correlation-1',
    membershipActive: true,
    permissions: [
      'care.behavior.incident.create',
      'care.behavior.incident.manage',
      'care.behavior.action.manage',
      'care.behavior.restorative.manage',
      'care.behavior.follow-up.manage',
      'care.behavior.follow-up.read',
      'care.behavior.incident.correct',
      'care.behavior.publication.approve',
    ],
    ...overrides,
  };
}

function access(overrides: Partial<BehaviorAccessScope> = {}): BehaviorAccessScope {
  return {
    context: context(),
    relationship: { studentPersonId: 'student-1', active: true },
    ...overrides,
  };
}

function createIncident(service: BehaviorService, scope = access()) {
  return service.recordIncident(scope, {
    tenantId: 'tenant-a',
    studentPersonId: 'student-1',
    campusId: 'campus-1',
    categoryCode: 'classroom-conduct',
    severity: 'moderate',
    occurredAt: new Date('2026-07-29T04:30:00.000Z'),
    locationCategory: 'classroom',
    sourceNarrative: 'Restricted synthetic behavior narrative',
    idempotencyKey: 'incident-1',
  });
}

describe('CARE-01 behavior domain', () => {
  test('allows relationship-scoped intake, remains idempotent and enforces workflow order', () => {
    const service = new BehaviorService(new CareSecurityService({ now: () => now }), () => now);
    const teacherAccess = access({
      context: context({
        principalId: 'teacher-1',
        persona: 'teacher',
        assurance: 'aal1',
        permissions: ['care.behavior.incident.create'],
      }),
    });
    const incident = createIncident(service, teacherAccess);
    const replay = createIncident(service, teacherAccess);
    expect(replay).toEqual(incident);
    expect(() =>
      service.transitionIncident(access(), {
        tenantId: 'tenant-a',
        incidentId: incident.incidentId,
        toStatus: 'resolved',
        reasonCode: 'invalid-skip',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<BehaviorDomainError>>({
        code: 'BEHAVIOR_INVALID_TRANSITION',
      }),
    );
    expect(
      service.transitionIncident(access(), {
        tenantId: 'tenant-a',
        incidentId: incident.incidentId,
        toStatus: 'submitted',
        reasonCode: 'submitted-for-review',
      }),
    ).toMatchObject({ status: 'submitted', version: 2 });
    expect(service.listStatusHistory('tenant-a', incident.incidentId)).toHaveLength(2);
  });

  test('keeps restricted follow-up notes need-to-know and hidden from teachers', () => {
    const service = new BehaviorService(new CareSecurityService({ now: () => now }), () => now);
    const incident = createIncident(service);
    const followUp = service.scheduleFollowUp(access(), {
      tenantId: 'tenant-a',
      incidentId: incident.incidentId,
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
      assignedPrincipalId: 'behavior-lead-1',
    });
    service.completeFollowUp(access(), {
      tenantId: 'tenant-a',
      followUpId: followUp.followUpId,
      outcomeCode: 'improving',
      restrictedNote: 'Restricted synthetic follow-up note',
    });
    expect(() =>
      service.readRestrictedFollowUp(
        access({
          context: context({
            principalId: 'teacher-1',
            persona: 'teacher',
            permissions: ['care.behavior.follow-up.read'],
          }),
        }),
        'tenant-a',
        followUp.followUpId,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<BehaviorDomainError>>({ code: 'BEHAVIOR_ACCESS_DENIED' }),
    );
    expect(
      service.readRestrictedFollowUp(access(), 'tenant-a', followUp.followUpId),
    ).toMatchObject({ outcomeCode: 'improving' });
  });

  test('records corrections without rewriting source incident fields', () => {
    const service = new BehaviorService(new CareSecurityService({ now: () => now }), () => now);
    const incident = createIncident(service);
    const correction = service.correctIncident(access(), {
      tenantId: 'tenant-a',
      incidentId: incident.incidentId,
      fieldName: 'severity',
      replacementValue: 'low',
      reason: 'Synthetic review correction',
    });
    expect(correction).toMatchObject({ fieldName: 'severity', replacementValue: 'low' });
    expect(service.listCorrections('tenant-a', incident.incidentId)).toEqual([correction]);
    expect(incident.severity).toBe('moderate');
  });

  test('requires AAL2 and independent approval for minimized guardian publication', () => {
    const security = new CareSecurityService({ now: () => now });
    const service = new BehaviorService(security, () => now);
    const reporterAccess = access({
      context: context({ principalId: 'reporter-1', persona: 'behavior-lead' }),
    });
    const incident = createIncident(service, reporterAccess);

    expect(() =>
      service.publishSummary(
        access({ context: context({ principalId: 'approver-1', assurance: 'aal1' }) }),
        {
          tenantId: 'tenant-a',
          incidentId: incident.incidentId,
          audience: 'guardian',
          categoryLabel: 'Conduct review',
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<BehaviorDomainError>>({
        code: 'BEHAVIOR_PUBLICATION_REQUIRES_AAL2',
      }),
    );
    expect(() =>
      service.publishSummary(reporterAccess, {
        tenantId: 'tenant-a',
        incidentId: incident.incidentId,
        audience: 'guardian',
        categoryLabel: 'Conduct review',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<BehaviorDomainError>>({
        code: 'BEHAVIOR_INDEPENDENT_APPROVAL_REQUIRED',
      }),
    );

    const publication = service.publishSummary(
      access({ context: context({ principalId: 'approver-1' }) }),
      {
        tenantId: 'tenant-a',
        incidentId: incident.incidentId,
        audience: 'guardian',
        categoryLabel: 'Conduct review',
        actionSummary: 'A restorative follow-up was arranged.',
      },
    );
    const guardianAccess: BehaviorAccessScope = {
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
    expect(view).toMatchObject({
      categoryLabel: 'Conduct review',
      publicationVersion: 1,
    });
    expect(JSON.stringify(view)).not.toContain('Restricted synthetic behavior narrative');
  });

  test('emits minimum events and suppresses small operational cohorts', () => {
    const service = new BehaviorService(new CareSecurityService({ now: () => now }), () => now);
    const incident = createIncident(service);
    service.transitionIncident(access(), {
      tenantId: 'tenant-a',
      incidentId: incident.incidentId,
      toStatus: 'submitted',
      reasonCode: 'submitted-for-review',
    });
    service.assignAction(access(), {
      tenantId: 'tenant-a',
      incidentId: incident.incidentId,
      actionType: 'restorative',
      summary: 'Restricted source action detail',
      startsAt: now,
    });
    expect(JSON.stringify(service.listEvents('tenant-a'))).not.toContain(
      'Restricted synthetic behavior narrative',
    );
    expect(JSON.stringify(service.listEvents('tenant-a'))).not.toContain(
      'Restricted source action detail',
    );
    const report = buildBehaviorOperationalReport({
      tenantId: 'tenant-a',
      ...service.snapshotForReports('tenant-a'),
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(report.incidents).toEqual({ value: null, suppressed: true });
    expect(JSON.stringify(report)).not.toContain('sourceNarrative');
  });
});
