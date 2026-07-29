import { describe, expect, it } from 'vitest';

import {
  HrService,
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';

const scope = { tenantId: 'tenant-ops', legalEntityId: 'entity-school', campusId: 'campus-main' };

function principal(
  principalId: string,
  permissions: readonly string[],
  assurance: 'aal1' | 'aal2' = 'aal2',
): OperationsPrincipal {
  return {
    principalId,
    tenantId: scope.tenantId,
    campusIds: [scope.campusId],
    permissions,
    assurance,
  };
}

const hrAdmin = principal('hr-admin', [
  'operations.hr.staff.write',
  'operations.hr.contract.write',
  'operations.hr.leave.write',
  'operations.hr.leave.approve',
  'operations.hr.attendance.write',
  'operations.hr.report.read',
]);

function setup(): {
  service: HrService;
  events: InMemoryOperationsEventPublisher;
  audit: InMemoryOperationsAuditWriter;
} {
  const events = new InMemoryOperationsEventPublisher();
  const audit = new InMemoryOperationsAuditWriter();
  return { service: new HrService(scope, events, audit), events, audit };
}

describe('OPS HR and staff', () => {
  it('registers a staff profile against an opaque SIS person reference and emits evidence', () => {
    const { service, events, audit } = setup();
    const staff = service.registerStaff(
      {
        id: 'staff-1',
        tenantId: scope.tenantId,
        legalEntityId: scope.legalEntityId,
        campusId: scope.campusId,
        personRef: 'sis-person-42',
        staffNumber: 'EMP-0042',
        displayName: 'Amina Rahman',
        workEmail: 'amina@example.test',
        employmentStatus: 'active',
        joinedOn: '2026-07-01',
      },
      hrAdmin,
      'corr-staff-1',
    );

    expect(staff.personRef).toBe('sis-person-42');
    expect(service.listStaff()).toEqual([staff]);
    expect(events.events).toMatchObject([
      { eventType: 'operations.hr.staff-registered.v1', aggregateId: 'staff-1' },
    ]);
    expect(audit.entries).toMatchObject([
      { action: 'operations.hr.staff.register', subjectId: 'staff-1', actorId: 'hr-admin' },
    ]);
  });

  it('creates versioned employment contracts and preserves superseded history', () => {
    const { service } = setup();
    service.registerStaff(
      {
        id: 'staff-1',
        tenantId: scope.tenantId,
        legalEntityId: scope.legalEntityId,
        campusId: scope.campusId,
        personRef: 'sis-person-42',
        staffNumber: 'EMP-0042',
        displayName: 'Amina Rahman',
        workEmail: 'amina@example.test',
        employmentStatus: 'active',
        joinedOn: '2026-07-01',
      },
      hrAdmin,
      'corr-staff-1',
    );

    const first = service.createContract(
      {
        id: 'contract-1',
        staffId: 'staff-1',
        positionCode: 'TEACHER',
        departmentCode: 'SCIENCE',
        startsOn: '2026-07-01',
        endsOn: null,
        workloadBasisPoints: 10_000,
        salaryReference: 'fin-comp-plan-1',
      },
      hrAdmin,
      'corr-contract-1',
    );
    const replacement = service.supersedeContract(
      first.id,
      {
        id: 'contract-2',
        staffId: 'staff-1',
        positionCode: 'HEAD-TEACHER',
        departmentCode: 'SCIENCE',
        startsOn: '2027-01-01',
        endsOn: null,
        workloadBasisPoints: 10_000,
        salaryReference: 'fin-comp-plan-2',
      },
      hrAdmin,
      'corr-contract-2',
    );

    expect(replacement.version).toBe(2);
    expect(service.getContract('contract-1')?.status).toBe('superseded');
    expect(service.listContracts('staff-1')).toHaveLength(2);
  });

  it('enforces separation of duties and aal2 for leave approval', () => {
    const { service } = setup();
    service.registerStaff(
      {
        id: 'staff-1',
        tenantId: scope.tenantId,
        legalEntityId: scope.legalEntityId,
        campusId: scope.campusId,
        personRef: 'sis-person-42',
        staffNumber: 'EMP-0042',
        displayName: 'Amina Rahman',
        workEmail: 'amina@example.test',
        employmentStatus: 'active',
        joinedOn: '2026-07-01',
      },
      hrAdmin,
      'corr-staff-1',
    );

    const requester = principal('staff-1', ['operations.hr.leave.write']);
    const leave = service.requestLeave(
      {
        id: 'leave-1',
        staffId: 'staff-1',
        leaveType: 'annual',
        startsOn: '2026-08-01',
        endsOn: '2026-08-03',
        reason: 'Family commitment',
      },
      requester,
      'corr-leave-1',
    );

    expect(() => service.approveLeave(leave.id, requester, 'corr-leave-self')).toThrow(
      'OPS_SOD_VIOLATION:leave-request-approve',
    );
    expect(() =>
      service.approveLeave(
        leave.id,
        principal('manager', ['operations.hr.leave.approve'], 'aal1'),
        'corr-leave-aal1',
      ),
    ).toThrow('OPS_STEP_UP_REQUIRED');

    const approved = service.approveLeave(
      leave.id,
      principal('manager', ['operations.hr.leave.approve']),
      'corr-leave-approved',
    );
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('manager');
  });

  it('records staff attendance idempotently and reports exceptions', () => {
    const { service } = setup();
    service.registerStaff(
      {
        id: 'staff-1',
        tenantId: scope.tenantId,
        legalEntityId: scope.legalEntityId,
        campusId: scope.campusId,
        personRef: 'sis-person-42',
        staffNumber: 'EMP-0042',
        displayName: 'Amina Rahman',
        workEmail: 'amina@example.test',
        employmentStatus: 'active',
        joinedOn: '2026-07-01',
      },
      hrAdmin,
      'corr-staff-1',
    );

    const first = service.recordAttendance(
      {
        id: 'attendance-1',
        staffId: 'staff-1',
        attendanceDate: '2026-07-28',
        status: 'late',
        minutesWorked: 420,
        note: 'Traffic delay',
        idempotencyKey: 'device-main:staff-1:2026-07-28',
      },
      hrAdmin,
      'corr-attendance-1',
    );
    const replay = service.recordAttendance(
      {
        ...first,
        id: 'attendance-replay',
        idempotencyKey: 'device-main:staff-1:2026-07-28',
      },
      hrAdmin,
      'corr-attendance-replay',
    );

    expect(replay.id).toBe(first.id);
    expect(service.attendanceReport('2026-07-28', '2026-07-28', hrAdmin)).toEqual({
      totalRecords: 1,
      present: 0,
      late: 1,
      absent: 0,
      leave: 0,
      exceptionStaffIds: ['staff-1'],
    });
  });

  it('rejects cross-tenant and cross-campus principals', () => {
    const { service } = setup();
    expect(() =>
      service.registerStaff(
        {
          id: 'staff-1',
          tenantId: scope.tenantId,
          legalEntityId: scope.legalEntityId,
          campusId: scope.campusId,
          personRef: 'sis-person-42',
          staffNumber: 'EMP-0042',
          displayName: 'Amina Rahman',
          workEmail: 'amina@example.test',
          employmentStatus: 'active',
          joinedOn: '2026-07-01',
        },
        {
          ...hrAdmin,
          tenantId: 'tenant-other',
        },
        'corr-cross-tenant',
      ),
    ).toThrow('OPS_SCOPE_MISMATCH');
  });
});
