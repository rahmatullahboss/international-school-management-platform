import { describe, expect, it, vi } from 'vitest';

import {
  authorizeDatabasePermission,
  isPermissionContentTypeAllowed,
  isPermissionDeclaredLengthAllowed,
  readBoundedPermissionRequestBody,
  type PermissionAuthenticator,
  type PermissionEvaluator,
} from './auth-permission.js';

const allowedOrigins = 'https://school.test';
const sessionId = '40000000-0000-4000-8000-000000000006';

function authenticated(): PermissionAuthenticator {
  return vi.fn(async () => {
    await Promise.resolve();
    return { ok: true as const, sessionId };
  });
}

function evaluator(
  decision:
    | { readonly allowed: true; readonly reason: 'role-grant' }
    | {
        readonly allowed: false;
        readonly reason: 'permission-not-granted' | 'session-inactive';
      }
    | {
        readonly allowed: false;
        readonly reason: 'step-up-required';
        readonly requiredAssurance: 'aal2';
      },
): PermissionEvaluator {
  return vi.fn(async () => {
    await Promise.resolve();
    return decision;
  });
}

describe('database-backed permission HTTP boundary', () => {
  it('authorizes one exact permission using only the signed active session id', async () => {
    const authenticate = authenticated();
    const evaluate = evaluator({ allowed: true, reason: 'role-grant' });
    await expect(
      authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'finance.read' }),
        authenticate,
        evaluate,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 200,
      decision: { allowed: true, reason: 'role-grant' },
    });
    expect(authenticate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith(sessionId, 'finance.read');
  });

  it('returns current database denial and AAL2 step-up decisions without leaking grants', async () => {
    await expect(
      authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json; charset=utf-8',
        rawBody: JSON.stringify({ permission: 'care.restricted.read' }),
        authenticate: authenticated(),
        evaluate: evaluator({ allowed: false, reason: 'permission-not-granted' }),
      }),
    ).resolves.toEqual({
      ok: true,
      status: 403,
      decision: { allowed: false, reason: 'permission-not-granted' },
    });
    await expect(
      authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'records.approve' }),
        authenticate: authenticated(),
        evaluate: evaluator({
          allowed: false,
          reason: 'step-up-required',
          requiredAssurance: 'aal2',
        }),
      }),
    ).resolves.toEqual({
      ok: true,
      status: 403,
      decision: {
        allowed: false,
        reason: 'step-up-required',
        requiredAssurance: 'aal2',
      },
    });
  });

  it('rejects browser-declared scope, malformed keys and unsafe origins before authentication', async () => {
    for (const input of [
      {
        origin: 'https://evil.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'finance.read' }),
        status: 403,
      },
      {
        origin: 'https://school.test',
        contentType: 'text/plain',
        rawBody: JSON.stringify({ permission: 'finance.read' }),
        status: 400,
      },
      {
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'finance.read', tenantId: 'attacker' }),
        status: 400,
      },
      {
        origin: 'https://school.test',
        contentType: 'application/json',
        rawBody: JSON.stringify({ permission: 'Finance Read' }),
        status: 400,
      },
    ] as const) {
      const authenticate = authenticated();
      const evaluate = evaluator({ allowed: true, reason: 'role-grant' });
      const result = await authorizeDatabasePermission({
        configured: true,
        allowedOrigins,
        origin: input.origin,
        contentType: input.contentType,
        rawBody: input.rawBody,
        authenticate,
        evaluate,
      });
      expect(result).toMatchObject({ ok: false, status: input.status });
      expect(authenticate).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    }
  });

  it('fails closed for missing configuration, inactive cookies and database outages', async () => {
    const request = {
      allowedOrigins,
      origin: 'https://school.test',
      contentType: 'application/json',
      rawBody: JSON.stringify({ permission: 'finance.read' }),
    };
    await expect(
      authorizeDatabasePermission({
        ...request,
        configured: false,
        authenticate: authenticated(),
        evaluate: evaluator({ allowed: true, reason: 'role-grant' }),
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'permission_configuration_invalid',
    });
    await expect(
      authorizeDatabasePermission({
        ...request,
        configured: true,
        authenticate: async () => {
          await Promise.resolve();
          return {
            ok: false,
            status: 401,
            code: 'browser_session_revoked',
            message: 'The browser session is no longer active.',
          };
        },
        evaluate: evaluator({ allowed: true, reason: 'role-grant' }),
      }),
    ).resolves.toMatchObject({ ok: false, status: 401, code: 'browser_session_revoked' });
    await expect(
      authorizeDatabasePermission({
        ...request,
        configured: true,
        authenticate: authenticated(),
        evaluate: async () => {
          await Promise.resolve();
          throw new Error('database detail');
        },
      }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'permission_evaluation_unavailable',
      message: 'Permission evaluation is unavailable.',
    });
  });

  it('validates the declared body length before route body consumption', () => {
    expect(isPermissionDeclaredLengthAllowed(undefined)).toBe(true);
    expect(isPermissionDeclaredLengthAllowed('00042')).toBe(true);
    expect(isPermissionDeclaredLengthAllowed('42garbage')).toBe(false);
    expect(isPermissionDeclaredLengthAllowed('2049')).toBe(false);
  });

  it('rejects invalid media types and bounds chunked bodies by bytes before parsing', async () => {
    expect(isPermissionContentTypeAllowed('application/json')).toBe(true);
    expect(isPermissionContentTypeAllowed('application/json; charset=utf-8')).toBe(true);
    expect(isPermissionContentTypeAllowed('text/plain')).toBe(false);

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('x'.repeat(2048)));
        controller.enqueue(encoder.encode('x'));
        controller.close();
      },
    });
    await expect(readBoundedPermissionRequestBody(body)).resolves.toBeUndefined();
  });
});
