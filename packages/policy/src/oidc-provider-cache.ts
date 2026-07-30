import {
  discoverOidcProvider,
  fetchOidcJwks,
  type OidcDiscoveredProvider,
  type OidcJwksResult,
  type OidcProviderFailureCode,
} from './oidc-provider-client.js';
import {
  validateOidcProviderConfiguration,
  verifyOidcIdToken,
  type OidcJsonWebKey,
  type OidcJsonWebKeySet,
  type OidcProviderConfiguration,
  type OidcVerificationResult,
  type VerifyOidcIdTokenInput,
} from './oidc.js';

const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_FRESH_SECONDS = 300;
const MIN_FRESH_SECONDS = 30;
const MAX_FRESH_SECONDS = 3600;
const STALE_IF_ERROR_SECONDS = 1800;
const RETIRED_KEY_OVERLAP_SECONDS = 900;
const MAX_CACHED_KEYS = 40;
const MAX_ETAG_LENGTH = 256;

export type OidcProviderCacheSource = 'cache' | 'network' | 'revalidated' | 'stale';

export type OidcProviderCacheFailureCode =
  | OidcProviderFailureCode
  | 'oidc_cache_configuration_invalid'
  | 'oidc_cache_unavailable'
  | 'oidc_cache_entry_invalid'
  | 'oidc_endpoint_origin_denied'
  | 'oidc_provider_endpoint_changed'
  | 'oidc_key_rotation_conflict';

export interface OidcProviderCacheStore {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

export class MemoryOidcProviderCacheStore implements OidcProviderCacheStore {
  readonly #values = new Map<string, unknown>();

  async read(key: string): Promise<unknown> {
    await Promise.resolve();
    return this.#values.get(key);
  }

