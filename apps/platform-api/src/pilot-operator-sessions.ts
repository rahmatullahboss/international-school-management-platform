import {
  PILOT_OPERATOR_CAMPUS_ID,
  PILOT_OPERATOR_TENANT_ID,
  isPilotOperatorRole,
  pilotOperatorAssurance,
  pilotOperatorSubject,
  type PilotOperatorAssurance,
  type PilotOperatorRole,
} from './pilot-operator-models.js';

const PILOT_SESSION_ISSUER = 'international-school-platform-staging';
const PILOT_SESSION_AUDIENCE = 'international-school-platform-api';
const PILOT_SESSION_TTL_SECONDS = 15 * 60;
const MINIMUM_SECRET_LENGTH = 32;

export interface PilotOperatorSessionClaims {
  readonly version: 1;
  readonly issuer: typeof PILOT_SESSION_ISSUER;
  readonly audience: typeof PILOT_SESSION_AUDIENCE;
  readonly tenantId: typeof PILOT_OPERATOR_TENANT_ID;
  readonly campusId: typeof PILOT_OPERATOR_CAMPUS_ID;
  readonly role: PilotOperatorRole;
  readonly subjectId: string;
  readonly assurance: PilotOperatorAssurance;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly sessionId: string;
}

export type PilotOperatorSessionIssue =
  | {
      readonly ok: true;
      readonly token: string;
      readonly expiresAt: string;
      readonly scope: Readonly<
        Pick<
          PilotOperatorSessionClaims,
          'tenantId' | 'campusId' | 'role' | 'subjectId' | 'assurance'
        >
      >;
    }
  | {
      readonly ok: false;
      readonly status: 404 | 503;
      readonly code: string;
      readonly message: string;
    };

export type PilotOperatorSessionVerification =
  | { readonly ok: true; readonly claims: PilotOperatorSessionClaims }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function invalidConfiguration(): PilotOperatorSessionIssue {
  return {
    ok: false,
    status: 503,
    code: 'pilot_session_unavailable',
    message: 'The staging session issuer is not configured.',
  };
}

export async function issuePilotOperatorSession(
  secret: string | undefined,
  roleValue: string,
  now = Date.now(),
): Promise<PilotOperatorSessionIssue> {
  if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) return invalidConfiguration();
  if (!isPilotOperatorRole(roleValue)) {
    return {
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
      message: 'The requested pilot role is not available.',
    };
  }

  const issuedAt = Math.floor(now / 1000);
  const claims: PilotOperatorSessionClaims = {
    version: 1,
    issuer: PILOT_SESSION_ISSUER,
    audience: PILOT_SESSION_AUDIENCE,
    tenantId: PILOT_OPERATOR_TENANT_ID,
    campusId: PILOT_OPERATOR_CAMPUS_ID,
    role: roleValue,
    subjectId: pilotOperatorSubject(roleValue),
    assurance: pilotOperatorAssurance(roleValue),
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
      assurance: claims.assurance,
    },
  };
}

function parseClaims(value: unknown): PilotOperatorSessionClaims | undefined {
  if (!isRecord(value) || !isPilotOperatorRole(value.role)) return undefined;
  const role = value.role;
  if (
    value.version !== 1 ||
    value.issuer !== PILOT_SESSION_ISSUER ||
    value.audience !== PILOT_SESSION_AUDIENCE ||
    value.tenantId !== PILOT_OPERATOR_TENANT_ID ||
    value.campusId !== PILOT_OPERATOR_CAMPUS_ID ||
    value.subjectId !== pilotOperatorSubject(role) ||
    value.assurance !== pilotOperatorAssurance(role) ||
    typeof value.issuedAt !== 'number' ||
    typeof value.expiresAt !== 'number' ||
    typeof value.sessionId !== 'string' ||
    value.sessionId.length < 8
  ) {
    return undefined;
  }
  return value as unknown as PilotOperatorSessionClaims;
}

export async function verifyPilotOperatorSession(
  secret: string | undefined,
  authorization: string | undefined,
  expectedRole: string,
  now = Date.now(),
): Promise<PilotOperatorSessionVerification> {
  if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) {
    return {
      ok: false,
      status: 503,
      code: 'pilot_session_unavailable',
      message: 'The staging session verifier is not configured.',
    };
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

export function pilotOperatorSessionHeaders(claims: PilotOperatorSessionClaims): Headers {
  return new Headers({
    'x-school-tenant-id': claims.tenantId,
    'x-school-campus-id': claims.campusId,
    'x-school-role': claims.role,
    'x-school-subject-id': claims.subjectId,
    'x-school-assurance': claims.assurance,
  });
}
