import { useMemo, useState, type ReactElement } from 'react';

import type { OperatorRole } from './operator-portal';

interface RegisterRow {
  readonly id: string;
  readonly status: string;
  readonly cells: readonly string[];
  readonly detail: readonly { readonly label: string; readonly value: string }[];
}

interface RegisterDefinition {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly RegisterRow[];
  readonly recordLabel: string;
  readonly mutationNote?: string;
}

const registers: Readonly<Record<string, RegisterDefinition>> = {
  '/admissions/enquiries': {
    title: 'Enquiry register',
    description:
      'Find prospective families, see ownership and follow-up state, then open the enquiry context.',
    columns: ['Family / applicant', 'Interested in', 'Owner', 'Last contact', 'Status'],
    recordLabel: 'enquiry',
    rows: [
      {
        id: 'enquiry-1001',
        status: 'Follow up today',
        cells: [
          'Rahman family · Aya Rahman',
          'Year 6 · 2027 intake',
          'Farhana Islam',
          'Today · 09:10',
          'Follow up today',
        ],
        detail: [
          { label: 'Primary contact', value: 'Mrs Rahman · guardian' },
          { label: 'Contact channel', value: 'Email and phone' },
          { label: 'Next action', value: 'Send curriculum and transport information' },
          { label: 'Source', value: 'School website enquiry form' },
        ],
      },
      {
        id: 'enquiry-1002',
        status: 'New',
        cells: [
          'Hasan family · Karim Hasan',
          'Year 3 · 2027 intake',
          'Unassigned',
          'Yesterday · 16:40',
          'New',
        ],
        detail: [
          { label: 'Primary contact', value: 'Mr Hasan · guardian' },
          { label: 'Contact channel', value: 'Phone' },
          { label: 'Next action', value: 'Assign an admissions owner and make first contact' },
          { label: 'Source', value: 'Open day QR form' },
        ],
      },
      {
        id: 'enquiry-1003',
        status: 'Waiting for family',
        cells: [
          'Noor family · Nabil Noor',
          'Year 3 · 2027 intake',
          'Farhana Islam',
          '31 Jul · 14:20',
          'Waiting for family',
        ],
        detail: [
          { label: 'Primary contact', value: 'Mr Noor · guardian' },
          { label: 'Contact channel', value: 'Email' },
          { label: 'Next action', value: 'Wait for the requested prior-school document' },
          { label: 'Source', value: 'Referral' },
        ],
      },
    ],
  },
  '/admissions/applications': {
    title: 'Application review register',
    description:
      'Review submission readiness and open the application context before recording a decision.',
    columns: ['Applicant', 'Programme', 'Submitted', 'Documents', 'Status'],
    recordLabel: 'application',
    mutationNote:
      'Production review decisions use the database-owned application work queue and reviewed command contract.',
    rows: [
      {
        id: 'application-1001',
        status: 'Ready for review',
        cells: [
          'Nabil Noor',
          'Year 3 · 2027 intake',
          '30 Jul · 11:06',
          '6 / 6 verified',
          'Ready for review',
        ],
        detail: [
          { label: 'Application number', value: 'APP-DEMO-0001' },
          { label: 'Family', value: 'Noor family' },
          { label: 'Readiness', value: 'Required documents complete' },
          { label: 'Next action', value: 'Admissions officer review' },
        ],
      },
      {
        id: 'application-1002',
        status: 'Missing document',
        cells: [
          'Aya Rahman',
          'Year 6 · 2027 intake',
          '29 Jul · 15:18',
          '5 / 6 verified',
          'Missing document',
        ],
        detail: [
          { label: 'Application number', value: 'APP-DEMO-0002' },
          { label: 'Family', value: 'Rahman family' },
          { label: 'Readiness', value: 'Prior-school report required' },
          { label: 'Next action', value: 'Request missing document' },
        ],
      },
      {
        id: 'application-1003',
        status: 'Interview booked',
        cells: [
          'Karim Hasan',
          'Year 3 · 2027 intake',
          '28 Jul · 10:32',
          '6 / 6 verified',
          'Interview booked',
        ],
        detail: [
          { label: 'Application number', value: 'APP-DEMO-0003' },
          { label: 'Family', value: 'Hasan family' },
          { label: 'Readiness', value: 'Screening complete' },
          { label: 'Next action', value: 'Complete scheduled interview' },
        ],
      },
    ],
  },
  '/admissions/interviews': {
    title: 'Interview schedule',
    description:
      'See applicants, appointment time, interviewer and next action in one working register.',
    columns: ['Applicant', 'Programme', 'When', 'Interviewer / location', 'Status'],
    recordLabel: 'interview',
    mutationNote:
      'Scheduling and interview-outcome mutations are not yet connected to an approved production API; this staging route is intentionally read-only rather than presenting a fake action.',
    rows: [
      {
        id: 'interview-1001',
        status: 'Scheduled',
        cells: [
          'Nabil Noor',
          'Year 3 · 2027 intake',
          '04 Aug · 10:00',
          'Farhana Islam · Admissions room 2',
          'Scheduled',
        ],
        detail: [
          { label: 'Type', value: 'Family interview' },
          { label: 'Duration', value: '30 minutes' },
          { label: 'Application', value: 'APP-DEMO-0001' },
          { label: 'Next action', value: 'Record interview notes and outcome' },
        ],
      },
      {
        id: 'interview-1002',
        status: 'Needs confirmation',
        cells: [
          'Aya Rahman',
          'Year 6 · 2027 intake',
          '05 Aug · 11:30',
          'Farhana Islam · Video call',
          'Needs confirmation',
        ],
        detail: [
          { label: 'Type', value: 'Student and family interview' },
          { label: 'Duration', value: '45 minutes' },
          { label: 'Application', value: 'APP-DEMO-0002' },
          { label: 'Next action', value: 'Confirm video-call attendance with family' },
        ],
      },
      {
        id: 'interview-1003',
        status: 'Completed',
        cells: [
          'Karim Hasan',
          'Year 3 · 2027 intake',
          '01 Aug · 09:30',
          'M. Akter · Admissions room 1',
          'Completed',
        ],
        detail: [
          { label: 'Type', value: 'Family interview' },
          { label: 'Duration', value: '30 minutes' },
          { label: 'Application', value: 'APP-DEMO-0003' },
          { label: 'Next action', value: 'Review completed interview evidence' },
        ],
      },
    ],
  },
  '/finance/invoices': {
    title: 'Invoices and statements',
    description: 'Search household invoices and inspect due, paid and overdue balances.',
    columns: ['Invoice', 'Household', 'Due date', 'Amount', 'Status'],
    recordLabel: 'invoice',
    rows: [
      {
        id: 'invoice-1001',
        status: 'Due',
        cells: ['INV-2026-0842', 'Noor family', '10 Aug 2026', 'BDT 18,500', 'Due'],
        detail: [
          { label: 'Student', value: 'Samira Noor' },
          { label: 'Charge', value: 'August tuition instalment' },
          { label: 'Balance', value: 'BDT 18,500' },
          { label: 'Next action', value: 'Collect or match payment' },
        ],
      },
      {
        id: 'invoice-1002',
        status: 'Paid',
        cells: ['INV-2026-0836', 'Rahman family', '01 Aug 2026', 'BDT 22,000', 'Paid'],
        detail: [
          { label: 'Student', value: 'Aya Rahman' },
          { label: 'Charge', value: 'Tuition and transport' },
          { label: 'Balance', value: 'BDT 0' },
          { label: 'Receipt', value: 'RCPT-2026-0618' },
        ],
      },
    ],
  },
  '/finance/cashier': {
    title: 'Cashier session',
    description:
      'Inspect the active counter session and receipt activity without losing balancing context.',
    columns: ['Receipt', 'Household', 'Method', 'Amount', 'Status'],
    recordLabel: 'receipt',
    rows: [
      {
        id: 'receipt-1001',
        status: 'Verified',
        cells: ['RCPT-2026-0631', 'Noor family', 'Cash', 'BDT 18,500', 'Verified'],
        detail: [
          { label: 'Counter', value: 'Counter A' },
          { label: 'Cashier', value: 'Nusrat Jahan' },
          { label: 'Invoice', value: 'INV-2026-0842' },
          { label: 'Session state', value: 'Open · balanced so far' },
        ],
      },
      {
        id: 'receipt-1002',
        status: 'Pending bank match',
        cells: [
          'RCPT-2026-0629',
          'Hasan family',
          'Bank transfer',
          'BDT 15,000',
          'Pending bank match',
        ],
        detail: [
          { label: 'Counter', value: 'Counter A' },
          { label: 'Cashier', value: 'Nusrat Jahan' },
          { label: 'Reference', value: 'BANK-TRX-8821' },
          { label: 'Next action', value: 'Open reconciliation queue' },
        ],
      },
    ],
  },
  '/finance/reconciliation': {
    title: 'Reconciliation candidates',
    description:
      'Review unmatched bank evidence and the payment candidate before committing a match.',
    columns: ['Booking date', 'Bank reference', 'Payment', 'Amount', 'Status'],
    recordLabel: 'reconciliation candidate',
    mutationNote:
      'Production matching uses the database-owned reconciliation work queue and reviewed bank-line command.',
    rows: [
      {
        id: 'reconciliation-1001',
        status: 'Ready to match',
        cells: ['01 Aug 2026', 'BANK-TRX-8821', 'PAY-DEMO-0001', 'BDT 15,000', 'Ready to match'],
        detail: [
          { label: 'Bank line', value: 'DEMO-BANK-LINE-0001' },
          { label: 'Payment', value: 'PAY-DEMO-0001' },
          { label: 'Currency', value: 'BDT' },
          { label: 'Next action', value: 'Record reconciliation reason and submit reviewed match' },
        ],
      },
    ],
  },
  '/support/tenants': {
    title: 'Tenant scope',
    description: 'Select and inspect an explicit tenant context before any support diagnostics.',
    columns: ['Tenant', 'Region', 'Campuses', 'Last health check', 'Status'],
    recordLabel: 'tenant',
    rows: [
      {
        id: 'tenant-1001',
        status: 'Healthy',
        cells: ['Ozzyl International Demo School', 'ap-south', '2', 'Just now', 'Healthy'],
        detail: [
          { label: 'Tenant scope', value: 'tenant-pilot-001' },
          { label: 'Primary campus', value: 'Main Campus' },
          { label: 'Data access', value: 'No implicit student-record access' },
          { label: 'Next action', value: 'Open approved deployment diagnostics' },
        ],
      },
    ],
  },
  '/support/health': {
    title: 'Deployment health',
    description: 'Review approved operational health signals for the selected tenant scope.',
    columns: ['Surface', 'Region', 'Last check', 'Latency', 'Status'],
    recordLabel: 'health signal',
    rows: [
      {
        id: 'health-1001',
        status: 'Healthy',
        cells: ['Web application', 'ap-south', 'Just now', '84 ms', 'Healthy'],
        detail: [
          { label: 'Scope', value: 'Ozzyl International Demo School' },
          { label: 'Signal', value: 'Authenticated web health' },
          { label: 'Record access', value: 'Operational metadata only' },
          { label: 'Next action', value: 'No action required' },
        ],
      },
      {
        id: 'health-1002',
        status: 'Healthy',
        cells: ['Projection worker', 'ap-south', '1 min ago', 'Queue current', 'Healthy'],
        detail: [
          { label: 'Scope', value: 'Ozzyl International Demo School' },
          { label: 'Signal', value: 'Projection backlog and dead-letter aggregate' },
          { label: 'Record access', value: 'Redacted aggregate only' },
          { label: 'Next action', value: 'No action required' },
        ],
      },
    ],
  },
  '/support/access': {
    title: 'Privileged access requests',
    description: 'Review purpose-bound support access state and assurance requirements.',
    columns: ['Request', 'Purpose', 'Requested', 'Assurance', 'Status'],
    recordLabel: 'access request',
    mutationNote:
      'Production privileged-access requests use the reviewed support command and require fresh AAL2.',
    rows: [
      {
        id: 'access-1001',
        status: 'No active grant',
        cells: ['Current tenant', 'No request submitted', '—', 'AAL2 required', 'No active grant'],
        detail: [
          { label: 'Tenant', value: 'Ozzyl International Demo School' },
          { label: 'Maximum requested duration', value: '30 minutes' },
          { label: 'Approval', value: 'Purpose-bound and audited' },
          { label: 'Current privileged access', value: 'None' },
        ],
      },
    ],
  },
};

