import {
  assertIdentifier,
  authorizeOperations,
  createOperationsAudit,
  createOperationsEvent,
  type OperationsAuditWriter,
  type OperationsEventPublisher,
  type OperationsPrincipal,
  type OperationsScope,
} from '../../hr/src/index.js';

export type ActivityCategory = 'club' | 'sport' | 'arts' | 'service' | 'academic';
export type EnrolmentStatus = 'confirmed' | 'waitlisted' | 'cancelled';
export type TripStatus = 'draft' | 'approved' | 'cancelled' | 'completed';
export type RiskStatus = 'pending' | 'approved' | 'rejected';
export type TripParticipantStatus = 'pending-consent' | 'confirmed' | 'waitlisted' | 'cancelled';
export type ConsentDecision = 'approved' | 'declined';
export type AttendanceStatus = 'present' | 'absent';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ActivityInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: ActivityCategory;
  readonly leaderStaffRef: string;
  readonly capacity: number;
  readonly feeMinor: number;
  readonly currency: string;
  readonly active: boolean;
}
export interface Activity extends ActivityInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface ActivityEnrolmentInput {
  readonly id: string;
  readonly activityId: string;
  readonly participantRef: string;
  readonly guardianRef: string;
  readonly joinedOn: string;
}
export interface ActivityEnrolment extends ActivityEnrolmentInput {
  readonly status: EnrolmentStatus;
  readonly financeDocumentRef: string | null;
  readonly createdBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface TripInput {
  readonly id: string;
  readonly activityId: string | null;
  readonly title: string;
  readonly destination: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly capacity: number;
  readonly budgetRef: string;
  readonly estimatedCostMinor: number;
  readonly currency: string;
  readonly medicalSupportRef: string | null;
}
export interface Trip extends TripInput {
  readonly status: TripStatus;
  readonly createdBy: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly financeDocumentRef: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface RiskHazard {
  readonly id: string;
  readonly description: string;
  readonly likelihood: number;
  readonly impact: number;
  readonly mitigation: string;
}
export interface RiskAssessmentInput {
  readonly id: string;
  readonly tripId: string;
  readonly hazards: readonly RiskHazard[];
  readonly emergencyContactRef: string;
}
export interface RiskAssessment extends Omit<RiskAssessmentInput, 'hazards'> {
  readonly hazards: readonly RiskHazard[];
  readonly totalRiskScore: number;
  readonly status: RiskStatus;
  readonly recordedBy: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface TripParticipantInput {
  readonly id: string;
  readonly tripId: string;
  readonly participantRef: string;
  readonly guardianRef: string;
  readonly medicalNoteRef: string | null;
  readonly chargeMinor: number;
}
export interface TripParticipant extends TripParticipantInput {
  readonly status: TripParticipantStatus;
  readonly consentDecision: ConsentDecision | null;
  readonly financeDocumentRef: string | null;
  readonly registeredBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface TripConsentInput {
  readonly id: string;
  readonly tripParticipantId: string;
  readonly guardianRef: string;
  readonly decision: ConsentDecision;
  readonly signedAt: string;
}
export interface TripConsent extends TripConsentInput {
  readonly recordedBy: string;
  readonly version: number;
}

export interface TripAttendanceInput {
  readonly id: string;
  readonly tripId: string;
  readonly participantRef: string;
  readonly status: AttendanceStatus;
  readonly recordedAt: string;
  readonly idempotencyKey: string;
}
export interface TripAttendance extends TripAttendanceInput {
  readonly recordedBy: string;
  readonly version: number;
}

export interface TripIncidentInput {
  readonly id: string;
  readonly tripId: string;
  readonly participantRefs: readonly string[];
  readonly severity: IncidentSeverity;
  readonly occurredAt: string;
  readonly description: string;
}
export interface TripIncident extends Omit<TripIncidentInput, 'participantRefs'> {
  readonly participantRefs: readonly string[];
  readonly status: 'open' | 'resolved';
  readonly recordedBy: string;
  readonly resolvedAt: string | null;
  readonly version: number;
}

export interface ActivitiesFinanceSourceDocument {
  readonly contractVersion: '1.0';
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly sourceType: 'activity-fee' | 'trip-participant-fee' | 'trip-payable';
  readonly sourceId: string;
  readonly personRef?: string;
  readonly budgetRef?: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredOn: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}
export interface ActivitiesFinanceGateway {
  submitSourceDocument(document: ActivitiesFinanceSourceDocument): string;
}
export class InMemoryActivitiesFinanceGateway implements ActivitiesFinanceGateway {
  readonly #documents: ActivitiesFinanceSourceDocument[] = [];
  readonly #refs = new Map<string, string>();

