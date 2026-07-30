#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'packages/policy/src/oidc-backchannel-logout.ts'
TEST = ROOT / 'packages/policy/src/oidc-backchannel-logout.test.ts'
INDEX = ROOT / 'packages/policy/src/index.ts'

STUB = r'''import type { OidcCachedJwksResult } from './oidc-provider-cache.js';
import type { OidcJsonWebKeySet, OidcProviderConfiguration } from './oidc.js';

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
  | 'oidc_backchannel_replay_unavailable'
  | 'oidc_backchannel_revocation_unavailable';

export type OidcBackchannelLogoutVerificationResult =
  | { readonly ok: true; readonly claims: OidcBackchannelLogoutClaims }
  | { readonly ok: false; readonly code: OidcBackchannelLogoutFailureCode; readonly message: string };

export interface VerifyOidcBackchannelLogoutWithRotationInput
  extends Omit<VerifyOidcBackchannelLogoutTokenInput, 'jwks'> {
  readonly resolveJwks: (forceRefresh: boolean) => Promise<OidcCachedJwksResult>;
}

export interface ProcessOidcBackchannelLogoutInput
  extends VerifyOidcBackchannelLogoutWithRotationInput {
  readonly consumeToken: (claims: OidcBackchannelLogoutClaims) => Promise<boolean>;
  readonly revokeSessions: (claims: OidcBackchannelLogoutClaims) => Promise<number>;
}

export type OidcBackchannelLogoutProcessResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly revokedSessions: number;
      readonly claims: OidcBackchannelLogoutClaims;
    }
  | { readonly ok: false; readonly code: OidcBackchannelLogoutFailureCode; readonly message: string };

const notImplemented = (): OidcBackchannelLogoutVerificationResult => ({
  ok: false,
  code: 'oidc_backchannel_claims_invalid',
  message: 'Back-channel logout is not implemented.',
});

export async function verifyOidcBackchannelLogoutToken(
  _input: VerifyOidcBackchannelLogoutTokenInput,
): Promise<OidcBackchannelLogoutVerificationResult> {
  await Promise.resolve();
  return notImplemented();
}

export async function verifyOidcBackchannelLogoutTokenWithRotation(
  _input: VerifyOidcBackchannelLogoutWithRotationInput,
): Promise<OidcBackchannelLogoutVerificationResult> {
  await Promise.resolve();
  return notImplemented();
}

export async function processOidcBackchannelLogout(
  _input: ProcessOidcBackchannelLogoutInput,
): Promise<OidcBackchannelLogoutProcessResult> {
  await Promise.resolve();
  return notImplemented();
}
'''

IMPLEMENTATION = r'''import type { OidcCachedJwksResult } from './oidc-provider-cache.js';
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
  | 'oidc_backchannel_replay_unavailable'
  | 'oidc_backchannel_revocation_unavailable';

export type OidcBackchannelLogoutVerificationResult =
  | { readonly ok: true; readonly claims: OidcBackchannelLogoutClaims }
  | {
      readonly ok: false;
      readonly code: OidcBackchannelLogoutFailureCode;
      readonly message: string;
    };

export interface VerifyOidcBackchannelLogoutWithRotationInput
  extends Omit<VerifyOidcBackchannelLogoutTokenInput, 'jwks'> {
  readonly resolveJwks: (forceRefresh: boolean) => Promise<OidcCachedJwksResult>;
}

export interface ProcessOidcBackchannelLogoutInput
  extends VerifyOidcBackchannelLogoutWithRotationInput {
  readonly consumeToken: (claims: OidcBackchannelLogoutClaims) => Promise<boolean>;
  readonly revokeSessions: (claims: OidcBackchannelLogoutClaims) => Promise<number>;
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
    return failure(
      'oidc_backchannel_token_not_yet_valid',
      'The Logout Token is not yet valid.',
    );
  }
  if (claims.exp - claims.iat > MAX_LOGOUT_TOKEN_LIFETIME_SECONDS) {
    return failure(
      'oidc_backchannel_claims_invalid',
      'The Logout Token lifetime exceeds policy.',
    );
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
    ...(input.clockSkewSeconds === undefined
      ? {}
      : { clockSkewSeconds: input.clockSkewSeconds }),
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
    ...(input.clockSkewSeconds === undefined
      ? {}
      : { clockSkewSeconds: input.clockSkewSeconds }),
  });
}

export async function processOidcBackchannelLogout(
  input: ProcessOidcBackchannelLogoutInput,
): Promise<OidcBackchannelLogoutProcessResult> {
  const verification = await verifyOidcBackchannelLogoutTokenWithRotation(input);
  if (!verification.ok) return verification;

  let consumed: boolean;
  try {
    consumed = await input.consumeToken(verification.claims);
  } catch {
    return {
      ok: false,
      code: 'oidc_backchannel_replay_unavailable',
      message: 'Back-channel logout replay protection is unavailable.',
    };
  }
  if (!consumed) {
    return { ok: true, replayed: true, revokedSessions: 0, claims: verification.claims };
  }

  try {
    const revokedSessions = await input.revokeSessions(verification.claims);
    if (!Number.isInteger(revokedSessions) || revokedSessions < 0) throw new Error('invalid count');
    return {
      ok: true,
      replayed: false,
      revokedSessions,
      claims: verification.claims,
    };
  } catch {
    return {
      ok: false,
      code: 'oidc_backchannel_revocation_unavailable',
      message: 'Back-channel session revocation is unavailable.',
    };
  }
}
'''

