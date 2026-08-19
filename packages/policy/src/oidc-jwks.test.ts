import { describe, expect, it, vi } from 'vitest';

import { fetchOidcJwksUri } from './oidc-jwks.js';

const jwk = {
  kty: 'RSA',
  kid: 'key-1',
  alg: 'RS256',
  use: 'sig',
  n: 'modulus',
  e: 'AQAB',
};

describe('OIDC JWKS fetch boundary', () => {
  it('fetches bounded JSON without redirects or cache reuse', async () => {
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      expect(init).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store' });
      return Promise.resolve(
        new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    const result = await fetchOidcJwksUri('https://identity.school.test/jwks', fetcher);
    expect(result).toMatchObject({ ok: true, jwks: { keys: [{ kid: 'key-1' }] } });
  });

  it('rejects insecure remote endpoints and duplicate key ids', async () => {
    const insecure = await fetchOidcJwksUri('http://identity.school.test/jwks', vi.fn());
    expect(insecure).toMatchObject({ ok: false, code: 'oidc_provider_configuration_invalid' });

    const duplicate = await fetchOidcJwksUri(
      'https://identity.school.test/jwks',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify({ keys: [jwk, { ...jwk }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );
    expect(duplicate).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });
  });

  it('rejects oversized or non-json responses', async () => {
    const oversized = await fetchOidcJwksUri(
      'https://identity.school.test/jwks',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response('{}', {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'content-length': String(256 * 1024 + 1),
            },
          }),
        ),
      ),
    );
    expect(oversized).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });

    const nonJson = await fetchOidcJwksUri(
      'https://identity.school.test/jwks',
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 200 }))),
    );
    expect(nonJson).toMatchObject({ ok: false, code: 'oidc_provider_response_invalid' });
  });
});
