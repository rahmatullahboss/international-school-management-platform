import { describe, expect, it } from 'vitest';

import {
  createOperationsApi,
  type OperationsApiDependencies,
  type OperationsCommandInput,
  type OperationsReportInput,
  type OperationsSummaryInput,
} from '../../apps/platform-api/src/operations-routes.js';

const authHeaders = {
  'x-tenant-id': 'tenant-ops',
  'x-principal-id': 'ops-manager',
  'x-campus-ids': 'campus-main',
  'x-permissions': 'operations.*',
  'x-assurance': 'aal2',
};

interface DependencyHarness {
  readonly api: OperationsApiDependencies;
  readonly summaryInputs: OperationsSummaryInput[];
  readonly reportInputs: OperationsReportInput[];
  readonly commandInputs: OperationsCommandInput[];
}

function dependencies(): DependencyHarness {
  const summaryInputs: OperationsSummaryInput[] = [];
  const reportInputs: OperationsReportInput[] = [];
  const commandInputs: OperationsCommandInput[] = [];
  return {
    api: {
      getSummary: (input) => {
        summaryInputs.push(input);
        return Promise.resolve({ asOf: input.asOf, exceptions: 3 });
      },
      getReport: (input) => {
        reportInputs.push(input);
        return Promise.resolve({ report: input.report, resourceId: input.resourceId });
      },
      executeCommand: (input) => {
        commandInputs.push(input);
        return Promise.resolve({ command: input.command, accepted: true });
      },
    },
    summaryInputs,
    reportInputs,
    commandInputs,
  };
}

async function responseBody(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  return value;
}

describe('OPS HTTP API', () => {
  it('requires tenant, principal and campus authentication context', async () => {
    const response = await createOperationsApi(dependencies().api).request('/operations/summary');
    expect(response.status).toBe(401);
    expect(await responseBody(response)).toMatchObject({
      error: { code: 'OPS_API_AUTH_REQUIRED' },
    });
  });

  it('returns a correlated operations summary', async () => {
    const harness = dependencies();
    const response = await createOperationsApi(harness.api).request(
      '/operations/summary?asOf=2026-07-29',
      {
        headers: { ...authHeaders, 'x-correlation-id': 'corr-summary' },
      },
    );
    expect(response.status).toBe(200);
    expect(await responseBody(response)).toMatchObject({
      data: { asOf: '2026-07-29', exceptions: 3 },
      meta: { correlationId: 'corr-summary' },
    });
    expect(harness.summaryInputs).toHaveLength(1);
    expect(harness.summaryInputs[0]).toMatchObject({
      asOf: '2026-07-29',
      principal: { assurance: 'aal2', tenantId: 'tenant-ops' },
    });
  });

  it('validates report names and requires a trip resource id', async () => {
    const harness = dependencies();
    const app = createOperationsApi(harness.api);
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
    expect(await responseBody(valid)).toMatchObject({
      data: { report: 'trip', resourceId: 'trip-1' },
    });
    expect(harness.reportInputs).toHaveLength(1);
    expect(harness.reportInputs[0]).toMatchObject({ report: 'trip', resourceId: 'trip-1' });
  });

  it('dispatches a typed command with correlation and idempotency context', async () => {
    const harness = dependencies();
    const response = await createOperationsApi(harness.api).request(
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
    expect(await responseBody(response)).toMatchObject({
      data: { command: 'inventory.record-movement', accepted: true },
      meta: { correlationId: 'corr-command' },
    });
    expect(harness.commandInputs).toHaveLength(1);
    expect(harness.commandInputs[0]).toMatchObject({
      command: 'inventory.record-movement',
      idempotencyKey: 'movement-1',
      payload: { itemId: 'item-1', quantity: 5 },
    });
  });

  it('rejects malformed JSON with a stable client error', async () => {
    const response = await createOperationsApi(dependencies().api).request(
      '/operations/commands/hr.register-staff',
      {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: '{invalid',
      },
    );
    expect(response.status).toBe(400);
    expect(await responseBody(response)).toMatchObject({
      error: { code: 'OPS_API_INVALID_JSON' },
    });
  });

  it('maps domain permission errors without leaking stack traces', async () => {
    const harness = dependencies();
    const api: OperationsApiDependencies = {
      ...harness.api,
      getSummary: () =>
        Promise.reject(new Error('OPS_PERMISSION_DENIED:operations.hr.report.read')),
    };
    const response = await createOperationsApi(api).request('/operations/summary?asOf=2026-07-29', {
      headers: authHeaders,
    });
    expect(response.status).toBe(403);
    const body = await responseBody(response);
    expect(body).toMatchObject({ error: { code: 'OPS_PERMISSION_DENIED' } });
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});
