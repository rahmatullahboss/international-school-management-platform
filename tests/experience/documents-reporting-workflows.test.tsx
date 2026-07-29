import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  availableReportFormats,
  DocumentAccessBroker,
  DocumentsReportingWorkspace,
  ReportJobQueue,
  selectReportingRecords,
  type DocumentAccessError,
  type DocumentArtifact,
  type DocumentsReportingWorkspaceProps,
  type ReportDefinition,
} from '../../packages/modules/documents-experience/src/reporting';

const reportDefinitions: readonly ReportDefinition[] = [
  {
    tenantId: 'tenant-1',
    key: 'attendance-readiness',
    title: 'Attendance readiness',
    requiredCapability: 'reports.read',
    formats: ['csv', 'xlsx', 'pdf'],
    formatCapabilities: { pdf: 'reports.export.pdf' },
    maxRows: 100,
  },
  {
    tenantId: 'tenant-2',
    key: 'attendance-readiness',
    title: 'Other tenant attendance',
    requiredCapability: 'reports.read',
    formats: ['csv'],
    maxRows: 10,
  },
];

const readyDocument: DocumentArtifact = {
  id: 'document-ready',
  tenantId: 'tenant-1',
  visibleToIds: ['admin-1'],
  requiredCapability: 'documents.read',
  title: 'Term attendance evidence',
  category: 'Attendance evidence',
  classification: 'personal',
  publicationState: 'published',
  scanState: 'clean',
  generatedAt: '2026-07-29T08:00:00+06:00',
  expiresAt: '2026-12-31T23:59:00+06:00',
  checksumLabel: 'SHA-256 verified',
  downloadHref: '/admin/documents/document-ready/request',
};

const base: DocumentsReportingWorkspaceProps = {
  tenantId: 'tenant-1',
  persona: 'admin',
  principalId: 'admin-1',
  schoolName: 'International Community School',
  locale: 'en-GB',
  capabilities: ['reports.read', 'documents.read'],
  asOf: '2026-07-29T12:00:00+06:00',
  metrics: [
    {
      id: 'metric-attendance',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'reports.read',
      label: 'Registers awaiting finalisation',
      valueLabel: '3',
      detail: 'Three registers are open after the scheduled close time.',
      definitionLabel: 'Open register after timetable end v2',
      sourceLabel: 'Attendance published read model',
      asOf: '2026-07-29T11:45:00+06:00',
      state: 'exception',
      drillDownHref: '/admin/reports/attendance/open-registers',
    },
    {
      id: 'metric-restricted',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'care.report.read',
      label: 'Restricted care metric',
      valueLabel: '1',
      detail: 'Must not render.',
      definitionLabel: 'Restricted',
      sourceLabel: 'Restricted source',
      asOf: '2026-07-29T11:50:00+06:00',
      state: 'attention',
      drillDownHref: '/admin/reports/restricted',
    },
    {
      id: 'metric-other-tenant',
      tenantId: 'tenant-2',
      visibleToIds: ['admin-1'],
      label: 'Other tenant metric',
      valueLabel: '99',
      detail: 'Must not render.',
      definitionLabel: 'Other tenant',
      sourceLabel: 'Other tenant source',
      asOf: '2026-07-29T11:55:00+06:00',
      state: 'exception',
      drillDownHref: '/other',
    },
  ],
  reports: [
    {
      key: 'attendance-readiness',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'reports.read',
      title: 'Attendance readiness report',
      description: 'Reproducible register readiness and exception evidence.',
      definitionVersion: '2.1.0',
      sourceLabel: 'Attendance published read model',
      filters: ['Campus', 'Date range', 'Year group'],
      formats: ['csv', 'pdf'],
      formatCapabilities: { pdf: 'reports.export.pdf' },
      maxRows: 50_000,
      runHref: '/admin/reports/attendance/configure',
      drillDownHref: '/admin/reports/attendance/live',
    },
    {
      key: 'restricted-care',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'care.report.read',
      title: 'Restricted care report',
      description: 'Must not render.',
      definitionVersion: '1.0.0',
      sourceLabel: 'Restricted source',
      filters: [],
      formats: ['pdf'],
      maxRows: 100,
      runHref: '/admin/reports/restricted',
    },
  ],
  jobs: [
    {
      id: 'job-running',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'reports.read',
      reportKey: 'attendance-readiness',
      title: 'Attendance readiness report',
      requestedBy: 'admin-1',
      requestedAt: '2026-07-29T10:00:00+06:00',
      updatedAt: '2026-07-29T10:05:00+06:00',
      format: 'csv',
      state: 'running',
      progressPercent: 65,
    },
    {
      id: 'job-other-principal',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-2'],
      requiredCapability: 'reports.read',
      reportKey: 'attendance-readiness',
      title: 'Another principal report',
      requestedBy: 'admin-2',
      requestedAt: '2026-07-29T09:00:00+06:00',
      updatedAt: '2026-07-29T09:05:00+06:00',
      format: 'csv',
      state: 'completed',
      rowCount: 10,
      downloadHref: '/admin/reports/jobs/other/download',
    },
  ],
  documents: [
    readyDocument,
    {
      id: 'document-pending',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'documents.read',
      title: 'Enrollment evidence bundle',
      category: 'Enrollment evidence',
      classification: 'personal',
      publicationState: 'published',
      scanState: 'pending',
      generatedAt: '2026-07-29T09:00:00+06:00',
      downloadHref: '/admin/documents/document-pending/request',
    },
    {
      id: 'document-revoked',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'documents.read',
      title: 'Revoked transcript copy',
      category: 'Transcript',
      classification: 'personal',
      publicationState: 'revoked',
      scanState: 'clean',
      generatedAt: '2026-07-28T09:00:00+06:00',
      downloadHref: '/admin/documents/document-revoked/request',
    },
    {
      id: 'document-restricted',
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'documents.restricted.read',
      title: 'Restricted support document',
      category: 'Restricted',
      classification: 'restricted',
      publicationState: 'published',
      scanState: 'clean',
      generatedAt: '2026-07-29T09:30:00+06:00',
      downloadHref: '/admin/documents/restricted/request',
    },
    {
      id: 'document-other-tenant',
      tenantId: 'tenant-2',
      visibleToIds: ['admin-1'],
      title: 'Other tenant document',
      category: 'Other tenant',
      classification: 'general',
      publicationState: 'published',
      scanState: 'clean',
      generatedAt: '2026-07-29T10:00:00+06:00',
      downloadHref: '/other/document',
    },
  ],
};

