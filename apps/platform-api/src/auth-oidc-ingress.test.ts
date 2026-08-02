import { describe, expect, it } from 'vitest';

import { parseOidcCallbackIngress, parseOidcLoginIngress } from './auth-oidc-ingress.js';

function url(path: string): URL {
  return new URL(`https://api.example.com${path}`);
}

describe('bounded OIDC ingress', () => {
  it('accepts an empty login query and one bounded return target', () => {
    expect(parseOidcLoginIngress(url('/auth/v1/login'))).toEqual({ ok: true, value: {} });
    expect(parseOidcLoginIngress(url('/auth/v1/login?returnTo=%2Fadmin'))).toEqual({
      ok: true,
      value: { returnTo: '/admin' },
    });
  });

  it('rejects duplicate, unknown and oversized login parameters', () => {
    expect(
      parseOidcLoginIngress(url('/auth/v1/login?returnTo=%2Fadmin&returnTo=%2Fstudent')),
    ).toEqual({ ok: false });
    expect(parseOidcLoginIngress(url('/auth/v1/login?redirect=%2Fadmin'))).toEqual({ ok: false });
    expect(
      parseOidcLoginIngress(url(`/auth/v1/login?returnTo=${encodeURIComponent(`/${'a'.repeat(1024)}`)}`)),
    ).toEqual({ ok: false });
  });

  it('accepts bounded OIDC callback parameters and standard ignored metadata', () => {
    expect(
      parseOidcCallbackIngress(
        url(
          '/auth/v1/callback?code=opaque-code&state=opaque-state&iss=https%3A%2F%2Fid.example.com&session_state=s1',
        ),
      ),
    ).toEqual({
      ok: true,
      value: {
        code: 'opaque-code',
        state: 'opaque-state',
        issuer: 'https://id.example.com',
      },
    });
    expect(
      parseOidcCallbackIngress(
        url(
          '/auth/v1/callback?error=access_denied&state=opaque-state&error_description=Denied&error_uri=https%3A%2F%2Fid.example.com%2Ferrors%2Faccess_denied',
        ),
      ),
    ).toEqual({
      ok: true,
      value: { error: 'access_denied', state: 'opaque-state' },
    });
  });

  it('rejects duplicate callback security parameters', () => {
    expect(
      parseOidcCallbackIngress(url('/auth/v1/callback?state=one&state=two&code=opaque')),
    ).toEqual({ ok: false });
    expect(
      parseOidcCallbackIngress(url('/auth/v1/callback?code=one&code=two&state=opaque')),
    ).toEqual({ ok: false });
  });

  it('rejects unknown or oversized callback parameters', () => {
    expect(parseOidcCallbackIngress(url('/auth/v1/callback?foo=bar'))).toEqual({ ok: false });
    expect(
      parseOidcCallbackIngress(url(`/auth/v1/callback?code=${'a'.repeat(4097)}&state=s`)),
    ).toEqual({ ok: false });
    expect(
      parseOidcCallbackIngress(url(`/auth/v1/callback?error=${'e'.repeat(129)}&state=s`)),
    ).toEqual({ ok: false });
  });

  it('rejects excessive callback parameter count and total URL bytes', () => {
    expect(
      parseOidcCallbackIngress(
        url(
          '/auth/v1/callback?code=c&state=s&iss=i&error=e&error_description=d&error_uri=u&session_state=ss&code_verifier=v',
        ),
      ),
    ).toEqual({ ok: false });
    expect(
      parseOidcCallbackIngress(url(`/auth/v1/callback?code=${'a'.repeat(4096)}&state=${'b'.repeat(4096)}`)),
    ).toEqual({ ok: false });
  });
});
