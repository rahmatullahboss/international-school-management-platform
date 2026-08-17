import { describe, expect, it, vi } from 'vitest';

import {
  handleProductionOperatorWorkQueueRequest,
  type ProductionOperatorWorkQueueBindings,
} from './production-operator-work-queue-api.js';

const sessionId = '98000000-0000-4000-8000-000000000001';
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
    principalId: '98000000-0000-4000-8000-000000000002',
    membershipId: '98000000-0000-4000-8000-000000000003',
    tenantId: '98000000-0000-4000-8000-000000000004',
    campusId: '98000000-0000-4000-8000-000000000005',
    roleIds: ['98000000-0000-4000-8000-000000000006'],
    assurance: 'aal1' as const,
    expiresAt: '2026-08-18T05:00:00.000Z',
  },
};

function request(path = '/auth/v1/operator/work-queue'): Request {
  return new Request(`https://web.example.com${path}`);
}

function dependencies(options: {
  workspaceRole?: 'admissions' | 'finance' | undefined;
  workspaceError?: boolean;
  queue?: unknown;
} = {}) {
  return {
    resolveSession: vi.fn().mockResolvedValue(activeSession),
    resolveWorkspaceRole: options.workspaceError
      ? vi.fn().mockRejectedValue(new Error('workspace unavailable'))
      : vi.fn().mockResolvedValue(options.workspaceRole ?? 'admissions'),
    resolveQueue: vi.fn().mockResolvedValue(
      options.queue ?? {
        schemaVersion: 2,
        role: 'admissions',
        items: [],
      },
    ),
  };
}

describe('production operator work queue fail-closed coverage', () => {
  it('leaves unrelated production paths to the core worker', async () => {
    const deps = dependencies();
    await expect(
      handleProductionOperatorWorkQueueRequest(request('/health'), environment, deps),
    ).resolves.toBeUndefined();
    expect(deps.resolveSession).not.toHaveBeenCalled();
  });

  it('requires every durable production configuration input', async () => {
    const variants: ProductionOperatorWorkQueueBindings[] = [
      { ...environment, DATABASE_URL: '   ' },
      { ...environment, AUTH_SESSION_REGISTRY_SOURCE: 'memory' },
      { ...environment, AUTH_PERMISSION_SOURCE: 'memory' },
      { ...environment, AUTH_SESSION_SECRET: 'too-short' },
    ];

    for (const variant of variants) {
      const deps = dependencies();
      const response = await handleProductionOperatorWorkQueueRequest(request(), variant, deps);
      expect(response?.status).toBe(503);
      expect(deps.resolveSession).not.toHaveBeenCalled();
    }
  });

  it('bounds workspace lookup failures and missing workspace roles', async () => {
    const unavailable = dependencies({ workspaceError: true });
    const failed = await handleProductionOperatorWorkQueueRequest(request(), environment, unavailable);
    expect(failed?.status).toBe(503);
    expect(unavailable.resolveQueue).not.toHaveBeenCalled();

    const missing = {
      ...dependencies(),
      resolveWorkspaceRole: vi.fn().mockResolvedValue(undefined),
    };
    const denied = await handleProductionOperatorWorkQueueRequest(request(), environment, missing);
    expect(denied?.status).toBe(403);
    expect(missing.resolveQueue).not.toHaveBeenCalled();
  });

  it('denies an absent persisted queue without leaking storage details', async () => {
    const deps = {
      ...dependencies(),
      resolveQueue: vi.fn().mockResolvedValue(undefined),
    };
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment, deps);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'operator_work_queue_denied' },
    });
  });
});
