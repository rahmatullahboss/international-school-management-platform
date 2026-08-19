import { beforeEach, describe, expect, it, vi } from 'vitest';

const coreMocks = vi.hoisted(() => ({
  onError: vi.fn(),
  fetch: vi.fn(),
  scheduled: vi.fn(),
}));

const boundaryMocks = vi.hoisted(() => ({
  enforceProductionPreAuthRateLimit: vi.fn(),
  enforceProductionDatabaseCredential: vi.fn(),
  handleAuthLoginRequest: vi.fn(),
  handleProductionOperatorWorkQueueRequest: vi.fn(),
  handleProductionOperatorCommandRequest: vi.fn(),
  enforceProductionPilotBoundary: vi.fn(),
  handlePilotOperatorRequest: vi.fn(),
  runtimeInternalErrorResponse: vi.fn(
    () =>
      new Response(JSON.stringify({ error: { code: 'internal_error' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
  ),
}));

vi.mock('./index', () => ({
  default: {
    onError: coreMocks.onError,
    fetch: coreMocks.fetch,
    scheduled: coreMocks.scheduled,
  },
}));

vi.mock('./production-auth-rate-limit', () => ({
  enforceProductionPreAuthRateLimit: boundaryMocks.enforceProductionPreAuthRateLimit,
}));
vi.mock('./production-database-credential', () => ({
  enforceProductionDatabaseCredential: boundaryMocks.enforceProductionDatabaseCredential,
}));
vi.mock('./auth-login-routes', () => ({
  handleAuthLoginRequest: boundaryMocks.handleAuthLoginRequest,
}));
vi.mock('./production-operator-work-queue-api', () => ({
  handleProductionOperatorWorkQueueRequest: boundaryMocks.handleProductionOperatorWorkQueueRequest,
}));
vi.mock('./production-operator-command-api', () => ({
  handleProductionOperatorCommandRequest: boundaryMocks.handleProductionOperatorCommandRequest,
}));
vi.mock('./production-boundary', () => ({
  enforceProductionPilotBoundary: boundaryMocks.enforceProductionPilotBoundary,
}));
vi.mock('./pilot-operator-api', () => ({
  handlePilotOperatorRequest: boundaryMocks.handlePilotOperatorRequest,
}));
vi.mock('./runtime-error-boundary', () => ({
  runtimeInternalErrorResponse: boundaryMocks.runtimeInternalErrorResponse,
}));

const executionContext = {} as ExecutionContext;
const scheduledController = {} as ScheduledController;

beforeEach(() => {
  vi.resetModules();
  coreMocks.onError.mockReset();
  coreMocks.fetch.mockReset();
  coreMocks.scheduled.mockReset();
  for (const mock of Object.values(boundaryMocks)) mock.mockReset();
  boundaryMocks.runtimeInternalErrorResponse.mockImplementation(
    () =>
      new Response(JSON.stringify({ error: { code: 'internal_error' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
  );
});

describe('platform API entry boundary', () => {
  it('registers the stable internal-error response with the core worker', async () => {
    await import('./entry.js');

    expect(coreMocks.onError).toHaveBeenCalledOnce();
    const handler = coreMocks.onError.mock.calls[0]?.[0] as (() => Response) | undefined;
    expect(handler).toBeDefined();

    const response = handler?.();

    expect(boundaryMocks.runtimeInternalErrorResponse).toHaveBeenCalledOnce();
    expect(response?.status).toBe(500);
  });

  it('contains failures thrown before the core router and returns the stable runtime error', async () => {
    boundaryMocks.enforceProductionPreAuthRateLimit.mockRejectedValue(
      new Error('rate limit failure'),
    );
    const { default: worker } = await import('./entry.js');

    const response = await worker.fetch(
      new Request('https://school.test/auth/v1/session'),
      {} as never,
      executionContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: { code: 'internal_error' } });
    expect(boundaryMocks.runtimeInternalErrorResponse).toHaveBeenCalledOnce();
    expect(boundaryMocks.enforceProductionDatabaseCredential).not.toHaveBeenCalled();
    expect(coreMocks.fetch).not.toHaveBeenCalled();
  });

  it('delegates scheduled events to the core projection worker when it is available', async () => {
    const { default: worker } = await import('./entry.js');
    const environment = { APP_REGION: 'local' } as never;

    const result = worker.scheduled(scheduledController, environment, executionContext);

    expect(result).toBeUndefined();
    expect(coreMocks.scheduled).toHaveBeenCalledWith(
      scheduledController,
      environment,
      executionContext,
    );
  });
});
