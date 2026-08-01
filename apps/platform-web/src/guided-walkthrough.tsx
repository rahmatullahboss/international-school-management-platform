import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import './guided-walkthrough.css';

export type WalkthroughRole =
  | 'admin'
  | 'teacher'
  | 'guardian'
  | 'student'
  | 'admissions'
  | 'finance'
  | 'support';

export interface WalkthroughStep {
  readonly title: string;
  readonly detail: string;
  readonly selector: string;
}

const WALKTHROUGH_VERSION = 'v1';

const roleRoots: Readonly<Record<WalkthroughRole, string>> = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
  admissions: '/admissions',
  finance: '/finance',
  support: '/support',
};

const roleLabels: Readonly<Record<WalkthroughRole, string>> = {
  admin: 'School administration',
  teacher: 'Teacher workspace',
  guardian: 'Family portal',
  student: 'Student portal',
  admissions: 'Admissions workspace',
  finance: 'Finance and cashier workspace',
  support: 'Platform support workspace',
};

const coreRoleSteps: Readonly<Record<'admin' | 'teacher' | 'guardian' | 'student', readonly WalkthroughStep[]>> = {
  admin: [
    { title: 'Students & admissions', detail: 'Manage people, families, applications and enrolment from here.', selector: 'a[href="/admin/sis"]' },
    { title: 'Academics & attendance', detail: 'Open curriculum, timetable, attendance, gradebook and academic records.', selector: 'a[href="/admin/academics"]' },
    { title: 'Fees & accounting', detail: 'Review billing, payments, ledger, reconciliation and finance reports.', selector: 'a[href="/admin/finance"]' },
    { title: 'School operations', detail: 'Manage staff, assets, library, transport, procurement and school services.', selector: 'a[href="/admin/operations"]' },
    { title: 'Health & support', detail: 'Open governed health, wellbeing, safeguarding and learning-support work.', selector: 'a[href="/admin/student-support"]' },
    { title: 'Messages & notices', detail: 'Send and review school communications and delivery evidence.', selector: 'a[href="/admin/communications"]' },
    { title: 'Imports & integrations', detail: 'Handle imports, country settings, SSO and approved integrations.', selector: 'a[href="/admin/integrations"]' },
    { title: 'Reports & exports', detail: 'Open governed metrics, evidence and export workflows.', selector: 'a[href="/admin/reports"]' },
  ],
  teacher: [
    { title: 'My classes', detail: 'See the classes and teaching groups assigned to you.', selector: 'a[href="/teacher/classes"]' },
    { title: 'Attendance', detail: 'Open assigned registers and record attendance within your teaching scope.', selector: 'a[href="/teacher/attendance"]' },
    { title: 'Gradebook', detail: 'Work on assessment and gradebook tasks for your assigned classes.', selector: 'a[href="/teacher/gradebook"]' },
    { title: 'Students', detail: 'Review the learning context you are permitted to see for assigned students.', selector: 'a[href="/teacher/students"]' },
    { title: 'Messages', detail: 'Contact families and review teacher communication tasks.', selector: 'a[href="/teacher/messages"]' },
    { title: 'Resources', detail: 'Open teaching and class resources from this area.', selector: 'a[href="/teacher/resources"]' },
  ],
  guardian: [
    { title: 'Applications', detail: 'Track family applications and permitted admissions actions.', selector: 'a[href="/family/applications"]' },
    { title: 'My children', detail: 'Switch between children and review each authorised student context.', selector: 'a[href="/family/children"]' },
    { title: 'Attendance', detail: 'Review the attendance record available to your family.', selector: 'a[href="/family/attendance"]' },
    { title: 'Grades & reports', detail: 'See published results and reports that have been released to you.', selector: 'a[href="/family/grades"]' },
    { title: 'Fees', detail: 'Review household invoices, receipts and permitted finance information.', selector: 'a[href="/family/finance"]' },
    { title: 'Forms', detail: 'Open school forms and responses that require your attention.', selector: 'a[href="/family/forms"]' },
    { title: 'Documents', detail: 'Access authorised family and student documents.', selector: 'a[href="/family/documents"]' },
    { title: 'Messages', detail: 'Read and send messages within the family communication scope.', selector: 'a[href="/family/messages"]' },
  ],
  student: [
    { title: 'Timetable', detail: 'See your lessons and current timetable.', selector: 'a[href="/student/timetable"]' },
    { title: 'Attendance', detail: 'Review your own published attendance record.', selector: 'a[href="/student/attendance"]' },
    { title: 'Results', detail: 'See results and progress that have been published to you.', selector: 'a[href="/student/results"]' },
    { title: 'Documents', detail: 'Access documents released to your student account.', selector: 'a[href="/student/documents"]' },
    { title: 'Resources', detail: 'Open learning resources available to you.', selector: 'a[href="/student/resources"]' },
    { title: 'Requests', detail: 'Create or review supported school requests.', selector: 'a[href="/student/requests"]' },
    { title: 'Messages', detail: 'Use your permitted school messaging area.', selector: 'a[href="/student/messages"]' },
  ],
};

const operatorSteps: readonly WalkthroughStep[] = [
  { title: 'Workspace summary', detail: 'Start with the role-specific status, scope and priority summary at the top of the workspace.', selector: '.pilot-entry__masthead' },
  { title: 'Common actions', detail: 'These shortcuts open the most common tasks for this operator role.', selector: '.pilot-actions, .pilot-role-grid, #main-content nav' },
  { title: 'Current workload', detail: 'Use the main content area to review metrics, queues and permitted work items.', selector: '#main-content' },
  { title: 'Trust and data status', detail: 'Check whether the information is current, cached or temporarily unavailable before acting.', selector: '.pilot-data-status, [role="status"]' },
];

