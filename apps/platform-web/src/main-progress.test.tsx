import type * as ReactTypes from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return { render, createRoot: vi.fn(() => ({ render })) };
});

const stateMocks = vi.hoisted(() => ({
  pendingPath: undefined as string | undefined,
  useStateCalls: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useCallback: ((callback: unknown) => callback) as typeof actual.useCallback,
    useEffect: vi.fn() as unknown as typeof actual.useEffect,
    useReducer: ((_reducer: unknown, initialState: unknown) => [
      initialState,
      vi.fn(),
    ]) as typeof actual.useReducer,
    useRef: ((initialValue: unknown) => ({ current: initialValue })) as typeof actual.useRef,
    useState: ((initialState: unknown) => {
      stateMocks.useStateCalls += 1;
      const value =
        stateMocks.useStateCalls === 3
          ? stateMocks.pendingPath
          : typeof initialState === 'function'
            ? (initialState as () => unknown)()
            : initialState;
      return [value, vi.fn()];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./pwa', () => ({ registerPlatformServiceWorker: vi.fn() }));

function installBrowser(): void {
  vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true } });
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
}

function renderedHtml(): string {
  stateMocks.useStateCalls = 0;
  const element = rootMocks.render.mock.calls.at(-1)?.[0] as ReactElement | undefined;
  if (element === undefined) throw new Error('expected application render');
  return renderToStaticMarkup(element);
}

async function renderWithPendingPath(pendingPath: string): Promise<string> {
  stateMocks.pendingPath = pendingPath;
  installBrowser();
  await import('./main.js');
  return renderedHtml();
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  stateMocks.pendingPath = undefined;
  stateMocks.useStateCalls = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform main navigation progress', () => {
  it('labels pending role navigation with the destination workspace title', async () => {
    const html = await renderWithPendingPath('/teacher/classes');

    expect(html).toContain('Opening today’s teaching workspace…');
  });

  it('labels pending root navigation as the role chooser', async () => {
    const html = await renderWithPendingPath('/');

    expect(html).toContain('Opening role chooser…');
  });
});
