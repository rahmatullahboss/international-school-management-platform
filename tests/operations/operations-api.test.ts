import { describe, expect, it, vi } from 'vitest';

import {
  createOperationsApi,
  type OperationsApiDependencies,
} from '../../apps/platform-api/src/operations-routes.js';

const authHeaders = {
  'x-tenant-id': 'tenant-ops',
  'x-principal-id': 'ops-manager',
  'x-campus-ids': 'campus-main',
  'x-permissions': 'operations.*',
  'x-assurance': 'aal2',
};

function dependencies(): OperationsApiDependencies {
  return {
    getSummary: vi.fn((input) => ({ asOf: input.asOf, exceptions: 3 })),
    getReport: vi.fn((input) => ({ report: input.report, resourceId: input.resourceId })),
    executeCommand: vi.fn((input) => ({ command: input.command, accepted: true })),
  };
}

describe('OPS HTTP API', () => {
  it('requires tenant, principal and campus authentication context', async () => {
    const response = await createOperationsApi(dependencies()).request('/operations/summary');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'OPS_API_AUTH_REQUIRED' } });
  });

  it('returns a correlated operations summary', async () => {
    const deps = dependencies();
    const response = await createOperationsApi(deps).request(
      '/operations/summary?asOf=2026-07-29',
      {
        headers: { ...authHeaders, 'x-correlation-id': 'corr-summary' },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { asOf: '2026-07-29', exceptions: 3 },
      meta: { correlationId: 'corr-summary' },
    });
    expect(deps.getSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        asOf: '2026-07-29',
        principal: expect.objectContaining({ assurance: 'aal2', tenantId: 'tenant-ops' }),
      }),
    );
  });

  it('validates report names and requires a trip resource id', async () => {
    const app = createOperationsApi(dependencies());
    const invalid = await app.request('/operations/reports/unknown?asOf=2026-07-29', {
      headers: authHeaders,
    });
    expect(invalid.status).toBe(400);
    const trip = await app.request('/operations/reports/trip?asOf=2026-07-29', {
      headers: authHeaders,
    });
    expect(trip.status).toBe(400);
    const valid = await app.request('/operations/reports/trip?asOf=2026-07-29&resourceId=trip-1', {
      headers: authHeaders,
    });
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({
      data: { report: 'trip', resourceId: 'trip-1' },
    });
  });

  it('dispatches a typed command with correlation and idempotency context', async () => {
    const deps = dependencies();
    const response = await createOperationsApi(deps).request(
      '/operations/commands/inventory.record-movement',
      {
        method: 'POST',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
          'x-correlation-id': 'corr-command',
          'idempotency-key': 'movement-1',
        },
        body: JSON.stringify({ itemId: 'item-1', quantity: 5 }),
      },
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      data: { command: 'inventory.record-movement', accepted: true },
      meta: { correlationId: 'corr-command' },
    });
    expect(deps.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'inventory.record-movement',
        idempotencyKey: 'movement-1',
        payload: { itemId: 'item-1', quantity: 5 },
      }),
    );
  });

  it('rejects malformed JSON with a stable client error', async () => {
    const response = await createOperationsApi(dependencies()).request(
      '/operations/commands/hr.register-staff',
      {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: '{invalid',
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'OPS_API_INVALID_JSON' } });
  });

  it('maps domain permission errors without leaking stack traces', async () => {
    const deps = dependencies();
    deps.getSummary = vi.fn(() => {
      throw new Error('OPS_PERMISSION_DENIED:operations.hr.report.read');
    });
    const response = await createOperationsApi(deps).request(
      '/operations/summary?asOf=2026-07-29',
      {
        headers: authHeaders,
      },
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: 'OPS_PERMISSION_DENIED' } });
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});
