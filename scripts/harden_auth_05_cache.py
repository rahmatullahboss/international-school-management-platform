#!/usr/bin/env python3
import sys
from pathlib import Path

MODE = sys.argv[1] if len(sys.argv) == 2 else None
if MODE not in {'test', 'implementation'}:
    raise SystemExit('Usage: harden_auth_05_cache.py test|implementation')

if MODE == 'test':
    tests = Path('packages/policy/src/oidc-provider-cache.test.ts')
    source = tests.read_text(encoding='utf-8')
    marker = """  it('uses stale approved keys only for bounded network failure and rejects poisoned cache entries', async () => {
"""
    if marker not in source:
        raise SystemExit('OIDC cache governance test insertion point was not found.')
    insertion_point = """  });
});

describe('OIDC unknown-kid rotation verification', () => {
"""
    if source.count(insertion_point) != 1:
        raise SystemExit('Expected one OIDC cache governance describe terminator.')
    new_tests = """  });

  it('rejects discovery cache records outside bounded freshness windows', async () => {
    const unboundedStore: OidcProviderCacheStore = {
      read: async () => {
        await Promise.resolve();
        return {
          schemaVersion: 1,
          kind: 'discovery',
          issuer: configuration.issuer,
          clientId: configuration.clientId,
          redirectUri: configuration.redirectUri,
          provider: {
            configuration,
            authorizationResponseIssuerParameterSupported: true,
          },
          fetchedAt: initialNow,
          freshUntil: initialNow + 3_601_000,
          staleUntil: initialNow + 5_401_000,
        };
      },
      write: async () => {
        await Promise.resolve();
      },
    };
    const cache = new OidcProviderCache({
      store: unboundedStore,
      allowedEndpointOrigins: allowedOrigins,
      fetcher: vi.fn<typeof fetch>(),
      now: () => initialNow,
    });

    await expect(
      cache.resolveDiscovery({
        issuer: configuration.issuer,
        clientId: configuration.clientId,
        redirectUri: configuration.redirectUri,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'oidc_cache_entry_invalid' });
  });

  it('rejects future-dated JWKS cache records', async () => {
    const futureStore: OidcProviderCacheStore = {
      read: async () => {
        await Promise.resolve();
        return {
          schemaVersion: 1,
          kind: 'jwks',
          issuer: configuration.issuer,
          jwksUri: configuration.jwksUri,
          activeKeys: [rsaKey('key-1')],
          retiredKeys: [],
          fetchedAt: initialNow + 60_000,
          freshUntil: initialNow + 90_000,
          staleUntil: initialNow + 1_890_000,
        };
      },
      write: async () => {
        await Promise.resolve();
      },
    };
    const cache = new OidcProviderCache({
      store: futureStore,
      allowedEndpointOrigins: allowedOrigins,
      fetcher: vi.fn<typeof fetch>(),
      now: () => initialNow,
    });

    await expect(cache.resolveJwks({ configuration })).resolves.toMatchObject({
      ok: false,
      code: 'oidc_cache_entry_invalid',
    });
  });
});

describe('OIDC unknown-kid rotation verification', () => {
"""
    tests.write_text(source.replace(insertion_point, new_tests), encoding='utf-8')
    raise SystemExit(0)

cache = Path('packages/policy/src/oidc-provider-cache.ts')
source = cache.read_text(encoding='utf-8')
old_valid_times = """function validTimes(value: Record<string, unknown>): boolean {
  return (
    typeof value.fetchedAt === 'number' &&
    Number.isInteger(value.fetchedAt) &&
    typeof value.freshUntil === 'number' &&
    Number.isInteger(value.freshUntil) &&
    typeof value.staleUntil === 'number' &&
    Number.isInteger(value.staleUntil) &&
    value.fetchedAt <= value.freshUntil &&
    value.freshUntil <= value.staleUntil
  );
}
"""
new_valid_times = """function validTimes(value: Record<string, unknown>, now: number): boolean {
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
"""
if source.count(old_valid_times) != 1:
    raise SystemExit('Expected one cache timestamp validator.')
source = source.replace(old_valid_times, new_valid_times)
source = source.replace(
    """function discoveryRecord(
  value: unknown,
  input: ResolveCachedDiscoveryInput,
): DiscoveryCacheRecord | undefined {
""",
    """function discoveryRecord(
  value: unknown,
  input: ResolveCachedDiscoveryInput,
  now: number,
): DiscoveryCacheRecord | undefined {
""",
)
source = source.replace('    !validTimes(value) ||\n', '    !validTimes(value, now) ||\n', 1)
source = source.replace(
    """function jwksRecord(
  value: unknown,
  configuration: OidcProviderConfiguration,
): JwksCacheRecord | undefined {
""",
    """function jwksRecord(
  value: unknown,
  configuration: OidcProviderConfiguration,
  now: number,
): JwksCacheRecord | undefined {
""",
)
source = source.replace('    !validTimes(value) ||\n', '    !validTimes(value, now) ||\n', 1)
old_discovery_read = """    const key = cacheKey(['discovery', input.issuer, input.clientId, input.redirectUri]);
    let cached: DiscoveryCacheRecord | undefined;
    try {
      const raw = await this.#store.read(key);
      if (raw !== undefined) {
        cached = discoveryRecord(raw, input);
"""
new_discovery_read = """    const key = cacheKey(['discovery', input.issuer, input.clientId, input.redirectUri]);
    const now = this.#now();
    let cached: DiscoveryCacheRecord | undefined;
    try {
      const raw = await this.#store.read(key);
      if (raw !== undefined) {
        cached = discoveryRecord(raw, input, now);
"""
if source.count(old_discovery_read) != 1:
    raise SystemExit('Expected one discovery cache read block.')
source = source.replace(old_discovery_read, new_discovery_read)
source = source.replace("\n    const now = this.#now();\n    if (!input.forceRefresh && cached !== undefined && cached.freshUntil > now) {", "\n    if (!input.forceRefresh && cached !== undefined && cached.freshUntil > now) {", 1)
old_jwks_read = """    const key = cacheKey(['jwks', input.configuration.issuer, input.configuration.jwksUri]);
    let cached: JwksCacheRecord | undefined;
    try {
      const raw = await this.#store.read(key);
      if (raw !== undefined) {
        cached = jwksRecord(raw, input.configuration);
"""
new_jwks_read = """    const key = cacheKey(['jwks', input.configuration.issuer, input.configuration.jwksUri]);
    const now = this.#now();
    let cached: JwksCacheRecord | undefined;
    try {
      const raw = await this.#store.read(key);
      if (raw !== undefined) {
        cached = jwksRecord(raw, input.configuration, now);
"""
if source.count(old_jwks_read) != 1:
    raise SystemExit('Expected one JWKS cache read block.')
source = source.replace(old_jwks_read, new_jwks_read)
source = source.replace("\n    const now = this.#now();\n    if (!input.forceRefresh && cached !== undefined && cached.freshUntil > now) {", "\n    if (!input.forceRefresh && cached !== undefined && cached.freshUntil > now) {", 1)
cache.write_text(source, encoding='utf-8')
