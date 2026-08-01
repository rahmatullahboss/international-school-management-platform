import { describe, expect, it } from 'vitest';

import { handlePilotOperatorRequest } from './pilot-operator-api.js';
import { issuePilotOperatorSession } from './pilot-operator-sessions.js';
import type { PilotOperatorRole } from './pilot-operator-models.js';

const secret = 'pilot-operator-api-test-secret-0123456789abcdef';
const environment = { APP_ENV: 'staging', PILOT_SESSION_SECRET: secret } as const;
const origin = 'http://127.0.0.1:4173';

async function tokenFor(role: PilotOperatorRole): Promise<string> {
  const issuance = await issuePilotOperatorSession(secret, role);
  if (!issuance.ok) throw new Error(`expected ${role} pilot session`);
  return issuance.token;
}

async function financeToken(): Promise<string> {
  return tokenFor('finance');
}

function commandRequest(
  token: string,
  idempotencyKey: string,
  body: unknown,
  overrides: { readonly contentType?: string; readonly contentLength?: string } = {},
) {
  return new Request(
    'https://api.school.test/pilot/v1/commands/finance/cash-session.reconcile.record',
    {
      method: 'POST',
      headers: {
        origin,
        authorization: `Bearer ${token}`,
        'content-type': overrides.contentType ?? 'application/json',
        'idempotency-key': idempotencyKey,
        ...(overrides.contentLength === undefined
          ? {}
          : { 'content-length': overrides.contentLength }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

async function requiredResponse(request: Request, env = environment): Promise<Response> {
  const response = await handlePilotOperatorRequest(request, env);
  if (response === undefined) throw new Error('expected operator route response');
  return response;
}

function authorizedRequest(
  path: string,
  method: 'GET' | 'POST',
  token: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request(`https://api.school.test${path}`, {
    method,
    headers: {
      origin,
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('pilot operator API routing and environment boundary', () => {
  it('ignores routes outside the operator pilot contract', async () => {
    await expect(
      handlePilotOperatorRequest(new Request('https://api.school.test/health'), environment),
    ).resolves.toBeUndefined();
    await expect(
      handlePilotOperatorRequest(
        new Request('https://api.school.test/pilot/v1/sessions/admin', { method: 'POST' }),
        environment,
      ),
    ).resolves.toBeUndefined();
  });

  it('fails closed in production before issuing any pilot response', async () => {
    const response = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/sessions/finance', {
        method: 'POST',
        headers: { origin },
      }),
      { APP_ENV: 'production', PILOT_SESSION_SECRET: secret },
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });

  it('rejects untrusted origins and handles trusted preflight', async () => {
    const denied = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/sessions/finance', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('vary')).toBe('Origin');
    await expect(denied.json()).resolves.toMatchObject({
      error: { code: 'pilot_origin_denied' },
    });

    const preflight = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/sessions/finance', {
        method: 'OPTIONS',
        headers: { origin },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

describe('pilot operator session and snapshot API', () => {
  it('enforces the session method and secret configuration', async () => {
    const wrongMethod = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/sessions/finance', {
        method: 'GET',
        headers: { origin },
      }),
    );
    expect(wrongMethod.status).toBe(405);

    const missingSecret = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/sessions/finance', {
        method: 'POST',
        headers: { origin },
      }),
      { APP_ENV: 'staging' },
    );
    expect(missingSecret.status).toBe(503);
    await expect(missingSecret.json()).resolves.toMatchObject({
      error: { code: 'pilot_session_unavailable' },
    });
  });

  it.each(['admissions', 'finance', 'support'] as const)(
    'issues a no-store %s session',
    async (role) => {
      const response = await requiredResponse(
        new Request(`https://api.school.test/pilot/v1/sessions/${role}`, {
          method: 'POST',
          headers: { origin },
        }),
      );
      expect(response.status).toBe(201);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      await expect(response.json()).resolves.toMatchObject({
        schemaVersion: 1,
        tokenType: 'Bearer',
        scope: { role },
      });
    },
  );

  it('requires authentication and the GET method for snapshots', async () => {
    const token = await financeToken();
    const wrongMethod = await requiredResponse(
      authorizedRequest('/pilot/v1/snapshots/finance', 'POST', token),
    );
    expect(wrongMethod.status).toBe(405);

    const missingSession = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/snapshots/finance', {
        headers: { origin },
      }),
    );
    expect(missingSession.status).toBe(401);
    expect(missingSession.headers.get('cache-control')).toBe('no-store');
  });

  it('serves role-scoped snapshots with ETag revalidation', async () => {
    const token = await financeToken();
    const first = await requiredResponse(
      authorizedRequest('/pilot/v1/snapshots/finance', 'GET', token),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    await expect(first.json()).resolves.toMatchObject({ scope: { role: 'finance' } });

    const cached = await requiredResponse(
      authorizedRequest('/pilot/v1/snapshots/finance', 'GET', token, undefined, {
        'if-none-match': etag ?? '',
      }),
    );
    expect(cached.status).toBe(304);
  });
});

describe('pilot operator authorization and audit API', () => {
  it('validates authorization requests and exposes allow/deny decisions', async () => {
    const token = await financeToken();
    const wrongMethod = await requiredResponse(
      authorizedRequest('/pilot/v1/authorize/finance', 'GET', token),
    );
    expect(wrongMethod.status).toBe(405);

    const missingSession = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/authorize/finance', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ permission: 'finance.invoice.read' }),
      }),
    );
    expect(missingSession.status).toBe(401);

    for (const body of [{}, { permission: '' }, { permission: 'x'.repeat(129) }]) {
      const invalid = await requiredResponse(
        authorizedRequest('/pilot/v1/authorize/finance', 'POST', token, body),
      );
      expect(invalid.status).toBe(400);
      await expect(invalid.json()).resolves.toMatchObject({
        error: { code: 'pilot_permission_request_invalid' },
      });
    }

    const allowed = await requiredResponse(
      authorizedRequest('/pilot/v1/authorize/finance', 'POST', token, {
        permission: 'finance.reconciliation.write',
      }),
    );
    await expect(allowed.json()).resolves.toMatchObject({
      decision: { allowed: true, reason: 'role-grant' },
    });

    const denied = await requiredResponse(
      authorizedRequest('/pilot/v1/authorize/finance', 'POST', token, {
        permission: 'finance.refund.approve',
      }),
    );
    await expect(denied.json()).resolves.toMatchObject({
      decision: { allowed: false, reason: 'permission-not-granted' },
    });
  });

  it('protects audit reads and returns the role-scoped ledger', async () => {
    const token = await financeToken();
    const wrongMethod = await requiredResponse(
      authorizedRequest('/pilot/v1/audit/finance', 'POST', token),
    );
    expect(wrongMethod.status).toBe(405);

    const missingSession = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/audit/finance', { headers: { origin } }),
    );
    expect(missingSession.status).toBe(401);

    const audit = await requiredResponse(
      authorizedRequest('/pilot/v1/audit/finance', 'GET', token),
    );
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      schemaVersion: 1,
      scope: { role: 'finance', tenantId: 'tenant-pilot-001', campusId: 'campus-main' },
      entries: expect.any(Array),
    });
  });
});

