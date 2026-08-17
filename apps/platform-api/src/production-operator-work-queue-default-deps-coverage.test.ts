import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createHttpDatabase: vi.fn(() => ({ kind: 'database' })),
  resolveSessionContext: vi.fn(),
  isSessionActive: vi.fn(),
  resolveWorkspace: vi.fn(),
  resolveAdmissions: vi.fn(),
  resolveQueue: vi.fn(),
}));

vi.mock('@school/database', () => ({
  createHttpDatabase: mocks.createHttpDatabase,
}));

vi.mock('./auth-boundary.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resolveAuthenticatedBrowserSessionContext: mocks.resolveSessionContext,
  };
});

vi.mock('./auth-durable-store.js', () => ({
  DurableAuthStore: class {
    readonly isSessionActive = mocks.isSessionActive;

    constructor(database: unknown) {
      void database;
    }
  },
}));

vi.mock('./database-workspace-store.js', () => ({
  DatabaseWorkspaceStore: class {
    readonly resolve = mocks.resolveWorkspace;

    constructor(database: unknown) {
      void database;
    }
  },
}));

vi.mock('./database-operator-work-queue-store.js', () => ({
  DatabaseOperatorWorkQueueStore: class {
    readonly resolveAdmissions = mocks.resolveAdmissions;
    readonly resolve = mocks.resolveQueue;

    constructor(database: unknown) {
      void database;
    }
  },
}));

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

const sessionContext = {
  sessionId,
  principalId: '99000000-0000-4000-8000-000000000002',
  membershipId: '99000000-0000-4000-8000-000000000003',
  tenantId: '99000000-0000-4000-8000-000000000004',
  campusId: '99000000-0000-4000-8000-000000000005',
  roleIds: ['99000000-0000-4000-8000-000000000006'],
  assurance: 'aal1' as const,
  expiresAt: '2026-08-18T05:30:00.000Z',
};

function request(): Request {
  return new Request('https://web.example.com/auth/v1/operator/work-queue', {
    headers: { cookie: '__Host-school-session=active' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createHttpDatabase.mockReturnValue({ kind: 'database' });
  mocks.isSessionActive.mockResolvedValue(true);
  mocks.resolveSessionContext.mockImplementation(
    async (
      _bindings: unknown,
      _cookieHeader: string | undefined,
      isActive: (candidateSessionId: string) => Promise<boolean>,
    ) => {
      expect(await isActive(sessionId)).toBe(true);
      return { ok: true, context: sessionContext };
    },
  );
  mocks.resolveWorkspace.mockResolvedValue({ role: 'admissions' });
  mocks.resolveAdmissions.mockResolvedValue({
    schemaVersion: 2,
    role: 'admissions',
    items: [],
  });
  mocks.resolveQueue.mockResolvedValue({
    schemaVersion: 1,
    role: 'finance',
    items: [],
  });
});

describe('production work queue default dependency wiring', () => {
  it('uses durable auth, workspace and admissions queue stores by default', async () => {
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      schemaVersion: 2,
      role: 'admissions',
      items: [],
    });
    expect(mocks.createHttpDatabase).toHaveBeenCalledTimes(3);
    expect(mocks.resolveSessionContext).toHaveBeenCalledTimes(1);
    expect(mocks.isSessionActive).toHaveBeenCalledWith(sessionId);
    expect(mocks.resolveWorkspace).toHaveBeenCalledWith(sessionId);
    expect(mocks.resolveAdmissions).toHaveBeenCalledWith(sessionId);
    expect(mocks.resolveQueue).not.toHaveBeenCalled();
  });

  it('selects the general persisted queue resolver for finance', async () => {
    mocks.resolveWorkspace.mockResolvedValue({ role: 'finance' });
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      schemaVersion: 1,
      role: 'finance',
      items: [],
    });
    expect(mocks.resolveQueue).toHaveBeenCalledWith(sessionId);
    expect(mocks.resolveAdmissions).not.toHaveBeenCalled();
  });

  it('bounds a default queue-store failure as unavailable', async () => {
    mocks.resolveAdmissions.mockRejectedValue(new Error('queue storage unavailable'));
    const response = await handleProductionOperatorWorkQueueRequest(request(), environment);
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'operator_work_queue_unavailable' },
    });
  });
});
