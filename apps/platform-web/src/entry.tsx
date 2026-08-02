import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import { mountOperatorPortal, operatorLandingCards, operatorRoleForPath } from './operator-portal';
import {
  isProductionWebHost,
  mountProductionGate,
  pathBelongsToWorkspace,
  resolveProductionWorkspace,
} from './production-gateway';
import { mountProductionOperatorPortal } from './production-operator-portal';
import './operator-route-workspace.css';
import './pilot.css';
import './styles.css';

function FullPersonaLanding(): ReactElement {
  const operatorCards = operatorLandingCards();
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
          <nav className="pilot-role-grid" aria-label="Primary navigation">
            {coreCards.map((card) => (
              <a className="pilot-role-card" data-role={card.role} href={card.href} key={card.role}>
                <span className="pilot-role-card__number">{card.number}</span>
                <h3>{card.title}</h3>
                <p>{card.detail}</p>
                <strong>{card.action}</strong>
              </a>
            ))}
            {operatorCards.map((card, index) => (
              <a className="pilot-role-card" data-role={card.role} href={card.href} key={card.role}>
                <span className="pilot-role-card__number">0{index + 5}</span>
                <h3>{card.title}</h3>
                <p>{card.detail}</p>
                <strong>{card.action}</strong>
              </a>
            ))}
          </nav>
        </section>

        <section className="pilot-coverage" aria-labelledby="pilot-coverage-title">
          <div className="pilot-section-heading">
            <p>What the platform covers</p>
            <h2 id="pilot-coverage-title">Common school work, clearly organised</h2>
          </div>
          <div className="pilot-coverage__grid">
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
              <article key={title}>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const normalizedPath =
  window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/+$/u, '');

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
    mountOperatorPortal(operatorRole);
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
