import type * as ReactTypes from 'react';
import type { EffectCallback, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return {
    render,
    createRoot: vi.fn(() => ({ render })),
  };
});

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  cleanups: [] as (() => void)[],
  reducerDispatch: vi.fn(),
}));

const portalMocks = vi.hoisted(() => ({ teacherLoads: 0 }));

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
      reactMocks.reducerDispatch,
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
vi.mock('./pwa', () => ({ registerPlatformServiceWorker: vi.fn() }));
vi.mock('./portals/teacher', () => {
  portalMocks.teacherLoads += 1;
  return { default: () => null };
});

interface BrowserOptions {
  readonly path?: string;
  readonly saveData?: boolean;
}

interface BrowserHarness {
  readonly setTimeout: ReturnType<typeof vi.fn>;
  readonly clearTimeout: ReturnType<typeof vi.fn>;
}

function installBrowser(options: BrowserOptions = {}): BrowserHarness {
  const path = options.path ?? '/';
  const url = new URL(path, 'https://school.test');
  const setTimeout = vi.fn(() => 7);
  const clearTimeout = vi.fn();

  vi.stubGlobal('navigator', {
    onLine: true,
    connection: { saveData: options.saveData ?? true },
  });
  vi.stubGlobal('window', {
    location: {
      pathname: url.pathname,
      search: url.search,
      href: url.href,
      origin: url.origin,
      reload: vi.fn(),
    },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    matchMedia: vi.fn(() => ({ matches: true })),
    setTimeout,
    clearTimeout,
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

  return { setTimeout, clearTimeout };
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

async function mountApplication(options: BrowserOptions = {}): Promise<BrowserHarness> {
  const browser = installBrowser(options);
  await import('./main.js');
  renderToStaticMarkup(renderedApplication());
  runEffects();
  return browser;
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  reactMocks.effects.length = 0;
  reactMocks.cleanups.length = 0;
  reactMocks.reducerDispatch.mockClear();
  portalMocks.teacherLoads = 0;
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe('platform main lifecycle effects', () => {
  it('loads the current role portal and refreshes after the lazy module resolves', async () => {
    await mountApplication({ path: '/teacher' });

    await vi.waitFor(() => expect(portalMocks.teacherLoads).toBe(1));
    await vi.waitFor(() => expect(reactMocks.reducerDispatch).toHaveBeenCalledOnce());
    expect(reactMocks.cleanups.length).toBeGreaterThanOrEqual(3);
  });

  it('uses the timer fallback for online idle preloading and clears it on cleanup', async () => {
    const browser = await mountApplication({ saveData: false });

    expect(browser.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1200);
    reactMocks.cleanups.pop()?.();
    expect(browser.clearTimeout).toHaveBeenCalledWith(7);
  });
});
