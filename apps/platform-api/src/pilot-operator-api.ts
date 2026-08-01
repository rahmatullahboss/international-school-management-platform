import { isAllowedPilotWebOrigin } from './pilot-read-models.js';
import {
  PILOT_OPERATOR_CAMPUS_ID,
  PILOT_OPERATOR_TENANT_ID,
  authorizePilotOperatorPermission,
  isPilotOperatorRole,
  resolvePilotOperatorSnapshot,
  type PilotOperatorRole,
} from './pilot-operator-models.js';
import {
  issuePilotOperatorSession,
  pilotOperatorSessionHeaders,
  verifyPilotOperatorSession,
  type PilotOperatorSessionClaims,
} from './pilot-operator-sessions.js';

export interface PilotOperatorBindings {
  readonly APP_ENV: string;
  readonly PILOT_SESSION_SECRET?: string;
}

interface PilotOperatorCommandDefinition {
  readonly permission: string;
  readonly label: string;
}

const commandDefinitions = {
  admissions: {
    'application.review.record': {
      permission: 'admissions.application.review',
      label: 'Admissions application review recorded',
    },
  },
  finance: {
    'cash-session.reconcile.record': {
      permission: 'finance.reconciliation.write',
      label: 'Cash session reconciliation recorded',
    },
  },
  support: {
    'tenant.diagnostics.capture': {
      permission: 'support.diagnostics.read',
      label: 'Tenant diagnostics captured',
    },
  },
} as const satisfies Readonly<
  Record<PilotOperatorRole, Readonly<Record<string, PilotOperatorCommandDefinition>>>
>;

interface PilotOperatorAuditEntry {
  readonly auditId: string;
  readonly role: PilotOperatorRole;
  readonly command: string;
  readonly label: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly subjectId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly reason: string;
  readonly occurredAt: string;
}

const auditByRole = new Map<PilotOperatorRole, PilotOperatorAuditEntry[]>();
const receiptByIdempotencyKey = new Map<string, PilotOperatorAuditEntry>();
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

function jsonResponse(body: unknown, status: number, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function pilotCorsHeaders(request: Request): Headers | Response {
  const origin = request.headers.get('origin') ?? undefined;
  const allowed = isAllowedPilotWebOrigin(origin);
  if (origin !== undefined && !allowed) {
    return jsonResponse(
      {
        error: {
          code: 'pilot_origin_denied',
          message: 'The requesting origin is not permitted for the pilot API.',
        },
      },
      403,
      new Headers({ vary: 'Origin' }),
    );
  }

  const headers = new Headers({ vary: 'Origin' });
  if (origin !== undefined && allowed) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'authorization, content-type, if-none-match, idempotency-key',
    );
    headers.set('access-control-expose-headers', 'etag, x-correlation-id');
    headers.set('access-control-max-age', '600');
  }
  return headers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | undefined> {
  const contentType = request.headers.get('content-type')?.trim() ?? '';
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType)) return undefined;
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(declared)) return undefined;
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > 4096) return undefined;
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 4096) return undefined;
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function operatorRoute(
  url: URL,
):
  | { readonly kind: 'session'; readonly role: PilotOperatorRole }
  | { readonly kind: 'snapshot'; readonly role: PilotOperatorRole }
  | { readonly kind: 'authorize'; readonly role: PilotOperatorRole }
  | { readonly kind: 'audit'; readonly role: PilotOperatorRole }
  | { readonly kind: 'command'; readonly role: PilotOperatorRole; readonly command: string }
  | undefined {
  const session = url.pathname.match(/^\/pilot\/v1\/sessions\/([^/]+)$/u);
  if (session?.[1] !== undefined && isPilotOperatorRole(session[1])) {
    return { kind: 'session', role: session[1] };
  }
  const snapshot = url.pathname.match(/^\/pilot\/v1\/snapshots\/([^/]+)$/u);
  if (snapshot?.[1] !== undefined && isPilotOperatorRole(snapshot[1])) {
    return { kind: 'snapshot', role: snapshot[1] };
  }
  const authorize = url.pathname.match(/^\/pilot\/v1\/authorize\/([^/]+)$/u);
  if (authorize?.[1] !== undefined && isPilotOperatorRole(authorize[1])) {
    return { kind: 'authorize', role: authorize[1] };
  }
  const audit = url.pathname.match(/^\/pilot\/v1\/audit\/([^/]+)$/u);
  if (audit?.[1] !== undefined && isPilotOperatorRole(audit[1])) {
    return { kind: 'audit', role: audit[1] };
  }
  const command = url.pathname.match(/^\/pilot\/v1\/commands\/([^/]+)\/([^/]+)$/u);
  if (command?.[1] !== undefined && command[2] !== undefined && isPilotOperatorRole(command[1])) {
    return { kind: 'command', role: command[1], command: command[2] };
  }
  return undefined;
}

