import { describe, expect, it } from 'vitest';

import {
  AdmissionsDomainError,
  AdmissionsRegistry,
} from '../../packages/modules/admissions/src/domain.js';

const tenantA = '00000000-0000-4000-8000-0000000000a1';
const tenantB = '00000000-0000-4000-8000-0000000000b1';

function startApplication(registry: AdmissionsRegistry) {
  const cycle = registry.createCycle({
    tenantId: tenantA,
    name: '2027 Entry',
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2027-01-01T00:00:00.000Z',
    status: 'open',
  });
  const form = registry.publishFormVersion({
    tenantId: tenantA,
    formKey: 'standard-application',
    schema: { required: ['legalName'] },
  });
  return registry.startApplication({
    tenantId: tenantA,
    applicationNumber: `APP-${crypto.randomUUID()}`,
    cycleId: cycle.cycleId,
    applicantPersonId: '10000000-0000-4000-8000-0000000000a1',
    submittingGuardianPersonId: '30000000-0000-4000-8000-0000000000a1',
    programChoiceIds: [crypto.randomUUID()],
    formVersionId: form.formVersionId,
    initialAnswers: { legalName: 'Amina Rahman' },
  });
}

function acceptApplication(registry: AdmissionsRegistry) {
  const application = startApplication(registry);
  const checklist = registry.addChecklistRequirement({
    tenantId: tenantA,
    applicationId: application.applicationId,
    requirementKey: 'passport',
    label: 'Passport',
    required: true,
  });
  registry.updateChecklist({
    tenantId: tenantA,
    applicationId: application.applicationId,
    checklistItemId: checklist.checklistItemId,
    status: 'verified',
    documentId: crypto.randomUUID(),
  });
  registry.submitApplication({
    tenantId: tenantA,
    applicationId: application.applicationId,
    correlationId: 'submit',
  });
  registry.recordReview({
    tenantId: tenantA,
    applicationId: application.applicationId,
    reviewerAccountId: crypto.randomUUID(),
    recommendation: 'admit',
    score: 92,
    confidential: true,
  });
  registry.recordDecision({
    tenantId: tenantA,
    applicationId: application.applicationId,
    decision: 'admit',
    reasonCode: 'meets-criteria',
    decidedByAccountId: crypto.randomUUID(),
    correlationId: 'decision',
  });
  registry.issueOffer({
    tenantId: tenantA,
    applicationId: application.applicationId,
    programId: crypto.randomUUID(),
    campusId: crypto.randomUUID(),
    academicYearId: crypto.randomUUID(),
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  registry.acceptOffer({
    tenantId: tenantA,
    applicationId: application.applicationId,
    correlationId: 'accept',
  });
  return application.applicationId;
}

describe('AdmissionsRegistry', () => {
  it('pins applications to immutable form and response versions', () => {
    const registry = new AdmissionsRegistry();
    const application = startApplication(registry);
    const amendment = registry.amendApplication({
      tenantId: tenantA,
      applicationId: application.applicationId,
      answers: { legalName: 'Amina B. Rahman' },
    });
    const submitted = registry.submitApplication({
      tenantId: tenantA,
      applicationId: application.applicationId,
      correlationId: 'submit-1',
    }).value;

    expect(amendment.version).toBe(2);
    expect(submitted.formVersionId).toBe(application.formVersionId);
    expect(submitted.responseVersions).toHaveLength(2);
    expect(submitted.responseVersions[0]?.answers).toEqual({ legalName: 'Amina Rahman' });
    expect(submitted.responseVersions[1]).toMatchObject({ submitted: true, version: 2 });
  });

  it('requires completed prerequisites before offer acceptance', () => {
    const registry = new AdmissionsRegistry();
    const application = startApplication(registry);
    registry.addChecklistRequirement({
      tenantId: tenantA,
      applicationId: application.applicationId,
      requirementKey: 'passport',
      label: 'Passport',
      required: true,
    });
    registry.submitApplication({
      tenantId: tenantA,
      applicationId: application.applicationId,
      correlationId: 'submit-2',
    });
    registry.recordDecision({
      tenantId: tenantA,
      applicationId: application.applicationId,
      decision: 'admit',
      reasonCode: 'admit',
      decidedByAccountId: crypto.randomUUID(),
      correlationId: 'decision-2',
    });
    registry.issueOffer({
      tenantId: tenantA,
      applicationId: application.applicationId,
      programId: crypto.randomUUID(),
      campusId: crypto.randomUUID(),
      academicYearId: crypto.randomUUID(),
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(() =>
      registry.acceptOffer({
        tenantId: tenantA,
        applicationId: application.applicationId,
        correlationId: 'accept-2',
      }),
    ).toThrow('Required checklist is incomplete');
  });

  it('keeps issued offers and contracts immutable across retries', () => {
    const registry = new AdmissionsRegistry();
    const application = startApplication(registry);
    registry.submitApplication({
      tenantId: tenantA,
      applicationId: application.applicationId,
      correlationId: 'submit-immutable-offer',
    });
    registry.recordDecision({
      tenantId: tenantA,
      applicationId: application.applicationId,
      decision: 'admit',
      reasonCode: 'meets-criteria',
      decidedByAccountId: crypto.randomUUID(),
      correlationId: 'decision-immutable-offer',
    });
    const offerInput = {
      tenantId: tenantA,
      applicationId: application.applicationId,
      programId: '81000000-0000-4000-8000-000000000001',
      campusId: '80000000-0000-4000-8000-000000000001',
      academicYearId: '82000000-0000-4000-8000-000000000001',
      gradeLevelId: '83000000-0000-4000-8000-000000000001',
      expiresAt: '2099-01-01T00:00:00.000Z',
    } as const;
    const offer = registry.issueOffer(offerInput);
    expect(registry.issueOffer(offerInput).offerId).toBe(offer.offerId);
    expect(() =>
      registry.issueOffer({
        ...offerInput,
        campusId: '80000000-0000-4000-8000-000000000002',
      }),
    ).toThrow('Existing offer does not match the reissue request');

    const contractInput = {
      tenantId: tenantA,
      applicationId: application.applicationId,
      templateVersion: 'v1',
      documentId: '90000000-0000-4000-8000-000000000001',
    } as const;
    const contract = registry.issueContract(contractInput);
    expect(registry.issueContract(contractInput).contractId).toBe(contract.contractId);
    expect(() =>
      registry.issueContract({
        ...contractInput,
        documentId: '90000000-0000-4000-8000-000000000002',
      }),
    ).toThrow('Existing contract does not match the reissue request');
    const signerAccountId = crypto.randomUUID();
    const signed = registry.signContract({
      tenantId: tenantA,
      applicationId: application.applicationId,
      signedByAccountId: signerAccountId,
    });
    expect(registry.issueContract(contractInput)).toMatchObject({
      contractId: contract.contractId,
      status: 'signed',
      signedByAccountId: signerAccountId,
    });
    expect(
      registry.signContract({
        tenantId: tenantA,
        applicationId: application.applicationId,
        signedByAccountId: crypto.randomUUID(),
      }),
    ).toEqual(signed);
  });

  it('converts one accepted offer exactly once across retries', () => {
    const registry = new AdmissionsRegistry();
    const applicationId = acceptApplication(registry);
    const first = registry.convertApplicant({
      tenantId: tenantA,
      applicationId,
      idempotencyKey: 'convert-application-1',
      studentProfileId: crypto.randomUUID(),
      enrollmentId: crypto.randomUUID(),
      fieldMapping: { applicantPersonId: 'studentProfile.personId' },
      convertedByAccountId: crypto.randomUUID(),
      correlationId: 'convert-1',
    });
    const replay = registry.convertApplicant({
      tenantId: tenantA,
      applicationId,
      idempotencyKey: 'convert-application-1',
      studentProfileId: crypto.randomUUID(),
      enrollmentId: crypto.randomUUID(),
      fieldMapping: {},
      convertedByAccountId: crypto.randomUUID(),
      correlationId: 'convert-1-retry',
    });

    expect(replay.value).toEqual(first.value);
    expect(replay.events).toHaveLength(0);
    expect(registry.getApplication(tenantA, applicationId).status).toBe('converted');
    expect(registry.admissionsFunnel(tenantA).converted).toBe(1);
  });

  it('rejects a conversion idempotency key reused for another application', () => {
    const registry = new AdmissionsRegistry();
    const firstApplicationId = acceptApplication(registry);
    const secondApplicationId = acceptApplication(registry);
    registry.convertApplicant({
      tenantId: tenantA,
      applicationId: firstApplicationId,
      idempotencyKey: 'shared-conversion-key',
      studentProfileId: crypto.randomUUID(),
      enrollmentId: crypto.randomUUID(),
      fieldMapping: {},
      convertedByAccountId: crypto.randomUUID(),
      correlationId: 'convert-first',
    });

    expect(() =>
      registry.convertApplicant({
        tenantId: tenantA,
        applicationId: secondApplicationId,
        idempotencyKey: 'shared-conversion-key',
        studentProfileId: crypto.randomUUID(),
        enrollmentId: crypto.randomUUID(),
        fieldMapping: {},
        convertedByAccountId: crypto.randomUUID(),
        correlationId: 'convert-second',
      }),
    ).toThrow('Conversion idempotency key is already bound to another application');
    expect(registry.getApplication(tenantA, secondApplicationId).status).toBe('accepted');
  });

  it('limits guardian status views and tenant lookups', () => {
    const registry = new AdmissionsRegistry();
    const application = startApplication(registry);

    expect(
      registry.getGuardianApplicationStatus(
        tenantA,
        application.applicationId,
        application.submittingGuardianPersonId,
      ).status,
    ).toBe('draft');
    expect(() =>
      registry.getGuardianApplicationStatus(
        tenantA,
        application.applicationId,
        crypto.randomUUID(),
      ),
    ).toThrowError(AdmissionsDomainError);
    expect(() => registry.getApplication(tenantB, application.applicationId)).toThrow(
      'Application was not found',
    );
  });
});
