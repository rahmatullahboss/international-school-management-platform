/*
THESIS: School administration needs one evidence-backed exception ledger, not a collage of module dashboards.
OWN-WORLD: The Operational Ledger — paper surfaces, structural ink, ruled queues and restrained action teal.
STORY: Leaders scan readiness, act on the highest-risk work, verify the source and open only records they may see.
FIRST VIEWPORT: Scope and definitions lead directly into blocking exceptions and approvals.
FORM: Cross-module read model composed from public links; no private table access or hidden mutation.
*/
import type { ReactElement, ReactNode } from 'react';

import './admin-operations.css';

export type AdminEvidenceTone = 'stable' | 'information' | 'warning' | 'error' | 'critical';
export type AdminAssurance = 'aal1' | 'aal2';

export interface AdminEvidenceSource {
  label: string;
  href: string;
  updatedAt: string;
}

export interface AdminReadinessMetric {
  id: string;
  label: string;
  value: string | number;
  definition: string;
  tone: AdminEvidenceTone;
  source: AdminEvidenceSource;
  capability?: string;
}

export interface AdminExceptionItem {
  id: string;
  area: string;
  title: string;
  summary: string;
  severity: Exclude<AdminEvidenceTone, 'stable'>;
  status: string;
  href: string;
  source: AdminEvidenceSource;
  owner?: string;
  dueAt?: string;
  capability?: string;
  requiredAssurance?: AdminAssurance;
  bulkGroup?: string;
  bulkCapability?: string;
}

export interface AdminApprovalItem {
  id: string;
  title: string;
  requestor: string;
  submittedAt: string;
  stage: string;
  href: string;
  capability?: string;
  requiredAssurance?: AdminAssurance;
}

export interface AdminSearchResult {
  id: string;
  kind: string;
  label: string;
  context: string;
  href: string;
  capability?: string;
}

export interface AdminBulkAction {
  id: string;
  label: string;
  group: string;
  capability: string;
  href: string;
}

export interface AdminOperationsHomeProps {
  schoolName: string;
  campusName: string;
  locale: string;
  asOf: string;
  assurance: AdminAssurance;
  capabilities: readonly string[];
  metrics: readonly AdminReadinessMetric[];
  exceptions: readonly AdminExceptionItem[];
  approvals: readonly AdminApprovalItem[];
  searchQuery?: string;
  searchResults?: readonly AdminSearchResult[];
  selectedExceptionIds?: readonly string[];
  bulkActions?: readonly AdminBulkAction[];
  state?: 'ready' | 'loading' | 'error';
  errorMessage?: string;
}

export interface AdminRecordField {
  label: string;
  value: ReactNode;
  capability?: string;
}

export interface AdminRecordAction {
  label: string;
  href: string;
  capability: string;
  requiredAssurance?: AdminAssurance;
}

export interface AdminRelatedRecord {
  id: string;
  kind: string;
  label: string;
  context: string;
  href: string;
  capability?: string;
}

export interface AdminRecordEvidence {
  id: string;
  label: string;
  actor: string;
  occurredAt: string;
  detail: string;
}

export interface AdminRecordWorkspaceProps {
  access: 'available' | 'restricted' | 'not-found';
  recordKind: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  assurance: AdminAssurance;
  capabilities: readonly string[];
  fields: readonly AdminRecordField[];
  actions: readonly AdminRecordAction[];
  related: readonly AdminRelatedRecord[];
  evidence: readonly AdminRecordEvidence[];
}

const severityOrder: Readonly<Record<AdminExceptionItem['severity'], number>> = {
  critical: 0,
  error: 1,
  warning: 2,
  information: 3,
};

function hasCapability(capabilities: readonly string[], capability?: string): boolean {
  return capability === undefined || capabilities.includes(capability);
}

function assuranceMeets(current: AdminAssurance, required?: AdminAssurance): boolean {
  return required === undefined || required === 'aal1' || current === 'aal2';
}

