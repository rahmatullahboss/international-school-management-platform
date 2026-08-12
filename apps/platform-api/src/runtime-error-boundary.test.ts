import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeEnvironmentParser = vi.hoisted(() => vi.fn());
vi.mock('@school/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@school/platform')>();
  return {
    ...actual,
    parseRuntimeEnvironment: runtimeEnvironmentParser,
  };
});

import worker from './entry.js';

const sessionSecret = 'SESSION_SECRET_SENTINEL_0123456789_abcdefghijklmnopqrstuvwxyz';
const databaseUrl =
  'postgresql://runtime_user:DATABASE_PASSWORD_SENTINEL@database.invalid/school?token=DATABASE_TOKEN_SENTINEL';

const environment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  AUTH_SESSION_SECRET: sessionSecret,
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  DATABASE_URL: databaseUrl,
};

const executionContext = {} as ExecutionContext;

describe('runtime unexpected-error secret boundary', () => {
  beforeEach(() => {
    runtimeEnvironmentParser.mockReset();
  });

  it('returns a stable 500 without reflecting request, environment or exception sentinels', async () => {
    const cookieSentinel = 'COOKIE_VALUE_SENTINEL';
    const authorizationSentinel = 'AUTHORIZATION_BEARER_SENTINEL';
    const querySentinel = 'QUERY_ACCESS_TOKEN_SENTINEL';
    const exceptionSentinel = 'EXCEPTION_MESSAGE_SENTINEL';
    const stackSentinel = 'STACK_DETAIL_SENTINEL';

    const failure = new Error(`${exceptionSentinel} ${databaseUrl}`);
    failure.stack = `${stackSentinel}\n${failure.message}`;
    runtimeEnvironmentParser.mockImplementation(() => {
      throw failure;
    });

    const request = new Request(`https://school.test/health?access_token=${querySentinel}`, {
      headers: {
        authorization: `Bearer ${authorizationSentinel}`,
        cookie: `session=${sessionSecret}; attacker_cookie=${cookieSentinel}`,
      },
    });

    const response = await worker.fetch(request, environment, executionContext);
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/u);
    expect(JSON.parse(responseText)).toEqual({
      error: {
        code: 'internal_error',
        message: 'The request could not be completed.',
      },
    });

    for (const sentinel of [
      cookieSentinel,
      authorizationSentinel,
      querySentinel,
      exceptionSentinel,
      stackSentinel,
      'DATABASE_PASSWORD_SENTINEL',
      'DATABASE_TOKEN_SENTINEL',
      sessionSecret,
    ]) {
      expect(responseText).not.toContain(sentinel);
    }
  });
});
