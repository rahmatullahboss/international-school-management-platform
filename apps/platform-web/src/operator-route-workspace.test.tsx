import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import type * as ReactTypes from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactMocks = vi.hoisted(() => ({
  query: '',
  setQuery: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useState: (() => [reactMocks.query, reactMocks.setQuery]) as unknown as typeof actual.useState,
  };
});

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
  reactMocks.query = '';
  reactMocks.setQuery.mockReset();
});

describe('OperatorRouteWorkspace scoped register behavior', () => {
  it('returns no register for an unsupported operator route', async () => {
    const { OperatorRouteWorkspace } = await import('./operator-route-workspace.js');

    expect(OperatorRouteWorkspace({ role: 'support', path: '/support/unknown' })).toBeNull();
  });

  it('filters the admissions register case-insensitively without leaking non-matching rows', async () => {
    reactMocks.query = '  RAHMAN  ';
    const { OperatorRouteWorkspace } = await import('./operator-route-workspace.js');
    const element = OperatorRouteWorkspace({ role: 'admissions', path: '/admissions/enquiries' });
    if (element === null) throw new Error('expected admissions enquiry register');
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Rahman family · Aya Rahman');
    expect(html).not.toContain('Hasan family · Karim Hasan');
    expect(html).toContain('Search enquiries');
    expect(html).not.toContain('operator-register__boundary');
  });

  it('renders a clear empty result when no scoped row matches the current search', async () => {
    reactMocks.query = 'no-such-family';
    const { OperatorRouteWorkspace } = await import('./operator-route-workspace.js');
    const element = OperatorRouteWorkspace({ role: 'finance', path: '/finance/cashier' });
    if (element === null) throw new Error('expected finance receipt register');
    const html = renderToStaticMarkup(element);

    expect(html).toContain('No records match the current filters.');
    expect(html).not.toContain('RCPT-2026-0631');
    expect(html).not.toContain('RCPT-2026-0629');
  });

  it('shows production-boundary guidance on guarded staging routes', async () => {
    const { OperatorRouteWorkspace } = await import('./operator-route-workspace.js');
    const element = OperatorRouteWorkspace({
      role: 'finance',
      path: '/finance/reconciliation',
    });
    if (element === null) throw new Error('expected reconciliation register');
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Production matching uses the database-owned reconciliation queue');
    expect(html).toContain('BANK-TRX-8821');
  });

  it('updates the local search query from the scoped register search input', async () => {
    const { OperatorRouteWorkspace } = await import('./operator-route-workspace.js');
    const element = OperatorRouteWorkspace({ role: 'support', path: '/support/health' });
    if (element === null) throw new Error('expected support health register');
    const input = findElement(element, (candidate) => candidate.type === 'input');
    if (input === undefined) throw new Error('expected register search input');
    const onChange = (
      input.props as {
        readonly onChange?: (event: { readonly currentTarget: { readonly value: string } }) => void;
      }
    ).onChange;
    if (onChange === undefined) throw new Error('expected register search change handler');

    onChange({ currentTarget: { value: 'latency' } });

    expect(reactMocks.setQuery).toHaveBeenCalledWith('latency');
  });
});
