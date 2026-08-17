import { describe, expect, it, vi } from 'vitest';

import {
  handleProductionOperatorCommandRequest,
  type ProductionOperatorCommandBindings,
} from './production-operator-command-api.js';

const sessionId = '97000000-0000-4000-8000-000000000001';
const correlationId = '97000000-0000-4000-8000-000000000002';
const bankStatementLineId = '97000000-0000-4000-8000-000000000003';
const paymentId = '97000000-0000-4000-8000-000000000004';
const applicationId = '97000000-0000-4000-8000-000000000005';
const programId = '97000000-0000-4000-8000-000000000006';
const academicYearId = '97000000-0000-4000-8000-000000000007';
const gradeLevelId = '97000000-0000-4000-8000-000000000008';

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
    principalId: '97000000-0000-4000-8000-000000000010',
    membershipId: '97000000-0000-4000-8000-000000000011',
    tenantId: '97000000-0000-4000-8000-000000000012',
    campusId: '97000000-0000-4000-8000-000000000013',
    roleIds: ['97000000-0000-4000-8000-000000000014'],
    assurance: 'aal2' as const,
    expiresAt: '2026-08-18T05:00:00.000Z',
  },
};

type Role = 'admissions' | 'finance' | 'support';

function dependencies(options: {
  role?: Role | undefined;
  resolution?: unknown;
  workspaceError?: boolean;
  submitError?: boolean;
} = {}) {
  const resolveWorkspaceRole = options.workspaceError
    ? vi.fn().mockRejectedValue(new Error('workspace unavailable'))
    : vi.fn().mockResolvedValue(options.role ?? 'admissions');
  const submit = options.submitError
    ? vi.fn().mockRejectedValue(new Error('mutation unavailable'))
    : vi.fn().mockResolvedValue(
        options.resolution ?? {
          accepted: true,
          replayed: false,
          receipt: {
            commandId: '97000000-0000-4000-8000-000000000020',
            command: 'admissions.application.review.record',
            domainEvidenceId: '97000000-0000-4000-8000-000000000021',
            idempotencyKey: 'operator-coverage-0001',
            correlationId,
            acceptedAt: '2026-08-18T03:00:00.000Z',
          },
        },
      );
  return {
    resolveSession: vi.fn().mockResolvedValue(activeSession),
    resolveWorkspaceRole,
    submit,
    randomUuid: () => correlationId,
  };
}

function request(
  body: unknown,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    rawBody?: string;
  } = {},
): Request {
  return new Request(`https://web.example.com${options.path ?? '/auth/v1/operator/commands'}`, {
    method: options.method ?? 'POST',
    headers: {
      origin: 'https://web.example.com',
      'content-type': 'application/json',
      'idempotency-key': 'operator-coverage-0001',
      ...options.headers,
    },
    ...((options.method ?? 'POST') === 'GET'
      ? {}
      : { body: options.rawBody ?? JSON.stringify(body) }),
  });
}

function admissionsReviewBody() {
  return {
    command: 'admissions.application.review.record',
    applicationId,
    expectedVersion: 1,
    recommendation: 'admit',
    score: null,
    notes: null,
  };
}

async function requiredResponse(
  req: Request,
  deps = dependencies(),
  env: ProductionOperatorCommandBindings = environment,
): Promise<Response> {
  const response = await handleProductionOperatorCommandRequest(req, env, deps);
  if (response === undefined) throw new Error('expected command response');
  return response;
}

