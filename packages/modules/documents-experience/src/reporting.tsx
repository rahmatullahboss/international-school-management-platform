/*
THESIS: School reporting should expose reproducible evidence and authorised artifacts, not unexplained dashboard numbers.
OWN-WORLD: The Operational Ledger extends into as-of metrics, bounded report definitions, queued work and document access evidence.
STORY: A person sees only metrics, reports, jobs and documents in their tenant and principal scope, with provenance and the next permitted action attached.
FIRST VIEWPORT: Exceptions and data freshness lead; report definitions, job lifecycle and document availability follow in explicit ledgers.
FORM: Capability-filtered read models, idempotent report-job state and short-lived document grants without direct domain-table or object-key access.
*/
import type { ReactElement } from 'react';

export type ReportingPersona = 'admin' | 'teacher' | 'guardian' | 'student';
export type MetricState = 'stable' | 'attention' | 'exception';
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';
export type ReportJobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DocumentPublicationState = 'draft' | 'published' | 'revoked';
export type DocumentScanState = 'pending' | 'clean' | 'quarantined';
export type DocumentClassification = 'general' | 'personal' | 'restricted';

interface ReportingScope {
  readonly tenantId: string;
  readonly visibleToIds: readonly string[];
  readonly requiredCapability?: string;
}

export interface DashboardMetric extends ReportingScope {
  readonly id: string;
  readonly label: string;
  readonly valueLabel: string;
  readonly detail: string;
  readonly definitionLabel: string;
  readonly sourceLabel: string;
  readonly asOf: string;
  readonly state: MetricState;
  readonly drillDownHref: string;
}

export interface ReportCatalogItem extends ReportingScope {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly definitionVersion: string;
  readonly sourceLabel: string;
  readonly filters: readonly string[];
  readonly formats: readonly ReportFormat[];
  readonly formatCapabilities?: Readonly<Partial<Record<ReportFormat, string>>>;
  readonly maxRows: number;
  readonly runHref: string;
  readonly drillDownHref?: string;
}

export interface ReportJob extends ReportingScope {
  readonly id: string;
  readonly reportKey: string;
  readonly title: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly updatedAt: string;
  readonly format: ReportFormat;
  readonly state: ReportJobState;
  readonly progressPercent?: number;
  readonly rowCount?: number;
  readonly artifactId?: string;
  readonly downloadHref?: string;
  readonly failureReason?: string;
}

export interface DocumentArtifact extends ReportingScope {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly subjectLabel?: string;
  readonly classification: DocumentClassification;
  readonly publicationState: DocumentPublicationState;
  readonly scanState: DocumentScanState;
  readonly generatedAt: string;
  readonly expiresAt?: string;
  readonly checksumLabel?: string;
  readonly downloadHref?: string;
}

export interface DocumentDownloadGrant {
  readonly grantId: string;
  readonly tenantId: string;
  readonly documentId: string;
  readonly principalId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly downloadHref: string;
}

export type DocumentAccessErrorCode =
  | 'DOCUMENT_NOT_AUTHORISED'
  | 'DOCUMENT_NOT_PUBLISHED'
  | 'DOCUMENT_NOT_CLEAN'
  | 'DOCUMENT_EXPIRED'
  | 'DOCUMENT_DOWNLOAD_UNAVAILABLE'
  | 'DOCUMENT_INVALID_TTL';

export class DocumentAccessError extends Error {
  readonly code: DocumentAccessErrorCode;

  constructor(code: DocumentAccessErrorCode, message: string) {
    super(message);
    this.name = 'DocumentAccessError';
    this.code = code;
  }
}

export interface ReportDefinition {
  readonly tenantId: string;
  readonly key: string;
  readonly title: string;
  readonly requiredCapability: string;
  readonly formats: readonly ReportFormat[];
  readonly formatCapabilities?: Readonly<Partial<Record<ReportFormat, string>>>;
  readonly maxRows: number;
}

export interface ReportJobContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly capabilities: readonly string[];
}

export interface SubmitReportJobInput {
  readonly reportKey: string;
  readonly format: ReportFormat;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
}

