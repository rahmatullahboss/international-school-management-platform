import { describe, expect, it } from 'vitest';

import {
  AcademicApplicationService,
  type AcademicActorContext,
} from '../../packages/modules/academics/src/application.js';
import { AcademicRegistry } from '../../packages/modules/academics/src/index.js';
import {
  ActivitiesTripsService,
  InMemoryActivitiesFinanceGateway,
} from '../../packages/modules/activities-trips/src/index.js';
import { AttendanceRegistry } from '../../packages/modules/attendance/src/index.js';
import { GradebookRegistry } from '../../packages/modules/gradebook/src/index.js';
import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import { AcademicRecordsRegistry } from '../../packages/modules/records/src/index.js';
import {
  CareSecurityService,
  type CareAccessRequest,
  type CareRequestContext,
  type CareResource,
} from '../../packages/modules/safeguarding/src/index.js';
import { TimetableRegistry } from '../../packages/modules/scheduling/src/index.js';

const tenantId = '00000000-0000-4000-8000-0000000000a1';
const legalEntityId = '10000000-0000-4000-8000-0000000000a1';
const campusId = '20000000-0000-4000-8000-0000000000a1';
const sectionId = '30000000-0000-4000-8000-0000000000a1';
const studentId = '40000000-0000-4000-8000-0000000000a1';
const guardianId = '50000000-0000-4000-8000-0000000000a1';
const now = new Date('2026-07-29T08:30:00.000Z');

function academicActor(): AcademicActorContext {
  return {
    tenantId,
    actorId: 'teacher-wave2',
    permissions: new Set(['academics.attendance.capture']),
    sectionIds: new Set([sectionId]),
    studentIds: new Set([studentId]),
    campusIds: new Set([campusId]),
    locale: 'en-GB',
    timezone: 'Asia/Dhaka',
  };
}

function operationsPrincipal(): OperationsPrincipal {
  return {
    principalId: 'activities-coordinator-wave2',
    tenantId,
    campusIds: [campusId],
    permissions: [
      'operations.activities.catalog.write',
      'operations.activities.enrolment.write',
      'operations.activities.report.read',
    ],
    assurance: 'aal2',
  };
}

function academicService(): AcademicApplicationService {
  return new AcademicApplicationService({
    academics: new AcademicRegistry(),
    scheduling: new TimetableRegistry(),
    attendance: new AttendanceRegistry(),
    gradebook: new GradebookRegistry(),
    records: new AcademicRecordsRegistry(),
    external: {
      validateCampus: (reference) => reference === campusId,
      validateStudent: (reference) => reference === studentId,
      validateStaff: () => true,
      validateEnrollment: () => true,
      validateCountryPack: () => true,
    },
  });
}

describe('Wave 2 integrated student operations journey', () => {
  it('carries a bounded SIS student reference through attendance and activity charging without disclosing CARE data', () => {
    const academics = academicService();
    const attendanceSession = academics.openAttendanceSession(academicActor(), {
      scheduledMeetingId: 'meeting-wave2',
      sectionId,
      campusId,
      localDate: '2026-08-03',
      startsAt: '08:00',
      endsAt: '09:00',
      timezone: 'Asia/Dhaka',
      rosterStudentIds: [studentId],
      correlationId: 'corr-wave2-attendance',
    }).value;

    const finance = new InMemoryActivitiesFinanceGateway();
    const activities = new ActivitiesTripsService(
      { tenantId, legalEntityId, campusId },
      new InMemoryOperationsEventPublisher(),
      new InMemoryOperationsAuditWriter(),
      finance,
    );
    const coordinator = operationsPrincipal();
    activities.registerActivity(
      {
        id: 'activity-wave2',
        code: 'ROBOTICS',
        name: 'Robotics Club',
        category: 'club',
        leaderStaffRef: 'staff-robotics-lead',
        capacity: 20,
        feeMinor: 2_500,
        currency: 'BDT',
        active: true,
      },
      coordinator,
      'corr-wave2-activity',
    );
    const enrolment = activities.enrolParticipant(
      {
        id: 'activity-enrolment-wave2',
        activityId: 'activity-wave2',
        participantRef: studentId,
        guardianRef: guardianId,
        joinedOn: '2026-08-03',
      },
      coordinator,
      'corr-wave2-enrolment',
    );

    const careContext: CareRequestContext = {
      tenantId,
      principalId: 'nurse-wave2',
      linkedPersonId: 'person-nurse-wave2',
      persona: 'nurse',
      assurance: 'aal2',
      purpose: 'direct-care',
      correlationId: 'corr-wave2-care',
      sessionId: 'session-wave2-care',
      membershipActive: true,
      permissions: ['care.health.read'],
    };
    const careResource: CareResource = {
      tenantId,
      resourceId: 'health-resource-wave2',
      studentPersonId: studentId,
      classification: 'CARE-C3',
      fields: ['allergy-summary'],
    };
    const careRequest: CareAccessRequest = {
      context: careContext,
      resource: careResource,
      action: 'read',
      permission: 'care.health.read',
      relationship: { studentPersonId: studentId, active: true },
      now,
    };
    const careSecurity = new CareSecurityService({ now: () => now });
    const directCareDecision = careSecurity.authorize(careRequest);
    const broadAdminDecision = careSecurity.authorize({
      ...careRequest,
      context: { ...careContext, principalId: 'tenant-admin-wave2', persona: 'tenant-admin' },
    });

    expect(attendanceSession.rosterStudentIds).toEqual([studentId]);
    expect(enrolment).toMatchObject({ participantRef: studentId, status: 'confirmed' });
    expect(finance.documents).toHaveLength(1);
    expect(finance.documents[0]).toMatchObject({
      sourceType: 'activity-fee',
      sourceId: enrolment.id,
      personRef: studentId,
      amountMinor: 2_500,
      currency: 'BDT',
    });
    expect(directCareDecision).toMatchObject({ allowed: true, reason: 'need-to-know' });
    expect(broadAdminDecision).toMatchObject({ allowed: false, reason: 'not-found', masked: true });
    expect(careSecurity.auditStore.list(tenantId)).toHaveLength(1);

    const financePayload = JSON.stringify(finance.documents[0]);
    expect(financePayload).not.toContain(careResource.resourceId);
    expect(financePayload).not.toContain('allergy-summary');
    expect(financePayload).not.toContain('CARE-C3');
  });

  it('rejects cross-tenant CARE access even when a shared student reference is known', () => {
    const context: CareRequestContext = {
      tenantId,
      principalId: 'nurse-wave2',
      linkedPersonId: 'person-nurse-wave2',
      persona: 'nurse',
      assurance: 'aal2',
      purpose: 'direct-care',
      correlationId: 'corr-wave2-cross-tenant',
      sessionId: 'session-wave2-cross-tenant',
      membershipActive: true,
      permissions: ['care.health.read'],
    };
    const security = new CareSecurityService({ now: () => now });
    const decision = security.authorize({
      context,
      resource: {
        tenantId: '00000000-0000-4000-8000-0000000000b2',
        resourceId: 'health-resource-other-tenant',
        studentPersonId: studentId,
        classification: 'CARE-C3',
        fields: ['condition-summary'],
      },
      action: 'read',
      permission: 'care.health.read',
      relationship: { studentPersonId: studentId, active: true },
      now,
    });

    expect(decision).toEqual({ allowed: false, reason: 'tenant-mismatch', masked: true });
    expect(security.auditStore.list(tenantId)).toHaveLength(0);
  });
});
