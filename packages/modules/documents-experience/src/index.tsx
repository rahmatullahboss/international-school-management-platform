/*
THESIS: One school day should feel continuous across roles, not like a collection of disconnected modules.
OWN-WORLD: Institutional paper, ink-blue structure, teal action language and amber operational exceptions.
STORY: A person enters through their role, sees trusted system state, and reaches only the work they can perform.
FIRST VIEWPORT: Identity and session context sit beside capability-filtered navigation and the current task surface.
FORM: Established Operate world extended as a stable responsive rail; no dashboard-card wall or modal-first navigation.
*/
import type { ReactElement, ReactNode } from 'react';

export type ExperiencePersona = 'admin' | 'teacher' | 'guardian' | 'student';
export type ExperienceDirection = 'ltr' | 'rtl';
export type ExperienceState = 'ready' | 'loading' | 'error';
export type ConnectivityState = 'online' | 'offline' | 'syncing' | 'degraded';

export interface ExperienceNavigationItem {
  id: string;
  label: string;
  href: string;
  description: string;
  capability?: string;
  badge?: string | number;
}

export interface ExperienceSessionSummary {
  assurance: 'aal1' | 'aal2';
  deviceLabel: string;
  expiresAt: string;
}

export interface ExperienceConnectivity {
  state: ConnectivityState;
  pendingChanges: number;
  lastSyncedAt?: string;
  retryHref?: string;
}

export interface ExperienceUtilityAction {
  label: string;
  href: string;
  capability?: string;
}

export interface ExperienceShellProps {
  persona: ExperiencePersona;
  schoolName: string;
  userName: string;
  locale: string;
  direction?: ExperienceDirection;
  pageTitle: string;
  pageDescription: string;
  navigation: readonly ExperienceNavigationItem[];
  activeHref: string;
  capabilities: readonly string[];
  session: ExperienceSessionSummary;
  connectivity: ExperienceConnectivity;
  utilityActions?: readonly ExperienceUtilityAction[];
  state?: ExperienceState;
  errorTitle?: string;
  errorDetail?: string;
  retryHref?: string;
  children: ReactNode;
}

const personaLabels: Readonly<Record<ExperiencePersona, string>> = {
  admin: 'School administration',
  teacher: 'Teacher workspace',
  guardian: 'Family portal',
  student: 'Student portal',
};

const connectivityLabels: Readonly<Record<ConnectivityState, string>> = {
  online: 'Online',
  offline: 'Working offline',
  syncing: 'Syncing changes',
  degraded: 'Connection needs attention',
};

export function resolveExperienceDirection(
  locale: string,
  direction?: ExperienceDirection,
): ExperienceDirection {
  if (direction !== undefined) return direction;
  const language = locale.toLowerCase().split(/[-_]/u)[0];
  return ['ar', 'fa', 'he', 'ur'].includes(language ?? '') ? 'rtl' : 'ltr';
}

export function filterExperienceNavigation(
  navigation: readonly ExperienceNavigationItem[],
  capabilities: readonly string[],
): ExperienceNavigationItem[] {
  const granted = new Set(capabilities);
  return navigation.filter((item) => item.capability === undefined || granted.has(item.capability));
}

export function filterExperienceActions(
  actions: readonly ExperienceUtilityAction[] | undefined,
  capabilities: readonly string[],
): ExperienceUtilityAction[] {
  if (actions === undefined) return [];
  const granted = new Set(capabilities);
  return actions.filter(
    (action) => action.capability === undefined || granted.has(action.capability),
  );
}

function StatusLine(props: { connectivity: ExperienceConnectivity }): ReactElement {
  const pendingLabel = new Intl.NumberFormat().format(props.connectivity.pendingChanges);
  return (
    <div
      className="experience-connectivity"
      data-state={props.connectivity.state}
      role={props.connectivity.state === 'degraded' ? 'alert' : 'status'}
    >
      <span className="experience-connectivity__signal" aria-hidden="true" />
      <span>
        <strong>{connectivityLabels[props.connectivity.state]}</strong>
        {props.connectivity.pendingChanges > 0 ? ` · ${pendingLabel} pending` : ''}
      </span>
      {props.connectivity.lastSyncedAt === undefined ? null : (
        <time dateTime={props.connectivity.lastSyncedAt}>
          Last synced {props.connectivity.lastSyncedAt}
        </time>
      )}
      {props.connectivity.retryHref === undefined ||
      props.connectivity.state === 'online' ? null : (
        <a href={props.connectivity.retryHref}>Retry sync</a>
      )}
    </div>
  );
}

