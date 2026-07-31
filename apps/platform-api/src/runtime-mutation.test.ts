import { describe, expect, it, vi } from 'vitest';

import {
  isRuntimeMutationContentTypeAllowed,
  isRuntimeMutationDeclaredLengthAllowed,
  readBoundedRuntimeMutationBody,
  submitRuntimeSnapshotRefresh,
} from './runtime-mutation.js';

const sessionId = '60000000-0000-4000-8000-000000000001';
const commandId = '60000000-0000-4000-8000-000000000002';
const correlationId = '60000000-0000-4000-8000-000000000003';
const allowedOrigins = 'https://school.test,https://admin.school.test';

function acceptedDecision(replayed = false) {
  return {
    accepted: true as const,
    replayed,
    receipt: {
      commandId,
      commandType: 'runtime.snapshot.refresh' as const,
      state: 'accepted' as const,
      expectedRevision: 7,
      correlationId,
      acceptedAt: '2026-07-31T05:10:00.000Z',
    },
  };
}

describe('runtime mutation request controls', () => {
  it('allows only JSON and a bounded declared request length', () => {
    expect(isRuntimeMutationContentTypeAllowed('application/json')).toBe(true);
    expect(isRuntimeMutationContentTypeAllowed('application/json; charset=utf-8')).toBe(true);
    expect(isRuntimeMutationContentTypeAllowed('text/plain')).toBe(false);
    expect(isRuntimeMutationContentTypeAllowed(undefined)).toBe(false);
    expect(isRuntimeMutationDeclaredLengthAllowed(undefined)).toBe(true);
    expect(isRuntimeMutationDeclaredLengthAllowed('4096')).toBe(true);
    expect(isRuntimeMutationDeclaredLengthAllowed('4097')).toBe(false);
    expect(isRuntimeMutationDeclaredLengthAllowed('-1')).toBe(false);
    expect(isRuntimeMutationDeclaredLengthAllowed('4.5')).toBe(false);
  });

  it('bounds chunked request bodies by bytes and rejects invalid UTF-8', async () => {
    const valid = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"expectedRevision":7,"reason":"Approved refresh"}'));
        controller.close();
      },
    });
    await expect(readBoundedRuntimeMutationBody(valid)).resolves.toContain('Approved refresh');

    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4090));
        controller.enqueue(new Uint8Array(20));
        controller.close();
      },
    });
    await expect(readBoundedRuntimeMutationBody(oversized)).resolves.toBeUndefined();

    const invalidUtf8 = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([0xc3, 0x28]));
        controller.close();
      },
    });
    await expect(readBoundedRuntimeMutationBody(invalidUtf8)).resolves.toBeUndefined();
  });
});