describe('pilot operator command request integrity', () => {
  it('enforces POST, published command names and authentication', async () => {
    const token = await financeToken();
    const wrongMethod = await requiredResponse(
      new Request(
        'https://api.school.test/pilot/v1/commands/finance/cash-session.reconcile.record',
        { method: 'GET', headers: { origin, authorization: `Bearer ${token}` } },
      ),
    );
    expect(wrongMethod.status).toBe(405);

    const unknown = await requiredResponse(
      new Request('https://api.school.test/pilot/v1/commands/finance/not-a-command', {
        method: 'POST',
        headers: { origin, authorization: `Bearer ${token}` },
      }),
    );
    expect(unknown.status).toBe(404);
    await expect(unknown.json()).resolves.toMatchObject({
      error: { code: 'pilot_command_not_found' },
    });

    const missingSession = await requiredResponse(
      new Request(
        'https://api.school.test/pilot/v1/commands/finance/cash-session.reconcile.record',
        { method: 'POST', headers: { origin } },
      ),
    );
    expect(missingSession.status).toBe(401);
  });

  it('rejects caller-expanded command scope fields', async () => {
    const token = await financeToken();
    const response = await requiredResponse(
      commandRequest(token, `expanded-${crypto.randomUUID()}`, {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        reason: 'Record reviewed reconciliation evidence.',
        subjectId: 'caller-selected-subject',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'pilot_command_invalid' },
    });
  });

  it.each([
    [
      'bad content type',
      { contentType: 'text/plain' },
      { tenantId: 'tenant-pilot-001', campusId: 'campus-main', reason: 'ok' },
    ],
    [
      'bad content length',
      { contentLength: 'not-a-number' },
      { tenantId: 'tenant-pilot-001', campusId: 'campus-main', reason: 'ok' },
    ],
    [
      'oversize declared length',
      { contentLength: '4097' },
      { tenantId: 'tenant-pilot-001', campusId: 'campus-main', reason: 'ok' },
    ],
    ['invalid JSON', {}, '{not-json'],
    ['array JSON', {}, []],
  ] as const)('rejects %s command bodies', async (_label, overrides, body) => {
    const token = await financeToken();
    const response = await requiredResponse(
      commandRequest(token, `invalid-${crypto.randomUUID()}`, body, overrides),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'pilot_command_invalid' },
    });
  });

  it('rejects oversized encoded bodies and invalid idempotency keys or reasons', async () => {
    const token = await financeToken();
    const huge = await requiredResponse(
      commandRequest(token, `huge-${crypto.randomUUID()}`, {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        reason: 'x'.repeat(5000),
      }),
    );
    expect(huge.status).toBe(400);

    for (const [key, reason] of [
      ['short', 'valid'],
      [`spaces ${crypto.randomUUID()}`, 'valid'],
      [`valid-${crypto.randomUUID()}`, ' leading'],
      [`valid-${crypto.randomUUID()}`, 'trailing '],
      [`valid-${crypto.randomUUID()}`, 'x'.repeat(501)],
    ] as const) {
      const response = await requiredResponse(
        commandRequest(token, key, {
          tenantId: 'tenant-pilot-001',
          campusId: 'campus-main',
          reason,
        }),
      );
      expect(response.status).toBe(400);
    }
  });

  it('rejects tenant and campus scope expansion', async () => {
    const token = await financeToken();
    for (const body of [
      { tenantId: 'tenant-other', campusId: 'campus-main', reason: 'scope test' },
      { tenantId: 'tenant-pilot-001', campusId: 'campus-other', reason: 'scope test' },
    ]) {
      const response = await requiredResponse(
        commandRequest(token, `scope-${crypto.randomUUID()}`, body),
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'pilot_scope_denied' },
      });
    }
  });

  it('accepts exact commands, replays idempotently and records audit evidence', async () => {
    const token = await financeToken();
    const idempotencyKey = `accepted-${crypto.randomUUID()}`;
    const body = {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      reason: 'Record reviewed reconciliation evidence.',
    } as const;

    const accepted = await requiredResponse(commandRequest(token, idempotencyKey, body));
    expect(accepted.status).toBe(202);
    const acceptedBody = (await accepted.json()) as {
      readonly receipt: { readonly auditId: string; readonly correlationId: string };
    };
    expect(acceptedBody.receipt.auditId).toBeTruthy();
    expect(acceptedBody.receipt.correlationId).toBeTruthy();

    const replay = await requiredResponse(commandRequest(token, idempotencyKey, body));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({
      schemaVersion: 1,
      replayed: true,
      receipt: { auditId: acceptedBody.receipt.auditId },
    });

    const audit = await requiredResponse(
      authorizedRequest('/pilot/v1/audit/finance', 'GET', token),
    );
    const auditBody = (await audit.json()) as {
      readonly entries: readonly { readonly auditId: string }[];
    };
    expect(auditBody.entries.some((entry) => entry.auditId === acceptedBody.receipt.auditId)).toBe(
      true,
    );
  });

  it('rejects a changed request replayed under the same idempotency key', async () => {
    const token = await financeToken();
    const idempotencyKey = `binding-${crypto.randomUUID()}`;
    const base = {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
    } as const;

    const accepted = await requiredResponse(
      commandRequest(token, idempotencyKey, {
        ...base,
        reason: 'Record the first reviewed reconciliation evidence.',
      }),
    );
    expect(accepted.status).toBe(202);

    const conflict = await requiredResponse(
      commandRequest(token, idempotencyKey, {
        ...base,
        reason: 'Record a different reconciliation decision.',
      }),
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: 'pilot_idempotency_conflict' },
    });
  });
});
