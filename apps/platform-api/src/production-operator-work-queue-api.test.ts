import { describe, expect, it, vi } from 'vitest';

import {
  handleProductionOperatorWorkQueueRequest,
  type ProductionOperatorWorkQueueBindings,
} from './production-operator-work-queue-api.js';

const sessionId = '99000000-0000-4000-8000-000000000001';

const environment: ProductionOperatorWorkQueueBindings = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime.example.invalid/neondb',
  AUTH_SESSION_SECRET: 'session-secret-0123456789abcdef0123',
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  AUTH_PERMISSION_SOURCE: 'database',
};

const activeSession = {
  ok: true as const,
  context: {
    sessionId,
    principalId: '99000000-0000-4000-8000-000000000002',
    membershipId: '99000000-0000-4000-8000-000000000003',
    tenantId: '99000000-0000-4000-8000-000000000004',
    campusId: '99000000-0000-4000-8000-000000000005',
    roleIds: ['99000000-0000-4000-8000-000000000006'],
    assurance: 'aal1' as const,
    expiresAt: '2026-08-02T03:00:00.000Z',
  },
};

const admissionsQueue = {
  schemaVersion: 1 as const,
  role: 'admissions' as const,
  items: [
    {
      applicationId: '99000000-0000-4000-8000-000000000010',
      applicationNumber: 'APP-DEMO-0001',
      status: 'submitted' as const,
      version: 1,
      submittedAt: '2026-08-01T08:30:00.000Z',
    },
  ],
};

function request(method = 'GET'): Request {
  return new Request('https://web.example.com/auth/v1/operator/work-queue', { method });
}

function dependencies(options?: {
  role?: 'admin' | 'admissions' | 'finance' | 'support';
  queue?: typeof admissionsQueue | undefined;
  session?: typeof activeSession | { ok: false; status: 401; code: string; message: string };
}) {
  return {
    resolveSession: vi.fn().mockResolvedValue(options?.session ?? activeSession),
    resolveWorkspaceRole: vi.fn().mockResolvedValue(options?.role ?? 'admissions'),
    resolveQueue: vi.fn().mockResolvedValue(options?.queue ?? admissionsQueue),
  };
}

describe('production operator work queue API', () => {
  it('is not exposed outside production', async () => {
    const deps = dependencies();
    await expect(
      handleProductionOperatorWorkQueueRequest(
        request(),
        { ...environment, APP_ENV: 'staging' },
        deps,
      ),
    ).resolves.toBeUndefined();
    expect(deps.resolveSession).not.toHaveBeenCalled();
  });

  it('fails closed when durable database configuration is incomplete', async () => {
    const deps = dependencies();
    const unconfigured = { ...environment };
    delete unconfigured.DATABASE_URL;
    const response = await handleProductionOperatorWorkQueueRequest(request(), unconfigured, deps);
    expect(response?.status).toBe(503);
    expect(deps.resolveSession).not.toHaveBeenCalled();
  });

  it('requires GET and emits no-store responses', async () => {
    const deps = dependencies();
    const response = await handleProductionOperatorWorkQueueRequest(request('POST'), environment, deps);
    expect(response?.status).toBe(405);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(deps.resolveSession).not.toHaveBeenCalled();
  });

  it('returns only a queue matching the current database workspace role', async () => {
    const deps = dependencies();
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment, deps);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual(admissionsQueue);
    expect(deps.resolveQueue).toHaveBeenCalledWith(environment.DATABASE_URL, sessionId);
  });

  it.each(['admin', 'support'] as const)('denies unsupported role %s', async (role) => {
    const deps = dependencies({ role });
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment, deps);
    expect(response?.status).toBe(403);
    expect(deps.resolveQueue).not.toHaveBeenCalled();
  });

  it('denies a database queue whose role does not match the current workspace', async () => {
    const deps = {
      ...dependencies({ role: 'finance' }),
      resolveQueue: vi.fn().mockResolvedValue(admissionsQueue),
    };
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment, deps);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'operator_work_queue_denied' },
    });
  });

  it('preserves revoked-session denial without touching work queue storage', async () => {
    const deps = dependencies({
      session: {
        ok: false,
        status: 401,
        code: 'browser_session_revoked',
        message: 'The browser session is no longer active.',
      },
    });
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment, deps);
    expect(response?.status).toBe(401);
    expect(deps.resolveWorkspaceRole).not.toHaveBeenCalled();
    expect(deps.resolveQueue).not.toHaveBeenCalled();
  });

  it('bounds storage failures to an unavailable response', async () => {
    const deps = {
      ...dependencies(),
      resolveQueue: vi.fn().mockRejectedValue(new Error('postgresql://secret@internal')),
    };
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment, deps);
    expect(response?.status).toBe(503);
    expect(JSON.stringify(await response?.json())).not.toContain('postgresql://');
  });
});
