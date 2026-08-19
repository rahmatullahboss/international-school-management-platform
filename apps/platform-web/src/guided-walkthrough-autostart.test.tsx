import type * as ReactTypes from 'react';
import type { EffectCallback, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  cleanups: [] as (() => void)[],
  setters: [] as ReturnType<typeof vi.fn>[],
  stateCall: 0,
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
      const setter = vi.fn();
      reactMocks.setters[reactMocks.stateCall++] = setter;
      const value =
        typeof initialState === 'function' ? (initialState as () => unknown)() : initialState;
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

interface TargetHarness {
  readonly classList: {
    readonly add: ReturnType<typeof vi.fn>;
    readonly remove: ReturnType<typeof vi.fn>;
  };
  readonly scrollIntoView: ReturnType<typeof vi.fn>;
}

interface BrowserHarness {
  readonly localStorage: {
    readonly getItem: ReturnType<typeof vi.fn>;
    readonly setItem: ReturnType<typeof vi.fn>;
  };
  readonly setTimeout: ReturnType<typeof vi.fn>;
  readonly clearTimeout: ReturnType<typeof vi.fn>;
  readonly querySelector: ReturnType<typeof vi.fn>;
  readonly previousTarget: TargetHarness;
  readonly currentTarget: TargetHarness;
}

function createTarget(): TargetHarness {
  return {
    classList: { add: vi.fn(), remove: vi.fn() },
    scrollIntoView: vi.fn(),
  };
}

function installBrowser(
  options: {
    readonly pathname?: string;
    readonly completed?: boolean;
    readonly storageThrows?: boolean;
  } = {},
): BrowserHarness {
  const previousTarget = createTarget();
  const currentTarget = createTarget();
  const localStorage = {
    getItem: vi.fn(() => {
      if (options.storageThrows === true) throw new Error('storage unavailable');
      return options.completed === true ? 'complete' : null;
    }),
    setItem: vi.fn(),
  };
  let timerId = 0;
  const setTimeout = vi.fn((callback: () => void, delay?: number) => {
    void delay;
    callback();
    timerId += 1;
    return timerId;
  });
  const clearTimeout = vi.fn();
  const querySelector = vi.fn((selector: string) =>
    selector === '.experience-masthead' ? currentTarget : null,
  );

  vi.stubGlobal('window', {
    location: { pathname: options.pathname ?? '/teacher' },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('document', {
    querySelector,
    querySelectorAll: vi.fn(() => [previousTarget]),
  });
  return { localStorage, setTimeout, clearTimeout, querySelector, previousTarget, currentTarget };
}

function runEffects(): void {
  for (const effect of reactMocks.effects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === 'function') reactMocks.cleanups.push(cleanup);
  }
}

function html(element: ReactElement | null): string {
  if (element === null) return '';
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.resetModules();
  reactMocks.effects.length = 0;
  reactMocks.cleanups.length = 0;
  reactMocks.setters.length = 0;
  reactMocks.stateCall = 0;
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe('GuidedWalkthrough first-run lifecycle', () => {
  it('auto-starts an incomplete teacher walkthrough and focuses its first available target', async () => {
    const browser = installBrowser();
    const { GuidedWalkthrough, walkthroughStorageKey } = await import('./guided-walkthrough.js');

    const element = GuidedWalkthrough();
    expect(html(element)).toContain('Show walkthrough');
    runEffects();

    expect(browser.localStorage.getItem).toHaveBeenCalledWith(walkthroughStorageKey('teacher'));
    expect(browser.setTimeout).toHaveBeenCalledWith(expect.any(Function), 650);
    expect(browser.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(true);
    expect(browser.querySelector).toHaveBeenCalledWith('.experience-masthead');
    expect(browser.previousTarget.classList.remove).toHaveBeenCalledWith(
      'guided-walkthrough__target',
    );
    expect(browser.currentTarget.classList.add).toHaveBeenCalledWith('guided-walkthrough__target');
    expect(browser.currentTarget.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'smooth',
    });
    expect(reactMocks.setters[1]).toHaveBeenCalledWith(0);
  });

  it('does not auto-start a walkthrough already completed for the current role', async () => {
    const browser = installBrowser({ completed: true });
    const { GuidedWalkthrough } = await import('./guided-walkthrough.js');

    GuidedWalkthrough();
    runEffects();

    expect(browser.localStorage.getItem).toHaveBeenCalledOnce();
    expect(browser.setTimeout).not.toHaveBeenCalled();
    expect(reactMocks.setters[0]).not.toHaveBeenCalled();
  });

  it('remains usable when completion storage cannot be read', async () => {
    const browser = installBrowser({ storageThrows: true });
    const { GuidedWalkthrough } = await import('./guided-walkthrough.js');

    GuidedWalkthrough();
    runEffects();

    expect(browser.localStorage.getItem).toHaveBeenCalledOnce();
    expect(browser.setTimeout).toHaveBeenCalledWith(expect.any(Function), 650);
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(true);
  });

  it('does not render or schedule a walkthrough outside a recognized workspace', async () => {
    const browser = installBrowser({ pathname: '/offline.html' });
    const { GuidedWalkthrough } = await import('./guided-walkthrough.js');

    const element = GuidedWalkthrough();
    runEffects();

    expect(element).toBeNull();
    expect(browser.localStorage.getItem).not.toHaveBeenCalled();
    expect(browser.setTimeout).not.toHaveBeenCalled();
  });
});
