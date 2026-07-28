import type { ReactElement, ReactNode } from 'react';

export interface SisAdminMetric {
  label: string;
  value: number | string;
  context: string;
}

export interface SisQueueItem {
  id: string;
  queue: 'admissions' | 'data-quality' | 'imports' | 'lifecycle';
  title: string;
  description: string;
  status: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  owner?: string;
  dueAt?: string;
  href: string;
}

export interface SisApplicationRow {
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
  programName: string;
  status: string;
  checklistCompleted: number;
  checklistTotal: number;
  submittedAt?: string;
  href: string;
}

export interface SisStudentRow {
  studentProfileId: string;
  studentNumber: string;
  displayName: string;
  campusName: string;
  programName: string;
  academicYear: string;
  enrollmentStatus: string;
  guardianStatus: string;
  href: string;
}

export interface SisImportSummary {
  batchId: string;
  entity: string;
  filename: string;
  status: string;
  validRows: number;
  invalidRows: number;
  appliedRows: number;
  href: string;
}

export interface SisAdminWorkspaceProps {
  schoolName: string;
  metrics: readonly SisAdminMetric[];
  queues: readonly SisQueueItem[];
  applications: readonly SisApplicationRow[];
  students: readonly SisStudentRow[];
  imports: readonly SisImportSummary[];
  reportLinks: readonly { label: string; description: string; href: string }[];
  activeSection?: 'overview' | 'people' | 'admissions' | 'students' | 'imports' | 'reports';
}

const navigation: readonly {
  key: NonNullable<SisAdminWorkspaceProps['activeSection']>;
  label: string;
}[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People and households' },
  { key: 'admissions', label: 'Admissions' },
  { key: 'students', label: 'Students and enrollment' },
  { key: 'imports', label: 'Imports and data quality' },
  { key: 'reports', label: 'Reports' },
];

function Section(props: { title: string; description: string; children: ReactNode }): ReactElement {
  return (
    <section
      aria-labelledby={`${props.title.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')}-heading`}
    >
      <header>
        <h2 id={`${props.title.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')}-heading`}>
          {props.title}
        </h2>
        <p>{props.description}</p>
      </header>
      {props.children}
    </section>
  );
}

function EmptyState(props: { message: string }): ReactElement {
  return <p role="status">{props.message}</p>;
}

function SeverityLabel({ severity }: Pick<SisQueueItem, 'severity'>): ReactElement {
  return <span aria-label={`Severity: ${severity}`}>{severity.toUpperCase()}</span>;
}

