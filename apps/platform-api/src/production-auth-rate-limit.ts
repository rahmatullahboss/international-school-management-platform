interface RateLimitBinding {
  limit(input: { readonly key: string }): Promise<{ readonly success: boolean }>;
}

export interface ProductionAuthRateLimitBindings {
  readonly APP_ENV: string;
  readonly AUTH_PRELOGIN_RATE_LIMITER?: RateLimitBinding;
}

const PROTECTED_PATHS = new Map<string, string>([
  ['/auth/v1/login', 'login'],
  ['/auth/v1/callback', 'callback'],
]);
const RETRY_AFTER_SECONDS = 60;
const CLIENT_IP_PATTERN = /^[0-9a-f:.]{3,64}$/iu;

function jsonError(code: string, message: string, status: number, retryAfter?: number): Response {
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  if (retryAfter !== undefined) headers.set('retry-after', String(retryAfter));
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers });
}

function trustedClientIp(request: Request): string | undefined {
  const value = request.headers.get('cf-connecting-ip')?.trim().toLowerCase();
  if (value === undefined || !CLIENT_IP_PATTERN.test(value)) return undefined;
  return value;
}

async function opaqueClientKey(routeKey: string, clientIp: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${routeKey}\u0000${clientIp}`),
  );
  return `${routeKey}:${Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')}`;
}

export async function enforceProductionPreAuthRateLimit(
  request: Request,
  environment: ProductionAuthRateLimitBindings,
): Promise<Response | undefined> {
  if (environment.APP_ENV !== 'production') return undefined;

  const routeKey = PROTECTED_PATHS.get(new URL(request.url).pathname);
  if (routeKey === undefined) return undefined;

  const limiter = environment.AUTH_PRELOGIN_RATE_LIMITER;
  if (limiter === undefined) {
    return jsonError(
      'auth_rate_limit_unavailable',
      'Authentication rate limiting is unavailable.',
      503,
    );
  }

  const clientIp = trustedClientIp(request);
  if (clientIp === undefined) {
    return jsonError(
      'auth_client_identity_unavailable',
      'The authentication client identity is unavailable.',
      503,
    );
  }

  let success: boolean;
  try {
    ({ success } = await limiter.limit({ key: await opaqueClientKey(routeKey, clientIp) }));
  } catch {
    return jsonError(
      'auth_rate_limit_unavailable',
      'Authentication rate limiting is unavailable.',
      503,
    );
  }

  if (!success) {
    return jsonError(
      'auth_rate_limit_exceeded',
      'Too many authentication requests. Try again later.',
      429,
      RETRY_AFTER_SECONDS,
    );
  }

  return undefined;
}
