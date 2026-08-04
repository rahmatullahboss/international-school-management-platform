import { useState, type ReactElement, type ReactNode } from 'react';

import { modulePages, pilotTimestamp, type PilotModulePage } from './pilot-data';
import type { PilotRole } from './portal-shared';
import './operational-module-surface.css';

interface OperationalModuleSurfaceProps {
  readonly path: string;
  readonly page: PilotModulePage;
  readonly role: PilotRole;
}

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

function toneForStatus(status: string): Tone {
  const normalized = status.toLowerCase();
  if (
    normalized.includes('error') ||
    normalized.includes('failed') ||
    normalized.includes('conflict') ||
    normalized.includes('restricted') ||
    normalized.includes('declined')
  ) {
    return 'error';
  }
  if (
    normalized.includes('due') ||
    normalized.includes('attention') ||
    normalized.includes('review') ||
    normalized.includes('partial') ||
    normalized.includes('draft')
  ) {
    return 'warning';
  }
  if (
    normalized.includes('ready') ||
    normalized.includes('available') ||
    normalized.includes('published') ||
    normalized.includes('complete') ||
    normalized.includes('synced') ||
    normalized.includes('present')
  ) {
    return 'success';
  }
  if (normalized.includes('new') || normalized.includes('next') || normalized.includes('live')) {
    return 'info';
  }
  return 'neutral';
}

function Status(props: { readonly children: string; readonly tone?: Tone }): ReactElement {
  return (
    <span className="operational-status" data-tone={props.tone ?? toneForStatus(props.children)}>
      {props.children}
    </span>
  );
}

function MetricStrip(props: { readonly page: PilotModulePage }): ReactElement {
  return (
    <dl className="operational-metrics" aria-label={`${props.page.title} evidence summary`}>
      {props.page.metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
          <span>{metric.detail}</span>
        </div>
      ))}
    </dl>
  );
}

function ActionBar(props: {
  readonly page: PilotModulePage;
  readonly currentPath: string;
  readonly context?: string;
}): ReactElement {
  return (
    <nav className="operational-action-bar" aria-label={`${props.page.title} actions`}>
      <div>
        <strong>{props.context ?? 'Current work'}</strong>
        <span>Actions remain scoped to this role, campus and verified session.</span>
      </div>
      {props.page.actions.map((action, index) =>
        action.href === props.currentPath ? (
          <PilotUnavailableAction key={action.label} primary={index === 0}>
            {action.label}
          </PilotUnavailableAction>
        ) : (
          <a data-primary={index === 0 ? 'true' : 'false'} href={action.href} key={action.label}>
            {action.label}
          </a>
        ),
      )}
    </nav>
  );
}

