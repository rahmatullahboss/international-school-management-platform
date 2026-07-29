import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AdminCommandCentre,
  filterAdminExperienceItems,
  sortAdminExceptions,
  type AdminCommandCentreProps,
  type AdminException,
} from '../../apps/web-admin/src/features/experience/AdminCommandCentre';

const exceptions: readonly AdminException[] = [
  {
    id: 'attendance-late',
    domain: 'academics',
    severity: 'attention',
    title: 'Attendance register remains open',
    detail: 'One assigned section is not finalised.',
    owner: 'Academic office',
    dueAt: '2026-07-29T10:00:00+06:00',
    href: '/admin/academics/attendance/session-1',
    requiredCapability: 'academics.read',
  },
  {
    id: 'bank-reconciliation',
    domain: 'finance',
    severity: 'blocked',
    title: 'Deposit batch does not reconcile',
    detail: 'The provider total differs from the ledger source total.',
    owner: 'Finance office',
    dueAt: '2026-07-29T09:00:00+06:00',
    href: '/admin/finance/reconciliation/batch-1',
    requiredCapability: 'finance.read',
  },
  {
    id: 'restricted-care',
    domain: 'student-support',
    severity: 'critical',
    title: 'Restricted safeguarding follow-up',
    detail: 'Purpose-bound membership is required.',
    href: '/admin/student-support/case-1',
    requiredCapability: 'care.read',
  },
];

const shared: AdminCommandCentreProps = {
  locale: 'en-BD',
  capabilities: ['academics.read', 'finance.read', 'finance.approve', 'reports.bulk'],
  metrics: [
    {
      id: 'attendance-complete',
      label: 'Attendance finalised',
      value: 96,
      definition: 'Assigned sessions finalised for the current school day.',
      source: 'Attendance publication read model',
      asOf: '2026-07-29T09:15:00+06:00',
      href: '/admin/academics/attendance/report',
      attention: 'attention',
    },
  ],
  exceptions,
  approvals: [
    {
      id: 'refund-approval',
      kind: 'Refund',
      subject: 'Refund request RF-1042',
      requestedBy: 'Cashier desk 2',
      requestedAt: '2026-07-29T08:45:00+06:00',
      assurance: 'aal2',
      href: '/admin/finance/refunds/RF-1042',
      requiredCapability: 'finance.approve',
    },
    {
      id: 'care-disclosure',
      kind: 'Restricted disclosure',
      subject: 'Student-support disclosure request',
      requestedBy: 'Safeguarding lead',
      requestedAt: '2026-07-29T08:55:00+06:00',
      assurance: 'aal2',
      href: '/admin/student-support/disclosures/1',
      requiredCapability: 'care.disclosure.approve',
    },
  ],
  searchQuery: 'Rahman',
  searchResults: [
    {
      id: 'student-result',
      category: 'Student',
      title: 'Nadia Rahman',
      description: 'Active enrolment in Grade 7.',
      href: '/admin/sis/students/nadia',
      scopeLabel: 'Main campus',
      requiredCapability: 'academics.read',
    },
    {
      id: 'care-result',
      category: 'Restricted case',
      title: 'Restricted case match',
      description: 'This description must not render without permission.',
      href: '/admin/student-support/cases/restricted',
      scopeLabel: 'Purpose-bound',
      requiredCapability: 'care.read',
    },
  ],
  bulkOperations: [
    {
      id: 'report-export',
      label: 'Export attendance reconciliation',
      description: 'Prepare a governed CSV for the selected sections.',
      selectedCount: 12,
      href: '/admin/reports/attendance/export-review',
      requiredCapability: 'reports.bulk',
    },
    {
      id: 'invoice-release',
      label: 'Release selected invoices',
      description: 'Review invoices before publication.',
      selectedCount: 4,
      href: '/admin/finance/invoices/release-review',
      requiredCapability: 'finance.approve',
      blockedReasons: ['One invoice is already published', 'One payer relationship is inactive'],
    },
  ],
};

describe('EXP-01 admin command centre', () => {
  it('sorts authorised exceptions by severity and deadline', () => {
    expect(sortAdminExceptions(exceptions).map((item) => item.id)).toEqual([
      'restricted-care',
      'bank-reconciliation',
      'attendance-late',
    ]);
    expect(filterAdminExperienceItems(exceptions, ['finance.read']).map((item) => item.id)).toEqual(
      ['bank-reconciliation'],
    );
  });

  it('renders defined metrics, scoped exceptions, governed search and approval assurance', () => {
    const markup = renderToStaticMarkup(<AdminCommandCentre {...shared} />);

    expect(markup).toContain('Attendance finalised');
    expect(markup).toContain('Assigned sessions finalised for the current school day.');
    expect(markup).toContain('Attendance publication read model');
    expect(markup).toContain('2026-07-29T09:15:00+06:00');
    expect(markup).toContain('Deposit batch does not reconcile');
    expect(markup).toContain('Attendance register remains open');
    expect(markup).not.toContain('Restricted safeguarding follow-up');
    expect(markup).toContain('Nadia Rahman');
    expect(markup).not.toContain('This description must not render without permission.');
    expect(markup).toContain('Refund request RF-1042');
    expect(markup).toContain('Verify and review');
    expect(markup).not.toContain('Student-support disclosure request');
  });

  it('keeps blocked bulk operations reviewable without rendering an execution link', () => {
    const markup = renderToStaticMarkup(<AdminCommandCentre {...shared} />);

    expect(markup).toContain('12 selected');
    expect(markup).toContain('Review operation');
    expect(markup).toContain('One invoice is already published');
    expect(markup).toContain('One payer relationship is inactive');
    expect(markup).toContain('Resolve blockers first');
    expect(markup).not.toContain('href="/admin/finance/invoices/release-review"');
  });

  it('uses a masked empty search state instead of revealing restricted matches', () => {
    const markup = renderToStaticMarkup(
      <AdminCommandCentre
        {...shared}
        capabilities={[]}
        metrics={[]}
        searchQuery="restricted student"
      />,
    );

    expect(markup).toContain('No authorised results');
    expect(markup).toContain('No matching record is available in your current scope.');
    expect(markup).not.toContain('Restricted case match');
    expect(markup).not.toContain('2 results');
  });

  it('preserves submitted work context in recoverable error state', () => {
    const markup = renderToStaticMarkup(
      <AdminCommandCentre
        {...shared}
        state="error"
        errorTitle="Approval queues could not be refreshed"
        errorDetail="Your existing selections and submitted approvals are unchanged."
        retryHref="/admin?retry=1"
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Approval queues could not be refreshed');
    expect(markup).toContain('Your existing selections and submitted approvals are unchanged.');
    expect(markup).toContain('href="/admin?retry=1"');
  });
});
