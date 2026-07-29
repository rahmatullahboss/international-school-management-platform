import { describe, expect, test } from 'vitest';

import type { HealthDomainError } from '../../packages/modules/health/src/index.js';
import {
  HealthService,
  buildHealthOperationalReport,
  type HealthAccessScope,
  type LegalBasisEvidence,
} from '../../packages/modules/health/src/index.js';
import {
  CareSecurityService,
  type CareRequestContext,
} from '../../packages/modules/safeguarding/src/index.js';

const now = new Date('2026-07-29T04:00:00.000Z');
const legalBasis: LegalBasisEvidence = {
  basis: 'public-task',
  evidenceReference: 'synthetic-policy-v1',
  status: 'active',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
};

function context(overrides: Partial<CareRequestContext> = {}): CareRequestContext {
  return {
    tenantId: 'tenant-a',
    principalId: 'nurse-1',
    linkedPersonId: 'nurse-person-1',
    persona: 'nurse',
    assurance: 'aal2',
    purpose: 'direct-care',
    correlationId: 'health-correlation-1',
    membershipActive: true,
    permissions: [
      'care.health.write',
      'care.health.read',
      'care.health.medication.order',
      'care.health.medication.administer',
      'care.health.medication.correct',
      'care.health.care-plan.write',
      'care.health.encounter.write',
      'care.health.document.write',
      'care.emergency.read',
    ],
    ...overrides,
  };
}

function access(overrides: Partial<HealthAccessScope> = {}): HealthAccessScope {
  return {
    context: context(),
    relationship: { studentPersonId: 'student-1', active: true },
    ...overrides,
  };
}

function createService(): HealthService {
  return new HealthService(new CareSecurityService({ now: () => now }), () => now);
}

