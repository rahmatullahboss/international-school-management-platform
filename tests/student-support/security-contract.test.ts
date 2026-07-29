import { describe, expect, test } from 'vitest';

import {
  CARE_SECURITY_INVARIANTS,
  CareExportController,
  CareIncidentIsolation,
  CareSecurityService,
  ImmutableCareAuditStore,
  authorizeConnectorTransfer,
  authorizeDestruction,
  createSafeCareNotification,
  validateOfflineBundle,
  type BreakGlassGrant,
  type CareAccessRequest,
  type CareRequestContext,
  type CareResource,
} from '../../packages/modules/safeguarding/src/index.js';

const now = new Date('2026-07-29T03:00:00.000Z');
const context: CareRequestContext = {
  tenantId: 'tenant-a',
  principalId: 'nurse-1',
  linkedPersonId: 'person-nurse-1',
  persona: 'nurse',
  assurance: 'aal2',
  purpose: 'direct-care',
  correlationId: 'corr-1',
  sessionId: 'session-1',
  membershipActive: true,
  permissions: ['care.health.read', 'care.emergency.read'],
};
const resource: CareResource = {
  tenantId: 'tenant-a',
  resourceId: 'health-1',
  studentPersonId: 'student-1',
  classification: 'CARE-C3',
  fields: ['condition-summary'],
};

function accessRequest(overrides: Partial<CareAccessRequest> = {}): CareAccessRequest {
  return {
    context,
    resource,
    action: 'read',
    permission: 'care.health.read',
    relationship: { studentPersonId: 'student-1', active: true },
    now,
    ...overrides,
  };
}

