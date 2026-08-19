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
  stateSetters: [] as ReturnType<typeof vi.fn>[],
}));

const portalMocks = vi.hoisted(() => ({
  adminLoads: 0,
  teacherLoads: 0,
  guardianLoads: 0,
  studentLoads: 0,
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
      const setter = vi.fn();
      reactMocks.stateSetters.push(setter);
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./pwa', () => ({ registerPlatformServiceWorker: vi.fn() }));
vi.mock('./portals/admin', () => {
  portalMocks.adminLoads += 1;
  return { default: () => null };
});
vi.mock('./portals/teacher', () => {
  portalMocks.teacherLoads += 1;
  return { default: () => null };
});
vi.mock('./portals/guardian', () => {
  portalMocks.guardianLoads += 1;
  return { default: () => null };
});
vi.mock('./portals/student', () => {
  portalMocks.studentLoads += 1;
  return { default: () => null };
});

interface BrowserOptions {
  readonly online?: boolean;
  readonly saveData?: boolean;
  readonly idleCallback?: boolean;
}

interface BrowserHarness {
  readonly windowListeners: Map<string, EventListener>;
  readonly navigatorState: {
    onLine: boolean;
    connection: { saveData: boolean };
  };
  readonly idleCallbacks: Map<number, IdleRequestCallback>;
  readonly requestIdleCallback: ReturnType<typeof vi.fn>;
  readonly cancelIdleCallback: ReturnType<typeof vi.fn>;
}

function installBrowser(options: BrowserOptions = {}): BrowserHarness {
  const windowListeners = new Map<string, EventListener>();
  const documentListeners = new Map<string, EventListener>();
  const idleCallbacks = new Map<number, IdleRequestCallback>();
  const navigatorState = {
    onLine: options.online ?? true,
    connection: { saveData: options.saveData ?? true },
  };
  const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
    idleCallbacks.set(1, callback);
    return 1;
  });
  const cancelIdleCallback = vi.fn((handle: number) => {
    idleCallbacks.delete(handle);
  });

  vi.stubGlobal('navigator', navigatorState);
  vi.stubGlobal('window', {
    location: {
      pathname: '/',
      search: '',
      href: 'https://school.test/',
      origin: 'https://school.test',
      reload: vi.fn(),
    },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    matchMedia: vi.fn(() => ({ matches: true })),
    ...(options.idleCallback === true ? { requestIdleCallback, cancelIdleCallback } : {}),
    addEventListener(type: string, listener: EventListener) {
      windowListeners.set(type, listener);
    },
    removeEventListener(type: string) {
      windowListeners.delete(type);
    },
  });
  vi.stubGlobal('document', {
    title: '',
    getElementById(id: string) {
      return id === 'root' ? {} : null;
    },
    querySelector() {
      return null;
    },
    addEventListener(type: string, listener: EventListener) {
      documentListeners.set(type, listener);
    },
    removeEventListener(type: string) {
      documentListeners.delete(type);
    },
  });

  return {
    windowListeners,
    navigatorState,
    idleCallbacks,
    requestIdleCallback,
    cancelIdleCallback,
  };
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
  reactMocks.stateSetters.length = 0;
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe('platform main connectivity and idle preloading', () => {
  it('maps browser connectivity changes to offline, degraded and online states', async () => {
    const browser = await mountApplication();
    const setConnectivity = reactMocks.stateSetters[0];
    const offline = browser.windowListeners.get('offline');
    const online = browser.windowListeners.get('online');
    expect(setConnectivity).toBeDefined();
    expect(offline).toBeDefined();
    expect(online).toBeDefined();

    browser.navigatorState.onLine = false;
    offline?.(new Event('offline'));
    expect(setConnectivity).toHaveBeenLastCalledWith('offline');

    browser.navigatorState.onLine = true;
    browser.navigatorState.connection.saveData = true;
    online?.(new Event('online'));
    expect(setConnectivity).toHaveBeenLastCalledWith('degraded');

    browser.navigatorState.connection.saveData = false;
    online?.(new Event('online'));
    expect(setConnectivity).toHaveBeenLastCalledWith('online');
  });

  it('preloads every portal during idle time when fully online and cancels the task on cleanup', async () => {
    const browser = await mountApplication({ saveData: false, idleCallback: true });
    expect(browser.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 2500,
    });

    const callback = browser.idleCallbacks.get(1);
    expect(callback).toBeDefined();
    callback?.({ didTimeout: false, timeRemaining: () => 50 });

    await vi.waitFor(() => {
      expect(portalMocks.adminLoads).toBe(1);
      expect(portalMocks.teacherLoads).toBe(1);
      expect(portalMocks.guardianLoads).toBe(1);
      expect(portalMocks.studentLoads).toBe(1);
    });

    reactMocks.cleanups.pop()?.();
    expect(browser.cancelIdleCallback).toHaveBeenCalledWith(1);
  });
});
