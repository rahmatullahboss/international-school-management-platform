import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PilotModulePage } from './pilot-data.js';
import {
  PilotDataStatus,
  PortalLoading,
  resolvePageHeading,
  roleDescriptions,
  roleRoots,
  shellUtilityActions,
  UnknownRoute,
} from './portal-shared.js';

const page: PilotModulePage = {
  eyebrow: 'Academics',
  title: 'Academic operations',
  description: 'Manage the academic day.',
  metrics: [],
  queue: [],
  actions: [],
};

function withPath<T>(pathname: string, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { pathname } },
  });
  try {
    return run();
  } finally {
    if (descriptor === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', descriptor);
  }
}

function renderDataStatus(
  state: 'seed' | 'cached' | 'refreshing' | 'current' | 'stale',
  options: { readonly apiConfigured?: boolean; readonly message?: string } = {},
): string {
  return withPath('/admin', () =>
    renderToStaticMarkup(
      <PilotDataStatus
        state={state}
        apiConfigured={options.apiConfigured ?? true}
        updatedAt="2026-08-19T07:00:00Z"
        message={options.message}
        onRefresh={vi.fn()}
      />,
    ),
  );
}

describe('shared portal role contracts', () => {
  it('keeps roots, descriptions and utility actions defined for each principal role', () => {
    for (const role of ['admin', 'teacher', 'guardian', 'student'] as const) {
      expect(roleRoots[role]).toMatch(/^\//u);
      expect(roleDescriptions[role].title.length).toBeGreaterThan(0);
      expect(roleDescriptions[role].detail.length).toBeGreaterThan(0);
      expect(shellUtilityActions(role)).toEqual([]);
    }
  });

  it('resolves role-home, module and fallback headings', () => {
    expect(resolvePageHeading('admin', '/admin', page, 'Fallback', 'Fallback detail')).toEqual({
      title: roleDescriptions.admin.title,
      description: roleDescriptions.admin.detail,
    });
    expect(
      resolvePageHeading('admin', '/admin/academics', page, 'Fallback', 'Fallback detail'),
    ).toEqual({ title: page.title, description: page.description });
    expect(
      resolvePageHeading('admin', '/admin/missing', undefined, 'Fallback', 'Fallback detail'),
    ).toEqual({ title: 'Fallback', description: 'Fallback detail' });
  });
});

describe('shared portal data status', () => {
  it('renders every freshness state with current copy and refresh behavior', () => {
    const cases = [
      ['refreshing', 'Checking for updates', false],
      ['stale', 'Using saved data', true],
      ['cached', 'Saved scoped data', true],
      ['current', 'Current from staging API', true],
      ['seed', 'Initial scoped data', true],
    ] as const;

    for (const [state, label, hasRefresh] of cases) {
      const html =
        state === 'stale'
          ? renderDataStatus(state, { message: 'Temporary outage' })
          : renderDataStatus(state);
      expect(html).toContain(label);
      expect(html.includes('Check again')).toBe(hasRefresh);
      expect(html).toContain('2026-08-19T07:00:00Z');
    }
  });

  it('uses the stale fallback when no outage message is available', () => {
    expect(renderDataStatus('stale')).toContain('Fresh data is temporarily unavailable.');
  });

  it('hides API freshness status when no API is configured while keeping guidance available', () => {
    const html = renderDataStatus('seed', { apiConfigured: false });
    expect(html).not.toContain('pilot-data-status');
    expect(html).toContain('Show walkthrough');
  });
});

describe('shared portal route states', () => {
  it('renders the current unknown-route recovery contract', () => {
    const html = renderToStaticMarkup(<UnknownRoute homeHref="/admin" />);
    expect(html).toContain('Page not available');
    expect(html).toContain('This task is not available in your current workspace.');
    expect(html).toContain('href="/admin"');
    expect(html).toContain('Return to workspace home');
  });

  it('renders a role-scoped loading shell for every principal role', () => {
    for (const role of ['admin', 'teacher', 'guardian', 'student'] as const) {
      const html = renderToStaticMarkup(<PortalLoading role={role} />);
      expect(html).toContain(`data-role="${role}"`);
      expect(html).toContain(roleDescriptions[role].title.toLowerCase());
      expect(html).toContain('Your workspace is almost ready');
    }
  });
});