describe('CARE-01 health domain', () => {
  test('requires active legal basis in addition to authorization', () => {
    const service = createService();
    expect(() =>
      service.createProfile(access(), {
        tenantId: 'tenant-a',
        studentPersonId: 'student-1',
        legalBasis: { ...legalBasis, status: 'withdrawn' },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<HealthDomainError>>({
        code: 'HEALTH_LEGAL_BASIS_INVALID',
      }),
    );

    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
      bloodGroup: 'O+',
    });
    expect(profile).toMatchObject({ status: 'active', version: 1, bloodGroup: 'O+' });
  });

  test('does not let a broad principal role inherit a health read', () => {
    const service = createService();
    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
    });
    expect(() =>
      service.readProfile(
        access({ context: context({ persona: 'principal' }) }),
        'tenant-a',
        profile.profileId,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<HealthDomainError>>({ code: 'HEALTH_ACCESS_DENIED' }),
    );
  });

  test('blocks medication administration when an active allergy conflicts', () => {
    const service = createService();
    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
    });
    service.recordAllergy(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      substanceCode: 'ingredient-x',
      display: 'Synthetic Ingredient X',
      severity: 'life-threatening',
      legalBasis,
    });
    const order = service.orderMedication(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      medicationCode: 'medicine-a',
      display: 'Synthetic Medicine A',
      ingredientCodes: ['ingredient-x'],
      dose: '1 unit',
      route: 'oral',
      schedule: 'once',
      startsAt: new Date('2026-07-29T03:00:00.000Z'),
      prescriberReference: 'synthetic-prescriber-reference',
      authorizationDocumentReference: 'synthetic-medication-authorization',
      legalBasis,
    });

    expect(() =>
      service.administerMedication(access(), {
        tenantId: 'tenant-a',
        medicationOrderId: order.medicationOrderId,
        administeredAt: now,
        dose: '1 unit',
        route: 'oral',
        outcome: 'given',
        idempotencyKey: 'administration-1',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<HealthDomainError>>({
        code: 'HEALTH_ALLERGY_CONTRAINDICATION',
      }),
    );
  });

  test('requires AAL2, is idempotent and corrects administration without rewriting it', () => {
    const service = createService();
    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
    });
    const order = service.orderMedication(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      medicationCode: 'medicine-b',
      display: 'Synthetic Medicine B',
      dose: '2 units',
      route: 'oral',
      schedule: 'once',
      startsAt: new Date('2026-07-29T03:00:00.000Z'),
      prescriberReference: 'synthetic-prescriber-reference',
      authorizationDocumentReference: 'synthetic-medication-authorization',
      legalBasis,
    });

    expect(() =>
      service.administerMedication(access({ context: context({ assurance: 'aal1' }) }), {
        tenantId: 'tenant-a',
        medicationOrderId: order.medicationOrderId,
        administeredAt: now,
        dose: '2 units',
        route: 'oral',
        outcome: 'given',
        idempotencyKey: 'administration-2',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<HealthDomainError>>({ code: 'HEALTH_ACCESS_DENIED' }),
    );

    const first = service.administerMedication(access(), {
      tenantId: 'tenant-a',
      medicationOrderId: order.medicationOrderId,
      administeredAt: now,
      dose: '2 units',
      route: 'oral',
      outcome: 'given',
      idempotencyKey: 'administration-2',
    });
    const replay = service.administerMedication(access(), {
      tenantId: 'tenant-a',
      medicationOrderId: order.medicationOrderId,
      administeredAt: now,
      dose: 'different ignored payload',
      route: 'oral',
      outcome: 'omitted',
      idempotencyKey: 'administration-2',
    });
    expect(replay).toEqual(first);

    const correction = service.correctAdministration(access(), {
      tenantId: 'tenant-a',
      administrationId: first.administrationId,
      reason: 'Synthetic transcription correction',
      replacementDose: '1 unit',
    });
    expect(service.listAdministrations('tenant-a', profile.profileId)[0]?.dose).toBe('2 units');
    expect(service.listAdministrationCorrections('tenant-a', first.administrationId)).toEqual([
      correction,
    ]);
  });

  test('returns only the minimum emergency projection and records a CARE-E read', () => {
    const security = new CareSecurityService({ now: () => now });
    const service = new HealthService(security, () => now);
    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
      bloodGroup: 'A+',
      emergencyInstructions: 'Restricted source narrative not projected',
    });
    service.recordAllergy(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      substanceCode: 'allergen-z',
      display: 'Synthetic Allergen Z',
      severity: 'life-threatening',
      reaction: 'Restricted reaction detail',
      legalBasis,
    });
    service.createCarePlan(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      title: 'Synthetic emergency plan',
      goals: ['Stable response'],
      actions: ['Routine action'],
      emergencyActions: ['Use approved emergency action'],
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      approvedByPrincipalId: 'clinical-approver-1',
      legalBasis,
    });

    const projection = service.readEmergencyProjection(
      access({ context: context({ purpose: 'emergency-response' }) }),
      'tenant-a',
      profile.profileId,
    );
    expect(projection).toMatchObject({
      bloodGroup: 'A+',
      emergencyActions: ['Use approved emergency action'],
    });
    expect(JSON.stringify(projection)).not.toContain('Restricted source narrative');
    expect(JSON.stringify(projection)).not.toContain('Restricted reaction detail');
    expect(
      security.auditStore.list('tenant-a').some((item) => item.classification === 'CARE-E'),
    ).toBe(true);
  });

  test('closes clinic encounters once and emits no narrative in the event', () => {
    const service = createService();
    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
    });
    const encounter = service.openEncounter(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      campusId: 'campus-1',
      reasonCategory: 'routine',
      narrative: 'Restricted synthetic clinic narrative',
      legalBasis,
    });
    const closed = service.closeEncounter(access(), {
      tenantId: 'tenant-a',
      encounterId: encounter.encounterId,
      disposition: 'returned-to-class',
    });
    expect(closed).toMatchObject({ status: 'closed', version: 2 });
    expect(() =>
      service.closeEncounter(access(), {
        tenantId: 'tenant-a',
        encounterId: encounter.encounterId,
        disposition: 'sent-home',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<HealthDomainError>>({
        code: 'HEALTH_ENCOUNTER_STATE_INVALID',
      }),
    );
    expect(JSON.stringify(service.listEvents('tenant-a'))).not.toContain(
      'Restricted synthetic clinic narrative',
    );
  });

  test('suppresses small operational cohorts and never exposes narratives', () => {
    const service = createService();
    const profile = service.createProfile(access(), {
      tenantId: 'tenant-a',
      studentPersonId: 'student-1',
      legalBasis,
    });
    const encounter = service.openEncounter(access(), {
      tenantId: 'tenant-a',
      profileId: profile.profileId,
      campusId: 'campus-1',
      reasonCategory: 'routine',
      narrative: 'Restricted narrative',
      legalBasis,
    });
    service.closeEncounter(access(), {
      tenantId: 'tenant-a',
      encounterId: encounter.encounterId,
      disposition: 'sent-home',
    });
    const snapshot = service.snapshotForReports('tenant-a');
    const report = buildHealthOperationalReport({
      tenantId: 'tenant-a',
      ...snapshot,
      from: new Date('2026-07-29T00:00:00.000Z'),
      to: new Date('2026-07-30T00:00:00.000Z'),
    });
    expect(report.clinicEncounters).toEqual({ value: null, suppressed: true });
    expect(JSON.stringify(report)).not.toContain('Restricted narrative');
  });
});
