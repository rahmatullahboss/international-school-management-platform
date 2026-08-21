import { describe, expect, it, vi } from 'vitest';

import { DatabaseMobileFamilyFormsConsentsStore } from './database-mobile-family-forms-consents-store.js';

const identity = {
  issuer: 'https://identity.school.test',
  subject: 'guardian-user',
  assurance: 'aal1' as const,
};
const scope = {
  tenantId: '40000000-0000-4000-8000-000000000002',
  campusId: '40000000-0000-4000-8000-000000000003',
  persona: 'guardian' as const,
};
const studentId = '40000000-0000-4000-8000-000000000010';
const formId = '40000000-0000-4000-8000-000000000020';
const consentId = '40000000-0000-4000-8000-000000000030';

describe('database mobile Family forms and consents store', () => {
  it('validates exact form list and definition responses', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          payload: {
            forms: [
              {
                formId,
                title: 'Emergency contact update',
                status: 'open',
                dueAt: '2026-09-01T12:00:00.000Z',
              },
            ],
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          payload: {
            formId,
            title: 'Emergency contact update',
            status: 'open',
            dueAt: '2026-09-01T12:00:00.000Z',
            baseVersion: 4,
            schemaVersion: 2,
            fields: [
              {
                fieldId: 'contact_name',
                label: 'Contact name',
                type: 'text',
                required: true,
                options: [],
              },
              {
                fieldId: 'pickup_permission',
                label: 'Pickup permission',
                type: 'singleChoice',
                required: true,
                options: ['allowed', 'not_allowed'],
              },
            ],
          },
        },
      ]);
    const store = new DatabaseMobileFamilyFormsConsentsStore({ query });

    await expect(store.listForms(identity, scope, studentId)).resolves.toEqual({
      forms: [
        {
          formId,
          title: 'Emergency contact update',
          status: 'open',
          dueAt: '2026-09-01T12:00:00.000Z',
        },
      ],
    });
    await expect(store.loadForm(identity, scope, formId)).resolves.toEqual({
      formId,
      title: 'Emergency contact update',
      status: 'open',
      dueAt: '2026-09-01T12:00:00.000Z',
      baseVersion: 4,
      schemaVersion: 2,
      fields: [
        {
          fieldId: 'contact_name',
          label: 'Contact name',
          type: 'text',
          required: true,
          options: [],
        },
        {
          fieldId: 'pickup_permission',
          label: 'Pickup permission',
          type: 'singleChoice',
          required: true,
          options: ['allowed', 'not_allowed'],
        },
      ],
    });
  });

  it('rejects form definitions with unknown fields or invalid choice policy', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          payload: {
            formId,
            title: 'Bad form',
            status: 'open',
            dueAt: null,
            baseVersion: 1,
            schemaVersion: 1,
            fields: [
              {
                fieldId: 'choice',
                label: 'Choice',
                type: 'singleChoice',
                required: false,
                options: [],
              },
            ],
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          payload: {
            formId,
            title: 'Leaky form',
            status: 'open',
            dueAt: null,
            baseVersion: 1,
            schemaVersion: 1,
            fields: [],
            internalWorkflowId: 'do-not-leak',
          },
        },
      ]);
    const store = new DatabaseMobileFamilyFormsConsentsStore({ query });

    await expect(store.loadForm(identity, scope, formId)).rejects.toThrow(
      'invalid database response',
    );
    await expect(store.loadForm(identity, scope, formId)).rejects.toThrow(
      'invalid database response',
    );
  });

  it('returns accepted revision or bounded form submission conflict statuses', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ payload: { acceptedRevision: 5 } }])
      .mockResolvedValueOnce([{ payload: { status: 'stale' } }]);
    const store = new DatabaseMobileFamilyFormsConsentsStore({ query });
    const input = {
      studentId,
      schemaVersion: 2,
      baseVersion: 4,
      answers: { contact_name: 'Guardian' },
    };

    await expect(
      store.submitForm(identity, scope, formId, 'family-form-idempotency-0001', input),
    ).resolves.toEqual({ acceptedRevision: 5 });
    await expect(
      store.submitForm(identity, scope, formId, 'family-form-idempotency-0002', input),
    ).resolves.toEqual({ status: 'stale' });
  });

  it('validates exact consent list and decision responses', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          payload: {
            consents: [
              {
                consentId,
                studentId,
                title: 'Trip consent',
                policyVersion: 'trip-policy-2026.2',
                status: 'pending',
                dueAt: '2026-09-01T12:00:00.000Z',
              },
            ],
          },
        },
      ])
      .mockResolvedValueOnce([{ payload: { acceptedRevision: 2 } }]);
    const store = new DatabaseMobileFamilyFormsConsentsStore({ query });

    await expect(store.listConsents(identity, scope, studentId)).resolves.toMatchObject({
      consents: [{ consentId, studentId, status: 'pending' }],
    });
    await expect(
      store.decideConsent(identity, scope, consentId, 'family-consent-idempotency-0001', {
        studentId,
        policyVersion: 'trip-policy-2026.2',
        decision: 'grant',
      }),
    ).resolves.toEqual({ acceptedRevision: 2 });
  });

  it('rejects non-guardian scope and malformed idempotency before the database', async () => {
    const query = vi.fn();
    const store = new DatabaseMobileFamilyFormsConsentsStore({ query });

    await expect(
      store.listForms(identity, { ...scope, persona: 'student' }, studentId),
    ).rejects.toThrow('guardian scope');
    await expect(
      store.submitForm(identity, scope, formId, 'bad key with spaces', {
        studentId,
        schemaVersion: 1,
        baseVersion: 1,
        answers: {},
      }),
    ).rejects.toThrow('idempotency');
    expect(query).not.toHaveBeenCalled();
  });
});
