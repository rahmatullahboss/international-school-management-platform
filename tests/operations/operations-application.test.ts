import { describe, expect, it, vi } from 'vitest';

import {
  OperationsApplication,
  type OperationsCommandHandler,
  type OperationsReportProvider,
} from '../../apps/platform-api/src/operations-application.js';
import type { OperationsPrincipal } from '../../apps/platform-api/src/operations-routes.js';

const principal: OperationsPrincipal = {
  principalId: 'ops-manager',
  tenantId: 'tenant-ops',
  campusIds: ['campus-main'],
  permissions: ['operations.hr.report.read', 'operations.transport.*'],
  assurance: 'aal2',
};

function provider(
  report: OperationsReportProvider['report'],
  requiredPermission: OperationsReportProvider['requiredPermission'],
  overrides: Partial<Awaited<ReturnType<OperationsReportProvider['load']>>> = {},
): OperationsReportProvider {
  return {
    report,
    requiredPermission,
    load: vi.fn(() => ({
      report,
      metrics: [
        {
          id: `${report}-metric`,
          domain: report,
          label: `${report} metric`,
          value: 1,
          context: 'Current scoped value',
          source: `${report} report`,
          tone: 'neutral',
        },
      ],
      exceptions: [],
      queues: [],
      data: { report },
      ...overrides,
    })),
  };
}

function handler(
  command: OperationsCommandHandler['command'],
  requiredPermission: OperationsCommandHandler['requiredPermission'],
  overrides: Partial<OperationsCommandHandler> = {},
): OperationsCommandHandler {
  return {
    command,
    requiredPermission,
    stepUpRequired: false,
    idempotencyRequired: true,
    execute: vi.fn((input) => ({ accepted: true, command: input.command })),
    ...overrides,
  };
}

describe('OPS API application composition', () => {
  it('aggregates only permission-visible reports and sorts exceptions by priority', async () => {
    const application = new OperationsApplication(
      [
        provider('hr-attendance', 'operations.hr.report.read', {
          exceptions: [
            {
              id: 'hr-high',
              domain: 'HR',
              severity: 'high',
              title: 'Attendance exception',
              detail: 'Three missing records',
              owner: 'HR manager',
              href: '/operations/hr',
              openedAt: '2026-07-29T09:00:00.000Z',
            },
          ],
        }),
        provider('transport', 'operations.transport.report.read', {
          exceptions: [
            {
              id: 'transport-critical',
              domain: 'Transport',
              severity: 'critical',
              title: 'Unreconciled rider',
              detail: 'One rider has not alighted',
              owner: 'Transport manager',
              href: '/operations/transport',
              openedAt: '2026-07-29T10:00:00.000Z',
            },
          ],
          queues: [
            {
              id: 'transport-incidents',
              domain: 'Transport',
              label: 'Open incidents',
              count: 2,
              oldestOpenedAt: '2026-07-29T08:00:00.000Z',
              href: '/operations/transport/incidents',
            },
          ],
        }),
        provider('procurement', 'operations.procurement.report.read'),
      ],
      [],
      () => new Date('2026-07-29T12:00:00.000Z'),
    );

    const summary = await application.getSummary({ asOf: '2026-07-29', principal });
    expect(summary.coveredReports).toEqual(['hr-attendance', 'transport']);
    expect(summary.exceptions.map((exception) => exception.id)).toEqual([
      'transport-critical',
      'hr-high',
    ]);
    expect(summary.queues.map((queue) => queue.id)).toEqual(['transport-incidents']);
    expect(summary.generatedAt).toBe('2026-07-29T12:00:00.000Z');
  });

  it('returns a configured report and rejects permission or provider mismatches', async () => {
    const visible = provider('transport', 'operations.transport.report.read');
    const hidden = provider('procurement', 'operations.procurement.report.read');
    const application = new OperationsApplication([visible, hidden], []);

    await expect(
      application.getReport({
        report: 'transport',
        asOf: '2026-07-29',
        principal,
        resourceId: null,
      }),
    ).resolves.toEqual({ report: 'transport' });
    await expect(
      application.getReport({
        report: 'procurement',
        asOf: '2026-07-29',
        principal,
        resourceId: null,
      }),
    ).rejects.toThrow('OPS_PERMISSION_DENIED:operations.procurement.report.read');
    await expect(
      new OperationsApplication([], []).getReport({
        report: 'library',
        asOf: '2026-07-29',
        principal,
        resourceId: null,
      }),
    ).rejects.toThrow('OPS_API_REPORT_NOT_CONFIGURED:library');
  });

  it('enforces command permission, AAL2 and idempotency before dispatch', async () => {
    const execute = vi.fn(() => ({ status: 'approved' }));
    const application = new OperationsApplication(
      [],
      [
        handler('transport.start-trip', 'operations.transport.trip.write'),
        handler('procurement.approve-payable', 'operations.procurement.payable.approve', {
          stepUpRequired: true,
          execute,
        }),
      ],
    );

    await expect(
      application.executeCommand({
        command: 'transport.start-trip',
        payload: {},
        principal,
        correlationId: 'corr-trip',
        idempotencyKey: null,
      }),
    ).rejects.toThrow('OPS_IDEMPOTENCY_KEY_REQUIRED');

    await expect(
      application.executeCommand({
        command: 'procurement.approve-payable',
        payload: {},
        principal,
        correlationId: 'corr-payable',
        idempotencyKey: 'payable-1',
      }),
    ).rejects.toThrow('OPS_PERMISSION_DENIED:operations.procurement.payable.approve');

    await expect(
      application.executeCommand({
        command: 'procurement.approve-payable',
        payload: {},
        principal: {
          ...principal,
          permissions: ['operations.procurement.payable.approve'],
          assurance: 'aal1',
        },
        correlationId: 'corr-payable',
        idempotencyKey: 'payable-1',
      }),
    ).rejects.toThrow('OPS_STEP_UP_REQUIRED');

    await expect(
      application.executeCommand({
        command: 'procurement.approve-payable',
        payload: {},
        principal: {
          ...principal,
          permissions: ['operations.procurement.payable.approve'],
        },
        correlationId: 'corr-payable',
        idempotencyKey: 'payable-1',
      }),
    ).resolves.toEqual({ status: 'approved' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate provider and handler registrations deterministically', () => {
    expect(
      () =>
        new OperationsApplication(
          [
            provider('library', 'operations.library.report.read'),
            provider('library', 'operations.library.report.read'),
          ],
          [],
        ),
    ).toThrow('OPS_API_DUPLICATE_REPORT_PROVIDER:library');
    expect(
      () =>
        new OperationsApplication(
          [],
          [
            handler('library.checkout', 'operations.library.circulation.write'),
            handler('library.checkout', 'operations.library.circulation.write'),
          ],
        ),
    ).toThrow('OPS_API_DUPLICATE_COMMAND_HANDLER:library.checkout');
  });
});
