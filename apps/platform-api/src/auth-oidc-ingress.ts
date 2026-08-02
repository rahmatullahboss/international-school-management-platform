export interface OidcLoginIngress {
  readonly returnTo?: string;
}

export interface OidcCallbackIngress {
  readonly code?: string;
  readonly state?: string;
  readonly issuer?: string;
  readonly error?: string;
}

export type OidcIngressResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

type OidcIngressRoute = 'login' | 'callback';

const MAX_AUTH_URL_BYTES = 8192;
const MAX_QUERY_PARAMETERS = 8;
const LOGIN_LIMITS = new Map<string, number>([['returnTo', 1024]]);
const CALLBACK_LIMITS = new Map<string, number>([
  ['code', 4096],
  ['state', 2048],
  ['iss', 2048],
  ['error', 128],
  ['error_description', 1024],
  ['error_uri', 2048],
  ['session_state', 1024],
]);
const encoder = new TextEncoder();

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function parseValues(
  url: URL,
  route: OidcIngressRoute,
): OidcIngressResult<ReadonlyMap<string, string>> {
  if (byteLength(url.href) > MAX_AUTH_URL_BYTES) return { ok: false };

  const limits = route === 'login' ? LOGIN_LIMITS : CALLBACK_LIMITS;
  const values = new Map<string, string>();
  let count = 0;
  for (const [name, value] of url.searchParams) {
    count += 1;
    if (count > MAX_QUERY_PARAMETERS) return { ok: false };
    const limit = limits.get(name);
    if (limit === undefined || values.has(name) || byteLength(value) > limit) {
      return { ok: false };
    }
    values.set(name, value);
  }
  return { ok: true, value: values };
}

function optionalValue(values: ReadonlyMap<string, string>, name: string): string | undefined {
  const value = values.get(name);
  return value === undefined || value === '' ? undefined : value;
}

export function parseOidcLoginIngress(url: URL): OidcIngressResult<OidcLoginIngress> {
  const parsed = parseValues(url, 'login');
  if (!parsed.ok) return parsed;
  const returnTo = optionalValue(parsed.value, 'returnTo');
  return {
    ok: true,
    value: returnTo === undefined ? {} : { returnTo },
  };
}

export function parseOidcCallbackIngress(url: URL): OidcIngressResult<OidcCallbackIngress> {
  const parsed = parseValues(url, 'callback');
  if (!parsed.ok) return parsed;

  const code = optionalValue(parsed.value, 'code');
  const state = optionalValue(parsed.value, 'state');
  const issuer = optionalValue(parsed.value, 'iss');
  const error = optionalValue(parsed.value, 'error');
  return {
    ok: true,
    value: {
      ...(code === undefined ? {} : { code }),
      ...(state === undefined ? {} : { state }),
      ...(issuer === undefined ? {} : { issuer }),
      ...(error === undefined ? {} : { error }),
    },
  };
}
