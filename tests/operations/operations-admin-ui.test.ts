import { describe, expect, it } from 'vitest';

import {
  buildOperationsCommandCentre,
  operationsCommandCentreCss,
  renderOperationsCommandCentre,
  type OperationsCommandCentreInput,
} from '../../apps/web-admin/src/features/operations/operations-command-centre.js';

function input(overrides: Partial<OperationsCommandCentreInput> = {}): OperationsCommandCentreInput {
  return {
    locale: 'en-GB',
    direction: 'ltr',
    title: 'Operations command centre',
    subtitle: 'Act on school-wide operational exceptions and queues.',
    asOfLabel: 'As of 29 July 2026',
    generatedAtLabel: 'Updated 2 minutes ago',
    permissions: ['operations.*'],
    metrics: [
      {
        id: 'occupancy',
        label: 'Hostel occupancy',
        value: '88%',
        context: '176 of 200 beds occupied',
        sourceLabel: 'Hostel allocation ledger',
        href: '/operations/hostel',
        trend: 'Up 3 points this month',
      },
    ],
    exceptions: [
      {
        id: 'transport-rider',
        severity: 'critical',
        domain: 'Transport',
        title: 'Unreconciled rider',
        detail: 'One boarded rider has no alighting record.',
        ownerLabel: 'Transport manager',
        ageLabel: '8 minutes',
        href: '/operations/transport/incidents/1',
        requiredPermission: 'operations.transport.report.read',
      },
      {
        id: 'invoice-match',
        severity: 'high',
        domain: 'Procurement',
        title: 'Invoice match failed',
        detail: 'Received quantity is lower than the supplier invoice.',
        ownerLabel: 'Procurement approver',
        ageLabel: '2 hours',
        href: '/operations/procurement/invoices/1',
        requiredPermission: 'operations.procurement.report.read',
      },
    ],
    queues: [
      {
        id: 'leave',
        domain: 'HR',
        label: 'Leave approvals',
        count: 4,
        oldestAgeLabel: '1 day',
        href: '/operations/hr/leave',
        requiredPermission: 'operations.hr.leave.approve',
      },
    ],
    modules: [
      {
        id: 'hr',
        label: 'HR and staff',
        description: 'Staff, contracts, leave and attendance.',
        href: '/operations/hr',
        statusLabel: 'Healthy',
        exceptionCount: 0,
        requiredPermission: 'operations.hr.report.read',
      },
      {
        id: 'transport',
        label: 'Transport',
        description: 'Routes, riders, trips and safeguarding.',
        href: '/operations/transport',
        statusLabel: 'Action required',
        exceptionCount: 1,
        requiredPermission: 'operations.transport.report.read',
      },
    ],
    quickActions: [
      {
        id: 'record-receipt',
        label: 'Record goods receipt',
        description: 'Receive a purchase order into inventory.',
        href: '/operations/procurement/receipts/new',
        requiredPermission: 'operations.procurement.receipt.write',
      },
      {
        id: 'approve-payable',
        label: 'Approve payable',
        description: 'Review a matched supplier invoice.',
        href: '/operations/procurement/payables',
        requiredPermission: 'operations.procurement.payable.approve',
        stepUpRequired: true,
      },
    ],
    ...overrides,
  };
}

describe('OPS admin command centre', () => {
  it('renders exception-first semantic landmarks and live status', () => {
    const html = renderOperationsCommandCentre(buildOperationsCommandCentre(input()));
    expect(html).toContain('href="#operations-main"');
    expect(html).toContain('<main id="operations-main"');
    expect(html).toContain('<h1>Operations command centre</h1>');
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html.indexOf('Exceptions requiring attention')).toBeLessThan(
      html.indexOf('Operational position'),
    );
    expect(html).toContain('<caption class="ops-visually-hidden">');
    expect(html).toContain('scope="col"');
  });

  it('sorts critical exceptions first and filters permission-controlled content', () => {
    const model = buildOperationsCommandCentre(
      input({
        permissions: ['operations.transport.*'],
        exceptions: [...input().exceptions].reverse(),
      }),
    );
    expect(model.exceptions.map((item) => item.id)).toEqual(['transport-rider']);
    expect(model.modules.map((item) => item.id)).toEqual(['transport']);
    expect(model.queues).toEqual([]);
    expect(model.quickActions).toEqual([]);
  });

  it('renders RTL direction and uses logical, responsive CSS properties', () => {
    const html = renderOperationsCommandCentre(
      buildOperationsCommandCentre(input({ locale: 'ar', direction: 'rtl' })),
    );
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(operationsCommandCentreCss).toContain('margin-inline');
    expect(operationsCommandCentreCss).toContain('inset-inline-start');
    expect(operationsCommandCentreCss).toContain('@media (max-width: 50rem)');
    expect(operationsCommandCentreCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(operationsCommandCentreCss).toContain('@media (forced-colors: active)');
    expect(operationsCommandCentreCss).not.toContain('margin-left');
    expect(operationsCommandCentreCss).not.toContain('margin-right');
  });

  it('escapes untrusted content and rejects unsafe links', () => {
    const malicious = input({
      title: '<script>alert(1)</script>',
      quickActions: [
        {
          id: 'unsafe',
          label: 'Unsafe',
          description: '<img src=x onerror=alert(1)>',
          href: 'javascript:alert(1)',
          requiredPermission: 'operations.hr.report.read',
        },
        {
          id: 'protocol-relative',
          label: 'Protocol relative',
          description: 'External protocol-relative link',
          href: '//evil.example/path',
          requiredPermission: 'operations.hr.report.read',
        },
      ],
    });
    const html = renderOperationsCommandCentre(buildOperationsCommandCentre(malicious));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('//evil.example');
    expect(html).toContain('&lt;script&gt;');
    expect(html.match(/href="#"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('shows a useful scoped empty state instead of an empty dashboard', () => {
    const model = buildOperationsCommandCentre(
      input({ metrics: [], exceptions: [], queues: [], modules: [], quickActions: [] }),
    );
    const html = renderOperationsCommandCentre(model);
    expect(model.emptyState).toBe(true);
    expect(html).toContain('No operational data available');
    expect(html).toContain('selected campus, date and permissions');
  });
});