function statusValues(rows: readonly RegisterRow[]): readonly string[] {
  return Array.from(new Set(rows.map((row) => row.status))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function OperatorRouteWorkspace(props: {
  readonly role: OperatorRole;
  readonly path: string;
}): ReactElement | null {
  const definition = registers[props.path];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string>();

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (
      definition?.rows.filter((row) => {
        if (status !== 'all' && row.status !== status) return false;
        if (normalizedQuery === '') return true;
        return [...row.cells, ...row.detail.flatMap((item) => [item.label, item.value])]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      }) ?? []
    );
  }, [definition, query, status]);

  if (definition === undefined) return null;

  const selected = definition.rows.find((row) => row.id === selectedId);
  const statuses = statusValues(definition.rows);

  return (
    <section
      className="operator-register"
      aria-labelledby="operator-register-title"
      data-role={props.role}
    >
      <header className="operator-register__header">
        <div>
          <p>Synthetic staging register</p>
          <h2 id="operator-register-title">{definition.title}</h2>
          <span>{definition.description}</span>
        </div>
        <div className="operator-register__filters">
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Search ${definition.recordLabel}s`}
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
        aria-label={`${definition.title} table`}
      >
        <table>
          <thead>
            <tr>
              {definition.columns.map((column) => (
                <th key={column} scope="col">
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
                <td colSpan={definition.columns.length + 1} className="operator-register__empty">
                  No records match the current search and status filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} data-selected={row.id === selectedId ? 'true' : undefined}>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${definition.columns[index] ?? index}`}>{cell}</td>
                  ))}
                  <td>
                    <button type="button" onClick={() => setSelectedId(row.id)}>
                      View {definition.recordLabel}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {definition.mutationNote === undefined ? null : (
        <p className="operator-register__boundary">{definition.mutationNote}</p>
      )}

      {selected === undefined ? null : (
        <aside className="operator-record-preview" aria-labelledby="operator-record-preview-title">
          <div className="operator-record-preview__heading">
            <div>
              <p>Selected {definition.recordLabel}</p>
              <h3 id="operator-record-preview-title">{selected.cells[0]}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(undefined)}
              aria-label="Close selected record preview"
            >
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
