import type { ReactElement, ReactNode } from 'react';

import './admin-command-centre.css';

export type AdminAttention = 'stable' | 'attention' | 'blocked' | 'critical';

export interface AdminMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly definition: string;
  readonly source: string;
  readonly asOf: string;
  readonly href: string;
  readonly attention?: AdminAttention;
}

export interface AdminException {
  readonly id: string;
  readonly domain:
    'people' | 'academics' | 'finance' | 'operations' | 'student-support' | 'integrations';
  readonly severity: Exclude<AdminAttention, 'stable'>;
  readonly title: string;
  readonly detail: string;
  readonly owner?: string;
  readonly dueAt?: string;
  readonly href: string;
  readonly requiredCapability?: string;
}

export interface AdminApproval {
  readonly id: string;
  readonly kind: string;
  readonly subject: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly assurance: 'aal1' | 'aal2';
  readonly href: string;
  readonly requiredCapability?: string;
}

export interface AdminSearchResult {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly scopeLabel: string;
  readonly requiredCapability?: string;
}

export interface AdminBulkOperation {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly selectedCount: number;
  readonly href: string;
  readonly requiredCapability: string;
  readonly blockedReasons?: readonly string[];
}

export interface AdminCommandCentreProps {
  readonly locale: string;
  readonly state?: 'ready' | 'loading' | 'error' | 'restricted';
  readonly errorTitle?: string;
  readonly errorDetail?: string;
  readonly retryHref?: string;
  readonly capabilities: readonly string[];
  readonly metrics: readonly AdminMetric[];
  readonly exceptions: readonly AdminException[];
  readonly approvals: readonly AdminApproval[];
  readonly searchQuery?: string;
  readonly searchResults?: readonly AdminSearchResult[];
  readonly bulkOperations?: readonly AdminBulkOperation[];
  readonly children?: ReactNode;
}

const severityRank: Readonly<Record<AdminException['severity'], number>> = {
  critical: 0,
  blocked: 1,
  attention: 2,
};

export function sortAdminExceptions(
  exceptions: readonly AdminException[],
): readonly AdminException[] {
  return [...exceptions].sort((left, right) => {
    const severity = severityRank[left.severity] - severityRank[right.severity];
    if (severity !== 0) return severity;
    if (left.dueAt === undefined && right.dueAt !== undefined) return 1;
    if (left.dueAt !== undefined && right.dueAt === undefined) return -1;
    return (left.dueAt ?? left.id).localeCompare(right.dueAt ?? right.id);
  });
}

export function filterAdminExperienceItems<T extends { readonly requiredCapability?: string }>(
  items: readonly T[],
  capabilities: readonly string[],
): readonly T[] {
  const allowed = new Set(capabilities);
  return items.filter(
    (item) => item.requiredCapability === undefined || allowed.has(item.requiredCapability),
  );
}

function formatValue(locale: string, value: string | number): string {
  return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
}

function StatePanel(props: {
  readonly title: string;
  readonly detail: string;
  readonly role?: 'status' | 'alert';
  readonly action?: ReactNode;
}): ReactElement {
  return (
    <section className="admin-centre__state" role={props.role ?? 'status'}>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
      {props.action}
    </section>
  );
}

