import type * as ReactTypes from 'react';
import type { EffectCallback, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return { render, createRoot: vi.fn(() => ({ render })) };
});

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  cleanups: [] as (() => void)[],
  startTransition: vi.fn((callback: () => void) => callback()),
}));

const domMocks = vi.hoisted(() => ({
  flushSync: vi.fn((callback: () => void) => callback()),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    startTransition: reactMocks.startTransition as typeof actual.startTransition,
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

vi.mock('react-dom', () => ({ flushSync: domMocks.flushSync }));
vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./pwa', () => ({ registerPlatformServiceWorker: vi.fn() }));

class TestElement {
  constructor(private readonly anchor: HTMLAnchorElement) {}

  closest<T extends Element>(selectors: string): T | null {
    if (selectors !== 'a[href]') return null;
    return this.anchor as unknown as T;
  }
}

interface BrowserHarness {
  readonly click: EventListener;
  readonly pushState: ReturnType<typeof vi.fn>;
  readonly startViewTransition: ReturnType<typeof vi.fn>;
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

async function mountApplication(reducedMotion: boolean): Promise<BrowserHarness> {
  const documentListeners = new Map<string, EventListener>();
  const location = {
    pathname: '/not-a-workspace',
    search: '',
    href: 'https://school.test/not-a-workspace',
    origin: 'https://school.test',
    reload: vi.fn(),
  };
  const pushState = vi.fn((_state: unknown, _unused: string, url?: string | URL | null) => {
    if (url === null || url === undefined) return;
    const next = new URL(String(url), location.href);
    location.pathname = next.pathname;
    location.search = next.search;
    location.href = next.href;
  });
  const startViewTransition = vi.fn((callback: () => void) => {
    callback();
    return { finished: Promise.resolve() };
  });

  vi.stubGlobal('Element', TestElement);
  vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true } });
  vi.stubGlobal('window', {
    location,
    history: { pushState, replaceState: vi.fn() },
    matchMedia: vi.fn(() => ({ matches: reducedMotion })),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('document', {
    title: '',
    startViewTransition,
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

  await import('./main.js');
  renderToStaticMarkup(renderedApplication());
  runEffects();
  const click = documentListeners.get('click');
  if (click === undefined) throw new Error('click listener not installed');
  return { click, pushState, startViewTransition };
}

function eligibleClick(): MouseEvent {
  const anchor = {
    href: 'https://school.test/',
    target: '',
    hasAttribute: () => false,
  } as unknown as HTMLAnchorElement;
  return {
    target: new TestElement(anchor),
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault: vi.fn(),
  } as unknown as MouseEvent;
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  reactMocks.effects.length = 0;
  reactMocks.cleanups.length = 0;
  reactMocks.startTransition.mockClear();
  domMocks.flushSync.mockClear();
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe('platform main view transitions', () => {
  it('uses a view transition for eligible navigation when motion is allowed', async () => {
    const browser = await mountApplication(false);

    browser.click(eligibleClick());

    expect(browser.startViewTransition).toHaveBeenCalledOnce();
    expect(domMocks.flushSync).toHaveBeenCalledOnce();
    expect(browser.pushState).toHaveBeenCalledWith({}, '', '/');
    expect(reactMocks.startTransition).not.toHaveBeenCalled();
  });

  it('keeps reduced-motion navigation on the non-animated transition path', async () => {
    const browser = await mountApplication(true);

    browser.click(eligibleClick());

    expect(browser.startViewTransition).not.toHaveBeenCalled();
    expect(domMocks.flushSync).not.toHaveBeenCalled();
    expect(reactMocks.startTransition).toHaveBeenCalledOnce();
    expect(browser.pushState).toHaveBeenCalledWith({}, '', '/');
  });
});