describe('production operator command boundary coverage', () => {
  it('ignores unrelated paths and rejects unsupported methods', async () => {
    await expect(
      handleProductionOperatorCommandRequest(
        request({}, { path: '/health' }),
        environment,
        dependencies(),
      ),
    ).resolves.toBeUndefined();

    const response = await requiredResponse(request({}, { method: 'GET' }));
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'method_not_allowed' } });
  });

  it('rejects malformed idempotency and JSON transport inputs before session work', async () => {
    for (const req of [
      request(admissionsReviewBody(), { headers: { 'idempotency-key': 'short' } }),
      request(admissionsReviewBody(), { headers: { 'idempotency-key': 'invalid key spaces' } }),
      request(admissionsReviewBody(), { headers: { 'content-type': 'text/plain' } }),
      request(admissionsReviewBody(), { rawBody: '{not-json' }),
      request(admissionsReviewBody(), { headers: { 'content-length': '5000' } }),
    ]) {
      const deps = dependencies();
      const response = await requiredResponse(req, deps);
      expect(response.status).toBe(400);
      expect(deps.resolveSession).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid body variants across admissions commands', async () => {
    const invalidBodies = [
      { ...admissionsReviewBody(), recommendation: 'unknown' },
      { ...admissionsReviewBody(), score: 101 },
      { ...admissionsReviewBody(), notes: ' leading-space' },
      {
        command: 'admissions.application.offer.issue',
        applicationId,
        expectedVersion: 1,
        programId,
        academicYearId,
        gradeLevelId: 'not-a-uuid',
        expiresAt: 'not-a-date',
      },
      {
        command: 'admissions.application.offer.accept',
        applicationId,
        expectedVersion: 0,
      },
      {
        command: 'admissions.application.applicant.convert',
        applicationId,
        expectedVersion: 1,
        effectiveFrom: '2026-02-30',
      },
      { command: 'unknown.command' },
    ];

    for (const body of invalidBodies) {
      const response = await requiredResponse(request(body));
      expect(response.status).toBe(400);
    }
  });

  it('accepts offer issuance with a concrete grade and returns replay status', async () => {
    const body = {
      command: 'admissions.application.offer.issue',
      applicationId,
      expectedVersion: 2,
      programId,
      academicYearId,
      gradeLevelId,
      expiresAt: '2026-09-30T00:00:00.000Z',
    };
    const deps = dependencies({
      role: 'admissions',
      resolution: {
        accepted: true,
        replayed: true,
        receipt: {
          commandId: '97000000-0000-4000-8000-000000000030',
          command: body.command,
          domainEvidenceId: '97000000-0000-4000-8000-000000000031',
          idempotencyKey: 'operator-coverage-0001',
          correlationId,
          acceptedAt: '2026-08-18T03:00:00.000Z',
        },
      },
    });
    const response = await requiredResponse(request(body), deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ replayed: true });
    expect(deps.submit).toHaveBeenCalledWith(
      environment.DATABASE_URL,
      expect.objectContaining({ ...body, sessionId, correlationId }),
    );
  });

  it('accepts finance and support command shapes only for their matching workspaces', async () => {
    const financeBody = {
      command: 'finance.bank-line.reconcile',
      bankStatementLineId,
      paymentId,
      reason: 'Verified against the imported bank statement line.',
    };
    const finance = dependencies({ role: 'finance' });
    expect((await requiredResponse(request(financeBody), finance)).status).toBe(202);
    expect(finance.submit).toHaveBeenCalledWith(
      environment.DATABASE_URL,
      expect.objectContaining({ ...financeBody, sessionId }),
    );

    const supportBody = {
      command: 'support.break-glass.request',
      reason: 'Urgent incident investigation requires temporary access.',
      requestedMinutes: 15,
    };
    const support = dependencies({ role: 'support' });
    expect((await requiredResponse(request(supportBody), support)).status).toBe(202);
    expect(support.submit).toHaveBeenCalledWith(
      environment.DATABASE_URL,
      expect.objectContaining({ ...supportBody, sessionId }),
    );
  });

  it('rejects invalid finance and support bounds', async () => {
    for (const body of [
      {
        command: 'finance.bank-line.reconcile',
        bankStatementLineId,
        paymentId,
        reason: 'short',
      },
      {
        command: 'support.break-glass.request',
        reason: 'Valid incident access reason.',
        requestedMinutes: 4,
      },
      {
        command: 'support.break-glass.request',
        reason: 'Valid incident access reason.',
        requestedMinutes: 31,
      },
    ]) {
      expect((await requiredResponse(request(body))).status).toBe(400);
    }
  });

  it('fails closed when workspace or mutation storage throws', async () => {
    const workspace = await requiredResponse(
      request(admissionsReviewBody()),
      dependencies({ workspaceError: true }),
    );
    expect(workspace.status).toBe(503);
    await expect(workspace.json()).resolves.toMatchObject({
      error: { code: 'operator_command_unavailable' },
    });

    const mutation = await requiredResponse(
      request(admissionsReviewBody()),
      dependencies({ submitError: true }),
    );
    expect(mutation.status).toBe(503);
    await expect(mutation.json()).resolves.toMatchObject({
      error: { code: 'operator_command_unavailable' },
    });
  });

  it('maps all remaining bounded domain resolutions', async () => {
    const cases = [
      [{ accepted: false, reason: 'invalid-command' }, 400, 'operator_command_invalid'],
      [{ accepted: false, reason: 'session-inactive' }, 401, 'browser_session_revoked'],
      [{ accepted: false, reason: 'permission-not-granted' }, 403, 'operator_permission_denied'],
      [{ accepted: false, reason: 'scope-not-found' }, 404, 'operator_scope_not_found'],
      [{ accepted: false, reason: 'command-disabled' }, 503, 'operator_command_unavailable'],
      [{ accepted: false, reason: 'command-unavailable' }, 503, 'operator_command_unavailable'],
    ] as const;

    for (const [resolution, status, code] of cases) {
      const response = await requiredResponse(
        request(admissionsReviewBody()),
        dependencies({ resolution }),
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ error: { code } });
    }
  });

  it('requires every durable production switch and a strong session secret', async () => {
    const variants: ProductionOperatorCommandBindings[] = [
      { ...environment, AUTH_SESSION_REGISTRY_SOURCE: 'memory' },
      { ...environment, AUTH_PERMISSION_SOURCE: 'memory' },
      { ...environment, RUNTIME_MUTATION_SOURCE: 'memory' },
      { ...environment, AUTH_SESSION_SECRET: 'too-short' },
      { ...environment, DATABASE_URL: '   ' },
    ];

    for (const env of variants) {
      const response = await requiredResponse(request(admissionsReviewBody()), dependencies(), env);
      expect(response.status).toBe(503);
    }
  });
});
