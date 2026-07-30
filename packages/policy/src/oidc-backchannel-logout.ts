import type { OidcCachedJwksResult } from './oidc-provider-cache.js';
import {
  validateOidcProviderConfiguration,
  type OidcJsonWebKey,
  type OidcJsonWebKeySet,
  type OidcProviderConfiguration,
} from './oidc.js';

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';
const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const MAX_LOGOUT_TOKEN_LIFETIME_SECONDS = 10 * 60;
const MAX_LOGOUT_TOKEN_AGE_SECONDS = 5 * 60;
const MAX_LOGOUT_TOKEN_LENGTH = 16 * 1024;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_AUDIENCES = 10;

interface JwtHeader {
  readonly alg: 'RS256';
  readonly kid: string;
  readonly typ: 'logout+jwt';
}

interface JwtClaims {
  readonly iss: string;
  readonly sub?: string;
  readonly aud: string | readonly string[];
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
  readonly events: Readonly<Record<string, unknown>>;
  readonly sid?: string;
}

export interface OidcBackchannelLogoutClaims {
  readonly issuer: string;
  readonly subject?: string;
  readonly providerSessionId?: string;
  readonly tokenId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface VerifyOidcBackchannelLogoutTokenInput {
  readonly logoutToken: string;
  readonly configuration: OidcProviderConfiguration;
  readonly jwks: OidcJsonWebKeySet;
  readonly now?: number;
  readonly clockSkewSeconds?: number;
}

export type OidcBackchannelLogoutFailureCode =
  | 'oidc_backchannel_configuration_invalid'
  | 'oidc_backchannel_token_malformed'
  | 'oidc_backchannel_algorithm_denied'
  | 'oidc_backchannel_token_type_denied'
  | 'oidc_backchannel_claims_invalid'
  | 'oidc_backchannel_signing_key_not_found'
  | 'oidc_backchannel_signature_invalid'
  | 'oidc_backchannel_issuer_mismatch'
  | 'oidc_backchannel_audience_mismatch'
  | 'oidc_backchannel_token_expired'
  | 'oidc_backchannel_token_not_yet_valid'
  | 'oidc_backchannel_token_too_old'
  | 'oidc_backchannel_persistence_unavailable';

export type OidcBackchannelLogoutVerificationResult =
  | { readonly ok: true; readonly claims: OidcBackchannelLogoutClaims }
  | {
      readonly ok: false;
      readonly code: OidcBackchannelLogoutFailureCode;
      readonly message: string;
    };

export interface VerifyOidcBackchannelLogoutWithRotationInput extends Omit<
  VerifyOidcBackchannelLogoutTokenInput,
  'jwks'
> {
  readonly resolveJwks: (forceRefresh: boolean) => Promise<OidcCachedJwksResult>;
}

export interface OidcBackchannelLogoutPersistenceResult {
  readonly replayed: boolean;
  readonly revokedSessions: number;
}

export interface ProcessOidcBackchannelLogoutInput extends VerifyOidcBackchannelLogoutWithRotationInput {
  readonly applyLogout: (
    claims: OidcBackchannelLogoutClaims,
  ) => Promise<OidcBackchannelLogoutPersistenceResult>;
}

export type OidcBackchannelLogoutProcessResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly revokedSessions: number;
      readonly claims: OidcBackchannelLogoutClaims;
    }
  | {
      readonly ok: false;
      readonly code: OidcBackchannelLogoutFailureCode;
      readonly message: string;
    };

function failure(
  code: OidcBackchannelLogoutFailureCode,
  message: string,
): OidcBackchannelLogoutVerificationResult {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    !value.includes('\u0000')
  );
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as unknown;
}

function parseHeader(value: unknown): JwtHeader | undefined {
  if (!isRecord(value)) return undefined;
  if (value.alg !== 'RS256' || !boundedIdentifier(value.kid) || value.typ !== 'logout+jwt') {
    return undefined;
  }
  return { alg: 'RS256', kid: value.kid, typ: 'logout+jwt' };
}

