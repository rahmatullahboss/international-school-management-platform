import { describe, expect, it, vi } from 'vitest';

import worker from './web-worker.js';

function binding(response: Response) {
  return {
    fetch: vi.fn().mockResolvedValue(response),
  };
}

describe('web worker security boundary', () => {
  it('hardens production asset responses', async () => {
    const assets = binding(new Response('<html>school</html>', { status: 200 }));
    const api = binding(new Response('api', { status: 200 }));
    const result = await worker.fetch(new Request('https://school.example/admin'), {
      APP_ENV: 'production',
      ASSETS: assets,
      PLATFORM_API: api,
    });
    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(api.fetch).not.toHaveBeenCalled();
    expect(result.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(result.headers.get('strict-transport-security')).toBe('max-age=31536000');
  });

  it('hardens proxied production auth responses without losing cookies', async () => {
    const assets = binding(new Response('asset', { status: 200 }));
    const api = binding(
      new Response(null, {
        status: 302,
        headers: {
          location: 'https://id.example.com/authorize',
          'set-cookie': '__Host-school_tx=opaque; Path=/; Secure; HttpOnly; SameSite=Lax',
          'cache-control': 'no-store',
        },
      }),
    );
    const result = await worker.fetch(new Request('https://school.example/auth/v1/login'), {
      APP_ENV: 'production',
      ASSETS: assets,
      PLATFORM_API: api,
    });
    expect(api.fetch).toHaveBeenCalledOnce();
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(result.status).toBe(302);
    expect(result.headers.get('location')).toBe('https://id.example.com/authorize');
    expect(result.headers.get('set-cookie')).toContain('__Host-school_tx=opaque');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('content-security-policy')).toBeTruthy();
  });

  it('uses report-only CSP in staging', async () => {
    const assets = binding(new Response('<html>school</html>', { status: 200 }));
    const api = binding(new Response('api', { status: 200 }));
    const result = await worker.fetch(new Request('https://staging.school.example/student'), {
      APP_ENV: 'staging',
      ASSETS: assets,
      PLATFORM_API: api,
    });
    expect(result.headers.get('content-security-policy')).toBeNull();
    expect(result.headers.get('content-security-policy-report-only')).toBeTruthy();
  });
});