TEST_CONTENT = r'''import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { OidcJsonWebKey, OidcProviderConfiguration } from './oidc.js';
import {
  processOidcBackchannelLogout,
  verifyOidcBackchannelLogoutToken,
  verifyOidcBackchannelLogoutTokenWithRotation,
  type OidcBackchannelLogoutClaims,
} from './oidc-backchannel-logout.js';
import type { OidcCachedJwksResult } from './oidc-provider-cache.js';

const configuration: OidcProviderConfiguration = {
  issuer: 'https://identity.school.test',
  clientId: 'school-platform-web',
  authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
  tokenEndpoint: 'https://identity.school.test/oauth2/token',
  jwksUri: 'https://identity.school.test/.well-known/jwks.json',
  redirectUri: 'https://school.test/auth/v1/callback',
};
const now = Date.parse('2026-07-31T00:00:00Z');
const nowSeconds = Math.floor(now / 1000);
const event = 'http://schemas.openid.net/event/backchannel-logout';
let privateKey: CryptoKey;
let publicJwk: OidcJsonWebKey;

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function signToken(
  claimOverrides: Readonly<Record<string, unknown>> = {},
  headerOverrides: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const header = { alg: 'RS256', kid: 'logout-key-1', typ: 'logout+jwt', ...headerOverrides };
  const claims = {
    iss: configuration.issuer,
    sub: 'provider-user-123',
    sid: 'provider-session-abc',
    aud: configuration.clientId,
    iat: nowSeconds - 30,
    exp: nowSeconds + 270,
    jti: 'logout-token-123',
    events: { [event]: {} },
    ...claimOverrides,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedClaims = encodeBase64Url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
  );
  return `${encodedHeader}.${encodedClaims}.${encodeBase64Url(signature)}`;
}

function jwksResult(keys: readonly OidcJsonWebKey[]): OidcCachedJwksResult {
  return {
    ok: true,
    jwks: { keys },
    source: 'cache',
    freshUntil: now + 60_000,
    activeKeyIds: keys.map((key) => key.kid!),
    retiredKeyIds: [],
  };
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
    kid: 'logout-key-1',
    alg: 'RS256',
    use: 'sig',
  };
});

describe('OIDC back-channel Logout Token policy', () => {
  it('verifies a typed signed token containing both provider subject and session id', async () => {
    await expect(
      verifyOidcBackchannelLogoutToken({
        logoutToken: await signToken(),
        configuration,
        jwks: { keys: [publicJwk] },
        now,
      }),
    ).resolves.toEqual({
      ok: true,
      claims: {
        issuer: configuration.issuer,
        subject: 'provider-user-123',
        providerSessionId: 'provider-session-abc',
        tokenId: 'logout-token-123',
        issuedAt: nowSeconds - 30,
        expiresAt: nowSeconds + 270,
      },
    });
  });

  it('requires the logout event, explicit token type, no nonce and a subject or session id', async () => {
    const cases = [
      signToken({ events: {} }),
      signToken({ nonce: 'forbidden' }),
      signToken({ sub: undefined, sid: undefined }),
      signToken({}, { typ: 'JWT' }),
    ];
    for (const token of cases) {
      await expect(
        verifyOidcBackchannelLogoutToken({
          logoutToken: await token,
          configuration,
          jwks: { keys: [publicJwk] },
          now,
        }),
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it('rejects wrong issuer, audience, expiry, future issue time and overlong lifetime', async () => {
    const cases = [
      [signToken({ iss: 'https://attacker.test' }), 'oidc_backchannel_issuer_mismatch'],
      [signToken({ aud: 'different-client' }), 'oidc_backchannel_audience_mismatch'],
      [signToken({ exp: nowSeconds - 61 }), 'oidc_backchannel_token_expired'],
      [
        signToken({ iat: nowSeconds + 61, exp: nowSeconds + 361 }),
        'oidc_backchannel_token_not_yet_valid',
      ],
      [
        signToken({ iat: nowSeconds - 700, exp: nowSeconds + 1 }),
        'oidc_backchannel_claims_invalid',
      ],
      [
        signToken({ iat: nowSeconds - 400, exp: nowSeconds + 100 }),
        'oidc_backchannel_token_too_old',
      ],
    ] as const;
    for (const [token, code] of cases) {
      await expect(
        verifyOidcBackchannelLogoutToken({
          logoutToken: await token,
          configuration,
          jwks: { keys: [publicJwk] },
          now,
        }),
      ).resolves.toMatchObject({ ok: false, code });
    }
  });

  it('forces exactly one signing-key refresh for an unknown kid', async () => {
    const resolver = vi
      .fn<(forceRefresh: boolean) => Promise<OidcCachedJwksResult>>()
      .mockResolvedValueOnce(jwksResult([{ ...publicJwk, kid: 'old-key' }]))
      .mockResolvedValueOnce(jwksResult([publicJwk]));
    await expect(
      verifyOidcBackchannelLogoutTokenWithRotation({
        logoutToken: await signToken(),
        configuration,
        resolveJwks: resolver,
        now,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(resolver).toHaveBeenNthCalledWith(1, false);
    expect(resolver).toHaveBeenNthCalledWith(2, true);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('atomically consumes the jti and revokes exact provider sessions only once', async () => {
    const consumeToken = vi
      .fn<(claims: OidcBackchannelLogoutClaims) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const revokeSessions = vi
      .fn<(claims: OidcBackchannelLogoutClaims) => Promise<number>>()
      .mockResolvedValue(2);
    const input = {
      logoutToken: await signToken(),
      configuration,
      resolveJwks: async () => jwksResult([publicJwk]),
      consumeToken,
      revokeSessions,
      now,
    };

    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      revokedSessions: 2,
    });
    await expect(processOidcBackchannelLogout(input)).resolves.toMatchObject({
      ok: true,
      replayed: true,
      revokedSessions: 0,
    });
    expect(revokeSessions).toHaveBeenCalledOnce();
    expect(consumeToken.mock.calls[0]?.[0]).toMatchObject({
      tokenId: 'logout-token-123',
      subject: 'provider-user-123',
      providerSessionId: 'provider-session-abc',
    });
  });

  it('fails closed when replay or session-revocation storage is unavailable', async () => {
    const base = {
      logoutToken: await signToken(),
      configuration,
      resolveJwks: async () => jwksResult([publicJwk]),
      now,
    };
    await expect(
      processOidcBackchannelLogout({
        ...base,
        consumeToken: async () => {
          throw new Error('database unavailable');
        },
        revokeSessions: async () => 0,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'oidc_backchannel_replay_unavailable' });
    await expect(
      processOidcBackchannelLogout({
        ...base,
        consumeToken: async () => true,
        revokeSessions: async () => {
          throw new Error('database unavailable');
        },
      }),
    ).resolves.toMatchObject({ ok: false, code: 'oidc_backchannel_revocation_unavailable' });
  });
});
'''


