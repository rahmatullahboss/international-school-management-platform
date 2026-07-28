import { describe, expect, it } from 'vitest';

import { parseRuntimeEnvironment } from './environment.js';

describe('parseRuntimeEnvironment', () => {
  it('rejects missing deployment metadata without echoing secrets', () => {
    const environment = { APP_REGION: 'local', DATABASE_URL: 'postgres://top-secret' };
    expect(() => parseRuntimeEnvironment(environment)).toThrow('APP_ENV is required');
  });

  it('returns only safe routing metadata', () => {
    expect(
      parseRuntimeEnvironment({
        APP_ENV: 'staging',
        APP_REGION: 'ap-southeast-1',
        DATABASE_URL: 'postgres://top-secret',
      }),
    ).toEqual({ environment: 'staging', region: 'ap-southeast-1' });
  });
});
