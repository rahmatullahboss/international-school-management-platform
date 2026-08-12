import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_SESSION_COOKIE_NAME, issueBrowserSession } from '@school/policy';

const databaseQuery = vi.hoisted(() => vi.fn());
vi.mock('@school/database', () => ({
  createHttpDatabase: () => ({ query: databaseQuery }),
}));

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

async function browserCookie(): Promise<string> {
  const issued = await issueBrowserSession({
    secret: sessionSecret,
    identity: {
      issuer: 'https://identity.school.test',
      subject: 'provider-user-redaction-test',
      assurance: 'aal2',
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    },
    membership: {
      membershipId: '71000000-0000-4000-8000-000000000001',
      principalId: '71000000-0000-4000-8000-000000000002',
      tenantId: '71000000-0000-4000-8000-000000000003',
      campusId: '71000000-0000-4000-8000-000000000004',
      roleIds: ['71000000-0000-4000-8000-000000000005'],
    },
  });
  if (!issued.ok) throw new Error('Synthetic browser session issuance failed.');
  return `${BROWSER_SESSION_COOKIE_NAME}=${issued.token}`;
}

const executionContext = {} as ExecutionContext;

describe('runtime unexpected-error secret boundary', () => {
  beforeEach(() => {
    databaseQuery.mockReset();
  });

  it('returns a stable 500 without reflecting request, environment or exception sentinels', async () => {
    const cookieSentinel = 'COOKIE_VALUE_SENTINEL';
    const authorizationSentinel = 'AUTHORIZATION_BEARER_SENTINEL';
    const querySentinel = 'QUERY_ACCESS_TOKEN_SENTINEL';
    const exceptionSentinel = 'EXCEPTION_MESSAGE_SENTINEL';
    const stackSentinel = 'STACK_DETAIL_SENTINEL';

    const failure = new Error(`${exceptionSentinel} ${databaseUrl}`);
    failure.stack = `${stackSentinel}\n${failure.message}`;
    databaseQuery.mockRejectedValueOnce(failure);

    const cookie = await browserCookie();
    const request = new Request(
      `https://school.test/auth/v1/session?access_token=${querySentinel}`,
      {
        headers: {
          authorization: `Bearer ${authorizationSentinel}`,
          cookie: `${cookie}; attacker_cookie=${cookieSentinel}`,
        },
      },
    );

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