function parseClaims(value: unknown): JwtClaims | undefined {
  if (!isRecord(value)) return undefined;
  const audience = value.aud;
  const validAudience =
    boundedIdentifier(audience) ||
    (Array.isArray(audience) &&
      audience.length > 0 &&
      audience.length <= MAX_AUDIENCES &&
      audience.every(boundedIdentifier));
  const subject = value.sub;
  const sessionId = value.sid;
  const events = value.events;
  if (
    !boundedIdentifier(value.iss) ||
    !validAudience ||
    typeof value.iat !== 'number' ||
    !Number.isInteger(value.iat) ||
    typeof value.exp !== 'number' ||
    !Number.isInteger(value.exp) ||
    !boundedIdentifier(value.jti) ||
    !isRecord(events) ||
    !isRecord(events[BACKCHANNEL_LOGOUT_EVENT]) ||
    Object.keys(events[BACKCHANNEL_LOGOUT_EVENT]).length !== 0 ||
    (subject !== undefined && !boundedIdentifier(subject)) ||
    (sessionId !== undefined && !boundedIdentifier(sessionId)) ||
    (subject === undefined && sessionId === undefined) ||
    value.nonce !== undefined
  ) {
    return undefined;
  }
  return value as unknown as JwtClaims;
}

function audienceMatches(audience: string | readonly string[], clientId: string): boolean {
  return (typeof audience === 'string' ? [audience] : audience).includes(clientId);
}

async function verifySignature(
  header: JwtHeader,
  encodedHeader: string,
  encodedClaims: string,
  encodedSignature: string,
  jwks: OidcJsonWebKeySet,
): Promise<'verified' | 'key-not-found' | 'invalid'> {
  const jwk: OidcJsonWebKey | undefined = jwks.keys.find(
    (candidate) =>
      candidate.kid === header.kid &&
      candidate.kty === 'RSA' &&
      (candidate.alg === undefined || candidate.alg === 'RS256') &&
      (candidate.use === undefined || candidate.use === 'sig'),
  );
  if (jwk === undefined) return 'key-not-found';
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    );
    return verified ? 'verified' : 'invalid';
  } catch {
    return 'invalid';
  }
}

export async function verifyOidcBackchannelLogoutToken(
  input: VerifyOidcBackchannelLogoutTokenInput,
): Promise<OidcBackchannelLogoutVerificationResult> {
  if (
    validateOidcProviderConfiguration(input.configuration) !== undefined ||
    input.logoutToken.length === 0 ||
    input.logoutToken.length > MAX_LOGOUT_TOKEN_LENGTH
  ) {
    return failure(
      'oidc_backchannel_configuration_invalid',
      'Back-channel logout configuration is invalid.',
    );
  }

  const segments = input.logoutToken.split('.');
  const encodedHeader = segments[0];
  const encodedClaims = segments[1];
  const encodedSignature = segments[2];
  if (
    segments.length !== 3 ||
    encodedHeader === undefined ||
    encodedClaims === undefined ||
    encodedSignature === undefined ||
    encodedHeader === '' ||
    encodedClaims === '' ||
    encodedSignature === ''
  ) {
    return failure('oidc_backchannel_token_malformed', 'The Logout Token is malformed.');
  }

  let rawHeader: unknown;
  let header: JwtHeader | undefined;
  let claims: JwtClaims | undefined;
  try {
    rawHeader = decodeJson(encodedHeader);
    if (isRecord(rawHeader) && rawHeader.alg !== 'RS256') {
      return failure(
        'oidc_backchannel_algorithm_denied',
        'The Logout Token uses a denied signing algorithm.',
      );
    }
    if (isRecord(rawHeader) && rawHeader.typ !== 'logout+jwt') {
      return failure(
        'oidc_backchannel_token_type_denied',
        'The Logout Token type is not permitted.',
      );
    }
    header = parseHeader(rawHeader);
    claims = parseClaims(decodeJson(encodedClaims));
  } catch {
    return failure('oidc_backchannel_token_malformed', 'The Logout Token cannot be decoded.');
  }
  if (header === undefined || claims === undefined) {
    return failure(
      'oidc_backchannel_claims_invalid',
      'The Logout Token header or claims are invalid.',
    );
  }

  const signature = await verifySignature(
    header,
    encodedHeader,
    encodedClaims,
    encodedSignature,
    input.jwks,
  );
  if (signature === 'key-not-found') {
    return failure(
      'oidc_backchannel_signing_key_not_found',
      'No approved signing key matched the Logout Token.',
    );
  }
  if (signature !== 'verified') {
    return failure('oidc_backchannel_signature_invalid', 'The Logout Token signature is invalid.');
  }
  if (claims.iss !== input.configuration.issuer) {
    return failure('oidc_backchannel_issuer_mismatch', 'The Logout Token issuer is not permitted.');
  }
  if (!audienceMatches(claims.aud, input.configuration.clientId)) {
    return failure(
      'oidc_backchannel_audience_mismatch',
      'The Logout Token audience is not permitted.',
    );
  }

  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  const skew = input.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  if (!Number.isInteger(skew) || skew < 0 || skew > DEFAULT_CLOCK_SKEW_SECONDS) {
    return failure(
      'oidc_backchannel_configuration_invalid',
      'Back-channel logout configuration is invalid.',
    );
  }
  if (claims.exp <= nowSeconds - skew) {
    return failure('oidc_backchannel_token_expired', 'The Logout Token has expired.');
  }
  if (claims.iat > nowSeconds + skew || claims.exp <= claims.iat) {
    return failure('oidc_backchannel_token_not_yet_valid', 'The Logout Token is not yet valid.');
  }
  if (claims.exp - claims.iat > MAX_LOGOUT_TOKEN_LIFETIME_SECONDS) {
    return failure('oidc_backchannel_claims_invalid', 'The Logout Token lifetime exceeds policy.');
  }
  if (claims.iat < nowSeconds - MAX_LOGOUT_TOKEN_AGE_SECONDS - skew) {
    return failure('oidc_backchannel_token_too_old', 'The Logout Token is too old.');
  }

  return {
    ok: true,
    claims: {
      issuer: claims.iss,
      ...(claims.sub === undefined ? {} : { subject: claims.sub }),
      ...(claims.sid === undefined ? {} : { providerSessionId: claims.sid }),
      tokenId: claims.jti,
      issuedAt: claims.iat,
      expiresAt: claims.exp,
    },
  };
}

