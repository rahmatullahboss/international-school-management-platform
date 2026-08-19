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

function setup(): HrService {
  return new HrService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
  );
}

function registerStaff(
  service: HrService,
  id = 'staff-1',
  staffNumber = 'EMP-0042',
  personRef = 'sis-person-42',
) {
  return service.registerStaff(
    {
      id,
      tenantId: scope.tenantId,
      legalEntityId: scope.legalEntityId,
      campusId: scope.campusId,
      personRef,
      staffNumber,
      displayName: `Staff ${id}`,
      workEmail: `${id}@example.test`,
      employmentStatus: 'active',
      joinedOn: '2026-07-01',
    },
    hrAdmin,
    `corr-${id}`,
  );
}

function contractInput(id: string, staffId = 'staff-1', startsOn = '2026-07-01') {
  return {
    id,
    staffId,
    positionCode: 'TEACHER',
    departmentCode: 'SCIENCE',
    startsOn,
    endsOn: null,
    workloadBasisPoints: 10_000,
    salaryReference: `salary-${id}`,
  } as const;
}

describe('OPS HR boundary coverage', () => {
  it('rejects invalid or duplicate staff identity keys before creating operational records', () => {
    const service = setup();
    expect(() =>
      service.registerStaff(
        {
          id: 'staff-invalid',
          tenantId: scope.tenantId,
          legalEntityId: scope.legalEntityId,
          campusId: scope.campusId,
          personRef: 'sis-person-invalid',
          staffNumber: 'EMP-INVALID',
          displayName: 'Invalid Email Staff',
          workEmail: 'not-an-email',
          employmentStatus: 'active',
          joinedOn: '2026-07-01',
        },
        hrAdmin,
        'corr-invalid-email',
      ),
    ).toThrow('OPS_INVALID_EMAIL');

    registerStaff(service);
    expect(() => registerStaff(service)).toThrow('OPS_DUPLICATE_STAFF');
    expect(() => registerStaff(service, 'staff-2', 'EMP-0042', 'sis-person-43')).toThrow(
      'OPS_DUPLICATE_STAFF_NUMBER',
    );
    expect(() => registerStaff(service, 'staff-3', 'EMP-0043', 'sis-person-42')).toThrow(
      'OPS_DUPLICATE_PERSON_REFERENCE',
    );
  });

  it('fails closed for invalid, overlapping or unsafe employment-contract transitions', () => {
    const service = setup();
    registerStaff(service);
    registerStaff(service, 'staff-2', 'EMP-0043', 'sis-person-43');

    expect(() =>
      service.createContract(
        { ...contractInput('contract-invalid-period'), endsOn: '2026-06-30' },
        hrAdmin,
        'corr-contract-invalid-period',
      ),
    ).toThrow('OPS_INVALID_DATE_RANGE');
    expect(() =>
      service.createContract(
        { ...contractInput('contract-invalid-workload'), workloadBasisPoints: 0 },
        hrAdmin,
        'corr-contract-invalid-workload',
      ),
    ).toThrow('OPS_INVALID_WORKLOAD');
    expect(() =>
      service.createContract(
        contractInput('contract-missing-staff', 'missing-staff'),
        hrAdmin,
        'corr-contract-missing-staff',
      ),
    ).toThrow('OPS_NOT_FOUND:staff');

    const first = service.createContract(contractInput('contract-1'), hrAdmin, 'corr-contract-1');
    expect(() =>
      service.createContract(
        contractInput('contract-overlap', 'staff-1', '2026-08-01'),
        hrAdmin,
        'corr-contract-overlap',
      ),
    ).toThrow('OPS_OVERLAPPING_CONTRACT');
    expect(() =>
      service.supersedeContract(
        first.id,
        contractInput('contract-wrong-staff', 'staff-2', '2027-01-01'),
        hrAdmin,
        'corr-contract-wrong-staff',
      ),
    ).toThrow('OPS_CONTRACT_STAFF_MISMATCH');
    expect(() =>
      service.supersedeContract(
        first.id,
        contractInput('contract-too-early', 'staff-1', '2026-07-01'),
        hrAdmin,
        'corr-contract-too-early',
      ),
    ).toThrow('OPS_INVALID_SUPERSESSION_DATE');

    service.supersedeContract(
      first.id,
      contractInput('contract-2', 'staff-1', '2027-01-01'),
      hrAdmin,
      'corr-contract-2',
    );
    expect(() =>
      service.supersedeContract(
        first.id,
        contractInput('contract-3', 'staff-1', '2028-01-01'),
        hrAdmin,
        'corr-contract-3',
      ),
    ).toThrow('OPS_CONTRACT_NOT_ACTIVE');
    expect(() =>
      service.supersedeContract(
        'missing-contract',
        contractInput('contract-4', 'staff-1', '2028-01-01'),
        hrAdmin,
        'corr-contract-missing',
      ),
    ).toThrow('OPS_NOT_FOUND:contract');
  });

  it('enforces leave periods, overlap and approval state while exposing immutable request lists', () => {
    const service = setup();
    registerStaff(service);
    const requester = principal('staff-1', ['operations.hr.leave.write']);
    const manager = principal('manager', ['operations.hr.leave.approve']);

    expect(() =>
      service.requestLeave(
        {
          id: 'leave-invalid-period',
          staffId: 'staff-1',
          leaveType: 'annual',
          startsOn: '2026-08-03',
          endsOn: '2026-08-01',
          reason: 'Family commitment',
        },
        requester,
        'corr-leave-invalid-period',
      ),
    ).toThrow('OPS_INVALID_DATE_RANGE');
    expect(() =>
      service.requestLeave(
        {
          id: 'leave-short-reason',
          staffId: 'staff-1',
          leaveType: 'annual',
          startsOn: '2026-08-01',
          endsOn: '2026-08-02',
          reason: 'x',
        },
        requester,
        'corr-leave-short-reason',
      ),
    ).toThrow('OPS_LEAVE_REASON_REQUIRED');

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
    expect(() =>
      service.requestLeave(
        {
          id: 'leave-1',
          staffId: 'staff-1',
          leaveType: 'annual',
          startsOn: '2026-09-01',
          endsOn: '2026-09-02',
          reason: 'Second request',
        },
        requester,
        'corr-leave-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_LEAVE');
    expect(() =>
      service.requestLeave(
        {
          id: 'leave-overlap',
          staffId: 'staff-1',
          leaveType: 'medical',
          startsOn: '2026-08-02',
          endsOn: '2026-08-04',
          reason: 'Medical appointment',
        },
        requester,
        'corr-leave-overlap',
      ),
    ).toThrow('OPS_OVERLAPPING_LEAVE');

    const approved = service.approveLeave(leave.id, manager, 'corr-leave-approved');
    expect(service.approveLeave(leave.id, manager, 'corr-leave-replay')).toEqual(approved);
    expect(service.listLeaveRequests()).toEqual([approved]);
    expect(() => service.approveLeave('missing-leave', manager, 'corr-leave-missing')).toThrow(
      'OPS_NOT_FOUND:leave',
    );
  });

  it('validates attendance minutes, duplicate days and report ranges while exposing recorded rows', () => {
    const service = setup();
    registerStaff(service);

    for (const minutesWorked of [-1, 1.5, 1_441]) {
      expect(() =>
        service.recordAttendance(
          {
            id: `attendance-invalid-${String(minutesWorked)}`,
            staffId: 'staff-1',
            attendanceDate: '2026-07-27',
            status: 'present',
            minutesWorked,
            idempotencyKey: `invalid-${String(minutesWorked)}`,
          },
          hrAdmin,
          `corr-invalid-${String(minutesWorked)}`,
        ),
      ).toThrow('OPS_INVALID_MINUTES_WORKED');
    }

    const first = service.recordAttendance(
      {
        id: 'attendance-1',
        staffId: 'staff-1',
        attendanceDate: '2026-07-28',
        status: 'present',
        minutesWorked: 480,
        idempotencyKey: 'attendance-key-1',
      },
      hrAdmin,
      'corr-attendance-1',
    );
    expect(() =>
      service.recordAttendance(
        {
          id: first.id,
          staffId: 'staff-1',
          attendanceDate: '2026-07-29',
          status: 'present',
          minutesWorked: 480,
          idempotencyKey: 'attendance-key-2',
        },
        hrAdmin,
        'corr-attendance-duplicate-id',
      ),
    ).toThrow('OPS_DUPLICATE_ATTENDANCE');
    expect(() =>
      service.recordAttendance(
        {
          id: 'attendance-2',
          staffId: 'staff-1',
          attendanceDate: '2026-07-28',
          status: 'late',
          minutesWorked: 420,
          idempotencyKey: 'attendance-key-3',
        },
        hrAdmin,
        'corr-attendance-duplicate-day',
      ),
    ).toThrow('OPS_DUPLICATE_ATTENDANCE_DAY');
    expect(service.listAttendance()).toEqual([first]);
    expect(() => service.attendanceReport('2026-07-29', '2026-07-28', hrAdmin)).toThrow(
      'OPS_INVALID_DATE_RANGE',
    );
  });
});
