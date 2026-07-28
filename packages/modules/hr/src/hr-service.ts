import {
  assertDate,
  assertIdentifier,
  authorizeOperations,
  createOperationsAudit,
  createOperationsEvent,
  type OperationsAuditWriter,
  type OperationsEventPublisher,
  type OperationsPrincipal,
  type OperationsScope,
} from './contracts.js';

export type EmploymentStatus = 'active' | 'on-leave' | 'suspended' | 'ended';
export type ContractStatus = 'active' | 'superseded' | 'ended';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

export interface StaffProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly personRef: string;
  readonly staffNumber: string;
  readonly displayName: string;
  readonly workEmail: string;
  readonly employmentStatus: EmploymentStatus;
  readonly joinedOn: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface EmploymentContractInput {
  readonly id: string;
  readonly staffId: string;
  readonly positionCode: string;
  readonly departmentCode: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly workloadBasisPoints: number;
  readonly salaryReference: string;
}

export interface EmploymentContract extends EmploymentContractInput {
  readonly status: ContractStatus;
  readonly version: number;
  readonly supersedesContractId: string | null;
  readonly createdAt: string;
}

export interface LeaveRequestInput {
  readonly id: string;
  readonly staffId: string;
  readonly leaveType: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly reason: string;
}

export interface LeaveRequest extends LeaveRequestInput {
  readonly status: LeaveStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly decisionReason: string | null;
  readonly version: number;
}

export interface StaffAttendanceInput {
  readonly id: string;
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly status: AttendanceStatus;
  readonly minutesWorked: number;
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export interface StaffAttendance extends StaffAttendanceInput {
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly version: number;
}

export interface AttendanceReport {
  readonly totalRecords: number;
  readonly present: number;
  readonly late: number;
  readonly absent: number;
  readonly leave: number;
  readonly exceptionStaffIds: readonly string[];
}

interface Clock {
  now(): Date;
}

const systemClock: Clock = { now: () => new Date() };

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

export class HrService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #clock: Clock;
  readonly #staff = new Map<string, StaffProfile>();
  readonly #staffNumbers = new Set<string>();
  readonly #personRefs = new Set<string>();
  readonly #contracts = new Map<string, EmploymentContract>();
  readonly #leave = new Map<string, LeaveRequest>();
  readonly #attendance = new Map<string, StaffAttendance>();
  readonly #attendanceByIdempotency = new Map<string, string>();

  constructor(
    scope: OperationsScope,
    events: OperationsEventPublisher,
    audit: OperationsAuditWriter,
    clock: Clock = systemClock,
  ) {
    assertIdentifier(scope.tenantId, 'tenantId');
    assertIdentifier(scope.legalEntityId, 'legalEntityId');
    assertIdentifier(scope.campusId, 'campusId');
    this.#scope = frozen(scope);
    this.#events = events;
    this.#audit = audit;
    this.#clock = clock;
  }

