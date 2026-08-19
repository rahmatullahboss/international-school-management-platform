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
  startTransition: vi.fn((callback: () => void) => callback()),
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

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./pwa', () => ({ registerPlatformServiceWorker: vi.fn() }));

interface AnchorOptions {
  readonly href: string;
  readonly target?: string;
  readonly download?: boolean;
}

class TestElement {
  constructor(private readonly anchor: HTMLAnchorElement | null) {}

  closest<T extends Element>(selectors: string): T | null {
    if (selectors !== 'a[href]') return null;
    return this.anchor as unknown as T | null;
  }
}

interface BrowserHarness {
  readonly documentListeners: Map<string, EventListener>;
  readonly pushState: ReturnType<typeof vi.fn>;
  readonly replaceState: ReturnType<typeof vi.fn>;
  readonly focus: ReturnType<typeof vi.fn>;
  readonly scrollTo: ReturnType<typeof vi.fn>;
  readonly location: {
    pathname: string;
    search: string;
    href: string;
    origin: string;
    reload: ReturnType<typeof vi.fn>;
  };
}

function createAnchor(options: AnchorOptions): HTMLAnchorElement {
  return {
    href: options.href,
    target: options.target ?? '',
    hasAttribute(name: string) {
      return name === 'download' && options.download === true;
    },
  } as unknown as HTMLAnchorElement;
}

function installBrowser(path: string): BrowserHarness {
  const initialUrl = new URL(path, 'https://school.test');
  const documentListeners = new Map<string, EventListener>();
  const windowListeners = new Map<string, EventListener>();
  const focus = vi.fn();
  const scrollTo = vi.fn();
  const location = {
    pathname: initialUrl.pathname,
    search: initialUrl.search,
    href: initialUrl.href,
    origin: initialUrl.origin,
    reload: vi.fn(),
  };

  const updateLocation = (url: string | URL | null | undefined): void => {
    if (url === null || url === undefined) return;
    const next = new URL(String(url), location.href);
    location.pathname = next.pathname;
    location.search = next.search;
    location.href = next.href;
  };
  const pushState = vi.fn((_state: unknown, _unused: string, url?: string | URL | null) => {
    updateLocation(url);
  });
  const replaceState = vi.fn((_state: unknown, _unused: string, url?: string | URL | null) => {
    updateLocation(url);
  });

  vi.stubGlobal('Element', TestElement);
  vi.stubGlobal('navigator', {
    onLine: true,
    connection: { saveData: true },
  });
  vi.stubGlobal('window', {
    location,
    history: { pushState, replaceState },
    matchMedia: vi.fn(() => ({ matches: true })),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
    scrollTo,
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
      return { focus };
    },
    addEventListener(type: string, listener: EventListener) {
      documentListeners.set(type, listener);
    },
    removeEventListener(type: string) {
      documentListeners.delete(type);
    },
  });

  return { documentListeners, pushState, replaceState, focus, scrollTo, location };
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

async function mountApplication(path: string): Promise<BrowserHarness> {
  const browser = installBrowser(path);
  await import('./main.js');
  renderToStaticMarkup(renderedApplication());
  runEffects();
  return browser;
}

function clickEvent(
  anchor: HTMLAnchorElement,
  overrides: Partial<
    Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'>
  > = {},
): { readonly event: MouseEvent; readonly preventDefault: ReturnType<typeof vi.fn> } {
  const preventDefault = vi.fn();
  const event = {
    target: new TestElement(anchor),
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault,
    ...overrides,
  } as unknown as MouseEvent;
  return { event, preventDefault };
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  reactMocks.effects.length = 0;
  reactMocks.cleanups.length = 0;
  reactMocks.startTransition.mockClear();
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe('platform main navigation click interception', () => {
  it('intercepts an eligible same-origin application click and commits browser history', async () => {
    const browser = await mountApplication('/not-a-workspace');
    const click = browser.documentListeners.get('click');
    expect(click).toBeDefined();

    const { event, preventDefault } = clickEvent(createAnchor({ href: 'https://school.test/' }));
    click?.(event);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(browser.pushState).toHaveBeenCalledWith({}, '', '/');
    expect(browser.replaceState).not.toHaveBeenCalled();
    expect(reactMocks.startTransition).toHaveBeenCalledOnce();
    expect(document.title).toBe('Choose a role · International School Platform');
    expect(browser.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(browser.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(browser.location.pathname).toBe('/');
  });

  it('leaves modified, external and browser-owned links unintercepted', async () => {
    const browser = await mountApplication('/');
    const click = browser.documentListeners.get('click');
    expect(click).toBeDefined();

    const cases: readonly {
      readonly anchor: AnchorOptions;
      readonly event?: Parameters<typeof clickEvent>[1];
    }[] = [
      { anchor: { href: 'https://school.test/admin' }, event: { ctrlKey: true } },
      { anchor: { href: 'https://school.test/admin' }, event: { button: 1 } },
      { anchor: { href: 'https://example.com/admin' } },
      { anchor: { href: 'https://school.test/admin', download: true } },
      { anchor: { href: 'https://school.test/admin', target: '_blank' } },
      { anchor: { href: 'https://school.test/offline.html' } },
      { anchor: { href: 'https://school.test/not-an-app-route' } },
      { anchor: { href: 'https://school.test/#main-content' } },
    ];

    for (const testCase of cases) {
      const { event, preventDefault } = clickEvent(createAnchor(testCase.anchor), testCase.event);
      click?.(event);
      expect(preventDefault).not.toHaveBeenCalled();
    }

    expect(browser.pushState).not.toHaveBeenCalled();
    expect(browser.replaceState).not.toHaveBeenCalled();
  });
});
