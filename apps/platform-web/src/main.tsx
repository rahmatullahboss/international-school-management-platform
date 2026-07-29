import { StrictMode, useEffect, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import { AdminExperienceShell, AdminOperationsHome } from '@school/web-admin/experience';
import { GuardianExperienceShell, GuardianHouseholdWorkspace } from '@school/web-family/experience';
import { StudentDailyWorkspace, StudentExperienceShell } from '@school/web-student/experience';
import { TeacherDailyWorkspace, TeacherExperienceShell } from '@school/web-teacher/experience';

import { registerPlatformServiceWorker } from './pwa';
import {
  adminCapabilities,
  adminOverview,
  campusName,
  guardianCapabilities,
  guardianOverview,
  modulePages,
  pilotTimestamp,
  schoolName,
  studentCapabilities,
  studentOverview,
  teacherCapabilities,
  teacherOverview,
  type PilotModulePage,
} from './pilot-data';
import './pilot.css';
import './styles.css';

type PilotRole = 'admin' | 'teacher' | 'guardian' | 'student';
type PilotConnectivity = 'online' | 'degraded' | 'offline';

interface NavigatorWithConnection extends Navigator {
  readonly connection?: {
    readonly saveData?: boolean;
  };
}

const roleRoots: Readonly<Record<PilotRole, string>> = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
};

const roleLinks = [
  { label: 'Admin', href: '/admin' },
  { label: 'Teacher', href: '/teacher' },
  { label: 'Guardian', href: '/family' },
  { label: 'Student', href: '/student' },
  { label: 'Role chooser', href: '/' },
] as const;

const roleDescriptions: Readonly<
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

function normalisePath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/u, '');
}

function roleForPath(path: string): PilotRole | undefined {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/teacher')) return 'teacher';
  if (path.startsWith('/family')) return 'guardian';
  if (path.startsWith('/student')) return 'student';
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

function PilotModuleSurface(props: { readonly page: PilotModulePage }): ReactElement {
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

function UnknownRoute(props: { readonly homeHref: string }): ReactElement {
  return (
    <section className="pilot-unknown" role="alert">
      <p>Route not available in this pilot</p>
      <h2>The requested workspace is not composed yet.</h2>
      <a href={props.homeHref}>Return to role home</a>
    </section>
  );
}

function shellUtilityActions(activeRole: PilotRole) {
  const activeRoot = roleRoots[activeRole];
  return roleLinks
    .filter((link) => link.href === '/' || link.href !== activeRoot)
    .map((link) => ({ label: link.label, href: link.href }));
}

function resolvePageHeading(
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

function AdminPortal(props: {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'admin',
    props.path,
    page,
    'Administration',
    'Integrated administration workspace',
  );

  return (
    <AdminExperienceShell
      schoolName={schoolName}
      userName="Amina Chowdhury · Principal"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={adminCapabilities}
      session={{
        assurance: 'aal2',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: pilotTimestamp,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('admin')}
    >
      {props.path === '/admin' ? (
        <AdminOperationsHome
          schoolName={schoolName}
          campusName={campusName}
          locale="en-BD"
          asOf={pilotTimestamp}
          assurance="aal2"
          capabilities={adminCapabilities}
          metrics={adminOverview.metrics}
          exceptions={adminOverview.exceptions}
          approvals={adminOverview.approvals}
          searchQuery="Samira"
          searchResults={adminOverview.searchResults}
          selectedExceptionIds={['attendance-1']}
          bulkActions={adminOverview.bulkActions}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/admin" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </AdminExperienceShell>
  );
}

function TeacherPortal(props: {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'teacher',
    props.path,
    page,
    'Teacher workspace',
    'Assigned teaching work',
  );

  return (
    <TeacherExperienceShell
      schoolName={schoolName}
      userName="Nusrat Rahman · Mathematics"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={teacherCapabilities}
      session={{
        assurance: 'aal1',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: pilotTimestamp,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('teacher')}
    >
      {props.path === '/teacher' ? (
        <TeacherDailyWorkspace
          teacherName="Nusrat Rahman"
          schoolName={schoolName}
          locale="en-BD"
          date={pilotTimestamp}
          connectivity={props.connectivity}
          pendingChanges={0}
          capabilities={teacherCapabilities}
          sessions={teacherOverview.sessions}
          attendance={teacherOverview.attendance}
          gradebook={teacherOverview.gradebook}
          studentContext={teacherOverview.studentContext}
          conversations={teacherOverview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/teacher" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </TeacherExperienceShell>
  );
}

function GuardianPortal(props: {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'guardian',
    props.path,
    page,
    'Family portal',
    'Household school services',
  );

  return (
    <GuardianExperienceShell
      schoolName={schoolName}
      userName="Farhana Noor · Guardian"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={guardianCapabilities}
      session={{
        assurance: 'aal1',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: pilotTimestamp,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('guardian')}
    >
      {props.path === '/family' ? (
        <GuardianHouseholdWorkspace
          guardianName="Farhana Noor"
          householdLabel="Noor household"
          locale="en-BD"
          activeChildId="student-1"
          capabilities={guardianCapabilities}
          children={guardianOverview.children}
          applications={guardianOverview.applications}
          attendance={guardianOverview.attendance}
          grades={guardianOverview.grades}
          fees={guardianOverview.fees}
          forms={guardianOverview.forms}
          documents={guardianOverview.documents}
          conversations={guardianOverview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/family" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </GuardianExperienceShell>
  );
}

function StudentPortal(props: {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'student',
    props.path,
    page,
    'Student portal',
    'Published student services',
  );

  return (
    <StudentExperienceShell
      schoolName={schoolName}
      userName="Samira Noor · Year 8"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={studentCapabilities}
      session={{
        assurance: 'aal1',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: pilotTimestamp,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('student')}
    >
      {props.path === '/student' ? (
        <StudentDailyWorkspace
          studentId="student-1"
          studentName="Samira Noor"
          schoolName={schoolName}
          yearLabel="Year 8"
          locale="en-BD"
          date={pilotTimestamp}
          ageBand="secondary"
          capabilities={studentCapabilities}
          lessons={studentOverview.lessons}
          attendance={studentOverview.attendance}
          results={studentOverview.results}
          resources={studentOverview.resources}
          requests={studentOverview.requests}
          documents={studentOverview.documents}
          conversations={studentOverview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/student" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </StudentExperienceShell>
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
  if (role === 'admin') return <AdminPortal path={path} connectivity={connectivity} />;
  if (role === 'teacher') return <TeacherPortal path={path} connectivity={connectivity} />;
  if (role === 'guardian') return <GuardianPortal path={path} connectivity={connectivity} />;
  return <StudentPortal path={path} connectivity={connectivity} />;
}

const root = document.getElementById('root');
if (root === null) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <PilotApplication />
  </StrictMode>,
);