export interface CompleteReportJobInput {
  readonly tenantId: string;
  readonly jobId: string;
  readonly completedAt: string;
  readonly rowCount: number;
  readonly artifactId: string;
  readonly downloadHref: string;
}

export interface DocumentsReportingWorkspaceProps {
  readonly tenantId: string;
  readonly persona: ReportingPersona;
  readonly principalId: string;
  readonly schoolName: string;
  readonly locale: string;
  readonly capabilities: readonly string[];
  readonly asOf?: string;
  readonly metrics: readonly DashboardMetric[];
  readonly reports: readonly ReportCatalogItem[];
  readonly jobs: readonly ReportJob[];
  readonly documents: readonly DocumentArtifact[];
  readonly state?: 'ready' | 'loading' | 'error';
  readonly errorMessage?: string;
  readonly retryHref?: string;
}

const metricOrder: Readonly<Record<MetricState, number>> = {
  exception: 0,
  attention: 1,
  stable: 2,
};

const jobOrder: Readonly<Record<ReportJobState, number>> = {
  running: 0,
  queued: 1,
  failed: 2,
  completed: 3,
  cancelled: 4,
};

const jobLabels: Readonly<Record<ReportJobState, string>> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function hasCapability(capabilities: readonly string[], requiredCapability?: string): boolean {
  return requiredCapability === undefined || capabilities.includes(requiredCapability);
}

function isVisible(
  scope: ReportingScope,
  tenantId: string,
  principalId: string,
  capabilities: readonly string[],
): boolean {
  return (
    scope.tenantId === tenantId &&
    scope.visibleToIds.includes(principalId) &&
    hasCapability(capabilities, scope.requiredCapability)
  );
}

export function selectReportingRecords<T extends ReportingScope>(
  records: readonly T[],
  tenantId: string,
  principalId: string,
  capabilities: readonly string[],
): T[] {
  return records.filter((record) => isVisible(record, tenantId, principalId, capabilities));
}

export function availableReportFormats(
  report: Pick<ReportCatalogItem, 'formats' | 'formatCapabilities'>,
  capabilities: readonly string[],
): ReportFormat[] {
  return report.formats.filter((format) =>
    hasCapability(capabilities, report.formatCapabilities?.[format]),
  );
}

function parseTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return parsed;
}

function documentAvailability(
  document: DocumentArtifact,
  at: string,
): { readonly ready: boolean; readonly label: string } {
  if (document.publicationState === 'revoked') return { ready: false, label: 'Revoked' };
  if (document.publicationState !== 'published') return { ready: false, label: 'Not published' };
  if (document.scanState === 'quarantined') return { ready: false, label: 'Quarantined' };
  if (document.scanState !== 'clean') return { ready: false, label: 'Security scan pending' };
  if (
    document.expiresAt !== undefined &&
    parseTimestamp(document.expiresAt, 'document.expiresAt') <= parseTimestamp(at, 'at')
  ) {
    return { ready: false, label: 'Expired' };
  }
  if (document.downloadHref === undefined) return { ready: false, label: 'Download unavailable' };
  return { ready: true, label: 'Ready to download' };
}

export class DocumentAccessBroker {
  authorize(input: {
    readonly tenantId: string;
    readonly principalId: string;
    readonly capabilities: readonly string[];
    readonly document: DocumentArtifact;
    readonly requestedAt: string;
    readonly ttlSeconds: number;
  }): DocumentDownloadGrant {
    if (!isVisible(input.document, input.tenantId, input.principalId, input.capabilities)) {
      throw new DocumentAccessError(
        'DOCUMENT_NOT_AUTHORISED',
        'Document is outside the current tenant, principal or capability scope',
      );
    }
    if (input.document.publicationState !== 'published') {
      throw new DocumentAccessError('DOCUMENT_NOT_PUBLISHED', 'Document is not published');
    }
    if (input.document.scanState !== 'clean') {
      throw new DocumentAccessError(
        'DOCUMENT_NOT_CLEAN',
        'Document has not passed security scanning',
      );
    }

    const requestedAt = parseTimestamp(input.requestedAt, 'requestedAt');
    if (
      input.document.expiresAt !== undefined &&
      parseTimestamp(input.document.expiresAt, 'document.expiresAt') <= requestedAt
    ) {
      throw new DocumentAccessError('DOCUMENT_EXPIRED', 'Document is expired');
    }
    if (input.document.downloadHref === undefined) {
      throw new DocumentAccessError(
        'DOCUMENT_DOWNLOAD_UNAVAILABLE',
        'Document download is unavailable',
      );
    }
    if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 30 || input.ttlSeconds > 900) {
      throw new DocumentAccessError(
        'DOCUMENT_INVALID_TTL',
        'Document grant TTL must be between 30 and 900 seconds',
      );
    }

