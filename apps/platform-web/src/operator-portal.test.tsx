import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  currentOperatorConnectivity,
  mountOperatorPortal,
  OperatorPortal,
  operatorLandingCards,
  operatorRoleForPath,
} from './operator-portal.js';

function withBrowserState<T>(
  state: {
    readonly pathname?: string;
    readonly hostname?: string;
    readonly apiUrl?: string;
    readonly online?: boolean;
    readonly root?: unknown;
  },
  run: () => T,
): T {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __PLATFORM_API_URL__: state.apiUrl,
      location: {
        hostname: state.hostname ?? 'localhost',
        pathname: state.pathname ?? '/',
      },
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: state.online ?? true },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      getElementById() {
        return state.root ?? null;
      },
    },
  });

  try {
    return run();
  } finally {
    if (windowDescriptor === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', windowDescriptor);
    if (navigatorDescriptor === undefined) delete (globalThis as { navigator?: unknown }).navigator;
    else Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    if (documentDescriptor === undefined) delete (globalThis as { document?: unknown }).document;
    else Object.defineProperty(globalThis, 'document', documentDescriptor);
  }
}

describe('operator persona route contracts', () => {
  it('resolves operator roles from roots, child routes and trailing slashes', () => {
    expect(operatorRoleForPath('/admissions')).toBe('admissions');
    expect(operatorRoleForPath('/admissions/applications/')).toBe('admissions');
    expect(operatorRoleForPath('/finance')).toBe('finance');
    expect(operatorRoleForPath('/finance/reconciliation')).toBe('finance');
    expect(operatorRoleForPath('/support/access')).toBe('support');
    expect(operatorRoleForPath('/')).toBeUndefined();
    expect(operatorRoleForPath('/admin')).toBeUndefined();
  });

  it('publishes one complete landing card for every operator role', () => {
    const cards = operatorLandingCards();
    expect(cards.map((card) => card.role)).toEqual(['admissions', 'finance', 'support']);
    expect(cards.every((card) => card.href.startsWith('/'))).toBe(true);
    expect(cards.every((card) => card.title.length > 0 && card.detail.length > 0)).toBe(true);
  });

  it('reports browser connectivity without inventing a degraded state', () => {
    expect(withBrowserState({ online: true }, () => currentOperatorConnectivity())).toBe('online');
    expect(withBrowserState({ online: false }, () => currentOperatorConnectivity())).toBe(
      'offline',
    );
  });
});

describe('operator portal server rendering', () => {
  it('renders each role home with scoped capabilities and controlled-action copy', () => {
    const cases = [
      ['admissions', '/admissions', 'Admissions workspace'],
      ['finance', '/finance', 'Finance and cashier workspace'],
      ['support', '/support', 'Platform support workspace'],
    ] as const;

    for (const [role, path, title] of cases) {
      const html = withBrowserState({ pathname: path }, () =>
        renderToStaticMarkup(<OperatorPortal role={role} path={path} />),
      );
      expect(html).toContain(title);
      expect(html).toContain(`data-role="${role}"`);
      expect(html).toContain('explicit capabilities');
      expect(html).toContain('Audited controlled action');
      expect(html).toContain('disabled=""');
    }
  });

  it('uses role-specific child-page headings for known routes', () => {
    const cases = [
      ['admissions', '/admissions/applications', 'Application review queue'],
      ['finance', '/finance/reconciliation', 'Reconciliation queue'],
      ['support', '/support/access', 'Privileged access'],
    ] as const;
    for (const [role, path, title] of cases) {
      const html = withBrowserState({ pathname: path }, () =>
        renderToStaticMarkup(<OperatorPortal role={role} path={path} />),
      );
      expect(html).toContain(title);
      expect(html).toContain('Permission-scoped work');
    }
  });

  it('renders the shared unknown-route state inside the current operator scope', () => {
    const html = withBrowserState({ pathname: '/finance/not-a-route' }, () =>
      renderToStaticMarkup(<OperatorPortal role="finance" path="/finance/not-a-route" />),
    );
    expect(html).toContain('Page not available in this pilot');
    expect(html).toContain('href="/finance"');
  });

  it('enables refresh controls when a trimmed runtime API override is configured', () => {
    const html = withBrowserState(
      { pathname: '/support', apiUrl: ' https://api.example.test/ ' },
      () => renderToStaticMarkup(<OperatorPortal role="support" path="/support" />),
    );
    expect(html).toContain('Pilot seed data');
    expect(html).toContain('Check again');
    expect(html).not.toContain('disabled=""');
  });

  it('uses the known staging hostname API mapping when no runtime override exists', () => {
    const html = withBrowserState(
      {
        pathname: '/admissions',
        hostname: 'international-school-platform-web-staging.rahmatullahzisan.workers.dev',
      },
      () => renderToStaticMarkup(<OperatorPortal role="admissions" path="/admissions" />),
    );
    expect(html).toContain('Pilot seed data');
    expect(html).toContain('Check again');
  });
});

describe('operator portal mount guard', () => {
  it('fails clearly when the application root is missing', () => {
    expect(() => withBrowserState({}, () => mountOperatorPortal('finance'))).toThrow(
      'Root element not found',
    );
  });
});
