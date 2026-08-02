import { describe, expect, it } from 'vitest';

import { enforceProductionPilotBoundary } from './production-boundary.js';

describe('production pilot boundary', () => {
  it.each([
    '/pilot',
    '/pilot/v1/sessions/admin',
    '/pilot/v1/snapshots/teacher',
    '/pilot/v1/sessions/finance',
    '/pilot/v1/commands/support/tenant.diagnostics.capture',
  ])('denies %s in production', async (pathname) => {
    const response = enforceProductionPilotBoundary(
      new Request(`https://api.example.com${pathname}`),
      { APP_ENV: 'production' },
    );
    expect(response?.status).toBe(404);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'not_found',
        message: 'The requested resource was not found.',
      },
    });
  });

  it('does not deny real production auth or runtime routes', () => {
    for (const pathname of ['/auth/v1/login', '/auth/v1/snapshot', '/health']) {
      expect(
        enforceProductionPilotBoundary(new Request(`https://api.example.com${pathname}`), {
          APP_ENV: 'production',
        }),
      ).toBeUndefined();
    }
  });

  it('leaves pilot routes available outside production', () => {
    expect(
      enforceProductionPilotBoundary(new Request('https://api.example.com/pilot/v1/sessions/admin'), {
        APP_ENV: 'staging',
      }),
    ).toBeUndefined();
  });
});
