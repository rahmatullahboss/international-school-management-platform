import { cloneAndFreeze, sha256 } from './common.js';

function requireHttps(value: string, field: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${field} must use HTTPS`);
}

function base64UrlFromHex(hex: string): string {
  const bytes = Uint8Array.from(hex.match(/.{2}/gu) ?? [], (pair) => Number.parseInt(pair, 16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function audiences(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
  return [];
}

function filterGroups(value: unknown, allowed: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set(allowed);
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && allowedSet.has(entry),
  );
}

export interface OidcSsoConfiguration {
  issuer: string;
  clientId: string;
  authorizationEndpoint: string;
  redirectUri: string;
  scopes: readonly string[];
}

export interface OidcAuthorizationInput {
  state: string;
  nonce: string;
  verifier: string;
  loginHint?: string;
}

export interface OidcAuthorizationRequest {
  url: string;
  codeChallenge: string;
}

export interface OidcIdentity {
  subject: string;
  email: string | null;
  displayName: string | null;
  groups: readonly string[];
}

export class OidcSsoAdapter {
  readonly #configuration: Readonly<OidcSsoConfiguration>;

  constructor(configuration: OidcSsoConfiguration) {
    requireHttps(configuration.issuer, 'OIDC issuer');
    requireHttps(configuration.authorizationEndpoint, 'OIDC authorization endpoint');
    requireHttps(configuration.redirectUri, 'OIDC redirect URI');
    if (!configuration.scopes.includes('openid'))
      throw new Error('OIDC scopes must include openid');
    this.#configuration = cloneAndFreeze({
      ...configuration,
      scopes: [...new Set(configuration.scopes)],
    });
  }

  async createAuthorizationRequest(
    input: OidcAuthorizationInput,
  ): Promise<Readonly<OidcAuthorizationRequest>> {
    if (input.state.length < 8 || input.nonce.length < 8) {
      throw new Error('OIDC state and nonce must be at least 8 characters');
    }
    if (input.verifier.length < 43 || input.verifier.length > 128) {
      throw new Error('OIDC PKCE verifier must be between 43 and 128 characters');
    }
    const challenge = base64UrlFromHex(await sha256(input.verifier));
    const url = new URL(this.#configuration.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.#configuration.clientId);
    url.searchParams.set('redirect_uri', this.#configuration.redirectUri);
    url.searchParams.set('scope', this.#configuration.scopes.join(' '));
    url.searchParams.set('state', input.state);
    url.searchParams.set('nonce', input.nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (input.loginHint) url.searchParams.set('login_hint', input.loginHint);
    return cloneAndFreeze({ url: url.toString(), codeChallenge: challenge });
  }

  validateClaims(
    claims: Readonly<Record<string, unknown>>,
    input: { expectedNonce: string; nowSeconds: number; allowedGroups: readonly string[] },
  ): Readonly<OidcIdentity> {
    if (claims.iss !== this.#configuration.issuer) throw new Error('OIDC issuer does not match');
    if (!audiences(claims.aud).includes(this.#configuration.clientId)) {
      throw new Error('OIDC audience does not match');
    }
    if (claims.nonce !== input.expectedNonce) throw new Error('OIDC nonce does not match');
    if (typeof claims.exp !== 'number' || claims.exp <= input.nowSeconds) {
      throw new Error('OIDC claims are expired');
    }
    if (typeof claims.iat !== 'number' || claims.iat > input.nowSeconds + 60) {
      throw new Error('OIDC issue time is invalid');
    }
    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new Error('OIDC subject is required');
    }
    const email =
      claims.email_verified === true && typeof claims.email === 'string' ? claims.email : null;
    return cloneAndFreeze({
      subject: claims.sub,
      email,
      displayName: typeof claims.name === 'string' ? claims.name : null,
      groups: filterGroups(claims.groups, input.allowedGroups),
    });
  }
}

export interface SamlAssertionInput {
  assertionId: string;
  issuer: string;
  audience: string;
  recipient: string;
  inResponseTo: string;
  subject: string;
  notBefore: number;
  notOnOrAfter: number;
  signatureVerified: boolean;
  attributes: Readonly<Record<string, unknown>>;
}

export interface SamlValidatorConfiguration {
  entityId: string;
  audience: string;
  recipient: string;
  clockSkewSeconds?: number;
}

export interface SamlIdentity {
  subject: string;
  email: string | null;
  displayName: string | null;
  groups: readonly string[];
}

export class SamlAssertionValidator {
  readonly #configuration: Required<SamlValidatorConfiguration>;
  readonly #usedAssertionIds = new Set<string>();

  constructor(configuration: SamlValidatorConfiguration) {
    requireHttps(configuration.entityId, 'SAML entity ID');
    requireHttps(configuration.audience, 'SAML audience');
    requireHttps(configuration.recipient, 'SAML recipient');
    this.#configuration = {
      ...configuration,
      clockSkewSeconds: configuration.clockSkewSeconds ?? 60,
    };
  }

  validate(
    assertion: SamlAssertionInput,
    input: { expectedRequestId: string; nowSeconds: number; allowedGroups: readonly string[] },
  ): Readonly<SamlIdentity> {
    if (!assertion.signatureVerified) throw new Error('SAML assertion signature is not verified');
    if (this.#usedAssertionIds.has(assertion.assertionId)) {
      throw new Error('SAML assertion was already used');
    }
    if (assertion.issuer !== this.#configuration.entityId)
      throw new Error('SAML issuer does not match');
    if (assertion.audience !== this.#configuration.audience) {
      throw new Error('SAML audience does not match');
    }
    if (assertion.recipient !== this.#configuration.recipient) {
      throw new Error('SAML recipient does not match');
    }
    if (assertion.inResponseTo !== input.expectedRequestId) {
      throw new Error('SAML assertion response does not match the login request');
    }
    if (
      input.nowSeconds + this.#configuration.clockSkewSeconds < assertion.notBefore ||
      input.nowSeconds - this.#configuration.clockSkewSeconds >= assertion.notOnOrAfter
    ) {
      throw new Error('SAML assertion is outside its validity window');
    }
    if (assertion.subject.length === 0) throw new Error('SAML subject is required');

    const email =
      typeof assertion.attributes.email === 'string' ? assertion.attributes.email : null;
    const identity = cloneAndFreeze({
      subject: assertion.subject,
      email,
      displayName:
        typeof assertion.attributes.displayName === 'string'
          ? assertion.attributes.displayName
          : null,
      groups: filterGroups(assertion.attributes.groups, input.allowedGroups),
    });
    this.#usedAssertionIds.add(assertion.assertionId);
    return identity;
  }
}
