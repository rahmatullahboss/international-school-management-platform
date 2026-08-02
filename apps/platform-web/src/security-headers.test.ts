import { describe, expect, it } from 'vitest';

import { applyWebSecurityHeaders, webContentSecurityPolicy } from './security-headers.js';

function response(headers?: HeadersInit): Response {
  return new Response('<!doctype html><title>School</title>', {
    status: 200,
    headers,
  });
}

describe('production web security headers', () => {
  it('does not modify development responses', () => {
    const original = response({ 'x-existing': 'preserved' });
    const result = applyWebSecurityHeaders(original, 'development');
    expect(result).toBe(original);
    expect(result.headers.get('content-security-policy')).toBeNull();
  });

  it('uses report-only CSP in staging without production-only transport headers', () => {
    const result = applyWebSecurityHeaders(response(), 'staging');
    expect(result.headers.get('content-security-policy-report-only')).toBe(
      webContentSecurityPolicy,
    );
    expect(result.headers.get('content-security-policy')).toBeNull();
    expect(result.headers.get('strict-transport-security')).toBeNull();
  });

  it('enforces a self-hosted production CSP and browser hardening headers', () => {
    const result = applyWebSecurityHeaders(response(), 'production');
    const csp = result.headers.get('content-security-policy');
    expect(csp).toBe(webContentSecurityPolicy);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(result.headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(result.headers.get('x-frame-options')).toBe('DENY');
    expect(result.headers.get('referrer-policy')).toBe('no-referrer');
    expect(result.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    expect(result.headers.get('x-xss-protection')).toBe('0');
  });

  it('preserves status, body, caching and cookies while adding headers', async () => {
    const original = response({
      'cache-control': 'private, no-store',
      'set-cookie': '__Host-school_session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax',
    });
    const result = applyWebSecurityHeaders(original, 'production');
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(result.headers.get('set-cookie')).toContain('__Host-school_session=opaque');
    await expect(result.text()).resolves.toContain('<title>School</title>');
  });
});