async function authenticatedClaims(
  request: Request,
  environment: PilotOperatorBindings,
  role: PilotOperatorRole,
): Promise<PilotOperatorSessionClaims | Response> {
  const verification = await verifyPilotOperatorSession(
    environment.PILOT_SESSION_SECRET,
    request.headers.get('authorization') ?? undefined,
    role,
  );
  if (!verification.ok) {
    return jsonResponse(
      { error: { code: verification.code, message: verification.message } },
      verification.status,
      new Headers({ 'cache-control': 'no-store' }),
    );
  }
  return verification.claims;
}

function commandDefinition(
  role: PilotOperatorRole,
  command: string,
): PilotOperatorCommandDefinition | undefined {
  const definitions: Readonly<Record<string, PilotOperatorCommandDefinition>> =
    commandDefinitions[role];
  return definitions[command];
}

function auditKey(role: PilotOperatorRole, idempotencyKey: string): string {
  return `${PILOT_OPERATOR_TENANT_ID}|${PILOT_OPERATOR_CAMPUS_ID}|${role}|${idempotencyKey}`;
}

async function handleCommand(
  request: Request,
  environment: PilotOperatorBindings,
  role: PilotOperatorRole,
  command: string,
  corsHeaders: Headers,
): Promise<Response> {
  if (request.method !== 'POST')
    return jsonResponse({ error: { code: 'method_not_allowed' } }, 405);
  const definition = commandDefinition(role, command);
  if (definition === undefined) {
    return jsonResponse(
      {
        error: {
          code: 'pilot_command_not_found',
          message: 'The requested command is not available.',
        },
      },
      404,
      corsHeaders,
    );
  }
  const claims = await authenticatedClaims(request, environment, role);
  if (claims instanceof Response) return claims;
  const decision = authorizePilotOperatorPermission(role, definition.permission, claims.assurance);
  if (!decision.allowed) {
    return jsonResponse(
      {
        error: {
          code:
            decision.reason === 'step-up-required'
              ? 'pilot_step_up_required'
              : 'pilot_permission_denied',
          message:
            decision.reason === 'step-up-required'
              ? 'Fresh AAL2 authentication is required.'
              : 'The requested action is not permitted for this role.',
        },
        ...(decision.reason === 'step-up-required'
          ? { requiredAssurance: decision.requiredAssurance }
          : {}),
      },
      403,
      corsHeaders,
    );
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  const body = await readJsonBody(request);
  const tenantId = body?.tenantId;
  const campusId = body?.campusId;
  const reason = body?.reason;
  if (
    idempotencyKey === undefined ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) ||
    tenantId !== claims.tenantId ||
    campusId !== claims.campusId ||
    typeof reason !== 'string' ||
    reason.trim() !== reason ||
    reason.length < 1 ||
    reason.length > 500
  ) {
    const scopeMismatch =
      body !== undefined &&
      ((typeof tenantId === 'string' && tenantId !== claims.tenantId) ||
        (typeof campusId === 'string' && campusId !== claims.campusId));
    return jsonResponse(
      {
        error: {
          code: scopeMismatch ? 'pilot_scope_denied' : 'pilot_command_invalid',
          message: scopeMismatch
            ? 'The requested tenant or campus scope is not permitted.'
            : 'The command request is invalid.',
        },
      },
      scopeMismatch ? 403 : 400,
      corsHeaders,
    );
  }

  const key = auditKey(role, idempotencyKey);
  const existing = receiptByIdempotencyKey.get(key);
  if (existing !== undefined) {
    return jsonResponse({ schemaVersion: 1, replayed: true, receipt: existing }, 200, corsHeaders);
  }

  const entry: PilotOperatorAuditEntry = {
    auditId: crypto.randomUUID(),
    role,
    command,
    label: definition.label,
    tenantId: claims.tenantId,
    campusId: claims.campusId,
    subjectId: claims.subjectId,
    idempotencyKey,
    correlationId: crypto.randomUUID(),
    reason,
    occurredAt: new Date().toISOString(),
  };
  receiptByIdempotencyKey.set(key, entry);
  const entries = auditByRole.get(role) ?? [];
  entries.push(entry);
  auditByRole.set(role, entries);
  return jsonResponse({ schemaVersion: 1, replayed: false, receipt: entry }, 202, corsHeaders);
}

