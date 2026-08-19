import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return {
    render,
    createRoot: vi.fn(() => ({ render })),
  };
});

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));

import {
  isProductionWebHost,
  mountProductionGate,
  pathBelongsToWorkspace,
  PRODUCTION_WEB_HOST,
  resolveProductionWorkspace,
  type ProductionWorkspace,
} from './production-gateway.js';

const workspace: ProductionWorkspace = {
  role: 'admin',
  path: '/admin',
  assurance: 'aal2',
  expiresAt: '2026-08-20T08:00:00Z',
  capabilities: ['sis.people.read'],
};

function stubWindow(hostname: string): void {
  vi.stubGlobal('window', { location: { hostname } });
}

function stubRoot(root: unknown = {}): void {
  vi.stubGlobal('document', {
    getElementById(id: string) {
      return id === 'root' ? root : null;
    },
  });
}

function renderedHtml(): string {
  const element = rootMocks.render.mock.calls.at(-1)?.[0] as ReactElement | undefined;
  if (element === undefined) throw new Error('expected production gate render');
  return renderToStaticMarkup(element);
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('production host and workspace path boundaries', () => {
  it('recognizes only the configured production hostname', () => {
    stubWindow(PRODUCTION_WEB_HOST);
    expect(isProductionWebHost()).toBe(true);

    stubWindow('international-school-platform-web-staging.rahmatullahzisan.workers.dev');
    expect(isProductionWebHost()).toBe(false);
  });

  it('allows only the exact authorized workspace path or its descendants', () => {
    expect(pathBelongsToWorkspace('/admin', '/admin')).toBe(true);
    expect(pathBelongsToWorkspace('/admin/academics', '/admin')).toBe(true);
    expect(pathBelongsToWorkspace('/administrator', '/admin')).toBe(false);
    expect(pathBelongsToWorkspace('/teacher', '/admin')).toBe(false);
  });
});

describe('production workspace resolution', () => {
  it('requests the current database-owned workspace without browser caching', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ schemaVersion: 1, workspace }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveProductionWorkspace()).resolves.toEqual({ state: 'current', workspace });
    expect(fetchMock).toHaveBeenCalledWith('/auth/v1/workspace', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it('maps an unauthenticated response to the anonymous state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    await expect(resolveProductionWorkspace()).resolves.toEqual({ state: 'anonymous' });
  });

  it('fails closed for server errors and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
    await expect(resolveProductionWorkspace()).resolves.toEqual({ state: 'unavailable' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unavailable');
      }),
    );
    await expect(resolveProductionWorkspace()).resolves.toEqual({ state: 'unavailable' });
  });

  it.each(
    [
      ['missing object', null],
      ['wrong schema', { schemaVersion: 2, workspace }],
      ['missing workspace', { schemaVersion: 1 }],
      ['unknown role', { schemaVersion: 1, workspace: { ...workspace, role: 'owner' } }],
      ['relative path', { schemaVersion: 1, workspace: { ...workspace, path: 'admin' } }],
      ['invalid assurance', { schemaVersion: 1, workspace: { ...workspace, assurance: 'aal3' } }],
      ['invalid expiry', { schemaVersion: 1, workspace: { ...workspace, expiresAt: 'not-a-date' } }],
      [
        'non-array capabilities',
        { schemaVersion: 1, workspace: { ...workspace, capabilities: 'sis.people.read' } },
      ],
      [
        'non-string capability',
        { schemaVersion: 1, workspace: { ...workspace, capabilities: ['sis.people.read', 7] } },
      ],
    ] as const,
  )('fails closed for %s workspace payloads', async (_label, payload) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(payload)));
    await expect(resolveProductionWorkspace()).resolves.toEqual({ state: 'unavailable' });
  });

  it('accepts every published production persona role', async () => {
    for (const role of [
      'admin',
      'teacher',
      'guardian',
      'student',
      'admissions',
      'finance',
      'support',
    ] as const) {
      const scopedWorkspace: ProductionWorkspace = { ...workspace, role, path: `/${role}` };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ schemaVersion: 1, workspace: scopedWorkspace })),
      );
      await expect(resolveProductionWorkspace()).resolves.toEqual({
        state: 'current',
        workspace: scopedWorkspace,
      });
    }
  });
});

describe('production gate rendering', () => {
  it('renders the reviewed sign-in action for anonymous users', () => {
    stubRoot();
    mountProductionGate('anonymous');

    expect(rootMocks.createRoot).toHaveBeenCalledOnce();
    const html = renderedHtml();
    expect(html).toContain('Sign in to continue');
    expect(html).toContain('href="/auth/v1/login?returnTo=%2F"');
    expect(html).toContain('Sign in with school account');
  });

  it('renders a fail-closed unavailable state without a sign-in or workspace link', () => {
    stubRoot();
    mountProductionGate('unavailable');

    const html = renderedHtml();
    expect(html).toContain('Production sign-in is not configured yet');
    expect(html).toContain('remains fail-closed');
    expect(html).not.toContain('Sign in with school account');
    expect(html).not.toContain('Open my authorized workspace');
  });

  it('renders denied access with a route back to the authorized workspace', () => {
    stubRoot();
    mountProductionGate('denied', workspace);

    const html = renderedHtml();
    expect(html).toContain('This account cannot open that workspace');
    expect(html).toContain('database role assignment');
    expect(html).toContain('href="/admin"');
    expect(html).toContain('Open my authorized workspace');
  });

  it('does not invent an authorized-workspace link when denied context has none', () => {
    stubRoot();
    mountProductionGate('denied');
    expect(renderedHtml()).not.toContain('Open my authorized workspace');
  });

  it('fails clearly when the application root is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    expect(() => mountProductionGate('anonymous')).toThrow('Root element not found');
  });
});