describe('CARE-01 security contract', () => {
  test('publishes all forty approved threat-model invariants with stable IDs', () => {
    expect(CARE_SECURITY_INVARIANTS).toHaveLength(40);
    expect(new Set(CARE_SECURITY_INVARIANTS.map((item) => item.id)).size).toBe(40);
    expect(CARE_SECURITY_INVARIANTS[0]?.id).toBe('SS-TM-001');
    expect(CARE_SECURITY_INVARIANTS[39]?.id).toBe('SS-TM-040');
  });

  test('fails closed for missing context, tenant mismatch, broad roles and machine credentials', () => {
    const security = new CareSecurityService({ now: () => now });
    const { tenantId: _tenantId, ...withoutTenant } = context;
    expect(security.authorize(accessRequest({ context: withoutTenant })).reason).toBe(
      'tenant-context-required',
    );
    expect(
      security.authorize(accessRequest({ resource: { ...resource, tenantId: 'tenant-b' } })).reason,
    ).toBe('tenant-mismatch');
    expect(
      security.authorize(accessRequest({ context: { ...context, persona: 'tenant-admin' } }))
        .reason,
    ).toBe('not-found');
    expect(
      security.authorize(accessRequest({ context: { ...context, machineCredential: true } }))
        .reason,
    ).toBe('machine-credential-denied');
  });

  test('requires current relationship and logs every successful restricted read', () => {
    const security = new CareSecurityService({ now: () => now });
    const denied = accessRequest();
    delete denied.relationship;
    expect(security.authorize(denied).reason).toBe('relationship-required');
    const decision = security.authorize(accessRequest());
    expect(decision).toMatchObject({ allowed: true, reason: 'need-to-know' });
    expect(decision.auditEvidenceId).toBeDefined();
    expect(security.auditStore.list('tenant-a')).toHaveLength(1);
    expect(() => security.auditStore.update()).toThrow('immutable');
    expect(() => security.auditStore.delete()).toThrow('immutable');
  });

  test('fails a sensitive response when access-evidence persistence is unavailable', () => {
    const auditStore = new ImmutableCareAuditStore();
    auditStore.setAvailable(false);
    const security = new CareSecurityService({ auditStore, now: () => now });
    expect(security.authorize(accessRequest())).toEqual({
      allowed: false,
      reason: 'audit-unavailable',
      masked: true,
    });
  });

  test('protects safeguarding existence and requires matching active case membership', () => {
    const security = new CareSecurityService({ now: () => now });
    const safeguardingResource: CareResource = {
      ...resource,
      resourceId: 'case-1',
      caseId: 'case-1',
      classification: 'CARE-C4',
    };
    const safeguardingContext: CareRequestContext = {
      ...context,
      persona: 'safeguarding-case-member',
      purpose: 'safeguarding-assessment',
      permissions: ['care.safeguarding.read'],
    };
    const noMembership = accessRequest({
      context: safeguardingContext,
      resource: safeguardingResource,
      permission: 'care.safeguarding.read',
    });
    delete noMembership.relationship;
    expect(security.authorize(noMembership).reason).toBe('not-found');

    expect(
      security.authorize({
        ...noMembership,
        caseMembership: {
          tenantId: 'tenant-a',
          caseId: 'case-1',
          principalId: 'nurse-1',
          purpose: 'safeguarding-assessment',
          status: 'active',
          effectiveFrom: new Date('2026-07-29T02:00:00.000Z'),
        },
      }),
    ).toMatchObject({ allowed: true, reason: 'need-to-know' });
  });

  test('requires verified guardian authority plus a minimized versioned release', () => {
    const security = new CareSecurityService({ now: () => now });
    const guardianContext: CareRequestContext = {
      ...context,
      principalId: 'guardian-account-1',
      linkedPersonId: 'guardian-1',
      persona: 'guardian',
      assurance: 'aal1',
      purpose: 'legal-rights-response',
      permissions: ['care.portal.read'],
    };
    const portalRequest: CareAccessRequest = {
      context: guardianContext,
      resource,
      action: 'read',
      permission: 'care.portal.read',
      now,
      guardianAuthority: {
        tenantId: 'tenant-a',
        guardianPersonId: 'guardian-1',
        studentPersonId: 'student-1',
        authorities: ['portal'],
        verificationStatus: 'verified',
        portalAccess: true,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      },
      publication: {
        tenantId: 'tenant-a',
        studentPersonId: 'student-1',
        audience: 'guardian',
        version: 1,
        status: 'released',
        allowedFields: ['condition-summary'],
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      },
    };
    expect(security.authorize(portalRequest)).toMatchObject({
      allowed: true,
      reason: 'published-projection',
      masked: true,
    });
    expect(
      security.authorize({
        ...portalRequest,
        guardianAuthority: { ...portalRequest.guardianAuthority!, portalAccess: false },
      }).reason,
    ).toBe('not-found');
  });

  test('enforces AAL2, independent break-glass approval and prohibited actions', () => {
    const security = new CareSecurityService({ now: () => now });
    const grant: BreakGlassGrant = {
      grantId: 'grant-1',
      tenantId: 'tenant-a',
      requestedBy: 'nurse-1',
      approvedBy: 'safeguarding-lead-1',
      purpose: 'emergency-response',
      reason: 'Immediate safety response',
      resourceIds: ['health-1'],
      classifications: ['CARE-C3'],
      effectiveFrom: new Date('2026-07-29T02:55:00.000Z'),
      expiresAt: new Date('2026-07-29T03:15:00.000Z'),
      status: 'active',
    };
    const emergencyContext: CareRequestContext = {
      ...context,
      purpose: 'emergency-response',
    };
    expect(
      security.authorize(
        accessRequest({ context: { ...emergencyContext, assurance: 'aal1' }, breakGlass: grant }),
      ).reason,
    ).toBe('step-up-required');
    expect(
      security.authorize(accessRequest({ context: emergencyContext, breakGlass: grant })).reason,
    ).toBe('break-glass');
    expect(
      security.authorize(
        accessRequest({
          context: emergencyContext,
          breakGlass: grant,
          action: 'high-risk-export',
        }),
      ).reason,
    ).toBe('break-glass-action-denied');
  });
});