export function SisAdminWorkspace(props: SisAdminWorkspaceProps): ReactElement {
  const activeSection = props.activeSection ?? 'overview';
  const urgentQueueCount = props.queues.filter(
    (item) => item.severity === 'critical' || item.severity === 'error',
  ).length;

  return (
    <main id="main-content" tabIndex={-1}>
      <header>
        <p>School information system</p>
        <h1>{props.schoolName}: SIS operations</h1>
        <p>
          Review admissions, people, guardian authority, enrollment movements, imports and data
          quality from one accountable workspace.
        </p>
      </header>

      <nav aria-label="SIS sections">
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

      <section id="overview" aria-labelledby="sis-overview-heading">
        <h2 id="sis-overview-heading">Operational overview</h2>
        <dl>
          {props.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>
                <strong>{metric.value}</strong>
                <span>{metric.context}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p role="status" aria-live="polite">
          {urgentQueueCount === 0
            ? 'No critical or error-level SIS queue items.'
            : `${urgentQueueCount} critical or error-level SIS queue item${urgentQueueCount === 1 ? '' : 's'} require attention.`}
        </p>
      </section>

      <Section
        title="Work queues"
        description="Every exception includes its status, severity, owner and next destination."
      >
        {props.queues.length === 0 ? (
          <EmptyState message="All SIS work queues are clear." />
        ) : (
          <table>
            <caption>Admissions, lifecycle, import and data-quality work</caption>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Queue</th>
                <th scope="col">Item</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col">Due</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {props.queues.map((item) => (
                <tr key={item.id}>
                  <td>
                    <SeverityLabel severity={item.severity} />
                  </td>
                  <td>{item.queue}</td>
                  <td>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </td>
                  <td>{item.status}</td>
                  <td>{item.owner ?? 'Unassigned'}</td>
                  <td>{item.dueAt ?? 'No due date'}</td>
                  <td>
                    <a href={item.href}>Review item</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <section id="people" aria-labelledby="people-search-heading">
        <h2 id="people-search-heading">People and household lookup</h2>
        <form role="search" action="/sis/people" method="get">
          <label htmlFor="sis-person-search">Name, identifier, email or phone</label>
          <input id="sis-person-search" name="query" type="search" autoComplete="off" />
          <button type="submit">Search people</button>
        </form>
        <p>
          Duplicate candidates and guardian-authority restrictions are reviewed through separate
          audited actions; search results never merge records automatically.
        </p>
      </section>

      <Section
        title="Admissions pipeline"
        description="Application status with checklist progress and direct review actions."
      >
        <div id="admissions">
          {props.applications.length === 0 ? (
            <EmptyState message="No applications match the current filters." />
          ) : (
            <table>
              <caption>Current admissions applications</caption>
              <thead>
                <tr>
                  <th scope="col">Application</th>
                  <th scope="col">Applicant</th>
                  <th scope="col">Program</th>
                  <th scope="col">Status</th>
                  <th scope="col">Checklist</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.applications.map((application) => (
                  <tr key={application.applicationId}>
                    <td>{application.applicationNumber}</td>
                    <td>{application.applicantName}</td>
                    <td>{application.programName}</td>
                    <td>{application.status}</td>
                    <td>
                      {application.checklistCompleted} of {application.checklistTotal} complete
                    </td>
                    <td>{application.submittedAt ?? 'Not submitted'}</td>
                    <td>
                      <a href={application.href}>Open application</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section
        title="Students and enrollment"
        description="Current placement is shown alongside guardian readiness and historical lifecycle access."
      >
        <div id="students">
          {props.students.length === 0 ? (
            <EmptyState message="No student enrollments match the current filters." />
          ) : (
            <table>
              <caption>Student and enrollment register</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Student number</th>
                  <th scope="col">Campus</th>
                  <th scope="col">Program and year</th>
                  <th scope="col">Enrollment status</th>
                  <th scope="col">Guardian authority</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.students.map((student) => (
                  <tr key={student.studentProfileId}>
                    <td>{student.displayName}</td>
                    <td>{student.studentNumber}</td>
                    <td>{student.campusName}</td>
                    <td>
                      {student.programName}, {student.academicYear}
                    </td>
                    <td>{student.enrollmentStatus}</td>
                    <td>{student.guardianStatus}</td>
                    <td>
                      <a href={student.href}>Open student record</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section
        title="Imports and data quality"
        description="Validate first, apply exactly once and retain row-level errors for reconciliation."
      >
        <div id="imports">
          <p>
            <a href="/sis/imports/new">Start validated import</a>{' '}
            <a href="/sis/data-quality">Open data-quality queue</a>
          </p>
          {props.imports.length === 0 ? (
            <EmptyState message="No import batches have been staged." />
          ) : (
            <table>
              <caption>Recent SIS import batches</caption>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Valid</th>
                  <th scope="col">Invalid</th>
                  <th scope="col">Applied</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.imports.map((batch) => (
                  <tr key={batch.batchId}>
                    <td>{batch.filename}</td>
                    <td>{batch.entity}</td>
                    <td>{batch.status}</td>
                    <td>{batch.validRows}</td>
                    <td>{batch.invalidRows}</td>
                    <td>{batch.appliedRows}</td>
                    <td>
                      <a href={batch.href}>Review import</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section
        title="Reports and reconciliation"
        description="Snapshots preserve filters, generation time and accountable actor."
      >
        <ul id="reports">
          {props.reportLinks.map((report) => (
            <li key={report.href}>
              <a href={report.href}>{report.label}</a>
              <p>{report.description}</p>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
