import { describe, expect, it } from 'vitest';

import { AcademicRegistry } from '../../packages/modules/academics/src/index.js';
import {
  ActivitiesTripsService,
  InMemoryActivitiesFinanceGateway,
} from '../../packages/modules/activities-trips/src/index.js';
import { AttendanceRegistry } from '../../packages/modules/attendance/src/index.js';
import { currencyCode } from '../../packages/modules/billing/src/index.js';
import {
  HrService,
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
  type OperationsScope,
} from '../../packages/modules/hr/src/index.js';
import { LedgerService } from '../../packages/modules/ledger/src/index.js';
import { CareSecurityService } from '../../packages/modules/safeguarding/src/index.js';

const tenantId = '00000000-0000-4000-8000-0000000000b1';
const legalEntityId = '10000000-0000-4000-8000-0000000000b1';
const campusId = '20000000-0000-4000-8000-0000000000b1';
const teacherStaffId = '30000000-0000-4000-8000-0000000000b1';
const studentRef = '40000000-0000-4000-8000-0000000000b1';
const fixedNow = new Date('2026-07-29T08:00:00.000Z');
const clock = { now: () => fixedNow };
const operationsScope: OperationsScope = { tenantId, legalEntityId, campusId };

function operationsPrincipal(permissions: readonly string[]): OperationsPrincipal {
  return {
    principalId: '50000000-0000-4000-8000-0000000000b1',
    tenantId,
    campusIds: [campusId],
    permissions,
    assurance: 'aal2',
  };
}

function createAcademicRoster(): {
  readonly academics: AcademicRegistry;
  readonly sectionId: string;
  readonly studentProfileIds: readonly string[];
} {
  const academics = new AcademicRegistry();
  const year = academics.createAcademicYear({
    tenantId,
    idempotencyKey: 'wave2-year',
    code: '2026-27',
    name: '2026–27',
    startsOn: '2026-08-01',
    endsOn: '2027-07-31',
    correlationId: 'wave2-year',
  }).value;
  const term = academics.addTerm({
    tenantId,
    academicYearId: year.academicYearId,
    code: 'T1',
    name: 'Term 1',
    startsOn: '2026-08-01',
    endsOn: '2026-12-20',
    sequence: 1,
    correlationId: 'wave2-term',
  }).value;
  const curriculum = academics.createCurriculumVersion({
    tenantId,
    curriculumKey: 'international-primary',
    versionLabel: '2026',
    name: 'International Primary',
    effectiveFrom: '2026-08-01',
    correlationId: 'wave2-curriculum',
  }).value;
  const course = academics.createCourseVersion({
    tenantId,
    courseKey: 'mathematics-6',
    versionLabel: '2026',
    curriculumVersionId: curriculum.curriculumVersionId,
    code: 'MATH-6',
    title: 'Mathematics 6',
    credits: 1,
    correlationId: 'wave2-course',
  }).value;
  const section = academics.createSection({
    tenantId,
    courseVersionId: course.courseVersionId,
    academicYearId: year.academicYearId,
    termId: term.termId,
    campusId,
    code: 'MATH-6-A',
    title: 'Mathematics 6A',
    capacity: 24,
    correlationId: 'wave2-section',
  }).value;

  for (const [index, studentProfileId] of [
    studentRef,
    '40000000-0000-4000-8000-0000000000b2',
  ].entries()) {
    academics.enrollStudent({
      tenantId,
      sectionId: section.sectionId,
      studentProfileId,
      enrollmentId: `60000000-0000-4000-8000-0000000000b${index + 1}`,
      joinedOn: '2026-08-01',
      correlationId: `wave2-roster-${index + 1}`,
    });
  }

  return {
    academics,
    sectionId: section.sectionId,
    studentProfileIds: academics
      .sectionRoster(tenantId, section.sectionId)
      .map((entry) => entry.studentProfileId),
  };
}

