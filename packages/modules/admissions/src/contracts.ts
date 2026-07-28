export const ADMISSIONS_SCHEMA_VERSION = 1 as const;

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'waitlisted'
  | 'offered'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'converted';

export interface ApplicationReference {
  tenantId: string;
  applicationId: string;
  applicantPersonId: string;
  cycleId: string;
  formVersionId: string;
  status: ApplicationStatus;
  version: number;
}

export interface AdmissionsEventPayloads {
  'sis.admissions.application-submitted.v1': {
    applicationId: string;
    applicantPersonId: string;
    formVersionId: string;
  };
  'sis.admissions.decision-recorded.v1': {
    applicationId: string;
    decision: 'admit' | 'waitlist' | 'decline';
  };
  'sis.admissions.offer-accepted.v1': {
    applicationId: string;
    offerId: string;
  };
  'sis.admissions.applicant-converted.v1': {
    applicationId: string;
    studentProfileId: string;
    enrollmentId: string;
  };
}

export const admissionsApiContract = Object.freeze({
  version: 'v1',
  commands: [
    'CreateEnquiry',
    'StartApplication',
    'SubmitApplication',
    'AmendApplication',
    'CompleteChecklistItem',
    'RecordReview',
    'ScheduleInterview',
    'RecordDecision',
    'IssueOffer',
    'AcceptOffer',
    'ConvertApplicant',
  ],
  queries: [
    'GetApplication',
    'ListApplications',
    'GetGuardianApplicationStatus',
    'GetAdmissionsFunnel',
    'GetChecklistReconciliation',
  ],
});
