import {
  Children,
  isValidElement,
  type EffectCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import type * as ReactTypes from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  cleanups: [] as (() => void)[],
  setters: [] as ReturnType<typeof vi.fn>[],
  open: true,
  stepIndex: 0,
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
      const index = reactMocks.stateCall++;
      const setter = vi.fn();
      reactMocks.setters[index] = setter;
      const value =
        index === 0
          ? reactMocks.open
          : index === 1
            ? reactMocks.stepIndex
            : typeof initialState === 'function'
              ? (initialState as () => unknown)()
              : initialState;
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
  readonly windowListeners: Map<string, EventListener>;
  readonly querySelector: ReturnType<typeof vi.fn>;
  readonly oldTarget: TargetHarness;
  readonly navigationTarget: TargetHarness;
}

function createTarget(): TargetHarness {
  return {
    classList: { add: vi.fn(), remove: vi.fn() },
    scrollIntoView: vi.fn(),
  };
}

function installBrowser(options: { readonly writeThrows?: boolean } = {}): BrowserHarness {
  const oldTarget = createTarget();
  const navigationTarget = createTarget();
  const windowListeners = new Map<string, EventListener>();
  const localStorage = {
    getItem: vi.fn(() => 'complete'),
    setItem: vi.fn(() => {
      if (options.writeThrows === true) throw new Error('storage unavailable');
    }),
  };
  const querySelector = vi.fn((selector: string) => {
    if (selector === '.experience-nav-search') return null;
    if (selector === '.experience-nav') return navigationTarget;
    return null;
  });

  vi.stubGlobal('window', {
    location: { pathname: '/teacher' },
    localStorage,
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
    addEventListener(type: string, listener: EventListener) {
      windowListeners.set(type, listener);
    },
    removeEventListener(type: string) {
      windowListeners.delete(type);
    },
  });
  vi.stubGlobal('document', {
    querySelector,
    querySelectorAll: vi.fn(() => [oldTarget]),
  });
  return { localStorage, windowListeners, querySelector, oldTarget, navigationTarget };
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement | undefined {
  if (!isValidElement(node)) return undefined;
  if (predicate(node)) return node;
  const props = node.props as { readonly children?: ReactNode };
  for (const child of Children.toArray(props.children)) {
    const found = findElement(child, predicate);
    if (found !== undefined) return found;
  }
  return undefined;
}

function buttonByText(element: ReactElement, text: string): ReactElement {
  const button = findElement(
    element,
    (candidate) =>
      candidate.type === 'button' &&
      (candidate.props as { readonly children?: ReactNode }).children === text,
  );
  if (button === undefined) throw new Error(`expected ${text} button`);
  return button;
}

function click(button: ReactElement): void {
  const onClick = (button.props as { readonly onClick?: () => void }).onClick;
  if (onClick === undefined) throw new Error('expected click handler');
  onClick();
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
  reactMocks.setters.length = 0;
  reactMocks.open = true;
  reactMocks.stepIndex = 0;
  reactMocks.stateCall = 0;
});

afterEach(() => {
  for (const cleanup of reactMocks.cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe('GuidedWalkthrough dialog controls', () => {
  it('renders the open teacher dialog with bounded initial navigation controls', async () => {
    installBrowser();
    const { GuidedWalkthrough } = await import('./guided-walkthrough.js');

    const element = GuidedWalkthrough();
    if (element === null) throw new Error('expected walkthrough');
    const html = renderToStaticMarkup(element);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Teacher workspace');
    expect(html).toContain('1 / 12');
    expect(html).toContain('Your signed-in workspace');
    expect(html).toContain('<button type="button" disabled="">Back</button>');
    expect(html).toContain('>Next</button>');
  });

  it('uses keyboard navigation to skip a missing target and completes on Escape', async () => {
    const browser = installBrowser();
    const { GuidedWalkthrough, walkthroughStorageKey } = await import('./guided-walkthrough.js');

    GuidedWalkthrough();
    runEffects();
    const keydown = browser.windowListeners.get('keydown');
    expect(keydown).toBeDefined();

    keydown?.({ key: 'ArrowRight' } as KeyboardEvent);
    expect(browser.querySelector).toHaveBeenCalledWith('.experience-nav-search');
    expect(browser.querySelector).toHaveBeenCalledWith('.experience-nav');
    expect(browser.oldTarget.classList.remove).toHaveBeenCalledWith('guided-walkthrough__target');
    expect(browser.navigationTarget.classList.add).toHaveBeenCalledWith(
      'guided-walkthrough__target',
    );
    expect(browser.navigationTarget.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'smooth',
    });
    expect(reactMocks.setters[1]).toHaveBeenCalledWith(2);

    keydown?.({ key: 'Escape' } as KeyboardEvent);
    expect(browser.localStorage.setItem).toHaveBeenCalledWith(
      walkthroughStorageKey('teacher'),
      'complete',
    );
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(false);
  });

  it('finishes the last step and persists completion', async () => {
    const browser = installBrowser();
    reactMocks.stepIndex = 11;
    const { GuidedWalkthrough, walkthroughStorageKey } = await import('./guided-walkthrough.js');

    const element = GuidedWalkthrough();
    if (element === null) throw new Error('expected walkthrough');
    expect(renderToStaticMarkup(element)).toContain('12 / 12');
    expect(renderToStaticMarkup(element)).toContain('Change role safely');

    click(buttonByText(element, 'Finish'));

    expect(browser.localStorage.setItem).toHaveBeenCalledWith(
      walkthroughStorageKey('teacher'),
      'complete',
    );
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(false);
  });

  it('still closes when completion storage is unavailable', async () => {
    const browser = installBrowser({ writeThrows: true });
    const { GuidedWalkthrough } = await import('./guided-walkthrough.js');

    const element = GuidedWalkthrough();
    if (element === null) throw new Error('expected walkthrough');
    expect(() => click(buttonByText(element, 'Skip tour'))).not.toThrow();

    expect(browser.localStorage.setItem).toHaveBeenCalledOnce();
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(false);
  });
});
