import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import {
  isProductionWebHost,
  mountProductionGate,
  pathBelongsToWorkspace,
  resolveProductionWorkspace,
} from './production-gateway';
import { mountProductionOperatorPortal } from './production-operator-portal';
import './pilot.css';
import './styles.css';

type OperatorLandingRole = 'admissions' | 'finance' | 'support';

interface OperatorLandingCard {
  readonly role: OperatorLandingRole;
  readonly href: string;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
}

function FullPersonaLanding(): ReactElement {
  const operatorCards: readonly OperatorLandingCard[] = [
    {
      role: 'admissions',
      href: '/admissions',
      title: 'Admissions staff',
      detail: 'Process enquiries, applications, interviews, offers and enrolment conversion.',
      action: 'Go to admissions',
    },
    {
      role: 'finance',
      href: '/finance',
      title: 'Finance or cashier',
      detail:
        'Handle invoices, receipts, cashier sessions and reconciliation with least privilege.',
      action: 'Go to finance',
    },
    {
      role: 'support',
      href: '/support',
      title: 'Platform support',
      detail: 'Diagnose tenant and deployment health through explicit audited support scope.',
      action: 'Go to support',
    },
  ];
  const coreCards = [
    {
      role: 'admin',
      href: '/admin',
      number: '01',
      title: 'School administrator',
      detail: 'Review attendance, school-wide operations, reports and urgent exceptions.',
      action: 'Go to administration',
    },
    {
      role: 'teacher',
      href: '/teacher',
      number: '02',
      title: 'Teacher',
      detail: 'See today’s classes, take attendance, update grades and contact families.',
      action: 'Go to teacher workspace',
    },
    {
      role: 'guardian',
      href: '/family',
      number: '03',
      title: 'Parent or guardian',
      detail: 'Check children, attendance, results, fees, forms, documents and messages.',
      action: 'Go to family portal',
    },
    {
      role: 'student',
      href: '/student',
      number: '04',
      title: 'Student',
      detail: 'View lessons, attendance, results, learning resources and school requests.',
      action: 'Go to student portal',
    },
  ] as const;

  return (
    <div className="pilot-entry">
      <a className="pilot-skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="pilot-entry__masthead">
        <div>
          <p className="pilot-kicker">Cloudflare staging · synthetic pilot data</p>
          <h1>Run the school day from one place</h1>
          <p>
            Choose a role to see the work, records and decisions available to that person. Every
            workspace is permission-scoped and designed around familiar school tasks.
          </p>
        </div>
        <div className="pilot-entry__status" role="status">
          <strong>Safe pilot environment</strong>
          <span>No production data or live payments</span>
          <a href="/offline.html">See offline support</a>
        </div>
      </header>

      <main id="main-content" className="pilot-entry__main" tabIndex={-1}>
        <section aria-labelledby="pilot-role-title">
          <div className="pilot-section-heading">
            <p>Start here</p>
            <h2 id="pilot-role-title">Who are you working as?</h2>
            <span>Open the workspace that matches the job you need to complete.</span>
          </div>
          <nav className="pilot-role-register" aria-label="Primary role navigation">
            {coreCards.map((card) => (
              <a className="pilot-role-row" data-role={card.role} href={card.href} key={card.role}>
                <span className="pilot-role-row__number">{card.number}</span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </div>
                <small>Permission scoped</small>
                <strong>Enter workspace</strong>
              </a>
            ))}
          </nav>

          {operatorCards.length === 0 ? null : (
            <section className="pilot-operator-workspaces" aria-labelledby="pilot-operator-title">
              <header>
                <h3 id="pilot-operator-title">Specialist operator workspaces</h3>
                <p>
                  Time-bound operational roles remain separate from the four primary school
                  personas.
                </p>
              </header>
              <nav className="pilot-operator-register" aria-label="Specialist operator navigation">
                {operatorCards.map((card, index) => (
                  <a href={card.href} key={card.role}>
                    <span>0{index + 5}</span>
                    <div>
                      <strong>{card.title}</strong>
                      <small>{card.detail}</small>
                    </div>
                    <b>{card.action}</b>
                  </a>
                ))}
              </nav>
            </section>
          )}
        </section>

        <section className="pilot-coverage" aria-labelledby="pilot-coverage-title">
          <div className="pilot-section-heading">
            <p>What the platform covers</p>
            <h2 id="pilot-coverage-title">Common school work, clearly organised</h2>
          </div>
          <dl className="pilot-platform-index">
            {[
              ['Students and admissions', 'People, households, applications and enrolment'],
              ['Teaching and learning', 'Curriculum, timetable, attendance, grades and records'],
              ['Fees and accounting', 'Billing, payments, ledger, reconciliation and reports'],
              ['School services', 'Staff, purchasing, assets, library, transport and activities'],
              ['Student support', 'Health, wellbeing, safeguarding and learning support'],
              ['Communication', 'Messages, announcements, forms, documents and notifications'],
              ['Integrations', 'Imports, country settings, OneRoster, LTI, SSO and webhooks'],
              [
                'Trust and governance',
                'Permissions, audit history, isolation and recovery evidence',
              ],
            ].map(([title, detail]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}

const normalizedPath =
  window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/+$/u, '');

function operatorRoleForPath(pathname: string): OperatorLandingRole | undefined {
  if (pathname === '/admissions' || pathname.startsWith('/admissions/')) return 'admissions';
  if (pathname === '/finance' || pathname.startsWith('/finance/')) return 'finance';
  if (pathname === '/support' || pathname.startsWith('/support/')) return 'support';
  return undefined;
}

function installHomeNavigationHandler(): void {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (anchor === null) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== '/') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/');
    },
    true,
  );
}

async function bootstrapProduction(): Promise<void> {
  const resolution = await resolveProductionWorkspace();
  if (resolution.state !== 'current') {
    mountProductionGate(resolution.state);
    return;
  }
  const { workspace } = resolution;
  if (normalizedPath === '/') {
    window.location.replace(workspace.path);
    return;
  }
  if (!pathBelongsToWorkspace(normalizedPath, workspace.path)) {
    mountProductionGate('denied', workspace);
    return;
  }
  if (
    workspace.role === 'admissions' ||
    workspace.role === 'finance' ||
    workspace.role === 'support'
  ) {
    mountProductionOperatorPortal(workspace, normalizedPath);
    return;
  }
  installHomeNavigationHandler();
  await import('./main');
}

if (isProductionWebHost()) {
  void bootstrapProduction();
} else {
  const operatorRole = operatorRoleForPath(normalizedPath);
  if (operatorRole !== undefined) {
    void import('./operator-portal').then(({ mountOperatorPortal }) =>
      mountOperatorPortal(operatorRole),
    );
  } else if (normalizedPath === '/') {
    const root = document.getElementById('root');
    if (root === null) throw new Error('Root element not found');
    createRoot(root).render(
      <StrictMode>
        <FullPersonaLanding />
      </StrictMode>,
    );
  } else {
    installHomeNavigationHandler();
    void import('./main');
  }
}
