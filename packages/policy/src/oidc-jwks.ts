import type { OidcJsonWebKey, OidcJsonWebKeySet } from './oidc.js';

const MAX_JWKS_BYTES = 256 * 1024;
const MAX_JWKS_KEYS = 20;

export type OidcJwksFetchResult =
  | { readonly ok: true; readonly jwks: OidcJsonWebKeySet }
  | {
      readonly ok: false;
      readonly code:
        | 'oidc_provider_configuration_invalid'
        | 'oidc_provider_network_error'
        | 'oidc_provider_http_error'
        | 'oidc_provider_response_invalid'
        | 'oidc_provider_capability_missing';
      readonly message: string;
    };

function failure(
  code: Exclude<OidcJwksFetchResult, { readonly ok: true }>['code'],
  message: string,
): OidcJwksFetchResult {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeJwksUri(value: string): boolean {
  try {
    const url = new URL(value);
    const approvedScheme =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
    return approvedScheme && url.username === '' && url.password === '' && url.hash === '';
  } catch {
    return false;
  }
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
    typeof value.e === 'string'
  );
}

function exactJsonContentType(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType === 'application/json' || contentType.startsWith('application/json;');
}

async function boundedJson(response: Response): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0 || length > MAX_JWKS_BYTES) {
      throw new Error('Response size is outside policy.');
    }
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_JWKS_BYTES) throw new Error('Response exceeds policy.');
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}

export async function fetchOidcJwksUri(
  jwksUri: string,
  fetcher: typeof fetch = fetch,
): Promise<OidcJwksFetchResult> {
  if (!isSafeJwksUri(jwksUri)) {
    return failure('oidc_provider_configuration_invalid', 'OIDC signing-key endpoint is invalid.');
  }

  let response: Response;
  try {
    response = await fetcher(jwksUri, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    return failure('oidc_provider_network_error', 'OIDC signing keys could not be reached.');
  }
  if (!response.ok) {
    return failure('oidc_provider_http_error', 'OIDC signing keys returned an error response.');
  }
  if (!exactJsonContentType(response)) {
    return failure('oidc_provider_response_invalid', 'OIDC signing keys did not return JSON.');
  }

  let value: unknown;
  try {
    value = await boundedJson(response);
  } catch {
    return failure('oidc_provider_response_invalid', 'OIDC signing keys response is invalid.');
  }
  if (!isRecord(value) || !Array.isArray(value.keys) || value.keys.length > MAX_JWKS_KEYS) {
    return failure('oidc_provider_response_invalid', 'OIDC signing keys response is invalid.');
  }
  const keys = value.keys.filter(isAllowedJwk);
  if (keys.length === 0) {
    return failure(
      'oidc_provider_capability_missing',
      'No approved RS256 signing key is available.',
    );
  }
  const keyIds = keys.map((key) => key.kid);
  if (new Set(keyIds).size !== keyIds.length) {
    return failure('oidc_provider_response_invalid', 'OIDC signing key ids must be unique.');
  }
  return { ok: true, jwks: { keys } };
}
