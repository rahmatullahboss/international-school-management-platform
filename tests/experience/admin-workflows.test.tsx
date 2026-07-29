import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AdminOperationsHome,
  AdminRecordWorkspace,
  selectAdminBulkActions,
  selectAdminExceptions,
  selectAdminSearchResults,
  type AdminExceptionItem,
} from '../../apps/web-admin/src/features/experience/AdminOperationsHome';

const source = {
  label: 'Attendance readiness report',
  href: '/admin/reports/attendance',
  updatedAt: '2026-07-29T15:00:00+06:00',
};

const exceptions: readonly AdminExceptionItem[] = [
  {
    id: 'attendance-1',
    area: 'Attendance',
    title: 'Three registers are not finalised',
    summary: 'Assigned classes remain open after the daily cut-off.',
    severity: 'warning',
    status: 'Open',
    href: '/admin/academics/attendance/exceptions',
    source,
    dueAt: '2026-07-29T16:00:00+06:00',
    capability: 'attendance.manage',
    bulkGroup: 'attendance-finalisation',
    bulkCapability: 'attendance.bulk-remind',
  },
  {
    id: 'care-1',
    area: 'Student support',
    title: 'Restricted student support task',
    summary: 'Open in the restricted workspace after identity verification.',
    severity: 'critical',
    status: 'Restricted',
    href: '/admin/student-support/restricted',
    source: {
      label: 'Restricted workflow projection',
      href: '/admin/student-support/reports/restricted-readiness',
      updatedAt: '2026-07-29T15:02:00+06:00',
    },
    capability: 'care.restricted.read',
    requiredAssurance: 'aal2',
  },
];

