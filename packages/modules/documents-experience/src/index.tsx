/*
THESIS: One school day should feel continuous across roles, not like a collection of disconnected modules.
OWN-WORLD: Institutional paper, ink-blue structure, teal action language and amber operational exceptions.
STORY: A person enters through their role, recognises their next task, and moves without losing context.
FIRST VIEWPORT: Identity, task finder, grouped navigation, trusted system state and current work remain visible.
FORM: Established Operate world extended as a stable responsive rail; no dashboard-card wall or modal-first navigation.
*/
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';

export type ExperiencePersona = 'admin' | 'teacher' | 'guardian' | 'student';
export type ExperienceDirection = 'ltr' | 'rtl';
export type ExperienceState = 'ready' | 'loading' | 'error';
export type ConnectivityState = 'online' | 'offline' | 'syncing' | 'degraded';
export type ExperienceNavigationIcon =
  | 'home'
  | 'people'
  | 'learning'
  | 'money'
  | 'operations'
  | 'support'
  | 'messages'
  | 'integrations'
  | 'reports'
  | 'calendar'
  | 'attendance'
  | 'gradebook'
  | 'documents'
  | 'requests';

export interface ExperienceNavigationItem {
  id: string;
  label: string;
  href: string;
  description: string;
  group?: string;
  icon?: ExperienceNavigationIcon;
  keywords?: readonly string[];
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

const iconPaths: Readonly<Record<ExperienceNavigationIcon, readonly string[]>> = {
  home: ['M3 11.5 12 4l9 7.5', 'M5.5 10.5V20h13v-9.5', 'M9.5 20v-6h5v6'],
  people: [
    'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M2.5 21v-2a5.5 5.5 0 0 1 11 0v2',
    'M16 4.2a3.5 3.5 0 0 1 0 6.6',
    'M16.5 14a4.5 4.5 0 0 1 5 4.5V21',
  ],
  learning: ['m3 6 9-4 9 4-9 4-9-4Z', 'M6 8.2V14l6 3 6-3V8.2', 'M21 6v7'],
  money: [
    'M4 6.5h16v11H4z',
    'M8 10h.01',
    'M16 14h.01',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  ],
  operations: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  support: ['M12 21s7-3.2 7-9V5.5L12 3 5 5.5V12c0 5.8 7 9 7 9Z', 'm9.5 12 1.7 1.7 3.6-4'],
  messages: ['M4 5h16v12H8l-4 3V5Z', 'M8 9h8', 'M8 13h5'],
  integrations: ['M8 3v4', 'M16 3v4', 'M5 7h14v5a7 7 0 0 1-14 0V7Z', 'M12 19v3'],
  reports: ['M5 3h14v18H5z', 'M8 16v-4', 'M12 16V8', 'M16 16v-6'],
  calendar: ['M4 5h16v16H4z', 'M8 3v4', 'M16 3v4', 'M4 9h16'],
  attendance: ['M5 4h14v17H5z', 'M9 2v4', 'M15 2v4', 'm8.5 13 2 2 5-5'],
  gradebook: ['M5 3h11l3 3v15H5z', 'M16 3v4h4', 'M8 12h8', 'M8 16h6'],
  documents: ['M6 3h9l3 3v15H6z', 'M15 3v4h4', 'M9 12h6', 'M9 16h6'],
  requests: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
};

function NavigationIcon(props: { readonly name?: ExperienceNavigationIcon }): ReactElement | null {
  if (props.name === undefined) return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {iconPaths[props.name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

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

function StatusLine(props: { readonly connectivity: ExperienceConnectivity }): ReactElement {
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
      <strong>Updating this section</strong>
      <span>Your current workspace stays available while fresh information is prepared.</span>
      <div className="experience-loading__line" aria-hidden="true" />
      <div
        className="experience-loading__line experience-loading__line--short"
        aria-hidden="true"
      />
    </div>
  );
}

function navigationMatches(item: ExperienceNavigationItem, query: string): boolean {
  if (query === '') return true;
  const searchable = [item.label, item.description, item.group, ...(item.keywords ?? [])]
    .filter((value): value is string => value !== undefined)
    .join(' ')
    .toLocaleLowerCase();
  return searchable.includes(query);
}

export function ExperienceShell(props: ExperienceShellProps): ReactElement {
  const direction = resolveExperienceDirection(props.locale, props.direction);
  const navigation = filterExperienceNavigation(props.navigation, props.capabilities);
  const utilityActions = filterExperienceActions(props.utilityActions, props.capabilities);
  const state = props.state ?? 'ready';
  const [navigationQuery, setNavigationQuery] = useState('');
  const normalizedQuery = navigationQuery.trim().toLocaleLowerCase();
  const activeItem = navigation.find((item) => item.href === props.activeHref);
  const navigationGroups = useMemo(() => {
    const groups = new Map<string, ExperienceNavigationItem[]>();
    for (const item of navigation) {
      if (!navigationMatches(item, normalizedQuery)) continue;
      const group = item.group ?? 'Workspace';
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    return [...groups.entries()];
  }, [navigation, normalizedQuery]);

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

        {navigation.length < 6 ? null : (
          <div className="experience-nav-search">
            <label htmlFor={`${props.persona}-navigation-search`}>Find a task</label>
            <input
              id={`${props.persona}-navigation-search`}
              type="search"
              value={navigationQuery}
              onChange={(event) => setNavigationQuery(event.currentTarget.value)}
              placeholder="Find a task…"
              autoComplete="off"
            />
          </div>
        )}

        <nav className="experience-nav" aria-label="Primary navigation">
          {navigationGroups.length === 0 ? (
            <p className="experience-nav__empty" role="status">
              No tasks match “{navigationQuery}”.
            </p>
          ) : (
            navigationGroups.map(([group, items], groupIndex) => (
              <section key={group} aria-labelledby={`${props.persona}-nav-group-${groupIndex}`}>
                <h2 id={`${props.persona}-nav-group-${groupIndex}`}>{group}</h2>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        aria-current={item.href === props.activeHref ? 'page' : undefined}
                        aria-label={`${item.label}: ${item.description}`}
                      >
                        {item.icon === undefined ? null : <NavigationIcon name={item.icon} />}
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        {item.badge === undefined ? null : (
                          <span
                            className="experience-nav__badge"
                            aria-label={`${item.badge} items`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </nav>

        <div className="experience-rail__footer">
          <StatusLine connectivity={props.connectivity} />
          <a href="/">Change role</a>
        </div>
      </aside>

      <section className="experience-stage">
        <header className="experience-masthead">
          <div>
            <p className="experience-location">
              {personaLabels[props.persona]}
              {activeItem?.group === undefined ? '' : ` · ${activeItem.group}`}
            </p>
            <h1>{props.pageTitle}</h1>
            <span>{props.pageDescription}</span>
            <small className="experience-user">Signed in as {props.userName}</small>
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
