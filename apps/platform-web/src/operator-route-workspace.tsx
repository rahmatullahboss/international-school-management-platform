import { useMemo, useState, type ReactElement } from 'react';

import type { OperatorRole } from './operator-portal';

type Row = readonly string[];

interface RegisterDefinition {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
  readonly noun: string;
  readonly boundary?: string;
}

const definitions: Readonly<Record<string, RegisterDefinition>> = {
  '/admissions/enquiries': {
    title: 'Enquiry register',
    description: 'Find prospective families, ownership and the next follow-up action.',
    columns: ['Family / applicant', 'Interested in', 'Owner', 'Last contact', 'Status'],
    noun: 'enquiry',
    rows: [
      [
        'Rahman family · Aya Rahman',
        'Year 6 · 2027 intake',
        'Farhana Islam',
        'Today · 09:10',
        'Follow up today',
      ],
      [
        'Hasan family · Karim Hasan',
        'Year 3 · 2027 intake',
        'Unassigned',
        'Yesterday · 16:40',
        'New',
      ],
    ],
  },
  '/admissions/applications': {
    title: 'Application review register',
    description: 'Review submission readiness before recording an admissions decision.',
    columns: ['Applicant', 'Programme', 'Submitted', 'Documents', 'Status'],
    noun: 'application',
    boundary: 'Production review decisions use the approved database work queue.',
    rows: [
      [
        'Nabil Noor',
        'Year 3 · 2027 intake',
        '30 Jul · 11:06',
        '6 / 6 verified',
        'Ready for review',
      ],
      [
        'Aya Rahman',
        'Year 6 · 2027 intake',
        '29 Jul · 15:18',
        '5 / 6 verified',
        'Missing document',
      ],
    ],
  },
  '/admissions/interviews': {
    title: 'Interview schedule',
    description: 'Applicant, appointment, interviewer and next state in one working register.',
    columns: ['Applicant', 'Programme', 'When', 'Interviewer / location', 'Status'],
    noun: 'interview',
    boundary:
      'Scheduling and outcome writes remain read-only until an approved production interview API is connected.',
    rows: [
      [
        'Nabil Noor',
        'Year 3 · 2027 intake',
        '04 Aug · 10:00',
        'Farhana Islam · Admissions room 2',
        'Scheduled',
      ],
      [
        'Aya Rahman',
        'Year 6 · 2027 intake',
        '05 Aug · 11:30',
        'Farhana Islam · Video call',
        'Needs confirmation',
      ],
    ],
  },
  '/finance/invoices': {
    title: 'Invoice register',
    description: 'Search household invoices and inspect current balance state.',
    columns: ['Invoice', 'Household', 'Due date', 'Amount', 'Status'],
    noun: 'invoice',
    rows: [['INV-2026-0842', 'Noor family', '10 Aug 2026', 'BDT 18,500', 'Due']],
  },
  '/finance/cashier': {
    title: 'Receipt activity',
    description: 'Inspect receipt activity without losing balancing context.',
    columns: ['Receipt', 'Household', 'Method', 'Amount', 'Status'],
    noun: 'receipt',
    rows: [
      ['RCPT-2026-0631', 'Noor family', 'Cash', 'BDT 18,500', 'Verified'],
      ['RCPT-2026-0629', 'Hasan family', 'Bank transfer', 'BDT 15,000', 'Pending bank match'],
    ],
  },
  '/finance/reconciliation': {
    title: 'Reconciliation candidates',
    description: 'Review bank evidence and payment candidates before committing a match.',
    columns: ['Booking date', 'Bank reference', 'Payment', 'Amount', 'Status'],
    noun: 'candidate',
    boundary:
      'Production matching uses the database-owned reconciliation queue and reviewed bank-line command.',
    rows: [['01 Aug 2026', 'BANK-TRX-8821', 'PAY-DEMO-0001', 'BDT 15,000', 'Ready to match']],
  },
  '/support/tenants': {
    title: 'Tenant scope',
    description: 'Inspect explicit tenant context before support diagnostics.',
    columns: ['Tenant', 'Region', 'Campuses', 'Last health check', 'Status'],
    noun: 'tenant',
    rows: [['Ozzyl International Demo School', 'ap-south', '2', 'Just now', 'Healthy']],
  },
  '/support/health': {
    title: 'Health signals',
    description: 'Approved health signals for the selected tenant.',
    columns: ['Surface', 'Region', 'Last check', 'Latency', 'Status'],
    noun: 'signal',
    rows: [['Web application', 'ap-south', 'Just now', '84 ms', 'Healthy']],
  },
  '/support/access': {
    title: 'Privileged access requests',
    description: 'Purpose-bound support access state and assurance requirements.',
    columns: ['Request', 'Purpose', 'Requested', 'Assurance', 'Status'],
    noun: 'request',
    boundary:
      'Production privileged access uses the reviewed support command and requires fresh AAL2.',
    rows: [['Current tenant', 'No request submitted', '—', 'AAL2 required', 'No active grant']],
  },
};

export function OperatorRouteWorkspace(props: {
  readonly role: OperatorRole;
  readonly path: string;
}): ReactElement | null {
  const definition = definitions[props.path];
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (definition === undefined) return [];
    const normalized = query.trim().toLocaleLowerCase();
    return definition.rows
      .map((row, index) => ({ row, index }))
      .filter(
        ({ row }) => normalized === '' || row.join(' ').toLocaleLowerCase().includes(normalized),
      );
  }, [definition, query]);

  if (definition === undefined) return null;

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
              placeholder={`Search ${definition.noun}s`}
            />
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={definition.columns.length} className="operator-register__empty">
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              rows.map(({ row, index }) => (
                <tr key={`${props.path}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${index}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {definition.boundary === undefined ? null : (
        <p className="operator-register__boundary">{definition.boundary}</p>
      )}
    </section>
  );
}