export function selectAdminMetrics(
  metrics: readonly AdminReadinessMetric[],
  capabilities: readonly string[],
): AdminReadinessMetric[] {
  return metrics.filter((metric) => hasCapability(capabilities, metric.capability));
}

export function selectAdminExceptions(
  exceptions: readonly AdminExceptionItem[],
  capabilities: readonly string[],
): AdminExceptionItem[] {
  const permitted = exceptions.filter((item) => hasCapability(capabilities, item.capability));
  return [...permitted].sort((left, right) => {
    const severityDifference = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDifference !== 0) return severityDifference;
    if (left.dueAt === undefined) return 1;
    if (right.dueAt === undefined) return -1;
    return left.dueAt.localeCompare(right.dueAt);
  });
}

export function selectAdminApprovals(
  approvals: readonly AdminApprovalItem[],
  capabilities: readonly string[],
): AdminApprovalItem[] {
  return approvals.filter((approval) => hasCapability(capabilities, approval.capability));
}

export function selectAdminSearchResults(
  results: readonly AdminSearchResult[] | undefined,
  capabilities: readonly string[],
): AdminSearchResult[] {
  return (results ?? []).filter((result) => hasCapability(capabilities, result.capability));
}

export function selectAdminBulkActions(
  actions: readonly AdminBulkAction[] | undefined,
  exceptions: readonly AdminExceptionItem[],
  selectedIds: readonly string[] | undefined,
  capabilities: readonly string[],
): AdminBulkAction[] {
  if (actions === undefined || selectedIds === undefined || selectedIds.length === 0) return [];
  const selected = exceptions.filter((item) => selectedIds.includes(item.id));
  if (selected.length !== selectedIds.length) return [];

  return actions.filter(
    (action) =>
      capabilities.includes(action.capability) &&
      selected.every(
        (item) => item.bulkGroup === action.group && item.bulkCapability === action.capability,
      ),
  );
}

function formatValue(locale: string, value: string | number): string {
  return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
}

function StepUpLabel(props: {
  assurance: AdminAssurance;
  requiredAssurance?: AdminAssurance;
}): ReactElement | null {
  if (assuranceMeets(props.assurance, props.requiredAssurance)) return null;
  return <span className="admin-step-up">Verify identity to continue</span>;
}

function LoadingState(): ReactElement {
  return (
    <section className="admin-ops-state" role="status" aria-live="polite">
      <strong>Preparing the administration ledger</strong>
      <span>Loading current scope, permissions, exceptions and evidence sources.</span>
    </section>
  );
}

