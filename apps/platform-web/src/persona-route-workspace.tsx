import { useMemo, useState, type ReactElement } from 'react';

import './operator-route-workspace.css';

type Persona = 'admin' | 'teacher' | 'guardian' | 'student';
type DataRecord = Record<string, unknown>;
type Field = readonly [label: string, key: string];

interface RouteSpec {
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly fields: readonly Field[];
  readonly noun: string;
  readonly filter?: readonly [key: string, value: string];
  readonly boundary?: string;
}

const specs: Readonly<Record<Persona, Readonly<Record<string, RouteSpec>>>> = {
  teacher: {
    '/teacher/classes': {
      title: 'My class schedule',
      description: 'Assigned sessions with room, time and current state.',
      source: 'sessions',
      fields: [
        ['Class', 'subject'],
        ['Section', 'section'],
        ['Starts', 'startsAt'],
        ['Room', 'room'],
        ['Status', 'state'],
      ],
      noun: 'class',
    },
    '/teacher/attendance': {
      title: 'Assigned attendance registers',
      description: 'Roster progress and sync state for each assigned session.',
      source: 'attendance',
      fields: [
        ['Class', 'classLabel'],
        ['Session', 'sessionAt'],
        ['Marked', 'markedCount'],
        ['Roster', 'rosterCount'],
        ['Status', 'state'],
      ],
      noun: 'register',
      boundary:
        'Attendance changes must use the approved assigned-class attendance and offline reconciliation contracts.',
    },
    '/teacher/gradebook': {
      title: 'Gradebook work',
      description: 'Assessment entry progress and publication state for assigned classes.',
      source: 'gradebook',
      fields: [
        ['Class', 'classLabel'],
        ['Assessment', 'assessmentLabel'],
        ['Entered', 'enteredCount'],
        ['Due', 'dueAt'],
        ['Status', 'publicationState'],
      ],
      noun: 'assessment',
      boundary:
        'Grade entry stays read-only until the reviewed gradebook mutation API is connected.',
    },
    '/teacher/students': {
      title: 'Assigned student context',
      description: 'Only teaching-relevant student context granted to the current teacher.',
      source: 'studentContext',
      fields: [
        ['Student', 'displayName'],
        ['Class', 'classLabel'],
        ['Learning context', 'learningSummary'],
        ['Next action', 'nextAction'],
      ],
      noun: 'student',
    },
    '/teacher/messages': {
      title: 'Teacher inbox',
      description: 'Permitted conversations with students, households and colleagues.',
      source: 'conversations',
      fields: [
        ['Subject', 'subject'],
        ['Participant', 'participantLabel'],
        ['Last message', 'lastMessageAt'],
        ['Unread', 'unreadCount'],
      ],
      noun: 'conversation',
    },
  },
  guardian: {
    '/family/children': {
      title: 'My children',
      description: 'Authorised household-linked students and current school context.',
      source: 'children',
      fields: [
        ['Student', 'displayName'],
        ['Year', 'yearLabel'],
        ['Campus', 'campusLabel'],
        ['Relationship', 'relationshipLabel'],
      ],
      noun: 'student',
    },
    '/family/applications': {
      title: 'Family applications',
      description: 'Application status, due date and the next action requested from the household.',
      source: 'applications',
      fields: [
        ['Applicant', 'applicantName'],
        ['Programme', 'programmeLabel'],
        ['Next action', 'nextAction'],
        ['Due', 'dueAt'],
        ['Status', 'statusLabel'],
      ],
      noun: 'application',
    },
    '/family/attendance': {
      title: 'Published attendance',
      description: 'Published attendance summary and explanation state for linked children.',
      source: 'attendance',
      fields: [
        ['Period', 'periodLabel'],
        ['Present', 'presentCount'],
        ['Absent', 'absentCount'],
        ['Late', 'lateCount'],
        ['Status', 'notice'],
      ],
      noun: 'attendance record',
    },
    '/family/grades': {
      title: 'Published results',
      description: 'Published subject results and teacher comments for linked children.',
      source: 'grades',
      fields: [
        ['Subject', 'subjectLabel'],
        ['Result', 'resultLabel'],
        ['Published', 'publishedAt'],
        ['Comment', 'teacherComment'],
        ['Status', 'publicationState'],
      ],
      noun: 'result',
    },
    '/family/finance': {
      title: 'Household fees',
      description: 'Current authorised household balances and due dates.',
      source: 'fees',
      fields: [
        ['Charge', 'label'],
        ['Amount', 'amountMinor'],
        ['Due', 'dueAt'],
        ['Status', 'balanceState'],
      ],
      noun: 'fee',
      boundary:
        'Payments appear only when an approved payment provider and household contract are configured.',
    },
    '/family/forms': {
      title: 'Forms and consent',
      description: 'Household forms requiring review, consent or acknowledgement.',
      source: 'forms',
      fields: [
        ['Form', 'title'],
        ['Due', 'dueAt'],
        ['Assurance', 'requiresAssurance'],
        ['Status', 'state'],
      ],
      noun: 'form',
    },
    '/family/documents': {
      title: 'Family documents',
      description: 'Published records available to the authorised household.',
      source: 'documents',
      fields: [
        ['Document', 'title'],
        ['Category', 'category'],
        ['Published', 'publishedAt'],
      ],
      noun: 'document',
    },
    '/family/messages': {
      title: 'Family messages',
      description: 'Secure conversations linked to the authorised household and child context.',
      source: 'conversations',
      fields: [
        ['Subject', 'subject'],
        ['Participant', 'participantLabel'],
        ['Last message', 'lastMessageAt'],
        ['Unread', 'unreadCount'],
      ],
      noun: 'conversation',
    },
  },
  student: {
    '/student/timetable': {
      title: 'My timetable',
      description: 'Current and upcoming lessons from the authorised student schedule.',
      source: 'lessons',
      fields: [
        ['Subject', 'subject'],
        ['Teacher', 'teacherLabel'],
        ['Starts', 'startsAt'],
        ['Room', 'room'],
        ['Status', 'state'],
      ],
      noun: 'lesson',
    },
    '/student/attendance': {
      title: 'My attendance',
      description: 'Published attendance totals and explanation state.',
      source: 'attendance',
      fields: [
        ['Period', 'periodLabel'],
        ['Present', 'presentCount'],
        ['Absent', 'absentCount'],
        ['Late', 'lateCount'],
        ['Status', 'publicationState'],
      ],
      noun: 'attendance record',
    },
    '/student/results': {
      title: 'Published results',
      description: 'Published assessment results and feedback.',
      source: 'results',
      fields: [
        ['Subject', 'subjectLabel'],
        ['Assessment', 'assessmentLabel'],
        ['Result', 'resultLabel'],
        ['Published', 'publishedAt'],
        ['Status', 'publicationState'],
      ],
      noun: 'result',
    },
    '/student/resources': {
      title: 'Learning resources',
      description: 'Resources currently available to the signed-in student.',
      source: 'resources',
      fields: [
        ['Resource', 'title'],
        ['Subject', 'subjectLabel'],
        ['Type', 'resourceType'],
        ['Available until', 'availableUntil'],
      ],
      noun: 'resource',
    },
    '/student/requests': {
      title: 'My requests',
      description: 'Requests submitted by the current student and their next action.',
      source: 'requests',
      fields: [
        ['Request', 'title'],
        ['Submitted', 'submittedAt'],
        ['Next action', 'nextAction'],
        ['Status', 'state'],
      ],
      noun: 'request',
    },
    '/student/documents': {
      title: 'My documents',
      description: 'Published school records authorised for the signed-in student.',
      source: 'documents',
      fields: [
        ['Document', 'title'],
        ['Category', 'category'],
        ['Published', 'publishedAt'],
        ['Status', 'publicationState'],
      ],
      noun: 'document',
    },
    '/student/messages': {
      title: 'My messages',
      description: 'Permitted school conversations for the signed-in student.',
      source: 'conversations',
      fields: [
        ['Subject', 'subject'],
        ['Participant', 'participantLabel'],
        ['Last message', 'lastMessageAt'],
        ['Unread', 'unreadCount'],
      ],
      noun: 'conversation',
    },
  },
  admin: {
    '/admin/sis': {
      title: 'People and student search',
      description: 'Records present in the current authorised admin search projection.',
      source: 'searchResults',
      fields: [
        ['Record', 'label'],
        ['Type', 'kind'],
        ['Context', 'context'],
        ['Permission', 'capability'],
      ],
      noun: 'record',
      boundary: 'The complete SIS register still needs its route-specific database projection.',
    },
    '/admin/academics': {
      title: 'Academic operations exceptions',
      description: 'Current authorised academic and attendance exceptions.',
      source: 'exceptions',
      filter: ['area', 'Attendance'],
      fields: [
        ['Exception', 'title'],
        ['Summary', 'summary'],
        ['Severity', 'severity'],
        ['Due', 'dueAt'],
        ['Status', 'status'],
      ],
      noun: 'exception',
      boundary:
        'Full timetable, attendance, assessment, gradebook and records registers need route read models.',
    },
    '/admin/finance': {
      title: 'Finance exceptions',
      description: 'Current finance exceptions from the authorised admin projection.',
      source: 'exceptions',
      filter: ['area', 'Finance'],
      fields: [
        ['Exception', 'title'],
        ['Summary', 'summary'],
        ['Severity', 'severity'],
        ['Status', 'status'],
      ],
      noun: 'exception',
      boundary:
        'Invoices, receipts, reconciliation and ledger need their database-owned route read models.',
    },
    '/admin/student-support': {
      title: 'Permitted student-support work',
      description: 'Restricted support items stay masked until required assurance is satisfied.',
      source: 'exceptions',
      filter: ['area', 'Student support'],
      fields: [
        ['Task', 'title'],
        ['Summary', 'summary'],
        ['Severity', 'severity'],
        ['Assurance', 'requiredAssurance'],
        ['Status', 'status'],
      ],
      noun: 'support task',
    },
  },
};

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsFor(overview: unknown, spec: RouteSpec): DataRecord[] {
  if (!isRecord(overview)) return [];
  const source = overview[spec.source];
  if (!Array.isArray(source)) return [];
  return source.filter(
    (item: unknown): item is DataRecord =>
      isRecord(item) && (spec.filter === undefined || item[spec.filter[0]] === spec.filter[1]),
  );
}

