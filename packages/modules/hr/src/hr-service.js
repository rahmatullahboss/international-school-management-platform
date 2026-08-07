import { assertDate, assertIdentifier, authorizeOperations, createOperationsAudit, createOperationsEvent, } from './contracts.js';
const systemClock = { now: () => new Date() };
function frozen(value) {
    return Object.freeze({ ...value });
}
export class HrService {
    #scope;
    #events;
    #audit;
    #clock;
    #staff = new Map();
    #staffNumbers = new Set();
    #personRefs = new Set();
    #contracts = new Map();
    #leave = new Map();
    #attendance = new Map();
    #attendanceByIdempotency = new Map();
    constructor(scope, events, audit, clock = systemClock) {
        assertIdentifier(scope.tenantId, 'tenantId');
        assertIdentifier(scope.legalEntityId, 'legalEntityId');
        assertIdentifier(scope.campusId, 'campusId');
        this.#scope = frozen(scope);
        this.#events = events;
        this.#audit = audit;
        this.#clock = clock;
    }
    registerStaff(input, principal, correlationId) {
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
        if (!/^\S+@\S+\.\S+$/.test(input.workEmail))
            throw new Error('OPS_INVALID_EMAIL');
        if (this.#staff.has(input.id))
            throw new Error('OPS_DUPLICATE_STAFF');
        if (this.#staffNumbers.has(input.staffNumber))
            throw new Error('OPS_DUPLICATE_STAFF_NUMBER');
        if (this.#personRefs.has(input.personRef))
            throw new Error('OPS_DUPLICATE_PERSON_REFERENCE');
        const staff = frozen({
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
        this.#record('operations.hr.staff-registered.v1', 'staff', staff.id, staff.version, 'operations.hr.staff.register', principal, correlationId, { personRef: staff.personRef, staffNumber: staff.staffNumber });
        return staff;
    }
    createContract(input, principal, correlationId) {
        authorizeOperations(principal, 'operations.hr.contract.write', this.#scope);
        this.#requireStaff(input.staffId);
        this.#validateContract(input);
        if (this.#contracts.has(input.id))
            throw new Error('OPS_DUPLICATE_CONTRACT');
        const overlapping = this.listContracts(input.staffId).some((contract) => contract.status === 'active' && this.#rangesOverlap(contract, input));
        if (overlapping)
            throw new Error('OPS_OVERLAPPING_CONTRACT');
        const contract = frozen({
            ...input,
            status: 'active',
            version: 1,
            supersedesContractId: null,
            createdAt: this.#clock.now().toISOString(),
        });
        this.#contracts.set(contract.id, contract);
        this.#record('operations.hr.contract-created.v1', 'employment-contract', contract.id, contract.version, 'operations.hr.contract.create', principal, correlationId, { staffId: contract.staffId, positionCode: contract.positionCode });
        return contract;
    }
    supersedeContract(currentContractId, replacement, principal, correlationId) {
        authorizeOperations(principal, 'operations.hr.contract.write', this.#scope, {
            requireAal2: true,
        });
        const current = this.#requireContract(currentContractId);
        if (current.status !== 'active')
            throw new Error('OPS_CONTRACT_NOT_ACTIVE');
        if (replacement.staffId !== current.staffId)
            throw new Error('OPS_CONTRACT_STAFF_MISMATCH');
        this.#validateContract(replacement);
        if (replacement.startsOn <= current.startsOn)
            throw new Error('OPS_INVALID_SUPERSESSION_DATE');
        if (this.#contracts.has(replacement.id))
            throw new Error('OPS_DUPLICATE_CONTRACT');
        const superseded = frozen({
            ...current,
            status: 'superseded',
            endsOn: current.endsOn ?? this.#dayBefore(replacement.startsOn),
            version: current.version + 1,
        });
        const next = frozen({
            ...replacement,
            status: 'active',
            version: current.version + 1,
            supersedesContractId: current.id,
            createdAt: this.#clock.now().toISOString(),
        });
        this.#contracts.set(superseded.id, superseded);
        this.#contracts.set(next.id, next);
        this.#record('operations.hr.contract-superseded.v1', 'employment-contract', next.id, next.version, 'operations.hr.contract.supersede', principal, correlationId, { staffId: next.staffId, supersedesContractId: current.id });
        return next;
    }
    requestLeave(input, principal, correlationId) {
        authorizeOperations(principal, 'operations.hr.leave.write', this.#scope);
        this.#requireStaff(input.staffId);
        this.#assertCorrelation(correlationId);
        assertIdentifier(input.id, 'leave.id');
        assertIdentifier(input.leaveType, 'leave.leaveType');
        assertDate(input.startsOn, 'leave.startsOn');
        assertDate(input.endsOn, 'leave.endsOn');
        if (input.endsOn < input.startsOn)
            throw new Error('OPS_INVALID_DATE_RANGE');
        if (input.reason.trim().length < 3)
            throw new Error('OPS_LEAVE_REASON_REQUIRED');
        if (this.#leave.has(input.id))
            throw new Error('OPS_DUPLICATE_LEAVE');
        if ([...this.#leave.values()].some((leave) => leave.staffId === input.staffId &&
            ['pending', 'approved'].includes(leave.status) &&
            this.#rangesOverlap(leave, input))) {
            throw new Error('OPS_OVERLAPPING_LEAVE');
        }
        const leave = frozen({
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
        this.#record('operations.hr.leave-requested.v1', 'leave-request', leave.id, leave.version, 'operations.hr.leave.request', principal, correlationId, { staffId: leave.staffId, startsOn: leave.startsOn, endsOn: leave.endsOn });
        return leave;
    }
    approveLeave(leaveId, principal, correlationId) {
        const leave = this.#requireLeave(leaveId);
        if (leave.requestedBy === principal.principalId) {
            throw new Error('OPS_SOD_VIOLATION:leave-request-approve');
        }
        authorizeOperations(principal, 'operations.hr.leave.approve', this.#scope, {
            requireAal2: true,
        });
        if (leave.status === 'approved')
            return leave;
        if (leave.status !== 'pending')
            throw new Error('OPS_INVALID_LEAVE_STATE');
        const approved = frozen({
            ...leave,
            status: 'approved',
            approvedBy: principal.principalId,
            approvedAt: this.#clock.now().toISOString(),
            version: leave.version + 1,
        });
        this.#leave.set(approved.id, approved);
        this.#record('operations.hr.leave-approved.v1', 'leave-request', approved.id, approved.version, 'operations.hr.leave.approve', principal, correlationId, { staffId: approved.staffId });
        return approved;
    }
    recordAttendance(input, principal, correlationId) {
        authorizeOperations(principal, 'operations.hr.attendance.write', this.#scope);
        this.#requireStaff(input.staffId);
        this.#assertCorrelation(correlationId);
        assertIdentifier(input.id, 'attendance.id');
        assertIdentifier(input.idempotencyKey, 'attendance.idempotencyKey');
        assertDate(input.attendanceDate, 'attendance.attendanceDate');
        if (!Number.isSafeInteger(input.minutesWorked) ||
            input.minutesWorked < 0 ||
            input.minutesWorked > 1_440) {
            throw new Error('OPS_INVALID_MINUTES_WORKED');
        }
        const existingId = this.#attendanceByIdempotency.get(input.idempotencyKey);
        if (existingId)
            return this.#attendance.get(existingId);
        if (this.#attendance.has(input.id))
            throw new Error('OPS_DUPLICATE_ATTENDANCE');
        const duplicateDay = [...this.#attendance.values()].some((attendance) => attendance.staffId === input.staffId && attendance.attendanceDate === input.attendanceDate);
        if (duplicateDay)
            throw new Error('OPS_DUPLICATE_ATTENDANCE_DAY');
        const attendance = frozen({
            ...input,
            recordedBy: principal.principalId,
            recordedAt: this.#clock.now().toISOString(),
            version: 1,
        });
        this.#attendance.set(attendance.id, attendance);
        this.#attendanceByIdempotency.set(attendance.idempotencyKey, attendance.id);
        this.#record('operations.hr.attendance-recorded.v1', 'staff-attendance', attendance.id, attendance.version, 'operations.hr.attendance.record', principal, correlationId, { staffId: attendance.staffId, status: attendance.status });
        return attendance;
    }
    attendanceReport(startsOn, endsOn, principal) {
        authorizeOperations(principal, 'operations.hr.report.read', this.#scope);
        assertDate(startsOn, 'report.startsOn');
        assertDate(endsOn, 'report.endsOn');
        if (endsOn < startsOn)
            throw new Error('OPS_INVALID_DATE_RANGE');
        const records = [...this.#attendance.values()].filter((attendance) => attendance.attendanceDate >= startsOn && attendance.attendanceDate <= endsOn);
        const count = (status) => records.filter((record) => record.status === status).length;
        return frozen({
            totalRecords: records.length,
            present: count('present'),
            late: count('late'),
            absent: count('absent'),
            leave: count('leave'),
            exceptionStaffIds: Object.freeze([
                ...new Set(records
                    .filter((record) => ['late', 'absent'].includes(record.status))
                    .map((record) => record.staffId)),
            ].sort()),
        });
    }
    listStaff() {
        return Object.freeze([...this.#staff.values()]);
    }
    getContract(contractId) {
        return this.#contracts.get(contractId);
    }
    listContracts(staffId) {
        return Object.freeze([...this.#contracts.values()]
            .filter((contract) => contract.staffId === staffId)
            .sort((left, right) => left.startsOn.localeCompare(right.startsOn)));
    }
    listLeaveRequests() {
        return Object.freeze([...this.#leave.values()]);
    }
    listAttendance() {
        return Object.freeze([...this.#attendance.values()]);
    }
    #record(eventType, aggregateType, aggregateId, aggregateVersion, action, principal, correlationId, payload) {
        this.#assertCorrelation(correlationId);
        this.#events.publish(createOperationsEvent({
            eventType,
            scope: this.#scope,
            aggregateType,
            aggregateId,
            aggregateVersion,
            correlationId,
            actorId: principal.principalId,
            payload,
            occurredAt: this.#clock.now().toISOString(),
        }));
        this.#audit.append(createOperationsAudit({
            scope: this.#scope,
            action,
            subjectType: aggregateType,
            subjectId: aggregateId,
            actorId: principal.principalId,
            correlationId,
            details: payload,
            occurredAt: this.#clock.now().toISOString(),
        }));
    }
    #assertInputScope(tenantId, legalEntityId, campusId) {
        if (tenantId !== this.#scope.tenantId ||
            legalEntityId !== this.#scope.legalEntityId ||
            campusId !== this.#scope.campusId) {
            throw new Error('OPS_SCOPE_MISMATCH');
        }
    }
    #assertCorrelation(correlationId) {
        assertIdentifier(correlationId, 'correlationId');
    }
    #validateContract(input) {
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
            if (input.endsOn < input.startsOn)
                throw new Error('OPS_INVALID_DATE_RANGE');
        }
        if (!Number.isInteger(input.workloadBasisPoints) ||
            input.workloadBasisPoints <= 0 ||
            input.workloadBasisPoints > 10_000) {
            throw new Error('OPS_INVALID_WORKLOAD');
        }
    }
    #rangesOverlap(left, right) {
        const leftEnd = left.endsOn ?? '9999-12-31';
        const rightEnd = right.endsOn ?? '9999-12-31';
        return left.startsOn <= rightEnd && right.startsOn <= leftEnd;
    }
    #dayBefore(date) {
        assertDate(date, 'date');
        const result = new Date(`${date}T00:00:00.000Z`);
        result.setUTCDate(result.getUTCDate() - 1);
        return result.toISOString().slice(0, 10);
    }
    #requireStaff(staffId) {
        const staff = this.#staff.get(staffId);
        if (!staff)
            throw new Error('OPS_NOT_FOUND:staff');
        return staff;
    }
    #requireContract(contractId) {
        const contract = this.#contracts.get(contractId);
        if (!contract)
            throw new Error('OPS_NOT_FOUND:contract');
        return contract;
    }
    #requireLeave(leaveId) {
        const leave = this.#leave.get(leaveId);
        if (!leave)
            throw new Error('OPS_NOT_FOUND:leave');
        return leave;
    }
}
//# sourceMappingURL=hr-service.js.map