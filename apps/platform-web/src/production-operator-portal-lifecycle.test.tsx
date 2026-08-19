import {
  Children,
  isValidElement,
  type EffectCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import type * as ReactTypes from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductionWorkspace } from './production-gateway.js';
import type { ProductionOperatorWorkQueue } from './production-operator-work-queue.js';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return { render, createRoot: vi.fn(() => ({ render })) };
});

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  setters: [] as ReturnType<typeof vi.fn>[],
  call: 0,
}));

const queueMocks = vi.hoisted(() => ({
  loadProductionOperatorWorkQueue: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useEffect: ((effect: EffectCallback) => {
      reactMocks.effects.push(effect);
    }) as typeof actual.useEffect,
    useState: ((initialState: unknown) => {
      const setter = vi.fn();
      reactMocks.setters[reactMocks.call++] = setter;
      return [initialState, setter];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./production-operator-work-queue', () => ({
  loadProductionOperatorWorkQueue: queueMocks.loadProductionOperatorWorkQueue,
}));

const financeWorkspace: ProductionWorkspace = {
  role: 'finance',
  path: '/finance/reconciliation',
  assurance: 'aal2',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: ['finance.reconciliation.write'],
};

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

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  reactMocks.effects.length = 0;
  reactMocks.setters.length = 0;
  reactMocks.call = 0;
  queueMocks.loadProductionOperatorWorkQueue.mockReset();
});

describe('ProductionOperatorPortal lifecycle', () => {
  it('loads the finance work queue from the current server-owned role scope', async () => {
    const queue: ProductionOperatorWorkQueue = { state: 'ready', role: 'finance', items: [] };
    queueMocks.loadProductionOperatorWorkQueue.mockResolvedValue(queue);
    const { ProductionOperatorPortal } = await import('./production-operator-portal.js');

    renderToStaticMarkup(
      <ProductionOperatorPortal workspace={financeWorkspace} pathname="/finance/reconciliation" />,
    );
    expect(reactMocks.effects).toHaveLength(1);
    const cleanup = reactMocks.effects[0]?.();

    await vi.waitFor(() =>
      expect(queueMocks.loadProductionOperatorWorkQueue).toHaveBeenCalledOnce(),
    );
    expect(queueMocks.loadProductionOperatorWorkQueue).toHaveBeenCalledWith();
    await vi.waitFor(() => expect(reactMocks.setters[2]).toHaveBeenCalledWith(queue));
    expect(typeof cleanup).toBe('function');
    cleanup?.();
  });

  it('posts a current-session logout and returns the browser to the production entry point', async () => {
    const assign = vi.fn();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { assign } });
    const { ProductionOperatorPortal } = await import('./production-operator-portal.js');
    const portal = ProductionOperatorPortal({
      workspace: financeWorkspace,
      pathname: '/finance/reconciliation',
    });
    const signOut = findElement(
      portal,
      (element) =>
        element.type === 'button' &&
        (element.props as { readonly children?: ReactNode }).children === 'Sign out',
    );
    if (signOut === undefined) throw new Error('expected sign-out button');
    const onClick = (signOut.props as { readonly onClick?: () => void }).onClick;
    if (onClick === undefined) throw new Error('expected sign-out action');

    onClick();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/auth/v1/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'current' }),
    });
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });

  it('mounts the production operator portal into the supplied application root', async () => {
    const root = {};
    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === 'root' ? root : null)),
    });
    const { mountProductionOperatorPortal } = await import('./production-operator-portal.js');

    mountProductionOperatorPortal(financeWorkspace, '/finance/reconciliation');

    expect(rootMocks.createRoot).toHaveBeenCalledWith(root);
    expect(rootMocks.render).toHaveBeenCalledOnce();
    const rendered = rootMocks.render.mock.calls[0]?.[0] as ReactElement | undefined;
    expect(rendered).toBeDefined();
    expect(renderToStaticMarkup(rendered)).toContain('Reconciliation');
  });

  it('fails clearly when the production operator application root is missing', async () => {
    vi.stubGlobal('document', { getElementById: vi.fn(() => null) });
    const { mountProductionOperatorPortal } = await import('./production-operator-portal.js');

    expect(() =>
      mountProductionOperatorPortal(financeWorkspace, '/finance/reconciliation'),
    ).toThrow('Root element not found');
  });
});
