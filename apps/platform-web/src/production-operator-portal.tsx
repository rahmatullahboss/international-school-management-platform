import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import type { ProductionWorkspace } from './production-gateway';
import './pilot.css';
import './styles.css';

type OperatorRole = Extract<ProductionWorkspace['role'], 'admissions' | 'finance' | 'support'>;

const operatorConfig: Readonly<
  Record<
    OperatorRole,
    {
      readonly title: string;
      readonly description: string;
      readonly routes: readonly {
        readonly href: string;
        readonly label: string;
        readonly detail: string;
      }[];
    }
  >
> = {
  admissions: {
    title: 'Admissions workspace',
    description:
      'Review enquiries, applications and enrolment work within the current school scope.',
    routes: [
      {
        href: '/admissions/enquiries',
        label: 'Enquiries',
        detail: 'Prospective-family enquiry workflow',
      },
      {
        href: '/admissions/applications',
        label: 'Applications',
        detail: 'Application review and evidence',
      },
      {
        href: '/admissions/interviews',
        label: 'Interviews',
        detail: 'Interview scheduling and review',
      },
    ],
  },
  finance: {
    title: 'Finance and cashier workspace',
    description: 'Work with invoices, cashier sessions and reconciliation under explicit grants.',
    routes: [
      { href: '/finance/invoices', label: 'Invoices', detail: 'Invoice and statement context' },
      { href: '/finance/cashier', label: 'Cashier', detail: 'Receipt and cashier-session work' },
      {
        href: '/finance/reconciliation',
        label: 'Reconciliation',
        detail: 'Reviewed payment matching',
      },
    ],
  },
  support: {
    title: 'Platform support workspace',
    description: 'Use tenant-scoped diagnostics and audited privileged-access requests.',
    routes: [
      {
        href: '/support/tenants',
        label: 'Tenant scope',
        detail: 'Explicit support tenant selection',
      },
      {
        href: '/support/health',
        label: 'Deployment health',
        detail: 'Approved operational diagnostics',
      },
      {
        href: '/support/access',
        label: 'Privileged access',
        detail: 'Purpose-bound AAL2 support access',
      },
    ],
  },
};

function ProductionOperatorPortal(props: {
  readonly workspace: ProductionWorkspace;
  readonly pathname: string;
}): ReactElement {
  const role = props.workspace.role as OperatorRole;
  const config = operatorConfig[role];
  const active = config.routes.find((route) => route.href === props.pathname);
  const signOut = (): void => {
    void fetch('/auth/v1/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'current' }),
    }).finally(() => window.location.assign('/'));
  };

  return (
    <div className="pilot-entry" data-role={role}>
      <header className="pilot-entry__masthead">
        <div>
          <p className="pilot-kicker">
            Ozzyl International Demo School · authenticated production QA
          </p>
          <h1>{active?.label ?? config.title}</h1>
          <p>{active?.detail ?? config.description}</p>
        </div>
        <div className="pilot-entry__status">
          <strong>{role}</strong>
          <span>{props.workspace.capabilities.length} current database capabilities</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="pilot-entry__main" id="main-content" tabIndex={-1}>
        <nav className="pilot-actions" aria-label={`${config.title} navigation`}>
          {config.routes.map((route) => (
            <a
              href={route.href}
              key={route.href}
              aria-current={route.href === props.pathname ? 'page' : undefined}
            >
              {route.label}
            </a>
          ))}
        </nav>
        <section className="pilot-demo-note">
          <strong>Database-authorized production surface</strong>
          <span>
            Synthetic pilot sessions and synthetic operator metrics are disabled here. Domain writes
            remain governed by the reviewed database command contracts.
          </span>
        </section>
        <section className="pilot-coverage" aria-labelledby="capability-title">
          <div className="pilot-section-heading">
            <p>Current grants</p>
            <h2 id="capability-title">Capabilities for this signed-in account</h2>
          </div>
          <div className="pilot-coverage__grid">
            {props.workspace.capabilities.map((capability) => (
              <article key={capability}>
                <h3>{capability}</h3>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export function mountProductionOperatorPortal(
  workspace: ProductionWorkspace,
  pathname: string,
): void {
  const root = document.getElementById('root');
  if (root === null) throw new Error('Root element not found');
  createRoot(root).render(
    <StrictMode>
      <ProductionOperatorPortal workspace={workspace} pathname={pathname} />
    </StrictMode>,
  );
}