    const grantId = crypto.randomUUID();
    return Object.freeze({
      grantId,
      tenantId: input.tenantId,
      documentId: input.document.id,
      principalId: input.principalId,
      issuedAt: new Date(requestedAt).toISOString(),
      expiresAt: new Date(requestedAt + input.ttlSeconds * 1_000).toISOString(),
      downloadHref: `/documents/download/${grantId}`,
    });
  }
}

function cloneJob(job: ReportJob): Readonly<ReportJob> {
  return Object.freeze({ ...job, visibleToIds: Object.freeze([...job.visibleToIds]) });
}

export class ReportJobQueue {
  readonly #definitions = new Map<string, ReportDefinition>();
  readonly #jobs = new Map<string, Readonly<ReportJob>>();
  readonly #idempotency = new Map<string, string>();

  constructor(definitions: readonly ReportDefinition[]) {
    for (const definition of definitions) {
      const key = `${definition.tenantId}:${definition.key}`;
      if (this.#definitions.has(key)) throw new Error(`Duplicate report definition ${key}`);
      if (!Number.isInteger(definition.maxRows) || definition.maxRows < 1) {
        throw new Error('Report definition maxRows must be a positive integer');
      }
      this.#definitions.set(key, Object.freeze({ ...definition }));
    }
  }

  submit(context: ReportJobContext, input: SubmitReportJobInput): Readonly<ReportJob> {
    const definition = this.#requireDefinition(context.tenantId, input.reportKey);
    if (!context.capabilities.includes(definition.requiredCapability)) {
      throw new Error('REPORT_NOT_AUTHORISED');
    }
    if (!definition.formats.includes(input.format)) throw new Error('REPORT_FORMAT_NOT_SUPPORTED');
    const formatCapability = definition.formatCapabilities?.[input.format];
    if (formatCapability !== undefined && !context.capabilities.includes(formatCapability)) {
      throw new Error('REPORT_FORMAT_NOT_AUTHORISED');
    }
    if (!input.idempotencyKey.trim()) throw new Error('REPORT_IDEMPOTENCY_KEY_REQUIRED');
    parseTimestamp(input.requestedAt, 'requestedAt');

    const retryKey = `${context.tenantId}:${context.principalId}:${input.reportKey}:${input.idempotencyKey}`;
    const existingId = this.#idempotency.get(retryKey);
    if (existingId !== undefined) return this.snapshot(context.tenantId, existingId);

    const id = crypto.randomUUID();
    const job: ReportJob = {
      id,
      tenantId: context.tenantId,
      visibleToIds: [context.principalId],
      requiredCapability: definition.requiredCapability,
      reportKey: definition.key,
      title: definition.title,
      requestedBy: context.principalId,
      requestedAt: input.requestedAt,
      updatedAt: input.requestedAt,
      format: input.format,
      state: 'queued',
      progressPercent: 0,
    };
    this.#jobs.set(id, cloneJob(job));
    this.#idempotency.set(retryKey, id);
    return cloneJob(job);
  }

  start(tenantId: string, jobId: string, startedAt: string): Readonly<ReportJob> {
    const job = this.#requireJob(tenantId, jobId);
    if (job.state !== 'queued') throw new Error('REPORT_JOB_NOT_QUEUED');
    parseTimestamp(startedAt, 'startedAt');
    const next: ReportJob = { ...job, state: 'running', progressPercent: 1, updatedAt: startedAt };
    this.#jobs.set(jobId, cloneJob(next));
    return cloneJob(next);
  }

  recordProgress(
    tenantId: string,
    jobId: string,
    progressPercent: number,
    updatedAt: string,
  ): Readonly<ReportJob> {
    const job = this.#requireJob(tenantId, jobId);
    if (job.state !== 'running') throw new Error('REPORT_JOB_NOT_RUNNING');
    if (!Number.isInteger(progressPercent) || progressPercent < 1 || progressPercent > 99) {
      throw new Error('REPORT_PROGRESS_OUT_OF_RANGE');
    }
    parseTimestamp(updatedAt, 'updatedAt');
    const next: ReportJob = { ...job, progressPercent, updatedAt };
    this.#jobs.set(jobId, cloneJob(next));
    return cloneJob(next);
  }

  complete(input: CompleteReportJobInput): Readonly<ReportJob> {
    const job = this.#requireJob(input.tenantId, input.jobId);
    if (job.state !== 'running') throw new Error('REPORT_JOB_NOT_RUNNING');
    const definition = this.#requireDefinition(input.tenantId, job.reportKey);
    if (!Number.isInteger(input.rowCount) || input.rowCount < 0) {
      throw new Error('REPORT_ROW_COUNT_INVALID');
    }
    if (input.rowCount > definition.maxRows) throw new Error('REPORT_ROW_LIMIT_EXCEEDED');
    if (!input.artifactId.trim() || !input.downloadHref.trim()) {
      throw new Error('REPORT_ARTIFACT_REQUIRED');
    }
    parseTimestamp(input.completedAt, 'completedAt');
    const next: ReportJob = {
      ...job,
      state: 'completed',
      progressPercent: 100,
      rowCount: input.rowCount,
      artifactId: input.artifactId,
      downloadHref: input.downloadHref,
      updatedAt: input.completedAt,
    };
    this.#jobs.set(input.jobId, cloneJob(next));
    return cloneJob(next);
  }

  fail(
    tenantId: string,
    jobId: string,
    failedAt: string,
    failureReason: string,
  ): Readonly<ReportJob> {
    const job = this.#requireJob(tenantId, jobId);
    if (job.state !== 'queued' && job.state !== 'running') {
      throw new Error('REPORT_JOB_TERMINAL');
    }
    if (!failureReason.trim()) throw new Error('REPORT_FAILURE_REASON_REQUIRED');
    parseTimestamp(failedAt, 'failedAt');
    const next: ReportJob = {
      ...job,
      state: 'failed',
      failureReason,
      updatedAt: failedAt,
    };
    this.#jobs.set(jobId, cloneJob(next));
    return cloneJob(next);
  }

  snapshot(tenantId: string, jobId: string): Readonly<ReportJob> {
    return cloneJob(this.#requireJob(tenantId, jobId));
  }

  #requireDefinition(tenantId: string, reportKey: string): ReportDefinition {
    const definition = this.#definitions.get(`${tenantId}:${reportKey}`);
    if (definition === undefined) throw new Error('REPORT_DEFINITION_NOT_FOUND');
    return definition;
  }

  #requireJob(tenantId: string, jobId: string): Readonly<ReportJob> {
    const job = this.#jobs.get(jobId);
    if (job === undefined || job.tenantId !== tenantId) throw new Error('REPORT_JOB_NOT_FOUND');
    return job;
  }
}

