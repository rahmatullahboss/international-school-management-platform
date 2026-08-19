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

function createStorage() {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

function installBrowser(options: { readonly production?: boolean } = {}): void {
  const productionHost =
    'international-school-platform-web-production.rahmatullahzisan.workers.dev';
  vi.stubGlobal('window', {
    ...(options.production ? {} : { __PLATFORM_API_URL__: 'https://pilot-api.test' }),
    location: options.production
      ? { hostname: productionHost, origin: `https://${productionHost}` }
      : { hostname: 'school.test', origin: 'https://school.test' },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

function runEffects(): void {
  for (const effect of reactMocks.effects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === 'function') reactMocks.cleanups.push(cleanup);
  }
}

function validSession(role: 'teacher' | 'admin' = 'teacher') {
  return {
    schemaVersion: 1,
    tokenType: 'Bearer',
    accessToken: 't'.repeat(40),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    scope: {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      role,
      subjectId: role === 'teacher' ? 'teacher-1' : 'principal-1',
    },
  } as const;
}

async function mountTeacher(): Promise<void> {
  const { usePilotResource } = await import('./pilot-resource.js');
  usePilotResource('teacher', { classes: [] }, [], '2026-08-19T00:00:00.000Z', 'online');
  runEffects();
}

async function expectStaleMessage(message: string): Promise<void> {
  await vi.waitFor(() => {
    expect(reactMocks.stateSetters[1]).toHaveBeenCalledWith('stale');
    expect(reactMocks.stateSetters[2]).toHaveBeenCalledWith(message);
  });
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

describe('pilot resource scope validation', () => {
  it('fails closed when the staging session identity does not match the requested role', async () => {
    installBrowser();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSession('admin')), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await mountTeacher();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await expectStaleMessage('Staging session service returned an invalid identity scope.');
  });

  it('fails closed when the staging snapshot belongs to a different role', async () => {
    installBrowser();
    const wrongScopeSnapshot = {
      schemaVersion: 1,
      sourceVersion: 'pilot-wrong-role',
      generatedAt: '2026-08-19T11:15:00.000Z',
      scope: {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        role: 'admin',
        subjectId: 'principal-1',
        capabilities: ['school:admin'],
      },
      data: { classes: [] },
    } as const;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(validSession()), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(wrongScopeSnapshot), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await mountTeacher();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await expectStaleMessage('Staging data service returned data outside the requested scope.');
  });

  it('fails closed when production returns an invalid authenticated workspace snapshot', async () => {
    installBrowser({ production: true });
    const invalidProductionSnapshot = {
      schemaVersion: 1,
      revision: 0,
      generatedAt: '2026-08-19T11:15:00.000Z',
      scope: {
        persona: 'teacher',
        tenantId: 'tenant-production-001',
        subjectRef: 'teacher-production-1',
        capabilities: [],
      },
      data: { classes: [] },
    } as const;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(invalidProductionSnapshot), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await mountTeacher();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await expectStaleMessage(
      'Production read API returned a snapshot outside the authenticated workspace.',
    );
  });
});
