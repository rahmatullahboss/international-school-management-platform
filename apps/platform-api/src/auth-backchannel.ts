import type { OidcBackchannelLogoutProcessResult } from '@school/policy';

import { readBoundedUtf8RequestBody } from './bounded-request-body.js';

const MAX_LOGOUT_TOKEN_LENGTH = 16 * 1024;
const MAX_REQUEST_LENGTH = MAX_LOGOUT_TOKEN_LENGTH + 1024;

export type OidcBackchannelProcessor = (
  logoutToken: string,
) => Promise<OidcBackchannelLogoutProcessResult>;

export interface HandleOidcBackchannelLogoutRequestInput {
  readonly configured: boolean;
  readonly contentType: string | undefined;
  readonly contentLength?: string;
  readonly rawBody: string;
  readonly processor: OidcBackchannelProcessor;
}

export type OidcBackchannelHttpResult =
  | { readonly ok: true; readonly status: 200 }
  | {
      readonly ok: false;
      readonly status: 400 | 503;
      readonly code: string;
      readonly message: string;
    };

function invalidRequest(): OidcBackchannelHttpResult {
  return {
    ok: false,
    status: 400,
    code: 'backchannel_logout_request_invalid',
    message: 'The back-channel logout request is invalid.',
  };
}

function isFormContentType(value: string | undefined): boolean {
  if (value === undefined) return false;
  const [mediaType, ...parameters] = value
    .toLowerCase()
    .split(';')
    .map((part) => part.trim());
  if (mediaType !== 'application/x-www-form-urlencoded') return false;
  return parameters.every((parameter) => parameter === '' || parameter === 'charset=utf-8');
}

export function isOidcBackchannelDeclaredLengthAllowed(value: string | undefined): boolean {
  if (value === undefined) return true;
  if (!/^\d+$/u.test(value)) return false;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_REQUEST_LENGTH;
}

export async function readBoundedOidcBackchannelBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<string | undefined> {
  return readBoundedUtf8RequestBody(body, MAX_REQUEST_LENGTH);
}

function parseLogoutToken(rawBody: string): string | undefined {
  if (rawBody.length === 0 || rawBody.length > MAX_REQUEST_LENGTH) return undefined;
  const params = new URLSearchParams(rawBody);
  const keys = [...params.keys()];
  if (keys.length !== 1 || keys[0] !== 'logout_token') return undefined;
  const values = params.getAll('logout_token');
  const token = values[0];
  if (
    values.length !== 1 ||
    token === undefined ||
    token.trim() === '' ||
    token.length > MAX_LOGOUT_TOKEN_LENGTH
  ) {
    return undefined;
  }
  return token;
}

function processingUnavailable(code: string): boolean {
  return (
    code === 'oidc_backchannel_configuration_invalid' ||
    code === 'oidc_backchannel_persistence_unavailable'
  );
}

export async function handleOidcBackchannelLogoutRequest(
  input: HandleOidcBackchannelLogoutRequestInput,
): Promise<OidcBackchannelHttpResult> {
  if (!input.configured) {
    return {
      ok: false,
      status: 503,
      code: 'backchannel_logout_configuration_invalid',
      message: 'Back-channel logout is not configured.',
    };
  }
  if (!isFormContentType(input.contentType)) return invalidRequest();
  if (!isOidcBackchannelDeclaredLengthAllowed(input.contentLength)) {
    return invalidRequest();
  }
  const logoutToken = parseLogoutToken(input.rawBody);
  if (logoutToken === undefined) return invalidRequest();

  let result: OidcBackchannelLogoutProcessResult;
  try {
    result = await input.processor(logoutToken);
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'backchannel_logout_unavailable',
      message: 'Back-channel logout is unavailable.',
    };
  }
  if (result.ok) return { ok: true, status: 200 };
  if (processingUnavailable(result.code)) {
    return {
      ok: false,
      status: 503,
      code: 'backchannel_logout_unavailable',
      message: 'Back-channel logout is unavailable.',
    };
  }
  return {
    ok: false,
    status: 400,
    code: 'backchannel_logout_token_invalid',
    message: 'The Logout Token is invalid.',
  };
}
