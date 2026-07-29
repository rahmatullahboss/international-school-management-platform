import type {
  BehaviorAction,
  BehaviorFollowUp,
  BehaviorIncident,
  BehaviorSeverity,
} from './domain.js';

export interface BehaviorReportInput {
  tenantId: string;
  incidents: readonly BehaviorIncident[];
  actions: readonly BehaviorAction[];
  followUps: readonly BehaviorFollowUp[];
  from: Date;
  to: Date;
  minimumCohortSize?: number;
}

export interface BehaviorSuppressedCount {
  value: number | null;
  suppressed: boolean;
}

export interface BehaviorOperationalReport {
  tenantId: string;
  from: Date;
  to: Date;
  incidents: BehaviorSuppressedCount;
  highOrCriticalIncidents: BehaviorSuppressedCount;
  restorativeActions: BehaviorSuppressedCount;
  openFollowUps: BehaviorSuppressedCount;
  escalatedFollowUps: BehaviorSuppressedCount;
  severityCounts: Readonly<Record<BehaviorSeverity, BehaviorSuppressedCount>>;
}

function safeCount(value: number, minimum: number): BehaviorSuppressedCount {
  return value === 0 || value >= minimum
    ? { value, suppressed: false }
    : { value: null, suppressed: true };
}

export function buildBehaviorOperationalReport(
  input: BehaviorReportInput,
): BehaviorOperationalReport {
  if (input.to < input.from) throw new Error('Report end must not precede start');
  const minimum = input.minimumCohortSize ?? 5;
  if (minimum < 3) throw new Error('Minimum cohort size must be at least 3');

  const incidents = input.incidents.filter(
    (incident) =>
      incident.tenantId === input.tenantId &&
      incident.occurredAt >= input.from &&
      incident.occurredAt <= input.to,
  );
  const incidentIds = new Set(incidents.map((incident) => incident.incidentId));
  const actions = input.actions.filter(
    (action) => action.tenantId === input.tenantId && incidentIds.has(action.incidentId),
  );
  const followUps = input.followUps.filter(
    (followUp) => followUp.tenantId === input.tenantId && incidentIds.has(followUp.incidentId),
  );

  const severityCounts = Object.freeze({
    low: safeCount(incidents.filter((item) => item.severity === 'low').length, minimum),
    moderate: safeCount(incidents.filter((item) => item.severity === 'moderate').length, minimum),
    high: safeCount(incidents.filter((item) => item.severity === 'high').length, minimum),
    critical: safeCount(incidents.filter((item) => item.severity === 'critical').length, minimum),
  });

  return {
    tenantId: input.tenantId,
    from: input.from,
    to: input.to,
    incidents: safeCount(incidents.length, minimum),
    highOrCriticalIncidents: safeCount(
      incidents.filter((item) => item.severity === 'high' || item.severity === 'critical').length,
      minimum,
    ),
    restorativeActions: safeCount(
      actions.filter((item) => item.actionType === 'restorative').length,
      minimum,
    ),
    openFollowUps: safeCount(followUps.filter((item) => item.status === 'open').length, minimum),
    escalatedFollowUps: safeCount(
      followUps.filter((item) => item.outcomeCode === 'escalated').length,
      minimum,
    ),
    severityCounts,
  };
}
