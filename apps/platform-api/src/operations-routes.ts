import { Hono } from 'hono';

export interface OperationsPrincipal {
  readonly principalId: string;
  readonly tenantId: string;
  readonly campusIds: readonly string[];
  readonly permissions: readonly string[];
  readonly assurance: 'aal1' | 'aal2';
}

export const operationsReportNames = [
  'hr-attendance',
  'procurement',
  'inventory',
  'assets',
  'library',
  'transport',
  'hostel',
  'cafeteria',
  'trip',
] as const;

export type OperationsReportName = (typeof operationsReportNames)[number];

export const operationsCommandNames = [
  'hr.register-staff',
  'hr.request-leave',
  'hr.record-attendance',
  'procurement.create-requisition',
  'procurement.approve-requisition',
  'procurement.issue-purchase-order',
  'procurement.record-receipt',
  'procurement.register-invoice',
  'procurement.approve-payable',
  'inventory.record-movement',
  'inventory.reserve',
  'inventory.record-count',
  'assets.register',
  'assets.assign',
  'assets.request-disposal',
  'library.checkout',
  'library.return',
  'library.place-hold',
  'transport.start-trip',
  'transport.record-rider-event',
  'hostel.allocate-bed',
  'hostel.checkout-resident',
  'cafeteria.place-order',
  'cafeteria.confirm-service',
  'activities.enrol',
  'activities.register-trip-participant',
  'activities.record-consent',
  'activities.approve-trip',
] as const;

export type OperationsCommandName = (typeof operationsCommandNames)[number];

export interface OperationsRequestContext {
  readonly principal: OperationsPrincipal;
  readonly correlationId: string;
  readonly idempotencyKey: string | null;
}

export interface OperationsSummaryInput {
  readonly asOf: string;
  readonly principal: OperationsPrincipal;
}

export interface OperationsReportInput extends OperationsSummaryInput {
  readonly report: OperationsReportName;
  readonly resourceId: string | null;
}

export interface OperationsCommandInput extends OperationsRequestContext {
  readonly command: OperationsCommandName;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface OperationsApiDependencies {
  readonly getSummary: (input: OperationsSummaryInput) => Promise<unknown>;
  readonly getReport: (input: OperationsReportInput) => Promise<unknown>;
  readonly executeCommand: (input: OperationsCommandInput) => Promise<unknown>;
}

export interface OperationsApiEnvelope<T> {
  readonly data: T;
  readonly meta: {
    readonly correlationId: string;
    readonly generatedAt: string;
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function parseCsv(value: string | undefined): readonly string[] {
  return Object.freeze(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function readPrincipal(headers: Headers): OperationsPrincipal {
  const tenantId = headers.get('x-tenant-id')?.trim() ?? '';
  const principalId = headers.get('x-principal-id')?.trim() ?? '';
  const campusIds = parseCsv(headers.get('x-campus-ids') ?? undefined);
  const permissions = parseCsv(headers.get('x-permissions') ?? undefined);
  const assurance = headers.get('x-assurance') === 'aal2' ? 'aal2' : 'aal1';
  if (tenantId.length === 0 || principalId.length === 0 || campusIds.length === 0) {
    throw new Error('OPS_API_AUTH_REQUIRED');
  }
  return Object.freeze({ principalId, tenantId, campusIds, permissions, assurance });
}

function statusForError(error: Error): number {
  if (error.message === 'OPS_API_AUTH_REQUIRED') return 401;
  if (error.message === 'OPS_STEP_UP_REQUIRED') return 403;
  if (error.message.startsWith('OPS_PERMISSION_DENIED') || error.message === 'OPS_SCOPE_MISMATCH') {
    return 403;
  }
  if (error.message.startsWith('OPS_NOT_FOUND')) return 404;
  if (
    error.message.startsWith('OPS_INVALID') ||
    error.message.startsWith('OPS_API_INVALID') ||
    error.message.includes('_REQUIRED')
  ) {
    return 400;
  }
  return 409;
}

function envelope<T>(data: T, correlationId: string): OperationsApiEnvelope<T> {
  return Object.freeze({
    data,
    meta: Object.freeze({ correlationId, generatedAt: new Date().toISOString() }),
  });
}

async function readJsonPayload(request: Request): Promise<Readonly<Record<string, unknown>>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new Error('OPS_API_INVALID_JSON');
  }
  if (!isRecord(payload)) throw new Error('OPS_API_INVALID_PAYLOAD');
  return payload;
}

export function createOperationsApi(dependencies: OperationsApiDependencies): Hono {
  const app = new Hono();

  app.onError((error, context) =>
    context.json(
      {
        error: {
          code: error.message.split(':')[0],
          message: error.message,
        },
      },
      statusForError(error) as 400,
    ),
  );

  app.get('/operations/summary', async (context) => {
    const principal = readPrincipal(context.req.raw.headers);
    const asOf = context.req.query('asOf') ?? new Date().toISOString().slice(0, 10);
    if (!isDate(asOf)) throw new Error('OPS_API_INVALID_AS_OF');
    const correlationId = context.req.header('x-correlation-id')?.trim() || crypto.randomUUID();
    const data = await dependencies.getSummary({ asOf, principal });
    return context.json(envelope(data, correlationId));
  });

  app.get('/operations/reports/:report', async (context) => {
    const principal = readPrincipal(context.req.raw.headers);
    const reportValue = context.req.param('report');
    if (!operationsReportNames.includes(reportValue as OperationsReportName)) {
      throw new Error('OPS_API_INVALID_REPORT');
    }
    const asOf = context.req.query('asOf') ?? new Date().toISOString().slice(0, 10);
    if (!isDate(asOf)) throw new Error('OPS_API_INVALID_AS_OF');
    const correlationId = context.req.header('x-correlation-id')?.trim() || crypto.randomUUID();
    const resourceId = context.req.query('resourceId')?.trim() || null;
    if (reportValue === 'trip' && resourceId === null) {
      throw new Error('OPS_API_TRIP_RESOURCE_REQUIRED');
    }
    const data = await dependencies.getReport({
      report: reportValue as OperationsReportName,
      asOf,
      principal,
      resourceId,
    });
    return context.json(envelope(data, correlationId));
  });

  app.post('/operations/commands/:command', async (context) => {
    const principal = readPrincipal(context.req.raw.headers);
    const commandValue = context.req.param('command');
    if (!operationsCommandNames.includes(commandValue as OperationsCommandName)) {
      throw new Error('OPS_API_INVALID_COMMAND');
    }
    const contentType = context.req.header('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('OPS_API_JSON_REQUIRED');
    }
    const payload = await readJsonPayload(context.req.raw);
    const correlationId = context.req.header('x-correlation-id')?.trim() || crypto.randomUUID();
    const idempotencyKey = context.req.header('idempotency-key')?.trim() || null;
    const data = await dependencies.executeCommand({
      command: commandValue as OperationsCommandName,
      payload,
      principal,
      correlationId,
      idempotencyKey,
    });
    return context.json(envelope(data, correlationId), 202);
  });

  return app;
}