describe('EXP-01 admin experience', () => {
  it('filters before sorting so unauthorized restricted work never reaches the view', () => {
    expect(selectAdminExceptions(exceptions, ['attendance.manage']).map((item) => item.id)).toEqual(
      ['attendance-1'],
    );
    expect(
      selectAdminExceptions(exceptions, ['attendance.manage', 'care.restricted.read']).map(
        (item) => item.id,
      ),
    ).toEqual(['care-1', 'attendance-1']);
  });

  it('filters governed search results before rendering labels or counts', () => {
    const results = selectAdminSearchResults(
      [
        {
          id: 'student-1',
          kind: 'Student',
          label: 'Samira Noor',
          context: 'Year 8',
          href: '/admin/students/1',
          capability: 'student.read',
        },
        {
          id: 'case-1',
          kind: 'Safeguarding case',
          label: 'Restricted case 1',
          context: 'Purpose-bound access',
          href: '/admin/student-support/cases/1',
          capability: 'safeguarding.case.read',
        },
      ],
      ['student.read'],
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('Samira Noor');
  });

  it('offers bulk operations only when every selected row belongs to one permitted group', () => {
    const actions = [
      {
        id: 'remind',
        label: 'Send reminder',
        group: 'attendance-finalisation',
        capability: 'attendance.bulk-remind',
        href: '/admin/attendance/bulk-remind',
      },
    ];

    expect(
      selectAdminBulkActions(actions, exceptions, ['attendance-1'], ['attendance.bulk-remind']),
    ).toHaveLength(1);
    expect(
      selectAdminBulkActions(actions, exceptions, ['care-1'], ['attendance.bulk-remind']),
    ).toEqual([]);
  });

  it('renders evidence-backed queues, approvals, step-up state and capability-scoped search', () => {
    const markup = renderToStaticMarkup(
      <AdminOperationsHome
        approvals={[
          {
            id: 'approval-1',
            title: 'Approve transcript correction',
            requestor: 'Records office',
            submittedAt: '2026-07-29T14:30:00+06:00',
            stage: 'Principal approval',
            href: '/admin/approvals/1',
            capability: 'records.approve',
            requiredAssurance: 'aal2',
          },
        ]}
        asOf="2026-07-29T15:05:00+06:00"
        assurance="aal1"
        bulkActions={[
          {
            id: 'remind',
            label: 'Send reminder',
            group: 'attendance-finalisation',
            capability: 'attendance.bulk-remind',
            href: '/admin/attendance/bulk-remind',
          },
        ]}
        campusName="Main Campus"
        capabilities={[
          'attendance.manage',
          'attendance.bulk-remind',
          'care.restricted.read',
          'records.approve',
          'student.read',
        ]}
        exceptions={exceptions}
        locale="en-BD"
        metrics={[
          {
            id: 'attendance',
            label: 'Registers ready',
            value: 41,
            definition: 'Finalised registers in today’s scheduled sessions.',
            tone: 'warning',
            source,
            capability: 'attendance.manage',
          },
          {
            id: 'finance',
            label: 'Unreconciled receipts',
            value: 7,
            definition: 'Verified receipts not yet matched to a deposit.',
            tone: 'error',
            source: {
              label: 'Cashier reconciliation',
              href: '/admin/finance/reconciliation',
              updatedAt: '2026-07-29T15:03:00+06:00',
            },
            capability: 'finance.read',
          },
        ]}
        schoolName="International Community School"
        searchQuery="Samira"
        searchResults={[
          {
            id: 'student-1',
            kind: 'Student',
            label: 'Samira Noor',
            context: 'Year 8 · active enrolment',
            href: '/admin/students/1',
            capability: 'student.read',
          },
          {
            id: 'case-1',
            kind: 'Safeguarding case',
            label: 'Restricted case 1',
            context: 'Purpose-bound access',
            href: '/admin/student-support/cases/1',
            capability: 'safeguarding.case.read',
          },
        ]}
        selectedExceptionIds={['attendance-1']}
      />,
    );

    expect(markup).toContain('Readiness definitions');
    expect(markup).toContain('Attendance readiness report');
    expect(markup).toContain('Send reminder');
    expect(markup).toContain('Restricted student support task');
    expect(markup).toContain('Verify identity to continue');
    expect(markup).toContain('Samira Noor');
    expect(markup).not.toContain('Restricted case 1');
    expect(markup).not.toContain('Unreconciled receipts');
  });

  it('masks unavailable records without echoing supplied sensitive content', () => {
    const markup = renderToStaticMarkup(
      <AdminRecordWorkspace
        access="restricted"
        actions={[]}
        assurance="aal1"
        backHref="/admin/search"
        backLabel="Back to search"
        capabilities={[]}
        description="Highly sensitive narrative that must not be disclosed"
        evidence={[]}
        fields={[]}
        recordKind="Safeguarding case"
        related={[]}
        title="Student name and case identifier"
      />,
    );

    expect(markup).toContain('Record unavailable');
    expect(markup).toContain('may not exist');
    expect(markup).not.toContain('Highly sensitive narrative');
    expect(markup).not.toContain('Student name and case identifier');
    expect(markup).not.toContain('Safeguarding case');
  });

  it('renders available records with capability-filtered related records and AAL2 actions', () => {
    const markup = renderToStaticMarkup(
      <AdminRecordWorkspace
        access="available"
        actions={[
          {
            label: 'Approve correction',
            href: '/admin/records/1/approve',
            capability: 'records.approve',
            requiredAssurance: 'aal2',
          },
        ]}
        assurance="aal1"
        backHref="/admin/records"
        backLabel="Back to records"
        capabilities={['records.read', 'records.approve']}
        description="Version-stable academic record"
        evidence={[
          {
            id: 'event-1',
            label: 'Correction requested',
            actor: 'Records office',
            occurredAt: '2026-07-29T14:00:00+06:00',
            detail: 'Supporting evidence attached.',
          },
        ]}
        fields={[
          { label: 'Student', value: 'Samira Noor', capability: 'records.read' },
          { label: 'Finance note', value: 'Private balance note', capability: 'finance.read' },
        ]}
        recordKind="Transcript correction"
        related={[
          {
            id: 'report-card-1',
            kind: 'Report card',
            label: 'Term 2 report card',
            context: 'Published',
            href: '/admin/records/report-cards/1',
            capability: 'records.read',
          },
          {
            id: 'invoice-1',
            kind: 'Invoice',
            label: 'Invoice 1',
            context: 'Restricted finance record',
            href: '/admin/finance/invoices/1',
            capability: 'finance.read',
          },
        ]}
        title="Transcript correction 2026-18"
      />,
    );

    expect(markup).toContain('Transcript correction 2026-18');
    expect(markup).toContain('Samira Noor');
    expect(markup).toContain('Term 2 report card');
    expect(markup).toContain('Verify identity to continue');
    expect(markup).not.toContain('Private balance note');
    expect(markup).not.toContain('Invoice 1');
  });
});
