import type { OidcProviderConfiguration } from './oidc.js';

export const OAUTH_TRANSACTION_COOKIE_NAME = '__Host-school_oauth';
const TRANSACTION_ISSUER = 'international-school-platform';
const TRANSACTION_AUDIENCE = 'international-school-platform-oauth-callback';
const MINIMUM_SECRET_LENGTH = 32;
const DEFAULT_TRANSACTION_TTL_SECONDS = 5 * 60;
const MAXIMUM_TRANSACTION_TTL_SECONDS = 10 * 60;
const RANDOM_BYTE_LENGTH = 32;
const DEFAULT_STEP_UP_FRESHNESS_SECONDS = 5 * 60;
const MAX_STEP_UP_FRESHNESS_SECONDS = 5 * 60;
const MAX_ACR_VALUES = 5;
const MAX_ACR_VALUE_LENGTH = 256;

export interface OidcStepUpRequest {
  readonly assurance: 'aal2';
  readonly freshnessSeconds?: number;
  readonly acrValues?: readonly string[];
}

export interface OAuthTransactionClaims {
  readonly version: 1;
  readonly issuer: typeof TRANSACTION_ISSUER;
  readonly audience: typeof TRANSACTION_AUDIENCE;
  readonly transactionId: string;
  readonly providerIssuer: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly returnTo: string;
  readonly requireAuthorizationResponseIssuer: boolean;
  readonly requestedAssurance?: 'aal2';
  readonly stepUpFreshnessSeconds?: number;
  readonly acrValues?: readonly string[];
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface IssueOAuthTransactionInput {
  readonly configuration: OidcProviderConfiguration;
  readonly secret: string;
  readonly returnTo?: string;
  readonly requireAuthorizationResponseIssuer?: boolean;
  readonly stepUp?: OidcStepUpRequest;
  readonly now?: number;
  readonly ttlSeconds?: number;
}

export interface OAuthAuthorizationRequest {
  readonly authorizationUrl: string;
  readonly setCookie: string;
  readonly transaction: OAuthTransactionClaims;
  readonly codeChallenge: string;
}

export type OAuthTransactionIssueResult =
  | { readonly ok: true; readonly request: OAuthAuthorizationRequest }
  | {
      readonly ok: false;
      readonly code: 'oauth_transaction_configuration_invalid' | 'oauth_return_path_invalid';
      readonly message: string;
    };

export interface VerifyOAuthCallbackInput {
  readonly secret: string | undefined;
  readonly cookieHeader: string | undefined;
  readonly state: string | undefined;
  readonly authorizationResponseIssuer?: string;
  readonly now?: number;
}

export type OAuthCallbackVerificationResult =
  | { readonly ok: true; readonly transaction: OAuthTransactionClaims }
  | {
      readonly ok: false;
      readonly code:
        | 'oauth_transaction_configuration_invalid'
        | 'oauth_transaction_required'
        | 'oauth_transaction_invalid'
        | 'oauth_transaction_expired'
        | 'oauth_state_mismatch'
        | 'oauth_issuer_mismatch';
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
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomBase64Url(): string {
  const bytes = new Uint8Array(RANDOM_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
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

async function codeChallenge(codeVerifier: string): Promise<string> {
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))),
  );
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

function safeReturnPath(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return '/';
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\u0000') ||
    value.length > 2048
  ) {
    return undefined;
  }
  try {
    const parsed = new URL(value, 'https://school.invalid');
    if (parsed.origin !== 'https://school.invalid') return undefined;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function validAcrValues(values: readonly string[] | undefined): boolean {
  return (
    values === undefined ||
    (values.length > 0 &&
      values.length <= MAX_ACR_VALUES &&
      values.every(
        (value) =>
          value.length > 0 &&
          value.length <= MAX_ACR_VALUE_LENGTH &&
          !/\s/u.test(value) &&
          !hasControlCharacter(value),
      ))
  );
}

function validStepUpRequest(value: OidcStepUpRequest | undefined): boolean {
  if (value === undefined) return true;
  const freshnessSeconds = value.freshnessSeconds ?? DEFAULT_STEP_UP_FRESHNESS_SECONDS;
  return (
    value.assurance === 'aal2' &&
    Number.isInteger(freshnessSeconds) &&
    freshnessSeconds >= 1 &&
    freshnessSeconds <= MAX_STEP_UP_FRESHNESS_SECONDS &&
    validAcrValues(value.acrValues)
  );
}

function transactionCookie(token: string, maxAge: number): string {
  return `${OAUTH_TRANSACTION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearOAuthTransactionCookie(): string {
  return `${OAUTH_TRANSACTION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) return undefined;
  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1) continue;
    if (segment.slice(0, separator).trim() !== OAUTH_TRANSACTION_COOKIE_NAME) continue;
    const value = segment.slice(separator + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseClaims(value: unknown): OAuthTransactionClaims | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.version !== 1 ||
    value.issuer !== TRANSACTION_ISSUER ||
    value.audience !== TRANSACTION_AUDIENCE ||
    typeof value.transactionId !== 'string' ||
    value.transactionId.length < 8 ||
    typeof value.providerIssuer !== 'string' ||
    value.providerIssuer === '' ||
    typeof value.state !== 'string' ||
    value.state.length < 43 ||
    typeof value.nonce !== 'string' ||
    value.nonce.length < 43 ||
    typeof value.codeVerifier !== 'string' ||
    value.codeVerifier.length < 43 ||
    value.codeVerifier.length > 128 ||
    typeof value.returnTo !== 'string' ||
    safeReturnPath(value.returnTo) !== value.returnTo ||
    typeof value.requireAuthorizationResponseIssuer !== 'boolean' ||
    (value.requestedAssurance !== undefined && value.requestedAssurance !== 'aal2') ||
    (value.stepUpFreshnessSeconds !== undefined &&
      (typeof value.stepUpFreshnessSeconds !== 'number' ||
        !Number.isInteger(value.stepUpFreshnessSeconds) ||
        value.stepUpFreshnessSeconds < 1 ||
        value.stepUpFreshnessSeconds > MAX_STEP_UP_FRESHNESS_SECONDS)) ||
    (value.acrValues !== undefined &&
      (!Array.isArray(value.acrValues) ||
        !value.acrValues.every((entry) => typeof entry === 'string') ||
        !validAcrValues(value.acrValues))) ||
    (value.requestedAssurance === undefined) !== (value.stepUpFreshnessSeconds === undefined) ||
    (value.requestedAssurance === undefined && value.acrValues !== undefined) ||
    typeof value.issuedAt !== 'number' ||
    !Number.isInteger(value.issuedAt) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isInteger(value.expiresAt)
  ) {
    return undefined;
  }
  return value as unknown as OAuthTransactionClaims;
}

export async function issueOAuthTransaction(
  input: IssueOAuthTransactionInput,
): Promise<OAuthTransactionIssueResult> {
  const returnTo = safeReturnPath(input.returnTo);
  if (returnTo === undefined) {
    return {
      ok: false,
      code: 'oauth_return_path_invalid',
      message: 'The requested return path is not permitted.',
    };
  }
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_TRANSACTION_TTL_SECONDS;
  if (
    input.secret.length < MINIMUM_SECRET_LENGTH ||
    !validStepUpRequest(input.stepUp) ||
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > MAXIMUM_TRANSACTION_TTL_SECONDS
  ) {
    return {
      ok: false,
      code: 'oauth_transaction_configuration_invalid',
      message: 'The OAuth transaction signing key or lifetime is invalid.',
    };
  }

  const issuedAt = Math.floor((input.now ?? Date.now()) / 1000);
  const verifier = randomBase64Url();
  const challenge = await codeChallenge(verifier);
  const transaction: OAuthTransactionClaims = {
    version: 1,
    issuer: TRANSACTION_ISSUER,
    audience: TRANSACTION_AUDIENCE,
    transactionId: crypto.randomUUID(),
    providerIssuer: input.configuration.issuer,
    state: randomBase64Url(),
    nonce: randomBase64Url(),
    codeVerifier: verifier,
    returnTo,
    requireAuthorizationResponseIssuer: input.requireAuthorizationResponseIssuer ?? false,
    ...(input.stepUp === undefined
      ? {}
      : {
          requestedAssurance: input.stepUp.assurance,
          stepUpFreshnessSeconds:
            input.stepUp.freshnessSeconds ?? DEFAULT_STEP_UP_FRESHNESS_SECONDS,
          ...(input.stepUp.acrValues === undefined
            ? {}
            : { acrValues: [...input.stepUp.acrValues] }),
        }),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  };

  const encodedClaims = encodeBase64Url(JSON.stringify(transaction));
  const key = await importSecret(input.secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedClaims)),
  );
  const token = `${encodedClaims}.${encodeBase64Url(signature)}`;

  const authorizationUrl = new URL(input.configuration.authorizationEndpoint);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', input.configuration.clientId);
  authorizationUrl.searchParams.set('redirect_uri', input.configuration.redirectUri);
  authorizationUrl.searchParams.set('scope', 'openid profile email');
  authorizationUrl.searchParams.set('state', transaction.state);
  authorizationUrl.searchParams.set('nonce', transaction.nonce);
  authorizationUrl.searchParams.set('code_challenge', challenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  if (input.stepUp !== undefined) {
    authorizationUrl.searchParams.set('prompt', 'login');
    authorizationUrl.searchParams.set('max_age', '0');
    if (input.stepUp.acrValues !== undefined) {
      authorizationUrl.searchParams.set('acr_values', input.stepUp.acrValues.join(' '));
    }
  }

  return {
    ok: true,
    request: {
      authorizationUrl: authorizationUrl.toString(),
      setCookie: transactionCookie(token, ttlSeconds),
      transaction,
      codeChallenge: challenge,
    },
  };
}

