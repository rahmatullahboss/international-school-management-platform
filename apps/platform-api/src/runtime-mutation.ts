import { isAllowedAuthMutationOrigin } from './auth-logout.js';
import type {
  RuntimeMutationDecision,
  RuntimeMutationReceipt,
  RuntimeSnapshotRefreshCommandInput,
} from './database-mutation-store.js';

const MAX_RUNTIME_MUTATION_BODY_BYTES = 4096;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) return true;
  }
  return false;
}

export type RuntimeMutationAuthenticationResult =
  | { readonly ok: true; readonly sessionId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    };

export type RuntimeMutationHttpResult =
  | {
      readonly ok: true;
      readonly status: 202;
      readonly replayed: boolean;
      readonly receipt: RuntimeMutationReceipt;
    }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403 | 404 | 409 | 503;
      readonly code: string;
      readonly message: string;
      readonly requiredAssurance?: 'aal2';
      readonly currentRevision?: number;
    };

export interface SubmitRuntimeSnapshotRefreshRequest {
  readonly configured: boolean;
  readonly allowedOrigins: string | undefined;
  readonly origin: string | undefined;
  readonly contentType: string | undefined;
  readonly contentLength?: string;
  readonly rawBody: string;
  readonly idempotencyKey: string | undefined;
  readonly correlationId: string;
  readonly authenticate: () => Promise<RuntimeMutationAuthenticationResult>;
  readonly submit: (input: RuntimeSnapshotRefreshCommandInput) => Promise<RuntimeMutationDecision>;
}

type RuntimeMutationErrorStatus = 400 | 401 | 403 | 404 | 409 | 503;

function errorResult(
  status: RuntimeMutationErrorStatus,
  code: string,
  message: string,
): RuntimeMutationHttpResult {
  return { ok: false, status, code, message };
}

export function isRuntimeMutationContentTypeAllowed(value: string | undefined): boolean {
  if (value === undefined) return false;
  return /^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(value.trim());
}

export function isRuntimeMutationDeclaredLengthAllowed(value: string | undefined): boolean {
  if (value === undefined) return true;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_RUNTIME_MUTATION_BODY_BYTES;
}

export async function readBoundedRuntimeMutationBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<string | undefined> {
  if (body === null) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > MAX_RUNTIME_MUTATION_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(result.value);
    }
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function parsedCommandBody(
  rawBody: string,
): { readonly expectedRevision: number; readonly reason: string } | undefined {
  let value: unknown;
  try {
    value = JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'expectedRevision' || keys[1] !== 'reason') {
    return undefined;
  }
  if (
    typeof record.expectedRevision !== 'number' ||
    !Number.isSafeInteger(record.expectedRevision) ||
    record.expectedRevision < 1 ||
    typeof record.reason !== 'string'
  ) {
    return undefined;
  }
  const reason = record.reason.trim();
  if (
    reason.length < 1 ||
    reason.length > 500 ||
    reason !== record.reason ||
    hasControlCharacters(reason)
  ) {
    return undefined;
  }
  return { expectedRevision: record.expectedRevision, reason };
}

function mapDecision(decision: RuntimeMutationDecision): RuntimeMutationHttpResult {
  if (decision.accepted) {
    return {
      ok: true,
      status: 202,
      replayed: decision.replayed,
      receipt: decision.receipt,
    };
  }
  if (decision.reason === 'session-inactive') {
    return errorResult(401, 'browser_session_revoked', 'The browser session is no longer active.');
  }
  if (decision.reason === 'permission-not-granted') {
    return errorResult(403, 'runtime_mutation_forbidden', 'The runtime mutation is not permitted.');
  }
  if (decision.reason === 'step-up-required') {
    return {
      ok: false,
      status: 403,
      code: 'runtime_mutation_step_up_required',
      message: 'Fresh AAL2 authentication is required for this runtime mutation.',
      requiredAssurance: 'aal2',
    };
  }
  if (decision.reason === 'projection-not-found') {
    return errorResult(
      404,
      'runtime_projection_not_found',
      'The runtime projection was not found.',
    );
  }
  if (decision.reason === 'revision-conflict') {
    return {
      ok: false,
      status: 409,
      code: 'runtime_mutation_revision_conflict',
      message: 'The runtime projection has changed. Refresh and try again.',
      currentRevision: decision.currentRevision,
    };
  }
  return errorResult(
    409,
    'runtime_mutation_idempotency_conflict',
    'The idempotency key was already used for a different request.',
  );
}

export async function submitRuntimeSnapshotRefresh(
  request: SubmitRuntimeSnapshotRefreshRequest,
): Promise<RuntimeMutationHttpResult> {
  if (!request.configured) {
    return errorResult(
      503,
      'runtime_mutation_configuration_invalid',
      'Runtime mutations are not configured.',
    );
  }
  if (!isAllowedAuthMutationOrigin(request.allowedOrigins, request.origin)) {
    return errorResult(
      403,
      'runtime_mutation_origin_denied',
      'The requesting origin is not permitted.',
    );
  }
  if (
    !isRuntimeMutationContentTypeAllowed(request.contentType) ||
    !isRuntimeMutationDeclaredLengthAllowed(request.contentLength) ||
    request.idempotencyKey === undefined ||
    !IDEMPOTENCY_KEY_PATTERN.test(request.idempotencyKey) ||
    !UUID_PATTERN.test(request.correlationId)
  ) {
    return errorResult(
      400,
      'runtime_mutation_request_invalid',
      'The runtime mutation request is invalid.',
    );
  }
  const command = parsedCommandBody(request.rawBody);
  if (command === undefined) {
    return errorResult(
      400,
      'runtime_mutation_request_invalid',
      'The runtime mutation request is invalid.',
    );
  }

  let authentication: RuntimeMutationAuthenticationResult;
  try {
    authentication = await request.authenticate();
  } catch {
    return errorResult(
      503,
      'runtime_mutation_unavailable',
      'The runtime mutation service is unavailable.',
    );
  }
  if (!authentication.ok) return authentication;

  let decision: RuntimeMutationDecision;
  try {
    decision = await request.submit({
      sessionId: authentication.sessionId,
      idempotencyKey: request.idempotencyKey,
      expectedRevision: command.expectedRevision,
      reason: command.reason,
      correlationId: request.correlationId,
    });
  } catch {
    return errorResult(
      503,
      'runtime_mutation_unavailable',
      'The runtime mutation service is unavailable.',
    );
  }
  return mapDecision(decision);
}
