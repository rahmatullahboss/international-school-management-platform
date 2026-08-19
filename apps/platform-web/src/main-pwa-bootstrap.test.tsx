import type * as ReactTypes from 'react';
import type { EffectCallback, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformServiceWorkerOptions } from './pwa.js';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return { render, createRoot: vi.fn(() => ({ render })) };
});

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  cleanups: [] as (() => void)[],
}));

const pwaMocks = vi.hoisted(() => ({
  registerPlatformServiceWorker: vi.fn((options?: PlatformServiceWorkerOptions) => {
    void options;
    return Promise.resolve({ status: 'registered' as const });
  }),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    startTransition: ((callback: () => void) => callback()) as typeof actual.startTransition,
    useCallback: ((callback: unknown) => callback) as typeof actual.useCallback,
    useEffect: ((effect: EffectCallback) => {
      reactMocks.effects.push(effect);
    }) as typeof actual.useEffect,
    useReducer: ((_reducer: unknown, initialState: unknown) => [
      initialState,
      vi.fn(),
    ]) as typeof actual.useReducer,
    useRef: ((initialValue: unknown) => ({ current: initialValue })) as typeof actual.useRef,
    useState: ((initialState: unknown) => {
      const value =
        typeof initialState === 'function' ? (initialState as () => unknown)() : initialState;
      return [value, vi.fn()];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./pwa', () => ({
  registerPlatformServiceWorker: pwaMocks.registerPlatformServiceWorker,
}));

function installBrowser(): ReturnType<typeof vi.fn> {
  const reload = vi.fn();
  vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true } });
  vi.stubGlobal('window', {
    location: {
      pathname: '/',
      search: '',
      href: 'https://school.test/',
      origin: 'https://school.test',
      reload,
    },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    matchMedia: vi.fn(() => ({ matches: true })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('document', {
    title: '',
    getElementById(id: string) {
      return id === 'root' ? {} : null;
    },
    querySelector() {
      return null;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return reload;
}

function runEffects(): void {
  const effects = reactMocks.effects.splice(0);
  for (const effect of effects) {
    const cleanup = effect();
    if (typeof cleanup === 'function') reactMocks.cleanups.push(cleanup);
  }
}

function renderedApplication(): ReactElement {
  const element = rootMocks.render.mock.calls.at(-1)?.[0] as ReactElement | undefined;
  if (element === undefined) throw new Error('expected application render');
  return element;
}

async function mountApplication(): Promise<ReturnType<typeof vi.fn>> {
  const reload = installBrowser();
  await import('./main.js');
  renderToStaticMarkup(renderedApplication());
  runEffects();
  return reload;
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  reactMocks.effects.length = 0;
  reactMocks.cleanups.length = 0;
  pwaMocks.registerPlatformServiceWorker.mockClear();
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('platform main production PWA bootstrap', () => {
  it('registers the service worker in production and reloads when an update is available', async () => {
    vi.stubEnv('PROD', true);
    const reload = await mountApplication();

    expect(pwaMocks.registerPlatformServiceWorker).toHaveBeenCalledOnce();
    const options = pwaMocks.registerPlatformServiceWorker.mock.calls[0]?.[0] as
      { readonly onUpdateAvailable?: () => void } | undefined;
    expect(options).toBeDefined();
    options?.onUpdateAvailable?.();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not register the service worker outside production', async () => {
    vi.stubEnv('PROD', false);
    await mountApplication();

    expect(pwaMocks.registerPlatformServiceWorker).not.toHaveBeenCalled();
  });
});
