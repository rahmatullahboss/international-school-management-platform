export const STUDENT_LIFECYCLE_SCHEMA_VERSION = 1 as const;

export type StudentStatus =
  | 'prospective'
  | 'active'
  | 'leave'
  | 'withdrawn'
  | 'graduated'
  | 'alumni';
export type EnrollmentStatus =
  | 'pending'
  | 'active'
  | 'transferred'
  | 'withdrawn'
  | 'completed'
  | 'cancelled';

export interface EnrollmentReference {
  tenantId: string;
  enrollmentId: string;
  studentProfileId: string;
  campusId: string;
  programId: string;
  academicYearId: string;
  gradeLevelId?: string;
  status: EnrollmentStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
}

export interface StudentLifecycleEventPayloads {
  'sis.lifecycle.student-profile-created.v1': {
    studentProfileId: string;
    personId: string;
  };
  'sis.lifecycle.enrollment-created.v1': {
    enrollmentId: string;
    studentProfileId: string;
    campusId: string;
    programId: string;
  };
  'sis.lifecycle.student-transferred.v1': {
    enrollmentId: string;
    destinationCampusId: string;
    newEnrollmentId: string;
  };
  'sis.lifecycle.student-withdrawn.v1': {
    enrollmentId: string;
    withdrawalDate: string;
    reasonCode: string;
  };
}

export const studentLifecycleApiContract = Object.freeze({
  version: 'v1',
  commands: [
    'CreateStudentProfile',
    'CreateStaffProfile',
    'AssignStudentNumber',
    'CreateEnrollment',
    'TransferEnrollment',
    'WithdrawEnrollment',
    'PromoteStudent',
    'ReEnrollStudent',
    'TransitionToAlumni',
  ],
  queries: [
    'GetStudentProfile',
    'GetEnrollmentHistory',
    'ListCurrentEnrollments',
    'GetStudentAccessEffects',
    'GetLifecycleReconciliation',
  ],
});
