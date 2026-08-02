import { describe, expect, it, vi } from 'vitest';

import type { HttpDatabase } from '@school/database';

import {
  enforceProductionDatabaseCredential,
  verifyProductionDatabaseCredential,
} from './production-database-credential.js';

const environment = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime.example.invalid/neondb',
};

function request(pathname: string, method = 'GET'): Request {
  return new Request(`https://api.example.com${pathname}`, { method });
}

function database(rows: readonly Record<string, unknown>[]): HttpDatabase {
  return {
    query: vi.fn().mockResolvedValue(rows),
  };
}

describe('production database credential verification', () => {
  it('accepts only one explicit boolean readiness row', async () => {
    await expect(verifyProductionDatabaseCredential(database([{ ready: true }]))).resolves.toBe(true);
    await expect(verifyProductionDatabaseCredential(database([{ ready: false }]))).resolves.toBe(
      false,
    );
    await expect(verifyProductionDatabaseCredential(database([{ ready: 'true' }]))).resolves.toBe(
      false,
    );
    await expect(
      verifyProductionDatabaseCredential(database([{ ready: true }, { ready: true }])),
    ).resolves.toBe(false);
  });

  it('does not expose the guard outside production or outside auth routes', async () => {
    const verify = vi.fn().mockResolvedValue(false);
    await expect(
      enforceProductionDatabaseCredential(request('/auth/v1/workspace'), {
        ...environment,
        APP_ENV: 'staging',
      }, { verify }),
    ).resolves.toBeUndefined();
    await expect(
      enforceProductionDatabaseCredential(request('/health'), environment, { verify }),
    ).resolves.toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it('keeps the base auth readiness endpoint available for diagnosis', async () => {
    const verify = vi.fn().mockResolvedValue(false);
    await expect(
      enforceProductionDatabaseCredential(request('/auth/v1/readiness'), environment, { verify }),
    ).resolves.toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it('reports a redacted positive database credential readiness result', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const response = await enforceProductionDatabaseCredential(
      request('/auth/v1/database-credential/readiness'),
      environment,
      { verify },
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({ schemaVersion: 1, ready: true });
    expect(verify).toHaveBeenCalledWith(environment.DATABASE_URL);
  });

  it('fails closed when the production database URL is missing', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const response = await enforceProductionDatabaseCredential(
      request('/auth/v1/workspace'),
      { APP_ENV: 'production' },
      { verify },
    );
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'production_database_credential_unavailable',
        message: 'The production database credential is unavailable.',
      },
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('fails closed when the database rejects the bound credential', async () => {
    const verify = vi.fn().mockResolvedValue(false);
    const response = await enforceProductionDatabaseCredential(
      request('/auth/v1/operator/commands', 'POST'),
      environment,
      { verify },
    );
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'production_database_credential_invalid',
        message: 'The production database credential is not authorized.',
      },
    });
  });

  it('maps verifier failures to the same redacted denial', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('postgresql://secret-user:secret@db.example'));
    const response = await enforceProductionDatabaseCredential(
      request('/auth/v1/database-credential/readiness'),
      environment,
      { verify },
    );
    expect(response?.status).toBe(503);
    const payload = await response?.json();
    expect(payload).toEqual({
      schemaVersion: 1,
      ready: false,
      error: {
        code: 'production_database_credential_invalid',
        message: 'The production database credential is not authorized.',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('secret-user');
  });

  it('allows configured auth requests only after a positive credential check', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    await expect(
      enforceProductionDatabaseCredential(request('/auth/v1/workspace'), environment, { verify }),
    ).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledOnce();
  });

  it('rejects mutations against the credential readiness endpoint', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const response = await enforceProductionDatabaseCredential(
      request('/auth/v1/database-credential/readiness', 'POST'),
      environment,
      { verify },
    );
    expect(response?.status).toBe(405);
    expect(verify).not.toHaveBeenCalled();
  });
});
