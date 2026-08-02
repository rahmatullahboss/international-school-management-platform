import { describe, expect, it, vi } from 'vitest';

import {
  handleProductionOperatorCommandRequest,
  type ProductionOperatorCommandBindings,
} from './production-operator-command-api.js';

const sessionId = '96000000-0000-4000-8000-000000000001';
const correlationId = '96000000-0000-4000-8000-000000000002';
const applicationId = '96000000-0000-4000-8000-000000000003';

const environment: ProductionOperatorCommandBindings = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime.example.invalid/neondb',
  AUTH_SESSION_SECRET: 'session-secret-0123456789abcdef0123',
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  AUTH_PERMISSION_SOURCE: 'database',
  RUNTIME_MUTATION_SOURCE: 'database',
  AUTH_ALLOWED_WEB_ORIGINS: 'https://web.example.com',
};

const activeSession = {
  ok: true as const,
  context: {
    sessionId,
    principalId: '96000000-0000-4000-8000-000000000010',
    membershipId: '96000000-0000-4000-8000-000000000011',
    tenantId: '96000000-0000-4000-8000-000000000012',
    campusId: '96000000-0000-4000-8000-000000000013',
    roleIds: ['96000000-0000-4000-8000-000000000014'],
    assurance: 'aal1' as const,
    expiresAt: '2026-08-02T02:00:00.000Z',
  },
};

function request(body: object, headers?: Record<string, string>): Request {
  return new Request('https://web.example.com/auth/v1/operator/commands', {
    method: 'POST',
    headers: {
      origin: 'https://web.example.com',
      'content-type': 'application/json',
      'idempotency-key': 'admissions-review-qa-0001',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function admissionsBody() {
  return {
    command: 'admissions.application.review.record',
    applicationId,
    expectedVersion: 1,
    recommendation: 'more-information',
    score: 82.5,
    notes: 'Request one additional verified record before the final review.',
  };
}

function dependencies(options?: {
  role?: 'admissions' | 'finance' | 'support';
  resolution?: unknown;
  session?: typeof activeSession | { ok: false; status: 401; code: string; message: string };
}) {
  const submit = vi.fn().mockResolvedValue(
    options?.resolution ?? {
      accepted: true,
      replayed: false,
      receipt: {
        commandId: '96000000-0000-4000-8000-000000000020',
        command: 'admissions.application.review.record',
        domainEvidenceId: '96000000-0000-4000-8000-000000000021',
        idempotencyKey: 'admissions-review-qa-0001',
        correlationId,
        acceptedAt: '2026-08-02T01:00:00.000Z',
      },
    },
  );
  return {
    value: {
      resolveSession: vi.fn().mockResolvedValue(options?.session ?? activeSession),
      resolveWorkspaceRole: vi.fn().mockResolvedValue(options?.role ?? 'admissions'),
      submit,
      randomUuid: () => correlationId,
    },
    submit,
  };
}

describe('production operator command API', () => {
  it('does not expose the production command endpoint outside production', async () => {
    const deps = dependencies();
    await expect(
      handleProductionOperatorCommandRequest(
        request(admissionsBody()),
        {
          ...environment,
          APP_ENV: 'staging',
        },
        deps.value,
      ),
    ).resolves.toBeUndefined();
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('fails closed when durable mutation configuration is incomplete', async () => {
    const deps = dependencies();
    const response = await handleProductionOperatorCommandRequest(
      request(admissionsBody()),
      { ...environment, DATABASE_URL: undefined },
      deps.value,
    );
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'operator_command_unavailable',
        message: 'The command service is unavailable.',
      },
    });
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('rejects cross-origin mutations before session or database work', async () => {
    const deps = dependencies();
    const response = await handleProductionOperatorCommandRequest(
      request(admissionsBody(), { origin: 'https://evil.example' }),
      environment,
      deps.value,
    );
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'operator_origin_denied' },
    });
    expect(deps.value.resolveSession).not.toHaveBeenCalled();
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('rejects browser-selected session and tenancy scope', async () => {
    const deps = dependencies();
    for (const body of [
      { ...admissionsBody(), sessionId },
      { ...admissionsBody(), tenantId: activeSession.context.tenantId },
      { ...admissionsBody(), campusId: activeSession.context.campusId },
      { ...admissionsBody(), correlationId },
    ]) {
      const response = await handleProductionOperatorCommandRequest(
        request(body),
        environment,
        deps.value,
      );
      expect(response?.status).toBe(400);
      await expect(response?.json()).resolves.toMatchObject({
        error: { code: 'operator_command_invalid' },
      });
    }
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('injects the active session and server correlation before submitting the reviewed command', async () => {
    const deps = dependencies();
    const response = await handleProductionOperatorCommandRequest(
      request(admissionsBody()),
      environment,
      deps.value,
    );
    expect(response?.status).toBe(202);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(deps.submit).toHaveBeenCalledWith(
      environment.DATABASE_URL,
      expect.objectContaining({
        ...admissionsBody(),
        sessionId,
        idempotencyKey: 'admissions-review-qa-0001',
        correlationId,
      }),
    );
    await expect(response?.json()).resolves.toMatchObject({
      schemaVersion: 1,
      replayed: false,
      receipt: { correlationId },
    });
  });

  it('denies cross-role command replay even with a valid session', async () => {
    const deps = dependencies({ role: 'finance' });
    const response = await handleProductionOperatorCommandRequest(
      request(admissionsBody()),
      environment,
      deps.value,
    );
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'operator_permission_denied' },
    });
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('maps revoked sessions and AAL2 step-up without leaking storage details', async () => {
    const revoked = dependencies({
      session: {
        ok: false,
        status: 401,
        code: 'browser_session_revoked',
        message: 'The browser session is no longer active.',
      },
    });
    const revokedResponse = await handleProductionOperatorCommandRequest(
      request(admissionsBody()),
      environment,
      revoked.value,
    );
    expect(revokedResponse?.status).toBe(401);
    expect(revoked.submit).not.toHaveBeenCalled();

    const stepUp = dependencies({
      resolution: {
        accepted: false,
        reason: 'step-up-required',
        requiredAssurance: 'aal2',
      },
    });
    const stepUpResponse = await handleProductionOperatorCommandRequest(
      request(admissionsBody()),
      environment,
      stepUp.value,
    );
    expect(stepUpResponse?.status).toBe(403);
    await expect(stepUpResponse?.json()).resolves.toEqual({
      error: {
        code: 'operator_step_up_required',
        message: 'Fresh AAL2 authentication is required.',
      },
      requiredAssurance: 'aal2',
    });
  });

  it('maps optimistic and idempotency conflicts to bounded 409 responses', async () => {
    for (const resolution of [
      { accepted: false, reason: 'idempotency-conflict' },
      { accepted: false, reason: 'domain-conflict' },
      { accepted: false, reason: 'revision-conflict', currentVersion: 4 },
    ]) {
      const deps = dependencies({ resolution });
      const response = await handleProductionOperatorCommandRequest(
        request(admissionsBody()),
        environment,
        deps.value,
      );
      expect(response?.status).toBe(409);
      const payload = await response?.json();
      expect(JSON.stringify(payload)).not.toContain('postgres://');
    }
  });
});