function LoadingSurface(): ReactElement {
  return (
    <div className="experience-loading" role="status" aria-live="polite">
      <strong>Preparing your workspace</strong>
      <span>Loading current permissions, tasks and school context.</span>
      <div className="experience-loading__line" aria-hidden="true" />
      <div
        className="experience-loading__line experience-loading__line--short"
        aria-hidden="true"
      />
    </div>
  );
}

export function ExperienceShell(props: ExperienceShellProps): ReactElement {
  const direction = resolveExperienceDirection(props.locale, props.direction);
  const navigation = filterExperienceNavigation(props.navigation, props.capabilities);
  const utilityActions = filterExperienceActions(props.utilityActions, props.capabilities);
  const state = props.state ?? 'ready';

  return (
    <div
      className="experience-shell"
      data-persona={props.persona}
      data-connectivity={props.connectivity.state}
      dir={direction}
      lang={props.locale}
    >
      <a className="experience-skip" href="#experience-main">
        Skip to current work
      </a>

      <aside className="experience-rail" aria-label={`${personaLabels[props.persona]} navigation`}>
        <div className="experience-identity">
          <span className="experience-identity__mark" aria-hidden="true">
            {props.schoolName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{props.schoolName}</strong>
            <span>{personaLabels[props.persona]}</span>
          </div>
        </div>

        <nav className="experience-nav" aria-label="Primary navigation">
          <ul>
            {navigation.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  aria-current={item.href === props.activeHref ? 'page' : undefined}
                >
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  {item.badge === undefined ? null : (
                    <span className="experience-nav__badge" aria-label={`${item.badge} items`}>
                      {item.badge}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="experience-rail__footer">
          <StatusLine connectivity={props.connectivity} />
          <a href="/help">Help and support</a>
        </div>
      </aside>

      <section className="experience-stage">
        <header className="experience-masthead">
          <div>
            <p>{props.userName}</p>
            <h1>{props.pageTitle}</h1>
            <span>{props.pageDescription}</span>
          </div>
          <div className="experience-session" aria-label="Session and device status">
            <span data-assurance={props.session.assurance}>
              {props.session.assurance === 'aal2' ? 'Verified session' : 'Standard session'}
            </span>
            <span>{props.session.deviceLabel}</span>
            <time dateTime={props.session.expiresAt}>Expires {props.session.expiresAt}</time>
          </div>
          {utilityActions.length === 0 ? null : (
            <nav className="experience-utilities" aria-label="Workspace actions">
              {utilityActions.map((action) => (
                <a href={action.href} key={action.href}>
                  {action.label}
                </a>
              ))}
            </nav>
          )}
        </header>

        {props.connectivity.state === 'offline' ? (
          <div className="experience-notice" role="status">
            <strong>You are working offline.</strong>
            <span>
              Approved changes will stay on this device and sync when the connection returns.
            </span>
          </div>
        ) : null}

        {props.connectivity.state === 'degraded' ? (
          <div className="experience-notice experience-notice--warning" role="alert">
            <strong>Some live information may be delayed.</strong>
            <span>Review timestamps before making a time-sensitive decision.</span>
          </div>
        ) : null}

        <main id="experience-main" className="experience-main" tabIndex={-1}>
          {state === 'loading' ? <LoadingSurface /> : null}
          {state === 'error' ? (
            <section
              className="experience-error"
              role="alert"
              aria-labelledby="experience-error-title"
            >
              <h2 id="experience-error-title">{props.errorTitle ?? 'Workspace unavailable'}</h2>
              <p>
                {props.errorDetail ??
                  'Your school data could not be loaded. No changes have been submitted.'}
              </p>
              <a href={props.retryHref ?? props.activeHref}>Try again</a>
            </section>
          ) : null}
          {state === 'ready' ? props.children : null}
        </main>
      </section>
    </div>
  );
}
