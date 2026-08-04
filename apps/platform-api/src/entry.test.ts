import { describe, expect, it, vi } from 'vitest';

import worker from './entry.js';

const secret = 'platform-entry-test-secret-0123456789abcdef';
const origin = 'http://127.0.0.1:4173';

function executionContext(promises: Promise<unknown>[] = []): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>): void {
      promises.push(promise);
    },
    passThroughOnException(): void {},
    props: {},
  } as unknown as ExecutionContext;
}

const environment = {
  APP_ENV: 'staging',
  APP_REGION: 'local',
  PILOT_SESSION_SECRET: secret,
};

describe('platform worker entry composition', () => {
  it('serves operator pilot routes before delegating to the core worker', async () => {
    const response = await worker.fetch(
      new Request('https://api.school.test/pilot/v1/sessions/finance', {
        method: 'POST',
        headers: { origin },
      }),
      environment,
      executionContext(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ scope: { role: 'finance' } });
  });

  it('delegates non-operator pilot routes to the existing core worker', async () => {
    const response = await worker.fetch(
      new Request('https://api.school.test/pilot/v1/sessions/admin', {
        method: 'POST',
        headers: { origin },
      }),
      environment,
      executionContext(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ scope: { role: 'admin' } });
  });

  it('delegates scheduled execution to the core projection scheduler', async () => {
    const promises: Promise<unknown>[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await worker.scheduled({} as ScheduledController, environment, executionContext(promises));

    expect(promises).toHaveLength(1);
    await Promise.all(promises);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('runtime_projection_batch'));
    log.mockRestore();
  });
});
