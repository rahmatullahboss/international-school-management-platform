import { createHttpDatabase } from '@school/database';

import {
  resolveAuthenticatedBrowserSessionContext,
  type AuthBindings,
  type AuthenticatedBrowserSessionContextResult,
} from './auth-boundary.js';
import { DurableAuthStore } from './auth-durable-store.js';
import { isAllowedAuthMutationOrigin } from './auth-logout.js';
import { DatabaseOperatorDomainCommandStore } from './database-operator-domain-command-store.js';
import { DatabaseWorkspaceStore, type DatabaseWorkspaceRole } from './database-workspace-store.js';
import {
  submitOperatorDomainCommand,
  type OperatorDomainCommandInput,
  type OperatorDomainCommandResolution,
} from './operator-domain-commands.js';

export interface ProductionOperatorCommandBindings extends AuthBindings {
  readonly APP_ENV: string;
  readonly DATABASE_URL?: string;
}

type BrowserOperatorCommandBody =
  | {
      readonly command: 'admissions.application.review.record';
      readonly applicationId: string;
      readonly expectedVersion: number;
      readonly recommendation: 'admit' | 'waitlist' | 'decline' | 'more-information';
      readonly score: number | null;
      readonly notes: string | null;
    }
  | {
      readonly command: 'finance.bank-line.reconcile';
      readonly bankStatementLineId: string;
      readonly paymentId: string;
      readonly reason: string;
    }
  | {
      readonly command: 'support.break-glass.request';
      readonly reason: string;
      readonly requestedMinutes: number;
    };

interface ProductionOperatorCommandDependencies {
  readonly resolveSession: (
    environment: ProductionOperatorCommandBindings,
    cookieHeader: string | undefined,
  ) => Promise<AuthenticatedBrowserSessionContextResult>;
  readonly resolveWorkspaceRole: (
    databaseUrl: string,
    sessionId: string,
  ) => Promise<DatabaseWorkspaceRole | undefined>;
  readonly submit: (
    databaseUrl: string,
    input: OperatorDomainCommandInput,
  ) => Promise<OperatorDomainCommandResolution>;
  readonly randomUuid: () => string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const ADMISSIONS_RECOMMENDATIONS = new Set(['admit', 'waitlist', 'decline', 'more-information']);
const MAX_BODY_BYTES = 4096;

function jsonResponse(body: unknown, status: number, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function errorResponse(code: string, message: string, status: number, extra?: object): Response {
  return jsonResponse({ error: { code, message }, ...extra }, status);
}

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
}

function strongSecret(value: string | undefined): boolean {
  return value !== undefined && value.length >= 32;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function validBoundedText(value: unknown, minimum: number, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.trim() === value
  );
}

function parseBrowserBody(value: unknown): BrowserOperatorCommandBody | undefined {
  if (!isRecord(value) || typeof value.command !== 'string') return undefined;

  if (value.command === 'admissions.application.review.record') {
    if (
      !hasExactKeys(value, [
        'command',
        'applicationId',
        'expectedVersion',
        'recommendation',
        'score',
        'notes',
      ]) ||
      typeof value.applicationId !== 'string' ||
      !UUID_PATTERN.test(value.applicationId) ||
      typeof value.expectedVersion !== 'number' ||
      !Number.isSafeInteger(value.expectedVersion) ||
      value.expectedVersion < 1 ||
      typeof value.recommendation !== 'string' ||
      !ADMISSIONS_RECOMMENDATIONS.has(value.recommendation) ||
      !(
        value.score === null ||
        (typeof value.score === 'number' &&
          Number.isFinite(value.score) &&
          value.score >= 0 &&
          value.score <= 100)
      ) ||
      !(value.notes === null || validBoundedText(value.notes, 1, 2000))
    ) {
      return undefined;
    }
    return value as unknown as BrowserOperatorCommandBody;
  }

  if (value.command === 'finance.bank-line.reconcile') {
    if (
      !hasExactKeys(value, ['command', 'bankStatementLineId', 'paymentId', 'reason']) ||
      typeof value.bankStatementLineId !== 'string' ||
      !UUID_PATTERN.test(value.bankStatementLineId) ||
      typeof value.paymentId !== 'string' ||
      !UUID_PATTERN.test(value.paymentId) ||
      !validBoundedText(value.reason, 8, 500)
    ) {
      return undefined;
    }
    return value as unknown as BrowserOperatorCommandBody;
  }

  if (value.command === 'support.break-glass.request') {
    if (
      !hasExactKeys(value, ['command', 'reason', 'requestedMinutes']) ||
      !validBoundedText(value.reason, 8, 500) ||
      typeof value.requestedMinutes !== 'number' ||
      !Number.isSafeInteger(value.requestedMinutes) ||
      value.requestedMinutes < 5 ||
      value.requestedMinutes > 30
    ) {
      return undefined;
    }
    return value as unknown as BrowserOperatorCommandBody;
  }

  return undefined;
}

async function readJsonBody(request: Request): Promise<unknown | undefined> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!/^application\/json(?:\s*;.*)?$/u.test(contentType)) return undefined;
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(declaredLength)) return undefined;
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length > MAX_BODY_BYTES) return undefined;
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return undefined;
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function roleForCommand(command: BrowserOperatorCommandBody['command']): DatabaseWorkspaceRole {
  if (command === 'admissions.application.review.record') return 'admissions';
  if (command === 'finance.bank-line.reconcile') return 'finance';
  return 'support';
}

