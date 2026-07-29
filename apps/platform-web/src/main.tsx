import {
  StrictMode,
  startTransition,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

import { registerPlatformServiceWorker } from './pwa';
import {
  PortalLoading,
  roleDescriptions,
  roleRoots,
  type PilotConnectivity,
  type PilotRole,
} from './portal-shared';
import './pilot.css';
import './styles.css';

interface PortalProps {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}

type PortalComponent = ComponentType<PortalProps>;
type NavigationMode = 'push' | 'replace' | 'pop';

const portalLoaders: Readonly<Record<PilotRole, () => Promise<{ default: PortalComponent }>>> = {
  admin: () => import('./portals/admin'),
  teacher: () => import('./portals/teacher'),
  guardian: () => import('./portals/guardian'),
  student: () => import('./portals/student'),
};
const portalCache: Partial<Record<PilotRole, PortalComponent>> = {};
const portalPromises: Partial<Record<PilotRole, Promise<PortalComponent>>> = {};

interface NavigatorWithConnection extends Navigator {
  readonly connection?: {
    readonly saveData?: boolean;
  };
}

interface IdleWindow extends Window {
  requestIdleCallback?: (callback: () => void, options?: { readonly timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

interface ViewTransitionDocument extends Document {
  startViewTransition?: (update: () => void) => { readonly finished: Promise<void> };
}

function normalisePath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/u, '');
}

function roleForPath(path: string): PilotRole | undefined {
  return (Object.entries(roleRoots) as [PilotRole, string][]).find(
    ([, root]) => path === root || path.startsWith(`${root}/`),
  )?.[0];
}

function isApplicationPath(path: string): boolean {
  return path === '/' || roleForPath(path) !== undefined;
}

function initialConnectivity(): PilotConnectivity {
  if (!navigator.onLine) return 'offline';
  return (navigator as NavigatorWithConnection).connection?.saveData === true
    ? 'degraded'
    : 'online';
}

function usePilotConnectivity(): PilotConnectivity {
  const [connectivity, setConnectivity] = useState<PilotConnectivity>(initialConnectivity);

  useEffect(() => {
    const update = (): void => setConnectivity(initialConnectivity());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return connectivity;
}

async function preloadPortal(role: PilotRole): Promise<PortalComponent> {
  const cached = portalCache[role];
  if (cached !== undefined) return cached;

  const currentPromise = portalPromises[role];
  if (currentPromise !== undefined) return currentPromise;

  const promise = portalLoaders[role]().then((module) => {
    portalCache[role] = module.default;
    delete portalPromises[role];
    return module.default;
  });
  portalPromises[role] = promise;
  return promise;
}

function anchorFromTarget(target: EventTarget | null): HTMLAnchorElement | undefined {
  if (!(target instanceof Element)) return undefined;
  return target.closest<HTMLAnchorElement>('a[href]') ?? undefined;
}

function applicationPathForAnchor(anchor: HTMLAnchorElement): string | undefined {
  if (anchor.hasAttribute('download')) return undefined;
  if (anchor.target !== '' && anchor.target !== '_self') return undefined;

  const target = new URL(anchor.href, window.location.href);
  if (target.origin !== window.location.origin) return undefined;
  if (target.pathname === '/offline.html') return undefined;

  const path = normalisePath(target.pathname);
  if (!isApplicationPath(path)) return undefined;
  if (path === normalisePath(window.location.pathname) && target.hash !== '') return undefined;
  return `${path}${target.search}`;
}

function focusCurrentTask(): void {
  window.requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('#experience-main, #main-content');
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}

function PilotLanding(): ReactElement {
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
            <a className="pilot-role-card" data-role="admin" href="/admin">
              <span className="pilot-role-card__number">01</span>
              <h3>School administrator</h3>
              <p>Review admissions, attendance, fees, operations, reports and urgent exceptions.</p>
              <strong>Go to administration</strong>
            </a>
            <a className="pilot-role-card" data-role="teacher" href="/teacher">
              <span className="pilot-role-card__number">02</span>
              <h3>Teacher</h3>
              <p>See today’s classes, take attendance, update grades and contact families.</p>
              <strong>Go to teacher workspace</strong>
            </a>
            <a className="pilot-role-card" data-role="guardian" href="/family">
              <span className="pilot-role-card__number">03</span>
              <h3>Parent or guardian</h3>
              <p>Check children, attendance, results, fees, forms, documents and messages.</p>
              <strong>Go to family portal</strong>
            </a>
            <a className="pilot-role-card" data-role="student" href="/student">
              <span className="pilot-role-card__number">04</span>
              <h3>Student</h3>
              <p>View lessons, attendance, results, learning resources and school requests.</p>
              <strong>Go to student portal</strong>
            </a>
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
              ['Trust and governance', 'Permissions, audit history, isolation and recovery evidence'],
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

function NavigationProgress(props: { readonly pendingPath?: string }): ReactElement | null {
  const role = props.pendingPath === undefined ? undefined : roleForPath(props.pendingPath);
  if (props.pendingPath === undefined) return null;
  const label = role === undefined ? 'role chooser' : roleDescriptions[role].title.toLowerCase();

  return (
    <div className="pilot-route-progress" role="status" aria-live="polite">
      <span aria-hidden="true" />
      <p>Opening {label}…</p>
    </div>
  );
}

function PilotApplication(): ReactElement {
  const connectivity = usePilotConnectivity();
  const [path, setPath] = useState(() => normalisePath(window.location.pathname));
  const [pendingPath, setPendingPath] = useState<string>();
  const [, refreshPortalCache] = useReducer((value: number) => value + 1, 0);
  const navigationSequence = useRef(0);

  const commitPath = useCallback((targetPath: string, mode: NavigationMode): void => {
    const commit = (): void => {
      if (mode === 'push') window.history.pushState({}, '', targetPath);
      if (mode === 'replace') window.history.replaceState({}, '', targetPath);
      setPath(normalisePath(new URL(targetPath, window.location.href).pathname));
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const documentWithTransitions = document as ViewTransitionDocument;
    if (!reducedMotion && documentWithTransitions.startViewTransition !== undefined) {
      void documentWithTransitions
        .startViewTransition(() => flushSync(commit))
        .finished.catch(() => undefined);
    } else {
      startTransition(commit);
    }
  }, []);

  const navigate = useCallback(
    async (targetPath: string, mode: NavigationMode = 'push'): Promise<void> => {
      const targetUrl = new URL(targetPath, window.location.href);
      const target = normalisePath(targetUrl.pathname);
      const current = normalisePath(window.location.pathname);
      if (target === current && mode !== 'pop') return;

      const sequence = ++navigationSequence.current;
      setPendingPath(target);
      const role = roleForPath(target);

      try {
        if (role !== undefined) await preloadPortal(role);
        if (sequence !== navigationSequence.current) return;
        commitPath(`${target}${targetUrl.search}`, mode);
        refreshPortalCache();
        document.title = `${role === undefined ? 'Choose a role' : roleDescriptions[role].title} · International School Platform`;
        focusCurrentTask();
      } finally {
        if (sequence === navigationSequence.current) setPendingPath(undefined);
      }
    },
    [commitPath],
  );

  useEffect(() => {
    const role = roleForPath(path);
    if (role === undefined || portalCache[role] !== undefined) return;
    let active = true;
    void preloadPortal(role).then(() => {
      if (active) refreshPortalCache();
    });
    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      const anchor = anchorFromTarget(event.target);
      if (anchor === undefined) return;
      const targetPath = applicationPathForAnchor(anchor);
      if (targetPath === undefined) return;

      event.preventDefault();
      void navigate(targetPath);
    };

    const handleIntent = (event: Event): void => {
      const anchor = anchorFromTarget(event.target);
      if (anchor === undefined) return;
      const targetPath = applicationPathForAnchor(anchor);
      if (targetPath === undefined) return;
      const role = roleForPath(new URL(targetPath, window.location.href).pathname);
      if (role !== undefined) void preloadPortal(role);
    };

    const handlePopState = (): void => {
      void navigate(`${window.location.pathname}${window.location.search}`, 'pop');
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('pointerover', handleIntent, { passive: true });
    document.addEventListener('focusin', handleIntent);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('pointerover', handleIntent);
      document.removeEventListener('focusin', handleIntent);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  useEffect(() => {
    if (connectivity !== 'online') return;
    if ((navigator as NavigatorWithConnection).connection?.saveData === true) return;

    const idleWindow = window as IdleWindow;
    const preloadAll = (): void => {
      for (const role of Object.keys(portalLoaders) as PilotRole[]) void preloadPortal(role);
    };
    if (idleWindow.requestIdleCallback !== undefined) {
      const handle = idleWindow.requestIdleCallback(preloadAll, { timeout: 2500 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(preloadAll, 1200);
    return () => window.clearTimeout(handle);
  }, [connectivity]);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    void registerPlatformServiceWorker({ onUpdateAvailable: () => window.location.reload() });
  }, []);

  const role = roleForPath(path);
  const Portal = role === undefined ? undefined : portalCache[role];

  return (
    <>
      <NavigationProgress pendingPath={pendingPath} />
      {role === undefined ? <PilotLanding /> : null}
      {role !== undefined && Portal === undefined ? <PortalLoading role={role} /> : null}
      {role !== undefined && Portal !== undefined ? (
        <Portal path={path} connectivity={connectivity} />
      ) : null}
    </>
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <PilotApplication />
  </StrictMode>,
);
