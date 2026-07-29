import {
  StrictMode,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactElement,
} from 'react';
import { createRoot } from 'react-dom/client';

import { registerPlatformServiceWorker } from './pwa';
import {
  PortalLoading,
  roleRoots,
  type PilotConnectivity,
  type PilotRole,
} from './portal-shared';
import './pilot.css';
import './styles.css';

const AdminPortal = lazy(() => import('./portals/admin'));
const TeacherPortal = lazy(() => import('./portals/teacher'));
const GuardianPortal = lazy(() => import('./portals/guardian'));
const StudentPortal = lazy(() => import('./portals/student'));

interface NavigatorWithConnection extends Navigator {
  readonly connection?: {
    readonly saveData?: boolean;
  };
}

function normalisePath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/u, '');
}

function roleForPath(path: string): PilotRole | undefined {
  if (path.startsWith(roleRoots.admin)) return 'admin';
  if (path.startsWith(roleRoots.teacher)) return 'teacher';
  if (path.startsWith(roleRoots.guardian)) return 'guardian';
  if (path.startsWith(roleRoots.student)) return 'student';
  return undefined;
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

function PilotLanding(): ReactElement {
  return (
    <div className="pilot-entry">
      <header className="pilot-entry__masthead">
        <div>
          <p className="pilot-kicker">Cloudflare staging · synthetic pilot data</p>
          <h1>International School Platform</h1>
          <p>
            Open a role workspace to review the integrated SIS, academics, finance, operations,
            student-support, communication, reporting and integration modules.
          </p>
        </div>
        <div className="pilot-entry__status" role="status">
          <strong>Staging environment</strong>
          <span>No production data</span>
          <a href="/offline.html">Offline support</a>
        </div>
      </header>

      <main className="pilot-entry__main">
        <section aria-labelledby="pilot-role-title">
          <div className="pilot-section-heading">
            <p>Demo access</p>
            <h2 id="pilot-role-title">Choose a role</h2>
            <span>
              Authentication is simulated for pilot review; permissions remain role-scoped.
            </span>
          </div>
          <div className="pilot-role-grid">
            <a className="pilot-role-card" data-role="admin" href="/admin">
              <span>01</span>
              <h3>School administrator</h3>
              <p>
                SIS, admissions, academics, finance, operations, support, reports and integrations.
              </p>
              <strong>Open admin workspace</strong>
            </a>
            <a className="pilot-role-card" data-role="teacher" href="/teacher">
              <span>02</span>
              <h3>Teacher</h3>
              <p>Classes, timetable, attendance, gradebook, students, messages and resources.</p>
              <strong>Open teacher workspace</strong>
            </a>
            <a className="pilot-role-card" data-role="guardian" href="/family">
              <span>03</span>
              <h3>Guardian</h3>
              <p>Admissions, children, attendance, grades, fees, forms, documents and messages.</p>
              <strong>Open family portal</strong>
            </a>
            <a className="pilot-role-card" data-role="student" href="/student">
              <span>04</span>
              <h3>Student</h3>
              <p>Timetable, attendance, results, documents, resources, requests and messages.</p>
              <strong>Open student portal</strong>
            </a>
          </div>
        </section>

        <section className="pilot-coverage" aria-labelledby="pilot-coverage-title">
          <div className="pilot-section-heading">
            <p>Integrated scope</p>
            <h2 id="pilot-coverage-title">Module coverage</h2>
          </div>
          <div className="pilot-coverage__grid">
            {[
              ['Core SIS', 'People, households, admissions and enrolment lifecycle'],
              ['Academics', 'Curriculum, timetable, attendance, gradebook and records'],
              ['Finance', 'Billing, payments, ledger, reconciliation and reports'],
              ['Operations', 'HR, procurement, assets, library, transport and services'],
              ['Student support', 'Health, wellbeing, safeguarding and learning support'],
              ['Experience', 'Portals, communications, documents, reporting and resilient PWA'],
              ['Integrations', 'Country packs, imports, OneRoster, LTI, SSO and webhooks'],
              ['Governance', 'Tenant isolation, permissions, audit events and recovery evidence'],
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

function PilotApplication(): ReactElement {
  const path = normalisePath(window.location.pathname);
  const role = roleForPath(path);
  const connectivity = usePilotConnectivity();

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    void registerPlatformServiceWorker({ onUpdateAvailable: () => window.location.reload() });
  }, []);

  if (role === undefined) return <PilotLanding />;

  return (
    <Suspense fallback={<PortalLoading />}>
      {role === 'admin' ? <AdminPortal path={path} connectivity={connectivity} /> : null}
      {role === 'teacher' ? <TeacherPortal path={path} connectivity={connectivity} /> : null}
      {role === 'guardian' ? <GuardianPortal path={path} connectivity={connectivity} /> : null}
      {role === 'student' ? <StudentPortal path={path} connectivity={connectivity} /> : null}
    </Suspense>
  );
}

const root = document.getElementById('root');
if (root === null) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <PilotApplication />
  </StrictMode>,
);