export async function handlePilotOperatorRequest(
  request: Request,
  environment: PilotOperatorBindings,
): Promise<Response | undefined> {
  const route = operatorRoute(new URL(request.url));
  if (route === undefined) return undefined;

  if (environment.APP_ENV === 'production') {
    return jsonResponse(
      { error: { code: 'not_found', message: 'The requested resource was not found.' } },
      404,
    );
  }

  const cors = pilotCorsHeaders(request);
  if (cors instanceof Response) return cors;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (route.kind === 'session') {
    if (request.method !== 'POST')
      return jsonResponse({ error: { code: 'method_not_allowed' } }, 405, cors);
    const issuance = await issuePilotOperatorSession(environment.PILOT_SESSION_SECRET, route.role);
    if (!issuance.ok) {
      return jsonResponse(
        { error: { code: issuance.code, message: issuance.message } },
        issuance.status,
        cors,
      );
    }
    cors.set('cache-control', 'no-store');
    return jsonResponse(
      {
        schemaVersion: 1,
        tokenType: 'Bearer',
        accessToken: issuance.token,
        expiresAt: issuance.expiresAt,
        scope: issuance.scope,
      },
      201,
      cors,
    );
  }

  if (route.kind === 'snapshot') {
    if (request.method !== 'GET')
      return jsonResponse({ error: { code: 'method_not_allowed' } }, 405, cors);
    const claims = await authenticatedClaims(request, environment, route.role);
    if (claims instanceof Response) return claims;
    const resolution = resolvePilotOperatorSnapshot(
      pilotOperatorSessionHeaders(claims),
      route.role,
    );
    if (!resolution.ok) {
      return jsonResponse(
        { error: { code: resolution.code, message: resolution.message } },
        resolution.status,
        cors,
      );
    }
    cors.set('etag', resolution.etag);
    cors.set('cache-control', 'private, max-age=0, must-revalidate');
    cors.set('vary', 'Origin, Authorization, If-None-Match');
    if (request.headers.get('if-none-match') === resolution.etag) {
      return new Response(null, { status: 304, headers: cors });
    }
    return jsonResponse(resolution.snapshot, 200, cors);
  }

  if (route.kind === 'authorize') {
    if (request.method !== 'POST')
      return jsonResponse({ error: { code: 'method_not_allowed' } }, 405, cors);
    const claims = await authenticatedClaims(request, environment, route.role);
    if (claims instanceof Response) return claims;
    const body = await readJsonBody(request);
    const permission = body?.permission;
    if (typeof permission !== 'string' || permission.length < 1 || permission.length > 128) {
      return jsonResponse(
        { error: { code: 'pilot_permission_request_invalid', message: 'Permission is required.' } },
        400,
        cors,
      );
    }
    const decision = authorizePilotOperatorPermission(route.role, permission, claims.assurance);
    return jsonResponse({ schemaVersion: 1, decision }, 200, cors);
  }

  if (route.kind === 'audit') {
    if (request.method !== 'GET')
      return jsonResponse({ error: { code: 'method_not_allowed' } }, 405, cors);
    const claims = await authenticatedClaims(request, environment, route.role);
    if (claims instanceof Response) return claims;
    const entries = auditByRole.get(route.role) ?? [];
    return jsonResponse(
      {
        schemaVersion: 1,
        scope: {
          tenantId: claims.tenantId,
          campusId: claims.campusId,
          role: claims.role,
          subjectId: claims.subjectId,
        },
        entries,
      },
      200,
      cors,
    );
  }

  return handleCommand(request, environment, route.role, route.command, cors);
}
