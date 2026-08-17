import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createHttpDatabase: vi.fn(() => ({ kind: 'database' })),
  resolveSessionContext: vi.fn(),
  isSessionActive: vi.fn(),
  resolveWorkspace: vi.fn(),
  submitOperatorDomainCommand: vi.fn(),
}));

vi.mock('@school/database', () => ({
  createHttpDatabase: mocks.createHttpDatabase,
}));

vi.mock('./auth-boundary.js', () => ({
  resolveAuthenticatedBrowserSessionContext: mocks.resolveSessionContext,
}));

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

vi.mock('./database-operator-domain-command-store.js', () => ({
  DatabaseOperatorDomainCommandStore: class {
    constructor(database: unknown) {
      void database;
    }
  },
}));

vi.mock('./operator-domain-commands.js', () => ({
  submitOperatorDomainCommand: mocks.submitOperatorDomainCommand,
}));

import {
  handleProductionOperatorCommandRequest,
  type ProductionOperatorCommandBindings,
} from './production-operator-command-api.js';

const sessionId = '9a000000-0000-4000-8000-000000000001';
const environment: ProductionOperatorCommandBindings = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime.example.invalid/neondb',
  AUTH_SESSION_SECRET: 'session-secret-0123456789abcdef0123',
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  AUTH_PERMISSION_SOURCE: 'database',
  RUNTIME_MUTATION_SOURCE: 'database',
  AUTH_ALLOWED_WEB_ORIGINS: 'https://web.example.com',
};

const sessionContext = {
  sessionId,
  principalId: '9a000000-0000-4000-8000-000000000002',
  membershipId: '9a000000-0000-4000-8000-000000000003',
  tenantId: '9a000000-0000-4000-8000-000000000004',
  campusId: '9a000000-0000-4000-8000-000000000005',
  roleIds: ['9a000000-0000-4000-8000-000000000006'],
  assurance: 'aal2' as const,
  expiresAt: '2026-08-18T06:00:00.000Z',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function request(): Request {
  return new Request('https://web.example.com/auth/v1/operator/commands', {
    method: 'POST',
    headers: {
      origin: 'https://web.example.com',
      cookie: '__Host-school-session=active',
      'content-type': 'application/json',
      'idempotency-key': 'command-default-deps-0001',
    },
    body: JSON.stringify({
      command: 'admissions.application.review.record',
      applicationId: '9a000000-0000-4000-8000-000000000010',
      expectedVersion: 1,
      recommendation: 'admit',
      score: null,
      notes: null,
    }),
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
  mocks.submitOperatorDomainCommand.mockImplementation((input: Record<string, unknown>) => {
    const commandInput = input.input;
    if (!isRecord(commandInput)) throw new Error('expected command input');
    return Promise.resolve({
      accepted: true,
      replayed: false,
      receipt: {
        commandId: '9a000000-0000-4000-8000-000000000020',
        command: commandInput.command,
        domainEvidenceId: '9a000000-0000-4000-8000-000000000021',
        idempotencyKey: commandInput.idempotencyKey,
        correlationId: commandInput.correlationId,
        acceptedAt: '2026-08-18T03:30:00.000Z',
      },
    });
  });
});

describe('production command default dependency wiring', () => {
  it('uses durable auth, workspace and domain-command stores by default', async () => {
    const response = await handleProductionOperatorCommandRequest(request(), environment);
    expect(response?.status).toBe(202);
    const payload = (await response?.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      replayed: false,
      receipt: {
        command: 'admissions.application.review.record',
        idempotencyKey: 'command-default-deps-0001',
      },
    });
    const receipt = payload.receipt;
    if (!isRecord(receipt)) throw new Error('expected command receipt');
    const generatedCorrelationId = receipt.correlationId;
    expect(typeof generatedCorrelationId).toBe('string');
    if (typeof generatedCorrelationId !== 'string') throw new Error('expected correlation id');
    expect(generatedCorrelationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(mocks.createHttpDatabase).toHaveBeenCalledTimes(3);
    expect(mocks.resolveSessionContext).toHaveBeenCalledTimes(1);
    expect(mocks.isSessionActive).toHaveBeenCalledWith(sessionId);
    expect(mocks.resolveWorkspace).toHaveBeenCalledWith(sessionId);
    expect(mocks.submitOperatorDomainCommand).toHaveBeenCalledTimes(1);
  });
});
