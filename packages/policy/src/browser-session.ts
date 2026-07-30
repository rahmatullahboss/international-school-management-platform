import type { AssuranceLevel } from './authorization.js';
import type { ResolvedMembershipContext } from './membership.js';
import type { OidcIdentity } from './oidc.js';

export const BROWSER_SESSION_COOKIE_NAME = '__Host-school_session';
const SESSION_ISSUER = 'international-school-platform';
const SESSION_AUDIENCE = 'international-school-platform-web';
const MINIMUM_SECRET_LENGTH = 32;
const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;
const MAXIMUM_SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface BrowserSessionClaims {
  readonly version: 1;
  readonly issuer: typeof SESSION_ISSUER;
  readonly audience: typeof SESSION_AUDIENCE;
  readonly sessionId: string;
  readonly principalId: string;
  readonly membershipId: string;
  readonly identityIssuer: string;
  readonly identitySubject: string;
  readonly tenantId: string;
  readonly campusId?: string;
  readonly roleIds: readonly string[];
  readonly assurance: AssuranceLevel;
  readonly authenticationTime?: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface IssueBrowserSessionInput {
  readonly identity: OidcIdentity;
  readonly membership: ResolvedMembershipContext;
  readonly secret: string;
  readonly now?: number;
  readonly ttlSeconds?: number;
}

export type BrowserSessionIssueResult =
  | {
      readonly ok: true;
      readonly token: string;
      readonly claims: BrowserSessionClaims;
      readonly setCookie: string;
    }
  | {
      readonly ok: false;
      readonly code: 'browser_session_configuration_invalid' | 'browser_session_input_invalid';
      readonly message: string;
    };

export type BrowserSessionVerificationResult =
  | { readonly ok: true; readonly claims: BrowserSessionClaims }
  | {
      readonly ok: false;
      readonly code:
        | 'browser_session_configuration_invalid'
        | 'browser_session_required'
        | 'browser_session_invalid'
        | 'browser_session_expired';
      readonly message: string;
    };

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseClaims(value: unknown): BrowserSessionClaims | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.version !== 1 ||
    value.issuer !== SESSION_ISSUER ||
    value.audience !== SESSION_AUDIENCE ||
    typeof value.sessionId !== 'string' ||
    value.sessionId.length < 8 ||
    typeof value.principalId !== 'string' ||
    value.principalId.trim() === '' ||
    typeof value.membershipId !== 'string' ||
    value.membershipId.trim() === '' ||
    typeof value.identityIssuer !== 'string' ||
    value.identityIssuer.trim() === '' ||
    typeof value.identitySubject !== 'string' ||
    value.identitySubject.trim() === '' ||
    typeof value.tenantId !== 'string' ||
    value.tenantId.trim() === '' ||
    (value.campusId !== undefined && typeof value.campusId !== 'string') ||
    !Array.isArray(value.roleIds) ||
    value.roleIds.length === 0 ||
    !value.roleIds.every((role) => typeof role === 'string' && role.trim() !== '') ||
    (value.assurance !== 'aal1' && value.assurance !== 'aal2') ||
    (value.authenticationTime !== undefined &&
      (typeof value.authenticationTime !== 'number' ||
        !Number.isInteger(value.authenticationTime))) ||
    typeof value.issuedAt !== 'number' ||
    !Number.isInteger(value.issuedAt) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isInteger(value.expiresAt)
  ) {
    return undefined;
  }
  return value as unknown as BrowserSessionClaims;
}

async function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function readCookie(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (cookieHeader === undefined) return undefined;
  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1) continue;
    const name = segment.slice(0, separator).trim();
    if (name !== cookieName) continue;
    const value = segment.slice(separator + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}

function cookieForToken(token: string, maxAge: number): string {
  return `${BROWSER_SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearBrowserSessionCookie(): string {
  return `${BROWSER_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function issueBrowserSession(
  input: IssueBrowserSessionInput,
): Promise<BrowserSessionIssueResult> {
  if (input.secret.length < MINIMUM_SECRET_LENGTH) {
    return {
      ok: false,
      code: 'browser_session_configuration_invalid',
      message: 'The browser session signing secret is not configured.',
    };
  }
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > MAXIMUM_SESSION_TTL_SECONDS ||
    input.membership.roleIds.length === 0
  ) {
    return {
      ok: false,
      code: 'browser_session_input_invalid',
      message: 'The browser session lifetime or membership context is invalid.',
    };
  }

  const issuedAt = Math.floor((input.now ?? Date.now()) / 1000);
  const claims: BrowserSessionClaims = {
    version: 1,
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
    sessionId: crypto.randomUUID(),
    principalId: input.membership.principalId,
    membershipId: input.membership.membershipId,
    identityIssuer: input.identity.issuer,
    identitySubject: input.identity.subject,
    tenantId: input.membership.tenantId,
    ...(input.membership.campusId === undefined ? {} : { campusId: input.membership.campusId }),
    roleIds: [...input.membership.roleIds],
    assurance: input.identity.assurance,
    ...(input.identity.authenticationTime === undefined
      ? {}
      : { authenticationTime: input.identity.authenticationTime }),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  };
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const key = await importSecret(input.secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedClaims)),
  );
  const token = `${encodedClaims}.${encodeBase64Url(signature)}`;
  return {
    ok: true,
    token,
    claims,
    setCookie: cookieForToken(token, ttlSeconds),
  };
}

export async function verifyBrowserSession(
  secret: string | undefined,
  cookieHeader: string | undefined,
  now = Date.now(),
): Promise<BrowserSessionVerificationResult> {
  if (secret === undefined || secret.length < MINIMUM_SECRET_LENGTH) {
    return {
      ok: false,
      code: 'browser_session_configuration_invalid',
      message: 'The browser session verifier is not configured.',
    };
  }
  const token = readCookie(cookieHeader, BROWSER_SESSION_COOKIE_NAME);
  if (token === undefined) {
    return {
      ok: false,
      code: 'browser_session_required',
      message: 'An authenticated browser session is required.',
    };
  }
  const segments = token.split('.');
  const encodedClaims = segments[0];
  const encodedSignature = segments[1];
  if (
    segments.length !== 2 ||
    encodedClaims === undefined ||
    encodedSignature === undefined ||
    encodedClaims === '' ||
    encodedSignature === ''
  ) {
    return {
      ok: false,
      code: 'browser_session_invalid',
      message: 'The browser session is invalid.',
    };
  }

  try {
    const key = await importSecret(secret);
    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedClaims),
    );
    if (!verified) throw new Error('Invalid signature');
    const claims = parseClaims(
      JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedClaims))) as unknown,
    );
    if (claims === undefined || claims.issuedAt > Math.floor(now / 1000) + 60) {
      throw new Error('Invalid claims');
    }
    if (claims.expiresAt <= Math.floor(now / 1000)) {
      return {
        ok: false,
        code: 'browser_session_expired',
        message: 'The browser session has expired.',
      };
    }
    return { ok: true, claims };
  } catch {
    return {
      ok: false,
      code: 'browser_session_invalid',
      message: 'The browser session is invalid.',
    };
  }
}
