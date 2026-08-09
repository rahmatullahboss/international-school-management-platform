import type { ReactElement } from 'react';

import type { PilotModulePage } from './pilot-data';
import { GuidedWalkthrough } from './guided-walkthrough';
import './pilot-resource.css';
import './pilot-ux.css';

export type PilotRole = 'admin' | 'teacher' | 'guardian' | 'student';
export type PilotConnectivity = 'online' | 'degraded' | 'offline';

export const roleRoots: Readonly<Record<PilotRole, string>> = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
};

export const roleDescriptions: Readonly<
  Record<PilotRole, { readonly title: string; readonly detail: string }>
> = {
  admin: {
    title: 'School operations overview',
    detail: 'See urgent work, approvals and school-wide exceptions in one place.',
  },
  teacher: {
    title: 'Today’s teaching workspace',
    detail: 'Move through classes, attendance, grading and student follow-up.',
  },
  guardian: {
    title: 'Family home',
    detail: 'Manage children, attendance, results, fees, forms and messages.',
  },
  student: {
    title: 'Today',
    detail: 'See lessons, published progress, resources, requests and messages.',
  },
};

export function shellUtilityActions(activeRole: PilotRole) {
  void activeRole;
  return [] as const;
}

export function PilotDataStatus(props: {
  readonly state: 'seed' | 'cached' | 'refreshing' | 'current' | 'stale';
  readonly apiConfigured: boolean;
  readonly updatedAt: string;
  readonly message: string | undefined;
  readonly onRefresh: () => void;
}): ReactElement {
  const copy =
    props.state === 'refreshing'
      ? {
          label: 'Checking for updates',
          detail: 'Current data stays visible while the staging API is revalidated.',
        }
      : props.state === 'stale'
        ? {
            label: 'Using saved data',
            detail: props.message ?? 'Fresh data is temporarily unavailable.',
          }
        : props.state === 'cached'
          ? {
              label: 'Saved scoped data',
              detail: 'This role’s last verified snapshot is available while an update is checked.',
            }
          : props.state === 'current'
            ? {
                label: 'Current from staging API',
                detail: 'Tenant, campus, role and subject scope were verified by the Worker.',
              }
            : {
                label: 'Initial scoped data',
                detail:
                  'A scoped staging snapshot will replace this initial view without blocking the page.',
              };

  return (
    <>
      {props.apiConfigured ? (
        <aside
          className="pilot-data-status"
          data-state={props.state}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          <div>
            <strong>{copy.label}</strong>
            <p>{copy.detail}</p>
            <time dateTime={props.updatedAt}>Evidence current at {props.updatedAt}</time>
          </div>
          {props.state === 'refreshing' ? null : (
            <button type="button" onClick={props.onRefresh}>
              Check again
            </button>
          )}
        </aside>
      ) : null}
      <GuidedWalkthrough />
    </>
  );
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

      <nav className="pilot-actions" aria-label={`${props.page.title} common actions`}>
        <div>
          <span>Common actions</span>
          <strong>What would you like to do?</strong>
        </div>
        {props.page.actions.map((action, index) => (
          <a
            data-emphasis={index === 0 ? 'primary' : 'secondary'}
            href={action.href}
            key={action.label}
          >
            {action.label}
          </a>
        ))}
      </nav>

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
          <p>Needs attention</p>
          <h3 id="pilot-queue-title">Priority work</h3>
          <span>Start with these items, ordered by urgency.</span>
        </div>
        <ol>
          {props.page.queue.map((item) => (
            <li key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <span className="pilot-status">{item.status}</span>
              <a href={item.href} aria-label={`Review ${item.title}`}>
                Review
              </a>
            </li>
          ))}
        </ol>
      </section>

      <aside className="pilot-demo-note">
        <strong>Workspace information</strong>
        <span>
          This staging workspace uses sample school records. Payment submission, publication,
          restricted-data changes and final approvals remain unavailable here.
        </span>
      </aside>
    </div>
  );
}

export function UnknownRoute(props: { readonly homeHref: string }): ReactElement {
  return (
    <section className="pilot-unknown" role="alert">
      <p>Page not available</p>
      <h2>This task is not available in your current workspace.</h2>
      <a href={props.homeHref}>Return to workspace home</a>
    </section>
  );
}

export function PortalLoading(props: { readonly role: PilotRole }): ReactElement {
  return (
    <div className="pilot-boot-shell" data-role={props.role} role="status" aria-live="polite">
      <aside aria-hidden="true">
        <div className="pilot-boot-shell__brand" />
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </aside>
      <main>
        <p>Opening {roleDescriptions[props.role].title.toLowerCase()}</p>
        <h1>Your workspace is almost ready</h1>
        <div className="pilot-boot-shell__heading" aria-hidden="true" />
        <div className="pilot-boot-shell__content" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    </div>
  );
}
