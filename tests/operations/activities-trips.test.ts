import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import {
  ActivitiesTripsService,
  InMemoryActivitiesFinanceGateway,
} from '../../packages/modules/activities-trips/src/index.js';

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

const coordinator = principal('coordinator', [
  'operations.activities.catalog.write',
  'operations.activities.enrolment.write',
  'operations.activities.trip.write',
  'operations.activities.consent.write',
  'operations.activities.attendance.write',
  'operations.activities.incident.write',
  'operations.activities.report.read',
]);
const approver = principal('approver', [
  'operations.activities.risk.approve',
  'operations.activities.trip.approve',
  'operations.activities.report.read',
]);

function setup(): {
  service: ActivitiesTripsService;
  finance: InMemoryActivitiesFinanceGateway;
} {
  const finance = new InMemoryActivitiesFinanceGateway();
  return {
    service: new ActivitiesTripsService(
      scope,
      new InMemoryOperationsEventPublisher(),
      new InMemoryOperationsAuditWriter(),
      finance,
    ),
    finance,
  };
}

function seedActivity(service: ActivitiesTripsService, capacity = 1, feeMinor = 500): void {
  service.registerActivity(
    {
      id: 'activity-1',
      code: 'SCI-CLUB',
      name: 'Science Club',
      category: 'club',
      leaderStaffRef: 'staff-science-lead',
      capacity,
      feeMinor,
      currency: 'BDT',
      active: true,
    },
    coordinator,
    'corr-activity',
  );
}

function seedTrip(service: ActivitiesTripsService, capacity = 1): void {
  seedActivity(service, 10, 0);
  service.createTrip(
    {
      id: 'trip-1',
      activityId: 'activity-1',
      title: 'Science Museum Visit',
      destination: 'National Science Museum',
      startsAt: '2026-08-20T08:00:00.000Z',
      endsAt: '2026-08-20T18:00:00.000Z',
      capacity,
      budgetRef: 'fin-budget-science-trip',
      estimatedCostMinor: 50_000,
      currency: 'BDT',
      medicalSupportRef: 'care-trip-support-1',
    },
    coordinator,
    'corr-trip',
  );
}

