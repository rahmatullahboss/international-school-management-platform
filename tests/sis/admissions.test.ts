import { describe, expect, it } from 'vitest';

import { AdmissionsDomainError, AdmissionsRegistry } from '../../packages/modules/admissions/src/domain.js';

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
  registry.submitApplication({ tenantId: tenantA, applicationId: application.applicationId, correlationId: 'submit' });
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
  registry.acceptOffer({ tenantId: tenantA, applicationId: application.applicationId, correlationId: 'accept' });
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
    registry.submitApplication({ tenantId: tenantA, applicationId: application.applicationId, correlationId: 'submit-2' });
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
      registry.acceptOffer({ tenantId: tenantA, applicationId: application.applicationId, correlationId: 'accept-2' }),
    ).toThrow('Required checklist is incomplete');
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
      registry.getGuardianApplicationStatus(tenantA, application.applicationId, crypto.randomUUID()),
    ).toThrowError(AdmissionsDomainError);
    expect(() => registry.getApplication(tenantB, application.applicationId)).toThrow('Application was not found');
  });
});