export async function verifyOAuthCallbackTransaction(
  input: VerifyOAuthCallbackInput,
): Promise<OAuthCallbackVerificationResult> {
  if (input.secret === undefined || input.secret.length < MINIMUM_SECRET_LENGTH) {
    return {
      ok: false,
      code: 'oauth_transaction_configuration_invalid',
      message: 'The OAuth transaction verifier is not configured.',
    };
  }
  const token = readCookie(input.cookieHeader);
  if (token === undefined) {
    return {
      ok: false,
      code: 'oauth_transaction_required',
      message: 'A browser-bound OAuth transaction is required.',
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
      code: 'oauth_transaction_invalid',
      message: 'The OAuth transaction is invalid.',
    };
  }

  try {
    const key = await importSecret(input.secret);
    const signatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedClaims),
    );
    if (!signatureValid) throw new Error('Invalid signature');
    const transaction = parseClaims(
      JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedClaims))) as unknown,
    );
    if (
      transaction === undefined ||
      transaction.issuedAt > Math.floor((input.now ?? Date.now()) / 1000) + 60
    ) {
      throw new Error('Invalid transaction claims');
    }
    if (transaction.expiresAt <= Math.floor((input.now ?? Date.now()) / 1000)) {
      return {
        ok: false,
        code: 'oauth_transaction_expired',
        message: 'The OAuth transaction has expired.',
      };
    }
    if (input.state === undefined || !constantTimeEqual(transaction.state, input.state)) {
      return {
        ok: false,
        code: 'oauth_state_mismatch',
        message: 'The OAuth callback state does not match the browser transaction.',
      };
    }
    if (
      (transaction.requireAuthorizationResponseIssuer &&
        input.authorizationResponseIssuer === undefined) ||
      (input.authorizationResponseIssuer !== undefined &&
        input.authorizationResponseIssuer !== transaction.providerIssuer)
    ) {
      return {
        ok: false,
        code: 'oauth_issuer_mismatch',
        message: 'The OAuth callback issuer does not match the selected provider.',
      };
    }
    return { ok: true, transaction };
  } catch {
    return {
      ok: false,
      code: 'oauth_transaction_invalid',
      message: 'The OAuth transaction is invalid.',
    };
  }
}
