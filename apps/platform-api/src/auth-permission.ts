import { hasValidAuthMutationOrigins, isAllowedAuthMutationOrigin } from './auth-logout.js';

export const MAX_PERMISSION_REQUEST_LENGTH = 2048;
const PERMISSION_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;

export type PermissionAuthenticator = () => Promise<
  | { readonly ok: true; readonly sessionId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    }
>;

export type PermissionDecision =
  | { readonly allowed: true; readonly reason: 'role-grant' }
  | {
      readonly allowed: false;
      readonly reason: 'permission-not-granted' | 'session-inactive';
    }
  | {
      readonly allowed: false;
      readonly reason: 'step-up-required';
      readonly requiredAssurance: 'aal2';
    };

export type PermissionEvaluator = (
  sessionId: string,
  permission: string,
) => Promise<PermissionDecision>;

export interface AuthorizeDatabasePermissionInput {
  readonly configured: boolean;
  readonly allowedOrigins: string | undefined;
  readonly origin: string | undefined;
  readonly contentType: string | undefined;
  readonly contentLength?: string;
  readonly rawBody: string;
  readonly authenticate: PermissionAuthenticator;
  readonly evaluate: PermissionEvaluator;
}

export type DatabasePermissionHttpResult =
  | {
      readonly ok: true;
      readonly status: 200 | 403;
      readonly decision: Exclude<PermissionDecision, { readonly reason: 'session-inactive' }>;
    }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403 | 503;
      readonly code: string;
      readonly message: string;
    };

export function isPermissionContentTypeAllowed(value: string | undefined): boolean {
  if (value === undefined) return false;
  const [mediaType, ...parameters] = value
    .toLowerCase()
    .split(';')
    .map((part) => part.trim());
  if (mediaType !== 'application/json') return false;
  return parameters.every((parameter) => parameter === '' || parameter === 'charset=utf-8');
}

export async function readBoundedPermissionRequestBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<string | undefined> {
  if (body === null) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > MAX_PERMISSION_REQUEST_LENGTH) {
        await reader.cancel();
        return undefined;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The request body is already unusable; retain the sanitized failure path.
    }
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

export function isPermissionDeclaredLengthAllowed(value: string | undefined): boolean {
  if (value === undefined) return true;
  if (!/^\d+$/u.test(value)) return false;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_PERMISSION_REQUEST_LENGTH;
}

function parsePermissionRequest(rawBody: string): string | undefined {
  if (rawBody.length === 0 || rawBody.length > MAX_PERMISSION_REQUEST_LENGTH) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 1 ||
    keys[0] !== 'permission' ||
    typeof record.permission !== 'string' ||
    !PERMISSION_KEY_PATTERN.test(record.permission)
  ) {
    return undefined;
  }
  return record.permission;
}

function failure(
  status: 400 | 401 | 403 | 503,
  code: string,
  message: string,
): DatabasePermissionHttpResult {
  return { ok: false, status, code, message };
}

export async function authorizeDatabasePermission(
  input: AuthorizeDatabasePermissionInput,
): Promise<DatabasePermissionHttpResult> {
  if (!input.configured || !hasValidAuthMutationOrigins(input.allowedOrigins)) {
    return failure(
      503,
      'permission_configuration_invalid',
      'Permission evaluation is not configured.',
    );
  }
  if (!isAllowedAuthMutationOrigin(input.allowedOrigins, input.origin)) {
    return failure(403, 'permission_origin_denied', 'The requesting origin is not permitted.');
  }
  if (
    !isPermissionContentTypeAllowed(input.contentType) ||
    !isPermissionDeclaredLengthAllowed(input.contentLength)
  ) {
    return failure(400, 'permission_request_invalid', 'The permission request is invalid.');
  }
  const permission = parsePermissionRequest(input.rawBody);
  if (permission === undefined) {
    return failure(400, 'permission_request_invalid', 'The permission request is invalid.');
  }

  let authentication: Awaited<ReturnType<PermissionAuthenticator>>;
  try {
    authentication = await input.authenticate();
  } catch {
    return failure(503, 'permission_session_unavailable', 'The browser session is unavailable.');
  }
  if (!authentication.ok) return authentication;

  let decision: PermissionDecision;
  try {
    decision = await input.evaluate(authentication.sessionId, permission);
  } catch {
    return failure(
      503,
      'permission_evaluation_unavailable',
      'Permission evaluation is unavailable.',
    );
  }
  if (decision.allowed) return { ok: true, status: 200, decision };
  if (decision.reason === 'session-inactive') {
    return failure(401, 'browser_session_revoked', 'The browser session is no longer active.');
  }
  return { ok: true, status: 403, decision };
}
