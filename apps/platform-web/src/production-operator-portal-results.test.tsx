import type * as ReactTypes from 'react';
import type { EffectCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductionWorkspace } from './production-gateway.js';
import type { ProductionOperatorCommandResult } from './production-operator-command.js';

const stateMocks = vi.hoisted(() => ({
  values: [] as unknown[],
  call: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useEffect: ((effect: EffectCallback) => {
      void effect;
    }) as typeof actual.useEffect,
    useState: ((initialState: unknown) => {
      const index = stateMocks.call++;
      const injected = stateMocks.values[index];
      return [injected === undefined ? initialState : injected, vi.fn()];
    }) as unknown as typeof actual.useState,
  };
});

const supportWorkspace: ProductionWorkspace = {
  role: 'support',
  path: '/support/access',
  assurance: 'aal2',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: ['support.break-glass.request'],
};

async function renderSupport(
  result: ProductionOperatorCommandResult | undefined,
  pending = false,
): Promise<string> {
  stateMocks.values = [pending, result, undefined];
  stateMocks.call = 0;
  const { ProductionOperatorPortal } = await import('./production-operator-portal.js');
  return renderToStaticMarkup(
    <ProductionOperatorPortal workspace={supportWorkspace} pathname="/support/access" />,
  );
}

beforeEach(() => {
  vi.resetModules();
  stateMocks.values = [];
  stateMocks.call = 0;
});

describe('ProductionOperatorPortal command feedback', () => {
  it('renders an accepted command receipt with immutable evidence identifiers', async () => {
    const html = await renderSupport({
      state: 'accepted',
      replayed: false,
      commandId: '33333333-3333-4333-8333-333333333333',
      evidenceId: '44444444-4444-4444-8444-444444444444',
      acceptedAt: '2026-08-19T06:00:00.000Z',
    });

    expect(html).toContain('Command accepted');
    expect(html).toContain('Command 33333333-3333-4333-8333-333333333333');
    expect(html).toContain('Evidence 44444444-4444-4444-8444-444444444444');
  });

  it('distinguishes an idempotent replay from a newly accepted command', async () => {
    const html = await renderSupport({
      state: 'accepted',
      replayed: true,
      commandId: '55555555-5555-4555-8555-555555555555',
      evidenceId: '66666666-6666-4666-8666-666666666666',
      acceptedAt: '2026-08-19T06:05:00.000Z',
    });

    expect(html).toContain('Existing receipt verified');
    expect(html).not.toContain('Command accepted');
  });

  it('surfaces AAL2 and current-version context for rejected privileged work', async () => {
    const html = await renderSupport({
      state: 'rejected',
      code: 'ASSURANCE_REQUIRED',
      message: 'Fresh authentication is required.',
      requiredAssurance: 'aal2',
      currentVersion: 7,
    });

    expect(html).toContain('Fresh authentication is required.');
    expect(html).toContain('Code: ASSURANCE_REQUIRED');
    expect(html).toContain('Fresh AAL2 authentication is required before this privileged request.');
    expect(html).toContain('Current record version: 7');
  });

  it('renders unavailable service feedback and a submitting state without inventing success', async () => {
    const unavailable = await renderSupport({
      state: 'unavailable',
      message: 'Command service is unavailable.',
    });
    const pending = await renderSupport(undefined, true);

    expect(unavailable).toContain('Command unavailable');
    expect(unavailable).toContain('Command service is unavailable.');
    expect(unavailable).not.toContain('Command accepted');
    expect(pending).toContain('Submitting…');
    expect(pending).toContain('disabled=""');
  });
});