describe('EXP-01 documents and reporting experience', () => {
  it('filters metrics, reports, jobs and documents before counting or rendering', () => {
    const visible = selectReportingRecords(base.documents, 'tenant-1', 'admin-1', [
      'documents.read',
    ]);
    expect(visible.map((document) => document.id)).toEqual([
      'document-ready',
      'document-pending',
      'document-revoked',
    ]);
  });

  it('filters report formats by format-level capability', () => {
    const report = base.reports[0]!;
    expect(availableReportFormats(report, ['reports.read'])).toEqual(['csv']);
    expect(availableReportFormats(report, ['reports.read', 'reports.export.pdf'])).toEqual([
      'csv',
      'pdf',
    ]);
  });

  it('issues short-lived document grants only after scope, publication and scan checks', () => {
    const broker = new DocumentAccessBroker();
    const grant = broker.authorize({
      tenantId: 'tenant-1',
      principalId: 'admin-1',
      capabilities: ['documents.read'],
      document: readyDocument,
      requestedAt: '2026-07-29T12:00:00+06:00',
      ttlSeconds: 120,
    });

    expect(grant).toMatchObject({
      tenantId: 'tenant-1',
      documentId: 'document-ready',
      principalId: 'admin-1',
      issuedAt: '2026-07-29T06:00:00.000Z',
      expiresAt: '2026-07-29T06:02:00.000Z',
    });
    expect(grant.downloadHref).toMatch(/^\/documents\/download\/[0-9a-f-]+$/u);
    expect(grant.downloadHref).not.toContain(readyDocument.downloadHref!);

    expect(() =>
      broker.authorize({
        tenantId: 'tenant-1',
        principalId: 'admin-2',
        capabilities: ['documents.read'],
        document: readyDocument,
        requestedAt: '2026-07-29T12:00:00+06:00',
        ttlSeconds: 120,
      }),
    ).toThrowError(
      expect.objectContaining<DocumentAccessError>({ code: 'DOCUMENT_NOT_AUTHORISED' }),
    );

    expect(() =>
      broker.authorize({
        tenantId: 'tenant-1',
        principalId: 'admin-1',
        capabilities: ['documents.read'],
        document: { ...readyDocument, scanState: 'pending' },
        requestedAt: '2026-07-29T12:00:00+06:00',
        ttlSeconds: 120,
      }),
    ).toThrowError(expect.objectContaining<DocumentAccessError>({ code: 'DOCUMENT_NOT_CLEAN' }));
  });

  it('submits report jobs idempotently and enforces formats, lifecycle and row bounds', () => {
    const queue = new ReportJobQueue(reportDefinitions);
    const context = {
      tenantId: 'tenant-1',
      principalId: 'admin-1',
      capabilities: ['reports.read'],
    };
    const first = queue.submit(context, {
      reportKey: 'attendance-readiness',
      format: 'xlsx',
      idempotencyKey: 'attendance-july',
      requestedAt: '2026-07-29T10:00:00+06:00',
    });
    const retry = queue.submit(context, {
      reportKey: 'attendance-readiness',
      format: 'xlsx',
      idempotencyKey: 'attendance-july',
      requestedAt: '2026-07-29T10:00:00+06:00',
    });
    expect(retry.id).toBe(first.id);

    queue.start('tenant-1', first.id, '2026-07-29T10:01:00+06:00');
    queue.recordProgress('tenant-1', first.id, 55, '2026-07-29T10:02:00+06:00');
    const completed = queue.complete({
      tenantId: 'tenant-1',
      jobId: first.id,
      completedAt: '2026-07-29T10:03:00+06:00',
      rowCount: 100,
      artifactId: 'artifact-attendance-july',
      downloadHref: '/admin/reports/jobs/attendance-july/download',
    });
    expect(completed).toMatchObject({ state: 'completed', progressPercent: 100, rowCount: 100 });

    expect(() =>
      queue.submit(context, {
        reportKey: 'attendance-readiness',
        format: 'pdf',
        idempotencyKey: 'attendance-pdf',
        requestedAt: '2026-07-29T10:04:00+06:00',
      }),
    ).toThrow('REPORT_FORMAT_NOT_AUTHORISED');
    expect(() => queue.snapshot('tenant-2', first.id)).toThrow('REPORT_JOB_NOT_FOUND');
  });

  it('blocks report completion beyond the definition row limit', () => {
    const queue = new ReportJobQueue(reportDefinitions);
    const job = queue.submit(
      {
        tenantId: 'tenant-1',
        principalId: 'admin-1',
        capabilities: ['reports.read'],
      },
      {
        reportKey: 'attendance-readiness',
        format: 'csv',
        idempotencyKey: 'attendance-too-large',
        requestedAt: '2026-07-29T10:00:00+06:00',
      },
    );
    queue.start('tenant-1', job.id, '2026-07-29T10:01:00+06:00');
    expect(() =>
      queue.complete({
        tenantId: 'tenant-1',
        jobId: job.id,
        completedAt: '2026-07-29T10:02:00+06:00',
        rowCount: 101,
        artifactId: 'artifact-too-large',
        downloadHref: '/admin/reports/jobs/too-large/download',
      }),
    ).toThrow('REPORT_ROW_LIMIT_EXCEEDED');
  });

  it('renders provenance, authorised formats, job state and document availability without leakage', () => {
    const markup = renderToStaticMarkup(<DocumentsReportingWorkspace {...base} />);

    expect(markup).toContain('Registers awaiting finalisation');
    expect(markup).toContain('Open register after timetable end v2');
    expect(markup).toContain('Attendance published read model');
    expect(markup).not.toContain('Restricted care metric');
    expect(markup).not.toContain('Other tenant metric');
    expect(markup).toContain('Attendance readiness report');
    expect(markup).toContain('<dd>csv</dd>');
    expect(markup).not.toContain('<dd>csv · pdf</dd>');
    expect(markup).not.toContain('Restricted care report');
    expect(markup).toContain('65%');
    expect(markup).not.toContain('Another principal report');
    expect(markup).toContain('Term attendance evidence');
    expect(markup).toContain('Request secure download');
    expect(markup).toContain('Enrollment evidence bundle');
    expect(markup).toContain('Security scan pending');
    expect(markup).toContain('Revoked transcript copy');
    expect(markup).toContain('Revoked');
    expect(markup).not.toContain('Restricted support document');
    expect(markup).not.toContain('Other tenant document');
    expect(markup).not.toContain('tenants/tenant-1');
  });

  it('keeps loading and recoverable failure states non-mutating', () => {
    const loading = renderToStaticMarkup(<DocumentsReportingWorkspace {...base} state="loading" />);
    const error = renderToStaticMarkup(
      <DocumentsReportingWorkspace
        {...base}
        state="error"
        errorMessage="Existing report jobs and document grants are unchanged."
        retryHref="/admin/reports?retry=1"
      />,
    );

    expect(loading).toContain('Preparing documents and reports');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Existing report jobs and document grants are unchanged.');
    expect(error).toContain('href="/admin/reports?retry=1"');
  });
});
