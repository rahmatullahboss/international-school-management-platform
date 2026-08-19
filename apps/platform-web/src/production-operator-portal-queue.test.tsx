import type * as ReactTypes from 'react';
import type { EffectCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductionWorkspace } from './production-gateway.js';
import type { ProductionOperatorWorkQueue } from './production-operator-work-queue.js';

const stateMocks = vi.hoisted(() => ({
  calls: 0,
  workQueue: undefined as ProductionOperatorWorkQueue | undefined,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useEffect: ((effect: EffectCallback) => {
      void effect;
    }) as typeof actual.useEffect,
    useState: ((initialState: unknown) => {
      stateMocks.calls += 1;
      const value = stateMocks.calls === 3 ? stateMocks.workQueue : initialState;
      return [value, vi.fn()];
    }) as unknown as typeof actual.useState,
  };
});

const financeWorkspace: ProductionWorkspace = {
  role: 'finance',
  path: '/finance/reconciliation',
  assurance: 'aal2',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: ['finance.reconciliation.write'],
};

const financeCandidate = {
  bankStatementLineId: '11111111-1111-4111-8111-111111111111',
  bookingDate: '2026-08-19',
  amountMinor: '125000',
  currency: 'BDT',
  paymentId: '22222222-2222-4222-8222-222222222222',
  paymentReceivedAt: '2026-08-19T05:30:00.000Z',
} as const;

async function renderFinance(workspace: ProductionWorkspace = financeWorkspace): Promise<string> {
  stateMocks.calls = 0;
  const { ProductionOperatorPortal } = await import('./production-operator-portal.js');
  return renderToStaticMarkup(
    <ProductionOperatorPortal workspace={workspace} pathname="/finance/reconciliation" />,
  );
}

beforeEach(() => {
  stateMocks.calls = 0;
  stateMocks.workQueue = undefined;
});

describe('ProductionOperatorPortal finance queue states', () => {
  it('fails closed when the signed-in finance role lacks reconciliation permission', async () => {
    const html = await renderFinance({ ...financeWorkspace, capabilities: [] });

    expect(html).toContain('Action not granted');
    expect(html).toContain('finance.reconciliation.write');
    expect(html).not.toContain('Current reconciliation candidate');
  });

  it('renders an unavailable work queue without exposing an actionable candidate', async () => {
    stateMocks.workQueue = {
      state: 'unavailable',
      message: 'Database queue temporarily unavailable.',
    };

    const html = await renderFinance();

    expect(html).toContain('Work queue unavailable');
    expect(html).toContain('Database queue temporarily unavailable.');
    expect(html).toContain('disabled=""');
  });

  it('renders the empty database-owned queue state', async () => {
    stateMocks.workQueue = { state: 'ready', role: 'finance', items: [] };

    const html = await renderFinance();

    expect(html).toContain('No current candidates');
    expect(html).toContain('There is no eligible work in the current database-owned scope.');
  });

  it('renders only the finance candidates returned by the server-owned work queue', async () => {
    stateMocks.workQueue = { state: 'ready', role: 'finance', items: [financeCandidate] };

    const html = await renderFinance();

    expect(html).toContain('Work queue');
    expect(html).toContain('Ready to match');
    expect(html).toContain('BDT 125000 minor units');
    expect(html).toContain(`${financeCandidate.bankStatementLineId}:${financeCandidate.paymentId}`);
    expect(html).toContain('<button type="submit">Submit reviewed command</button>');
  });
});