function EmptyState(props: { readonly title: string; readonly detail: string }): ReactElement {
  return (
    <div className="admin-centre__empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

export function AdminCommandCentre(props: AdminCommandCentreProps): ReactElement {
  if (props.state === 'loading') {
    return (
      <StatePanel
        title="Preparing the administration command centre"
        detail="Loading governed metrics, exception queues and approval context."
      />
    );
  }

  if (props.state === 'error') {
    return (
      <StatePanel
        role="alert"
        title={props.errorTitle ?? 'Administration work could not be loaded'}
        detail={props.errorDetail ?? 'No submitted work was changed. Try the request again.'}
        action={
          props.retryHref === undefined ? null : (
            <a className="admin-centre__primary-action" href={props.retryHref}>
              Try again
            </a>
          )
        }
      />
    );
  }

  if (props.state === 'restricted') {
    return (
      <StatePanel
        role="alert"
        title="This administration view is not available"
        detail="Your current role or session does not allow this command-centre scope."
      />
    );
  }

  const visibleExceptions = sortAdminExceptions(
    filterAdminExperienceItems(props.exceptions, props.capabilities),
  );
  const visibleApprovals = filterAdminExperienceItems(props.approvals, props.capabilities);
  const visibleSearchResults = filterAdminExperienceItems(
    props.searchResults ?? [],
    props.capabilities,
  );
  const visibleBulkOperations = filterAdminExperienceItems(
    props.bulkOperations ?? [],
    props.capabilities,
  );
  const blockingCount = visibleExceptions.filter(
    (item) => item.severity === 'critical' || item.severity === 'blocked',
  ).length;

  return (
    <div className="admin-centre" data-blocking-count={blockingCount}>
      <header className="admin-centre__summary">
        <div>
          <p className="admin-centre__kicker">Administration command centre</p>
          <h2>Priority work across the school</h2>
          <p>
            Review defined metrics, resolve the highest-risk exceptions and complete governed
            approvals without crossing module data boundaries.
          </p>
        </div>
        <div className="admin-centre__readiness" role="status" aria-live="polite">
          <strong>{blockingCount === 0 ? 'No blocking exceptions' : 'Action required'}</strong>
          <span>
            {blockingCount === 0
              ? 'Visible queues are ready for normal review.'
              : `${new Intl.NumberFormat(props.locale).format(blockingCount)} blocking item${blockingCount === 1 ? '' : 's'} visible in your scope.`}
          </span>
        </div>
      </header>

      <section className="admin-centre__section" aria-labelledby="admin-metrics-heading">
        <header>
          <h3 id="admin-metrics-heading">Defined school measures</h3>
          <p>Each value states its definition, source, timestamp and investigation path.</p>
        </header>
        {props.metrics.length === 0 ? (
          <EmptyState
            title="No measures are available"
            detail="Metric definitions will appear when an authorised source publishes them."
          />
        ) : (
          <dl className="admin-centre__metrics">
            {props.metrics.map((metric) => (
              <div key={metric.id} data-attention={metric.attention ?? 'stable'}>
                <dt>{metric.label}</dt>
                <dd>
                  <a href={metric.href}>{formatValue(props.locale, metric.value)}</a>
                  <span>{metric.definition}</span>
                  <small>
                    Source: {metric.source} · <time dateTime={metric.asOf}>{metric.asOf}</time>
                  </small>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="admin-centre__section" aria-labelledby="admin-exceptions-heading">
        <header>
          <h3 id="admin-exceptions-heading">Cross-module exception queue</h3>
          <p>Only items allowed by the current capability set are shown.</p>
        </header>
        {visibleExceptions.length === 0 ? (
          <EmptyState
            title="No visible exceptions"
            detail="No authorised queue currently needs intervention."
          />
        ) : (
          <div
            className="admin-centre__table-frame"
            role="region"
            aria-label="School exceptions"
            tabIndex={0}
          >
            <table>
              <caption>Highest-risk authorised exceptions first</caption>
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Area and issue</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Due</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleExceptions.map((item) => (
                  <tr key={item.id} data-severity={item.severity}>
                    <td>
                      <span className="admin-centre__status">{item.severity}</span>
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      <span>
                        {item.domain} · {item.detail}
                      </span>
                    </td>
                    <td>{item.owner ?? 'Unassigned'}</td>
                    <td>
                      {item.dueAt === undefined ? (
                        'No deadline'
                      ) : (
                        <time dateTime={item.dueAt}>{item.dueAt}</time>
                      )}
                    </td>
                    <td>
                      <a href={item.href}>Open record</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="admin-centre__split">
        <section className="admin-centre__section" aria-labelledby="admin-search-heading">
          <header>
            <h3 id="admin-search-heading">Governed search</h3>
            <p>Search results preserve tenant, campus, relationship and permission scope.</p>
          </header>
          <form className="admin-centre__search" action="/admin/search" method="get" role="search">
            <label htmlFor="admin-command-search">Search authorised school records</label>
            <div>
              <input
                id="admin-command-search"
                name="q"
                defaultValue={props.searchQuery}
                autoComplete="off"
              />
              <button type="submit">Search</button>
            </div>
            <small>Restricted record existence is not disclosed through results or counts.</small>
          </form>
          {props.searchQuery === undefined ||
          props.searchQuery.trim() === '' ? null : visibleSearchResults.length === 0 ? (
            <EmptyState
              title="No authorised results"
              detail="No matching record is available in your current scope."
            />
          ) : (
            <ol className="admin-centre__results">
              {visibleSearchResults.map((result) => (
                <li key={result.id}>
                  <a href={result.href}>{result.title}</a>
                  <span>
                    {result.category} · {result.scopeLabel}
                  </span>
                  <p>{result.description}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="admin-centre__section" aria-labelledby="admin-approvals-heading">
          <header>
            <h3 id="admin-approvals-heading">Approval queue</h3>
            <p>Assurance requirements are visible before an administrator opens the task.</p>
          </header>
          {visibleApprovals.length === 0 ? (
            <EmptyState
              title="No pending approvals"
              detail="Your authorised approval queue is clear."
            />
          ) : (
            <ol className="admin-centre__approvals">
              {visibleApprovals.map((approval) => (
                <li key={approval.id}>
                  <div>
                    <strong>{approval.subject}</strong>
                    <span>
                      {approval.kind} · requested by {approval.requestedBy}
                    </span>
                    <time dateTime={approval.requestedAt}>{approval.requestedAt}</time>
                  </div>
                  <a href={approval.href} data-assurance={approval.assurance}>
                    {approval.assurance === 'aal2' ? 'Verify and review' : 'Review'}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="admin-centre__section" aria-labelledby="admin-bulk-heading">
        <header>
          <h3 id="admin-bulk-heading">Bulk-operation readiness</h3>
          <p>Selections remain reviewable; blocked rows are never silently skipped.</p>
        </header>
        {visibleBulkOperations.length === 0 ? (
          <EmptyState
            title="No bulk operation is prepared"
            detail="Select authorised records from a domain workspace to prepare an operation."
          />
        ) : (
          <ul className="admin-centre__bulk">
            {visibleBulkOperations.map((operation) => {
              const blockedReasons = operation.blockedReasons ?? [];
              return (
                <li key={operation.id} data-ready={blockedReasons.length === 0 ? 'true' : 'false'}>
                  <div>
                    <strong>{operation.label}</strong>
                    <span>{operation.description}</span>
                    <small>
                      {new Intl.NumberFormat(props.locale).format(operation.selectedCount)} selected
                    </small>
                    {blockedReasons.length === 0 ? null : (
                      <ul aria-label={`${operation.label} blockers`}>
                        {blockedReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {blockedReasons.length === 0 ? (
                    <a href={operation.href}>Review operation</a>
                  ) : (
                    <span className="admin-centre__blocked">Resolve blockers first</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {props.children}
    </div>
  );
}
