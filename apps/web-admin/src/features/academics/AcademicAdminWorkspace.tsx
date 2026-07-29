/*
THESIS: Academic operations are a readiness ledger, not a wall of disconnected metrics.
OWN-WORLD: Bright institutional paper, ink-blue structure, teal actions, amber exceptions, square data rhythm.
STORY: Leaders see what is publishable, what is blocked, why it is blocked, and where to act.
FIRST VIEWPORT: Readiness statement and compact definition list lead into the highest-risk queues.
FORM: Established Operate surface extension; exception-first control room with semantic tables and inline actions.
*/
import type { ReactElement, ReactNode } from 'react';

import './academics.css';

export type AcademicAdminSection =
  | 'overview'
  | 'structure'
  | 'timetable'
  | 'attendance'
  | 'gradebook'
  | 'records'
  | 'reports'
  | 'imports';

export interface AcademicAdminMetric {
  label: string;
  value: string | number;
  context: string;
  status: 'stable' | 'attention' | 'blocked';
}

export interface AcademicReadinessItem {
  id: string;
  area: 'structure' | 'timetable' | 'attendance' | 'gradebook' | 'records';
  title: string;
  description: string;
  status: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  owner?: string;
  dueAt?: string;
  href: string;
}

export interface AcademicPublicationRow {
  id: string;
  kind: 'academic year' | 'calendar' | 'curriculum' | 'course' | 'timetable';
  name: string;
  version: string;
  campus: string;
  state: 'draft' | 'published' | 'blocked';
  blocker?: string;
  href: string;
}

export interface AcademicConflictRow {
  conflictId: string;
  date: string;
  time: string;
  resourceType: 'teacher' | 'room' | 'student' | 'section';
  resourceLabel: string;
  leftMeeting: string;
  rightMeeting: string;
  severity: 'warning' | 'blocking';
  href: string;
}

export interface AttendanceExceptionRow {
  sessionId: string;
  date: string;
  section: string;
  teacher: string;
  missingStudents: number;
  offlinePending: number;
  state: 'open' | 'incomplete' | 'finalized';
  href: string;
}

export interface GradebookReadinessRow {
  sectionId: string;
  section: string;
  reportingPeriod: string;
  assessments: number;
  unmoderated: number;
  missingResults: number;
  lockState: 'open' | 'locked';
  href: string;
}

export interface AcademicRecordQueueRow {
  id: string;
  student: string;
  artifact: 'report card' | 'promotion decision' | 'transcript correction';
  reportingPeriod: string;
  status: string;
  approver?: string;
  href: string;
}

export interface AcademicReportLink {
  label: string;
  description: string;
  href: string;
  updatedAt?: string;
}

export interface AcademicImportBatchRow {
  batchId: string;
  entity: string;
  filename: string;
  status: 'staged' | 'validating' | 'ready' | 'blocked' | 'applied';
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  href: string;
}

export interface AcademicAdminWorkspaceProps {
  schoolName: string;
  locale: string;
  direction?: 'ltr' | 'rtl';
  state?: 'ready' | 'loading' | 'error';
  errorMessage?: string;
  activeSection?: AcademicAdminSection;
  metrics: readonly AcademicAdminMetric[];
  readiness: readonly AcademicReadinessItem[];
  publications: readonly AcademicPublicationRow[];
  conflicts: readonly AcademicConflictRow[];
  attendanceExceptions: readonly AttendanceExceptionRow[];
  gradebookReadiness: readonly GradebookReadinessRow[];
  recordsQueue: readonly AcademicRecordQueueRow[];
  reports: readonly AcademicReportLink[];
  imports: readonly AcademicImportBatchRow[];
  canManageStructure?: boolean;
  canStageImports?: boolean;
  canExport?: boolean;
}

const navigation: readonly { key: AcademicAdminSection; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'structure', label: 'Structure and curriculum' },
  { key: 'timetable', label: 'Timetable' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'gradebook', label: 'Gradebook' },
  { key: 'records', label: 'Academic records' },
  { key: 'reports', label: 'Reports' },
  { key: 'imports', label: 'Imports' },
];

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-');
}

