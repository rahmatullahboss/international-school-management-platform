import { describe, expect, it } from 'vitest';

import { handlePilotOperatorRequest } from './pilot-operator-api.js';
import { issuePilotOperatorSession } from './pilot-operator-sessions.js';

const secret = 'pilot-operator-api-test-secret-0123456789abcdef';
const environment = { APP_ENV: 'staging', PILOT_SESSION_SECRET: secret } as const;
const origin = 'http://127.0.0.1:4173';

async function financeToken(): Promise<string> {
  const issuance = await issuePilotOperatorSession(secret, 'finance');
  if (!issuance.ok) throw new Error('expected finance pilot session');
  return issuance.token;
}

function commandRequest(token: string, idempotencyKey: string, body: Record<string, unknown>) {
  return new Request(
    'https://api.school.test/pilot/v1/commands/finance/cash-session.reconcile.record',
    {
      method: 'POST',
      headers: {
        origin,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
    },
  );
}

async function requiredResponse(request: Request): Promise<Response> {
  const response = await handlePilotOperatorRequest(request, environment);
  if (response === undefined) throw new Error('expected operator route response');
  return response;
}

describe('pilot operator command request integrity', () => {
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
