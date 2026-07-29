import type { ReactElement } from 'react';

import type { PilotModulePage } from './pilot-data';

export type PilotRole = 'admin' | 'teacher' | 'guardian' | 'student';
export type PilotConnectivity = 'online' | 'degraded' | 'offline';

export const roleRoots: Readonly<Record<PilotRole, string>> = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
};

export const roleLinks = [
  { label: 'Admin', href: '/admin' },
  { label: 'Teacher', href: '/teacher' },
  { label: 'Guardian', href: '/family' },
  { label: 'Student', href: '/student' },
  { label: 'Role chooser', href: '/' },
] as const;

export const roleDescriptions: Readonly<
  Record<PilotRole, { readonly title: string; readonly detail: string }>
> = {
  admin: {
    title: 'School operations overview',
    detail: 'Exceptions, approvals and governed cross-module readiness.',
  },
  teacher: {
    title: 'Today’s teaching workspace',
    detail: 'Assigned classes, attendance, gradebook work and permitted student context.',
  },
  guardian: {
    title: 'Family home',
    detail: 'Applications, children, attendance, results, fees, forms and messages.',
  },
  student: {
    title: 'Today',
    detail: 'Lessons, published progress, resources, requests and secure messages.',
  },
};

export function shellUtilityActions(activeRole: PilotRole) {
  const activeRoot = roleRoots[activeRole];
  return roleLinks
    .filter((link) => link.href === '/' || link.href !== activeRoot)
    .map((link) => ({ label: link.label, href: link.href }));
}

export function resolvePageHeading(
  role: PilotRole,
  path: string,
  page: PilotModulePage | undefined,
  fallbackTitle: string,
  fallbackDescription: string,
): { readonly title: string; readonly description: string } {
  if (path === roleRoots[role]) {
    const roleDescription = roleDescriptions[role];
    return { title: roleDescription.title, description: roleDescription.detail };
  }
  return {
    title: page?.title ?? fallbackTitle,
    description: page?.description ?? fallbackDescription,
  };
}

export function PilotModuleSurface(props: { readonly page: PilotModulePage }): ReactElement {
  return (
    <div className="pilot-module">
      <header className="pilot-module__heading">
        <p>{props.page.eyebrow}</p>
        <h2>{props.page.title}</h2>
        <span>{props.page.description}</span>
      </header>

      <section className="pilot-metrics" aria-label={`${props.page.title} summary`}>
        {props.page.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="pilot-work-queue" aria-labelledby="pilot-queue-title">
        <div>
          <p>Current work</p>
          <h3 id="pilot-queue-title">Priority queue</h3>
        </div>
        <ol>
          {props.page.queue.map((item) => (
            <li key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <span className="pilot-status">{item.status}</span>
              <a href={item.href}>Open</a>
            </li>
          ))}
        </ol>
      </section>

      <nav className="pilot-actions" aria-label={`${props.page.title} actions`}>
        {props.page.actions.map((action) => (
          <a href={action.href} key={action.label}>
            {action.label}
          </a>
        ))}
      </nav>

      <aside className="pilot-demo-note">
        <strong>Pilot data</strong>
        <span>
          This route is composed from the integrated module contracts with synthetic staging
          records. Mutating production actions remain disabled.
        </span>
      </aside>
    </div>
  );
}

export function UnknownRoute(props: { readonly homeHref: string }): ReactElement {
  return (
    <section className="pilot-unknown" role="alert">
      <p>Route not available in this pilot</p>
      <h2>The requested workspace is not composed yet.</h2>
      <a href={props.homeHref}>Return to role home</a>
    </section>
  );
}

export function PortalLoading(): ReactElement {
  return (
    <main className="pilot-loading" role="status" aria-live="polite">
      <p>Loading role workspace</p>
      <h1>Preparing permitted modules…</h1>
    </main>
  );
}
