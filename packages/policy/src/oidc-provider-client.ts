import type {
  OidcJsonWebKey,
  OidcJsonWebKeySet,
  OidcProviderConfiguration,
} from './oidc.js';
import { validateOidcProviderConfiguration } from './oidc.js';

const MAX_METADATA_BYTES = 128 * 1024;
const MAX_JWKS_BYTES = 256 * 1024;
const MAX_JWKS_KEYS = 20;
const MAX_TOKEN_RESPONSE_BYTES = 256 * 1024;
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/u;

export interface OidcDiscoveredProvider {
  readonly configuration: OidcProviderConfiguration;
  readonly authorizationResponseIssuerParameterSupported: boolean;
}

export type OidcProviderFailureCode =
  | 'oidc_provider_configuration_invalid'
  | 'oidc_provider_network_error'
  | 'oidc_provider_http_error'
  | 'oidc_provider_response_invalid'
  | 'oidc_provider_capability_missing'
  | 'oidc_token_exchange_invalid'
  | 'oidc_token_exchange_rejected';

export type OidcDiscoveryResult =
  | { readonly ok: true; readonly provider: OidcDiscoveredProvider }
  | {
      readonly ok: false;
      readonly code: OidcProviderFailureCode;
      readonly message: string;
    };

export type OidcJwksResult =
  | { readonly ok: true; readonly jwks: OidcJsonWebKeySet }
  | {
      readonly ok: false;
      readonly code: OidcProviderFailureCode;
      readonly message: string;
    };

export interface OidcTokenSet {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly idToken: string;
  readonly refreshToken?: string;
  readonly scope?: string;
}

export type OidcTokenExchangeResult =
  | { readonly ok: true; readonly tokenSet: OidcTokenSet }
  | {
      readonly ok: false;
      readonly code: OidcProviderFailureCode;
      readonly message: string;
    };

export interface ExchangeOidcAuthorizationCodeInput {
  readonly configuration: OidcProviderConfiguration;
  readonly clientSecret: string;
  readonly code: string;
  readonly codeVerifier: string;
  readonly fetcher?: typeof fetch;
}

function failure<T extends OidcDiscoveryResult | OidcJwksResult | OidcTokenExchangeResult>(
  code: OidcProviderFailureCode,
  message: string,
): T {
  return { ok: false, code, message } as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactJsonContentType(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType === 'application/json' || contentType.startsWith('application/json;');
}

async function boundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0 || length > maximumBytes) {
      throw new Error('Response size is outside policy.');
    }
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maximumBytes) throw new Error('Response exceeds policy.');
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}

function openidConfigurationUrl(issuer: string): string {
  return `${issuer}/.well-known/openid-configuration`;
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    return undefined;
  }
  return value;
}

