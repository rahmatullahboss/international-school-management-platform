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
}

interface BrowserHarness {
  readonly localStorage: StorageHarness;
  readonly sessionStorage: StorageHarness;
  readonly documentListeners: Map<string, EventListener>;
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
  };
}

function installBrowser(apiUrl?: string): BrowserHarness {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const documentListeners = new Map<string, EventListener>();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', {
    __PLATFORM_API_URL__: apiUrl,
    location: {
      hostname: 'school.test',
      origin: 'https://school.test',
    },
    localStorage,
    sessionStorage,
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener(type: string, listener: EventListener) {
      documentListeners.set(type, listener);
    },
    removeEventListener(type: string) {
      documentListeners.delete(type);
    },
  });
  return { localStorage, sessionStorage, documentListeners };
}

function runEffects(): void {
  const effects = reactMocks.effects.splice(0);
  for (const effect of effects) {
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

describe('pilot resource bootstrap', () => {
  it('returns seed data and keeps refresh inert when no API is configured', async () => {
    installBrowser();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { usePilotResource } = await import('./pilot-resource.js');
    const fallback = { classes: ['Year 7'] } as const;

    const resource = usePilotResource(
      'teacher',
      fallback,
      ['attendance:write'],
      '2026-08-19T00:00:00.000Z',
      'online',
    );
    runEffects();
    resource.refresh();

    expect(resource).toMatchObject({
      data: fallback,
      capabilities: ['attendance:write'],
      updatedAt: '2026-08-19T00:00:00.000Z',
      state: 'seed',
      apiConfigured: false,
      message: undefined,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a trimmed runtime API override to establish a scoped session and cache a fresh snapshot', async () => {
    const browser = installBrowser('  https://pilot-api.test/  ');
    const accessToken = 't'.repeat(40);
    const sessionPayload = {
      schemaVersion: 1,
      tokenType: 'Bearer',
      accessToken,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      scope: {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        role: 'teacher',
        subjectId: 'teacher-1',
      },
    } as const;
    const snapshotPayload = {
      schemaVersion: 1,
      sourceVersion: 'pilot-test-1',
      generatedAt: '2026-08-19T10:30:00.000Z',
      scope: {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        role: 'teacher',
        subjectId: 'teacher-1',
        capabilities: ['attendance:write', 'gradebook:write'],
      },
      data: { classes: ['Year 7', 'Year 8'] },
    } as const;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sessionPayload), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshotPayload), {
          status: 200,
          headers: { 'content-type': 'application/json', etag: '"teacher-v1"' },
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
    expect(resource.state).toBe('seed');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://pilot-api.test/pilot/v1/sessions/teacher');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://pilot-api.test/pilot/v1/snapshots/teacher');
    const snapshotRequest = fetchMock.mock.calls[1]?.[1];
    expect(snapshotRequest).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    });
    expect((snapshotRequest?.headers as Headers).get('authorization')).toBe(
      `Bearer ${accessToken}`,
    );

    await vi.waitFor(() => {
      expect(reactMocks.stateSetters[0]).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheVersion: 1,
          etag: '"teacher-v1"',
          envelope: snapshotPayload,
        }),
      );
      expect(reactMocks.stateSetters[1]).toHaveBeenCalledWith('refreshing');
      expect(reactMocks.stateSetters[1]).toHaveBeenCalledWith('current');
    });
    expect(browser.sessionStorage.setItem).toHaveBeenCalledOnce();
    expect(browser.localStorage.setItem).toHaveBeenCalledOnce();
    expect(browser.documentListeners.has('visibilitychange')).toBe(true);
  });
});