  get documents(): readonly ActivitiesFinanceSourceDocument[] {
    return Object.freeze([...this.#documents]);
  }

  submitSourceDocument(document: ActivitiesFinanceSourceDocument): string {
    const existing = this.#refs.get(document.idempotencyKey);
    if (existing) return existing;
    const reference = `fin-activities:${document.sourceType}:${document.sourceId}`;
    this.#documents.push(Object.freeze({ ...document }));
    this.#refs.set(document.idempotencyKey, reference);
    return reference;
  }
}

export interface TripReport {
  readonly tripId: string;
  readonly status: TripStatus;
  readonly confirmedParticipants: number;
  readonly waitlistedParticipants: number;
  readonly pendingConsentParticipants: number;
  readonly presentParticipants: number;
  readonly absentParticipants: number;
  readonly missingAttendanceParticipantRefs: readonly string[];
  readonly openIncidents: number;
  readonly consentCompletionBasisPoints: number;
}

interface Clock {
  now(): Date;
}
const systemClock: Clock = { now: () => new Date() };
function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}
function dateOnly(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`OPS_INVALID_DATE:${field}`);
  }
  return value;
}
function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`OPS_INVALID_TIMESTAMP:${field}`);
  return parsed.toISOString();
}
function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`OPS_INVALID_MONEY:${field}`);
}

