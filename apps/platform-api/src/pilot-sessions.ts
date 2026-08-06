import type { PilotReadRole } from './pilot-read-models.js';

const PILOT_SESSION_ISSUER = 'international-school-platform-staging';
const PILOT_SESSION_AUDIENCE = 'international-school-platform-api';
const PILOT_TENANT_ID = 'tenant-pilot-001';
const PILOT_CAMPUS_ID = 'campus-main';
const PILOT_SESSION_TTL_SECONDS = 15 * 60;
const MINIMUM_SECRET_LENGTH = 32;

const subjectByRole: Readonly<Record<PilotReadRole, string>> = {
  admin: 'principal-1',
  teacher: 'teacher-1',
  guardian: 'guardian-1',
  student: 'student-1',
};

export interface PilotSessionClaims {
  readonly version: 1;
  readonly issuer: typeof PILOT_SESSION_ISSUER;
  readonly audience: typeof PILOT_SESSION_AUDIENCE;
  readonly tenantId: typeof PILOT_TENANT_ID;
  readonly campusId: typeof PILOT_CAMPUS_ID;
  readonly role: PilotReadRole;
  readonly subjectId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly sessionId: string;
}

export type PilotSessionIssue =
  | {
      readonly ok: true;
      readonly token: string;
      readonly expiresAt: string;
      readonly scope: Readonly<
        Pick<PilotSessionClaims, 'tenantId' | 'campusId' | 'role' | 'subjectId'>
      >;
    }
  | {
      readonly ok: false;
      readonly status: 404 | 503;
      readonly code: string;
      readonly message: string;
    };

export type PilotSessionVerification =
  | { readonly ok: true; readonly claims: PilotSessionClaims }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPilotRole(value: unknown): value is PilotReadRole {
  return value === 'admin' || value === 'teacher' || value === 'guardian' || value === 'student';
}

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as unknown;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function invalidConfiguration(): PilotSessionIssue {
  return {
    ok: false,
    status: 503,
    code: 'pilot_session_unavailable',
    message: 'The staging session issuer is not configured.',
  };
}

function invalidVerificationConfiguration(): PilotSessionVerification {
  return {
    ok: false,
    status: 503,
    code: 'pilot_session_unavailable',
    message: 'The staging session verifier is not configured.',
  };
}

export async function issuePilotSession(
  secret: string | undefined,
  roleValue: string,
  now = Date.now(),
): Promise<PilotSessionIssue> {
  if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) return invalidConfiguration();
  if (!isPilotRole(roleValue)) {
    return {
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
      message: 'The requested pilot role is not available.',
    };
  }

  const issuedAt = Math.floor(now / 1000);
  const claims: PilotSessionClaims = {
    version: 1,
    issuer: PILOT_SESSION_ISSUER,
    audience: PILOT_SESSION_AUDIENCE,
    tenantId: PILOT_TENANT_ID,
    campusId: PILOT_CAMPUS_ID,
    role: roleValue,
    subjectId: subjectByRole[roleValue],
    issuedAt,
    expiresAt: issuedAt + PILOT_SESSION_TTL_SECONDS,
    sessionId: crypto.randomUUID(),
  };
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const key = await importSigningKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedClaims)),
  );

  return {
    ok: true,
    token: `${encodedClaims}.${encodeBase64Url(signature)}`,
    expiresAt: new Date(claims.expiresAt * 1000).toISOString(),
    scope: {
      tenantId: claims.tenantId,
      campusId: claims.campusId,
      role: claims.role,
      subjectId: claims.subjectId,
    },
  };
}

function parseClaims(value: unknown): PilotSessionClaims | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.version !== 1 ||
    value.issuer !== PILOT_SESSION_ISSUER ||
    value.audience !== PILOT_SESSION_AUDIENCE ||
    value.tenantId !== PILOT_TENANT_ID ||
    value.campusId !== PILOT_CAMPUS_ID ||
    !isPilotRole(value.role) ||
    value.subjectId !== subjectByRole[value.role] ||
    typeof value.issuedAt !== 'number' ||
    typeof value.expiresAt !== 'number' ||
    typeof value.sessionId !== 'string' ||
    value.sessionId.length < 8
  ) {
    return undefined;
  }
  return value as unknown as PilotSessionClaims;
}

export async function verifyPilotSession(
  secret: string | undefined,
  authorization: string | undefined,
  expectedRole: string,
  now = Date.now(),
): Promise<PilotSessionVerification> {
  if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) {
    return invalidVerificationConfiguration();
  }

  const token = authorization?.match(/^Bearer\s+([^\s]+)$/u)?.[1];
  if (token === undefined) {
    return {
      ok: false,
      status: 401,
      code: 'pilot_session_required',
      message: 'A valid staging session is required.',
    };
  }

  const [encodedClaims, encodedSignature, ...extraParts] = token.split('.');
  if (
    encodedClaims === undefined ||
    encodedClaims === '' ||
    encodedSignature === undefined ||
    encodedSignature === '' ||
    extraParts.length > 0
  ) {
    return {
      ok: false,
      status: 401,
      code: 'pilot_session_invalid',
      message: 'The staging session is invalid.',
    };
  }

  try {
    const key = await importSigningKey(secret);
    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedClaims),
    );
    const claims = verified ? parseClaims(decodeJson(encodedClaims)) : undefined;
    const nowSeconds = Math.floor(now / 1000);
    if (
      claims === undefined ||
      claims.role !== expectedRole ||
      claims.issuedAt > nowSeconds + 60 ||
      claims.expiresAt <= nowSeconds
    ) {
      return {
        ok: false,
        status: 401,
        code: 'pilot_session_invalid',
        message: 'The staging session is invalid or expired.',
      };
    }
    return { ok: true, claims };
  } catch {
    return {
      ok: false,
      status: 401,
      code: 'pilot_session_invalid',
      message: 'The staging session is invalid.',
    };
  }
}

export function pilotSessionHeaders(claims: PilotSessionClaims): Headers {
  return new Headers({
    'x-school-tenant-id': claims.tenantId,
    'x-school-campus-id': claims.campusId,
    'x-school-role': claims.role,
    'x-school-subject-id': claims.subjectId,
  });
}
