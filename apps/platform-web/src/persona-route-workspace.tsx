import { useMemo, useState, type ReactElement } from 'react';

import { adminOverview, guardianOverview, studentOverview, teacherOverview } from './pilot-data';

type AdminOverview = typeof adminOverview;
type TeacherOverview = typeof teacherOverview;
type GuardianOverview = typeof guardianOverview;
type StudentOverview = typeof studentOverview;

interface RegisterRow {
  readonly id: string;
  readonly status: string;
  readonly cells: readonly string[];
  readonly detail: readonly { readonly label: string; readonly value: string }[];
}

interface RegisterView {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly RegisterRow[];
  readonly noun: string;
  readonly boundary?: string;
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function dateOnly(value: string): string {
  return new Date(value).toLocaleDateString('en-BD', { dateStyle: 'medium' });
}

function currency(amountMinor: number, code: string): string {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function RegisterSurface(props: { readonly view: RegisterView }): ReactElement {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string>();
  const statuses = useMemo(
    () => Array.from(new Set(props.view.rows.map((row) => row.status))).sort(),
    [props.view.rows],
  );
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return props.view.rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (normalized === '') return true;
      return [...row.cells, ...row.detail.flatMap((item) => [item.label, item.value])]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [props.view.rows, query, status]);
  const selected = props.view.rows.find((row) => row.id === selectedId);

  return (
    <section
      className="operator-register persona-register"
      aria-labelledby="persona-register-title"
    >
      <header className="operator-register__header">
        <div>
          <p>Current authorised records</p>
          <h2 id="persona-register-title">{props.view.title}</h2>
          <span>{props.view.description}</span>
        </div>
        <div className="operator-register__filters">
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Search ${props.view.noun}s`}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
              <option value="all">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div
        className="operator-register__table"
        tabIndex={0}
        role="region"
        aria-label={`${props.view.title} table`}
      >
        <table>
          <thead>
            <tr>
              {props.view.columns.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
              <th scope="col">
                <span className="operator-register__sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td className="operator-register__empty" colSpan={props.view.columns.length + 1}>
                  No authorised records match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} data-selected={row.id === selectedId ? 'true' : undefined}>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${props.view.columns[index] ?? index}`}>{cell}</td>
                  ))}
                  <td>
                    <button type="button" onClick={() => setSelectedId(row.id)}>
                      View {props.view.noun}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {props.view.boundary === undefined ? null : (
        <p className="operator-register__boundary">{props.view.boundary}</p>
      )}

      {selected === undefined ? null : (
        <aside className="operator-record-preview" aria-labelledby="persona-record-title">
          <div className="operator-record-preview__heading">
            <div>
              <p>Selected {props.view.noun}</p>
              <h3 id="persona-record-title">{selected.cells[0]}</h3>
            </div>
            <button type="button" onClick={() => setSelectedId(undefined)}>
              Close
            </button>
          </div>
          <dl>
            {selected.detail.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </section>
  );
}

function unavailable(title: string, description: string): ReactElement {
  return (
    <section className="operator-register persona-register" aria-label={title}>
      <header className="operator-register__header">
        <div>
          <p>Route integration required</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
      </header>
      <p className="operator-register__boundary">
        This route does not yet have a route-specific authorised read model. It is intentionally not
        represented as a completed workflow. Add the domain read/API contract before enabling
        mutation controls.
      </p>
    </section>
  );
}

export function TeacherRouteWorkspace(props: {
  readonly path: string;
  readonly overview: TeacherOverview;
}): ReactElement {
  if (props.path === '/teacher/classes') {
    return (
      <RegisterSurface
        view={{
          title: 'My class schedule',
          description: 'Assigned sessions with room, time and current state.',
          columns: ['Class', 'Section', 'Starts', 'Room', 'Status'],
          noun: 'class',
          rows: props.overview.sessions.map((item) => ({
            id: item.id,
            status: item.state,
            cells: [item.subject, item.section, dateTime(item.startsAt), item.room, item.state],
            detail: [
              { label: 'Ends', value: dateTime(item.endsAt) },
              { label: 'Section', value: item.section },
              { label: 'Room', value: item.room },
              { label: 'Access', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/teacher/attendance') {
    return (
      <RegisterSurface
        view={{
          title: 'Assigned attendance registers',
          description: 'See roster progress and sync state for each assigned session.',
          columns: ['Class', 'Session', 'Marked', 'Roster', 'Status'],
          noun: 'register',
          boundary:
            'Attendance mutation must use the approved assigned-class attendance command and offline reconciliation contract; this staging route currently exposes the authoritative register state only.',
          rows: props.overview.attendance.map((item) => ({
            id: item.id,
            status: item.state,
            cells: [
              item.classLabel,
              dateTime(item.sessionAt),
              String(item.markedCount),
              String(item.rosterCount),
              item.state,
            ],
            detail: [
              { label: 'Progress', value: `${item.markedCount} of ${item.rosterCount} marked` },
              { label: 'Sync state', value: item.state },
              { label: 'Permission', value: item.requiredCapability },
              {
                label: 'Next action',
                value:
                  item.markedCount === item.rosterCount
                    ? 'Finalise through the approved attendance workflow'
                    : 'Complete the assigned roster',
              },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/teacher/gradebook') {
    return (
      <RegisterSurface
        view={{
          title: 'Gradebook work',
          description: 'Assessment entry progress and publication state for assigned classes.',
          columns: ['Class', 'Assessment', 'Entered', 'Due', 'Status'],
          noun: 'assessment',
          boundary:
            'Grade entry and publication controls remain disabled until the route-specific gradebook mutation API is connected.',
          rows: props.overview.gradebook.map((item) => ({
            id: item.id,
            status: item.publicationState,
            cells: [
              item.classLabel,
              item.assessmentLabel,
              `${item.enteredCount} / ${item.studentCount}`,
              dateTime(item.dueAt),
              item.publicationState,
            ],
            detail: [
              { label: 'Students', value: String(item.studentCount) },
              { label: 'Entries complete', value: String(item.enteredCount) },
              { label: 'Due', value: dateTime(item.dueAt) },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/teacher/students') {
    return (
      <RegisterSurface
        view={{
          title: 'Assigned student context',
          description: 'Only teaching-relevant student context granted to the current teacher.',
          columns: ['Student', 'Class', 'Learning context', 'Next action', 'Status'],
          noun: 'student',
          rows: props.overview.studentContext.map((item) => ({
            id: item.id,
            status: 'Assigned',
            cells: [
              item.displayName,
              item.classLabel,
              item.learningSummary,
              item.nextAction,
              'Assigned',
            ],
            detail: [
              { label: 'Class', value: item.classLabel },
              { label: 'Permitted tags', value: item.permittedTags.join(', ') },
              { label: 'Next action', value: item.nextAction },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/teacher/messages') {
    return (
      <RegisterSurface
        view={{
          title: 'Teacher inbox',
          description: 'Permitted conversations with students, households and colleagues.',
          columns: ['Subject', 'Participant', 'Last message', 'Unread', 'Status'],
          noun: 'conversation',
          rows: props.overview.conversations.map((item) => ({
            id: item.id,
            status: item.unreadCount > 0 ? 'Unread' : 'Read',
            cells: [
              item.subject,
              item.participantLabel,
              dateTime(item.lastMessageAt),
              String(item.unreadCount),
              item.unreadCount > 0 ? 'Unread' : 'Read',
            ],
            detail: [
              { label: 'Participant', value: item.participantLabel },
              { label: 'Last message', value: dateTime(item.lastMessageAt) },
              { label: 'Unread messages', value: String(item.unreadCount) },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  return unavailable(
    'Class resources',
    'The current teacher projection does not yet include route-level resource records.',
  );
}

export function GuardianRouteWorkspace(props: {
  readonly path: string;
  readonly overview: GuardianOverview;
}): ReactElement {
  if (props.path === '/family/children') {
    return (
      <RegisterSurface
        view={{
          title: 'My children',
          description: 'Authorised household-linked student identities and current school context.',
          columns: ['Student', 'Year', 'Campus', 'Relationship', 'Status'],
          noun: 'student',
          rows: props.overview.children.map((item) => ({
            id: item.childId,
            status: 'Linked',
            cells: [
              item.displayName,
              item.yearLabel,
              item.campusLabel,
              item.relationshipLabel,
              'Linked',
            ],
            detail: [
              { label: 'Preferred name', value: item.preferredName },
              { label: 'Year', value: item.yearLabel },
              { label: 'Campus', value: item.campusLabel },
              { label: 'Relationship', value: item.relationshipLabel },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/applications') {
    return (
      <RegisterSurface
        view={{
          title: 'Family applications',
          description:
            'Application status, due dates and the next action requested from the household.',
          columns: ['Applicant', 'Programme', 'Next action', 'Due', 'Status'],
          noun: 'application',
          rows: props.overview.applications.map((item) => ({
            id: item.id,
            status: item.statusLabel,
            cells: [
              item.applicantName,
              item.programmeLabel,
              item.nextAction,
              dateTime(item.dueAt),
              item.statusLabel,
            ],
            detail: [
              { label: 'Programme', value: item.programmeLabel },
              { label: 'Next action', value: item.nextAction },
              { label: 'Due', value: dateTime(item.dueAt) },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/attendance') {
    return (
      <RegisterSurface
        view={{
          title: 'Published attendance',
          description: 'Published attendance summary and explanation status for linked children.',
          columns: ['Period', 'Present', 'Absent', 'Late', 'Status'],
          noun: 'attendance record',
          rows: props.overview.attendance.map((item) => ({
            id: item.id,
            status: item.notice,
            cells: [
              item.periodLabel,
              String(item.presentCount),
              String(item.absentCount),
              String(item.lateCount),
              item.notice,
            ],
            detail: [
              { label: 'Published', value: dateTime(item.publishedAt) },
              { label: 'Present', value: String(item.presentCount) },
              { label: 'Absent', value: String(item.absentCount) },
              { label: 'Late', value: String(item.lateCount) },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/grades') {
    return (
      <RegisterSurface
        view={{
          title: 'Published results',
          description: 'Published subject results and teacher comments for linked children.',
          columns: ['Subject', 'Result', 'Published', 'Comment', 'Status'],
          noun: 'result',
          rows: props.overview.grades.map((item) => ({
            id: item.id,
            status: item.publicationState,
            cells: [
              item.subjectLabel,
              item.resultLabel,
              dateTime(item.publishedAt),
              item.teacherComment,
              item.publicationState,
            ],
            detail: [
              { label: 'Subject', value: item.subjectLabel },
              { label: 'Result', value: item.resultLabel },
              { label: 'Teacher comment', value: item.teacherComment },
              { label: 'Published', value: dateTime(item.publishedAt) },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/finance') {
    return (
      <RegisterSurface
        view={{
          title: 'Household fees',
          description: 'Current authorised household balances and due dates.',
          columns: ['Charge', 'Amount', 'Due', 'Balance state', 'Status'],
          noun: 'fee',
          boundary:
            'Payment actions remain enabled only where an approved payment provider and household payment contract are configured.',
          rows: props.overview.fees.map((item) => ({
            id: item.id,
            status: item.balanceState,
            cells: [
              item.label,
              currency(item.amountMinor, item.currency),
              dateTime(item.dueAt),
              item.balanceState,
              item.balanceState,
            ],
            detail: [
              { label: 'Charge', value: item.label },
              { label: 'Amount', value: currency(item.amountMinor, item.currency) },
              { label: 'Due', value: dateTime(item.dueAt) },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/forms') {
    return (
      <RegisterSurface
        view={{
          title: 'Forms and consent',
          description: 'Household forms requiring review, consent or acknowledgement.',
          columns: ['Form', 'Description', 'Due', 'Assurance', 'Status'],
          noun: 'form',
          rows: props.overview.forms.map((item) => ({
            id: item.id,
            status: item.state,
            cells: [
              item.title,
              item.description,
              dateTime(item.dueAt),
              item.requiresAssurance,
              item.state,
            ],
            detail: [
              { label: 'Description', value: item.description },
              { label: 'Due', value: dateTime(item.dueAt) },
              { label: 'Assurance', value: item.requiresAssurance },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/documents') {
    return (
      <RegisterSurface
        view={{
          title: 'Family documents',
          description: 'Published records available to the authorised household.',
          columns: ['Document', 'Category', 'Published', 'Access', 'Status'],
          noun: 'document',
          rows: props.overview.documents.map((item) => ({
            id: item.id,
            status: 'Available',
            cells: [
              item.title,
              item.category,
              dateTime(item.publishedAt),
              'Household',
              'Available',
            ],
            detail: [
              { label: 'Category', value: item.category },
              { label: 'Published', value: dateTime(item.publishedAt) },
              { label: 'Permission', value: item.requiredCapability },
              { label: 'Access', value: 'Authorised household only' },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/family/messages') {
    return (
      <RegisterSurface
        view={{
          title: 'Family messages',
          description: 'Secure conversations linked to the authorised household and child context.',
          columns: ['Subject', 'Participant', 'Last message', 'Unread', 'Status'],
          noun: 'conversation',
          rows: props.overview.conversations.map((item) => ({
            id: item.id,
            status: item.unreadCount > 0 ? 'Unread' : 'Read',
            cells: [
              item.subject,
              item.participantLabel,
              dateTime(item.lastMessageAt),
              String(item.unreadCount),
              item.unreadCount > 0 ? 'Unread' : 'Read',
            ],
            detail: [
              { label: 'Participant', value: item.participantLabel },
              { label: 'Last message', value: dateTime(item.lastMessageAt) },
              { label: 'Unread messages', value: String(item.unreadCount) },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  return unavailable(
    'Family workspace',
    'No route-specific family projection is connected for this destination.',
  );
}

export function StudentRouteWorkspace(props: {
  readonly path: string;
  readonly overview: StudentOverview;
}): ReactElement {
  if (props.path === '/student/timetable') {
    return (
      <RegisterSurface
        view={{
          title: 'My timetable',
          description: 'Current and upcoming lessons from the authorised student schedule.',
          columns: ['Subject', 'Teacher', 'Starts', 'Room', 'Status'],
          noun: 'lesson',
          rows: props.overview.lessons.map((item) => ({
            id: item.id,
            status: item.state,
            cells: [
              item.subject,
              item.teacherLabel,
              dateTime(item.startsAt),
              item.room,
              item.state,
            ],
            detail: [
              { label: 'Teacher', value: item.teacherLabel },
              { label: 'Starts', value: dateTime(item.startsAt) },
              { label: 'Ends', value: dateTime(item.endsAt) },
              { label: 'Room', value: item.room },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/student/attendance') {
    return (
      <RegisterSurface
        view={{
          title: 'My attendance',
          description: 'Published attendance totals and explanation state.',
          columns: ['Period', 'Present', 'Absent', 'Late', 'Status'],
          noun: 'attendance record',
          rows: props.overview.attendance.map((item) => ({
            id: item.id,
            status: item.publicationState,
            cells: [
              item.periodLabel,
              String(item.presentCount),
              String(item.absentCount),
              String(item.lateCount),
              item.publicationState,
            ],
            detail: [
              { label: 'Explanation', value: item.explanationStatus },
              { label: 'Published', value: dateTime(item.publishedAt) },
              { label: 'Present', value: String(item.presentCount) },
              { label: 'Absent', value: String(item.absentCount) },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/student/results') {
    return (
      <RegisterSurface
        view={{
          title: 'Published results',
          description: 'Published assessment results and feedback.',
          columns: ['Subject', 'Assessment', 'Result', 'Published', 'Status'],
          noun: 'result',
          rows: props.overview.results.map((item) => ({
            id: item.id,
            status: item.publicationState,
            cells: [
              item.subjectLabel,
              item.assessmentLabel,
              item.resultLabel,
              dateTime(item.publishedAt),
              item.publicationState,
            ],
            detail: [
              { label: 'Assessment', value: item.assessmentLabel },
              { label: 'Result', value: item.resultLabel },
              { label: 'Feedback', value: item.feedback },
              { label: 'Published', value: dateTime(item.publishedAt) },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/student/resources') {
    return (
      <RegisterSurface
        view={{
          title: 'Learning resources',
          description: 'Resources currently available to the signed-in student.',
          columns: ['Resource', 'Subject', 'Type', 'Available until', 'Status'],
          noun: 'resource',
          rows: props.overview.resources.map((item) => ({
            id: item.id,
            status: 'Available',
            cells: [
              item.title,
              item.subjectLabel,
              item.resourceType,
              dateOnly(item.availableUntil),
              'Available',
            ],
            detail: [
              { label: 'Subject', value: item.subjectLabel },
              { label: 'Description', value: item.description },
              { label: 'Type', value: item.resourceType },
              { label: 'Available until', value: dateTime(item.availableUntil) },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/student/requests') {
    return (
      <RegisterSurface
        view={{
          title: 'My requests',
          description: 'Requests submitted by the current student and their next action.',
          columns: ['Request', 'Submitted', 'Next action', 'Permission', 'Status'],
          noun: 'request',
          rows: props.overview.requests.map((item) => ({
            id: item.id,
            status: item.state,
            cells: [
              item.title,
              dateTime(item.submittedAt),
              item.nextAction,
              item.requiredCapability,
              item.state,
            ],
            detail: [
              { label: 'Description', value: item.description },
              { label: 'Submitted', value: dateTime(item.submittedAt) },
              { label: 'Next action', value: item.nextAction },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/student/documents') {
    return (
      <RegisterSurface
        view={{
          title: 'My documents',
          description: 'Published school records currently authorised for the signed-in student.',
          columns: ['Document', 'Category', 'Published', 'Access', 'Status'],
          noun: 'document',
          rows: props.overview.documents.map((item) => ({
            id: item.id,
            status: item.publicationState,
            cells: [
              item.title,
              item.category,
              dateTime(item.publishedAt),
              'Student',
              item.publicationState,
            ],
            detail: [
              { label: 'Category', value: item.category },
              { label: 'Published', value: dateTime(item.publishedAt) },
              { label: 'Permission', value: item.requiredCapability },
              { label: 'Access', value: 'Signed-in student only' },
            ],
          })),
        }}
      />
    );
  }

  if (props.path === '/student/messages') {
    return (
      <RegisterSurface
        view={{
          title: 'My messages',
          description: 'Permitted school conversations for the signed-in student.',
          columns: ['Subject', 'Participant', 'Last message', 'Unread', 'Status'],
          noun: 'conversation',
          rows: props.overview.conversations.map((item) => ({
            id: item.id,
            status: item.unreadCount > 0 ? 'Unread' : 'Read',
            cells: [
              item.subject,
              item.participantLabel,
              dateTime(item.lastMessageAt),
              String(item.unreadCount),
              item.unreadCount > 0 ? 'Unread' : 'Read',
            ],
            detail: [
              { label: 'Participant', value: item.participantLabel },
              { label: 'Last message', value: dateTime(item.lastMessageAt) },
              { label: 'Unread messages', value: String(item.unreadCount) },
              { label: 'Permission', value: item.requiredCapability },
            ],
          })),
        }}
      />
    );
  }

  return unavailable(
    'Student workspace',
    'No route-specific student projection is connected for this destination.',
  );
}

export function AdminRouteWorkspace(props: {
  readonly path: string;
  readonly overview: AdminOverview;
}): ReactElement {
  if (props.path === '/admin/academics') {
    const rows: RegisterRow[] = props.overview.exceptions
      .filter((item) => item.area === 'Attendance')
      .map((item) => ({
        id: item.id,
        status: item.status,
        cells: [
          item.title,
          item.summary,
          item.severity,
          item.dueAt === undefined ? '—' : dateTime(item.dueAt),
          item.status,
        ],
        detail: [
          { label: 'Area', value: item.area },
          { label: 'Severity', value: item.severity },
          { label: 'Source', value: item.source.label },
          { label: 'Permission', value: item.capability },
        ],
      }));
    return (
      <RegisterSurface
        view={{
          title: 'Academic operations exceptions',
          description:
            'Current authorised academic and attendance exceptions from the admin projection.',
          columns: ['Exception', 'Summary', 'Severity', 'Due', 'Status'],
          noun: 'exception',
          rows,
          boundary:
            'Full timetable, attendance, assessment, gradebook and records registers require route-specific database read models; the generic pilot metrics are not treated as completed workflows.',
        }}
      />
    );
  }

  if (props.path === '/admin/finance') {
    const rows: RegisterRow[] = props.overview.exceptions
      .filter((item) => item.area === 'Finance')
      .map((item) => ({
        id: item.id,
        status: item.status,
        cells: [item.title, item.summary, item.severity, item.source.label, item.status],
        detail: [
          { label: 'Area', value: item.area },
          { label: 'Severity', value: item.severity },
          { label: 'Source', value: item.source.label },
          { label: 'Permission', value: item.capability },
        ],
      }));
    return (
      <RegisterSurface
        view={{
          title: 'Finance exceptions',
          description: 'Current finance exceptions from the authorised admin projection.',
          columns: ['Exception', 'Summary', 'Severity', 'Source', 'Status'],
          noun: 'exception',
          rows,
          boundary:
            'Invoice, receipt, reconciliation and ledger registers must be connected to their database-owned route read models before this admin destination can be considered complete.',
        }}
      />
    );
  }

  if (props.path === '/admin/student-support') {
    const rows: RegisterRow[] = props.overview.exceptions
      .filter((item) => item.area === 'Student support')
      .map((item) => ({
        id: item.id,
        status: item.status,
        cells: [
          item.title,
          item.summary,
          item.severity,
          item.requiredAssurance ?? 'aal1',
          item.status,
        ],
        detail: [
          { label: 'Area', value: item.area },
          { label: 'Assurance', value: item.requiredAssurance ?? 'aal1' },
          { label: 'Source', value: item.source.label },
          { label: 'Permission', value: item.capability },
        ],
      }));
    return (
      <RegisterSurface
        view={{
          title: 'Permitted student-support work',
          description:
            'Restricted support items remain masked until the required assurance is satisfied.',
          columns: ['Task', 'Summary', 'Severity', 'Assurance', 'Status'],
          noun: 'support task',
          rows,
        }}
      />
    );
  }

  if (props.path === '/admin/sis') {
    return (
      <RegisterSurface
        view={{
          title: 'People and student search',
          description: 'Current student records surfaced by the admin search projection.',
          columns: ['Record', 'Type', 'Context', 'Permission', 'Status'],
          noun: 'record',
          rows: props.overview.searchResults.map((item) => ({
            id: item.id,
            status: 'Available',
            cells: [item.label, item.kind, item.context, item.capability, 'Available'],
            detail: [
              { label: 'Type', value: item.kind },
              { label: 'Context', value: item.context },
              { label: 'Permission', value: item.capability },
              { label: 'Scope', value: 'Current tenant and campus' },
            ],
          })),
          boundary:
            'The complete student/admissions register requires a route-specific database projection. This view exposes only records present in the current authorised admin search snapshot.',
        }}
      />
    );
  }

  return unavailable(
    'Admin module integration',
    'This admin destination still lacks a route-specific database projection and must not be treated as a completed operational screen.',
  );
}
