import { describe, expect, it } from 'vitest';

import { handlePilotOperatorRequest } from './pilot-operator-api.js';
import { issuePilotOperatorSession } from './pilot-operator-sessions.js';
import type { PilotOperatorRole } from './pilot-operator-models.js';

const secret = 'pilot-operator-api-coverage-secret-0123456789abcdef';
const environment = { APP_ENV: 'staging', PILOT_SESSION_SECRET: secret } as const;
const origin = 'http://127.0.0.1:4173';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonObject(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new Error('expected JSON object');
  return value;
}

async function requiredResponse(
  request: Request,
  bindings: { readonly APP_ENV: string; readonly PILOT_SESSION_SECRET?: string } = environment,
): Promise<Response> {
  const response = await handlePilotOperatorRequest(request, bindings);
  if (response === undefined) throw new Error('expected operator response');
  return response;
}

async function tokenFor(role: PilotOperatorRole): Promise<string> {
  const issuance = await issuePilotOperatorSession(secret, role);
  if (!issuance.ok) throw new Error(`expected ${role} session`);
  return issuance.token;
}

function requestFor(
  path: string,
  method: 'GET' | 'POST' | 'OPTIONS',
  options: {
    readonly token?: string;
    readonly body?: unknown;
    readonly headers?: Readonly<Record<string, string>>;
    readonly requestOrigin?: string;
  } = {},
): Request {
  const headers = new Headers({
    origin: options.requestOrigin ?? origin,
    ...options.headers,
  });
  if (options.token !== undefined) headers.set('authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`https://api.school.test${path}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

function financeCommandRequest(
  token: string,
  idempotencyKey: string,
  body: unknown,
  contentType = 'application/json',
): Request {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(
    'https://api.school.test/pilot/v1/commands/finance/cash-session.reconcile.record',
    {
      method: 'POST',
      headers: {
        origin,
        authorization: `Bearer ${token}`,
        'content-type': contentType,
        'idempotency-key': idempotencyKey,
      },
      body: rawBody,
    },
  );
}

describe('pilot operator API coverage boundary', () => {
  it('leaves unrelated and unpublished-role routes to the core worker', async () => {
    await expect(
      handlePilotOperatorRequest(new Request('https://api.school.test/health'), environment),
    ).resolves.toBeUndefined();
    await expect(
      handlePilotOperatorRequest(
        requestFor('/pilot/v1/sessions/admin', 'POST'),
        environment,
      ),
    ).resolves.toBeUndefined();
  });

  it('fails closed in production and for untrusted origins', async () => {
    const production = await requiredResponse(requestFor('/pilot/v1/sessions/finance', 'POST'), {
      APP_ENV: 'production',
      PILOT_SESSION_SECRET: secret,
    });
    expect(production.status).toBe(404);
    expect(await jsonObject(production)).toMatchObject({ error: { code: 'not_found' } });

    const denied = await requiredResponse(
      requestFor('/pilot/v1/sessions/finance', 'POST', {
        requestOrigin: 'https://untrusted.example',
      }),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('vary')).toBe('Origin');
    expect(await jsonObject(denied)).toMatchObject({ error: { code: 'pilot_origin_denied' } });
  });

  it('answers trusted preflight with explicit CORS contract', async () => {
    const response = await requiredResponse(requestFor('/pilot/v1/sessions/finance', 'OPTIONS'));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('idempotency-key');
  });
});

describe('pilot operator session and snapshot HTTP contract', () => {
  it('enforces session method and secret availability', async () => {
    const methodDenied = await requiredResponse(requestFor('/pilot/v1/sessions/finance', 'GET'));
    expect(methodDenied.status).toBe(405);

    const unavailable = await requiredResponse(requestFor('/pilot/v1/sessions/finance', 'POST'), {
      APP_ENV: 'staging',
    });
    expect(unavailable.status).toBe(503);
    expect(await jsonObject(unavailable)).toMatchObject({
      error: { code: 'pilot_session_unavailable' },
    });
  });

  it.each(['admissions', 'finance', 'support'] as const)('issues %s session envelopes', async (role) => {
    const response = await requiredResponse(requestFor(`/pilot/v1/sessions/${role}`, 'POST'));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await jsonObject(response)).toMatchObject({
      schemaVersion: 1,
      tokenType: 'Bearer',
      scope: { role },
    });
  });

  it('protects snapshots and supports ETag revalidation', async () => {
    const token = await tokenFor('finance');
    const wrongMethod = await requiredResponse(
      requestFor('/pilot/v1/snapshots/finance', 'POST', { token }),
    );
    expect(wrongMethod.status).toBe(405);

    const unauthenticated = await requiredResponse(requestFor('/pilot/v1/snapshots/finance', 'GET'));
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get('cache-control')).toBe('no-store');

    const first = await requiredResponse(
      requestFor('/pilot/v1/snapshots/finance', 'GET', { token }),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate');
    const etag = first.headers.get('etag');
    expect(etag).not.toBeNull();
    expect(await jsonObject(first)).toMatchObject({ scope: { role: 'finance' } });

    const cached = await requiredResponse(
      requestFor('/pilot/v1/snapshots/finance', 'GET', {
        token,
        headers: { 'if-none-match': etag ?? '' },
      }),
    );
    expect(cached.status).toBe(304);
  });
});

describe('pilot operator authorization and audit HTTP contract', () => {
  it('validates permission requests and returns allow/deny decisions', async () => {
    const token = await tokenFor('finance');
    const wrongMethod = await requiredResponse(
      requestFor('/pilot/v1/authorize/finance', 'GET', { token }),
    );
    expect(wrongMethod.status).toBe(405);

    const unauthenticated = await requiredResponse(
      requestFor('/pilot/v1/authorize/finance', 'POST', {
        body: { permission: 'finance.invoice.read' },
      }),
    );
    expect(unauthenticated.status).toBe(401);

    for (const body of [{}, { permission: '' }, { permission: 'x'.repeat(129) }]) {
      const invalid = await requiredResponse(
        requestFor('/pilot/v1/authorize/finance', 'POST', { token, body }),
      );
      expect(invalid.status).toBe(400);
      expect(await jsonObject(invalid)).toMatchObject({
        error: { code: 'pilot_permission_request_invalid' },
      });
    }

    const allowed = await requiredResponse(
      requestFor('/pilot/v1/authorize/finance', 'POST', {
        token,
        body: { permission: 'finance.reconciliation.write' },
      }),
    );
    expect(await jsonObject(allowed)).toMatchObject({
      decision: { allowed: true, reason: 'role-grant' },
    });

    const denied = await requiredResponse(
      requestFor('/pilot/v1/authorize/finance', 'POST', {
        token,
        body: { permission: 'finance.refund.approve' },
      }),
    );
    expect(await jsonObject(denied)).toMatchObject({
      decision: { allowed: false, reason: 'permission-not-granted' },
    });
  });

  it('protects and returns role-scoped audit data', async () => {
    const token = await tokenFor('finance');
    const wrongMethod = await requiredResponse(
      requestFor('/pilot/v1/audit/finance', 'POST', { token }),
    );
    expect(wrongMethod.status).toBe(405);

    const unauthenticated = await requiredResponse(requestFor('/pilot/v1/audit/finance', 'GET'));
    expect(unauthenticated.status).toBe(401);

    const response = await requiredResponse(
      requestFor('/pilot/v1/audit/finance', 'GET', { token }),
    );
    expect(response.status).toBe(200);
    const payload = await jsonObject(response);
    expect(payload).toMatchObject({
      schemaVersion: 1,
      scope: { role: 'finance', tenantId: 'tenant-pilot-001', campusId: 'campus-main' },
    });
    expect(Array.isArray(payload.entries)).toBe(true);
  });
});

describe('pilot operator command HTTP contract coverage', () => {
  it('enforces method, published command and authentication', async () => {
    const token = await tokenFor('finance');
    const wrongMethod = await requiredResponse(
      requestFor('/pilot/v1/commands/finance/cash-session.reconcile.record', 'GET', { token }),
    );
    expect(wrongMethod.status).toBe(405);

    const unknown = await requiredResponse(
      requestFor('/pilot/v1/commands/finance/not-a-command', 'POST', { token }),
    );
    expect(unknown.status).toBe(404);
    expect(await jsonObject(unknown)).toMatchObject({ error: { code: 'pilot_command_not_found' } });

    const unauthenticated = await requiredResponse(
      requestFor('/pilot/v1/commands/finance/cash-session.reconcile.record', 'POST'),
    );
    expect(unauthenticated.status).toBe(401);
  });

  it('rejects malformed content and oversized bodies', async () => {
    const token = await tokenFor('finance');
    const invalidContentType = await requiredResponse(
      financeCommandRequest(
        token,
        `content-${crypto.randomUUID()}`,
        { tenantId: 'tenant-pilot-001', campusId: 'campus-main', reason: 'review' },
        'text/plain',
      ),
    );
    expect(invalidContentType.status).toBe(400);

    const invalidJson = await requiredResponse(
      financeCommandRequest(token, `json-${crypto.randomUUID()}`, '{not-json'),
    );
    expect(invalidJson.status).toBe(400);

    const arrayBody = await requiredResponse(
      financeCommandRequest(token, `array-${crypto.randomUUID()}`, []),
    );
    expect(arrayBody.status).toBe(400);

    const oversized = await requiredResponse(
      financeCommandRequest(token, `large-${crypto.randomUUID()}`, {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        reason: 'x'.repeat(5000),
      }),
    );
    expect(oversized.status).toBe(400);
  });

  it('rejects invalid idempotency, reason and scope inputs', async () => {
    const token = await tokenFor('finance');
    for (const [key, reason] of [
      ['short', 'valid'],
      [`spaces ${crypto.randomUUID()}`, 'valid'],
      [`valid-${crypto.randomUUID()}`, ' leading'],
      [`valid-${crypto.randomUUID()}`, 'trailing '],
      [`valid-${crypto.randomUUID()}`, 'x'.repeat(501)],
    ] as const) {
      const response = await requiredResponse(
        financeCommandRequest(token, key, {
          tenantId: 'tenant-pilot-001',
          campusId: 'campus-main',
          reason,
        }),
      );
      expect(response.status).toBe(400);
    }

    for (const body of [
      { tenantId: 'tenant-other', campusId: 'campus-main', reason: 'scope' },
      { tenantId: 'tenant-pilot-001', campusId: 'campus-other', reason: 'scope' },
    ]) {
      const response = await requiredResponse(
        financeCommandRequest(token, `scope-${crypto.randomUUID()}`, body),
      );
      expect(response.status).toBe(403);
      expect(await jsonObject(response)).toMatchObject({ error: { code: 'pilot_scope_denied' } });
    }
  });

  it('accepts exact commands, replays them and exposes matching audit evidence', async () => {
    const token = await tokenFor('finance');
    const idempotencyKey = `accepted-${crypto.randomUUID()}`;
    const body = {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      reason: 'Record reviewed reconciliation evidence.',
    } as const;

    const accepted = await requiredResponse(financeCommandRequest(token, idempotencyKey, body));
    expect(accepted.status).toBe(202);
    const acceptedPayload = await jsonObject(accepted);
    const receipt = acceptedPayload.receipt;
    if (!isRecord(receipt) || typeof receipt.auditId !== 'string') {
      throw new Error('expected accepted audit receipt');
    }

    const replay = await requiredResponse(financeCommandRequest(token, idempotencyKey, body));
    expect(replay.status).toBe(200);
    expect(await jsonObject(replay)).toMatchObject({
      schemaVersion: 1,
      replayed: true,
      receipt: { auditId: receipt.auditId },
    });

    const audit = await requiredResponse(
      requestFor('/pilot/v1/audit/finance', 'GET', { token }),
    );
    const auditPayload = await jsonObject(audit);
    if (!Array.isArray(auditPayload.entries)) throw new Error('expected audit entries');
    expect(
      auditPayload.entries.some(
        (entry) => isRecord(entry) && entry.auditId === receipt.auditId,
      ),
    ).toBe(true);
  });
});
