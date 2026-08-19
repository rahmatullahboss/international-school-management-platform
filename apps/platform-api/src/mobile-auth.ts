import {
  fetchOidcJwksUri,
  validateOidcBearerConfiguration,
  verifyOidcBearerToken,
  type OidcBearerConfiguration,
  type OidcIdentity,
  type OidcJsonWebKeySet,
} from '@school/policy';

export interface MobileAuthBindings {
  readonly MOBILE_OIDC_ISSUER?: string;
  readonly MOBILE_OIDC_AUDIENCE?: string;
  readonly MOBILE_OIDC_JWKS_URI?: string;
  readonly MOBILE_OIDC_JWKS_ORIGIN?: string;
  readonly MOBILE_OIDC_REQUIRED_SCOPE?: string;
  readonly MOBILE_MEMBERSHIP_SOURCE?: string;
}

export type MobileAuthReadinessRequirement =
  'issuer' | 'audience' | 'jwks-uri' | 'jwks-origin' | 'required-scope' | 'membership-source';

export interface MobileAuthReadiness {
  readonly schemaVersion: 1;
  readonly mode: 'oidc-bearer';
  readonly state: 'disabled' | 'incomplete' | 'ready';
  readonly tokenValidationEnabled: boolean;
  readonly controls: {
    readonly rs256Only: true;
    readonly issuerValidation: true;
    readonly audienceValidation: true;
    readonly exactScopeValidation: true;
    readonly boundedJwks: true;
    readonly jwksOriginPin: true;
    readonly redirectDenied: true;
    readonly boundedJwksCache: true;
    readonly unknownKidSingleRefresh: true;
    readonly databaseMembershipProjection: true;
  };
  readonly missingConfiguration: readonly MobileAuthReadinessRequirement[];
}

interface ResolvedMobileAuthConfiguration {
  readonly bearer: OidcBearerConfiguration;
  readonly jwksUri: string;
  readonly jwksOrigin: string;
}

export type MobileBearerAuthenticationResult =
  | { readonly ok: true; readonly identity: OidcIdentity }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    };

const MAX_AUTHORIZATION_HEADER_LENGTH = 16 * 1024;
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