  async write(key: string, value: unknown): Promise<void> {
    await Promise.resolve();
    this.#values.set(key, value);
  }
}

export interface OidcProviderCacheOptions {
  readonly store: OidcProviderCacheStore;
  readonly allowedEndpointOrigins: readonly string[];
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
}

export interface ResolveCachedDiscoveryInput {
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly forceRefresh?: boolean;
}

export type OidcCachedDiscoveryResult =
  | {
      readonly ok: true;
      readonly provider: OidcDiscoveredProvider;
      readonly source: OidcProviderCacheSource;
      readonly freshUntil: number;
    }
  | {
      readonly ok: false;
      readonly code: OidcProviderCacheFailureCode;
      readonly message: string;
    };

export interface ResolveCachedJwksInput {
  readonly configuration: OidcProviderConfiguration;
  readonly forceRefresh?: boolean;
}

export type OidcCachedJwksResult =
  | {
      readonly ok: true;
      readonly jwks: OidcJsonWebKeySet;
      readonly source: OidcProviderCacheSource;
      readonly freshUntil: number;
      readonly activeKeyIds: readonly string[];
      readonly retiredKeyIds: readonly string[];
    }
  | {
      readonly ok: false;
      readonly code: OidcProviderCacheFailureCode;
      readonly message: string;
    };

interface DiscoveryCacheRecord {
  readonly schemaVersion: 1;
  readonly kind: 'discovery';
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly provider: OidcDiscoveredProvider;
  readonly fetchedAt: number;
  readonly freshUntil: number;
  readonly staleUntil: number;
  readonly etag?: string | undefined;
}

interface RetiredKeyRecord {
  readonly key: OidcJsonWebKey;
  readonly retireAt: number;
}

interface JwksCacheRecord {
  readonly schemaVersion: 1;
  readonly kind: 'jwks';
  readonly issuer: string;
  readonly jwksUri: string;
  readonly activeKeys: readonly OidcJsonWebKey[];
  readonly retiredKeys: readonly RetiredKeyRecord[];
  readonly fetchedAt: number;
  readonly freshUntil: number;
  readonly staleUntil: number;
  readonly etag?: string | undefined;
}

function failure<T extends OidcCachedDiscoveryResult | OidcCachedJwksResult>(
  code: OidcProviderCacheFailureCode,
  message: string,
): T {
  return { ok: false, code, message } as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedJwk(value: unknown): value is OidcJsonWebKey {
  if (!isRecord(value)) return false;
  return (
    value.kty === 'RSA' &&
    typeof value.kid === 'string' &&
    value.kid.trim() !== '' &&
    (value.alg === undefined || value.alg === 'RS256') &&
    (value.use === undefined || value.use === 'sig') &&
    typeof value.n === 'string' &&
    value.n !== '' &&
    typeof value.e === 'string' &&
    value.e !== ''
  );
}

function isValidEtag(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ETAG_LENGTH &&
    !value.includes('\r') &&
    !value.includes('\n')
  );
}

function validTimes(value: Record<string, unknown>, now: number): boolean {
  const fetchedAt = value.fetchedAt;
  const freshUntil = value.freshUntil;
  const staleUntil = value.staleUntil;
  if (
    typeof fetchedAt !== 'number' ||
    !Number.isInteger(fetchedAt) ||
    typeof freshUntil !== 'number' ||
    !Number.isInteger(freshUntil) ||
    typeof staleUntil !== 'number' ||
    !Number.isInteger(staleUntil)
  ) {
    return false;
  }
  const freshDuration = freshUntil - fetchedAt;
  const staleDuration = staleUntil - freshUntil;
  return (
    fetchedAt <= now &&
    freshDuration >= MIN_FRESH_SECONDS * 1000 &&
    freshDuration <= MAX_FRESH_SECONDS * 1000 &&
    staleDuration === STALE_IF_ERROR_SECONDS * 1000
  );
}

function providerMatches(
  value: unknown,
  issuer: string,
  clientId: string,
  redirectUri: string,
): value is OidcDiscoveredProvider {
  if (!isRecord(value) || !isRecord(value.configuration)) return false;
  const configuration = value.configuration as unknown as OidcProviderConfiguration;
  return (
    (value.authorizationResponseIssuerParameterSupported === true ||
      value.authorizationResponseIssuerParameterSupported === false) &&
    configuration.issuer === issuer &&
    configuration.clientId === clientId &&
    configuration.redirectUri === redirectUri &&
    validateOidcProviderConfiguration(configuration) === undefined
  );
}

function discoveryRecord(
  value: unknown,
  input: ResolveCachedDiscoveryInput,
  now: number,
): DiscoveryCacheRecord | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.schemaVersion !== CACHE_SCHEMA_VERSION ||
    value.kind !== 'discovery' ||
    value.issuer !== input.issuer ||
    value.clientId !== input.clientId ||
    value.redirectUri !== input.redirectUri ||
    !providerMatches(value.provider, input.issuer, input.clientId, input.redirectUri) ||
    !validTimes(value, now) ||
    (value.etag !== undefined && !isValidEtag(value.etag))
  ) {
    return undefined;
  }
  return value as unknown as DiscoveryCacheRecord;
}

function jwksRecord(
  value: unknown,
  configuration: OidcProviderConfiguration,
  now: number,
): JwksCacheRecord | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.schemaVersion !== CACHE_SCHEMA_VERSION ||
    value.kind !== 'jwks' ||
    value.issuer !== configuration.issuer ||
    value.jwksUri !== configuration.jwksUri ||
    !Array.isArray(value.activeKeys) ||
    !value.activeKeys.every(isAllowedJwk) ||
    !Array.isArray(value.retiredKeys) ||
    !value.retiredKeys.every(
      (entry) =>
        isRecord(entry) &&
        isAllowedJwk(entry.key) &&
        typeof entry.retireAt === 'number' &&
        Number.isInteger(entry.retireAt),
    ) ||
    !validTimes(value, now) ||
    (value.etag !== undefined && !isValidEtag(value.etag))
  ) {
    return undefined;
  }
  const activeIds = value.activeKeys.map((key) => key.kid);
  const retiredIds = value.retiredKeys.map((entry) => (entry as RetiredKeyRecord).key.kid);
  if (
    new Set(activeIds).size !== activeIds.length ||
    new Set(retiredIds).size !== retiredIds.length ||
    activeIds.some((id) => retiredIds.includes(id)) ||
    activeIds.length + retiredIds.length > MAX_CACHED_KEYS
  ) {
    return undefined;
  }
  return value as unknown as JwksCacheRecord;
}

