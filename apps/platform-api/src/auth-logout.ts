import {
  clearBrowserSessionCookie,
  verifyBrowserSession,
  type BrowserSessionClaims,
} from '@school/policy';

export type LogoutScope = 'current' | 'all';

export interface LogoutRegistry {
  isSessionActive(sessionId: string): Promise<boolean>;
  revokeSession(sessionId: string, reason: string): Promise<boolean>;
  revokeAccountSessions(accountId: string, reason: string): Promise<number>;
}

export interface TerminateBrowserSessionInput {
  readonly sessionSecret: string | undefined;
  readonly registrySource: string | undefined;
  readonly allowedOrigins: string | undefined;
  readonly origin: string | undefined;
  readonly contentType: string | undefined;
  readonly cookieHeader: string | undefined;
  readonly scope: LogoutScope;
  readonly registry?: LogoutRegistry;
}

export type TerminateBrowserSessionResult =
  | {
      readonly ok: true;
      readonly status: 204;
      readonly setCookie: string;
      readonly revokedScope: LogoutScope;
      readonly revokedCount: number;
    }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403 | 503;
      readonly code: string;
      readonly message: string;
      readonly setCookie?: string;
    };

function failure(
  status: 400 | 401 | 403 | 503,
  code: string,
  message: string,
  clearCookie = false,
): TerminateBrowserSessionResult {
  return {
    ok: false,
    status,
    code,
    message,
    ...(clearCookie ? { setCookie: clearBrowserSessionCookie() } : {}),
  };
}

function normalizeConfiguredOrigins(value: string | undefined): readonly string[] | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (values.length === 0 || values.length > 10) return undefined;

  const unique = new Set<string>();
  for (const value of values) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return undefined;
    }
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
    unique.add(url.origin);
  }
  return [...unique];
}

export function isAllowedAuthMutationOrigin(
  allowedOrigins: string | undefined,
  requestOrigin: string | undefined,
): boolean {
  const configured = normalizeConfiguredOrigins(allowedOrigins);
  if (configured === undefined || requestOrigin === undefined) return false;
  return configured.includes(requestOrigin);
}

function isJsonContentType(value: string | undefined): boolean {
  if (value === undefined) return false;
  const [mediaType] = value.toLowerCase().split(';', 1);
  return mediaType?.trim() === 'application/json';
}

async function requireActiveClaims(
  input: TerminateBrowserSessionInput,
): Promise<BrowserSessionClaims | TerminateBrowserSessionResult> {
  const verification = await verifyBrowserSession(input.sessionSecret, input.cookieHeader);
  if (!verification.ok) {
    return failure(
      verification.code === 'browser_session_configuration_invalid' ? 503 : 401,
      verification.code,
      verification.message,
      true,
    );
  }
  if (
    input.registrySource === undefined ||
    input.registrySource.trim() === '' ||
    input.registry === undefined
  ) {
    return failure(
      503,
      'session_registry_unavailable',
      'The browser session registry is unavailable.',
      true,
    );
  }
  try {
    if (!(await input.registry.isSessionActive(verification.claims.sessionId))) {
      return failure(
        401,
        'browser_session_revoked',
        'The browser session is no longer active.',
        true,
      );
    }
  } catch {
    return failure(
      503,
      'session_registry_unavailable',
      'The browser session registry is unavailable.',
      true,
    );
  }
  return verification.claims;
}

export async function terminateBrowserSession(
  input: TerminateBrowserSessionInput,
): Promise<TerminateBrowserSessionResult> {
  const configuredOrigins = normalizeConfiguredOrigins(input.allowedOrigins);
  if (configuredOrigins === undefined) {
    return failure(503, 'logout_configuration_invalid', 'Browser logout is not configured.');
  }
  if (input.origin === undefined || !configuredOrigins.includes(input.origin)) {
    return failure(403, 'logout_origin_denied', 'The requesting origin is not permitted.');
  }
  if (!isJsonContentType(input.contentType)) {
    return failure(400, 'logout_content_type_invalid', 'Logout requires an application/json request.');
  }

  const claims = await requireActiveClaims(input);
  if ('ok' in claims) return claims;

  try {
    if (input.scope === 'current') {
      const revoked = await input.registry!.revokeSession(claims.sessionId, 'user logout');
      return {
        ok: true,
        status: 204,
        setCookie: clearBrowserSessionCookie(),
        revokedScope: 'current',
        revokedCount: revoked ? 1 : 0,
      };
    }
    const revokedCount = await input.registry!.revokeAccountSessions(
      claims.principalId,
      'user logout all sessions',
    );
    return {
      ok: true,
      status: 204,
      setCookie: clearBrowserSessionCookie(),
      revokedScope: 'all',
      revokedCount,
    };
  } catch {
    return failure(
      503,
      'session_registry_unavailable',
      'The browser session registry is unavailable.',
      true,
    );
  }
}