export class ActivitiesTripsService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #finance: ActivitiesFinanceGateway;
  readonly #clock: Clock;
  readonly #activities = new Map<string, Activity>();
  readonly #activityCodes = new Set<string>();
  readonly #enrolments = new Map<string, ActivityEnrolment>();
  readonly #trips = new Map<string, Trip>();
  readonly #risks = new Map<string, RiskAssessment>();
  readonly #tripParticipants = new Map<string, TripParticipant>();
  readonly #consents = new Map<string, TripConsent>();
  readonly #attendance = new Map<string, TripAttendance>();
  readonly #attendanceKeys = new Map<string, string>();
  readonly #incidents = new Map<string, TripIncident>();

  constructor(
    scope: OperationsScope,
    events: OperationsEventPublisher,
    audit: OperationsAuditWriter,
    finance: ActivitiesFinanceGateway,
    clock: Clock = systemClock,
  ) {
    this.#scope = frozen(scope);
    this.#events = events;
    this.#audit = audit;
    this.#finance = finance;
    this.#clock = clock;
  }

  registerActivity(
    input: ActivityInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Activity {
    authorizeOperations(principal, 'operations.activities.catalog.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      code: input.code,
      name: input.name,
      leaderStaffRef: input.leaderStaffRef,
      currency: input.currency,
    })) {
      assertIdentifier(value, `activity.${field}`);
    }
    if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
      throw new Error('OPS_ACTIVITIES_INVALID_CAPACITY');
    }
    assertMoney(input.feeMinor, 'activity.feeMinor');
    const code = input.code.trim().toUpperCase();
    if (this.#activities.has(input.id) || this.#activityCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_ACTIVITY');
    }
    const activity: Activity = frozen({
      ...input,
      code,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#activities.set(activity.id, activity);
    this.#activityCodes.add(activity.code);
    this.#record(
      'operations.activities.activity-registered.v1',
      'activity',
      activity.id,
      1,
      'operations.activities.activity.register',
      principal,
      correlationId,
      { code: activity.code, capacity: activity.capacity },
    );
    return activity;
  }

  enrolParticipant(
    input: ActivityEnrolmentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): ActivityEnrolment {
    authorizeOperations(principal, 'operations.activities.enrolment.write', this.#scope);
    this.#correlation(correlationId);
    const activity = this.#requireActivity(input.activityId);
    if (!activity.active) throw new Error('OPS_ACTIVITY_INACTIVE');
    for (const [field, value] of Object.entries({
      id: input.id,
      participantRef: input.participantRef,
      guardianRef: input.guardianRef,
    })) {
      assertIdentifier(value, `activityEnrolment.${field}`);
    }
    dateOnly(input.joinedOn, 'activityEnrolment.joinedOn');
    if (this.#enrolments.has(input.id)) throw new Error('OPS_DUPLICATE_ACTIVITY_ENROLMENT');
    if (
      [...this.#enrolments.values()].some(
        (enrolment) =>
          enrolment.activityId === input.activityId &&
          enrolment.participantRef === input.participantRef &&
          enrolment.status !== 'cancelled',
      )
    ) {
      throw new Error('OPS_DUPLICATE_ACTIVITY_ENROLMENT');
    }
    const confirmed = this.#confirmedEnrolments(activity.id).length;
    const status: EnrolmentStatus = confirmed < activity.capacity ? 'confirmed' : 'waitlisted';
    let financeDocumentRef: string | null = null;
    if (status === 'confirmed' && activity.feeMinor > 0) {
      financeDocumentRef = this.#submitFinance(
        {
          sourceType: 'activity-fee',
          sourceId: input.id,
          personRef: input.participantRef,
          amountMinor: activity.feeMinor,
          currency: activity.currency,
          occurredOn: input.joinedOn,
        },
        correlationId,
      );
    }
    const enrolment: ActivityEnrolment = frozen({
      ...input,
      status,
      financeDocumentRef,
      createdBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#enrolments.set(enrolment.id, enrolment);
    this.#record(
      'operations.activities.participant-enrolled.v1',
      'activity-enrolment',
      enrolment.id,
      1,
      'operations.activities.enrolment.create',
      principal,
      correlationId,
      { activityId: enrolment.activityId, participantRef: enrolment.participantRef, status },
    );
    return enrolment;
  }

  cancelEnrolment(
    enrolmentId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): ActivityEnrolment {
    authorizeOperations(principal, 'operations.activities.enrolment.write', this.#scope);
    const enrolment = this.#requireEnrolment(enrolmentId);
    if (enrolment.status === 'cancelled') return enrolment;
    const previousStatus = enrolment.status;
    const cancelled: ActivityEnrolment = frozen({
      ...enrolment,
      status: 'cancelled',
      version: enrolment.version + 1,
    });
    this.#enrolments.set(cancelled.id, cancelled);
    if (previousStatus === 'confirmed')
      this.#promoteActivityWaitlist(enrolment.activityId, correlationId);
    this.#record(
      'operations.activities.enrolment-cancelled.v1',
      'activity-enrolment',
      cancelled.id,
      cancelled.version,
      'operations.activities.enrolment.cancel',
      principal,
      correlationId,
      { activityId: cancelled.activityId },
    );
    return cancelled;
  }

  createTrip(input: TripInput, principal: OperationsPrincipal, correlationId: string): Trip {
    authorizeOperations(principal, 'operations.activities.trip.write', this.#scope);
    this.#correlation(correlationId);
    if (input.activityId !== null) this.#requireActivity(input.activityId);
    for (const [field, value] of Object.entries({
      id: input.id,
      title: input.title,
      destination: input.destination,
      budgetRef: input.budgetRef,
      currency: input.currency,
    })) {
      assertIdentifier(value, `trip.${field}`);
    }
    if (input.medicalSupportRef !== null) {
      assertIdentifier(input.medicalSupportRef, 'trip.medicalSupportRef');
    }
    const startsAt = timestamp(input.startsAt, 'trip.startsAt');
    const endsAt = timestamp(input.endsAt, 'trip.endsAt');
    if (endsAt <= startsAt) throw new Error('OPS_INVALID_TIMESTAMP_ORDER');
    if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
      throw new Error('OPS_TRIP_INVALID_CAPACITY');
    }
    assertMoney(input.estimatedCostMinor, 'trip.estimatedCostMinor');
    if (this.#trips.has(input.id)) throw new Error('OPS_DUPLICATE_TRIP');
    const trip: Trip = frozen({
      ...input,
      startsAt,
      endsAt,
      status: 'draft',
      createdBy: principal.principalId,
      approvedBy: null,
      approvedAt: null,
      financeDocumentRef: null,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#trips.set(trip.id, trip);
    this.#record(
      'operations.activities.trip-created.v1',
      'activity-trip',
      trip.id,
      1,
      'operations.activities.trip.create',
      principal,
      correlationId,
      { destination: trip.destination, capacity: trip.capacity, budgetRef: trip.budgetRef },
    );
    return trip;
  }

  recordRiskAssessment(
    input: RiskAssessmentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): RiskAssessment {
    authorizeOperations(principal, 'operations.activities.trip.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireTrip(input.tripId);
    assertIdentifier(input.id, 'riskAssessment.id');
    assertIdentifier(input.emergencyContactRef, 'riskAssessment.emergencyContactRef');
    if (input.hazards.length === 0) throw new Error('OPS_TRIP_RISK_HAZARD_REQUIRED');
    if (
      this.#risks.has(input.id) ||
      [...this.#risks.values()].some((risk) => risk.tripId === input.tripId)
    ) {
      throw new Error('OPS_DUPLICATE_TRIP_RISK');
    }
    const hazardIds = new Set<string>();
    const hazards = input.hazards.map((hazard): RiskHazard => {
      assertIdentifier(hazard.id, 'riskHazard.id');
      assertIdentifier(hazard.description, 'riskHazard.description');
      assertIdentifier(hazard.mitigation, 'riskHazard.mitigation');
      if (hazardIds.has(hazard.id)) throw new Error('OPS_DUPLICATE_RISK_HAZARD');
      if (
        !Number.isInteger(hazard.likelihood) ||
        !Number.isInteger(hazard.impact) ||
        hazard.likelihood < 1 ||
        hazard.likelihood > 5 ||
        hazard.impact < 1 ||
        hazard.impact > 5
      ) {
        throw new Error('OPS_INVALID_RISK_SCORE');
      }
      hazardIds.add(hazard.id);
      return frozen(hazard);
    });
    const risk: RiskAssessment = frozen({
      ...input,
      hazards: Object.freeze(hazards),
      totalRiskScore: hazards.reduce(
        (total, hazard) => total + hazard.likelihood * hazard.impact,
        0,
      ),
      status: 'pending',
      recordedBy: principal.principalId,
      approvedBy: null,
      approvedAt: null,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#risks.set(risk.id, risk);
    this.#record(
      'operations.activities.trip-risk-recorded.v1',
      'trip-risk-assessment',
      risk.id,
      1,
      'operations.activities.risk.record',
      principal,
      correlationId,
      { tripId: risk.tripId, totalRiskScore: risk.totalRiskScore },
    );
    return risk;
  }

  approveRiskAssessment(
    riskId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): RiskAssessment {
    const risk = this.#requireRisk(riskId);
    if (risk.recordedBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:risk-record-approve');
    }
    authorizeOperations(principal, 'operations.activities.risk.approve', this.#scope, {
      requireAal2: true,
    });
    if (risk.status === 'approved') return risk;
    if (risk.status !== 'pending') throw new Error('OPS_INVALID_RISK_STATE');
    const approved: RiskAssessment = frozen({
      ...risk,
      status: 'approved',
      approvedBy: principal.principalId,
      approvedAt: this.#clock.now().toISOString(),
      version: risk.version + 1,
    });
    this.#risks.set(approved.id, approved);
    this.#record(
      'operations.activities.trip-risk-approved.v1',
      'trip-risk-assessment',
      approved.id,
      approved.version,
      'operations.activities.risk.approve',
      principal,
      correlationId,
      { tripId: approved.tripId, totalRiskScore: approved.totalRiskScore },
    );
    return approved;
  }

  registerTripParticipant(
    input: TripParticipantInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TripParticipant {
    authorizeOperations(principal, 'operations.activities.trip.write', this.#scope);
    this.#correlation(correlationId);
    const trip = this.#requireTrip(input.tripId);
    if (trip.status !== 'draft') throw new Error('OPS_TRIP_NOT_EDITABLE');
    for (const [field, value] of Object.entries({
      id: input.id,
      participantRef: input.participantRef,
      guardianRef: input.guardianRef,
    })) {
      assertIdentifier(value, `tripParticipant.${field}`);
    }
    if (input.medicalNoteRef !== null) {
      assertIdentifier(input.medicalNoteRef, 'tripParticipant.medicalNoteRef');
    }
    assertMoney(input.chargeMinor, 'tripParticipant.chargeMinor');
    if (this.#tripParticipants.has(input.id)) throw new Error('OPS_DUPLICATE_TRIP_PARTICIPANT');
    if (
      [...this.#tripParticipants.values()].some(
        (participant) =>
          participant.tripId === input.tripId &&
          participant.participantRef === input.participantRef &&
          participant.status !== 'cancelled',
      )
    ) {
      throw new Error('OPS_DUPLICATE_TRIP_PARTICIPANT');
    }
    const participant: TripParticipant = frozen({
      ...input,
      status: 'pending-consent',
      consentDecision: null,
      financeDocumentRef: null,
      registeredBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#tripParticipants.set(participant.id, participant);
    this.#record(
      'operations.activities.trip-participant-registered.v1',
      'trip-participant',
      participant.id,
      1,
      'operations.activities.trip.participant.register',
      principal,
      correlationId,
      { tripId: participant.tripId, participantRef: participant.participantRef },
    );
    return participant;
  }

  recordConsent(
    input: TripConsentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TripConsent {
    authorizeOperations(principal, 'operations.activities.consent.write', this.#scope);
    this.#correlation(correlationId);
    const participant = this.#requireTripParticipant(input.tripParticipantId);
    if (participant.status === 'cancelled') throw new Error('OPS_TRIP_PARTICIPANT_CANCELLED');
    assertIdentifier(input.id, 'tripConsent.id');
    assertIdentifier(input.guardianRef, 'tripConsent.guardianRef');
    const signedAt = timestamp(input.signedAt, 'tripConsent.signedAt');
    if (input.guardianRef !== participant.guardianRef) {
      throw new Error('OPS_TRIP_GUARDIAN_MISMATCH');
    }
    if (
      this.#consents.has(input.id) ||
      [...this.#consents.values()].some((consent) => consent.tripParticipantId === participant.id)
    ) {
      throw new Error('OPS_DUPLICATE_TRIP_CONSENT');
    }
    const consent: TripConsent = frozen({
      ...input,
      signedAt,
      recordedBy: principal.principalId,
      version: 1,
    });
    this.#consents.set(consent.id, consent);
    let status: TripParticipantStatus = 'cancelled';
    let financeDocumentRef: string | null = null;
    if (consent.decision === 'approved') {
      const trip = this.#requireTrip(participant.tripId);
      status =
        this.#confirmedTripParticipants(trip.id).length < trip.capacity
          ? 'confirmed'
          : 'waitlisted';
      if (status === 'confirmed' && participant.chargeMinor > 0) {
        financeDocumentRef = this.#submitFinance(
          {
            sourceType: 'trip-participant-fee',
            sourceId: participant.id,
            personRef: participant.participantRef,
            amountMinor: participant.chargeMinor,
            currency: trip.currency,
            occurredOn: signedAt.slice(0, 10),
          },
          correlationId,
        );
      }
    }
    const updated: TripParticipant = frozen({
      ...participant,
      status,
      consentDecision: consent.decision,
      financeDocumentRef,
      version: participant.version + 1,
    });
    this.#tripParticipants.set(updated.id, updated);
    this.#record(
      'operations.activities.trip-consent-recorded.v1',
      'trip-consent',
      consent.id,
      1,
      'operations.activities.consent.record',
      principal,
      correlationId,
      { tripParticipantId: participant.id, decision: consent.decision, participantStatus: status },
    );
    return consent;
  }

  cancelTripParticipant(
    participantId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TripParticipant {
    authorizeOperations(principal, 'operations.activities.trip.write', this.#scope);
    const participant = this.#requireTripParticipant(participantId);
    if (participant.status === 'cancelled') return participant;
    const previousStatus = participant.status;
    const cancelled: TripParticipant = frozen({
      ...participant,
      status: 'cancelled',
      version: participant.version + 1,
    });
    this.#tripParticipants.set(cancelled.id, cancelled);
    if (previousStatus === 'confirmed') this.#promoteTripWaitlist(cancelled.tripId, correlationId);
    this.#record(
      'operations.activities.trip-participant-cancelled.v1',
      'trip-participant',
      cancelled.id,
      cancelled.version,
      'operations.activities.trip.participant.cancel',
      principal,
      correlationId,
      { tripId: cancelled.tripId, participantRef: cancelled.participantRef },
    );
    return cancelled;
  }

  approveTrip(tripId: string, principal: OperationsPrincipal, correlationId: string): Trip {
    const trip = this.#requireTrip(tripId);
    if (trip.createdBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:trip-create-approve');
    }
    authorizeOperations(principal, 'operations.activities.trip.approve', this.#scope, {
      requireAal2: true,
    });
    if (trip.status === 'approved') return trip;
    if (trip.status !== 'draft') throw new Error('OPS_INVALID_TRIP_STATE');
    const risk = [...this.#risks.values()].find((candidate) => candidate.tripId === trip.id);
    if (!risk || risk.status !== 'approved') throw new Error('OPS_TRIP_RISK_NOT_APPROVED');
    const incomplete = [...this.#tripParticipants.values()]
      .filter(
        (participant) => participant.tripId === trip.id && participant.status === 'pending-consent',
      )
      .map((participant) => participant.participantRef)
      .sort();
    if (incomplete.length > 0) {
      throw new Error(`OPS_TRIP_CONSENT_INCOMPLETE:${incomplete.join(',')}`);
    }
    const approvedAt = this.#clock.now().toISOString();
    const financeDocumentRef =
      trip.estimatedCostMinor === 0
        ? null
        : this.#submitFinance(
            {
              sourceType: 'trip-payable',
              sourceId: trip.id,
              budgetRef: trip.budgetRef,
              amountMinor: trip.estimatedCostMinor,
              currency: trip.currency,
              occurredOn: approvedAt.slice(0, 10),
            },
            correlationId,
          );
    const approved: Trip = frozen({
      ...trip,
      status: 'approved',
      approvedBy: principal.principalId,
      approvedAt,
      financeDocumentRef,
      version: trip.version + 1,
    });
    this.#trips.set(approved.id, approved);
    this.#record(
      'operations.activities.trip-approved.v1',
      'activity-trip',
      approved.id,
      approved.version,
      'operations.activities.trip.approve',
      principal,
      correlationId,
      { budgetRef: approved.budgetRef, financeDocumentRef },
    );
    return approved;
  }

  recordTripAttendance(
    input: TripAttendanceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TripAttendance {
    authorizeOperations(principal, 'operations.activities.attendance.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireTrip(input.tripId);
    const existingId = this.#attendanceKeys.get(input.idempotencyKey);
    if (existingId) return this.#attendance.get(existingId)!;
    const participant = [...this.#tripParticipants.values()].find(
      (candidate) =>
        candidate.tripId === input.tripId &&
        candidate.participantRef === input.participantRef &&
        candidate.status === 'confirmed',
    );
    if (!participant) throw new Error('OPS_TRIP_PARTICIPANT_NOT_CONFIRMED');
    for (const [field, value] of Object.entries({
      id: input.id,
      participantRef: input.participantRef,
      idempotencyKey: input.idempotencyKey,
    })) {
      assertIdentifier(value, `tripAttendance.${field}`);
    }
    const recordedAt = timestamp(input.recordedAt, 'tripAttendance.recordedAt');
    if (this.#attendance.has(input.id)) throw new Error('OPS_DUPLICATE_TRIP_ATTENDANCE');
    if (
      [...this.#attendance.values()].some(
        (attendance) =>
          attendance.tripId === input.tripId && attendance.participantRef === input.participantRef,
      )
    ) {
      throw new Error('OPS_DUPLICATE_TRIP_ATTENDANCE');
    }
    const attendance: TripAttendance = frozen({
      ...input,
      recordedAt,
      recordedBy: principal.principalId,
      version: 1,
    });
    this.#attendance.set(attendance.id, attendance);
    this.#attendanceKeys.set(attendance.idempotencyKey, attendance.id);
    this.#record(
      'operations.activities.trip-attendance-recorded.v1',
      'trip-attendance',
      attendance.id,
      1,
      'operations.activities.attendance.record',
      principal,
      correlationId,
      {
        tripId: attendance.tripId,
        participantRef: attendance.participantRef,
        status: attendance.status,
      },
    );
    return attendance;
  }

  recordTripIncident(
    input: TripIncidentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TripIncident {
    authorizeOperations(principal, 'operations.activities.incident.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireTrip(input.tripId);
    assertIdentifier(input.id, 'tripIncident.id');
    if (input.description.trim().length < 5)
      throw new Error('OPS_TRIP_INCIDENT_DESCRIPTION_REQUIRED');
    const occurredAt = timestamp(input.occurredAt, 'tripIncident.occurredAt');
    if (this.#incidents.has(input.id)) throw new Error('OPS_DUPLICATE_TRIP_INCIDENT');
    const incident: TripIncident = frozen({
      ...input,
      participantRefs: Object.freeze([...new Set(input.participantRefs)].sort()),
      occurredAt,
      description: input.description.trim(),
      status: 'open',
      recordedBy: principal.principalId,
      resolvedAt: null,
      version: 1,
    });
    this.#incidents.set(incident.id, incident);
    this.#record(
      'operations.activities.trip-incident-recorded.v1',
      'trip-incident',
      incident.id,
      1,
      'operations.activities.incident.record',
      principal,
      correlationId,
      {
        tripId: incident.tripId,
        severity: incident.severity,
        participantRefs: incident.participantRefs,
      },
    );
    return incident;
  }

  tripReport(tripId: string, principal: OperationsPrincipal): TripReport {
    authorizeOperations(principal, 'operations.activities.report.read', this.#scope);
    const trip = this.#requireTrip(tripId);
    const participants = [...this.#tripParticipants.values()].filter(
      (participant) => participant.tripId === trip.id && participant.status !== 'cancelled',
    );
    const confirmed = participants.filter((participant) => participant.status === 'confirmed');
    const attendance = [...this.#attendance.values()].filter((entry) => entry.tripId === trip.id);
    const attendedRefs = new Set(attendance.map((entry) => entry.participantRef));
    const approvedConsent = participants.filter(
      (participant) => participant.consentDecision === 'approved',
    ).length;
    return frozen({
      tripId: trip.id,
      status: trip.status,
      confirmedParticipants: confirmed.length,
      waitlistedParticipants: participants.filter(
        (participant) => participant.status === 'waitlisted',
      ).length,
      pendingConsentParticipants: participants.filter(
        (participant) => participant.status === 'pending-consent',
      ).length,
      presentParticipants: attendance.filter((entry) => entry.status === 'present').length,
      absentParticipants: attendance.filter((entry) => entry.status === 'absent').length,
      missingAttendanceParticipantRefs: Object.freeze(
        confirmed
          .filter((participant) => !attendedRefs.has(participant.participantRef))
          .map((participant) => participant.participantRef)
          .sort(),
      ),
      openIncidents: [...this.#incidents.values()].filter(
        (incident) => incident.tripId === trip.id && incident.status === 'open',
      ).length,
      consentCompletionBasisPoints:
        participants.length === 0
          ? 0
          : Math.round((approvedConsent * 10_000) / participants.length),
    });
  }

  findEnrolment(id: string): ActivityEnrolment | undefined {
    return this.#enrolments.get(id);
  }

  findTripParticipant(id: string): TripParticipant | undefined {
    return this.#tripParticipants.get(id);
  }

  #promoteActivityWaitlist(activityId: string, correlationId: string): void {
    const activity = this.#requireActivity(activityId);
    const waiting = [...this.#enrolments.values()]
      .filter(
        (enrolment) => enrolment.activityId === activityId && enrolment.status === 'waitlisted',
      )
      .sort(
        (left, right) =>
          left.joinedOn.localeCompare(right.joinedOn) ||
          left.createdAt.localeCompare(right.createdAt),
      )[0];
    if (!waiting || this.#confirmedEnrolments(activityId).length >= activity.capacity) return;
    const financeDocumentRef =
      activity.feeMinor === 0
        ? null
        : this.#submitFinance(
            {
              sourceType: 'activity-fee',
              sourceId: waiting.id,
              personRef: waiting.participantRef,
              amountMinor: activity.feeMinor,
              currency: activity.currency,
              occurredOn: waiting.joinedOn,
            },
            correlationId,
          );
    this.#enrolments.set(
      waiting.id,
      frozen({
        ...waiting,
        status: 'confirmed',
        financeDocumentRef,
        version: waiting.version + 1,
      }),
    );
  }

  #promoteTripWaitlist(tripId: string, correlationId: string): void {
    const trip = this.#requireTrip(tripId);
    const waiting = [...this.#tripParticipants.values()]
      .filter(
        (participant) => participant.tripId === trip.id && participant.status === 'waitlisted',
      )
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      )[0];
    if (!waiting || this.#confirmedTripParticipants(trip.id).length >= trip.capacity) return;
    const financeDocumentRef =
      waiting.chargeMinor === 0
        ? null
        : this.#submitFinance(
            {
              sourceType: 'trip-participant-fee',
              sourceId: waiting.id,
              personRef: waiting.participantRef,
              amountMinor: waiting.chargeMinor,
              currency: trip.currency,
              occurredOn: this.#clock.now().toISOString().slice(0, 10),
            },
            correlationId,
          );
    this.#tripParticipants.set(
      waiting.id,
      frozen({
        ...waiting,
        status: 'confirmed',
        financeDocumentRef,
        version: waiting.version + 1,
      }),
    );
  }

  #submitFinance(
    input: Omit<
      ActivitiesFinanceSourceDocument,
      | 'contractVersion'
      | 'tenantId'
      | 'legalEntityId'
      | 'campusId'
      | 'correlationId'
      | 'idempotencyKey'
    >,
    correlationId: string,
  ): string {
    return this.#finance.submitSourceDocument(
      frozen({
        contractVersion: '1.0',
        tenantId: this.#scope.tenantId,
        legalEntityId: this.#scope.legalEntityId,
        campusId: this.#scope.campusId,
        ...input,
        correlationId,
        idempotencyKey: `${input.sourceType}:${input.sourceId}`,
      }),
    );
  }

  #confirmedEnrolments(activityId: string): readonly ActivityEnrolment[] {
    return [...this.#enrolments.values()].filter(
      (enrolment) => enrolment.activityId === activityId && enrolment.status === 'confirmed',
    );
  }

  #confirmedTripParticipants(tripId: string): readonly TripParticipant[] {
    return [...this.#tripParticipants.values()].filter(
      (participant) => participant.tripId === tripId && participant.status === 'confirmed',
    );
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
    this.#correlation(correlationId);
    const occurredAt = this.#clock.now().toISOString();
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
        occurredAt,
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
        occurredAt,
      }),
    );
  }

  #correlation(value: string): void {
    assertIdentifier(value, 'correlationId');
  }
  #requireActivity(id: string): Activity {
    const value = this.#activities.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:activity');
    return value;
  }
  #requireEnrolment(id: string): ActivityEnrolment {
    const value = this.#enrolments.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:activity-enrolment');
    return value;
  }
  #requireTrip(id: string): Trip {
    const value = this.#trips.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:trip');
    return value;
  }
  #requireRisk(id: string): RiskAssessment {
    const value = this.#risks.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:risk-assessment');
    return value;
  }
  #requireTripParticipant(id: string): TripParticipant {
    const value = this.#tripParticipants.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:trip-participant');
    return value;
  }
}