function valueFor(record: DataRecord, key: string): string {
  const value = record[key];
  if (value === undefined || value === null || value === '') return '—';
  if (key === 'amountMinor' && typeof value === 'number') {
    const currency = typeof record.currency === 'string' ? record.currency : 'BDT';
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value / 100);
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'string' && /(At|Until)$/u.test(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) {
      return date.toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

function statusFor(record: DataRecord): string {
  for (const key of [
    'status',
    'state',
    'publicationState',
    'balanceState',
    'statusLabel',
    'notice',
  ]) {
    const value = record[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return 'Available';
}

function idFor(record: DataRecord, index: number): string {
  for (const key of ['id', 'childId']) {
    const value = record[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return `record-${index}`;
}

function Unavailable(props: { readonly title: string }): ReactElement {
  return (
    <section className="operator-register persona-register" aria-label={props.title}>
      <header className="operator-register__header">
        <div>
          <p>Route integration required</p>
          <h2>{props.title}</h2>
          <span>This destination does not yet have a route-specific authorised read model.</span>
        </div>
      </header>
      <p className="operator-register__boundary">
        This route is intentionally not represented as completed software. Connect the domain
        read/API contract before enabling record or mutation controls.
      </p>
    </section>
  );
}

export function PersonaRouteWorkspace(props: {
  readonly persona: Persona;
  readonly path: string;
  readonly overview: unknown;
}): ReactElement {
  const spec = specs[props.persona][props.path];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string>();

  const rows = useMemo(
    () => (spec === undefined ? [] : rowsFor(props.overview, spec)),
    [props.overview, spec],
  );
  const statuses = useMemo(() => Array.from(new Set(rows.map(statusFor))).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return rows.filter((record) => {
      if (status !== 'all' && statusFor(record) !== status) return false;
      if (normalized === '') return true;
      return Object.values(record).map(String).join(' ').toLocaleLowerCase().includes(normalized);
    });
  }, [query, rows, status]);

  if (spec === undefined) return <Unavailable title="Module workspace" />;

  const selected = rows.find((record, index) => idFor(record, index) === selectedId);

  return (
    <section
      className="operator-register persona-register"
      aria-labelledby="persona-register-title"
    >
      <header className="operator-register__header">
        <div>
          <p>Current authorised records</p>
          <h2 id="persona-register-title">{spec.title}</h2>
          <span>{spec.description}</span>
        </div>
        <div className="operator-register__filters">
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Search ${spec.noun}s`}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
              <option value="all">All statuses</option>
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div
        className="operator-register__table"
        tabIndex={0}
        role="region"
        aria-label={`${spec.title} table`}
      >
        <table>
          <thead>
            <tr>
              {spec.fields.map(([label]) => (
                <th scope="col" key={label}>
                  {label}
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
                <td className="operator-register__empty" colSpan={spec.fields.length + 1}>
                  No authorised records match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((record, index) => {
                const id = idFor(record, index);
                return (
                  <tr key={id} data-selected={id === selectedId ? 'true' : undefined}>
                    {spec.fields.map(([label, key]) => (
                      <td key={`${id}-${label}`}>{valueFor(record, key)}</td>
                    ))}
                    <td>
                      <button type="button" onClick={() => setSelectedId(id)}>
                        View {spec.noun}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {spec.boundary === undefined ? null : (
        <p className="operator-register__boundary">{spec.boundary}</p>
      )}

      {selected === undefined ? null : (
        <aside className="operator-record-preview" aria-labelledby="persona-record-title">
          <div className="operator-record-preview__heading">
            <div>
              <p>Selected {spec.noun}</p>
              <h3 id="persona-record-title">{valueFor(selected, spec.fields[0]?.[1] ?? 'id')}</h3>
            </div>
            <button type="button" onClick={() => setSelectedId(undefined)}>
              Close
            </button>
          </div>
          <dl>
            {spec.fields.map(([label, key]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{valueFor(selected, key)}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </section>
  );
}
