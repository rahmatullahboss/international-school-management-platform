import type * as ReactTypes from 'react';
import type { EffectCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  cleanups: [] as (() => void)[],
  stateSetters: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useCallback: ((callback: unknown) => callback) as typeof actual.useCallback,
    useEffect: ((effect: EffectCallback) => {
      reactMocks.effects.push(effect);
    }) as typeof actual.useEffect,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useState: ((initialState: unknown) => {
      const value =
        typeof initialState === 'function' ? (initialState as () => unknown)() : initialState;
      const setter = vi.fn();
      reactMocks.stateSetters.push(setter);
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

interface StorageHarness {
  readonly getItem: ReturnType<typeof vi.fn>;
  readonly setItem: ReturnType<typeof vi.fn>;
  readonly removeItem: ReturnType<typeof vi.fn>;
  seed(key: string, value: string): void;
}

function createStorage(): StorageHarness {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    seed(key: string, value: string) {
      values.set(key, value);
    },
  };
}

const productionHost = 'international-school-platform-web-production.rahmatullahzisan.workers.dev';
const productionOrigin = `https://${productionHost}`;

function installProductionBrowser(): {
  readonly localStorage: StorageHarness;
  readonly sessionStorage: StorageHarness;
} {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  vi.stubGlobal('window', {
    location: { hostname: productionHost, origin: productionOrigin },
    localStorage,
    sessionStorage,
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return { localStorage, sessionStorage };
}

function runEffects(): void {
  for (const effect of reactMocks.effects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === 'function') reactMocks.cleanups.push(cleanup);
  }
}

beforeEach(() => {
  vi.resetModules();
  reactMocks.effects.length = 0;
  reactMocks.cleanups.length = 0;
  reactMocks.stateSetters.length = 0;
  vi.stubEnv('VITE_PLATFORM_API_URL', '');
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('pilot resource production snapshots', () => {
  it('loads the authenticated production snapshot and maps the database read-model envelope', async () => {
    const browser = installProductionBrowser();
    const productionPayload = {
      schemaVersion: 1,
      revision: 42,
      generatedAt: '2026-08-19T11:00:00.000Z',
      scope: {
        persona: 'teacher',
        tenantId: 'tenant-production-001',
        campusId: 'campus-production',
        subjectRef: 'teacher-production-1',
        capabilities: ['attendance:write', 'gradebook:write'],
      },
      data: { classes: ['Year 10'] },
    } as const;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify(productionPayload), {
        status: 200,
        headers: { etag: '"production-v42"' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { usePilotResource } = await import('./pilot-resource.js');

    const resource = usePilotResource(
      'teacher',
      { classes: [] },
      [],
      '2026-08-19T00:00:00.000Z',
      'online',
    );
    runEffects();

    expect(resource.apiConfigured).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${productionOrigin}/auth/v1/snapshot`);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
    expect((request?.headers as Headers).get('if-none-match')).toBeNull();
    await vi.waitFor(() => {
      expect(reactMocks.stateSetters[0]).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheVersion: 1,
          etag: '"production-v42"',
          envelope: {
            schemaVersion: 1,
            sourceVersion: 'database-rm-42',
            generatedAt: productionPayload.generatedAt,
            scope: {
              tenantId: 'tenant-production-001',
              campusId: 'campus-production',
              role: 'teacher',
              subjectId: 'teacher-production-1',
              capabilities: ['attendance:write', 'gradebook:write'],
            },
            data: productionPayload.data,
          },
        }),
      );
      expect(reactMocks.stateSetters[1]).toHaveBeenCalledWith('current');
    });
    expect(browser.localStorage.setItem).toHaveBeenCalledOnce();
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it('revalidates a stale cached production snapshot with its ETag and refreshes a 304', async () => {
    const browser = installProductionBrowser();
    const cacheKey = `${productionOrigin}|production|teacher`;
    const storageKey = `school-platform:pilot-read:${encodeURIComponent(cacheKey)}`;
    const cachedEnvelope = {
      schemaVersion: 1,
      sourceVersion: 'database-rm-41',
      generatedAt: '2026-08-19T10:45:00.000Z',
      scope: {
        tenantId: 'tenant-production-001',
        campusId: 'campus-production',
        role: 'teacher',
        subjectId: 'teacher-production-1',
        capabilities: ['attendance:write'],
      },
      data: { classes: ['Year 9'] },
    } as const;
    browser.localStorage.seed(
      storageKey,
      JSON.stringify({
        cacheVersion: 1,
        etag: '"production-v41"',
        receivedAt: Date.now() - 2 * 60_000,
        envelope: cachedEnvelope,
      }),
    );
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);
    const { usePilotResource } = await import('./pilot-resource.js');

    const resource = usePilotResource(
      'teacher',
      { classes: [] },
      [],
      '2026-08-19T00:00:00.000Z',
      'online',
    );
    runEffects();

    expect(resource.state).toBe('cached');
    expect(resource.data).toEqual(cachedEnvelope.data);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0]?.[1];
    expect((request?.headers as Headers).get('if-none-match')).toBe('"production-v41"');
    await vi.waitFor(() => {
      expect(reactMocks.stateSetters[0]).toHaveBeenCalledWith(
        expect.objectContaining({ etag: '"production-v41"', envelope: cachedEnvelope }),
      );
      expect(reactMocks.stateSetters[1]).toHaveBeenCalledWith('current');
    });
    expect(browser.localStorage.setItem).toHaveBeenCalledOnce();
  });
});