  registerStaff(
    input: Omit<StaffProfile, 'version' | 'createdAt'>,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StaffProfile {
    authorizeOperations(principal, 'operations.hr.staff.write', this.#scope);
    this.#assertInputScope(input.tenantId, input.legalEntityId, input.campusId);
    this.#assertCorrelation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      personRef: input.personRef,
      staffNumber: input.staffNumber,
      displayName: input.displayName,
      workEmail: input.workEmail,
    })) {
      assertIdentifier(value, field);
    }
    assertDate(input.joinedOn, 'joinedOn');
    if (!/^\S+@\S+\.\S+$/.test(input.workEmail)) throw new Error('OPS_INVALID_EMAIL');
    if (this.#staff.has(input.id)) throw new Error('OPS_DUPLICATE_STAFF');
    if (this.#staffNumbers.has(input.staffNumber)) throw new Error('OPS_DUPLICATE_STAFF_NUMBER');
    if (this.#personRefs.has(input.personRef)) throw new Error('OPS_DUPLICATE_PERSON_REFERENCE');

    const staff: StaffProfile = frozen({
      ...input,
      staffNumber: input.staffNumber.trim().toUpperCase(),
      displayName: input.displayName.trim(),
      workEmail: input.workEmail.trim().toLowerCase(),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#staff.set(staff.id, staff);
    this.#staffNumbers.add(staff.staffNumber);
    this.#personRefs.add(staff.personRef);
    this.#record(
      'operations.hr.staff-registered.v1',
      'staff',
      staff.id,
      staff.version,
      'operations.hr.staff.register',
      principal,
      correlationId,
      { personRef: staff.personRef, staffNumber: staff.staffNumber },
    );
    return staff;
  }

  createContract(
    input: EmploymentContractInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): EmploymentContract {
    authorizeOperations(principal, 'operations.hr.contract.write', this.#scope);
    this.#requireStaff(input.staffId);
    this.#validateContract(input);
    if (this.#contracts.has(input.id)) throw new Error('OPS_DUPLICATE_CONTRACT');
    const overlapping = this.listContracts(input.staffId).some(
      (contract) => contract.status === 'active' && this.#rangesOverlap(contract, input),
    );
    if (overlapping) throw new Error('OPS_OVERLAPPING_CONTRACT');
    const contract: EmploymentContract = frozen({
      ...input,
      status: 'active',
      version: 1,
      supersedesContractId: null,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#contracts.set(contract.id, contract);
    this.#record(
      'operations.hr.contract-created.v1',
      'employment-contract',
      contract.id,
      contract.version,
      'operations.hr.contract.create',
      principal,
      correlationId,
      { staffId: contract.staffId, positionCode: contract.positionCode },
    );
    return contract;
  }

  supersedeContract(
    currentContractId: string,
    replacement: EmploymentContractInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): EmploymentContract {
    authorizeOperations(principal, 'operations.hr.contract.write', this.#scope, {
      requireAal2: true,
    });
    const current = this.#requireContract(currentContractId);
    if (current.status !== 'active') throw new Error('OPS_CONTRACT_NOT_ACTIVE');
    if (replacement.staffId !== current.staffId) throw new Error('OPS_CONTRACT_STAFF_MISMATCH');
    this.#validateContract(replacement);
    if (replacement.startsOn <= current.startsOn) throw new Error('OPS_INVALID_SUPERSESSION_DATE');
    if (this.#contracts.has(replacement.id)) throw new Error('OPS_DUPLICATE_CONTRACT');

    const superseded: EmploymentContract = frozen({
      ...current,
      status: 'superseded',
      endsOn: current.endsOn ?? this.#dayBefore(replacement.startsOn),
      version: current.version + 1,
    });
    const next: EmploymentContract = frozen({
      ...replacement,
      status: 'active',
      version: current.version + 1,
      supersedesContractId: current.id,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#contracts.set(superseded.id, superseded);
    this.#contracts.set(next.id, next);
    this.#record(
      'operations.hr.contract-superseded.v1',
      'employment-contract',
      next.id,
      next.version,
      'operations.hr.contract.supersede',
      principal,
      correlationId,
      { staffId: next.staffId, supersedesContractId: current.id },
    );
    return next;
  }

  requestLeave(
    input: LeaveRequestInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LeaveRequest {
    authorizeOperations(principal, 'operations.hr.leave.write', this.#scope);
    this.#requireStaff(input.staffId);
    this.#assertCorrelation(correlationId);
    assertIdentifier(input.id, 'leave.id');
    assertIdentifier(input.leaveType, 'leave.leaveType');
    assertDate(input.startsOn, 'leave.startsOn');
    assertDate(input.endsOn, 'leave.endsOn');
    if (input.endsOn < input.startsOn) throw new Error('OPS_INVALID_DATE_RANGE');
    if (input.reason.trim().length < 3) throw new Error('OPS_LEAVE_REASON_REQUIRED');
    if (this.#leave.has(input.id)) throw new Error('OPS_DUPLICATE_LEAVE');
    if (
      [...this.#leave.values()].some(
        (leave) =>
          leave.staffId === input.staffId &&
          ['pending', 'approved'].includes(leave.status) &&
          this.#rangesOverlap(leave, input),
      )
    ) {
      throw new Error('OPS_OVERLAPPING_LEAVE');
    }
    const leave: LeaveRequest = frozen({
      ...input,
      reason: input.reason.trim(),
      status: 'pending',
      requestedBy: principal.principalId,
      requestedAt: this.#clock.now().toISOString(),
      approvedBy: null,
      approvedAt: null,
      decisionReason: null,
      version: 1,
    });
    this.#leave.set(leave.id, leave);
    this.#record(
      'operations.hr.leave-requested.v1',
      'leave-request',
      leave.id,
      leave.version,
      'operations.hr.leave.request',
      principal,
      correlationId,
      { staffId: leave.staffId, startsOn: leave.startsOn, endsOn: leave.endsOn },
    );
    return leave;
  }

  approveLeave(
    leaveId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LeaveRequest {
    const leave = this.#requireLeave(leaveId);
    if (leave.requestedBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:leave-request-approve');
    }
    authorizeOperations(principal, 'operations.hr.leave.approve', this.#scope, {
      requireAal2: true,
    });
    if (leave.status === 'approved') return leave;
    if (leave.status !== 'pending') throw new Error('OPS_INVALID_LEAVE_STATE');
    const approved: LeaveRequest = frozen({
      ...leave,
      status: 'approved',
      approvedBy: principal.principalId,
      approvedAt: this.#clock.now().toISOString(),
      version: leave.version + 1,
    });
    this.#leave.set(approved.id, approved);
    this.#record(
      'operations.hr.leave-approved.v1',
      'leave-request',
      approved.id,
      approved.version,
      'operations.hr.leave.approve',
      principal,
      correlationId,
      { staffId: approved.staffId },
    );
    return approved;
  }

  recordAttendance(
    input: StaffAttendanceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StaffAttendance {
    authorizeOperations(principal, 'operations.hr.attendance.write', this.#scope);
    this.#requireStaff(input.staffId);
    this.#assertCorrelation(correlationId);
    assertIdentifier(input.id, 'attendance.id');
    assertIdentifier(input.idempotencyKey, 'attendance.idempotencyKey');
    assertDate(input.attendanceDate, 'attendance.attendanceDate');
    if (
      !Number.isSafeInteger(input.minutesWorked) ||
      input.minutesWorked < 0 ||
      input.minutesWorked > 1_440
    ) {
      throw new Error('OPS_INVALID_MINUTES_WORKED');
    }
    const existingId = this.#attendanceByIdempotency.get(input.idempotencyKey);
    if (existingId) return this.#attendance.get(existingId)!;
    if (this.#attendance.has(input.id)) throw new Error('OPS_DUPLICATE_ATTENDANCE');
    const duplicateDay = [...this.#attendance.values()].some(
      (attendance) =>
        attendance.staffId === input.staffId && attendance.attendanceDate === input.attendanceDate,
    );
    if (duplicateDay) throw new Error('OPS_DUPLICATE_ATTENDANCE_DAY');
    const attendance: StaffAttendance = frozen({
      ...input,
      recordedBy: principal.principalId,
      recordedAt: this.#clock.now().toISOString(),
      version: 1,
    });
    this.#attendance.set(attendance.id, attendance);
    this.#attendanceByIdempotency.set(attendance.idempotencyKey, attendance.id);
    this.#record(
      'operations.hr.attendance-recorded.v1',
      'staff-attendance',
      attendance.id,
      attendance.version,
      'operations.hr.attendance.record',
      principal,
      correlationId,
      { staffId: attendance.staffId, status: attendance.status },
    );
    return attendance;
  }

  attendanceReport(
    startsOn: string,
    endsOn: string,
    principal: OperationsPrincipal,
  ): AttendanceReport {
    authorizeOperations(principal, 'operations.hr.report.read', this.#scope);
    assertDate(startsOn, 'report.startsOn');
    assertDate(endsOn, 'report.endsOn');
    if (endsOn < startsOn) throw new Error('OPS_INVALID_DATE_RANGE');
    const records = [...this.#attendance.values()].filter(
      (attendance) => attendance.attendanceDate >= startsOn && attendance.attendanceDate <= endsOn,
    );
    const count = (status: AttendanceStatus): number =>
      records.filter((record) => record.status === status).length;
    return frozen({
      totalRecords: records.length,
      present: count('present'),
      late: count('late'),
      absent: count('absent'),
      leave: count('leave'),
      exceptionStaffIds: Object.freeze(
        [
          ...new Set(
            records
              .filter((record) => ['late', 'absent'].includes(record.status))
              .map((record) => record.staffId),
          ),
        ].sort(),
      ),
    });
  }

  listStaff(): readonly StaffProfile[] {
    return Object.freeze([...this.#staff.values()]);
  }

  getContract(contractId: string): EmploymentContract | undefined {
    return this.#contracts.get(contractId);
  }

  listContracts(staffId: string): readonly EmploymentContract[] {
    return Object.freeze(
      [...this.#contracts.values()]
        .filter((contract) => contract.staffId === staffId)
        .sort((left, right) => left.startsOn.localeCompare(right.startsOn)),
    );
  }

  listLeaveRequests(): readonly LeaveRequest[] {
    return Object.freeze([...this.#leave.values()]);
  }

  listAttendance(): readonly StaffAttendance[] {
    return Object.freeze([...this.#attendance.values()]);
  }

  #record(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    aggregateVersion: number,
    action: string,
    principal: OperationsPrincipal,
    correlationId: string,
    payload: Readonly<Record<string, unknown>>,
  ): void {
    this.#assertCorrelation(correlationId);
    this.#events.publish(
      createOperationsEvent({
        eventType,
        scope: this.#scope,
        aggregateType,
        aggregateId,
        aggregateVersion,
        correlationId,
        actorId: principal.principalId,
        payload,
        occurredAt: this.#clock.now().toISOString(),
      }),
    );
    this.#audit.append(
      createOperationsAudit({
        scope: this.#scope,
        action,
        subjectType: aggregateType,
        subjectId: aggregateId,
        actorId: principal.principalId,
        correlationId,
        details: payload,
        occurredAt: this.#clock.now().toISOString(),
      }),
    );
  }

  #assertInputScope(tenantId: string, legalEntityId: string, campusId: string): void {
    if (
      tenantId !== this.#scope.tenantId ||
      legalEntityId !== this.#scope.legalEntityId ||
      campusId !== this.#scope.campusId
    ) {
      throw new Error('OPS_SCOPE_MISMATCH');
    }
  }

  #assertCorrelation(correlationId: string): void {
    assertIdentifier(correlationId, 'correlationId');
  }

  #validateContract(input: EmploymentContractInput): void {
    for (const [field, value] of Object.entries({
      id: input.id,
      staffId: input.staffId,
      positionCode: input.positionCode,
      departmentCode: input.departmentCode,
      salaryReference: input.salaryReference,
    })) {
      assertIdentifier(value, `contract.${field}`);
    }
    assertDate(input.startsOn, 'contract.startsOn');
    if (input.endsOn !== null) {
      assertDate(input.endsOn, 'contract.endsOn');
      if (input.endsOn < input.startsOn) throw new Error('OPS_INVALID_DATE_RANGE');
    }
    if (
      !Number.isInteger(input.workloadBasisPoints) ||
      input.workloadBasisPoints <= 0 ||
      input.workloadBasisPoints > 10_000
    ) {
      throw new Error('OPS_INVALID_WORKLOAD');
    }
  }

  #rangesOverlap(
    left: { readonly startsOn: string; readonly endsOn: string | null },
    right: { readonly startsOn: string; readonly endsOn: string | null },
  ): boolean {
    const leftEnd = left.endsOn ?? '9999-12-31';
    const rightEnd = right.endsOn ?? '9999-12-31';
    return left.startsOn <= rightEnd && right.startsOn <= leftEnd;
  }

  #dayBefore(date: string): string {
    assertDate(date, 'date');
    const result = new Date(`${date}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() - 1);
    return result.toISOString().slice(0, 10);
  }

  #requireStaff(staffId: string): StaffProfile {
    const staff = this.#staff.get(staffId);
    if (!staff) throw new Error('OPS_NOT_FOUND:staff');
    return staff;
  }

  #requireContract(contractId: string): EmploymentContract {
    const contract = this.#contracts.get(contractId);
    if (!contract) throw new Error('OPS_NOT_FOUND:contract');
    return contract;
  }

  #requireLeave(leaveId: string): LeaveRequest {
    const leave = this.#leave.get(leaveId);
    if (!leave) throw new Error('OPS_NOT_FOUND:leave');
    return leave;
  }
}
