import { describe, expect, it, vi } from 'vitest';

import { enforceProductionPreAuthRateLimit } from './production-auth-rate-limit.js';

function request(pathname: string, clientIp = '203.0.113.42'): Request {
  return new Request(`https://api.example.com${pathname}`, {
    headers: { 'cf-connecting-ip': clientIp },
  });
}

function environment(limiter?: { limit: ReturnType<typeof vi.fn> }) {
  return {
    APP_ENV: 'production',
    ...(limiter === undefined ? {} : { AUTH_PRELOGIN_RATE_LIMITER: limiter }),
  };
}

describe('production pre-auth rate limit', () => {
  it('does not apply outside production or outside protected auth routes', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    await expect(
      enforceProductionPreAuthRateLimit(request('/auth/v1/login'), {
        APP_ENV: 'staging',
        AUTH_PRELOGIN_RATE_LIMITER: { limit },
      }),
    ).resolves.toBeUndefined();
    await expect(
      enforceProductionPreAuthRateLimit(request('/auth/v1/workspace'), environment({ limit })),
    ).resolves.toBeUndefined();
    expect(limit).not.toHaveBeenCalled();
  });

  it('fails closed when the production binding is missing', async () => {
    const response = await enforceProductionPreAuthRateLimit(
      request('/auth/v1/login'),
      environment(),
    );
    expect(response?.status).toBe(503);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: 'auth_rate_limit_unavailable',
        message: 'Authentication rate limiting is unavailable.',
      },
    });
  });

  it('fails closed when Cloudflare client identity is unavailable or malformed', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const missingIp = new Request('https://api.example.com/auth/v1/login');
    const missingResponse = await enforceProductionPreAuthRateLimit(
      missingIp,
      environment({ limit }),
    );
    expect(missingResponse?.status).toBe(503);

    const malformedResponse = await enforceProductionPreAuthRateLimit(
      request('/auth/v1/login', '203.0.113.42, 198.51.100.9'),
      environment({ limit }),
    );
    expect(malformedResponse?.status).toBe(503);
    expect(limit).not.toHaveBeenCalled();
  });

  it('uses an opaque route-scoped limiter key without exposing the client IP', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    await expect(
      enforceProductionPreAuthRateLimit(request('/auth/v1/login'), environment({ limit })),
    ).resolves.toBeUndefined();
    await expect(
      enforceProductionPreAuthRateLimit(request('/auth/v1/callback'), environment({ limit })),
    ).resolves.toBeUndefined();

    expect(limit).toHaveBeenCalledTimes(2);
    const loginKey = limit.mock.calls[0]?.[0]?.key as string;
    const callbackKey = limit.mock.calls[1]?.[0]?.key as string;
    expect(loginKey).toMatch(/^login:[0-9a-f]{64}$/u);
    expect(callbackKey).toMatch(/^callback:[0-9a-f]{64}$/u);
    expect(loginKey).not.toContain('203.0.113.42');
    expect(callbackKey).not.toContain('203.0.113.42');
    expect(loginKey).not.toBe(callbackKey);
  });

  it('returns a bounded 429 with Retry-After when the limit is exceeded', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const response = await enforceProductionPreAuthRateLimit(
      request('/auth/v1/login'),
      environment({ limit }),
    );
    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBe('60');
    expect(response?.headers.get('cache-control')).toBe('no-store');
    const payload = await response?.json();
    expect(payload).toEqual({
      error: {
        code: 'auth_rate_limit_exceeded',
        message: 'Too many authentication requests. Try again later.',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('203.0.113.42');
  });

  it('maps limiter failures to a redacted fail-closed response', async () => {
    const limit = vi.fn().mockRejectedValue(new Error('internal limiter namespace secret'));
    const response = await enforceProductionPreAuthRateLimit(
      request('/auth/v1/callback'),
      environment({ limit }),
    );
    expect(response?.status).toBe(503);
    const payload = await response?.json();
    expect(payload).toEqual({
      error: {
        code: 'auth_rate_limit_unavailable',
        message: 'Authentication rate limiting is unavailable.',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('namespace secret');
  });
});