export async function discoverOidcProvider(
  issuer: string,
  clientId: string,
  redirectUri: string,
  fetcher: typeof fetch = fetch,
): Promise<OidcDiscoveryResult> {
  if (issuer.endsWith('/') || clientId.trim() === '') {
    return failure('oidc_provider_configuration_invalid', 'OIDC discovery input is invalid.');
  }
  let response: Response;
  try {
    response = await fetcher(openidConfigurationUrl(issuer), {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    return failure('oidc_provider_network_error', 'OIDC discovery could not be reached.');
  }
  if (!response.ok) {
    return failure('oidc_provider_http_error', 'OIDC discovery returned an error response.');
  }
  if (!exactJsonContentType(response)) {
    return failure('oidc_provider_response_invalid', 'OIDC discovery did not return JSON.');
  }

  let value: unknown;
  try {
    value = await boundedJson(response, MAX_METADATA_BYTES);
  } catch {
    return failure('oidc_provider_response_invalid', 'OIDC discovery response is invalid.');
  }
  if (!isRecord(value)) {
    return failure('oidc_provider_response_invalid', 'OIDC discovery response is invalid.');
  }

  const responseTypes = stringArray(value.response_types_supported);
  const signingAlgorithms = stringArray(value.id_token_signing_alg_values_supported);
  const challengeMethods = stringArray(value.code_challenge_methods_supported);
  if (
    value.issuer !== issuer ||
    typeof value.authorization_endpoint !== 'string' ||
    typeof value.token_endpoint !== 'string' ||
    typeof value.jwks_uri !== 'string' ||
    responseTypes === undefined ||
    signingAlgorithms === undefined ||
    challengeMethods === undefined
  ) {
    return failure('oidc_provider_response_invalid', 'OIDC discovery metadata is incomplete.');
  }
  if (
    !responseTypes.includes('code') ||
    !signingAlgorithms.includes('RS256') ||
    !challengeMethods.includes('S256')
  ) {
    return failure(
      'oidc_provider_capability_missing',
      'OIDC provider does not advertise the required code, RS256 and S256 capabilities.',
    );
  }

  const configuration: OidcProviderConfiguration = {
    issuer,
    clientId,
    authorizationEndpoint: value.authorization_endpoint,
    tokenEndpoint: value.token_endpoint,
    jwksUri: value.jwks_uri,
    redirectUri,
  };
  if (validateOidcProviderConfiguration(configuration) !== undefined) {
    return failure('oidc_provider_configuration_invalid', 'Discovered OIDC endpoints are invalid.');
  }
  return {
    ok: true,
    provider: {
      configuration,
      authorizationResponseIssuerParameterSupported:
        value.authorization_response_iss_parameter_supported === true,
    },
  };
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

export async function fetchOidcJwks(
  configuration: OidcProviderConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<OidcJwksResult> {
  if (validateOidcProviderConfiguration(configuration) !== undefined) {
    return failure('oidc_provider_configuration_invalid', 'OIDC provider configuration is invalid.');
  }
  let response: Response;
  try {
    response = await fetcher(configuration.jwksUri, {
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
    value = await boundedJson(response, MAX_JWKS_BYTES);
  } catch {
    return failure('oidc_provider_response_invalid', 'OIDC signing keys response is invalid.');
  }
  if (!isRecord(value) || !Array.isArray(value.keys) || value.keys.length > MAX_JWKS_KEYS) {
    return failure('oidc_provider_response_invalid', 'OIDC signing keys response is invalid.');
  }
  const keys = value.keys.filter(isAllowedJwk);
  if (keys.length === 0) {
    return failure('oidc_provider_capability_missing', 'No approved RS256 signing key is available.');
  }
  const keyIds = keys.map((key) => key.kid);
  if (new Set(keyIds).size !== keyIds.length) {
    return failure('oidc_provider_response_invalid', 'OIDC signing key ids must be unique.');
  }
  return { ok: true, jwks: { keys } };
}

function formEncodeCredential(value: string): string {
  const parameters = new URLSearchParams({ value });
  return parameters.toString().slice('value='.length);
}

function basicAuthorization(clientId: string, clientSecret: string): string {
  const credential = `${formEncodeCredential(clientId)}:${formEncodeCredential(clientSecret)}`;
  const bytes = new TextEncoder().encode(credential);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

function parseTokenSet(value: unknown): OidcTokenSet | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.access_token !== 'string' ||
    value.access_token === '' ||
    value.token_type !== 'Bearer' ||
    typeof value.expires_in !== 'number' ||
    !Number.isInteger(value.expires_in) ||
    value.expires_in <= 0 ||
    typeof value.id_token !== 'string' ||
    value.id_token === '' ||
    (value.refresh_token !== undefined && typeof value.refresh_token !== 'string') ||
    (value.scope !== undefined && typeof value.scope !== 'string')
  ) {
    return undefined;
  }
  return {
    accessToken: value.access_token,
    tokenType: 'Bearer',
    expiresIn: value.expires_in,
    idToken: value.id_token,
    ...(value.refresh_token === undefined ? {} : { refreshToken: value.refresh_token }),
    ...(value.scope === undefined ? {} : { scope: value.scope }),
  };
}

export async function exchangeOidcAuthorizationCode(
  input: ExchangeOidcAuthorizationCodeInput,
): Promise<OidcTokenExchangeResult> {
  if (
    validateOidcProviderConfiguration(input.configuration) !== undefined ||
    input.clientSecret === '' ||
    input.code === '' ||
    input.code.length > 4096 ||
    !PKCE_VERIFIER_PATTERN.test(input.codeVerifier)
  ) {
    return failure('oidc_token_exchange_invalid', 'OIDC authorization-code exchange input is invalid.');
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.configuration.redirectUri,
    code_verifier: input.codeVerifier,
  });

  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(input.configuration.tokenEndpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: basicAuthorization(
          input.configuration.clientId,
          input.clientSecret,
        ),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    return failure('oidc_provider_network_error', 'OIDC token endpoint could not be reached.');
  }
  if (!exactJsonContentType(response)) {
    return failure('oidc_provider_response_invalid', 'OIDC token endpoint did not return JSON.');
  }

  let value: unknown;
  try {
    value = await boundedJson(response, MAX_TOKEN_RESPONSE_BYTES);
  } catch {
    return failure('oidc_provider_response_invalid', 'OIDC token response is invalid.');
  }
  if (!response.ok) {
    return failure('oidc_token_exchange_rejected', 'OIDC authorization-code exchange was rejected.');
  }
  const tokenSet = parseTokenSet(value);
  if (tokenSet === undefined) {
    return failure('oidc_provider_response_invalid', 'OIDC token response is incomplete.');
  }
  return { ok: true, tokenSet };
}