export async function verifyOidcBackchannelLogoutTokenWithRotation(
  input: VerifyOidcBackchannelLogoutWithRotationInput,
): Promise<OidcBackchannelLogoutVerificationResult> {
  let initialKeys: OidcCachedJwksResult;
  try {
    initialKeys = await input.resolveJwks(false);
  } catch {
    return failure(
      'oidc_backchannel_configuration_invalid',
      'Back-channel signing keys are unavailable.',
    );
  }
  if (!initialKeys.ok) {
    return failure(
      'oidc_backchannel_configuration_invalid',
      'Back-channel signing keys are unavailable.',
    );
  }
  const initial = await verifyOidcBackchannelLogoutToken({
    logoutToken: input.logoutToken,
    configuration: input.configuration,
    jwks: initialKeys.jwks,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.clockSkewSeconds === undefined ? {} : { clockSkewSeconds: input.clockSkewSeconds }),
  });
  if (initial.ok || initial.code !== 'oidc_backchannel_signing_key_not_found') return initial;

  let refreshedKeys: OidcCachedJwksResult;
  try {
    refreshedKeys = await input.resolveJwks(true);
  } catch {
    return failure(
      'oidc_backchannel_configuration_invalid',
      'Back-channel signing keys are unavailable.',
    );
  }
  if (!refreshedKeys.ok) {
    return failure(
      'oidc_backchannel_configuration_invalid',
      'Back-channel signing keys are unavailable.',
    );
  }
  return verifyOidcBackchannelLogoutToken({
    logoutToken: input.logoutToken,
    configuration: input.configuration,
    jwks: refreshedKeys.jwks,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.clockSkewSeconds === undefined ? {} : { clockSkewSeconds: input.clockSkewSeconds }),
  });
}

export async function processOidcBackchannelLogout(
  input: ProcessOidcBackchannelLogoutInput,
): Promise<OidcBackchannelLogoutProcessResult> {
  const verification = await verifyOidcBackchannelLogoutTokenWithRotation(input);
  if (!verification.ok) return verification;

  try {
    const persistence = await input.applyLogout(verification.claims);
    if (
      typeof persistence.replayed !== 'boolean' ||
      !Number.isInteger(persistence.revokedSessions) ||
      persistence.revokedSessions < 0 ||
      (persistence.replayed && persistence.revokedSessions !== 0)
    ) {
      throw new Error('invalid persistence result');
    }
    return {
      ok: true,
      replayed: persistence.replayed,
      revokedSessions: persistence.revokedSessions,
      claims: verification.claims,
    };
  } catch {
    return {
      ok: false,
      code: 'oidc_backchannel_persistence_unavailable',
      message: 'Back-channel logout persistence is unavailable.',
    };
  }
}
