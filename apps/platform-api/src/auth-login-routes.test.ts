import { describe, expect, it } from 'vitest';

import { handleAuthLoginRequest, type AuthLoginBindings } from './auth-login-routes.js';

const unconfigured: AuthLoginBindings = {
  APP_ENV: 'production',
};

const configured: AuthLoginBindings = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime.example.invalid/neondb',
  OIDC_ISSUER: 'https://id.example.com',
  OIDC_CLIENT_ID: 'school-platform',
  OIDC_CLIENT_SECRET: 'provider-client-secret',
  OIDC_AUTHORIZATION_ENDPOINT: 'https://id.example.com/authorize',
  OIDC_TOKEN_ENDPOINT: 'https://id.example.com/token',
  OIDC_JWKS_URI: 'https://id.example.com/jwks',
  OIDC_REDIRECT_URI: 'https://api.example.com/auth/v1/callback',
  OIDC_ENDPOINT_ORIGINS: 'https://id.example.com',
  OIDC_PROVIDER_CACHE_SOURCE: 'database',
  OIDC_BACKCHANNEL_LOGOUT_SOURCE: 'database',
  AUTH_TRANSACTION_SECRET: 'transaction-secret-0123456789abcdef',
  AUTH_TRANSACTION_REPLAY_SOURCE: 'database',
  AUTH_SESSION_SECRET: 'session-secret-0123456789abcdef0123',
  AUTH_SESSION_REGISTRY_SOURCE: 'database',
  AUTH_MEMBERSHIP_SOURCE: 'database',
  AUTH_PERMISSION_SOURCE: 'database',
  RUNTIME_READ_MODEL_SOURCE: 'database',
  RUNTIME_MUTATION_SOURCE: 'database',
  RUNTIME_PROJECTION_WORKER_SOURCE: 'database',
  AUTH_ALLOWED_WEB_ORIGINS: 'https://web.example.com',
};

describe('durable OIDC login routes', () => {
  it('keeps login disabled when durable production configuration is missing', async () => {
    const response = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/readiness'),
      unconfigured,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      state: 'disabled',
      loginEnabled: false,
    });
  });

  it('reports login enabled only after all reviewed configuration is present', async () => {
    const response = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/readiness'),
      configured,
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      state: 'provider-test-ready',
      loginEnabled: true,
      missingConfiguration: [],
    });
  });

  it('fails closed before contacting a provider when login configuration is absent', async () => {
    const response = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/login?returnTo=%2Fadmin'),
      unconfigured,
    );
    expect(response?.status).toBe(503);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'oidc_login_unavailable',
        message: 'OIDC login is not configured.',
      },
    });
  });

  it('rejects duplicate login parameters before runtime/provider resolution', async () => {
    const response = await handleAuthLoginRequest(
      new Request(
        'https://api.example.com/auth/v1/login?returnTo=%2Fadmin&returnTo=%2Fstudent',
      ),
      configured,
    );
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'oidc_request_invalid',
        message: 'The OIDC request is invalid.',
      },
    });
  });

  it('rejects duplicate callback state before runtime/provider resolution', async () => {
    const response = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/callback?code=c&state=one&state=two'),
      configured,
    );
    expect(response?.status).toBe(400);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'oidc_request_invalid',
        message: 'The OIDC request is invalid.',
      },
    });
  });

  it('rejects oversized callback values before runtime/provider resolution', async () => {
    const response = await handleAuthLoginRequest(
      new Request(`https://api.example.com/auth/v1/callback?code=${'a'.repeat(4097)}&state=s`),
      configured,
    );
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'oidc_request_invalid' },
    });
  });

  it('rejects mutation methods on login and readiness routes', async () => {
    const login = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/login', { method: 'POST' }),
      configured,
    );
    const readiness = await handleAuthLoginRequest(
      new Request('https://api.example.com/auth/v1/readiness', { method: 'POST' }),
      configured,
    );
    expect(login?.status).toBe(405);
    expect(readiness?.status).toBe(405);
  });

  it('does not intercept unrelated API routes', async () => {
    await expect(
      handleAuthLoginRequest(new Request('https://api.example.com/health'), configured),
    ).resolves.toBeUndefined();
  });
});
