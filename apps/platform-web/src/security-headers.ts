export type WebSecurityEnvironment = string | undefined;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self'",
  "style-src-attr 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "worker-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

function mutableResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function applyWebSecurityHeaders(
  response: Response,
  environment: WebSecurityEnvironment,
): Response {
  if (environment !== 'staging' && environment !== 'production') return response;

  const secured = mutableResponse(response);
  if (environment === 'staging') {
    secured.headers.set('content-security-policy-report-only', CONTENT_SECURITY_POLICY);
    return secured;
  }

  secured.headers.set('content-security-policy', CONTENT_SECURITY_POLICY);
  secured.headers.set('strict-transport-security', 'max-age=31536000');
  secured.headers.set('x-content-type-options', 'nosniff');
  secured.headers.set('x-frame-options', 'DENY');
  secured.headers.set('referrer-policy', 'no-referrer');
  secured.headers.set(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  secured.headers.set('x-xss-protection', '0');
  return secured;
}

export const webContentSecurityPolicy = CONTENT_SECURITY_POLICY;