const sharedCoreSteps: readonly WalkthroughStep[] = [
  { title: 'Your signed-in workspace', detail: 'This header confirms the current role, page, account and session context.', selector: '.experience-masthead' },
  { title: 'Find a task', detail: 'Search the navigation by task name or keyword when you do not know which module to open.', selector: '.experience-nav-search' },
  { title: 'Role-based navigation', detail: 'Only navigation allowed by the current role and capabilities appears here.', selector: '.experience-nav' },
];

const sharedCoreEnding: readonly WalkthroughStep[] = [
  { title: 'Current work area', detail: 'The selected task opens here. Status, priority work and safe next actions stay in context.', selector: '#experience-main' },
  { title: 'Connection and data status', detail: 'Check sync and freshness indicators before making a time-sensitive decision.', selector: '.experience-connectivity, .pilot-data-status' },
  { title: 'Change role safely', detail: 'Use Change role when you need a different persona. Changing role never expands the current permission set.', selector: '.experience-rail__footer a[href="/"]' },
];

export function walkthroughRoleForPath(pathname: string): WalkthroughRole | undefined {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/u, '');
  return (Object.entries(roleRoots) as [WalkthroughRole, string][]).find(
    ([, root]) => normalized === root || normalized.startsWith(`${root}/`),
  )?.[0];
}

export function walkthroughStorageKey(role: WalkthroughRole): string {
  return `school-platform:walkthrough:${WALKTHROUGH_VERSION}:${role}`;
}

export function walkthroughStepsForRole(role: WalkthroughRole): readonly WalkthroughStep[] {
  if (role === 'admissions' || role === 'finance' || role === 'support') return operatorSteps;
  return [...sharedCoreSteps, ...coreRoleSteps[role], ...sharedCoreEnding];
}

function readCompleted(role: WalkthroughRole): boolean {
  try {
    return window.localStorage.getItem(walkthroughStorageKey(role)) === 'complete';
  } catch {
    return false;
  }
}

function writeCompleted(role: WalkthroughRole): void {
  try {
    window.localStorage.setItem(walkthroughStorageKey(role), 'complete');
  } catch {
    // Walkthrough remains usable when storage is unavailable.
  }
}

function targetForStep(step: WalkthroughStep): HTMLElement | undefined {
  const element = document.querySelector<HTMLElement>(step.selector);
  return element ?? undefined;
}

export function GuidedWalkthrough(): ReactElement | null {
  const role = useMemo(() => walkthroughRoleForPath(window.location.pathname), []);
  const steps = useMemo(() => (role === undefined ? [] : walkthroughStepsForRole(role)), [role]);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const focusStep = useCallback(
    (index: number): void => {
      if (steps.length === 0) return;
      let nextIndex = Math.max(0, Math.min(index, steps.length - 1));
      let target = targetForStep(steps[nextIndex]!);
      const direction = index >= stepIndex ? 1 : -1;

      while (target === undefined && nextIndex >= 0 && nextIndex < steps.length) {
        nextIndex += direction;
        if (nextIndex < 0 || nextIndex >= steps.length) break;
        target = targetForStep(steps[nextIndex]!);
      }

      if (target === undefined) return;
      document.querySelectorAll('.guided-walkthrough__target').forEach((element) => {
        element.classList.remove('guided-walkthrough__target');
      });
      target.classList.add('guided-walkthrough__target');
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setStepIndex(nextIndex);
    },
    [stepIndex, steps],
  );

  const close = useCallback(
    (complete: boolean): void => {
      document.querySelectorAll('.guided-walkthrough__target').forEach((element) => {
        element.classList.remove('guided-walkthrough__target');
      });
      if (complete && role !== undefined) writeCompleted(role);
      setOpen(false);
    },
    [role],
  );

  const start = useCallback((): void => {
    setOpen(true);
    window.setTimeout(() => focusStep(0), 0);
  }, [focusStep]);

  useEffect(() => {
    if (role === undefined || readCompleted(role)) return;
    const handle = window.setTimeout(start, 650);
    return () => window.clearTimeout(handle);
  }, [role, start]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close(true);
      if (event.key === 'ArrowRight') focusStep(stepIndex + 1);
      if (event.key === 'ArrowLeft') focusStep(stepIndex - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, focusStep, open, stepIndex]);

  useEffect(
    () => () => {
      document.querySelectorAll('.guided-walkthrough__target').forEach((element) => {
        element.classList.remove('guided-walkthrough__target');
      });
    },
    [],
  );

  if (role === undefined || steps.length === 0) return null;
  const step = steps[stepIndex] ?? steps[0]!;
  const atEnd = stepIndex >= steps.length - 1;

  return (
    <>
      <button className="guided-walkthrough__launcher" type="button" onClick={start}>
        Show walkthrough
      </button>
      {open ? (
        <div className="guided-walkthrough" role="dialog" aria-modal="true" aria-labelledby="guided-walkthrough-title">
          <button className="guided-walkthrough__backdrop" type="button" aria-label="Close walkthrough" onClick={() => close(true)} />
          <section className="guided-walkthrough__card">
            <div className="guided-walkthrough__progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
              <span>{roleLabels[role]}</span>
              <strong>{stepIndex + 1} / {steps.length}</strong>
            </div>
            <h2 id="guided-walkthrough-title">{step.title}</h2>
            <p>{step.detail}</p>
            <div className="guided-walkthrough__actions">
              <button type="button" onClick={() => close(true)}>Skip tour</button>
              <div>
                <button type="button" disabled={stepIndex === 0} onClick={() => focusStep(stepIndex - 1)}>Back</button>
                <button type="button" data-emphasis="primary" onClick={() => (atEnd ? close(true) : focusStep(stepIndex + 1))}>
                  {atEnd ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
