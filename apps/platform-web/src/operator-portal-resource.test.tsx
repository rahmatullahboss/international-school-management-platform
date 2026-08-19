import type * as ReactTypes from 'react';
import type { EffectCallback } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
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
      return [initialState, setter];
    }) as unknown as typeof actual.useState,
  };
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installBrowser(options: { readonly online?: boolean } = {}): void {
  vi.stubGlobal('window', {
    __PLATFORM_API_URL__: ' https://api.example.test/ ',
    location: {
      hostname: 'localhost',
      pathname: '/finance',
    },
  });
  vi.stubGlobal('navigator', { onLine: options.online ?? true });
}

function runEffects(): void {
  for (const effect of reactMocks.effects.splice(0)) effect();
}

beforeEach(() => {
  vi.resetModules();
  reactMocks.effects.length = 0;
  reactMocks.setters.length = 0;
  reactMocks.stateCall = 0;
  vi.restoreAllMocks();
});

describe('OperatorPortal staging resource refresh', () => {
  it('loads a role-bound session and matching snapshot before replacing seed data', async () => {
    installBrowser();
    const accessToken = 't'.repeat(40);
    const data = {
      metrics: [{ label: 'Receipts today', value: '64', detail: 'Fresh from staging' }],
      workItems: [],
      actions: [{ label: 'Open reconciliation', href: '/finance/reconciliation' }],
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          schemaVersion: 1,
          tokenType: 'Bearer',
          accessToken,
          expiresAt: '2099-01-01T00:00:00.000Z',
          scope: {
            tenantId: 'tenant-pilot-001',
            campusId: 'campus-main',
            role: 'finance',
            subjectId: 'cashier-1',
            assurance: 'aal2',
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          schemaVersion: 1,
          generatedAt: '2026-08-19T11:30:00.000Z',
          scope: {
            tenantId: 'tenant-pilot-001',
            campusId: 'campus-main',
            role: 'finance',
            subjectId: 'cashier-1',
            assurance: 'aal2',
            capabilities: ['finance.reconciliation.write'],
          },
          data,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { OperatorPortal } = await import('./operator-portal.js');

    OperatorPortal({ role: 'finance', path: '/finance' });
    expect(reactMocks.effects).toHaveLength(1);
    runEffects();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/pilot/v1/sessions/finance',
      {
        method: 'POST',
        cache: 'no-store',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/pilot/v1/snapshots/finance',
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      },
    );
    expect(reactMocks.setters[3]).toHaveBeenCalledWith('refreshing');
    expect(reactMocks.setters[4]).toHaveBeenCalledWith(undefined);
    await vi.waitFor(() => expect(reactMocks.setters[3]).toHaveBeenCalledWith('current'));
    expect(reactMocks.setters[5]).toHaveBeenCalledWith(accessToken);
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(data);
    expect(reactMocks.setters[1]).toHaveBeenCalledWith(['finance.reconciliation.write']);
    expect(reactMocks.setters[2]).toHaveBeenCalledWith('2026-08-19T11:30:00.000Z');
  });

  it('does not contact staging while the browser is offline', async () => {
    installBrowser({ online: false });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { OperatorPortal } = await import('./operator-portal.js');

    OperatorPortal({ role: 'finance', path: '/finance' });
    runEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(reactMocks.setters[3]).not.toHaveBeenCalledWith('refreshing');
  });

  it('fails closed instead of accepting a snapshot from another operator scope', async () => {
    installBrowser();
    const accessToken = 't'.repeat(40);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          schemaVersion: 1,
          tokenType: 'Bearer',
          accessToken,
          expiresAt: '2099-01-01T00:00:00.000Z',
          scope: {
            tenantId: 'tenant-pilot-001',
            campusId: 'campus-main',
            role: 'finance',
            subjectId: 'cashier-1',
            assurance: 'aal2',
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          schemaVersion: 1,
          generatedAt: '2026-08-19T11:30:00.000Z',
          scope: {
            tenantId: 'tenant-pilot-001',
            campusId: 'campus-main',
            role: 'admissions',
            subjectId: 'admissions-1',
            assurance: 'aal2',
            capabilities: ['admissions.application.review'],
          },
          data: { metrics: [], workItems: [], actions: [] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { OperatorPortal } = await import('./operator-portal.js');

    OperatorPortal({ role: 'finance', path: '/finance' });
    runEffects();

    await vi.waitFor(() => expect(reactMocks.setters[3]).toHaveBeenCalledWith('stale'));
    expect(reactMocks.setters[4]).toHaveBeenCalledWith('Staging data scope is invalid.');
    expect(reactMocks.setters[0]).not.toHaveBeenCalled();
    expect(reactMocks.setters[5]).not.toHaveBeenCalled();
  });
});