function exactOrigin(value: string): string | undefined {
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

function normalizeOrigins(values: readonly string[]): readonly string[] | undefined {
  if (values.length === 0 || values.length > 10) return undefined;
  const normalized = values.map(exactOrigin);
  if (normalized.some((value) => value === undefined)) return undefined;
  return [...new Set(normalized as readonly string[])];
}

function providerOriginsAllowed(
  provider: OidcDiscoveredProvider,
  allowedOrigins: readonly string[],
): boolean {
  const providerEndpoints = [
    provider.configuration.issuer,
    provider.configuration.authorizationEndpoint,
    provider.configuration.tokenEndpoint,
    provider.configuration.jwksUri,
  ];
  return providerEndpoints.every((endpoint) => {
    try {
      return allowedOrigins.includes(new URL(endpoint).origin);
    } catch {
      return false;
    }
  });
}

function sameProvider(left: OidcDiscoveredProvider, right: OidcDiscoveredProvider): boolean {
  return (
    left.authorizationResponseIssuerParameterSupported ===
      right.authorizationResponseIssuerParameterSupported &&
    left.configuration.issuer === right.configuration.issuer &&
    left.configuration.clientId === right.configuration.clientId &&
    left.configuration.authorizationEndpoint === right.configuration.authorizationEndpoint &&
    left.configuration.tokenEndpoint === right.configuration.tokenEndpoint &&
    left.configuration.jwksUri === right.configuration.jwksUri &&
    left.configuration.redirectUri === right.configuration.redirectUri
  );
}

function cacheSeconds(response: Response): number {
  const cacheControl = response.headers.get('cache-control')?.toLowerCase() ?? '';
  const directives = cacheControl.split(',').map((directive) => directive.trim());
  for (const directive of directives) {
    const match = /^max-age=(\d+)$/u.exec(directive);
    if (match?.[1] !== undefined) {
      const parsed = Number(match[1]);
      if (Number.isSafeInteger(parsed)) {
        return Math.max(MIN_FRESH_SECONDS, Math.min(MAX_FRESH_SECONDS, parsed));
      }
    }
  }
  return DEFAULT_FRESH_SECONDS;
}

function responseEtag(response: Response): string | undefined {
  const etag = response.headers.get('etag');
  return isValidEtag(etag) ? etag : undefined;
}

function freshness(
  now: number,
  response: Response,
): {
  readonly fetchedAt: number;
  readonly freshUntil: number;
  readonly staleUntil: number;
} {
  const freshUntil = now + cacheSeconds(response) * 1000;
  return {
    fetchedAt: now,
    freshUntil,
    staleUntil: freshUntil + STALE_IF_ERROR_SECONDS * 1000,
  };
}

function conditionalHeaders(etag: string | undefined, forceRefresh: boolean): HeadersInit {
  return {
    accept: 'application/json',
    ...(etag === undefined || forceRefresh ? {} : { 'if-none-match': etag }),
  };
}

function cacheKey(parts: readonly string[]): string {
  return `oidc-cache:v1:${parts.map((part) => encodeURIComponent(part)).join(':')}`;
}

function keyMaterial(key: OidcJsonWebKey): string {
  return JSON.stringify({
    kty: key.kty,
    kid: key.kid,
    alg: key.alg ?? 'RS256',
    use: key.use ?? 'sig',
    n: key.n,
    e: key.e,
  });
}

function combinedJwks(record: JwksCacheRecord, now: number): OidcJsonWebKeySet {
  const retired = record.retiredKeys
    .filter((entry) => entry.retireAt > now)
    .map((entry) => entry.key);
  return { keys: [...record.activeKeys, ...retired] };
}

function providerFailureCanUseStale(code: OidcProviderFailureCode): boolean {
  return code === 'oidc_provider_network_error' || code === 'oidc_provider_http_error';
}

export class OidcProviderCache {
  readonly #store: OidcProviderCacheStore;
  readonly #allowedOrigins: readonly string[] | undefined;
  readonly #fetcher: typeof fetch;
  readonly #now: () => number;
  readonly #discoveryFlights = new Map<string, Promise<OidcCachedDiscoveryResult>>();
  readonly #jwksFlights = new Map<string, Promise<OidcCachedJwksResult>>();

  constructor(options: OidcProviderCacheOptions) {
    this.#store = options.store;
    this.#allowedOrigins = normalizeOrigins(options.allowedEndpointOrigins);
    this.#fetcher = options.fetcher ?? fetch;
    this.#now = options.now ?? Date.now;
  }

  async resolveDiscovery(input: ResolveCachedDiscoveryInput): Promise<OidcCachedDiscoveryResult> {
    if (
      this.#allowedOrigins === undefined ||
      input.issuer.endsWith('/') ||
      input.clientId.trim() === ''
    ) {
      return failure(
        'oidc_cache_configuration_invalid',
        'OIDC provider cache configuration is invalid.',
      );
    }
    const key = cacheKey(['discovery', input.issuer, input.clientId, input.redirectUri]);
    const now = this.#now();
    let cached: DiscoveryCacheRecord | undefined;
    try {
      const raw = await this.#store.read(key);
      if (raw !== undefined) {
        cached = discoveryRecord(raw, input, now);
        if (cached === undefined) {
          return failure('oidc_cache_entry_invalid', 'Cached OIDC discovery metadata is invalid.');
        }
      }
    } catch {
      return failure('oidc_cache_unavailable', 'The OIDC provider cache is unavailable.');
    }

    if (!input.forceRefresh && cached !== undefined && cached.freshUntil > now) {
      if (!providerOriginsAllowed(cached.provider, this.#allowedOrigins)) {
        return failure(
          'oidc_endpoint_origin_denied',
          'OIDC provider endpoint origin is not approved.',
        );
      }
      return {
        ok: true,
        provider: cached.provider,
        source: 'cache',
        freshUntil: cached.freshUntil,
      };
    }

    const existingFlight = this.#discoveryFlights.get(key);
    if (existingFlight !== undefined) return existingFlight;
    const flight = this.#refreshDiscovery(key, input, cached, now);
    this.#discoveryFlights.set(key, flight);
    try {
      return await flight;
    } finally {
      this.#discoveryFlights.delete(key);
    }
  }

  async #refreshDiscovery(
    key: string,
    input: ResolveCachedDiscoveryInput,
    cached: DiscoveryCacheRecord | undefined,
    now: number,
  ): Promise<OidcCachedDiscoveryResult> {
    let response: Response;
    try {
      response = await this.#fetcher(`${input.issuer}/.well-known/openid-configuration`, {
        method: 'GET',
        headers: conditionalHeaders(cached?.etag, input.forceRefresh === true),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      if (cached !== undefined && cached.staleUntil > now && input.forceRefresh !== true) {
        return {
          ok: true,
          provider: cached.provider,
          source: 'stale',
          freshUntil: cached.freshUntil,
        };
      }
      return failure('oidc_provider_network_error', 'OIDC discovery could not be reached.');
    }

    if (response.status === 304 && cached !== undefined) {
      const times = freshness(now, response);
      const updated: DiscoveryCacheRecord = {
        ...cached,
        ...times,
        ...((responseEtag(response) ?? cached.etag) === undefined
          ? {}
          : { etag: responseEtag(response) ?? cached.etag }),
      };
      try {
        await this.#store.write(key, updated);
      } catch {
        return failure('oidc_cache_unavailable', 'The OIDC provider cache is unavailable.');
      }
      return {
        ok: true,
        provider: updated.provider,
        source: 'revalidated',
        freshUntil: updated.freshUntil,
      };
    }

    const parsed = await discoverOidcProvider(
      input.issuer,
      input.clientId,
      input.redirectUri,
      async () => {
        await Promise.resolve();
        return response;
      },
    );
    if (!parsed.ok) {
      if (
        cached !== undefined &&
        cached.staleUntil > now &&
        input.forceRefresh !== true &&
        providerFailureCanUseStale(parsed.code)
      ) {
        return {
          ok: true,
          provider: cached.provider,
          source: 'stale',
          freshUntil: cached.freshUntil,
        };
      }
      return parsed;
    }
    if (!providerOriginsAllowed(parsed.provider, this.#allowedOrigins!)) {
      return failure(
        'oidc_endpoint_origin_denied',
        'OIDC provider endpoint origin is not approved.',
      );
    }
    if (cached !== undefined && !sameProvider(cached.provider, parsed.provider)) {
      return failure(
        'oidc_provider_endpoint_changed',
        'OIDC provider endpoints changed outside the reviewed configuration.',
      );
    }

    const times = freshness(now, response);
    const record: DiscoveryCacheRecord = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      kind: 'discovery',
      issuer: input.issuer,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      provider: parsed.provider,
      ...times,
      ...(responseEtag(response) === undefined ? {} : { etag: responseEtag(response) }),
    };
    try {
      await this.#store.write(key, record);
    } catch {
      return failure('oidc_cache_unavailable', 'The OIDC provider cache is unavailable.');
    }
    return {
      ok: true,
      provider: record.provider,
      source: 'network',
      freshUntil: record.freshUntil,
    };
  }

  async resolveJwks(input: ResolveCachedJwksInput): Promise<OidcCachedJwksResult> {
    if (
      this.#allowedOrigins === undefined ||
      validateOidcProviderConfiguration(input.configuration) !== undefined ||
      !this.#allowedOrigins.includes(new URL(input.configuration.jwksUri).origin)
    ) {
      return failure(
        'oidc_cache_configuration_invalid',
        'OIDC signing-key cache configuration is invalid.',
      );
    }
    const key = cacheKey(['jwks', input.configuration.issuer, input.configuration.jwksUri]);
    const now = this.#now();
    let cached: JwksCacheRecord | undefined;
    try {
      const raw = await this.#store.read(key);
      if (raw !== undefined) {
        cached = jwksRecord(raw, input.configuration, now);
        if (cached === undefined) {
          return failure('oidc_cache_entry_invalid', 'Cached OIDC signing keys are invalid.');
        }
      }
    } catch {
      return failure('oidc_cache_unavailable', 'The OIDC provider cache is unavailable.');
    }

    if (!input.forceRefresh && cached !== undefined && cached.freshUntil > now) {
      const jwks = combinedJwks(cached, now);
      return {
        ok: true,
        jwks,
        source: 'cache',
        freshUntil: cached.freshUntil,
        activeKeyIds: cached.activeKeys.map((key) => key.kid!),
        retiredKeyIds: jwks.keys.slice(cached.activeKeys.length).map((key) => key.kid!),
      };
    }

    const existingFlight = this.#jwksFlights.get(key);
    if (existingFlight !== undefined) return existingFlight;
    const flight = this.#refreshJwks(key, input, cached, now);
    this.#jwksFlights.set(key, flight);
    try {
      return await flight;
    } finally {
      this.#jwksFlights.delete(key);
    }
  }

  async #refreshJwks(
    key: string,
    input: ResolveCachedJwksInput,
    cached: JwksCacheRecord | undefined,
    now: number,
  ): Promise<OidcCachedJwksResult> {
    let response: Response;
    try {
      response = await this.#fetcher(input.configuration.jwksUri, {
        method: 'GET',
        headers: conditionalHeaders(cached?.etag, input.forceRefresh === true),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      if (cached !== undefined && cached.staleUntil > now && input.forceRefresh !== true) {
        const jwks = combinedJwks(cached, now);
        return {
          ok: true,
          jwks,
          source: 'stale',
          freshUntil: cached.freshUntil,
          activeKeyIds: cached.activeKeys.map((key) => key.kid!),
          retiredKeyIds: jwks.keys.slice(cached.activeKeys.length).map((key) => key.kid!),
        };
      }
      return failure('oidc_provider_network_error', 'OIDC signing keys could not be reached.');
    }

    if (response.status === 304 && cached !== undefined) {
      const times = freshness(now, response);
      const nextEtag = responseEtag(response) ?? cached.etag;
      const updated: JwksCacheRecord = {
        ...cached,
        ...times,
        ...(nextEtag === undefined ? {} : { etag: nextEtag }),
      };
      try {
        await this.#store.write(key, updated);
      } catch {
        return failure('oidc_cache_unavailable', 'The OIDC provider cache is unavailable.');
      }
      const jwks = combinedJwks(updated, now);
      return {
        ok: true,
        jwks,
        source: 'revalidated',
        freshUntil: updated.freshUntil,
        activeKeyIds: updated.activeKeys.map((key) => key.kid!),
        retiredKeyIds: jwks.keys.slice(updated.activeKeys.length).map((key) => key.kid!),
      };
    }

    const parsed: OidcJwksResult = await fetchOidcJwks(input.configuration, async () => {
      await Promise.resolve();
      return response;
    });
    if (!parsed.ok) {
      if (
        cached !== undefined &&
        cached.staleUntil > now &&
        input.forceRefresh !== true &&
        providerFailureCanUseStale(parsed.code)
      ) {
        const jwks = combinedJwks(cached, now);
        return {
          ok: true,
          jwks,
          source: 'stale',
          freshUntil: cached.freshUntil,
          activeKeyIds: cached.activeKeys.map((key) => key.kid!),
          retiredKeyIds: jwks.keys.slice(cached.activeKeys.length).map((key) => key.kid!),
        };
      }
      return parsed;
    }

    const priorById = new Map<string, OidcJsonWebKey>();
    for (const oldKey of cached?.activeKeys ?? []) priorById.set(oldKey.kid!, oldKey);
    for (const oldKey of cached?.retiredKeys ?? []) priorById.set(oldKey.key.kid!, oldKey.key);
    for (const newKey of parsed.jwks.keys) {
      const prior = priorById.get(newKey.kid!);
      if (prior !== undefined && keyMaterial(prior) !== keyMaterial(newKey)) {
        return failure(
          'oidc_key_rotation_conflict',
          'An OIDC signing key id was reused with different key material.',
        );
      }
    }

    const newIds = new Set(parsed.jwks.keys.map((key) => key.kid!));
    const retiredById = new Map<string, RetiredKeyRecord>();
    for (const oldRetired of cached?.retiredKeys ?? []) {
      if (oldRetired.retireAt > now && !newIds.has(oldRetired.key.kid!)) {
        retiredById.set(oldRetired.key.kid!, oldRetired);
      }
    }
    for (const oldActive of cached?.activeKeys ?? []) {
      if (!newIds.has(oldActive.kid!)) {
        retiredById.set(oldActive.kid!, {
          key: oldActive,
          retireAt: now + RETIRED_KEY_OVERLAP_SECONDS * 1000,
        });
      }
    }
    const retiredKeys = [...retiredById.values()];
    if (parsed.jwks.keys.length + retiredKeys.length > MAX_CACHED_KEYS) {
      return failure('oidc_provider_response_invalid', 'OIDC signing-key rotation exceeds policy.');
    }

    const times = freshness(now, response);
    const record: JwksCacheRecord = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      kind: 'jwks',
      issuer: input.configuration.issuer,
      jwksUri: input.configuration.jwksUri,
      activeKeys: parsed.jwks.keys,
      retiredKeys,
      ...times,
      ...(responseEtag(response) === undefined ? {} : { etag: responseEtag(response) }),
    };
    try {
      await this.#store.write(key, record);
    } catch {
      return failure('oidc_cache_unavailable', 'The OIDC provider cache is unavailable.');
    }
    const jwks = combinedJwks(record, now);
    return {
      ok: true,
      jwks,
      source: 'network',
      freshUntil: record.freshUntil,
      activeKeyIds: record.activeKeys.map((key) => key.kid!),
      retiredKeyIds: retiredKeys.map((entry) => entry.key.kid!),
    };
  }
}

