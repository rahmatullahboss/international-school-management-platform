import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseQuery = vi.hoisted(() => vi.fn());
const scheduleRuntimeProjectionWorker = vi.hoisted(() => vi.fn());

vi.mock('@school/database', () => ({
  createHttpDatabase: () => ({ query: databaseQuery }),
}));
vi.mock('./runtime-projection-scheduled', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, scheduleRuntimeProjectionWorker };
});

import app from './index.js';

const environment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  AUTH_PERMISSION_SOURCE: 'database',
  RUNTIME_READ_MODEL_SOURCE: 'database',
  AUTH_ALLOWED_WEB_ORIGINS: 'https://school.test',
  DATABASE_URL: 'postgresql://test.invalid/school',
};

beforeEach(() => {
  databaseQuery.mockReset();
  databaseQuery.mockResolvedValue([{ value: true }]);
  scheduleRuntimeProjectionWorker.mockReset();
});

describe('platform API index security boundaries', () => {
  it.each([
    ['/auth/v1/authorize', 'POST, OPTIONS', 'content-type'],
    ['/auth/v1/snapshot', 'GET, OPTIONS', 'if-none-match'],
  ] as const)(
    'allows configured same-origin preflight for %s',
    async (path, expectedMethods, expectedHeaders) => {
      const response = await app.request(
        path,
        { method: 'OPTIONS', headers: { origin: 'https://school.test' } },
        environment,
      );

      expect(response.status).toBe(204);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('vary')).toBe('Origin');
      expect(response.headers.get('access-control-allow-origin')).toBe('https://school.test');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-allow-methods')).toBe(expectedMethods);
      expect(response.headers.get('access-control-allow-headers')).toBe(expectedHeaders);
      expect(response.headers.get('access-control-max-age')).toBe('600');
      expect(databaseQuery).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['/auth/v1/authorize', 'permission_origin_denied'],
    ['/auth/v1/snapshot', 'runtime_read_model_origin_denied'],
  ] as const)('denies unapproved preflight origin for %s', async (path, code) => {
    const response = await app.request(
      path,
      { method: 'OPTIONS', headers: { origin: 'https://attacker.test' } },
      environment,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it.each([
    ['/auth/v1/authorize', 'permission_configuration_invalid'],
    ['/auth/v1/snapshot', 'runtime_read_model_configuration_invalid'],
  ] as const)('fails closed when preflight configuration is missing for %s', async (path, code) => {
    const response = await app.request(
      path,
      { method: 'OPTIONS', headers: { origin: 'https://school.test' } },
      { APP_ENV: 'test', APP_REGION: 'local', AUTH_ALLOWED_WEB_ORIGINS: 'https://school.test' },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it('delegates scheduled execution to the runtime projection scheduler', () => {
    const controller = { cron: '*/5 * * * *' } as unknown as ScheduledController;
    const executionContext = { waitUntil: vi.fn() } as unknown as ExecutionContext;

    const result = app.scheduled(controller, environment, executionContext);

    expect(result).toBeUndefined();
    expect(scheduleRuntimeProjectionWorker).toHaveBeenCalledWith(environment, executionContext);
  });
});