describe('CARE disclosure, device, retention and incident controls', () => {
  test('uses exact independently approved export scope and reauthorizes downloads', () => {
    const exports = new CareExportController();
    exports.request({
      exportId: 'export-1',
      tenantId: 'tenant-a',
      requestedBy: 'counselor-1',
      purpose: 'approved-data-transfer',
      subjectIds: ['student-1'],
      fields: ['support-summary'],
      recipient: 'agency-case-42',
      expiresAt: new Date('2026-07-29T04:00:00.000Z'),
    });
    expect(() => exports.approve('export-1', 'counselor-1', 'aal2')).toThrow('Independent');
    exports.approve('export-1', 'privacy-1', 'aal2');
    expect(() => exports.generate('export-1', now, ['narrative'], 1)).toThrow('unapproved field');
    exports.generate('export-1', now, ['support-summary'], 1);
    expect(() => exports.download('export-1', now, 'changed-recipient')).toThrow(
      'authorization failed',
    );
    exports.download('export-1', now, 'agency-case-42');
  });

  test('requires exact connector manifest version, category, purpose and tenant', () => {
    const approval = {
      tenantId: 'tenant-a',
      connectorKey: 'approved-agency',
      manifestVersion: 3,
      approvedCategories: ['care-approved-summary'],
      approvedPurposes: ['approved-data-transfer' as const],
      status: 'approved' as const,
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    expect(
      authorizeConnectorTransfer(approval, {
        tenantId: 'tenant-a',
        connectorKey: 'approved-agency',
        manifestVersion: 3,
        category: 'care-approved-summary',
        purpose: 'approved-data-transfer',
        now,
      }),
    ).toBe(true);
    expect(
      authorizeConnectorTransfer(approval, {
        tenantId: 'tenant-b',
        connectorKey: 'approved-agency',
        manifestVersion: 3,
        category: 'care-approved-summary',
        purpose: 'approved-data-transfer',
        now,
      }),
    ).toBe(false);
  });

  test('prevents sensitive notification variables and emits generic wording', () => {
    expect(() =>
      createSafeCareNotification({
        recipientId: 'staff-1',
        routeReference: 'secure-action-route',
        variables: { diagnosis: 'prohibited-value' },
      }),
    ).toThrow('prohibited');
    expect(
      createSafeCareNotification({
        recipientId: 'staff-1',
        routeReference: 'secure-action-route',
      }),
    ).toEqual({
      recipientId: 'staff-1',
      title: 'Secure student-support action',
      body: 'A secure student-support action requires review.',
      routeReference: 'secure-action-route',
    });
  });

  test('rejects stale, revoked or wrong-device offline emergency bundles', () => {
    const bundle = {
      bundleId: 'bundle-1',
      tenantId: 'tenant-a',
      deviceId: 'managed-device-1',
      studentIds: ['student-1'],
      fields: ['allergy-summary' as const, 'emergency-action' as const],
      encrypted: true as const,
      deviceBound: true as const,
      generatedAt: new Date('2026-07-29T02:50:00.000Z'),
      expiresAt: new Date('2026-07-29T03:30:00.000Z'),
    };
    expect(validateOfflineBundle(bundle, now, 'managed-device-1')).toBe(true);
    expect(validateOfflineBundle(bundle, now, 'personal-device')).toBe(false);
    expect(
      validateOfflineBundle(
        { ...bundle, revokedAt: new Date('2026-07-29T02:59:00.000Z') },
        now,
        'managed-device-1',
      ),
    ).toBe(false);
  });

  test('blocks destruction on legal hold, AAL1 and self-approval', () => {
    const decision = {
      recordId: 'record-1',
      policyVersion: 'school-health-v1',
      legalHold: false,
      requestedBy: 'privacy-1',
      approvedBy: 'security-1',
      assurance: 'aal2' as const,
      idempotencyKey: 'destroy-record-1-v1',
    };
    expect(authorizeDestruction(decision)).toBe(true);
    expect(authorizeDestruction({ ...decision, legalHold: true })).toBe(false);
    expect(authorizeDestruction({ ...decision, approvedBy: 'privacy-1' })).toBe(false);
    expect(authorizeDestruction({ ...decision, assurance: 'aal1' })).toBe(false);
  });

  test('supports bounded incident revocation and isolation evidence', () => {
    const isolation = new CareIncidentIsolation();
    isolation.revokeSession('session-1');
    isolation.revokeGrant('grant-1');
    isolation.isolateDevice('device-1');
    isolation.isolateConnector('connector-1');
    expect(isolation.snapshot()).toEqual({
      sessions: ['session-1'],
      grants: ['grant-1'],
      devices: ['device-1'],
      connectors: ['connector-1'],
    });
  });
});