describe('Wave 2 integrated module journeys', () => {
  it('carries the academic roster into duplicate-safe offline attendance', () => {
    const roster = createAcademicRoster();
    const attendance = new AttendanceRegistry();
    const policy = attendance.createPolicy({
      tenantId,
      policyKey: 'standard-daily',
      versionLabel: '2026',
      lateAfterMinutes: 10,
      chronicAbsenceThresholdPercent: 15,
      correlationId: 'wave2-attendance-policy',
    }).value;
    const present = attendance.addCode({
      tenantId,
      policyVersionId: policy.policyVersionId,
      code: 'P',
      label: 'Present',
      meaning: 'present',
      countsAsPresent: true,
      correlationId: 'wave2-attendance-present',
    }).value;
    attendance.addCode({
      tenantId,
      policyVersionId: policy.policyVersionId,
      code: 'A',
      label: 'Absent',
      meaning: 'absent',
      countsAsPresent: false,
      requiresReason: true,
      correlationId: 'wave2-attendance-absent',
    });
    attendance.publishPolicy({
      tenantId,
      policyVersionId: policy.policyVersionId,
      correlationId: 'wave2-attendance-publish',
    });
    const session = attendance.openSession({
      tenantId,
      scheduledMeetingId: 'meeting-wave2-1',
      sectionId: roster.sectionId,
      campusId,
      localDate: '2026-08-03',
      startsAt: '08:00',
      endsAt: '08:45',
      timezone: 'Asia/Dhaka',
      rosterStudentIds: roster.studentProfileIds,
      correlationId: 'wave2-attendance-session',
    }).value;
    const entries = roster.studentProfileIds.map((studentProfileId, index) => ({
      clientRecordId: `device-record-${index + 1}`,
      sessionId: session.sessionId,
      studentProfileId,
      attendanceCodeId: present.attendanceCodeId,
      minutesPresent: 45,
      source: 'device' as const,
      recordedBy: teacherStaffId,
    }));

    const first = attendance.sync({
      tenantId,
      clientBatchId: 'device-batch-1',
      deviceId: 'teacher-tablet-1',
      entries,
      correlationId: 'wave2-attendance-sync-1',
    });
    const exactReplay = attendance.sync({
      tenantId,
      clientBatchId: 'device-batch-1',
      deviceId: 'teacher-tablet-1',
      entries,
      correlationId: 'wave2-attendance-sync-replay',
    });
    const newBatchReplay = attendance.sync({
      tenantId,
      clientBatchId: 'device-batch-2',
      deviceId: 'teacher-tablet-1',
      entries,
      correlationId: 'wave2-attendance-sync-2',
    });

    expect(first.value.accepted).toBe(2);
    expect(first.value.replayed).toBe(0);
    expect(exactReplay.value.syncBatchId).toBe(first.value.syncBatchId);
    expect(exactReplay.events).toHaveLength(0);
    expect(newBatchReplay.value.accepted).toBe(0);
    expect(newBatchReplay.value.replayed).toBe(2);
  });

  it('posts an HR contract reference through a balanced finance journal', () => {
    const events = new InMemoryOperationsEventPublisher();
    const audit = new InMemoryOperationsAuditWriter();
    const principal = operationsPrincipal([
      'operations.hr.staff.write',
      'operations.hr.contract.write',
    ]);
    const hr = new HrService(operationsScope, events, audit, clock);
    const staff = hr.registerStaff(
      {
        id: teacherStaffId,
        tenantId,
        legalEntityId,
        campusId,
        personRef: 'person-teacher-wave2',
        staffNumber: 'T-1001',
        displayName: 'Amina Teacher',
        workEmail: 'amina.teacher@example.test',
        employmentStatus: 'active',
        joinedOn: '2026-08-01',
      },
      principal,
      'wave2-staff-register',
    );
    const contract = hr.createContract(
      {
        id: 'contract-teacher-wave2',
        staffId: staff.id,
        positionCode: 'TEACHER',
        departmentCode: 'ACADEMICS',
        startsOn: '2026-08-01',
        endsOn: null,
        workloadBasisPoints: 10_000,
        salaryReference: 'salary-expense',
      },
      principal,
      'wave2-contract-create',
    );

    const bookId = 'book-wave2';
    const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
    ledger.registerAccount({
      id: contract.salaryReference,
      tenantId,
      legalEntityId,
      bookId,
      code: '5000',
      name: 'Salary expense',
      type: 'expense',
      naturalBalance: 'debit',
      controlAccount: false,
      active: true,
    });
    ledger.registerAccount({
      id: 'payroll-payable',
      tenantId,
      legalEntityId,
      bookId,
      code: '2100',
      name: 'Payroll payable',
      type: 'liability',
      naturalBalance: 'credit',
      controlAccount: true,
      active: true,
    });
    ledger.createPeriod({
      id: 'period-wave2',
      tenantId,
      legalEntityId,
      bookId,
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
    });
    const journal = ledger.post({
      tenantId,
      legalEntityId,
      bookId,
      periodId: 'period-wave2',
      entryDate: '2026-08-31',
      description: 'Teacher payroll accrual',
      sourceDocumentType: 'employment-contract',
      sourceDocumentId: contract.id,
      createdBy: 'payroll-preparer',
      postedBy: {
        principalId: 'finance-poster',
        assurance: 'aal2',
        permissions: ['ledger.journal.post'],
        scope: { tenantId, legalEntityId },
      },
      idempotencyKey: 'wave2-payroll-accrual',
      correlationId: 'wave2-payroll-accrual',
      lines: [
        {
          accountId: contract.salaryReference,
          side: 'debit',
          amountMinor: 125_000,
          currency: currencyCode('USD'),
          dimensions: { staffId: staff.id, contractId: contract.id },
        },
        {
          accountId: 'payroll-payable',
          side: 'credit',
          amountMinor: 125_000,
          currency: currencyCode('USD'),
          dimensions: { staffId: staff.id, contractId: contract.id },
        },
      ],
    });

    expect(journal.sourceDocumentId).toBe(contract.id);
    expect(journal.lines.map((line) => line.amountMinor)).toEqual([125_000, 125_000]);
    expect(journal.lines[0]?.dimensions.staffId).toBe(staff.id);
    expect(events.events.some((event) => event.eventType === 'operations.hr.contract-created.v1')).toBe(
      true,
    );
    expect(audit.entries.some((entry) => entry.subjectId === contract.id)).toBe(true);
  });

  it('creates one idempotent finance source document for a charged activity enrolment', () => {
    const events = new InMemoryOperationsEventPublisher();
    const audit = new InMemoryOperationsAuditWriter();
    const finance = new InMemoryActivitiesFinanceGateway();
    const activities = new ActivitiesTripsService(operationsScope, events, audit, finance, clock);
    const principal = operationsPrincipal([
      'operations.activities.catalog.write',
      'operations.activities.enrolment.write',
    ]);
    activities.registerActivity(
      {
        id: 'activity-robotics',
        code: 'ROBOTICS',
        name: 'Robotics Club',
        category: 'academic',
        leaderStaffRef: teacherStaffId,
        capacity: 1,
        feeMinor: 2_500,
        currency: 'USD',
        active: true,
      },
      principal,
      'wave2-activity-register',
    );
    const enrolled = activities.enrolParticipant(
      {
        id: 'activity-enrolment-1',
        activityId: 'activity-robotics',
        participantRef: studentRef,
        guardianRef: 'guardian-wave2',
        joinedOn: '2026-08-05',
      },
      principal,
      'wave2-activity-enrol',
    );
    const waitlisted = activities.enrolParticipant(
      {
        id: 'activity-enrolment-2',
        activityId: 'activity-robotics',
        participantRef: 'student-waitlisted-wave2',
        guardianRef: 'guardian-waitlisted-wave2',
        joinedOn: '2026-08-05',
      },
      principal,
      'wave2-activity-waitlist',
    );

    expect(enrolled.status).toBe('confirmed');
    expect(enrolled.financeDocumentRef).toBe(
      'fin-activities:activity-fee:activity-enrolment-1',
    );
    expect(waitlisted.status).toBe('waitlisted');
    expect(waitlisted.financeDocumentRef).toBeNull();
    expect(finance.documents).toEqual([
      expect.objectContaining({
        sourceType: 'activity-fee',
        sourceId: enrolled.id,
        personRef: studentRef,
        amountMinor: 2_500,
        currency: 'USD',
      }),
    ]);
  });

  it('masks unauthorized safeguarding access and audits exact case-member reads', () => {
    const now = new Date('2026-08-05T09:00:00.000Z');
    const security = new CareSecurityService({ now: () => now });
    const resource = {
      tenantId,
      resourceId: 'safeguarding-record-wave2',
      studentPersonId: studentRef,
      classification: 'CARE-C4' as const,
      caseId: 'safeguarding-case-wave2',
      fields: ['risk-assessment', 'protective-action'],
    };
    const denied = security.authorize({
      context: {
        tenantId,
        campusId,
        principalId: teacherStaffId,
        persona: 'teacher',
        assurance: 'aal2',
        purpose: 'safeguarding-assessment',
        correlationId: 'wave2-care-denied',
        membershipActive: true,
        permissions: ['care.safeguarding.read'],
      },
      resource,
      action: 'read',
      permission: 'care.safeguarding.read',
    });
    const allowed = security.authorize({
      context: {
        tenantId,
        campusId,
        principalId: 'safeguarding-member-wave2',
        persona: 'safeguarding-case-member',
        assurance: 'aal2',
        purpose: 'safeguarding-assessment',
        correlationId: 'wave2-care-allowed',
        membershipActive: true,
        permissions: ['care.safeguarding.read'],
      },
      resource,
      action: 'read',
      permission: 'care.safeguarding.read',
      caseMembership: {
        tenantId,
        caseId: 'safeguarding-case-wave2',
        principalId: 'safeguarding-member-wave2',
        purpose: 'safeguarding-assessment',
        status: 'active',
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    expect(denied).toEqual({ allowed: false, reason: 'not-found', masked: true });
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBe('need-to-know');
    expect(allowed.auditEvidenceId).toBeDefined();
    expect(security.auditStore.list(tenantId).map((entry) => entry.outcome)).toEqual([
      'denied',
      'allowed',
    ]);
  });
});
