import type { AssuranceLevel } from './authorization.js';

export interface OidcProviderConfiguration {
  readonly issuer: string;
  readonly clientId: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksUri: string;
  readonly redirectUri: string;
}

export type OidcJsonWebKey = JsonWebKey & {
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
};

export interface OidcJsonWebKeySet {
  readonly keys: readonly OidcJsonWebKey[];
}

export interface OidcIdentity {
  readonly issuer: string;
  readonly subject: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly displayName?: string;
  readonly assurance: AssuranceLevel;
  readonly authenticationTime?: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export type OidcVerificationFailureCode =
  | 'oidc_configuration_invalid'
  | 'oidc_token_malformed'
  | 'oidc_token_algorithm_denied'
  | 'oidc_signing_key_not_found'
  | 'oidc_signature_invalid'
  | 'oidc_claims_invalid'
  | 'oidc_issuer_mismatch'
  | 'oidc_audience_mismatch'
  | 'oidc_nonce_mismatch'
  | 'oidc_token_expired'
  | 'oidc_token_not_yet_valid';

export type OidcVerificationResult =
  | { readonly ok: true; readonly identity: OidcIdentity }
  | {
      readonly ok: false;
      readonly code: OidcVerificationFailureCode;
      readonly message: string;
    };

export interface VerifyOidcIdTokenInput {
  readonly idToken: string;
  readonly nonce: string;
  readonly configuration: OidcProviderConfiguration;
  readonly jwks: OidcJsonWebKeySet;
  readonly now?: number;
  readonly clockSkewSeconds?: number;
}

interface JwtHeader {
  readonly alg: string;
  readonly kid: string;
  readonly typ?: string;
}

interface JwtClaims {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string | readonly string[];
  readonly azp?: string;
  readonly exp: number;
  readonly iat: number;
  readonly nbf?: number;
  readonly nonce: string;
  readonly auth_time?: number;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly acr?: string;
  readonly amr?: readonly string[];
}

const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LIFETIME_SECONDS = 60 * 60;

function failure(code: OidcVerificationFailureCode, message: string): OidcVerificationResult {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function decodeJson(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as unknown;
}

function isAllowedEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return (
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export function validateOidcProviderConfiguration(
  configuration: OidcProviderConfiguration,
): OidcVerificationResult | undefined {
  if (
    configuration.clientId.trim() === '' ||
    !isAllowedEndpoint(configuration.issuer) ||
    !isAllowedEndpoint(configuration.authorizationEndpoint) ||
    !isAllowedEndpoint(configuration.tokenEndpoint) ||
    !isAllowedEndpoint(configuration.jwksUri) ||
    !isAllowedEndpoint(configuration.redirectUri)
  ) {
    return failure(
      'oidc_configuration_invalid',
      'OIDC configuration requires a client id and approved absolute endpoints.',
    );
  }

  const issuer = configuration.issuer.replace(/\/$/u, '');
  if (issuer !== configuration.issuer) {
    return failure(
      'oidc_configuration_invalid',
      'The configured OIDC issuer must not include a trailing slash.',
    );
  }
  return undefined;
}

function parseHeader(value: unknown): JwtHeader | undefined {
  if (!isRecord(value)) return undefined;
  if (value.alg !== 'RS256' || typeof value.kid !== 'string' || value.kid.trim() === '') {
    return undefined;
  }
  if (value.typ !== undefined && value.typ !== 'JWT') return undefined;
  return {
    alg: value.alg,
    kid: value.kid,
    ...(value.typ === 'JWT' ? { typ: value.typ } : {}),
  };
}

function parseClaims(value: unknown): JwtClaims | undefined {
  if (!isRecord(value)) return undefined;
  const audience = value.aud;
  const validAudience =
    typeof audience === 'string' ||
    (Array.isArray(audience) &&
      audience.length > 0 &&
      audience.every((entry) => typeof entry === 'string'));
  if (
    typeof value.iss !== 'string' ||
    typeof value.sub !== 'string' ||
    value.sub.trim() === '' ||
    !validAudience ||
    typeof value.exp !== 'number' ||
    !Number.isInteger(value.exp) ||
    typeof value.iat !== 'number' ||
    !Number.isInteger(value.iat) ||
    typeof value.nonce !== 'string' ||
    value.nonce === ''
  ) {
    return undefined;
  }
  if (value.azp !== undefined && typeof value.azp !== 'string') return undefined;
  if (value.nbf !== undefined && typeof value.nbf !== 'number') return undefined;
  if (value.auth_time !== undefined && typeof value.auth_time !== 'number') return undefined;
  if (value.email !== undefined && typeof value.email !== 'string') return undefined;
  if (value.email_verified !== undefined && typeof value.email_verified !== 'boolean') {
    return undefined;
  }
  if (value.name !== undefined && typeof value.name !== 'string') return undefined;
  if (value.acr !== undefined && typeof value.acr !== 'string') return undefined;
  if (
    value.amr !== undefined &&
    (!Array.isArray(value.amr) || !value.amr.every((entry) => typeof entry === 'string'))
  ) {
    return undefined;
  }
  return value as unknown as JwtClaims;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function resolveAssurance(claims: JwtClaims): AssuranceLevel {
  const methods = new Set((claims.amr ?? []).map((method) => method.toLowerCase()));
  const acr = claims.acr?.toLowerCase() ?? '';
  if (
    acr.includes('aal2') ||
    methods.has('mfa') ||
    methods.has('otp') ||
    methods.has('hwk') ||
    methods.has('webauthn')
  ) {
    return 'aal2';
  }
  return 'aal1';
}

function audienceMatches(claims: JwtClaims, clientId: string): boolean {
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
  if (!audiences.includes(clientId)) return false;
  if (audiences.length > 1) return claims.azp === clientId;
  return claims.azp === undefined || claims.azp === clientId;
}

async function verifySignature(
  header: JwtHeader,
  encodedHeader: string,
  encodedClaims: string,
  encodedSignature: string,
  jwks: OidcJsonWebKeySet,
): Promise<'verified' | 'key-not-found' | 'invalid'> {
  const jwk = jwks.keys.find(
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

export async function verifyOidcIdToken(
  input: VerifyOidcIdTokenInput,
): Promise<OidcVerificationResult> {
  const configurationFailure = validateOidcProviderConfiguration(input.configuration);
  if (configurationFailure !== undefined) return configurationFailure;

  const segments = input.idToken.split('.');
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
    return failure('oidc_token_malformed', 'The OIDC ID token is malformed.');
  }

  let header: JwtHeader | undefined;
  let claims: JwtClaims | undefined;
  try {
    const rawHeader = decodeJson(encodedHeader);
    if (isRecord(rawHeader) && rawHeader.alg !== 'RS256') {
      return failure(
        'oidc_token_algorithm_denied',
        'The OIDC ID token uses a denied signing algorithm.',
      );
    }
    header = parseHeader(rawHeader);
    claims = parseClaims(decodeJson(encodedClaims));
  } catch {
    return failure('oidc_token_malformed', 'The OIDC ID token cannot be decoded.');
  }
  if (header === undefined || claims === undefined) {
    return failure('oidc_claims_invalid', 'The OIDC ID token header or claims are invalid.');
  }

  const signature = await verifySignature(
    header,
    encodedHeader,
    encodedClaims,
    encodedSignature,
    input.jwks,
  );
  if (signature === 'key-not-found') {
    return failure('oidc_signing_key_not_found', 'No approved OIDC signing key matched the token.');
  }
  if (signature !== 'verified') {
    return failure('oidc_signature_invalid', 'The OIDC ID token signature is invalid.');
  }

  if (claims.iss !== input.configuration.issuer) {
    return failure('oidc_issuer_mismatch', 'The OIDC issuer does not match configuration.');
  }
  if (!audienceMatches(claims, input.configuration.clientId)) {
    return failure('oidc_audience_mismatch', 'The OIDC audience is not permitted.');
  }
  if (!constantTimeEqual(claims.nonce, input.nonce)) {
    return failure('oidc_nonce_mismatch', 'The OIDC nonce does not match the login transaction.');
  }

  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  const skew = input.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  if (claims.exp <= nowSeconds - skew) {
    return failure('oidc_token_expired', 'The OIDC ID token has expired.');
  }
  if (
    claims.iat > nowSeconds + skew ||
    (claims.nbf !== undefined && claims.nbf > nowSeconds + skew)
  ) {
    return failure('oidc_token_not_yet_valid', 'The OIDC ID token is not yet valid.');
  }
  if (claims.exp - claims.iat > MAX_TOKEN_LIFETIME_SECONDS) {
    return failure('oidc_claims_invalid', 'The OIDC ID token lifetime exceeds policy.');
  }

  return {
    ok: true,
    identity: {
      issuer: claims.iss,
      subject: claims.sub,
      ...(claims.email === undefined ? {} : { email: claims.email }),
      ...(claims.email_verified === undefined ? {} : { emailVerified: claims.email_verified }),
      ...(claims.name === undefined ? {} : { displayName: claims.name }),
      assurance: resolveAssurance(claims),
      ...(claims.auth_time === undefined ? {} : { authenticationTime: claims.auth_time }),
      issuedAt: claims.iat,
      expiresAt: claims.exp,
    },
  };
}