def add_tests() -> None:
    SOURCE.write_text(STUB, encoding='utf-8')
    TEST.write_text(TEST_CONTENT, encoding='utf-8')


def apply_implementation() -> None:
    SOURCE.write_text(IMPLEMENTATION, encoding='utf-8')
    index = INDEX.read_text(encoding='utf-8')
    marker = "export type {\n  OidcCachedDiscoveryResult,"
    block = """export type {
  OidcBackchannelLogoutClaims,
  OidcBackchannelLogoutFailureCode,
  OidcBackchannelLogoutProcessResult,
  OidcBackchannelLogoutVerificationResult,
  ProcessOidcBackchannelLogoutInput,
  VerifyOidcBackchannelLogoutTokenInput,
  VerifyOidcBackchannelLogoutWithRotationInput,
} from './oidc-backchannel-logout.js';
export {
  processOidcBackchannelLogout,
  verifyOidcBackchannelLogoutToken,
  verifyOidcBackchannelLogoutTokenWithRotation,
} from './oidc-backchannel-logout.js';
"""
    if block not in index:
        if index.count(marker) != 1:
            raise SystemExit('Policy export marker was not found exactly once.')
        INDEX.write_text(index.replace(marker, block + marker), encoding='utf-8')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'test', 'implementation'}:
        raise SystemExit('usage: implement_auth_07_policy.py test|implementation')
    if sys.argv[1] == 'test':
        add_tests()
    else:
        apply_implementation()


if __name__ == '__main__':
    main()