describe('safe runtime snapshot refresh boundary', () => {
  it('accepts an exact-origin signed-session command and returns a durable receipt', async () => {
    const authenticate = vi.fn().mockResolvedValue({ ok: true, sessionId });
    const submit = vi.fn().mockResolvedValue(acceptedDecision());

    await expect(
      submitRuntimeSnapshotRefresh({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({
          expectedRevision: 7,
          reason: 'Refresh after the approved timetable publication.',
        }),
        idempotencyKey: 'refresh-admin-home-0001',
        correlationId,
        authenticate,
        submit,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 202,
      replayed: false,
      receipt: acceptedDecision().receipt,
    });
    expect(authenticate).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith({
      sessionId,
      idempotencyKey: 'refresh-admin-home-0001',
      expectedRevision: 7,
      reason: 'Refresh after the approved timetable publication.',
      correlationId,
    });
  });

  it('returns the same accepted receipt for an idempotent replay', async () => {
    await expect(
      submitRuntimeSnapshotRefresh({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ expectedRevision: 7, reason: 'Approved refresh.' }),
        idempotencyKey: 'refresh-admin-home-0001',
        correlationId,
        authenticate: () => Promise.resolve({ ok: true, sessionId }),
        submit: () => Promise.resolve(acceptedDecision(true)),
      }),
    ).resolves.toMatchObject({ ok: true, status: 202, replayed: true });
  });

  it('rejects configuration, origin, media type, key and body errors before authentication', async () => {
    const authenticate = vi.fn();
    const submit = vi.fn();
    const base = {
      configured: true,
      allowedOrigins,
      origin: 'https://school.test',
      contentType: 'application/json',
      rawBody: JSON.stringify({ expectedRevision: 7, reason: 'Approved refresh.' }),
      idempotencyKey: 'refresh-admin-home-0001',
      correlationId,
      authenticate,
      submit,
    } as const;

    await expect(submitRuntimeSnapshotRefresh({ ...base, configured: false })).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'runtime_mutation_configuration_invalid',
    });
    await expect(
      submitRuntimeSnapshotRefresh({ ...base, origin: 'https://evil.test' }),
    ).resolves.toMatchObject({ ok: false, status: 403, code: 'runtime_mutation_origin_denied' });
    await expect(
      submitRuntimeSnapshotRefresh({ ...base, contentType: 'text/plain' }),
    ).resolves.toMatchObject({ ok: false, status: 400, code: 'runtime_mutation_request_invalid' });
    await expect(
      submitRuntimeSnapshotRefresh({ ...base, idempotencyKey: 'bad key' }),
    ).resolves.toMatchObject({ ok: false, status: 400, code: 'runtime_mutation_request_invalid' });
    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        rawBody: JSON.stringify({
          expectedRevision: 7,
          reason: 'Approved refresh.',
          tenantId: 'attacker-tenant',
        }),
      }),
    ).resolves.toMatchObject({ ok: false, status: 400, code: 'runtime_mutation_request_invalid' });
    expect(authenticate).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('maps inactive identity, permission, assurance, revision and idempotency decisions', async () => {
    const base = {
      configured: true,
      allowedOrigins,
      origin: 'https://school.test',
      contentType: 'application/json',
      rawBody: JSON.stringify({ expectedRevision: 7, reason: 'Approved refresh.' }),
      idempotencyKey: 'refresh-admin-home-0001',
      correlationId,
      authenticate: () => Promise.resolve({ ok: true, sessionId } as const),
    };

    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        submit: () => Promise.resolve({ accepted: false, reason: 'session-inactive' } as const),
      }),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'browser_session_revoked' });
    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        submit: () => Promise.resolve({ accepted: false, reason: 'permission-not-granted' } as const),
      }),
    ).resolves.toMatchObject({ ok: false, status: 403, code: 'runtime_mutation_forbidden' });
    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        submit: () =>
          Promise.resolve({
            accepted: false,
            reason: 'step-up-required',
            requiredAssurance: 'aal2',
          } as const),
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      code: 'runtime_mutation_step_up_required',
      requiredAssurance: 'aal2',
    });
    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        submit: () =>
          Promise.resolve({ accepted: false, reason: 'revision-conflict', currentRevision: 8 } as const),
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 409,
      code: 'runtime_mutation_revision_conflict',
      currentRevision: 8,
    });
    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        submit: () => Promise.resolve({ accepted: false, reason: 'idempotency-conflict' } as const),
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 409,
      code: 'runtime_mutation_idempotency_conflict',
    });
  });

  it('sanitizes authentication and store outages', async () => {
    const base = {
      configured: true,
      allowedOrigins,
      origin: 'https://school.test',
      contentType: 'application/json',
      rawBody: JSON.stringify({ expectedRevision: 7, reason: 'Approved refresh.' }),
      idempotencyKey: 'refresh-admin-home-0001',
      correlationId,
    };
    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        authenticate: () =>
          Promise.resolve({
            ok: false,
            status: 401,
            code: 'browser_session_missing',
            message: 'A browser session is required.',
          } as const),
        submit: vi.fn(),
      }),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'browser_session_missing' });

    await expect(
      submitRuntimeSnapshotRefresh({
        ...base,
        authenticate: () => Promise.resolve({ ok: true, sessionId } as const),
        submit: () => Promise.reject(new Error('database host and secret details')),
      }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'runtime_mutation_unavailable',
      message: 'The runtime mutation service is unavailable.',
    });
  });
});