function configured(environment: ProductionOperatorCommandBindings): string | undefined {
  const databaseUrl = configuredValue(environment.DATABASE_URL);
  if (
    environment.APP_ENV !== 'production' ||
    databaseUrl === undefined ||
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    environment.AUTH_PERMISSION_SOURCE !== 'database' ||
    environment.RUNTIME_MUTATION_SOURCE !== 'database' ||
    !strongSecret(configuredValue(environment.AUTH_SESSION_SECRET))
  ) {
    return undefined;
  }
  return databaseUrl;
}

function resolutionResponse(resolution: OperatorDomainCommandResolution): Response {
  if (resolution.accepted) {
    return jsonResponse(
      {
        schemaVersion: 1,
        replayed: resolution.replayed,
        receipt: resolution.receipt,
      },
      resolution.replayed ? 200 : 202,
    );
  }

  const extra =
    resolution.reason === 'step-up-required'
      ? { requiredAssurance: resolution.requiredAssurance }
      : resolution.reason === 'revision-conflict'
        ? { currentVersion: resolution.currentVersion }
        : undefined;

  switch (resolution.reason) {
    case 'invalid-command':
      return errorResponse('operator_command_invalid', 'The command request is invalid.', 400);
    case 'session-inactive':
      return errorResponse('browser_session_revoked', 'The browser session is no longer active.', 401);
    case 'permission-not-granted':
      return errorResponse('operator_permission_denied', 'The requested action is not permitted.', 403);
    case 'step-up-required':
      return errorResponse(
        'operator_step_up_required',
        'Fresh AAL2 authentication is required.',
        403,
        extra,
      );
    case 'scope-not-found':
      return errorResponse('operator_scope_not_found', 'The requested scoped record was not found.', 404);
    case 'idempotency-conflict':
      return errorResponse(
        'operator_idempotency_conflict',
        'The idempotency key is already bound to a different request.',
        409,
      );
    case 'revision-conflict':
      return errorResponse(
        'operator_revision_conflict',
        'The record changed before this command was applied.',
        409,
        extra,
      );
    case 'domain-conflict':
      return errorResponse(
        'operator_domain_conflict',
        'The record is not in a state that permits this command.',
        409,
      );
    case 'command-disabled':
    case 'command-unavailable':
      return errorResponse('operator_command_unavailable', 'The command service is unavailable.', 503);
  }
}

const defaultDependencies: ProductionOperatorCommandDependencies = {
  async resolveSession(environment, cookieHeader) {
    const databaseUrl = configuredValue(environment.DATABASE_URL);
    if (databaseUrl === undefined) {
      return {
        ok: false,
        status: 503,
        code: 'session_registry_unavailable',
        message: 'The browser session registry is unavailable.',
      };
    }
    const store = new DurableAuthStore(createHttpDatabase(databaseUrl));
    return resolveAuthenticatedBrowserSessionContext(
      environment,
      cookieHeader,
      (sessionId) => store.isSessionActive(sessionId),
    );
  },
  async resolveWorkspaceRole(databaseUrl, sessionId) {
    const workspace = await new DatabaseWorkspaceStore(createHttpDatabase(databaseUrl)).resolve(sessionId);
    return workspace?.role;
  },
  async submit(databaseUrl, input) {
    return submitOperatorDomainCommand({
      configured: true,
      input,
      store: new DatabaseOperatorDomainCommandStore(createHttpDatabase(databaseUrl)),
    });
  },
  randomUuid: () => crypto.randomUUID(),
};

export async function handleProductionOperatorCommandRequest(
  request: Request,
  environment: ProductionOperatorCommandBindings,
  dependencies: ProductionOperatorCommandDependencies = defaultDependencies,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== '/auth/v1/operator/commands') return undefined;
  if (environment.APP_ENV !== 'production') return undefined;
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Method not allowed.', 405);
  }

  const databaseUrl = configured(environment);
  if (databaseUrl === undefined) {
    return errorResponse('operator_command_unavailable', 'The command service is unavailable.', 503);
  }

  if (
    !isAllowedAuthMutationOrigin(
      environment.AUTH_ALLOWED_WEB_ORIGINS,
      request.headers.get('origin') ?? undefined,
    )
  ) {
    return errorResponse('operator_origin_denied', 'The requesting origin is not permitted.', 403);
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (idempotencyKey === undefined || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return errorResponse('operator_command_invalid', 'The command request is invalid.', 400);
  }

  const body = parseBrowserBody(await readJsonBody(request));
  if (body === undefined) {
    return errorResponse('operator_command_invalid', 'The command request is invalid.', 400);
  }

  const session = await dependencies.resolveSession(
    environment,
    request.headers.get('cookie') ?? undefined,
  );
  if (!session.ok) {
    return errorResponse(session.code, session.message, session.status);
  }

  let workspaceRole: DatabaseWorkspaceRole | undefined;
  try {
    workspaceRole = await dependencies.resolveWorkspaceRole(databaseUrl, session.context.sessionId);
  } catch {
    return errorResponse('operator_command_unavailable', 'The command service is unavailable.', 503);
  }
  if (workspaceRole !== roleForCommand(body.command)) {
    return errorResponse('operator_permission_denied', 'The requested action is not permitted.', 403);
  }

  const input = {
    ...body,
    sessionId: session.context.sessionId,
    idempotencyKey,
    correlationId: dependencies.randomUuid(),
  } as OperatorDomainCommandInput;

  let resolution: OperatorDomainCommandResolution;
  try {
    resolution = await dependencies.submit(databaseUrl, input);
  } catch {
    return errorResponse('operator_command_unavailable', 'The command service is unavailable.', 503);
  }
  return resolutionResponse(resolution);
}