export interface VerifyOidcIdTokenWithRotationInput extends Omit<VerifyOidcIdTokenInput, 'jwks'> {
  readonly resolveJwks: (forceRefresh: boolean) => Promise<OidcCachedJwksResult>;
}

export async function verifyOidcIdTokenWithRotation(
  input: VerifyOidcIdTokenWithRotationInput,
): Promise<OidcVerificationResult | OidcCachedJwksResult> {
  const initialKeys = await input.resolveJwks(false);
  if (!initialKeys.ok) return initialKeys;
  const initialVerification = await verifyOidcIdToken({
    idToken: input.idToken,
    nonce: input.nonce,
    configuration: input.configuration,
    jwks: initialKeys.jwks,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.clockSkewSeconds === undefined ? {} : { clockSkewSeconds: input.clockSkewSeconds }),
  });
  if (initialVerification.ok || initialVerification.code !== 'oidc_signing_key_not_found') {
    return initialVerification;
  }

  const refreshedKeys = await input.resolveJwks(true);
  if (!refreshedKeys.ok) return refreshedKeys;
  return verifyOidcIdToken({
    idToken: input.idToken,
    nonce: input.nonce,
    configuration: input.configuration,
    jwks: refreshedKeys.jwks,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.clockSkewSeconds === undefined ? {} : { clockSkewSeconds: input.clockSkewSeconds }),
  });
}
