import {
  Children,
  isValidElement,
  type EffectCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import type * as ReactTypes from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stateMocks = vi.hoisted(() => ({
  values: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
  stateCall: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useCallback: ((callback: unknown) => callback) as typeof actual.useCallback,
    useEffect: ((effect: EffectCallback) => {
      void effect;
    }) as typeof actual.useEffect,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useState: ((initialState: unknown) => {
      const index = stateMocks.stateCall++;
      const setter = vi.fn();
      stateMocks.setters[index] = setter;
      const value = Object.prototype.hasOwnProperty.call(stateMocks.values, index)
        ? stateMocks.values[index]
        : initialState;
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installBrowser(): void {
  vi.stubGlobal('window', {
    __PLATFORM_API_URL__: ' https://api.example.test/ ',
    location: {
      hostname: 'localhost',
      pathname: '/finance',
    },
  });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => '12345678-1234-4234-8234-123456789abc'),
  });
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

async function financeCommandButton(accessToken?: string): Promise<ReactElement> {
  installBrowser();
  if (accessToken !== undefined) stateMocks.values[5] = accessToken;
  const { OperatorPortal } = await import('./operator-portal.js');
  const portal = OperatorPortal({ role: 'finance', path: '/finance' });
  const button = findElement(
    portal,
    (element) =>
      element.type === 'button' &&
      (element.props as { readonly children?: ReactNode }).children ===
        'Record reconciliation evidence',
  );
  if (button === undefined) throw new Error('expected controlled audit button');
  return button;
}

function click(button: ReactElement): void {
  const onClick = (button.props as { readonly onClick?: () => void }).onClick;
  if (onClick === undefined) throw new Error('expected controlled audit click handler');
  onClick();
}

beforeEach(() => {
  vi.resetModules();
  stateMocks.values = [];
  stateMocks.setters.length = 0;
  stateMocks.stateCall = 0;
  vi.restoreAllMocks();
});

describe('OperatorPortal controlled staging audit action', () => {
  it('submits role-scoped evidence with bearer auth and an idempotency key', async () => {
    const accessToken = 't'.repeat(40);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ receipt: { auditId: 'audit-finance-001' } }));
    vi.stubGlobal('fetch', fetchMock);
    const button = await financeCommandButton(accessToken);

    click(button);

    expect(stateMocks.setters[6]).toHaveBeenCalledWith('Recording controlled evidence…');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/pilot/v1/commands/finance/cash-session.reconcile.record',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'idempotency-key': 'pilot-finance-12345678-1234-4234-8234-123456789abc',
        },
        body: JSON.stringify({
          tenantId: 'tenant-pilot-001',
          campusId: 'campus-main',
          reason: 'E2E cashier reconciliation evidence',
        }),
      },
    );
    await vi.waitFor(() =>
      expect(stateMocks.setters[6]).toHaveBeenCalledWith(
        'Audit receipt recorded · audit-finance-001',
      ),
    );
  });

  it('surfaces a non-success response instead of inventing audit evidence', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response({}, 409)));
    const button = await financeCommandButton('t'.repeat(40));

    click(button);

    await vi.waitFor(() =>
      expect(stateMocks.setters[6]).toHaveBeenCalledWith('Controlled action returned 409.'),
    );
  });

  it('rejects a successful response that does not contain an audit receipt', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response({ receipt: {} })));
    const button = await financeCommandButton('t'.repeat(40));

    click(button);

    await vi.waitFor(() =>
      expect(stateMocks.setters[6]).toHaveBeenCalledWith(
        'Controlled action did not return audit evidence.',
      ),
    );
  });

  it('does not submit before a role-bound staging access token has been loaded', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const button = await financeCommandButton();

    click(button);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stateMocks.setters[6]).not.toHaveBeenCalled();
  });
});
