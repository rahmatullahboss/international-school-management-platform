import { describe, expect, it } from 'vitest';

import app from './index.js';

describe('platform API', () => {
  it('returns a correlation id and non-sensitive health response', async () => {
    const response = await app.request('/health', {}, { APP_ENV: 'test', APP_REGION: 'local' });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      environment: 'test',
      region: 'local',
    });
  });
});