function PriorityQueue(props: {
  readonly page: PilotModulePage;
  readonly currentPath: string;
}): ReactElement {
  return (
    <section className="operational-section" aria-labelledby="operational-priority-title">
      <header className="operational-section__heading">
        <div>
          <p>Needs attention</p>
          <h3 id="operational-priority-title">Priority work</h3>
        </div>
        <span>Ordered by urgency · evidence retained in place</span>
      </header>
      <ol className="operational-queue">
        {props.page.queue.map((item) => (
          <li key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <Status>{item.status}</Status>
            {item.href === props.currentPath ? (
              <PilotUnavailableAction>Review</PilotUnavailableAction>
            ) : (
              <a href={item.href}>Review</a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DataTable(props: {
  readonly label: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly ReactNode[])[];
}): ReactElement {
  return (
    <div className="operational-table-frame" role="region" aria-label={props.label} tabIndex={0}>
      <table>
        <caption>{props.label}</caption>
        <thead>
          <tr>
            {props.headers.map((header) => (
              <th scope="col" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => (
            <tr key={`${props.label}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${props.label}-${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline(props: {
  readonly label: string;
  readonly items: readonly {
    readonly time: string;
    readonly title: string;
    readonly detail: string;
    readonly status?: string;
  }[];
}): ReactElement {
  return (
    <ol className="operational-timeline" aria-label={props.label}>
      {props.items.map((item) => (
        <li key={`${item.time}-${item.title}`}>
          <time>{item.time}</time>
          <div>
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </div>
          {item.status === undefined ? null : <Status>{item.status}</Status>}
        </li>
      ))}
    </ol>
  );
}

function DefinitionList(props: {
  readonly label: string;
  readonly items: readonly {
    readonly term: string;
    readonly value: ReactNode;
    readonly note?: string;
  }[];
}): ReactElement {
  return (
    <dl className="operational-definitions" aria-label={props.label}>
      {props.items.map((item) => (
        <div key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.value}</dd>
          {item.note === undefined ? null : <span>{item.note}</span>}
        </div>
      ))}
    </dl>
  );
}

function Pane(props: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="operational-pane">
      <header>
        <h3>{props.title}</h3>
        {props.description === undefined ? null : <p>{props.description}</p>}
      </header>
      {props.children}
    </section>
  );
}

function Notice(props: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: Tone;
}): ReactElement {
  return (
    <aside className="operational-notice" data-tone={props.tone ?? 'info'} role="status">
      <strong>{props.title}</strong>
      <span>{props.children}</span>
    </aside>
  );
}

function PilotUnavailableAction(props: {
  readonly children: ReactNode;
  readonly primary?: boolean;
}): ReactElement {
  return (
    <button
      aria-describedby="operational-pilot-action-boundary"
      className={props.primary === true ? 'operational-primary' : undefined}
      disabled
      type="button"
    >
      {props.children}
    </button>
  );
}

function AdminSis(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/admin/sis')} currentPath="/admin/sis" />
      <div className="operational-toolbar" aria-label="Applicant register filters">
        <label>
          Intake
          <select defaultValue="2027">
            <option>2027</option>
            <option>2026</option>
          </select>
        </label>
        <label>
          Stage
          <select defaultValue="all">
            <option value="all">All stages</option>
            <option>Application</option>
            <option>Review</option>
            <option>Offer</option>
            <option>Enrolled</option>
          </select>
        </label>
        <label>
          Campus
          <select defaultValue="main">
            <option value="main">Main Campus</option>
          </select>
        </label>
        <label>
          Search
          <input type="search" defaultValue="Samira" />
        </label>
      </div>
      <div className="operational-split operational-split--wide">
        <Pane
          title="Applicant register"
          description="Identity, household and enrolment work with explicit evidence gaps."
        >
          <DataTable
            label="Applicant register"
            headers={[
              'Applicant',
              'Household',
              'Programme',
              'Stage',
              'Evidence',
              'Owner',
              'Last activity',
              'Next action',
            ]}
            rows={[
              [
                <strong key="nabil">Nabil Noor</strong>,
                'Noor household',
                'Year 3 · 2027',
                <Status key="stage">Application</Status>,
                <Status key="evidence">Birth certificate missing</Status>,
                'Admissions',
                'Today 09:18',
                <PilotUnavailableAction key="action">Review</PilotUnavailableAction>,
              ],
              [
                <strong key="samira">Samira Noor</strong>,
                'Noor household',
                'Year 8 · current',
                <Status key="stage">Enrolled</Status>,
                'Complete',
                'Records office',
                'Today 09:42',
                <PilotUnavailableAction key="action">Open profile</PilotUnavailableAction>,
              ],
              [
                'Alexandrina Victoria Montgomery-Smith',
                'Montgomery-Smith household',
                'Year 6 · 2027',
                <Status key="stage">Review</Status>,
                'Identity comparison required',
                'Admissions',
                'Yesterday 16:04',
                <PilotUnavailableAction key="action">Compare</PilotUnavailableAction>,
              ],
            ]}
          />
        </Pane>
        <Pane title="Duplicate comparison" description="No auto-merge policy active.">
          <DefinitionList
            label="Household identity comparison"
            items={[
              { term: 'Name', value: 'Noor household', note: 'Match' },
              { term: 'Address', value: 'Main Campus catchment', note: 'Match' },
              { term: 'Primary email', value: 'Different values', note: 'Review required' },
              { term: 'National ID', value: 'Not available in this scope' },
            ]}
          />
          <div className="operational-inline-actions">
            <PilotUnavailableAction>Keep separate</PilotUnavailableAction>
            <PilotUnavailableAction>Request evidence</PilotUnavailableAction>
          </div>
        </Pane>
      </div>
    </div>
  );
}

function AdminAcademics(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/admin/academics')} currentPath="/admin/academics" />
      <Pane
        title="Attendance cut-off control"
        description="Registers remain explicit through finalisation, offline sync and reconciliation."
      >
        <DataTable
          label="Attendance cut-off register"
          headers={[
            'Class',
            'Teacher',
            'Session',
            'Roster',
            'Marked',
            'State',
            'Sync evidence',
            'Deadline',
            'Action',
          ]}
          rows={[
            [
              'Year 8A Mathematics',
              'Nusrat Rahman',
              '08:00',
              '28',
              '28',
              <Status key="s">Finalised</Status>,
              'Server verified 08:51',
              '09:30',
              'View',
            ],
            [
              'Year 9B Mathematics',
              'Nusrat Rahman',
              '10:00',
              '26',
              '0',
              <Status key="s">Open</Status>,
              'No local changes',
              '10:55',
              <PilotUnavailableAction key="a">Send reminder</PilotUnavailableAction>,
            ],
            [
              'Year 7C Science',
              'Mr Karim',
              '09:00',
              '27',
              '27',
              <Status key="s">Offline synced</Status>,
              'Device receipt pending',
              '09:55',
              'Verify',
            ],
            [
              'Year 10A English',
              'Ms Ahmed',
              '08:30',
              '25',
              '25',
              <Status key="s">Conflict</Status>,
              'Server/device mismatch',
              '09:45',
              <PilotUnavailableAction key="a">Reconcile</PilotUnavailableAction>,
            ],
          ]}
        />
      </Pane>
      <div className="operational-split">
        <Pane
          title="Governed records"
          description="Publication and revision history are never destructively overwritten."
        >
          <DataTable
            label="Transcript and report-card approvals"
            headers={['Record', 'Student', 'State', 'Evidence', 'Reviewer', 'Action']}
            rows={[
              [
                'Transcript correction',
                'Samira Noor',
                <Status key="s">Ready</Status>,
                'Change evidence attached',
                'A. Chowdhury',
                <PilotUnavailableAction key="a">Approve</PilotUnavailableAction>,
              ],
              [
                'Term 2 report card',
                'Nabil Hasan',
                <Status key="s">Locked</Status>,
                'Published v2',
                'Records office',
                'Read only',
              ],
            ]}
          />
        </Pane>
        <Pane title="Today’s timetable" description="Published room and staffing changes.">
          <Timeline
            label="Timetable changes"
            items={[
              {
                time: '08:00',
                title: 'Year 8A Mathematics',
                detail: 'Room 204 · finalised register',
                status: 'Complete',
              },
              {
                time: '09:00',
                title: 'Year 8 Science',
                detail: 'Moved from Lab 1 to Lab 2',
                status: 'Changed',
              },
              {
                time: '10:00',
                title: 'Year 9B Mathematics',
                detail: 'Room 204 · register not started',
                status: 'Next',
              },
            ]}
          />
        </Pane>
      </div>
    </div>
  );
}

function AdminFinance(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/admin/finance')} currentPath="/admin/finance" />
      <div className="operational-split operational-split--wide">
        <Pane
          title="Deposit reconciliation"
          description="Verified receipts matched to bank evidence without destructive ledger edits."
        >
          <DataTable
            label="Verified receipt reconciliation"
            headers={[
              'Receipt',
              'Household',
              'Amount',
              'Channel',
              'Received',
              'Evidence',
              'Deposit',
              'Match state',
            ]}
            rows={[
              [
                'RCPT-48621',
                'Noor household',
                'BDT 18,500',
                'Bank transfer',
                '08:12',
                'Verified',
                'DEP-0729-A',
                <Status key="s">Matched</Status>,
              ],
              [
                'RCPT-48622',
                'Rahman household',
                'BDT 24,000',
                'Cash',
                '08:31',
                'Verified',
                'DEP-0729-A',
                <Status key="s">Partial success</Status>,
              ],
              [
                'RCPT-48623',
                'Ahmed household',
                'BDT 12,500',
                'Bank transfer',
                '09:04',
                'Duplicate evidence warning',
                'Unassigned',
                <Status key="s">Review</Status>,
              ],
              [
                'RCPT-48624',
                'Das household',
                'BDT 8,000',
                'Card',
                '09:22',
                'Verified',
                'DEP-0729-B',
                <Status key="s">Matched</Status>,
              ],
            ]}
          />
        </Pane>
        <Pane
          title="Reconciliation ledger"
          description="Current batch · immutable journal references."
        >
          <DefinitionList
            label="Deposit reconciliation totals"
            items={[
              { term: 'Receipt total', value: 'BDT 486,000' },
              { term: 'Matched', value: 'BDT 431,500' },
              { term: 'Unmatched', value: 'BDT 54,500' },
              { term: 'Variance', value: 'BDT 0', note: 'No destructive history rule active' },
            ]}
          />
          <PilotUnavailableAction primary>Reconcile selected</PilotUnavailableAction>
        </Pane>
      </div>
      <Pane title="Refund approvals and journal evidence">
        <DataTable
          label="Finance approvals"
          headers={[
            'Type',
            'Reference',
            'Amount',
            'Original allocation',
            'State',
            'Assurance',
            'Action',
          ]}
          rows={[
            [
              'Refund',
              'RF-1042',
              'BDT 4,500',
              'INV-8821',
              <Status key="s">Approval</Status>,
              'AAL2 required',
              <PilotUnavailableAction key="a">Approve refund</PilotUnavailableAction>,
            ],
            [
              'Journal',
              'JRN-22188',
              'BDT 18,500 Dr / Cr',
              'Tuition allocation',
              <Status key="s">Posted</Status>,
              'Immutable',
              <PilotUnavailableAction key="a">View entry</PilotUnavailableAction>,
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function AdminOperations(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/admin/operations')} currentPath="/admin/operations" />
      <div className="operational-split">
        <Pane
          title="Science lab requisition"
          description="Budget evidence and supplier comparison are attached to the approval."
        >
          <DefinitionList
            label="Requisition approval"
            items={[
              { term: 'Cost centre', value: 'Science · Lab consumables' },
              { term: 'Requested', value: 'BDT 82,400' },
              { term: 'Best compliant quote', value: 'BDT 78,900' },
              { term: 'Budget remaining', value: 'BDT 312,500' },
            ]}
          />
          <div className="operational-inline-actions">
            <PilotUnavailableAction primary>Approve</PilotUnavailableAction>
            <PilotUnavailableAction>Return for changes</PilotUnavailableAction>
          </div>
        </Pane>
        <Pane
          title="Route 6 live control"
          description="Transport evidence remains timestamped during degraded connectivity."
        >
          <Timeline
            label="Route 6 status"
            items={[
              {
                time: '07:42',
                title: 'Depot departed',
                detail: 'Vehicle BUS-06 · driver verified',
                status: 'Complete',
              },
              {
                time: '08:05',
                title: 'North Gate',
                detail: '18 minutes late · last GPS sync 08:04',
                status: 'Delayed',
              },
              {
                time: '08:07',
                title: 'Guardian notification',
                detail: 'SMS delivered · push pending',
                status: 'Partial success',
              },
            ]}
          />
        </Pane>
      </div>
      <Pane title="Service-control register">
        <DataTable
          label="Operations service-control register"
          headers={[
            'Item / service',
            'Location',
            'Threshold / state',
            'PO / reference',
            'Supplier / owner',
            'ETA / due',
            'Status',
            'Next action',
          ]}
          rows={[
            [
              'Nitrile gloves',
              'Science Lab',
              '42 remaining · reorder 60',
              'PO-8812',
              'Lab Supplies BD',
              '2 Aug',
              <Status key="s">Low stock</Status>,
              <PilotUnavailableAction key="a">Review PO</PilotUnavailableAction>,
            ],
            [
              'Microscope slides',
              'Science Lab',
              'Delivery overdue',
              'PO-8791',
              'EduLab',
              '30 Jul',
              <Status key="s">Partial success</Status>,
              <PilotUnavailableAction key="a">Contact supplier</PilotUnavailableAction>,
            ],
            [
              'Year 8 cover',
              'Staffing',
              '1 uncovered period',
              'ABS-221',
              'HR desk',
              'Today 11:15',
              <Status key="s">Attention</Status>,
              <PilotUnavailableAction key="a">Assign cover</PilotUnavailableAction>,
            ],
            [
              'Catering details',
              'Main Campus',
              'Not available in this scope',
              '—',
              '—',
              '—',
              <Status key="s">Restricted</Status>,
              '—',
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function AdminSupport(): ReactElement {
  return (
    <div className="operational-stack">
      <Notice title="Verified restricted-data session" tone="warning">
        Purpose and reason for access are recorded before any sensitive support record is opened.
      </Notice>
      <PriorityQueue
        page={routePage('/admin/student-support')}
        currentPath="/admin/student-support"
      />
      <div className="operational-split operational-split--wide">
        <Pane
          title="Purpose-bound work queue"
          description="Denied items remain masked and disclose no sensitive narrative."
        >
          <DataTable
            label="Restricted student support work queue"
            headers={[
              'Subject',
              'Task',
              'State',
              'Declared purpose',
              'Reason for access',
              'Owner / due',
              'Action',
            ]}
            rows={[
              [
                'STU-***-842',
                'Restricted task',
                <Status key="s">Restricted</Status>,
                <select key="p" defaultValue="">
                  <option value="">Choose purpose</option>
                  <option>Safeguarding</option>
                  <option>Medical</option>
                  <option>Learning support</option>
                </select>,
                <input
                  key="r"
                  aria-label="Reason for access"
                  placeholder="Required before opening"
                />,
                'Student support · today',
                <PilotUnavailableAction key="a">Open permitted work</PilotUnavailableAction>,
              ],
              [
                'Samira Noor',
                'Learning support review',
                <Status key="s">Review</Status>,
                'Learning support',
                'Current teaching adjustment',
                'Support lead · 5 Aug',
                <PilotUnavailableAction key="a">Review</PilotUnavailableAction>,
              ],
              [
                '—',
                'Not available in this scope',
                <Status key="s">Restricted</Status>,
                '—',
                '—',
                '—',
                '—',
              ],
            ]}
          />
        </Pane>
        <Pane
          title="Session access log"
          description="The audit record contains purpose and assurance, not sensitive content."
        >
          <Timeline
            label="Restricted access audit"
            items={[
              {
                time: '09:12',
                title: 'Amina Chowdhury',
                detail: 'Learning support · AAL2',
                status: 'Audited',
              },
              {
                time: '08:46',
                title: 'Support lead',
                detail: 'Safeguarding · AAL2',
                status: 'Audited',
              },
              {
                time: 'Yesterday',
                title: 'Consent boundary',
                detail: 'Expired consent · plan remains read only',
                status: 'Read only',
              },
            ]}
          />
        </Pane>
      </div>
    </div>
  );
}

function AdminCommunications(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue
        page={routePage('/admin/communications')}
        currentPath="/admin/communications"
      />
      <Pane
        title="Publication queue"
        description="Audience, translations, channels and approval state stay visible before release."
      >
        <DataTable
          label="Announcement publication queue"
          headers={[
            'Announcement',
            'Audience',
            'Channels',
            'Scheduled',
            'Translations',
            'State',
            'Action',
          ]}
          rows={[
            [
              'Weather closure draft',
              'Whole school / staff',
              'Email · SMS · Push',
              'Today 14:00',
              'English ready · Arabic ready · French ready',
              <Status key="s">Draft</Status>,
              <PilotUnavailableAction key="a">Review audience</PilotUnavailableAction>,
            ],
            [
              'Term 3 welcome',
              'Guardians',
              'Email · Portal',
              'Tomorrow 08:00',
              'English ready · Arabic in review',
              <Status key="s">Review</Status>,
              <PilotUnavailableAction key="a">Compare translations</PilotUnavailableAction>,
            ],
          ]}
        />
      </Pane>
      <Pane
        title="Delivery evidence and exceptions"
        description="Partial delivery is explicit; alternate-channel follow-up remains actionable."
      >
        <DataTable
          label="Message delivery evidence"
          headers={[
            'Recipient',
            'Scope',
            'Channel',
            'Sent',
            'Receipt',
            'Failure reason',
            'Retry',
            'Alternate channel',
            'Next action',
          ]}
          rows={[
            [
              'STU-***-112',
              'Household',
              'SMS',
              '08:15',
              <Status key="s">Failed</Status>,
              'Invalid number',
              '2',
              'Phone call',
              <PilotUnavailableAction key="a">Call household</PilotUnavailableAction>,
            ],
            [
              'Guardian · Samira Noor',
              'Year 8A',
              'SMS + Email',
              '08:18',
              <Status key="s">Partial success</Status>,
              'Email bounced; SMS delivered',
              '1',
              'Portal',
              <PilotUnavailableAction key="a">Verify portal receipt</PilotUnavailableAction>,
            ],
            [
              'Staff cohort',
              'Main Campus',
              'Push',
              '08:20',
              <Status key="s">Delivered</Status>,
              '—',
              '0',
              '—',
              '—',
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function AdminIntegrations(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/admin/integrations')} currentPath="/admin/integrations" />
      <Pane
        title="Connector registry"
        description="Credential material is never rendered in plaintext."
      >
        <DataTable
          label="Integration connector registry"
          headers={[
            'Connector',
            'Environment',
            'Scope',
            'Auth',
            'Last success',
            'Health',
            'Rotation',
            'Owner',
            'Action',
          ]}
          rows={[
            [
              'OneRoster',
              'Production',
              'Tenant · all campuses',
              'OAuth client',
              'Today 08:55',
              <Status key="s">Healthy</Status>,
              '31 Aug',
              'Platform',
              <PilotUnavailableAction key="a">Open</PilotUnavailableAction>,
            ],
            [
              'School SSO',
              'Production',
              'Tenant',
              'OIDC',
              'Today 09:01',
              <Status key="s">Healthy</Status>,
              '12 Sep',
              'Identity',
              <PilotUnavailableAction key="a">Open</PilotUnavailableAction>,
            ],
            [
              'LTI gateway',
              'Production',
              'Academics',
              'JWT',
              'Today 08:47',
              <Status key="s">Healthy</Status>,
              '28 Aug',
              'Learning',
              <PilotUnavailableAction key="a">Open</PilotUnavailableAction>,
            ],
            [
              'Webhook gateway',
              'Sandbox',
              'Main Campus',
              'Signed secret',
              'Yesterday 23:10',
              <Status key="s">Partial</Status>,
              'Due soon',
              'Platform',
              <PilotUnavailableAction key="a">Rotate</PilotUnavailableAction>,
            ],
          ]}
        />
      </Pane>
      <div className="operational-split operational-split--wide">
        <Pane
          title="SIS import conflict"
          description="Human review is required before linking external identity records."
        >
          <div className="operational-compare">
            <DefinitionList
              label="Source record A"
              items={[
                { term: 'External ID', value: 'SRC-A-1188' },
                { term: 'Name', value: 'Samira Noor' },
                { term: 'Date of birth', value: '•• •• 2012' },
              ]}
            />
            <DefinitionList
              label="Source record B"
              items={[
                { term: 'External ID', value: 'SRC-B-8821' },
                { term: 'Name', value: 'Samira N. Noor' },
                { term: 'Date of birth', value: '•• •• 2012' },
              ]}
            />
          </div>
          <div className="operational-inline-actions">
            <PilotUnavailableAction>Keep separate</PilotUnavailableAction>
            <PilotUnavailableAction>Link existing after review</PilotUnavailableAction>
            <PilotUnavailableAction>Request source correction</PilotUnavailableAction>
          </div>
        </Pane>
        <Pane title="Recent import batches">
          <DataTable
            label="Import batch register"
            headers={[
              'Job',
              'Source',
              'Accepted',
              'Rejected',
              'Duplicates',
              'State',
              'Finished',
              'Action',
            ]}
            rows={[
              [
                'IMP-2401',
                'OneRoster',
                '1,842',
                '0',
                '2',
                <Status key="s">Complete</Status>,
                '08:55',
                <PilotUnavailableAction key="a">View report</PilotUnavailableAction>,
              ],
              [
                'IMP-2402',
                'CSV migration',
                '428',
                '7',
                '3',
                <Status key="s">Partial success</Status>,
                '09:03',
                <PilotUnavailableAction key="a">Safe retry</PilotUnavailableAction>,
              ],
            ]}
          />
        </Pane>
      </div>
    </div>
  );
}

function AdminReports(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/admin/reports')} currentPath="/admin/reports" />
      <div className="operational-split operational-split--wide">
        <Pane
          title="Attendance definition update"
          description="Definition changes expose impact before reviewer acknowledgement."
        >
          <div className="operational-compare">
            <DefinitionList
              label="Previous definition"
              items={[
                { term: 'Version', value: 'v3.4' },
                { term: 'Present', value: 'Published present mark only' },
                { term: 'Effective', value: 'Through 31 Oct' },
              ]}
            />
            <DefinitionList
              label="Proposed definition"
              items={[
                { term: 'Version', value: 'v3.5' },
                { term: 'Present', value: 'Published present + approved correction' },
                { term: 'Effective', value: '1 Nov' },
              ]}
            />
          </div>
          <div className="operational-inline-actions">
            <PilotUnavailableAction primary>Acknowledge</PilotUnavailableAction>
            <PilotUnavailableAction>Request changes</PilotUnavailableAction>
          </div>
        </Pane>
        <Pane
          title="Board pack approval"
          description="Export policy excludes sensitive fields before approval."
        >
          <DefinitionList
            label="Board pack export"
            items={[
              { term: 'Scope', value: 'Main Campus · Term 1' },
              { term: 'Recipients', value: 'Board of Governors' },
              { term: 'Excluded', value: 'PII · salary · restricted support records' },
              { term: 'Format', value: 'PDF/A · BP-2026-001' },
            ]}
          />
          <PilotUnavailableAction primary>Approve with AAL2</PilotUnavailableAction>
        </Pane>
      </div>
      <Pane title="Report catalogue">
        <DataTable
          label="Governed report catalogue"
          headers={[
            'Report',
            'Domain',
            'Definition',
            'Scope',
            'Owner',
            'Last published',
            'Freshness',
            'Audience',
            'Export policy',
            'Action',
          ]}
          rows={[
            [
              'Attendance readiness',
              'Academics',
              'v3.4',
              'Main Campus',
              'Records office',
              'Today 08:30',
              'Current',
              'Leaders',
              'Governed',
              <PilotUnavailableAction key="a">Open</PilotUnavailableAction>,
            ],
            [
              'Finance reconciliation',
              'Finance',
              'v2.8',
              'Tenant',
              'Finance office',
              'Today 09:00',
              'Current',
              'Finance',
              'Restricted export',
              <PilotUnavailableAction key="a">Open</PilotUnavailableAction>,
            ],
            [
              'Enrolment',
              'SIS',
              'v5.1',
              'All campuses',
              'Admissions',
              'Yesterday',
              'Current',
              'Leaders',
              'Governed',
              <PilotUnavailableAction key="a">Open</PilotUnavailableAction>,
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function TeacherClasses(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/teacher/classes')} currentPath="/teacher/classes" />
      <Pane title="Today’s teaching sequence">
        <DataTable
          label="Teacher class sequence"
          headers={[
            'Time',
            'Subject / section',
            'Room',
            'Attendance',
            'Lesson state',
            'Next action',
          ]}
          rows={[
            [
              '08:00–08:45',
              'Mathematics · Year 8A',
              '204',
              <Status key="s">Finalised</Status>,
              'Completed',
              <a href="/teacher/students" key="a">
                Open roster
              </a>,
            ],
            [
              '09:00–09:45',
              'Science · Year 8A',
              'Lab 2 · changed from Lab 1',
              'Published',
              <Status key="s">Changed</Status>,
              <PilotUnavailableAction key="a">Open class</PilotUnavailableAction>,
            ],
            [
              '10:00–10:45',
              'Mathematics · Year 9B',
              '204',
              <Status key="s">Not started</Status>,
              <Status key="l">Next</Status>,
              <a href="/teacher/resources" key="a">
                Prepare lesson
              </a>,
            ],
          ]}
        />
      </Pane>
      <Pane
        title="Year 8A Mathematics roster"
        description="Assigned relationship only; restricted student-support narratives are not shown."
      >
        <div className="operational-toolbar">
          <label>
            Search students
            <input type="search" placeholder="Name or preferred name" />
          </label>
          <label>
            Section
            <select defaultValue="8A">
              <option>8A</option>
            </select>
          </label>
        </div>
        <DataTable
          label="Year 8A Mathematics roster"
          headers={[
            'Student',
            'Preferred name',
            'Attendance today',
            'Recent work',
            'Permitted support cue',
            'Guardian contact',
            'Action',
          ]}
          rows={[
            [
              'Samira Noor',
              'Samira',
              <Status key="s">Present</Status>,
              'Completed',
              'Learning support · permitted',
              'Contact available',
              <a href="/teacher/students" key="a">
                Open permitted profile
              </a>,
            ],
            [
              'Alexandrina Victoria Montgomery-Smith',
              'Alex',
              <Status key="s">Present</Status>,
              'In progress',
              'No current cue',
              'Contact available',
              <PilotUnavailableAction key="a">Open permitted profile</PilotUnavailableAction>,
            ],
            [
              'Student record',
              '—',
              '—',
              '—',
              'Additional information not available in this teaching scope',
              '—',
              '—',
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function TeacherAttendance(): ReactElement {
  const marks = ['Present', 'Absent', 'Late'] as const;
  type AttendanceMark = (typeof marks)[number];
  const students = [
    'Samira Noor',
    'Nabil Hasan',
    'Riya Ahmed',
    'Alexandrina Victoria Montgomery-Smith',
  ] as const;
  const [attendance, setAttendance] = useState<Record<string, AttendanceMark>>({
    'Samira Noor': 'Present',
    'Nabil Hasan': 'Absent',
    'Riya Ahmed': 'Present',
    'Alexandrina Victoria Montgomery-Smith': 'Present',
  });
  const [dirtyStudents, setDirtyStudents] = useState<ReadonlySet<string>>(
    () => new Set(['Nabil Hasan']),
  );
  const [localSaveStatus, setLocalSaveStatus] = useState('No unsaved device changes.');

  function markAttendance(student: string, mark: AttendanceMark): void {
    setAttendance((current) => ({ ...current, [student]: mark }));
    setDirtyStudents((current) => new Set(current).add(student));
    setLocalSaveStatus('Device changes not saved yet.');
  }

  function saveAttendanceOnDevice(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('school-pilot-teacher-attendance', JSON.stringify(attendance));
    }
    setDirtyStudents(new Set());
    setLocalSaveStatus('Saved on this device. No production attendance write was sent.');
  }

  return (
    <div className="operational-stack">
      <Notice title="Duplicate-safe attendance sync">
        Last synced 10:42 · 0 conflicts detected. Offline changes stay on this device until a safe
        replay succeeds.
      </Notice>
      <PriorityQueue page={routePage('/teacher/attendance')} currentPath="/teacher/attendance" />
      <div className="operational-register-selector" aria-label="Assigned registers">
        <button type="button" aria-pressed="true">
          <strong>Year 8A Mathematics</strong>
          <span>08:00 · 28/28 marked · synced</span>
        </button>
        <button type="button" disabled aria-describedby="operational-pilot-action-boundary">
          <strong>Year 9B Mathematics</strong>
          <span>10:00 · 0/26 marked · register fixture not loaded</span>
        </button>
      </div>
      <Pane
        title="Year 8A attendance register"
        description="Tap-sized marking controls keep high-frequency classroom work fast and explicit."
      >
        <div className="operational-attendance-list">
          {students.map((student, index) => (
            <div className="operational-attendance-row" key={student}>
              <strong>{student}</strong>
              <span>
                {index === 3
                  ? 'Read only · finalised'
                  : dirtyStudents.has(student)
                    ? `Pending local change · ${attendance[student]}`
                    : `Current mark: ${attendance[student]}`}
              </span>
              <div role="group" aria-label={`Attendance mark for ${student}`}>
                {marks.map((mark) => (
                  <button
                    disabled={index === 3}
                    onClick={() => markAttendance(student, mark)}
                    type="button"
                    aria-pressed={attendance[student] === mark}
                    key={mark}
                  >
                    {mark}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Notice title="Conflict example" tone="warning">
          Server: Absent · Device: Present. Reconcile before finalising; neither version will be
          silently overwritten.
        </Notice>
      </Pane>
      <div className="operational-sticky-bar">
        <span>
          <strong>28 of 28 marked</strong> · Sync state: Synced
        </span>
        <small aria-live="polite">{localSaveStatus}</small>
        <button type="button" onClick={saveAttendanceOnDevice}>
          Save on device
        </button>
        <PilotUnavailableAction primary>Review and finalise</PilotUnavailableAction>
      </div>
    </div>
  );
}

function TeacherGradebook(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/teacher/gradebook')} currentPath="/teacher/gradebook" />
      <Pane
        title="Year 8A · Algebra checkpoint"
        description="Entry state and publication state remain separate."
      >
        <div className="operational-toolbar">
          <span className="operational-filter-summary">7 incomplete</span>
          <span>Due 31 July · 16:00</span>
        </div>
        <DataTable
          label="Algebra checkpoint gradebook"
          headers={[
            'Student',
            'Evidence',
            'Score / grade',
            'Teacher comment',
            'Validation',
            'Save state',
            'Publication',
          ]}
          rows={[
            [
              'Samira Noor',
              '2 attachments',
              <input key="i" aria-label="Samira Noor score" defaultValue="A-" />,
              <input
                key="c"
                aria-label="Samira Noor comment"
                defaultValue="Strong method selection"
              />,
              <Status key="v">Valid</Status>,
              <Status key="s">Synced</Status>,
              <Status key="p">Draft</Status>,
            ],
            [
              'Nabil Hasan',
              '1 attachment',
              <input key="i" aria-label="Nabil Hasan score" defaultValue="105" />,
              <input
                key="c"
                aria-label="Nabil Hasan comment"
                defaultValue="Comment preserved while score is corrected"
              />,
              <Status key="v">Validation error</Status>,
              'Not saved',
              <Status key="p">Draft</Status>,
            ],
            [
              'Riya Ahmed',
              'No attachment',
              <input key="i" aria-label="Riya Ahmed score" defaultValue="B+" />,
              <input
                key="c"
                aria-label="Riya Ahmed comment"
                defaultValue="Saved on classroom tablet"
              />,
              <Status key="v">Valid</Status>,
              <Status key="s">Offline saved</Status>,
              <Status key="p">Draft</Status>,
            ],
            [
              'Alex Smith',
              '2 attachments',
              'A',
              'Published feedback',
              <Status key="v">Valid</Status>,
              'Server',
              <Status key="p">Locked</Status>,
            ],
          ]}
        />
      </Pane>
      <Notice title="Concurrent update" tone="warning">
        Another authorised teacher updated one row. Compare both versions before continuing;
        comments and evidence remain preserved.
      </Notice>
      <div className="operational-sticky-bar">
        <span>
          <strong>21 of 28 entered</strong> · 7 incomplete
        </span>
        <PilotUnavailableAction>Save draft</PilotUnavailableAction>
        <PilotUnavailableAction>Review 7 incomplete</PilotUnavailableAction>
        <PilotUnavailableAction primary>Submit for subject lead review</PilotUnavailableAction>
      </div>
    </div>
  );
}

function TeacherStudents(): ReactElement {
  const [selectedStudent, setSelectedStudent] = useState<'Samira Noor' | 'Riya Ahmed'>(
    'Samira Noor',
  );
  const selectedTimeline =
    selectedStudent === 'Samira Noor'
      ? ([
          {
            time: '28 Jul',
            title: 'Algebra checkpoint',
            detail: 'A- · published feedback',
            status: 'Published',
          },
          {
            time: '29 Jul',
            title: 'Learning adjustment',
            detail: 'Adjusted task remains permitted for this class',
            status: 'Current',
          },
          {
            time: 'Next lesson',
            title: 'Teacher action',
            detail: 'Review adjusted task before class',
            status: 'Next action',
          },
        ] as const)
      : ([
          {
            time: '29 Jul',
            title: 'Classwork',
            detail: 'Steady progress · current teaching evidence',
            status: 'Current',
          },
          {
            time: 'Today',
            title: 'Attendance',
            detail: 'Present in the assigned class',
            status: 'Current',
          },
          {
            time: 'Next lesson',
            title: 'Teacher action',
            detail: 'No additional follow-up recorded',
            status: 'Next action',
          },
        ] as const);

  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/teacher/students')} currentPath="/teacher/students" />
      <div className="operational-split operational-split--wide">
        <Pane
          title="Assigned student register"
          description="Teaching context only; health, safeguarding and unrelated family data remain outside scope."
        >
          <DataTable
            label="Teacher assigned student register"
            headers={[
              'Student',
              'Section',
              'Recent learning',
              'Support cue',
              'Parent-contact cue',
              'Follow-up',
              'Last evidence',
              'Action',
            ]}
            rows={[
              [
                'Samira Noor',
                'Year 8A',
                'Strong recent progress in algebra',
                'Learning support · permitted',
                'Parent contact available',
                'Review adjusted task · before next lesson',
                'Algebra checkpoint · 28 Jul',
                <button
                  aria-label="Open Samira Noor permitted profile"
                  aria-pressed={selectedStudent === 'Samira Noor'}
                  key="a"
                  onClick={() => setSelectedStudent('Samira Noor')}
                  type="button"
                >
                  Open profile
                </button>,
              ],
              [
                'Riya Ahmed',
                'Year 8A',
                'Steady progress',
                'No current cue',
                'Contact available',
                'None',
                'Classwork · 29 Jul',
                <button
                  aria-label="Open Riya Ahmed permitted profile"
                  aria-pressed={selectedStudent === 'Riya Ahmed'}
                  key="a"
                  onClick={() => setSelectedStudent('Riya Ahmed')}
                  type="button"
                >
                  Open profile
                </button>,
              ],
              [
                'Student record',
                'Year 8A',
                'Additional context not available in this teaching scope',
                '—',
                '—',
                '—',
                '—',
                '—',
              ],
            ]}
          />
        </Pane>
        <Pane
          title={`${selectedStudent} · permitted context`}
          description="Current teaching relationship · read-only evidence timeline."
        >
          <Timeline label={`${selectedStudent} learning evidence`} items={selectedTimeline} />
          <Notice title="Context boundary" tone="warning">
            Consent context should be rechecked after the current review window. Restricted health,
            counselling and safeguarding records are not inferred or shown.
          </Notice>
        </Pane>
      </div>
    </div>
  );
}

function MessageWorkspace(props: {
  readonly persona: 'teacher' | 'guardian' | 'student';
}): ReactElement {
  const isTeacher = props.persona === 'teacher';
  const isGuardian = props.persona === 'guardian';
  const selectedSubject = isTeacher
    ? 'Year 8A algebra resources'
    : isGuardian
      ? 'Algebra resources'
      : 'Science trip preparation';
  const participant = isTeacher
    ? 'Guardian of Samira Noor'
    : isGuardian
      ? 'Nusrat Rahman · Mathematics'
      : 'Mr Karim · Science';
  const threads = isTeacher
    ? ['Year 8A algebra resources', 'Year 9B assessment question', 'Department planning']
    : isGuardian
      ? [
          'Algebra resources',
          'Term 3 fees inquiry',
          'Science trip consent question',
          'Admissions · Nabil Noor',
        ]
      : ['Science trip preparation', 'Algebra quiz feedback'];
  const [messageQuery, setMessageQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const visibleThreads = threads
    .map((thread, index) => ({ thread, index }))
    .filter(({ thread, index }) => {
      const matchesQuery = thread.toLowerCase().includes(messageQuery.trim().toLowerCase());
      return matchesQuery && (!unreadOnly || index === 0);
    });

  return (
    <div className="operational-message-grid">
      <Pane
        title="Conversations"
        description="Search and filter within your authorised relationship scope."
      >
        <div className="operational-toolbar">
          <input
            aria-label="Search conversations"
            onChange={(event) => setMessageQuery(event.currentTarget.value)}
            placeholder="Search messages"
            type="search"
            value={messageQuery}
          />
          <button
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly((current) => !current)}
            type="button"
          >
            Unread
          </button>
        </div>
        <ol className="operational-thread-list">
          {visibleThreads.map(({ thread, index }) => (
            <li data-selected={index === 0 ? 'true' : 'false'} key={thread}>
              {index === 0 ? (
                <a href="#message-thread">
                  <strong>{thread}</strong>
                  <span>{participant} · 1 unread</span>
                </a>
              ) : (
                <span>
                  <strong>{thread}</strong>
                  <small>Secure school conversation · preview record not loaded</small>
                </span>
              )}
            </li>
          ))}
          {visibleThreads.length === 0 ? (
            <li>
              <span>
                <strong>No conversations match</strong>
                <small>
                  Clear the search or unread filter to restore authorised conversations.
                </small>
              </span>
            </li>
          ) : null}
          <li>
            <span>
              <strong>Not available in this scope</strong>
              <small>No restricted title or participant metadata is disclosed.</small>
            </span>
          </li>
        </ol>
      </Pane>
      <Pane title={selectedSubject} description={participant}>
        <div id="message-thread" className="operational-message-records">
          <article>
            <header>
              <strong>{participant}</strong>
              <time>Yesterday · 19:30</time>
            </header>
            <p>
              {isStudent(props.persona)
                ? 'Please review the trip preparation notes before science tomorrow.'
                : 'I have shared the class resource and the published guidance for the next lesson.'}
            </p>
            <span>Delivered to portal · evidence retained</span>
          </article>
          <article>
            <header>
              <strong>
                {isTeacher ? 'Nusrat Rahman' : isGuardian ? 'Farhana Noor' : 'Samira Noor'}
              </strong>
              <time>Today · 08:12</time>
            </header>
            <p>Thank you. I have reviewed the information and saved a question as a draft.</p>
            <span>Saved locally · pending sync</span>
          </article>
        </div>
        <Notice title="Attachment blocked" tone="warning">
          An unsupported attachment was removed for security. Your message text has been preserved.
        </Notice>
        <form className="operational-composer">
          <label>
            Recipient
            <input readOnly value={participant} />
          </label>
          <label>
            Message
            <textarea defaultValue="I have a question about the next step…" rows={5} />
          </label>
          <div>
            <PilotUnavailableAction>Authorised attachment</PilotUnavailableAction>
            <PilotUnavailableAction>Save draft</PilotUnavailableAction>
            <PilotUnavailableAction primary>Send message</PilotUnavailableAction>
          </div>
        </form>
      </Pane>
      <Pane title="Relationship context" description="Why this conversation is available.">
        <DefinitionList
          label="Message relationship context"
          items={[
            {
              term: 'Scope',
              value: isTeacher
                ? 'Year 8A Mathematics'
                : isGuardian
                  ? 'Samira Noor · Year 8A'
                  : 'Science class · current enrolment',
            },
            {
              term: 'Relationship',
              value: isTeacher
                ? 'Assigned teacher'
                : isGuardian
                  ? 'Primary guardian · verified'
                  : 'Enrolled student',
            },
            { term: 'Reply scope', value: 'Current authorised thread only' },
          ]}
        />
        <Timeline
          label="Delivery evidence"
          items={[
            {
              time: '19:30',
              title: 'Message accepted',
              detail: 'School messaging service',
              status: 'Delivered',
            },
            {
              time: '19:31',
              title: 'Portal receipt',
              detail: 'Recipient workspace',
              status: 'Verified',
            },
          ]}
        />
      </Pane>
    </div>
  );
}

function isStudent(persona: 'teacher' | 'guardian' | 'student'): boolean {
  return persona === 'student';
}

function TeacherResources(): ReactElement {
  type EditableResource = 'Multi-step equations practice' | 'Geometry quiz' | 'Calculus intro';
  const [selectedResource, setSelectedResource] = useState<EditableResource>(
    'Multi-step equations practice',
  );
  const selectedResourceDetail =
    selectedResource === 'Multi-step equations practice'
      ? {
          title: 'Multi-step equations practice',
          description: 'Practice set for tomorrow’s lesson.',
          classScope: 'Year 8A',
          asset: 'equations_v1.pdf',
          accessibility: 'Printable algebra practice with typed equations',
          warning:
            'A prior file has the same filename. Saving creates a new version rather than overwriting it.',
        }
      : selectedResource === 'Geometry quiz'
        ? {
            title: 'Geometry quiz',
            description: 'Geometry checkpoint quiz for the current Year 8A unit.',
            classScope: 'Year 8A',
            asset: 'geometry.pdf',
            accessibility: 'Printable geometry quiz with diagram descriptions',
            warning:
              'This resource is near its current availability end date. Publishing creates a new version.',
          }
        : {
            title: 'Calculus intro',
            description: 'Introductory calculus resource link requires repair before republishing.',
            classScope: 'Year 12C',
            asset: 'Broken link',
            accessibility: 'External calculus introduction resource',
            warning:
              'The current authorised link is unavailable. Repair remains a draft-only preview until a production write contract is connected.',
          };

  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/teacher/resources')} currentPath="/teacher/resources" />
      <div className="operational-split operational-split--wide">
        <Pane
          title="Resource register"
          description="Published, draft and expiry states remain explicit."
        >
          <DataTable
            label="Teacher resource register"
            headers={[
              'Title',
              'Class',
              'Type',
              'Visibility',
              'Available',
              'Asset',
              'Owner',
              'Updated',
              'Action',
            ]}
            rows={[
              [
                'Multi-step equations practice',
                'Year 8A',
                'Document',
                <Status key="s">Draft</Status>,
                'Tomorrow–15 Aug',
                'equations_v1.pdf',
                'N. Rahman',
                'Saved locally',
                <button
                  aria-label="Edit Multi-step equations practice"
                  aria-pressed={selectedResource === 'Multi-step equations practice'}
                  key="a"
                  onClick={() => setSelectedResource('Multi-step equations practice')}
                  type="button"
                >
                  Edit
                </button>,
              ],
              [
                'Algebra fundamentals',
                'Year 9B',
                'Video',
                <Status key="s">Published</Status>,
                'Now',
                'Authorised link',
                'N. Rahman',
                '28 Jul',
                <PilotUnavailableAction key="a">Preview</PilotUnavailableAction>,
              ],
              [
                'Geometry quiz',
                'Year 8A',
                'PDF',
                <Status key="s">Expiring</Status>,
                'Until 2 Aug',
                'geometry.pdf',
                'N. Rahman',
                '27 Jul',
                <button
                  aria-label="Edit Geometry quiz"
                  aria-pressed={selectedResource === 'Geometry quiz'}
                  key="a"
                  onClick={() => setSelectedResource('Geometry quiz')}
                  type="button"
                >
                  Edit
                </button>,
              ],
              [
                'Calculus intro',
                'Year 12C',
                'Link',
                <Status key="s">Error</Status>,
                'Now',
                'Broken link',
                'N. Rahman',
                '26 Jul',
                <button
                  aria-label="Repair Calculus intro"
                  aria-pressed={selectedResource === 'Calculus intro'}
                  key="a"
                  onClick={() => setSelectedResource('Calculus intro')}
                  type="button"
                >
                  Repair
                </button>,
              ],
            ]}
          />
        </Pane>
        <Pane
          title={selectedResource === 'Calculus intro' ? 'Repair resource' : 'Edit resource'}
          description="Revisions create a new version; published history is not overwritten."
        >
          <form className="operational-form" key={selectedResource}>
            <label>
              Title
              <input defaultValue={selectedResourceDetail.title} />
            </label>
            <label>
              Description
              <textarea rows={4} defaultValue={selectedResourceDetail.description} />
            </label>
            <label>
              Class scope
              <select multiple defaultValue={[selectedResourceDetail.classScope]}>
                <option>Year 8A</option>
                <option>Year 9B</option>
                <option>Year 12C</option>
              </select>
            </label>
            <label>
              Asset
              <input readOnly value={selectedResourceDetail.asset} />
            </label>
            <label>
              Accessibility description
              <input defaultValue={selectedResourceDetail.accessibility} />
            </label>
            <Notice title="Resource boundary" tone="warning">
              {selectedResourceDetail.warning}
            </Notice>
            <div className="operational-inline-actions">
              <PilotUnavailableAction>Save draft</PilotUnavailableAction>
              <PilotUnavailableAction>Preview as student</PilotUnavailableAction>
              <PilotUnavailableAction primary>Publish</PilotUnavailableAction>
            </div>
          </form>
        </Pane>
      </div>
    </div>
  );
}

function FamilyApplications(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/family/applications')} currentPath="/family/applications" />
      <Pane
        title="Nabil Noor · Year 3 · 2027 intake"
        description="Documents requested · the next household action is clear."
      >
        <Timeline
          label="Application progress"
          items={[
            {
              time: '1',
              title: 'Application submitted',
              detail: 'Household application received',
              status: 'Complete',
            },
            {
              time: '2',
              title: 'Identity and details checked',
              detail: 'Core information verified',
              status: 'Complete',
            },
            {
              time: '3',
              title: 'Documents requested',
              detail: 'Birth certificate copy due 5 Aug',
              status: 'Current',
            },
            {
              time: '4',
              title: 'Review',
              detail: 'Starts after required evidence is received',
              status: 'Upcoming',
            },
            {
              time: '5',
              title: 'Decision',
              detail: 'Published after admissions review',
              status: 'Upcoming',
            },
          ]}
        />
      </Pane>
      <div className="operational-split">
        <Pane
          title="Upload requested document"
          description="Birth certificate copy · due 5 August."
        >
          <form className="operational-form">
            <label>
              Document
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" />
            </label>
            <span>PDF, JPG or PNG · maximum 5 MB</span>
            <Notice title="Validation example" tone="error">
              A selected file is larger than 5 MB. Choose a smaller copy; your application record is
              unchanged.
            </Notice>
            <label className="operational-check">
              <input type="checkbox" />I confirm this copy belongs to the applicant.
            </label>
            <div className="operational-inline-actions">
              <PilotUnavailableAction>Save for later</PilotUnavailableAction>
              <PilotUnavailableAction primary>Submit document</PilotUnavailableAction>
            </div>
          </form>
        </Pane>
        <Pane title="Document history">
          <DataTable
            label="Application document history"
            headers={['Requested', 'Document', 'Reason', 'State', 'Reviewer acknowledgement']}
            rows={[
              [
                '30 Jul',
                'Birth certificate copy',
                'Identity evidence',
                <Status key="s">Pending</Status>,
                'Not yet received',
              ],
              [
                '22 Jul',
                'Previous school report',
                'Academic placement',
                <Status key="s">Submitted</Status>,
                'Acknowledged 23 Jul',
              ],
            ]}
          />
        </Pane>
      </div>
    </div>
  );
}

function FamilyChildren(): ReactElement {
  return (
    <div className="operational-stack">
      <div className="operational-register-selector">
        <button type="button" aria-pressed="true">
          <strong>Samira Noor</strong>
          <span>Year 8 · Main Campus · Daughter</span>
        </button>
      </div>
      <div className="operational-split operational-split--wide">
        <Pane
          title="Authorised profile"
          description="School-verified fields are read only; corrections create a request."
        >
          <DefinitionList
            label="Samira Noor authorised profile"
            items={[
              { term: 'Display name', value: 'Samira Noor' },
              { term: 'Preferred name', value: 'Samira' },
              { term: 'Year / campus', value: 'Year 8 · Main Campus' },
              { term: 'Relationship', value: 'Daughter' },
              { term: 'Enrolment', value: <Status key="s">Active</Status> },
              { term: 'School identifier', value: '88***1A' },
              { term: 'Additional field', value: 'Unavailable in current scope' },
            ]}
          />
          <PilotUnavailableAction>Request profile correction</PilotUnavailableAction>
        </Pane>
        <Pane title="Enrolment history">
          <Timeline
            label="Samira enrolment timeline"
            items={[
              {
                time: '2021',
                title: 'Admitted',
                detail: 'International Community School',
                status: 'Complete',
              },
              { time: '2021', title: 'Enrolled', detail: 'Main Campus', status: 'Complete' },
              { time: 'Now', title: 'Year 8', detail: 'Active enrolment', status: 'Current' },
            ]}
          />
        </Pane>
      </div>
      <Pane
        title="Emergency contacts"
        description="Masked contact values; annual confirmation opens next month."
      >
        <DataTable
          label="Emergency contacts"
          headers={['Contact', 'Relationship', 'Phone', 'Verification', 'Last confirmed', 'Action']}
          rows={[
            [
              'Farhana Noor',
              'Mother',
              '+880 •••• ••21',
              <Status key="s">Verified</Status>,
              '12 Aug 2025',
              'Review details',
            ],
            [
              'Mahmud Noor',
              'Father',
              '+880 •••• ••09',
              <Status key="s">Verified</Status>,
              '12 Aug 2025',
              'Review details',
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function AttendancePublished(props: { readonly student: boolean }): ReactElement {
  const [selectedAttendance, setSelectedAttendance] = useState<'12 Jul' | '14 Jul'>('12 Jul');

  return (
    <div className="operational-stack">
      <Notice title="Offline snapshot">
        Viewing the last verified published attendance record from 10:42. Draft teacher registers
        are never shown here.
      </Notice>
      <div className="operational-split operational-split--wide">
        <Pane
          title="July 2026 attendance record"
          description="Published dates and explicit revisions."
        >
          <DataTable
            label="Published attendance record"
            headers={['Date', 'Published state', 'Detail', 'Revision / explanation', 'Action']}
            rows={[
              [
                '15 Jul',
                <Status key="s">Present</Status>,
                'Full day',
                '—',
                <PilotUnavailableAction key="a">View</PilotUnavailableAction>,
              ],
              [
                '14 Jul',
                <Status key="s">Present · Revised</Status>,
                'Corrected by office',
                'Previously late · history retained',
                <button
                  aria-label="View 14 July revision history"
                  aria-pressed={selectedAttendance === '14 Jul'}
                  key="a"
                  onClick={() => setSelectedAttendance('14 Jul')}
                  type="button"
                >
                  View history
                </button>,
              ],
              [
                '12 Jul',
                <Status key="s">Absent</Status>,
                'Published 08:15',
                'Explanation under review',
                <button
                  aria-label="Track 12 July explanation"
                  aria-pressed={selectedAttendance === '12 Jul'}
                  key="a"
                  onClick={() => setSelectedAttendance('12 Jul')}
                  type="button"
                >
                  Track explanation
                </button>,
              ],
              [
                '10 Jul',
                <Status key="s">Late</Status>,
                'Arrived 08:45',
                'Published record',
                <PilotUnavailableAction key="a">View</PilotUnavailableAction>,
              ],
              [
                '09 Jul',
                <Status key="s">Present</Status>,
                'Full day',
                '—',
                <PilotUnavailableAction key="a">View</PilotUnavailableAction>,
              ],
            ]}
          />
        </Pane>
        <Pane
          title={selectedAttendance === '12 Jul' ? '12 July absence' : '14 July revision history'}
          description={
            selectedAttendance === '12 Jul'
              ? props.student
                ? 'Your family submitted an explanation.'
                : 'Household explanation lifecycle.'
              : 'Published correction history; the prior state remains visible.'
          }
        >
          <Timeline
            label={
              selectedAttendance === '12 Jul'
                ? 'Absence explanation timeline'
                : 'Attendance revision timeline'
            }
            items={
              selectedAttendance === '12 Jul'
                ? [
                    {
                      time: '08:15',
                      title: 'Absence published',
                      detail: 'Main Campus attendance ledger',
                      status: 'Published',
                    },
                    {
                      time: '09:30',
                      title: 'Explanation submitted',
                      detail: props.student
                        ? 'Your family submitted an explanation.'
                        : 'Family explanation received and preserved.',
                      status: 'Submitted',
                    },
                    {
                      time: '10:00',
                      title: 'School reviewing',
                      detail: 'Assigned to attendance officer',
                      status: 'In review',
                    },
                    {
                      time: 'Next',
                      title: 'Decision',
                      detail: 'The published outcome will appear here.',
                      status: 'Pending',
                    },
                  ]
                : [
                    {
                      time: '08:10',
                      title: 'Original attendance published',
                      detail: 'Late · original publication retained',
                      status: 'Historical',
                    },
                    {
                      time: '09:05',
                      title: 'Office correction recorded',
                      detail: 'Evidence reviewed by attendance office',
                      status: 'Revised',
                    },
                    {
                      time: '09:07',
                      title: 'Present republished',
                      detail: 'Current published state · prior version preserved',
                      status: 'Current',
                    },
                  ]
            }
          />
        </Pane>
      </div>
      <small className="operational-evidence-line">
        Published at 20 July 2026 · 08:00 · Source: Main Campus Ledger
      </small>
    </div>
  );
}

function ResultsPublished(props: { readonly student: boolean }): ReactElement {
  return (
    <div className="operational-stack">
      <Notice title="Published records only">
        Draft marks and internal teacher notes are not visible in this workspace.
      </Notice>
      <Pane
        title="Mathematics · Algebra checkpoint"
        description="Published 28 July · verified by Department Head."
      >
        <div className="operational-result-focus">
          <strong>A-</strong>
          <div>
            <span>Teacher feedback</span>
            <p>
              {props.student
                ? 'Good method selection. Show the final verification step.'
                : 'Consistent progress; practise multi-step equations.'}
            </p>
            {props.student ? (
              <PilotUnavailableAction>Acknowledge feedback</PilotUnavailableAction>
            ) : (
              <PilotUnavailableAction>Review mathematics feedback</PilotUnavailableAction>
            )}
          </div>
        </div>
      </Pane>
      <Pane title={props.student ? 'My subject results' : 'Published subject results'}>
        <DataTable
          label="Published subject results"
          headers={['Subject', 'Assessment', 'Result', 'Feedback summary', 'Status / date']}
          rows={[
            [
              'Mathematics',
              'Algebra checkpoint',
              'A-',
              'Published feedback available',
              <Status key="s">28 Jul · Published</Status>,
            ],
            ['Science', 'Not published yet', '—', '—', '—'],
            ['English', 'Not published yet', '—', '—', '—'],
            ['History', 'Not published yet', '—', '—', '—'],
          ]}
        />
      </Pane>
      <div className="operational-split">
        <Pane title="Term 2 progress report">
          <DefinitionList
            label="Progress report"
            items={[
              { term: 'Format', value: 'PDF · 1.2 MB' },
              { term: 'Published', value: '28 July' },
              { term: 'State', value: <Status key="s">Published</Status> },
            ]}
          />
          <PilotUnavailableAction primary>Open progress report</PilotUnavailableAction>
        </Pane>
        <Pane title="Revision policy">
          <p>
            Revised results are explicitly labelled and retain version history back to the original
            publication. Current revisions: 0.
          </p>
        </Pane>
      </div>
    </div>
  );
}

function FamilyFinance(): ReactElement {
  return (
    <div className="operational-stack">
      <Pane
        title="Current statement"
        description="Samira Noor · August tuition instalment · due 10 Aug."
      >
        <DataTable
          label="Current household statement"
          headers={['Line', 'Reference', 'Debit', 'Credit / allocation', 'Running balance']}
          rows={[
            ['Opening balance', 'STAT-08-26', 'BDT 0', '—', 'BDT 0'],
            ['August tuition instalment', 'INV-8821', 'BDT 18,500', '—', 'BDT 18,500'],
            [
              'Verified receipts this term',
              '3 receipts',
              '—',
              'Previous charges only',
              'BDT 18,500',
            ],
          ]}
        />
      </Pane>
      <div className="operational-split">
        <Pane title="Payment options" description="No production payments in this pilot.">
          <ul className="operational-plain-list">
            <li>Bank transfer</li>
            <li>School cashier</li>
            <li>Approved payment provider</li>
          </ul>
          <Notice title="Uncertain provider response" tone="warning">
            If a payment response is unclear, use “Check payment status” rather than submitting
            again.
          </Notice>
          <PilotUnavailableAction>Check payment status</PilotUnavailableAction>
        </Pane>
        <Pane title="Receipt history">
          <DataTable
            label="Verified receipt history"
            headers={[
              'Receipt',
              'Date',
              'Amount',
              'Method',
              'Allocation',
              'Verification',
              'Action',
            ]}
            rows={[
              [
                'RCPT-47211',
                '10 Jun',
                'BDT 18,500',
                'Bank transfer',
                'June tuition',
                <Status key="s">Verified</Status>,
                'Download',
              ],
              [
                'RCPT-47802',
                '10 Jul',
                'BDT 18,500',
                'Bank transfer',
                'July tuition',
                <Status key="s">Verified</Status>,
                'Download',
              ],
              [
                'RCPT-48100',
                '24 Jul',
                'BDT 4,000',
                'Cash',
                'Activity fee',
                <Status key="s">Verified</Status>,
                'Download',
              ],
            ]}
          />
        </Pane>
      </div>
    </div>
  );
}

function FamilyForms(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/family/forms')} currentPath="/family/forms" />
      <Pane
        title="Science trip consent"
        description="Samira Noor · Science Museum · 15 Oct · due 2 Aug."
      >
        <form className="operational-form operational-form--wide">
          <DefinitionList
            label="Trip details"
            items={[
              { term: 'Destination', value: 'Science Museum' },
              { term: 'Date', value: '15 October' },
              {
                term: 'Itinerary',
                value: <a href="/family/documents">View authorised itinerary PDF</a>,
              },
            ]}
          />
          <label className="operational-check">
            <input type="checkbox" />I give permission for Samira Noor to attend this trip.
          </label>
          <label className="operational-check">
            <input type="checkbox" />I confirm the emergency contact details shown to the school are
            current.
          </label>
          <a href="/family/children">Confirm sensitive details on file</a>
          <label>
            Guardian declaration
            <input defaultValue="Farhana Noor" />
          </label>
          <label>
            Date
            <input type="date" defaultValue="2026-08-01" />
          </label>
          <Notice title="Session expiry warning" tone="warning">
            Refresh the verified session before final submission. Your draft answers are safe.
          </Notice>
          <div className="operational-inline-actions">
            <PilotUnavailableAction>Save for later</PilotUnavailableAction>
            <PilotUnavailableAction primary>Submit consent</PilotUnavailableAction>
          </div>
        </form>
      </Pane>
      <Pane title="Submitted forms">
        <DataTable
          label="Submitted household forms"
          headers={['Form', 'Child', 'Submitted', 'State', 'Reference', 'Action']}
          rows={[
            [
              'Annual photo consent',
              'Samira Noor',
              '15 Jan',
              <Status key="s">Complete</Status>,
              'FORM-221',
              'View response',
            ],
            [
              'Term 1 field trip',
              'Samira Noor',
              '5 Feb',
              <Status key="s">Complete</Status>,
              'FORM-304',
              'View response',
            ],
            [
              'Previous medical confirmation',
              'Samira Noor',
              'Last year',
              <Status key="s">Expired · read only</Status>,
              'FORM-118',
              'View history',
            ],
            [
              'Science trip consent',
              'Samira Noor',
              'Saved locally',
              <Status key="s">Offline draft</Status>,
              'Draft',
              'Continue',
            ],
          ]}
        />
      </Pane>
    </div>
  );
}

function DocumentsWorkspace(props: { readonly student: boolean }): ReactElement {
  const [welcomeSelected, setWelcomeSelected] = useState(false);

  return (
    <div className="operational-stack">
      <Notice title="Authorised records only">
        Draft and unpublished documents are not shown. Out-of-scope records disclose no title,
        category, date or person metadata.
      </Notice>
      <div className="operational-split operational-split--wide">
        <Pane title="Document register">
          <DataTable
            label="Authorised document register"
            headers={[
              'Document',
              'Scope',
              'Category',
              'Published',
              'State',
              'Availability',
              'Action',
            ]}
            rows={[
              [
                'Term 2 progress report',
                props.student ? 'Samira Noor' : 'Samira Noor',
                'Report card',
                '28 Jul',
                <Status key="s">New</Status>,
                'Available',
                <button key="a" onClick={() => setWelcomeSelected(false)} type="button">
                  Term 2
                </button>,
              ],
              [
                'School welcome letter',
                props.student ? 'Samira Noor' : 'Household',
                'Letter',
                '1 Aug',
                <Status key="s">Available</Status>,
                'Available',
                <button key="a" onClick={() => setWelcomeSelected(true)} type="button">
                  Welcome
                </button>,
              ],
              [
                'Enrolment confirmation',
                'Samira Noor',
                'Record',
                '10 Sep 2021',
                <Status key="s">Superseded</Status>,
                'Current revision exists',
                <PilotUnavailableAction key="a">View current version</PilotUnavailableAction>,
              ],
              ['Not available in this scope', '—', '—', '—', '—', '—', '—'],
              [
                'Term 1 report',
                'Samira Noor',
                'Report',
                '12 Apr',
                <Status key="s">Offline cached copy</Status>,
                'Cached',
                <PilotUnavailableAction key="a">Open cached copy</PilotUnavailableAction>,
              ],
              [
                'Annual report',
                'Samira Noor',
                'Report',
                '15 Dec',
                <Status key="s">Open error</Status>,
                'Temporary error',
                <PilotUnavailableAction key="a">Retry</PilotUnavailableAction>,
              ],
            ]}
          />
        </Pane>
        <Pane
          title={welcomeSelected ? 'School welcome letter' : 'Term 2 progress report'}
          description="Document metadata."
        >
          <DefinitionList
            label="Document metadata"
            items={[
              { term: 'Category', value: welcomeSelected ? 'Letter' : 'Report card' },
              { term: 'Published', value: welcomeSelected ? '1 Aug' : '28 Jul' },
              { term: 'File', value: welcomeSelected ? 'PDF · 340 KB' : 'PDF · 1.2 MB' },
              {
                term: 'Authorisation',
                value: props.student
                  ? 'Samira Noor only'
                  : welcomeSelected
                    ? 'Verified household only'
                    : 'Primary guardian only',
              },
            ]}
          />
          <div className="operational-inline-actions">
            <PilotUnavailableAction primary>Open authorised copy</PilotUnavailableAction>
            <PilotUnavailableAction>Download authorised copy</PilotUnavailableAction>
          </div>
        </Pane>
      </div>
    </div>
  );
}

function StudentTimetable(): ReactElement {
  return (
    <div className="operational-stack">
      <Notice title="Published schedule snapshot">
        Last verified at 09:42. Room changes include a timestamp and remain readable offline.
      </Notice>
      <div className="operational-day-switcher" aria-label="Timetable day">
        <button aria-describedby="student-timetable-preview-boundary" disabled type="button">
          Mon
        </button>
        <button aria-describedby="student-timetable-preview-boundary" disabled type="button">
          Tue
        </button>
        <button type="button" aria-pressed="true">
          Wed · Today
        </button>
        <button aria-describedby="student-timetable-preview-boundary" disabled type="button">
          Thu
        </button>
        <button aria-describedby="student-timetable-preview-boundary" disabled type="button">
          Fri
        </button>
        <PilotUnavailableAction>Week view</PilotUnavailableAction>
      </div>
      <small className="operational-evidence-line" id="student-timetable-preview-boundary">
        Only Wednesday’s synthetic schedule is loaded in this pilot fixture.
      </small>
      <Pane title="Wednesday timetable" description="Six published lessons · one room change.">
        <Timeline
          label="Student timetable"
          items={[
            {
              time: '08:00–08:45',
              title: 'Mathematics · Ms Rahman',
              detail: 'Room 204 · open current lesson',
              status: 'Current',
            },
            {
              time: '09:00–09:45',
              title: 'Science · Mr Karim',
              detail: 'Lab 2 · room changed from Lab 1',
              status: 'Next',
            },
            {
              time: '10:00–10:45',
              title: 'English · Mr Smith',
              detail: 'Room 102',
              status: 'Later',
            },
            {
              time: '11:15–12:00',
              title: 'History · Ms Jones',
              detail: 'Room 305',
              status: 'Later',
            },
            {
              time: '13:00–13:45',
              title: 'Geography · Mr Davis',
              detail: 'Room 210',
              status: 'Later',
            },
            { time: '14:00–14:45', title: 'Art · Ms Patel', detail: 'Studio 1', status: 'Later' },
          ]}
        />
      </Pane>
      <Pane title="Schedule change log">
        <Timeline
          label="Schedule change log"
          items={[
            {
              time: '07:45',
              title: 'Science moved to Lab 2',
              detail: 'Reason: equipment maintenance · acknowledged',
              status: 'Published change',
            },
          ]}
        />
      </Pane>
    </div>
  );
}

function StudentResources(): ReactElement {
  return (
    <div className="operational-stack">
      <PriorityQueue page={routePage('/student/resources')} currentPath="/student/resources" />
      <div className="operational-split operational-split--wide">
        <Pane title="Learning resource register">
          <DataTable
            label="Student learning resources"
            headers={[
              'Title',
              'Subject',
              'Type',
              'Teacher',
              'Availability',
              'Due / expiry',
              'State',
              'Action',
            ]}
            rows={[
              [
                'Multi-step equations practice',
                'Mathematics',
                'Document',
                'Ms Rahman',
                'Now',
                '15 Aug',
                <Status key="s">New</Status>,
                'Open resource',
              ],
              [
                'Cell biology video',
                'Science',
                'Video',
                'Mr Karim',
                'Now',
                '—',
                <Status key="s">Available</Status>,
                'Open',
              ],
              [
                'History essay prep',
                'History',
                'Link',
                'Ms Jones',
                'Now',
                '24 May',
                <Status key="s">Due</Status>,
                'Open',
              ],
              [
                'Physics lab manual',
                'Science',
                'Document',
                'Mr Smith',
                'Cached',
                '—',
                <Status key="s">Offline cached</Status>,
                'Open cached',
              ],
              [
                'Broken link resource',
                'Science',
                'Link',
                'Mr Karim',
                'Now',
                '—',
                <Status key="s">Error</Status>,
                'Retry connection',
              ],
              [
                'Future resource',
                'Mathematics',
                'Document',
                'Ms Rahman',
                'From 20 Aug',
                '—',
                <Status key="s">Not yet available</Status>,
                '—',
              ],
              [
                'Expired resource',
                'English',
                'Document',
                'Mr Smith',
                'Ended',
                '20 Jul',
                <Status key="s">Expired · read only</Status>,
                'View metadata',
              ],
            ]}
          />
        </Pane>
        <Pane
          title="Multi-step equations practice"
          description="Practice set for tomorrow’s lesson."
        >
          <DefinitionList
            label="Resource details"
            items={[
              { term: 'Subject', value: 'Mathematics' },
              { term: 'Published', value: '29 July' },
              { term: 'Available until', value: '15 Aug' },
              { term: 'File', value: 'PDF' },
              { term: 'Accessibility', value: 'Tagged text and printable equations' },
              { term: 'Version', value: 'v1.2' },
            ]}
          />
          <div className="operational-inline-actions">
            <PilotUnavailableAction primary>Open resource</PilotUnavailableAction>
            <PilotUnavailableAction>Download</PilotUnavailableAction>
          </div>
        </Pane>
      </div>
    </div>
  );
}

function StudentRequests(): ReactElement {
  return (
    <div className="operational-stack">
      <Pane
        title="Library book renewal"
        description="Reference REQ-8812 · submitted today 09:42 · handled by Library team."
      >
        <Timeline
          label="Library renewal request"
          items={[
            { time: '1', title: 'Submitted', detail: 'Request received', status: 'Complete' },
            {
              time: '2',
              title: 'In review',
              detail: 'Library team is checking the current loan',
              status: 'Current',
            },
            {
              time: '3',
              title: 'Decision',
              detail: 'Next update will appear here',
              status: 'Pending',
            },
          ]}
        />
        <Notice title="Next action">
          Wait for library approval. You do not need to submit this request again.
        </Notice>
      </Pane>
      <div className="operational-split">
        <Pane
          title="Create request"
          description="Only request types available to your student role are shown."
        >
          <ul className="operational-plain-list">
            <li>
              <strong>Library book renewal</strong>
              <span>Request a 7-day extension.</span>
            </li>
            <li>
              <strong>Timetable query</strong>
              <span>Report a clash or missing published lesson.</span>
            </li>
            <li>
              <strong>Document request</strong>
              <span>Request an authorised enrolment or attendance copy.</span>
            </li>
          </ul>
          <form className="operational-form">
            <label>
              Request type
              <select defaultValue="Library book renewal">
                <option>Library book renewal</option>
                <option>Timetable query</option>
                <option>Document request</option>
              </select>
            </label>
            <label>
              Description
              <textarea
                rows={4}
                defaultValue="Please renew my current library book for seven days."
              />
            </label>
            <label>
              Authorised attachment
              <input type="file" />
            </label>
            <div className="operational-inline-actions">
              <PilotUnavailableAction>Save draft</PilotUnavailableAction>
              <PilotUnavailableAction primary>Submit request</PilotUnavailableAction>
            </div>
          </form>
        </Pane>
        <Pane title="Request history">
          <DataTable
            label="Student request history"
            headers={['Request', 'State', 'Outcome / next action', 'Action']}
            rows={[
              [
                'Locker key replacement',
                <Status key="s">Declined</Status>,
                'Replacement limit reached · visit bursar office',
                'Start new request',
              ],
              ['Club registration', <Status key="s">Complete</Status>, 'Registered', 'View'],
            ]}
          />
        </Pane>
      </div>
    </div>
  );
}

function routePage(path: string): PilotModulePage {
  const page = modulePages[path];
  if (page === undefined) throw new Error(`Missing operational route page: ${path}`);
  return page;
}

function bodyForPath(path: string): ReactElement {
  switch (path) {
    case '/admin/sis':
      return <AdminSis />;
    case '/admin/academics':
      return <AdminAcademics />;
    case '/admin/finance':
      return <AdminFinance />;
    case '/admin/operations':
      return <AdminOperations />;
    case '/admin/student-support':
      return <AdminSupport />;
    case '/admin/communications':
      return <AdminCommunications />;
    case '/admin/integrations':
      return <AdminIntegrations />;
    case '/admin/reports':
      return <AdminReports />;
    case '/teacher/classes':
      return <TeacherClasses />;
    case '/teacher/attendance':
      return <TeacherAttendance />;
    case '/teacher/gradebook':
      return <TeacherGradebook />;
    case '/teacher/students':
      return <TeacherStudents />;
    case '/teacher/messages':
      return <MessageWorkspace persona="teacher" />;
    case '/teacher/resources':
      return <TeacherResources />;
    case '/family/applications':
      return <FamilyApplications />;
    case '/family/children':
      return <FamilyChildren />;
    case '/family/attendance':
      return <AttendancePublished student={false} />;
    case '/family/grades':
      return <ResultsPublished student={false} />;
    case '/family/finance':
      return <FamilyFinance />;
    case '/family/forms':
      return <FamilyForms />;
    case '/family/documents':
      return <DocumentsWorkspace student={false} />;
    case '/family/messages':
      return <MessageWorkspace persona="guardian" />;
    case '/student/timetable':
      return <StudentTimetable />;
    case '/student/attendance':
      return <AttendancePublished student />;
    case '/student/results':
      return <ResultsPublished student />;
    case '/student/documents':
      return <DocumentsWorkspace student />;
    case '/student/resources':
      return <StudentResources />;
    case '/student/requests':
      return <StudentRequests />;
    case '/student/messages':
      return <MessageWorkspace persona="student" />;
    default:
      return <></>;
  }
}

export function OperationalModuleSurface(props: OperationalModuleSurfaceProps): ReactElement {
  return (
    <div className="operational-module" data-persona={props.role} data-route={props.path}>
      <header className="operational-context-line">
        <strong>{props.page.eyebrow}</strong>
        <span>International Community School · Main Campus</span>
        <time dateTime={pilotTimestamp}>Evidence current at {pilotTimestamp}</time>
      </header>
      <MetricStrip page={props.page} />
      <ActionBar page={props.page} currentPath={props.path} />
      {bodyForPath(props.path)}
      <aside className="operational-pilot-note" id="operational-pilot-action-boundary">
        <strong>Pilot boundary</strong>
        <span>
          Records shown here are synthetic. Controls that would write, send, publish, approve,
          download or fetch privileged production data stay disabled unless an existing safe route
          contract is wired. Local attendance marking can be saved on this device without sending a
          production write.
        </span>
      </aside>
    </div>
  );
}
