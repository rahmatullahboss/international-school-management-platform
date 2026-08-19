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

function installBrowser(): { readonly sessionStorage: StorageHarness } {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  vi.stubGlobal('window', {
    __PLATFORM_API_URL__: 'https://pilot-api.test',
    location: { hostname: 'school.test', origin: 'https://school.test' },
    localStorage,
    sessionStorage,
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return { sessionStorage };
}

function runEffects(): void {
  for (const effect of reactMocks.effects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === 'function') reactMocks.cleanups.push(cleanup);
  }
}

function sessionPayload(accessToken: string) {
  return {
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
}

const snapshotPayload = {
  schemaVersion: 1,
  sourceVersion: 'pilot-test-renewed',
  generatedAt: '2026-08-19T10:45:00.000Z',
  scope: {
    tenantId: 'tenant-pilot-001',
    campusId: 'campus-main',
    role: 'teacher',
    subjectId: 'teacher-1',
    capabilities: ['attendance:write'],
  },
  data: { classes: ['Year 7'] },
} as const;

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

describe('pilot resource session renewal', () => {
  it('clears a rejected session, obtains a new role-bound token and retries the snapshot once', async () => {
    const browser = installBrowser();
    const firstToken = 'a'.repeat(40);
    const renewedToken = 'b'.repeat(40);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sessionPayload(firstToken)), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sessionPayload(renewedToken)), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshotPayload), {
          status: 200,
          headers: { etag: '"teacher-renewed"' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { usePilotResource } = await import('./pilot-resource.js');

    usePilotResource('teacher', { classes: [] }, [], '2026-08-19T00:00:00.000Z', 'online');
    runEffects();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://pilot-api.test/pilot/v1/sessions/teacher',
      'https://pilot-api.test/pilot/v1/snapshots/teacher',
      'https://pilot-api.test/pilot/v1/sessions/teacher',
      'https://pilot-api.test/pilot/v1/snapshots/teacher',
    ]);
    const firstSnapshotHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    const retriedSnapshotHeaders = fetchMock.mock.calls[3]?.[1]?.headers as Headers;
    expect(firstSnapshotHeaders.get('authorization')).toBe(`Bearer ${firstToken}`);
    expect(retriedSnapshotHeaders.get('authorization')).toBe(`Bearer ${renewedToken}`);
    expect(browser.sessionStorage.removeItem).toHaveBeenCalledOnce();
    expect(browser.sessionStorage.setItem).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      expect(reactMocks.stateSetters[0]).toHaveBeenCalledWith(
        expect.objectContaining({ envelope: snapshotPayload, etag: '"teacher-renewed"' }),
      );
      expect(reactMocks.stateSetters[1]).toHaveBeenCalledWith('current');
    });
  });
});