function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatTimestamp(locale: string, value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function EmptyState(props: { readonly title: string; readonly detail: string }): ReactElement {
  return (
    <div className="reporting-empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

function WorkspaceState(props: {
  readonly title: string;
  readonly detail: string;
  readonly role?: 'status' | 'alert';
  readonly retryHref?: string | undefined;
}): ReactElement {
  return (
    <section className="reporting-state" role={props.role ?? 'status'}>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
      {props.retryHref === undefined ? null : <a href={props.retryHref}>Try again</a>}
    </section>
  );
}

export function DocumentsReportingWorkspace(props: DocumentsReportingWorkspaceProps): ReactElement {
  if (props.state === 'loading') {
    return (
      <WorkspaceState
        title="Preparing documents and reports"
        detail="Loading authorised metrics, report definitions, queued jobs and document evidence."
      />
    );
  }
  if (props.state === 'error') {
    return (
      <WorkspaceState
        role="alert"
        title="Documents and reports could not be loaded"
        detail={
          props.errorMessage ??
          'No report was submitted and no document grant was issued. Existing jobs are unchanged.'
        }
        retryHref={props.retryHref}
      />
    );
  }

  const metrics = selectReportingRecords(
    props.metrics,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => {
    const stateDifference = metricOrder[left.state] - metricOrder[right.state];
    if (stateDifference !== 0) return stateDifference;
    return left.label.localeCompare(right.label);
  });
  const reports = selectReportingRecords(
    props.reports,
    props.tenantId,
    props.principalId,
    props.capabilities,
  )
    .map((report) => ({ report, formats: availableReportFormats(report, props.capabilities) }))
    .filter(({ formats }) => formats.length > 0)
    .sort((left, right) => left.report.title.localeCompare(right.report.title));
  const jobs = selectReportingRecords(
    props.jobs,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => {
    const stateDifference = jobOrder[left.state] - jobOrder[right.state];
    if (stateDifference !== 0) return stateDifference;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  const documents = selectReportingRecords(
    props.documents,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

  const currentTimestamp = props.asOf ?? new Date().toISOString();
  const attentionCount = metrics.filter((metric) => metric.state !== 'stable').length;
  const activeJobCount = jobs.filter(
    (job) => job.state === 'queued' || job.state === 'running',
  ).length;
  const readyDocumentCount = documents.filter(
    (document) => documentAvailability(document, currentTimestamp).ready,
  ).length;

  return (
    <div className="reporting-workspace" data-persona={props.persona}>
      <header className="reporting-masthead">
        <div>
          <p>Evidence and document ledger</p>
          <h2>{props.schoolName}</h2>
          <span>
            Reproducible metrics, bounded reports, queued work and authorised documents with
            explicit provenance.
          </span>
        </div>
        <dl aria-label="Reporting summary">
          <div>
            <dt>Metrics needing attention</dt>
            <dd>{formatNumber(props.locale, attentionCount)}</dd>
          </div>
          <div>
            <dt>Active report jobs</dt>
            <dd>{formatNumber(props.locale, activeJobCount)}</dd>
          </div>
          <div>
            <dt>Documents ready</dt>
            <dd>{formatNumber(props.locale, readyDocumentCount)}</dd>
          </div>
        </dl>
      </header>

      <section className="reporting-section" aria-labelledby="reporting-metrics">
        <header>
          <h3 id="reporting-metrics">Governed dashboard</h3>
          <p>Every value names its definition, source, as-of time and authorised drill-down.</p>
        </header>
        {metrics.length === 0 ? (
          <EmptyState
            title="No authorised metrics"
            detail="No dashboard definition is available in this scope."
          />
        ) : (
          <ol className="reporting-metrics">
            {metrics.map((metric) => (
              <li key={metric.id} data-state={metric.state}>
                <div>
                  <span>{metric.state}</span>
                  <time dateTime={metric.asOf}>
                    As of {formatTimestamp(props.locale, metric.asOf)}
                  </time>
                </div>
                <h4>{metric.label}</h4>
                <strong>{metric.valueLabel}</strong>
                <p>{metric.detail}</p>
                <dl>
                  <div>
                    <dt>Definition</dt>
                    <dd>{metric.definitionLabel}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{metric.sourceLabel}</dd>
                  </div>
                </dl>
                <a href={metric.drillDownHref}>Open governed drill-down</a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="reporting-section" aria-labelledby="reporting-catalog">
        <header>
          <h3 id="reporting-catalog">Standard report catalog</h3>
          <p>Definitions are versioned, row-bounded and limited to authorised output formats.</p>
        </header>
        {reports.length === 0 ? (
          <EmptyState
            title="No runnable reports"
            detail="No report definition and output format are authorised in this scope."
          />
        ) : (
          <ol className="reporting-catalog">
            {reports.map(({ report, formats }) => (
              <li key={report.key}>
                <div>
                  <h4>{report.title}</h4>
                  <span>Definition {report.definitionVersion}</span>
                </div>
                <p>{report.description}</p>
                <dl>
                  <div>
                    <dt>Source</dt>
                    <dd>{report.sourceLabel}</dd>
                  </div>
                  <div>
                    <dt>Filters</dt>
                    <dd>{report.filters.join(' · ') || 'No configurable filters'}</dd>
                  </div>
                  <div>
                    <dt>Formats</dt>
                    <dd>{formats.join(' · ')}</dd>
                  </div>
                  <div>
                    <dt>Maximum rows</dt>
                    <dd>{formatNumber(props.locale, report.maxRows)}</dd>
                  </div>
                </dl>
                <footer>
                  <a href={report.runHref}>Configure and run</a>
                  {report.drillDownHref === undefined ? null : (
                    <a href={report.drillDownHref}>Open live drill-down</a>
                  )}
                </footer>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="reporting-section" aria-labelledby="reporting-jobs">
        <header>
          <h3 id="reporting-jobs">Asynchronous report jobs</h3>
          <p>Queued, running and terminal states remain visible without duplicate submissions.</p>
        </header>
        {jobs.length === 0 ? (
          <EmptyState title="No report jobs" detail="No authorised report job is available." />
        ) : (
          <div
            className="reporting-table"
            role="region"
            aria-label="Report job status"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col">Format</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} data-state={job.state}>
                    <th scope="row">{job.title}</th>
                    <td>{job.format}</td>
                    <td>
                      <strong>{jobLabels[job.state]}</strong>
                      {job.progressPercent === undefined ? null : (
                        <span>{formatNumber(props.locale, job.progressPercent)}%</span>
                      )}
                      {job.failureReason === undefined ? null : <small>{job.failureReason}</small>}
                    </td>
                    <td>
                      <time dateTime={job.updatedAt}>
                        {formatTimestamp(props.locale, job.updatedAt)}
                      </time>
                    </td>
                    <td>
                      {job.state === 'completed' && job.downloadHref !== undefined ? (
                        <a href={job.downloadHref}>
                          Download {formatNumber(props.locale, job.rowCount ?? 0)} rows
                        </a>
                      ) : (
                        <span>Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="reporting-section" aria-labelledby="reporting-documents">
        <header>
          <h3 id="reporting-documents">Authorised documents</h3>
          <p>Publication, security scanning, expiry and classification determine availability.</p>
        </header>
        {documents.length === 0 ? (
          <EmptyState
            title="No authorised documents"
            detail="No document artifact is available in this scope."
          />
        ) : (
          <ol className="reporting-documents">
            {documents.map((document) => {
              const availability = documentAvailability(document, currentTimestamp);
              return (
                <li key={document.id} data-ready={availability.ready ? 'true' : 'false'}>
                  <div>
                    <span>{document.classification}</span>
                    <strong>{availability.label}</strong>
                  </div>
                  <h4>{document.title}</h4>
                  <p>
                    {document.category}
                    {document.subjectLabel === undefined ? '' : ` · ${document.subjectLabel}`}
                  </p>
                  <dl>
                    <div>
                      <dt>Generated</dt>
                      <dd>
                        <time dateTime={document.generatedAt}>
                          {formatTimestamp(props.locale, document.generatedAt)}
                        </time>
                      </dd>
                    </div>
                    {document.expiresAt === undefined ? null : (
                      <div>
                        <dt>Expires</dt>
                        <dd>
                          <time dateTime={document.expiresAt}>
                            {formatTimestamp(props.locale, document.expiresAt)}
                          </time>
                        </dd>
                      </div>
                    )}
                    {document.checksumLabel === undefined ? null : (
                      <div>
                        <dt>Evidence</dt>
                        <dd>{document.checksumLabel}</dd>
                      </div>
                    )}
                  </dl>
                  {availability.ready && document.downloadHref !== undefined ? (
                    <a href={document.downloadHref}>Request secure download</a>
                  ) : (
                    <span>No download can be issued</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