function configuredValue(
  bindings: MobileAuthBindings,
  name: keyof MobileAuthBindings,
): string | undefined {
  const value = bindings[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function exactHttpsIssuer(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== '' ||
      value.endsWith('/')
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

function exactHttpsOrigin(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      value !== url.origin
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function exactHttpsJwksUri(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.hash !== ''
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function resolveMobileAuthConfiguration(
  bindings: MobileAuthBindings,
): ResolvedMobileAuthConfiguration | undefined {
  const issuer = exactHttpsIssuer(configuredValue(bindings, 'MOBILE_OIDC_ISSUER'));
  const audience = configuredValue(bindings, 'MOBILE_OIDC_AUDIENCE');
  const requiredScope = configuredValue(bindings, 'MOBILE_OIDC_REQUIRED_SCOPE');
  const jwksUri = exactHttpsJwksUri(configuredValue(bindings, 'MOBILE_OIDC_JWKS_URI'));
  const jwksOrigin = exactHttpsOrigin(configuredValue(bindings, 'MOBILE_OIDC_JWKS_ORIGIN'));
  if (
    issuer === undefined ||
    audience === undefined ||
    requiredScope === undefined ||
    jwksUri === undefined ||
    jwksOrigin === undefined ||
    new URL(jwksUri).origin !== jwksOrigin
  ) {
    return undefined;
  }
  const bearer = { issuer, audience, requiredScope };
  if (validateOidcBearerConfiguration(bearer) !== undefined) return undefined;
  return { bearer, jwksUri, jwksOrigin };
}

export function resolveMobileAuthReadiness(bindings: MobileAuthBindings): MobileAuthReadiness {
  const missingConfiguration: MobileAuthReadinessRequirement[] = [];
  const issuer = exactHttpsIssuer(configuredValue(bindings, 'MOBILE_OIDC_ISSUER'));
  const audience = configuredValue(bindings, 'MOBILE_OIDC_AUDIENCE');
  const requiredScope = configuredValue(bindings, 'MOBILE_OIDC_REQUIRED_SCOPE');
  const jwksUri = exactHttpsJwksUri(configuredValue(bindings, 'MOBILE_OIDC_JWKS_URI'));
  const jwksOrigin = exactHttpsOrigin(configuredValue(bindings, 'MOBILE_OIDC_JWKS_ORIGIN'));

  if (issuer === undefined) missingConfiguration.push('issuer');
  if (audience === undefined || /\s/u.test(audience)) missingConfiguration.push('audience');
  if (jwksUri === undefined) missingConfiguration.push('jwks-uri');
  if (
    jwksOrigin === undefined ||
    (jwksUri !== undefined && new URL(jwksUri).origin !== jwksOrigin)
  ) {
    missingConfiguration.push('jwks-origin');
  }
  if (requiredScope === undefined || /\s/u.test(requiredScope))
    missingConfiguration.push('required-scope');
  if (configuredValue(bindings, 'MOBILE_MEMBERSHIP_SOURCE') !== 'database') {
    missingConfiguration.push('membership-source');
  }
  if (
    issuer !== undefined &&
    audience !== undefined &&
    requiredScope !== undefined &&
    validateOidcBearerConfiguration({ issuer, audience, requiredScope }) !== undefined &&
    !missingConfiguration.includes('issuer')
  ) {
    missingConfiguration.push('issuer');
  }
  const uniqueMissing = [...new Set(missingConfiguration)];
  const enabled = uniqueMissing.length === 0;
  return {
    schemaVersion: 1,
    mode: 'oidc-bearer',
    state:
      uniqueMissing.length === 0 ? 'ready' : uniqueMissing.length === 6 ? 'disabled' : 'incomplete',
    tokenValidationEnabled: enabled,
    controls: {
      rs256Only: true,
      issuerValidation: true,
      audienceValidation: true,
      exactScopeValidation: true,
      boundedJwks: true,
      jwksOriginPin: true,
      redirectDenied: true,
      boundedJwksCache: true,
      unknownKidSingleRefresh: true,
      databaseMembershipProjection: true,
    },
    missingConfiguration: uniqueMissing,
  };
}

interface CachedJwks {
  readonly cacheKey: string;
  readonly expiresAt: number;
  readonly jwks: OidcJsonWebKeySet;
}

export class MobileJwksCache {
  #cached: CachedJwks | undefined;

  async resolve(
    configuration: ResolvedMobileAuthConfiguration,
    options: {
      readonly fetcher?: typeof fetch;
      readonly forceRefresh?: boolean;
      readonly now?: number;
    } = {},
  ): Promise<OidcJsonWebKeySet | undefined> {
    const now = options.now ?? Date.now();
    const cacheKey = `${configuration.bearer.issuer}\n${configuration.jwksUri}`;
    if (
      options.forceRefresh !== true &&
      this.#cached !== undefined &&
      this.#cached.cacheKey === cacheKey &&
      this.#cached.expiresAt > now
    ) {
      return this.#cached.jwks;
    }

    const result = await fetchOidcJwksUri(configuration.jwksUri, options.fetcher ?? fetch);
    if (!result.ok) return undefined;
    this.#cached = {
      cacheKey,
      expiresAt: now + JWKS_CACHE_TTL_MS,
      jwks: result.jwks,
    };
    return result.jwks;
  }

  clear(): void {
    this.#cached = undefined;
  }
}

const defaultMobileJwksCache = new MobileJwksCache();

function parseBearerAuthorization(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.length > MAX_AUTHORIZATION_HEADER_LENGTH) {
    return undefined;
  }
  const match = /^Bearer ([^\s,]+)$/iu.exec(value);
  const credential = match?.[1];
  return credential === undefined || credential.length === 0 ? undefined : credential;
}

export async function authenticateMobileBearer(
  bindings: MobileAuthBindings,
  authorization: string | undefined,
  options: {
    readonly cache?: MobileJwksCache;
    readonly fetcher?: typeof fetch;
    readonly now?: number;
  } = {},
): Promise<MobileBearerAuthenticationResult> {
  const configuration = resolveMobileAuthConfiguration(bindings);
  if (
    configuration === undefined ||
    configuredValue(bindings, 'MOBILE_MEMBERSHIP_SOURCE') !== 'database'
  ) {
    return {
      ok: false,
      status: 503,
      code: 'mobile_auth_configuration_unavailable',
      message: 'Mobile authentication is not configured.',
    };
  }

  const credential = parseBearerAuthorization(authorization);
  if (credential === undefined) {
    return {
      ok: false,
      status: 401,
      code: 'mobile_bearer_required',
      message: 'A valid mobile bearer credential is required.',
    };
  }

  const cache = options.cache ?? defaultMobileJwksCache;
  const jwks = await cache.resolve(configuration, {
    ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  if (jwks === undefined) {
    return {
      ok: false,
      status: 503,
      code: 'mobile_identity_provider_unavailable',
      message: 'Mobile identity verification is temporarily unavailable.',
    };
  }

  let verification = await verifyOidcBearerToken({
    bearerToken: credential,
    configuration: configuration.bearer,
    jwks,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  if (!verification.ok && verification.code === 'oidc_signing_key_not_found') {
    const refreshed = await cache.resolve(configuration, {
      ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
      forceRefresh: true,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    if (refreshed === undefined) {
      return {
        ok: false,
        status: 503,
        code: 'mobile_identity_provider_unavailable',
        message: 'Mobile identity verification is temporarily unavailable.',
      };
    }
    verification = await verifyOidcBearerToken({
      bearerToken: credential,
      configuration: configuration.bearer,
      jwks: refreshed,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }

  if (!verification.ok) {
    return {
      ok: false,
      status: 401,
      code: 'mobile_bearer_invalid',
      message: 'The mobile bearer credential is invalid or expired.',
    };
  }
  return { ok: true, identity: verification.identity };
}