describe('OPS activities and trips', () => {
  it('enrols to capacity, waitlists overflow and promotes the oldest waiting participant', () => {
    const { service } = setup();
    seedActivity(service, 1, 0);
    const first = service.enrolParticipant(
      {
        id: 'enrolment-1',
        activityId: 'activity-1',
        participantRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        joinedOn: '2026-07-01',
      },
      coordinator,
      'corr-enrol-1',
    );
    const second = service.enrolParticipant(
      {
        id: 'enrolment-2',
        activityId: 'activity-1',
        participantRef: 'sis-student-2',
        guardianRef: 'sis-guardian-2',
        joinedOn: '2026-07-02',
      },
      coordinator,
      'corr-enrol-2',
    );

    expect(first.status).toBe('confirmed');
    expect(second.status).toBe('waitlisted');
    service.cancelEnrolment(first.id, coordinator, 'corr-cancel');
    expect(service.findEnrolment(second.id)?.status).toBe('confirmed');
  });

  it('exports a confirmed activity fee through an immutable FIN charge source contract', () => {
    const { service, finance } = setup();
    seedActivity(service, 2, 500);
    service.enrolParticipant(
      {
        id: 'enrolment-1',
        activityId: 'activity-1',
        participantRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        joinedOn: '2026-07-01',
      },
      coordinator,
      'corr-enrol-1',
    );

    expect(finance.documents).toHaveLength(1);
    expect(finance.documents[0]).toMatchObject({
      sourceType: 'activity-fee',
      sourceId: 'enrolment-1',
      personRef: 'sis-student-1',
      amountMinor: 500,
      currency: 'BDT',
    });
  });

  it('requires separation of duties and AAL2 for trip risk approval', () => {
    const { service } = setup();
    seedTrip(service);
    const risk = service.recordRiskAssessment(
      {
        id: 'risk-1',
        tripId: 'trip-1',
        hazards: [
          {
            id: 'hazard-1',
            description: 'Road travel',
            likelihood: 2,
            impact: 4,
            mitigation: 'Licensed transport and seat-belt briefing',
          },
        ],
        emergencyContactRef: 'staff-emergency-1',
      },
      coordinator,
      'corr-risk',
    );

    expect(() => service.approveRiskAssessment(risk.id, coordinator, 'corr-self')).toThrow(
      'OPS_SOD_VIOLATION:risk-record-approve',
    );
    expect(() =>
      service.approveRiskAssessment(
        risk.id,
        principal('risk-aal1', ['operations.activities.risk.approve'], 'aal1'),
        'corr-aal1',
      ),
    ).toThrow('OPS_STEP_UP_REQUIRED');
    expect(service.approveRiskAssessment(risk.id, approver, 'corr-approve').status).toBe(
      'approved',
    );
  });

  it('enforces consent and capacity, then promotes a consented waitlisted trip participant', () => {
    const { service } = setup();
    seedTrip(service, 1);
    service.recordRiskAssessment(
      {
        id: 'risk-1',
        tripId: 'trip-1',
        hazards: [
          {
            id: 'hazard-1',
            description: 'Road travel',
            likelihood: 2,
            impact: 4,
            mitigation: 'Licensed transport and seat-belt briefing',
          },
        ],
        emergencyContactRef: 'staff-emergency-1',
      },
      coordinator,
      'corr-risk',
    );
    service.approveRiskAssessment('risk-1', approver, 'corr-risk-approve');
    const first = service.registerTripParticipant(
      {
        id: 'participant-1',
        tripId: 'trip-1',
        participantRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: 'care-note-1',
        chargeMinor: 1_000,
      },
      coordinator,
      'corr-participant-1',
    );
    const second = service.registerTripParticipant(
      {
        id: 'participant-2',
        tripId: 'trip-1',
        participantRef: 'sis-student-2',
        guardianRef: 'sis-guardian-2',
        medicalNoteRef: null,
        chargeMinor: 1_000,
      },
      coordinator,
      'corr-participant-2',
    );
    service.recordConsent(
      {
        id: 'consent-1',
        tripParticipantId: first.id,
        guardianRef: 'sis-guardian-1',
        decision: 'approved',
        signedAt: '2026-07-29T10:00:00.000Z',
      },
      coordinator,
      'corr-consent-1',
    );
    service.recordConsent(
      {
        id: 'consent-2',
        tripParticipantId: second.id,
        guardianRef: 'sis-guardian-2',
        decision: 'approved',
        signedAt: '2026-07-29T10:01:00.000Z',
      },
      coordinator,
      'corr-consent-2',
    );

    expect(service.findTripParticipant(first.id)?.status).toBe('confirmed');
    expect(service.findTripParticipant(second.id)?.status).toBe('waitlisted');
    service.cancelTripParticipant(first.id, coordinator, 'corr-cancel-first');
    expect(service.findTripParticipant(second.id)?.status).toBe('confirmed');
  });

  it('blocks trip approval until risk is approved and confirmed participants have consent', () => {
    const { service } = setup();
    seedTrip(service, 2);
    service.registerTripParticipant(
      {
        id: 'participant-1',
        tripId: 'trip-1',
        participantRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: null,
        chargeMinor: 0,
      },
      coordinator,
      'corr-participant',
    );

    expect(() => service.approveTrip('trip-1', approver, 'corr-trip-approve')).toThrow(
      'OPS_TRIP_RISK_NOT_APPROVED',
    );
    service.recordRiskAssessment(
      {
        id: 'risk-1',
        tripId: 'trip-1',
        hazards: [
          {
            id: 'hazard-1',
            description: 'Road travel',
            likelihood: 2,
            impact: 4,
            mitigation: 'Licensed transport and seat-belt briefing',
          },
        ],
        emergencyContactRef: 'staff-emergency-1',
      },
      coordinator,
      'corr-risk',
    );
    service.approveRiskAssessment('risk-1', approver, 'corr-risk-approve');
    expect(() => service.approveTrip('trip-1', approver, 'corr-trip-no-consent')).toThrow(
      'OPS_TRIP_CONSENT_INCOMPLETE:sis-student-1',
    );
  });

  it('approves a compliant trip and exports its payable source document to FIN', () => {
    const { service, finance } = setup();
    seedTrip(service, 2);
    service.recordRiskAssessment(
      {
        id: 'risk-1',
        tripId: 'trip-1',
        hazards: [
          {
            id: 'hazard-1',
            description: 'Road travel',
            likelihood: 2,
            impact: 4,
            mitigation: 'Licensed transport and seat-belt briefing',
          },
        ],
        emergencyContactRef: 'staff-emergency-1',
      },
      coordinator,
      'corr-risk',
    );
    service.approveRiskAssessment('risk-1', approver, 'corr-risk-approve');
    const participant = service.registerTripParticipant(
      {
        id: 'participant-1',
        tripId: 'trip-1',
        participantRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: null,
        chargeMinor: 0,
      },
      coordinator,
      'corr-participant',
    );
    service.recordConsent(
      {
        id: 'consent-1',
        tripParticipantId: participant.id,
        guardianRef: 'sis-guardian-1',
        decision: 'approved',
        signedAt: '2026-07-29T10:00:00.000Z',
      },
      coordinator,
      'corr-consent',
    );

    expect(service.approveTrip('trip-1', approver, 'corr-trip-approve').status).toBe('approved');
    expect(finance.documents.at(-1)).toMatchObject({
      sourceType: 'trip-payable',
      sourceId: 'trip-1',
      budgetRef: 'fin-budget-science-trip',
      amountMinor: 50_000,
      currency: 'BDT',
    });
  });

  it('records attendance idempotently and reports missing participants', () => {
    const { service } = setup();
    seedTrip(service, 2);
    const participant = service.registerTripParticipant(
      {
        id: 'participant-1',
        tripId: 'trip-1',
        participantRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: null,
        chargeMinor: 0,
      },
      coordinator,
      'corr-participant',
    );
    service.recordConsent(
      {
        id: 'consent-1',
        tripParticipantId: participant.id,
        guardianRef: 'sis-guardian-1',
        decision: 'approved',
        signedAt: '2026-07-29T10:00:00.000Z',
      },
      coordinator,
      'corr-consent',
    );
    const first = service.recordTripAttendance(
      {
        id: 'attendance-1',
        tripId: 'trip-1',
        participantRef: 'sis-student-1',
        status: 'present',
        recordedAt: '2026-08-20T07:45:00.000Z',
        idempotencyKey: 'trip-1:sis-student-1',
      },
      coordinator,
      'corr-attendance',
    );
    const replay = service.recordTripAttendance(
      {
        ...first,
        id: 'attendance-replay',
        idempotencyKey: 'trip-1:sis-student-1',
      },
      coordinator,
      'corr-attendance-replay',
    );

    expect(replay.id).toBe(first.id);
    expect(service.tripReport('trip-1', coordinator)).toMatchObject({
      confirmedParticipants: 1,
      presentParticipants: 1,
      absentParticipants: 0,
      missingAttendanceParticipantRefs: [],
    });
  });

  it('records trip incidents and exposes operational exceptions in reports', () => {
    const { service } = setup();
    seedTrip(service, 2);
    service.recordTripIncident(
      {
        id: 'incident-1',
        tripId: 'trip-1',
        participantRefs: ['sis-student-1'],
        severity: 'high',
        occurredAt: '2026-08-20T12:00:00.000Z',
        description: 'Minor injury requiring first aid',
      },
      coordinator,
      'corr-incident',
    );
    expect(service.tripReport('trip-1', coordinator)).toMatchObject({ openIncidents: 1 });
  });
});
