import { describe, expect, it, vi } from 'vitest';

import type { OidcProviderConfiguration } from './oidc.js';
import {
  discoverOidcProvider,
  exchangeOidcAuthorizationCode,
  fetchOidcJwks,
} from './oidc-provider-client.js';

const configuration: OidcProviderConfiguration = {
  issuer: 'https://identity.school.test',
  clientId: 'school-platform-web',
  authorizationEndpoint: 'https://identity.school.test/oauth2/authorize',
  tokenEndpoint: 'https://identity.school.test/oauth2/token',
  jwksUri: 'https://identity.school.test/.well-known/jwks.json',
  redirectUri: 'https://school.test/auth/v1/callback',
};
const verifier = 'A'.repeat(43);

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
}

describe('OIDC provider client', () => {
  it('accepts exact discovery metadata only when code, RS256 and S256 are advertised', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        issuer: configuration.issuer,
        authorization_endpoint: configuration.authorizationEndpoint,
        token_endpoint: configuration.tokenEndpoint,
        jwks_uri: configuration.jwksUri,
        response_types_supported: ['code'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
        authorization_response_iss_parameter_supported: true,
      }),
    );
    const result = await discoverOidcProvider(
      configuration.issuer,
      configuration.clientId,
      configuration.redirectUri,
      fetcher,
    );

    expect(result).toEqual({
      ok: true,
      provider: {
        configuration,
        authorizationResponseIssuerParameterSupported: true,
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      `${configuration.issuer}/.well-known/openid-configuration`,
      expect.objectContaining({ method: 'GET', redirect: 'error', cache: 'no-store' }),
    );
  });

  it('rejects discovery issuer mismatch, capability downgrade and redirects', async () => {
    const issuerMismatch = await discoverOidcProvider(
      configuration.issuer,
      configuration.clientId,
      configuration.redirectUri,
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          issuer: 'https://attacker.test',
          authorization_endpoint: configuration.authorizationEndpoint,
          token_endpoint: configuration.tokenEndpoint,
          jwks_uri: configuration.jwksUri,
          response_types_supported: ['code'],
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
        }),
      ),
    );
    expect(issuerMismatch).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });

    const downgrade = await discoverOidcProvider(
      configuration.issuer,
      configuration.clientId,
      configuration.redirectUri,
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          issuer: configuration.issuer,
          authorization_endpoint: configuration.authorizationEndpoint,
          token_endpoint: configuration.tokenEndpoint,
          jwks_uri: configuration.jwksUri,
          response_types_supported: ['code'],
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['plain'],
        }),
      ),
    );
    expect(downgrade).toMatchObject({ ok: false, code: 'oidc_provider_capability_missing' });

    const redirectingFetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('redirect'));
    expect(
      await discoverOidcProvider(
        configuration.issuer,
        configuration.clientId,
        configuration.redirectUri,
        redirectingFetcher,
      ),
    ).toMatchObject({ ok: false, code: 'oidc_provider_network_error' });
  });

  it('accepts a bounded JWKS with unique approved RSA signing keys', async () => {
    const result = await fetchOidcJwks(
      configuration,
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          keys: [
            {
              kty: 'RSA',
              kid: 'key-1',
              alg: 'RS256',
              use: 'sig',
              n: 'modulus',
              e: 'AQAB',
            },
            { kty: 'EC', kid: 'ignored', crv: 'P-256', x: 'x', y: 'y' },
          ],
        }),
      ),
    );
    expect(result).toEqual({
      ok: true,
      jwks: {
        keys: [
          {
            kty: 'RSA',
            kid: 'key-1',
            alg: 'RS256',
            use: 'sig',
            n: 'modulus',
            e: 'AQAB',
          },
        ],
      },
    });
  });

  it('rejects duplicate key ids, excessive key sets and non-JSON JWKS', async () => {
    const duplicateKey = {
      kty: 'RSA',
      kid: 'key-1',
      alg: 'RS256',
      use: 'sig',
      n: 'modulus',
      e: 'AQAB',
    };
    expect(
      await fetchOidcJwks(
        configuration,
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({ keys: [duplicateKey, duplicateKey] }),
        ),
      ),
    ).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });

    expect(
      await fetchOidcJwks(
        configuration,
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({ keys: Array.from({ length: 21 }, (_, index) => ({ ...duplicateKey, kid: `key-${index}` })) }),
        ),
      ),
    ).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });

    expect(
      await fetchOidcJwks(
        configuration,
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
        ),
      ),
    ).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });
  });

  it('exchanges a code using client_secret_basic and the exact PKCE verifier', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        access_token: 'server-access-token',
        token_type: 'Bearer',
        expires_in: 300,
        id_token: 'signed.id.token',
        refresh_token: 'server-refresh-token',
        scope: 'openid profile email',
      }),
    );
    const result = await exchangeOidcAuthorizationCode({
      configuration,
      clientSecret: 'client secret with spaces',
      code: 'authorization-code',
      codeVerifier: verifier,
      fetcher,
    });

    expect(result).toEqual({
      ok: true,
      tokenSet: {
        accessToken: 'server-access-token',
        tokenType: 'Bearer',
        expiresIn: 300,
        idToken: 'signed.id.token',
        refreshToken: 'server-refresh-token',
        scope: 'openid profile email',
      },
    });
    const call = fetcher.mock.calls[0];
    if (call === undefined) throw new Error('Expected token request.');
    expect(call[0]).toBe(configuration.tokenEndpoint);
    const request = call[1];
    expect(request).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' });
    const headers = new Headers(request?.headers);
    expect(headers.get('authorization')).toMatch(/^Basic /u);
    expect(headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    const body = request?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    const parameters = body as URLSearchParams;
    expect(parameters.get('grant_type')).toBe('authorization_code');
    expect(parameters.get('code')).toBe('authorization-code');
    expect(parameters.get('redirect_uri')).toBe(configuration.redirectUri);
    expect(parameters.get('code_verifier')).toBe(verifier);
    expect(parameters.has('client_secret')).toBe(false);
  });

  it('sanitizes rejected exchanges and denies malformed token responses', async () => {
    const rejected = await exchangeOidcAuthorizationCode({
      configuration,
      clientSecret: 'client-secret',
      code: 'authorization-code',
      codeVerifier: verifier,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          { error: 'invalid_grant', error_description: 'sensitive provider detail' },
          { status: 400 },
        ),
      ),
    });
    expect(rejected).toEqual({
      ok: false,
      code: 'oidc_token_exchange_rejected',
      message: 'OIDC authorization-code exchange was rejected.',
    });

    const malformed = await exchangeOidcAuthorizationCode({
      configuration,
      clientSecret: 'client-secret',
      code: 'authorization-code',
      codeVerifier: verifier,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({ access_token: 'token', token_type: 'bearer', expires_in: 300 }),
      ),
    });
    expect(malformed).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });
  });

  it('rejects weak exchange inputs before contacting the provider', async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(
      await exchangeOidcAuthorizationCode({
        configuration,
        clientSecret: '',
        code: 'authorization-code',
        codeVerifier: verifier,
        fetcher,
      }),
    ).toMatchObject({ ok: false, code: 'oidc_token_exchange_invalid' });
    expect(
      await exchangeOidcAuthorizationCode({
        configuration,
        clientSecret: 'client-secret',
        code: 'authorization-code',
        codeVerifier: 'short',
        fetcher,
      }),
    ).toMatchObject({ ok: false, code: 'oidc_token_exchange_invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