function formatCount(
  locale: string,
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const formatted = new Intl.NumberFormat(locale).format(count);
  return `${formatted} ${category === 'one' ? singular : plural}`;
}

function formatMetricValue(locale: string, value: string | number): string {
  return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
}

function Section(props: {
  id: AcademicAdminSection;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}): ReactElement {
  const headingId = `${props.id}-heading`;
  return (
    <section className="acad-section" id={props.id} aria-labelledby={headingId}>
      <header className="acad-section__header">
        <div>
          <h2 id={headingId}>{props.title}</h2>
          <p>{props.description}</p>
        </div>
        {props.actions === undefined ? null : (
          <div className="acad-section__actions">{props.actions}</div>
        )}
      </header>
      {props.children}
    </section>
  );
}

function EmptyState(props: { title: string; detail: string }): ReactElement {
  return (
    <div className="acad-empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

function Status(props: { value: string; tone?: string }): ReactElement {
  return (
    <span className="acad-status" data-tone={props.tone ?? slug(props.value)}>
      {props.value}
    </span>
  );
}

function TableFrame(props: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="acad-table-frame" role="region" aria-label={props.label} tabIndex={0}>
      {props.children}
    </div>
  );
}

function LoadingState(): ReactElement {
  return (
    <main className="acad-workspace" aria-busy="true" aria-live="polite">
      <h1>Academic operations</h1>
      <p>Loading current academic readiness and exception queues.</p>
      <div className="acad-skeleton" aria-hidden="true" />
      <div className="acad-skeleton acad-skeleton--wide" aria-hidden="true" />
    </main>
  );
}

export function AcademicAdminWorkspace(props: AcademicAdminWorkspaceProps): ReactElement {
  if (props.state === 'loading') return <LoadingState />;

  const activeSection = props.activeSection ?? 'overview';
  const direction = props.direction ?? (props.locale.startsWith('ar') ? 'rtl' : 'ltr');
  const blockingCount = props.readiness.filter(
    (item) => item.severity === 'critical' || item.severity === 'error',
  ).length;
  const publishableCount = props.publications.filter((item) => item.state === 'draft').length;

  return (
    <main
      className="acad-workspace"
      id="main-content"
      tabIndex={-1}
      dir={direction}
      lang={props.locale}
    >
      <a className="acad-skip" href="#overview">
        Skip to priority academic work
      </a>
      <header className="acad-masthead">
        <div>
          <p className="acad-kicker">Academic operations</p>
          <h1>{props.schoolName}</h1>
          <p className="acad-lede">
            Publish reliable calendars and timetables, reconcile attendance, close gradebooks and
            issue academic records with a visible evidence trail.
          </p>
        </div>
        <div className="acad-readiness" aria-label="Academic readiness summary">
          <strong>
            {blockingCount === 0 ? 'Ready for controlled publication' : 'Action required'}
          </strong>
          <span>
            {blockingCount === 0
              ? `${formatCount(props.locale, publishableCount, 'draft item')} can proceed through review.`
              : `${formatCount(props.locale, blockingCount, 'blocking item')} must be resolved first.`}
          </span>
        </div>
      </header>

      {props.state === 'error' ? (
        <section className="acad-error" role="alert" aria-labelledby="academic-error-heading">
          <h2 id="academic-error-heading">Academic data could not be loaded</h2>
          <p>{props.errorMessage ?? 'Refresh the page or contact your platform administrator.'}</p>
          <a href="/academics">Retry loading academic operations</a>
        </section>
      ) : null}

      <nav className="acad-nav" aria-label="Academic administration sections">
        <ul>
          {navigation.map((item) => (
            <li key={item.key}>
              <a
                href={`#${item.key}`}
                aria-current={activeSection === item.key ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className="acad-overview" id="readiness-overview" aria-labelledby="overview-heading">
        <header>
          <h2 id="overview-heading">Readiness ledger</h2>
          <p>Every number includes the operational context needed to investigate it.</p>
        </header>
        <dl>
          {props.metrics.map((metric) => (
            <div key={metric.label} data-status={metric.status}>
              <dt>{metric.label}</dt>
              <dd>
                <strong>{formatMetricValue(props.locale, metric.value)}</strong>
                <span>{metric.context}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Section
        id="overview"
        title="Priority work"
        description="Blocking and time-sensitive exceptions across the academic lifecycle."
      >
        {props.readiness.length === 0 ? (
          <EmptyState
            title="No priority exceptions"
            detail="Publication and closing queues are currently clear."
          />
        ) : (
          <TableFrame label="Priority academic work queue">
            <table>
              <caption>Academic readiness exceptions</caption>
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Area</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Due</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.readiness.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Status value={item.severity} tone={item.severity} />
                    </td>
                    <td>{item.area}</td>
                    <td>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </td>
                    <td>{item.status}</td>
                    <td>{item.owner ?? 'Unassigned'}</td>
                    <td>{item.dueAt ?? 'No due date'}</td>
                    <td>
                      <a href={item.href}>Review issue</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        id="structure"
        title="Structure and publication"
        description="Versioned academic years, calendars, curricula, courses and timetable releases."
        actions={
          props.canManageStructure ? (
            <a className="acad-action" href="/academics/structure/new">
              Create academic structure
            </a>
          ) : undefined
        }
      >
        {props.publications.length === 0 ? (
          <EmptyState
            title="No publication versions"
            detail="Create an academic year and curriculum version to begin."
          />
        ) : (
          <TableFrame label="Academic publication versions">
            <table>
              <caption>Versioned academic structure and timetable publications</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Name</th>
                  <th scope="col">Version</th>
                  <th scope="col">Campus</th>
                  <th scope="col">State</th>
                  <th scope="col">Blocker</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.publications.map((item) => (
                  <tr key={item.id}>
                    <td>{item.kind}</td>
                    <td>{item.name}</td>
                    <td>{item.version}</td>
                    <td>{item.campus}</td>
                    <td>
                      <Status value={item.state} />
                    </td>
                    <td>{item.blocker ?? 'None'}</td>
                    <td>
                      <a href={item.href}>Open version</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        id="timetable"
        title="Timetable conflicts"
        description="Overlapping teacher, room, student and section resources block publication."
      >
        {props.conflicts.length === 0 ? (
          <EmptyState
            title="No timetable conflicts"
            detail="The current draft has no unresolved resource collisions."
          />
        ) : (
          <TableFrame label="Timetable conflict register">
            <table>
              <caption>Unresolved timetable conflicts</caption>
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Date and time</th>
                  <th scope="col">Resource</th>
                  <th scope="col">First meeting</th>
                  <th scope="col">Second meeting</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.conflicts.map((conflict) => (
                  <tr key={conflict.conflictId}>
                    <td>
                      <Status value={conflict.severity} tone={conflict.severity} />
                    </td>
                    <td>
                      {conflict.date}, {conflict.time}
                    </td>
                    <td>
                      {conflict.resourceType}: {conflict.resourceLabel}
                    </td>
                    <td>{conflict.leftMeeting}</td>
                    <td>{conflict.rightMeeting}</td>
                    <td>
                      <a href={conflict.href}>Resolve conflict</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        id="attendance"
        title="Attendance reconciliation"
        description="Open sessions, missing roster results and offline changes awaiting synchronization."
      >
        {props.attendanceExceptions.length === 0 ? (
          <EmptyState
            title="Attendance is reconciled"
            detail="No open session has missing students or pending offline changes."
          />
        ) : (
          <TableFrame label="Attendance reconciliation queue">
            <table>
              <caption>Attendance sessions requiring action</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Section</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Missing</th>
                  <th scope="col">Offline pending</th>
                  <th scope="col">State</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.attendanceExceptions.map((session) => (
                  <tr key={session.sessionId}>
                    <td>{session.date}</td>
                    <td>{session.section}</td>
                    <td>{session.teacher}</td>
                    <td>{session.missingStudents}</td>
                    <td>{session.offlinePending}</td>
                    <td>
                      <Status value={session.state} />
                    </td>
                    <td>
                      <a href={session.href}>Reconcile session</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        id="gradebook"
        title="Gradebook closing readiness"
        description="Moderation and missing results remain visible before a reporting period can lock."
      >
        {props.gradebookReadiness.length === 0 ? (
          <EmptyState
            title="No active gradebooks"
            detail="Published assessments will appear when grading begins."
          />
        ) : (
          <TableFrame label="Gradebook closing readiness">
            <table>
              <caption>Section gradebook readiness</caption>
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Reporting period</th>
                  <th scope="col">Assessments</th>
                  <th scope="col">Unmoderated</th>
                  <th scope="col">Missing results</th>
                  <th scope="col">Lock state</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.gradebookReadiness.map((gradebook) => (
                  <tr key={`${gradebook.sectionId}:${gradebook.reportingPeriod}`}>
                    <td>{gradebook.section}</td>
                    <td>{gradebook.reportingPeriod}</td>
                    <td>{gradebook.assessments}</td>
                    <td>{gradebook.unmoderated}</td>
                    <td>{gradebook.missingResults}</td>
                    <td>
                      <Status value={gradebook.lockState} />
                    </td>
                    <td>
                      <a href={gradebook.href}>Open gradebook</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        id="records"
        title="Academic records approvals"
        description="Report cards, promotion decisions and transcript corrections remain separate, auditable approvals."
      >
        {props.recordsQueue.length === 0 ? (
          <EmptyState
            title="Records approval queue is clear"
            detail="No academic artifact is waiting for approval or correction review."
          />
        ) : (
          <TableFrame label="Academic records approval queue">
            <table>
              <caption>Academic artifacts awaiting action</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Artifact</th>
                  <th scope="col">Reporting period</th>
                  <th scope="col">Status</th>
                  <th scope="col">Approver</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.recordsQueue.map((record) => (
                  <tr key={record.id}>
                    <td>{record.student}</td>
                    <td>{record.artifact}</td>
                    <td>{record.reportingPeriod}</td>
                    <td>{record.status}</td>
                    <td>{record.approver ?? 'Unassigned'}</td>
                    <td>
                      <a href={record.href}>Review record</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>

      <Section
        id="reports"
        title="Reports and evidence"
        description="Explainable attendance, grading, curriculum, promotion and transcript reconciliation views."
        actions={
          props.canExport ? (
            <a className="acad-action" href="/academics/exports/new">
              Create export
            </a>
          ) : undefined
        }
      >
        <ul className="acad-report-list">
          {props.reports.map((report) => (
            <li key={report.href}>
              <a href={report.href}>{report.label}</a>
              <p>{report.description}</p>
              <span>
                {report.updatedAt === undefined
                  ? 'Generated on request'
                  : `Updated ${report.updatedAt}`}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="imports"
        title="Validated imports"
        description="Stage, validate and reconcile row-level errors before applying data exactly once."
        actions={
          props.canStageImports ? (
            <a className="acad-action" href="/academics/imports/new">
              Stage import
            </a>
          ) : undefined
        }
      >
        {props.imports.length === 0 ? (
          <EmptyState
            title="No staged imports"
            detail="Course, roster and calendar imports appear here after validation begins."
          />
        ) : (
          <TableFrame label="Academic import batches">
            <table>
              <caption>Recent academic import validation batches</caption>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Accepted</th>
                  <th scope="col">Rejected</th>
                  <th scope="col">Duplicates</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.imports.map((batch) => (
                  <tr key={batch.batchId}>
                    <td>{batch.filename}</td>
                    <td>{batch.entity}</td>
                    <td>
                      <Status value={batch.status} />
                    </td>
                    <td>{batch.acceptedRows}</td>
                    <td>{batch.rejectedRows}</td>
                    <td>{batch.duplicateRows}</td>
                    <td>
                      <a href={batch.href}>Review validation</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Section>
    </main>
  );
}
