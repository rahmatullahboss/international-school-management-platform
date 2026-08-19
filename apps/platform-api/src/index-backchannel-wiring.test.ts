import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  database: { kind: 'database-fixture' },
  configuration: { kind: 'configuration-fixture' },
  endpointOrigins: ['https://identity.school.test'],
  createDatabase: vi.fn(),
  resolveConfiguration: vi.fn(),
  resolveEndpointOrigins: vi.fn(),
  handleRequest: vi.fn(),
  declaredLengthAllowed: vi.fn(),
  readBody: vi.fn(),
  authConstructor: vi.fn(),
  cacheStoreConstructor: vi.fn(),
  applyLogout: vi.fn(),
  cacheConstructor: vi.fn(),
  resolveJwks: vi.fn(),
  processLogout: vi.fn(),
}));

vi.mock('@school/database', () => ({ createHttpDatabase: harness.createDatabase }));

vi.mock('./auth-boundary', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resolveAuthProviderConfiguration: harness.resolveConfiguration,
    resolveAuthProviderEndpointOrigins: harness.resolveEndpointOrigins,
  };
});

vi.mock('./auth-backchannel', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    handleOidcBackchannelLogoutRequest: harness.handleRequest,
    isOidcBackchannelDeclaredLengthAllowed: harness.declaredLengthAllowed,
    readBoundedOidcBackchannelBody: harness.readBody,
  };
});

vi.mock('./auth-durable-store', () => ({
  DurableAuthStore: class {
    constructor(database: unknown) {
      harness.authConstructor(database);
    }

    processBackchannelLogout(claims: unknown, reason: string): Promise<unknown> {
      return harness.applyLogout(claims, reason) as Promise<unknown>;
    }
  },
  DurableOidcProviderCacheStore: class {
    constructor(database: unknown) {
      harness.cacheStoreConstructor(database);
    }
  },
}));

vi.mock('@school/policy', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    OidcProviderCache: class {
      constructor(options: unknown) {
        harness.cacheConstructor(options);
      }

      resolveJwks(options: unknown): Promise<unknown> {
        return harness.resolveJwks(options) as Promise<unknown>;
      }
    },
    processOidcBackchannelLogout: harness.processLogout,
  };
});

import app from './index.js';

interface ProcessorInput {
  readonly configured: boolean;
  readonly contentType?: string;
  readonly contentLength?: string;
  readonly rawBody: string;
  readonly processor: (assertion: string) => Promise<unknown>;
}

interface ProcessInput {
  readonly logoutToken: string;
  readonly configuration: unknown;
  readonly resolveJwks: (forceRefresh: boolean) => Promise<unknown>;
  readonly applyLogout: (claims: unknown) => Promise<unknown>;
}

const environment = {
  APP_ENV: 'test',
  APP_REGION: 'local',
  OIDC_PROVIDER_CACHE_SOURCE: 'database',
  OIDC_BACKCHANNEL_LOGOUT_SOURCE: 'database',
  DATABASE_URL: '[REDACTED_SECRET]',
};

beforeEach(() => {
  for (const mock of Object.values(harness)) {
    if (typeof mock === 'function' && 'mockReset' in mock) mock.mockReset();
  }
  harness.createDatabase.mockReturnValue(harness.database);
  harness.resolveConfiguration.mockReturnValue(harness.configuration);
  harness.resolveEndpointOrigins.mockReturnValue(harness.endpointOrigins);
  harness.declaredLengthAllowed.mockReturnValue(true);
  harness.readBody.mockResolvedValue('fixture=1');
  harness.applyLogout.mockResolvedValue({ revoked: true });
  harness.resolveJwks.mockResolvedValue({ keys: [] });
  harness.processLogout.mockImplementation(async (input: ProcessInput) => {
    await input.resolveJwks(false);
    await input.resolveJwks(true);
    await input.applyLogout({ sid: 'session-fixture' });
    return { ok: true };
  });
  harness.handleRequest.mockImplementation(async (input: ProcessorInput) => {
    await input.processor('assertion-fixture');
    return { ok: true, status: 204 };
  });
});

describe('platform API back-channel logout wiring', () => {
  it('binds provider logout processing to durable cache and session revocation', async () => {
    const response = await app.request(
      '/auth/v1/backchannel-logout',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': '9',
        },
        body: 'fixture=1',
      },
      environment,
    );

    expect(response.status).toBe(204);
    expect(harness.declaredLengthAllowed).toHaveBeenCalledWith('9');
    expect(harness.readBody).toHaveBeenCalledOnce();
    expect(harness.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ configured: true, rawBody: 'fixture=1' }),
    );
    expect(harness.createDatabase).toHaveBeenCalledWith(environment.DATABASE_URL);
    expect(harness.authConstructor).toHaveBeenCalledWith(harness.database);
    expect(harness.cacheStoreConstructor).toHaveBeenCalledWith(harness.database);
    expect(harness.cacheConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ allowedEndpointOrigins: harness.endpointOrigins }),
    );

    const processInput = harness.processLogout.mock.calls[0]?.[0] as ProcessInput | undefined;
    expect(processInput?.configuration).toBe(harness.configuration);
    expect(processInput?.logoutToken).toBe('assertion-fixture');
    expect(harness.resolveJwks).toHaveBeenNthCalledWith(1, {
      configuration: harness.configuration,
    });
    expect(harness.resolveJwks).toHaveBeenNthCalledWith(2, {
      configuration: harness.configuration,
      forceRefresh: true,
    });
    expect(harness.applyLogout).toHaveBeenCalledWith(
      { sid: 'session-fixture' },
      'provider back-channel logout',
    );
  });
});
