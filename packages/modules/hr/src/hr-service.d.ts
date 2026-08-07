import { type OperationsAuditWriter, type OperationsEventPublisher, type OperationsPrincipal, type OperationsScope } from './contracts.js';
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
export declare class HrService {
    #private;
    constructor(scope: OperationsScope, events: OperationsEventPublisher, audit: OperationsAuditWriter, clock?: Clock);
    registerStaff(input: Omit<StaffProfile, 'version' | 'createdAt'>, principal: OperationsPrincipal, correlationId: string): StaffProfile;
    createContract(input: EmploymentContractInput, principal: OperationsPrincipal, correlationId: string): EmploymentContract;
    supersedeContract(currentContractId: string, replacement: EmploymentContractInput, principal: OperationsPrincipal, correlationId: string): EmploymentContract;
    requestLeave(input: LeaveRequestInput, principal: OperationsPrincipal, correlationId: string): LeaveRequest;
    approveLeave(leaveId: string, principal: OperationsPrincipal, correlationId: string): LeaveRequest;
    recordAttendance(input: StaffAttendanceInput, principal: OperationsPrincipal, correlationId: string): StaffAttendance;
    attendanceReport(startsOn: string, endsOn: string, principal: OperationsPrincipal): AttendanceReport;
    listStaff(): readonly StaffProfile[];
    getContract(contractId: string): EmploymentContract | undefined;
    listContracts(staffId: string): readonly EmploymentContract[];
    listLeaveRequests(): readonly LeaveRequest[];
    listAttendance(): readonly StaffAttendance[];
}
export {};
//# sourceMappingURL=hr-service.d.ts.map