export function AdminOperationsHome(props: AdminOperationsHomeProps): ReactElement {
  if (props.state === 'loading') return <LoadingState />;

  const metrics = selectAdminMetrics(props.metrics, props.capabilities);
  const exceptions = selectAdminExceptions(props.exceptions, props.capabilities);
  const approvals = selectAdminApprovals(props.approvals, props.capabilities);
  const searchResults = selectAdminSearchResults(props.searchResults, props.capabilities);
  const bulkActions = selectAdminBulkActions(
    props.bulkActions,
    exceptions,
    props.selectedExceptionIds,
    props.capabilities,
  );
  const selectedCount = exceptions.filter((item) =>
    props.selectedExceptionIds?.includes(item.id),
  ).length;

  return (
    <section className="admin-ops" aria-labelledby="admin-ops-title">
      <header className="admin-ops__masthead">
        <div>
          <p>Administration ledger</p>
          <h2 id="admin-ops-title">{props.schoolName}</h2>
          <span>
            {props.campusName} · Evidence current at <time dateTime={props.asOf}>{props.asOf}</time>
          </span>
        </div>
        <a href="/admin/reports/readiness">Open governed readiness report</a>
      </header>

      {props.state === 'error' ? (
        <div className="admin-ops-state admin-ops-state--error" role="alert">
          <strong>Administration evidence could not be loaded</strong>
          <span>
            {props.errorMessage ?? 'No action was submitted. Refresh or contact platform support.'}
          </span>
          <a href="/admin">Retry</a>
        </div>
      ) : null}

      <section className="admin-ledger" aria-labelledby="admin-readiness-title">
        <header>
          <h3 id="admin-readiness-title">Readiness definitions</h3>
          <p>Every value states what it means, where it came from and when it was updated.</p>
        </header>
        {metrics.length === 0 ? (
          <p className="admin-empty">
            No readiness measures are available for this role and scope.
          </p>
        ) : (
          <dl>
            {metrics.map((metric) => (
              <div key={metric.id} data-tone={metric.tone}>
                <dt>{metric.label}</dt>
                <dd>
                  <strong>{formatValue(props.locale, metric.value)}</strong>
                  <span>{metric.definition}</span>
                  <a href={metric.source.href}>{metric.source.label}</a>
                  <time dateTime={metric.source.updatedAt}>{metric.source.updatedAt}</time>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="admin-queue" aria-labelledby="admin-exceptions-title">
        <header>
          <div>
            <h3 id="admin-exceptions-title">Priority exceptions</h3>
            <p>Sorted by severity and due time after permission filtering.</p>
          </div>
          <a href="/admin/queues">Open all queues</a>
        </header>

        {bulkActions.length === 0 ? null : (
          <div className="admin-bulk" role="region" aria-label="Bulk operations">
            <strong>{new Intl.NumberFormat(props.locale).format(selectedCount)} selected</strong>
            {bulkActions.map((action) => (
              <a href={action.href} key={action.id}>
                {action.label}
              </a>
            ))}
          </div>
        )}

        {exceptions.length === 0 ? (
          <p className="admin-empty">No permitted exceptions require action.</p>
        ) : (
          <div
            className="admin-table-frame"
            role="region"
            aria-label="Priority exception queue"
            tabIndex={0}
          >
            <table>
              <caption>Cross-module administration exceptions</caption>
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Area and task</th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner / due</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((item) => {
                  const canAct = assuranceMeets(props.assurance, item.requiredAssurance);
                  return (
                    <tr key={item.id} data-severity={item.severity}>
                      <td>
                        {item.bulkGroup === undefined || item.bulkCapability === undefined ? (
                          <span aria-label="Not available for bulk selection">—</span>
                        ) : (
                          <input
                            aria-label={`Select ${item.title}`}
                            defaultChecked={props.selectedExceptionIds?.includes(item.id)}
                            name="exception"
                            type="checkbox"
                            value={item.id}
                          />
                        )}
                      </td>
                      <td>
                        <span className="admin-status" data-tone={item.severity}>
                          {item.severity}
                        </span>
                      </td>
                      <td>
                        <strong>{item.area}</strong>
                        <a href={canAct ? item.href : '#admin-step-up'}>{item.title}</a>
                        <span>{item.summary}</span>
                        <StepUpLabel
                          assurance={props.assurance}
                          requiredAssurance={item.requiredAssurance}
                        />
                      </td>
                      <td>{item.status}</td>
                      <td>
                        <span>{item.owner ?? 'Unassigned'}</span>
                        {item.dueAt === undefined ? null : (
                          <time dateTime={item.dueAt}>{item.dueAt}</time>
                        )}
                      </td>
                      <td>
                        <a href={item.source.href}>{item.source.label}</a>
                        <time dateTime={item.source.updatedAt}>{item.source.updatedAt}</time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="admin-ops__split">
        <section className="admin-approvals" aria-labelledby="admin-approvals-title">
          <header>
            <h3 id="admin-approvals-title">Approvals</h3>
            <a href="/admin/approvals">Open approval inbox</a>
          </header>
          {approvals.length === 0 ? (
            <p className="admin-empty">No permitted approvals are waiting.</p>
          ) : (
            <ul>
              {approvals.map((approval) => {
                const canAct = assuranceMeets(props.assurance, approval.requiredAssurance);
                return (
                  <li key={approval.id}>
                    <a href={canAct ? approval.href : '#admin-step-up'}>{approval.title}</a>
                    <span>
                      {approval.requestor} · {approval.stage}
                    </span>
                    <time dateTime={approval.submittedAt}>{approval.submittedAt}</time>
                    <StepUpLabel
                      assurance={props.assurance}
                      requiredAssurance={approval.requiredAssurance}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="admin-search" aria-labelledby="admin-search-title">
          <header>
            <h3 id="admin-search-title">Governed search</h3>
            <p>Results are filtered by tenant, scope and current capability before display.</p>
          </header>
          <form action="/admin/search" role="search">
            <label htmlFor="admin-global-search">Search permitted school records</label>
            <div>
              <input
                defaultValue={props.searchQuery}
                id="admin-global-search"
                name="q"
                placeholder="Student, household, invoice, class or asset"
                type="search"
              />
              <button type="submit">Search</button>
            </div>
          </form>
          {props.searchQuery === undefined ? null : searchResults.length === 0 ? (
            <p className="admin-empty">No permitted records match this search.</p>
          ) : (
            <ul>
              {searchResults.map((result) => (
                <li key={result.id}>
                  <span>{result.kind}</span>
                  <a href={result.href}>{result.label}</a>
                  <small>{result.context}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <span className="admin-step-up-anchor" id="admin-step-up">
        A verified AAL2 session is required for this action.
      </span>
    </section>
  );
}

export function AdminRecordWorkspace(props: AdminRecordWorkspaceProps): ReactElement {
  if (props.access !== 'available') {
    return (
      <section className="admin-record admin-record--masked" role="status">
        <a href={props.backHref}>{props.backLabel}</a>
        <h2>Record unavailable</h2>
        <p>The record may not exist or your current role, scope or assurance cannot access it.</p>
      </section>
    );
  }

  const fields = props.fields.filter((field) =>
    hasCapability(props.capabilities, field.capability),
  );
  const related = props.related.filter((item) =>
    hasCapability(props.capabilities, item.capability),
  );
  const actions = props.actions.filter((action) =>
    hasCapability(props.capabilities, action.capability),
  );

  return (
    <article className="admin-record" aria-labelledby="admin-record-title">
      <header>
        <a href={props.backHref}>{props.backLabel}</a>
        <p>{props.recordKind}</p>
        <h2 id="admin-record-title">{props.title}</h2>
        <span>{props.description}</span>
      </header>

      {actions.length === 0 ? null : (
        <nav className="admin-record__actions" aria-label="Record actions">
          {actions.map((action) =>
            assuranceMeets(props.assurance, action.requiredAssurance) ? (
              <a href={action.href} key={action.href}>
                {action.label}
              </a>
            ) : (
              <span key={action.href}>{action.label} · Verify identity to continue</span>
            ),
          )}
        </nav>
      )}

      <section aria-labelledby="admin-record-summary">
        <h3 id="admin-record-summary">Record summary</h3>
        <dl>
          {fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="admin-related-records">
        <h3 id="admin-related-records">Related records</h3>
        {related.length === 0 ? (
          <p className="admin-empty">No permitted related records are available.</p>
        ) : (
          <ul className="admin-record__related">
            {related.map((item) => (
              <li key={item.id}>
                <span>{item.kind}</span>
                <a href={item.href}>{item.label}</a>
                <small>{item.context}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-record-evidence">
        <h3 id="admin-record-evidence">Evidence history</h3>
        {props.evidence.length === 0 ? (
          <p className="admin-empty">No evidence events are available.</p>
        ) : (
          <ol className="admin-record__evidence">
            {props.evidence.map((event) => (
              <li key={event.id}>
                <strong>{event.label}</strong>
                <span>{event.detail}</span>
                <small>{event.actor}</small>
                <time dateTime={event.occurredAt}>{event.occurredAt}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
