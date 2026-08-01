import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PilotModulePage } from './pilot-data.js';
import {
  PilotDataStatus,
  PilotModuleSurface,
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
  metrics: [{ label: 'Classes', value: '44', detail: 'Today' }],
  queue: [
    {
      title: 'Finalise register',
      detail: 'One register remains open.',
      status: 'Ready',
      href: '/admin/academics',
    },
  ],
  actions: [
    { label: 'Open timetable', href: '/admin/academics' },
    { label: 'Review records', href: '/admin/academics' },
  ],
};

describe('shared pilot portal rendering', () => {
  it('keeps role roots, descriptions and utility actions defined for every principal role', () => {
    for (const role of ['admin', 'teacher', 'guardian', 'student'] as const) {
      expect(roleRoots[role]).toMatch(/^\//);
      expect(roleDescriptions[role].title.length).toBeGreaterThan(0);
      expect(roleDescriptions[role].detail.length).toBeGreaterThan(0);
      expect(shellUtilityActions(role)).toEqual([]);
    }
  });

  it('hides API status when the API is not configured', () => {
    expect(
      PilotDataStatus({
        state: 'seed',
        apiConfigured: false,
        updatedAt: '2026-08-01T00:00:00Z',
        message: undefined,
        onRefresh: vi.fn(),
      }),
    ).toBeNull();
  });

  it('renders each API data state with the correct copy and refresh affordance', () => {
    const cases = [
      ['refreshing', 'Checking for updates', false],
      ['stale', 'Using saved data', true],
      ['cached', 'Saved scoped data', true],
      ['current', 'Current from staging API', true],
      ['seed', 'Pilot seed data', true],
    ] as const;

    for (const [state, label, hasButton] of cases) {
      const html = renderToStaticMarkup(
        <PilotDataStatus
          state={state}
          apiConfigured
          updatedAt="2026-08-01T00:00:00Z"
          message={state === 'stale' ? 'Temporary outage' : undefined}
          onRefresh={vi.fn()}
        />,
      );
      expect(html).toContain(label);
      expect(html.includes('Check again')).toBe(hasButton);
      expect(html).toContain('2026-08-01T00:00:00Z');
    }

    const staleFallback = renderToStaticMarkup(
      <PilotDataStatus
        state="stale"
        apiConfigured
        updatedAt="2026-08-01T00:00:00Z"
        message={undefined}
        onRefresh={vi.fn()}
      />,
    );
    expect(staleFallback).toContain('Fresh data is temporarily unavailable.');
  });

  it('resolves role-home, module and fallback headings', () => {
    expect(resolvePageHeading('admin', '/admin', page, 'Fallback', 'Fallback detail')).toEqual(
      roleDescriptions.admin,
    );
    expect(
      resolvePageHeading('admin', '/admin/academics', page, 'Fallback', 'Fallback detail'),
    ).toEqual({ title: page.title, description: page.description });
    expect(
      resolvePageHeading('admin', '/admin/missing', undefined, 'Fallback', 'Fallback detail'),
    ).toEqual({ title: 'Fallback', description: 'Fallback detail' });
  });

  it('renders module surfaces, unknown routes and loading states', () => {
    const moduleHtml = renderToStaticMarkup(<PilotModuleSurface page={page} />);
    expect(moduleHtml).toContain('Academic operations');
    expect(moduleHtml).toContain('data-emphasis="primary"');
    expect(moduleHtml).toContain('data-emphasis="secondary"');
    expect(moduleHtml).toContain('Finalise register');
    expect(moduleHtml).toContain('Pilot information');

    const unknownHtml = renderToStaticMarkup(<UnknownRoute homeHref="/admin" />);
    expect(unknownHtml).toContain('Page not available in this pilot');
    expect(unknownHtml).toContain('href="/admin"');

    for (const role of ['admin', 'teacher', 'guardian', 'student'] as const) {
      const loadingHtml = renderToStaticMarkup(<PortalLoading role={role} />);
      expect(loadingHtml).toContain(`data-role="${role}"`);
      expect(loadingHtml).toContain(roleDescriptions[role].title.toLowerCase());
    }
  });
});
