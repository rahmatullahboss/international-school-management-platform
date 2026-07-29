import {
  CareSecurityService,
  type CarePublicationDecision,
  type CareRequestContext,
  type CareRelationshipScope,
  type GuardianAuthoritySnapshot,
} from '../../safeguarding/src/security.js';

export type BehaviorSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type BehaviorIncidentStatus =
  'draft' | 'submitted' | 'under-review' | 'actioned' | 'resolved' | 'closed';

export interface BehaviorIncident {
  tenantId: string;
  incidentId: string;
  studentPersonId: string;
  campusId: string;
  categoryCode: string;
  severity: BehaviorSeverity;
  occurredAt: Date;
  locationCategory: string;
  sourceNarrative: string;
  reporterPrincipalId: string;
  status: BehaviorIncidentStatus;
  idempotencyKey: string;
  version: number;
  createdAt: Date;
}

export interface BehaviorStatusHistory {
  tenantId: string;
  statusHistoryId: string;
  incidentId: string;
  fromStatus?: BehaviorIncidentStatus;
  toStatus: BehaviorIncidentStatus;
  changedByPrincipalId: string;
  reasonCode: string;
  occurredAt: Date;
}

export interface BehaviorAction {
  tenantId: string;
  actionId: string;
  incidentId: string;
  studentPersonId: string;
  actionType: 'warning' | 'reflection' | 'restorative' | 'restriction' | 'support-referral';
  summary: string;
  startsAt: Date;
  endsAt?: Date;
  assignedByPrincipalId: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  recordedAt: Date;
}

export interface RestorativePlan {
  tenantId: string;
  restorativePlanId: string;
  incidentId: string;
  studentPersonId: string;
  goals: readonly string[];
  participantRoleCodes: readonly string[];
  plannedAt: Date;
  completedAt?: Date;
  outcomeSummary?: string;
  status: 'planned' | 'completed' | 'cancelled';
  createdByPrincipalId: string;
  version: number;
}

export interface BehaviorFollowUp {
  tenantId: string;
  followUpId: string;
  incidentId: string;
  studentPersonId: string;
  dueAt: Date;
  completedAt?: Date;
  outcomeCode?: 'improving' | 'stable' | 'escalated' | 'closed';
  restrictedNote?: string;
  assignedPrincipalId: string;
  status: 'open' | 'completed' | 'cancelled';
  version: number;
}

export interface BehaviorCorrection {
  tenantId: string;
  correctionId: string;
  incidentId: string;
  fieldName: 'categoryCode' | 'severity' | 'occurredAt' | 'locationCategory';
  replacementValue: string;
  reason: string;
  correctedByPrincipalId: string;
  recordedAt: Date;
}

export interface BehaviorPublication {
  tenantId: string;
  publicationId: string;
  incidentId: string;
  studentPersonId: string;
  audience: 'student' | 'guardian';
  version: number;
  categoryLabel: string;
  actionSummary?: string;
  restorativeSummary?: string;
  status: 'released' | 'revoked';
  preparedByPrincipalId: string;
  approvedByPrincipalId: string;
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface BehaviorPublicView {
  incidentId: string;
  studentPersonId: string;
  categoryLabel: string;
  actionSummary?: string;
  restorativeSummary?: string;
  publicationVersion: number;
}

export interface BehaviorEvent {
  eventType:
    | 'care.behavior.incident.submitted.v1'
    | 'care.behavior.action.assigned.v1'
    | 'care.behavior.follow-up.completed.v1'
    | 'care.behavior.publication.released.v1';
  tenantId: string;
  incidentId: string;
  studentPersonId: string;
  occurredAt: Date;
  correlationId: string;
  payload: Readonly<Record<string, string | number>>;
}

export interface BehaviorAccessScope {
  context: CareRequestContext;
  relationship?: CareRelationshipScope;
  guardianAuthority?: GuardianAuthoritySnapshot;
  publication?: CarePublicationDecision;
}

export class BehaviorDomainError extends Error {
  constructor(
    readonly code:
      | 'BEHAVIOR_NOT_FOUND'
      | 'BEHAVIOR_ACCESS_DENIED'
      | 'BEHAVIOR_INVALID_TRANSITION'
      | 'BEHAVIOR_PUBLICATION_REQUIRES_AAL2'
      | 'BEHAVIOR_INDEPENDENT_APPROVAL_REQUIRED'
      | 'BEHAVIOR_CORRECTION_INVALID'
      | 'BEHAVIOR_FOLLOW_UP_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'BehaviorDomainError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const transitions: Readonly<Record<BehaviorIncidentStatus, readonly BehaviorIncidentStatus[]>> = {
  draft: ['submitted'],
  submitted: ['under-review'],
  'under-review': ['actioned', 'resolved'],
  actioned: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

export class BehaviorService {
  readonly #security: CareSecurityService;
  readonly #now: () => Date;
  #sequence = 0;
  readonly #incidents = new Map<string, BehaviorIncident>();
  readonly #incidentByIdempotency = new Map<string, string>();
  readonly #history: BehaviorStatusHistory[] = [];
  readonly #actions = new Map<string, BehaviorAction>();
  readonly #restorativePlans = new Map<string, RestorativePlan>();
  readonly #followUps = new Map<string, BehaviorFollowUp>();
  readonly #corrections: BehaviorCorrection[] = [];
  readonly #publications = new Map<string, BehaviorPublication>();
  readonly #events: BehaviorEvent[] = [];

  constructor(security: CareSecurityService, now: () => Date = () => new Date()) {
    this.#security = security;
    this.#now = now;
  }

  recordIncident(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      studentPersonId: string;
      campusId: string;
      categoryCode: string;
      severity: BehaviorSeverity;
      occurredAt: Date;
      locationCategory: string;
      sourceNarrative: string;
      idempotencyKey: string;
    },
  ): BehaviorIncident {
    const replayKey = this.#key(input.tenantId, input.idempotencyKey);
    const existingId = this.#incidentByIdempotency.get(replayKey);
    if (existingId) {
      const existing = this.#incidents.get(this.#key(input.tenantId, existingId));
      if (!existing) throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Incident not found');
      return clone(existing);
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: `new:${input.idempotencyKey}`,
      studentPersonId: input.studentPersonId,
      classification: 'CARE-C2',
      permission: 'care.behavior.incident.create',
      action: 'create',
      fields: ['incident-category', 'severity', 'source-narrative'],
    });
    const now = this.#now();
    const incident: BehaviorIncident = {
      tenantId: input.tenantId,
      incidentId: this.#id('behavior-incident'),
      studentPersonId: input.studentPersonId,
      campusId: input.campusId,
      categoryCode: input.categoryCode,
      severity: input.severity,
      occurredAt: input.occurredAt,
      locationCategory: input.locationCategory,
      sourceNarrative: input.sourceNarrative,
      reporterPrincipalId: access.context.principalId ?? 'missing-principal',
      status: 'draft',
      idempotencyKey: input.idempotencyKey,
      version: 1,
      createdAt: now,
    };
    this.#incidents.set(this.#key(incident.tenantId, incident.incidentId), incident);
    this.#incidentByIdempotency.set(replayKey, incident.incidentId);
    this.#history.push({
      tenantId: incident.tenantId,
      statusHistoryId: this.#id('behavior-status'),
      incidentId: incident.incidentId,
      toStatus: 'draft',
      changedByPrincipalId: incident.reporterPrincipalId,
      reasonCode: 'created',
      occurredAt: now,
    });
    return clone(incident);
  }

  transitionIncident(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      incidentId: string;
      toStatus: BehaviorIncidentStatus;
      reasonCode: string;
    },
  ): BehaviorIncident {
    const key = this.#key(input.tenantId, input.incidentId);
    const incident = this.#incidents.get(key);
    if (!incident) throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Incident not found');
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      classification: incident.severity === 'critical' ? 'CARE-C3' : 'CARE-C2',
      permission: 'care.behavior.incident.manage',
      action: 'amend',
      fields: ['incident-status'],
    });
    if (!transitions[incident.status].includes(input.toStatus)) {
      throw new BehaviorDomainError(
        'BEHAVIOR_INVALID_TRANSITION',
        `Cannot transition behavior incident from ${incident.status} to ${input.toStatus}`,
      );
    }
    const updated: BehaviorIncident = {
      ...incident,
      status: input.toStatus,
      version: incident.version + 1,
    };
    this.#incidents.set(key, updated);
    const now = this.#now();
    this.#history.push({
      tenantId: input.tenantId,
      statusHistoryId: this.#id('behavior-status'),
      incidentId: input.incidentId,
      fromStatus: incident.status,
      toStatus: input.toStatus,
      changedByPrincipalId: access.context.principalId ?? 'missing-principal',
      reasonCode: input.reasonCode,
      occurredAt: now,
    });
    if (input.toStatus === 'submitted') {
      this.#emit('care.behavior.incident.submitted.v1', updated, access.context.correlationId, {
        severity: updated.severity,
        categoryCode: updated.categoryCode,
      });
    }
    return clone(updated);
  }

  assignAction(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      incidentId: string;
      actionType: BehaviorAction['actionType'];
      summary: string;
      startsAt: Date;
      endsAt?: Date;
    },
  ): BehaviorAction {
    const incident = this.#requireIncident(input.tenantId, input.incidentId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      classification: 'CARE-C2',
      permission: 'care.behavior.action.manage',
      action: 'create',
      fields: ['behavior-action'],
    });
    const action: BehaviorAction = {
      tenantId: input.tenantId,
      actionId: this.#id('behavior-action'),
      incidentId: input.incidentId,
      studentPersonId: incident.studentPersonId,
      actionType: input.actionType,
      summary: input.summary,
      startsAt: input.startsAt,
      ...(input.endsAt ? { endsAt: input.endsAt } : {}),
      assignedByPrincipalId: access.context.principalId ?? 'missing-principal',
      status: 'planned',
      recordedAt: this.#now(),
    };
    this.#actions.set(this.#key(action.tenantId, action.actionId), action);
    this.#emit('care.behavior.action.assigned.v1', incident, access.context.correlationId, {
      actionType: action.actionType,
    });
    return clone(action);
  }

  createRestorativePlan(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      incidentId: string;
      goals: readonly string[];
      participantRoleCodes: readonly string[];
      plannedAt: Date;
    },
  ): RestorativePlan {
    const incident = this.#requireIncident(input.tenantId, input.incidentId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.restorative.manage',
      action: 'create',
      fields: ['restorative-plan'],
    });
    const plan: RestorativePlan = {
      tenantId: input.tenantId,
      restorativePlanId: this.#id('restorative-plan'),
      incidentId: input.incidentId,
      studentPersonId: incident.studentPersonId,
      goals: Object.freeze([...input.goals]),
      participantRoleCodes: Object.freeze([...input.participantRoleCodes]),
      plannedAt: input.plannedAt,
      status: 'planned',
      createdByPrincipalId: access.context.principalId ?? 'missing-principal',
      version: 1,
    };
    this.#restorativePlans.set(this.#key(plan.tenantId, plan.restorativePlanId), plan);
    return clone(plan);
  }

  completeRestorativePlan(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      restorativePlanId: string;
      outcomeSummary: string;
    },
  ): RestorativePlan {
    const key = this.#key(input.tenantId, input.restorativePlanId);
    const plan = this.#restorativePlans.get(key);
    if (!plan) throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Restorative plan not found');
    if (plan.status !== 'planned') {
      throw new BehaviorDomainError('BEHAVIOR_INVALID_TRANSITION', 'Restorative plan is not open');
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: plan.incidentId,
      studentPersonId: plan.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.restorative.manage',
      action: 'amend',
      fields: ['restorative-outcome'],
    });
    const completed: RestorativePlan = {
      ...plan,
      status: 'completed',
      completedAt: this.#now(),
      outcomeSummary: input.outcomeSummary,
      version: plan.version + 1,
    };
    this.#restorativePlans.set(key, completed);
    return clone(completed);
  }

  scheduleFollowUp(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      incidentId: string;
      dueAt: Date;
      assignedPrincipalId: string;
    },
  ): BehaviorFollowUp {
    const incident = this.#requireIncident(input.tenantId, input.incidentId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.follow-up.manage',
      action: 'create',
      fields: ['behavior-follow-up'],
    });
    const followUp: BehaviorFollowUp = {
      tenantId: input.tenantId,
      followUpId: this.#id('behavior-follow-up'),
      incidentId: input.incidentId,
      studentPersonId: incident.studentPersonId,
      dueAt: input.dueAt,
      assignedPrincipalId: input.assignedPrincipalId,
      status: 'open',
      version: 1,
    };
    this.#followUps.set(this.#key(followUp.tenantId, followUp.followUpId), followUp);
    return clone(followUp);
  }

  completeFollowUp(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      followUpId: string;
      outcomeCode: NonNullable<BehaviorFollowUp['outcomeCode']>;
      restrictedNote?: string;
    },
  ): BehaviorFollowUp {
    const key = this.#key(input.tenantId, input.followUpId);
    const followUp = this.#followUps.get(key);
    if (!followUp) throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Follow-up not found');
    if (followUp.status !== 'open') {
      throw new BehaviorDomainError('BEHAVIOR_FOLLOW_UP_INVALID', 'Follow-up is not open');
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: followUp.incidentId,
      studentPersonId: followUp.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.follow-up.manage',
      action: 'amend',
      fields: ['follow-up-outcome', 'restricted-note'],
    });
    const completed: BehaviorFollowUp = {
      ...followUp,
      completedAt: this.#now(),
      outcomeCode: input.outcomeCode,
      ...(input.restrictedNote ? { restrictedNote: input.restrictedNote } : {}),
      status: 'completed',
      version: followUp.version + 1,
    };
    this.#followUps.set(key, completed);
    const incident = this.#requireIncident(input.tenantId, followUp.incidentId);
    this.#emit('care.behavior.follow-up.completed.v1', incident, access.context.correlationId, {
      outcomeCode: input.outcomeCode,
    });
    return clone(completed);
  }

  correctIncident(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      incidentId: string;
      fieldName: BehaviorCorrection['fieldName'];
      replacementValue: string;
      reason: string;
    },
  ): BehaviorCorrection {
    const incident = this.#requireIncident(input.tenantId, input.incidentId);
    if (input.reason.trim().length < 8 || input.replacementValue.trim() === '') {
      throw new BehaviorDomainError(
        'BEHAVIOR_CORRECTION_INVALID',
        'A reason and replacement value are required',
      );
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.incident.correct',
      action: 'amend',
      fields: ['incident-correction'],
    });
    const correction: BehaviorCorrection = {
      tenantId: input.tenantId,
      correctionId: this.#id('behavior-correction'),
      incidentId: input.incidentId,
      fieldName: input.fieldName,
      replacementValue: input.replacementValue,
      reason: input.reason.trim(),
      correctedByPrincipalId: access.context.principalId ?? 'missing-principal',
      recordedAt: this.#now(),
    };
    this.#corrections.push(correction);
    return clone(correction);
  }

  publishSummary(
    access: BehaviorAccessScope,
    input: {
      tenantId: string;
      incidentId: string;
      audience: 'student' | 'guardian';
      categoryLabel: string;
      actionSummary?: string;
      restorativeSummary?: string;
      expiresAt?: Date;
    },
  ): BehaviorPublication {
    const incident = this.#requireIncident(input.tenantId, input.incidentId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.publication.approve',
      action: 'amend',
      fields: ['publication-projection'],
    });
    if (access.context.assurance !== 'aal2') {
      throw new BehaviorDomainError(
        'BEHAVIOR_PUBLICATION_REQUIRES_AAL2',
        'Publication approval requires AAL2',
      );
    }
    const approver = access.context.principalId ?? 'missing-principal';
    if (incident.reporterPrincipalId === approver) {
      throw new BehaviorDomainError(
        'BEHAVIOR_INDEPENDENT_APPROVAL_REQUIRED',
        'Incident reporter cannot approve publication',
      );
    }
    const currentVersions = [...this.#publications.values()].filter(
      (publication) =>
        publication.tenantId === input.tenantId &&
        publication.incidentId === input.incidentId &&
        publication.audience === input.audience,
    );
    const publication: BehaviorPublication = {
      tenantId: input.tenantId,
      publicationId: this.#id('behavior-publication'),
      incidentId: input.incidentId,
      studentPersonId: incident.studentPersonId,
      audience: input.audience,
      version: Math.max(0, ...currentVersions.map((item) => item.version)) + 1,
      categoryLabel: input.categoryLabel,
      ...(input.actionSummary ? { actionSummary: input.actionSummary } : {}),
      ...(input.restorativeSummary ? { restorativeSummary: input.restorativeSummary } : {}),
      status: 'released',
      preparedByPrincipalId: incident.reporterPrincipalId,
      approvedByPrincipalId: approver,
      effectiveFrom: this.#now(),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    };
    for (const current of currentVersions) {
      if (current.status === 'released') {
        this.#publications.set(this.#key(current.tenantId, current.publicationId), {
          ...current,
          status: 'revoked',
        });
      }
    }
    this.#publications.set(this.#key(publication.tenantId, publication.publicationId), publication);
    this.#emit('care.behavior.publication.released.v1', incident, access.context.correlationId, {
      audience: publication.audience,
      version: publication.version,
    });
    return clone(publication);
  }

  readPublishedSummary(
    access: BehaviorAccessScope,
    tenantId: string,
    publicationId: string,
  ): BehaviorPublicView {
    const publication = this.#publications.get(this.#key(tenantId, publicationId));
    if (!publication || publication.status !== 'released') {
      throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Publication not found');
    }
    const now = this.#now();
    if (publication.expiresAt !== undefined && publication.expiresAt <= now) {
      throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Publication not found');
    }
    const decision: CarePublicationDecision = {
      tenantId,
      studentPersonId: publication.studentPersonId,
      audience: publication.audience,
      version: publication.version,
      status: 'released',
      allowedFields: ['category-label', 'action-summary', 'restorative-summary'],
      effectiveFrom: publication.effectiveFrom,
      ...(publication.expiresAt ? { expiresAt: publication.expiresAt } : {}),
    };
    const scopedAccess: BehaviorAccessScope = { ...access, publication: decision };
    this.#authorize(scopedAccess, {
      tenantId,
      incidentId: publication.incidentId,
      studentPersonId: publication.studentPersonId,
      classification: 'CARE-C2',
      permission: 'care.portal.read',
      action: 'read',
      fields: decision.allowedFields,
    });
    return {
      incidentId: publication.incidentId,
      studentPersonId: publication.studentPersonId,
      categoryLabel: publication.categoryLabel,
      ...(publication.actionSummary ? { actionSummary: publication.actionSummary } : {}),
      ...(publication.restorativeSummary
        ? { restorativeSummary: publication.restorativeSummary }
        : {}),
      publicationVersion: publication.version,
    };
  }

  readRestrictedFollowUp(
    access: BehaviorAccessScope,
    tenantId: string,
    followUpId: string,
  ): BehaviorFollowUp {
    const followUp = this.#followUps.get(this.#key(tenantId, followUpId));
    if (!followUp) throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Follow-up not found');
    this.#authorize(access, {
      tenantId,
      incidentId: followUp.incidentId,
      studentPersonId: followUp.studentPersonId,
      classification: 'CARE-C3',
      permission: 'care.behavior.follow-up.read',
      action: 'read',
      fields: ['follow-up-outcome', 'restricted-note'],
    });
    return clone(followUp);
  }

  listStatusHistory(tenantId: string, incidentId: string): readonly BehaviorStatusHistory[] {
    return this.#history
      .filter((item) => item.tenantId === tenantId && item.incidentId === incidentId)
      .map(clone);
  }

  listCorrections(tenantId: string, incidentId: string): readonly BehaviorCorrection[] {
    return this.#corrections
      .filter((item) => item.tenantId === tenantId && item.incidentId === incidentId)
      .map(clone);
  }

  listEvents(tenantId: string): readonly BehaviorEvent[] {
    return this.#events.filter((item) => item.tenantId === tenantId).map(clone);
  }

  snapshotForReports(tenantId: string): Readonly<{
    incidents: readonly BehaviorIncident[];
    actions: readonly BehaviorAction[];
    followUps: readonly BehaviorFollowUp[];
  }> {
    return {
      incidents: [...this.#incidents.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
      actions: [...this.#actions.values()].filter((item) => item.tenantId === tenantId).map(clone),
      followUps: [...this.#followUps.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
    };
  }

  #authorize(
    access: BehaviorAccessScope,
    request: {
      tenantId: string;
      incidentId: string;
      studentPersonId: string;
      classification: 'CARE-C2' | 'CARE-C3';
      permission: string;
      action: 'read' | 'create' | 'amend';
      fields: readonly string[];
    },
  ): void {
    const decision = this.#security.authorize({
      context: access.context,
      resource: {
        tenantId: request.tenantId,
        resourceId: request.incidentId,
        studentPersonId: request.studentPersonId,
        classification: request.classification,
        fields: request.fields,
      },
      action: request.action,
      permission: request.permission,
      ...(access.relationship ? { relationship: access.relationship } : {}),
      ...(access.guardianAuthority ? { guardianAuthority: access.guardianAuthority } : {}),
      ...(access.publication ? { publication: access.publication } : {}),
    });
    if (!decision.allowed) {
      throw new BehaviorDomainError(
        'BEHAVIOR_ACCESS_DENIED',
        `Behavior operation denied: ${decision.reason}`,
      );
    }
  }

  #requireIncident(tenantId: string, incidentId: string): BehaviorIncident {
    const incident = this.#incidents.get(this.#key(tenantId, incidentId));
    if (!incident) throw new BehaviorDomainError('BEHAVIOR_NOT_FOUND', 'Incident not found');
    return incident;
  }

  #emit(
    eventType: BehaviorEvent['eventType'],
    incident: BehaviorIncident,
    correlationId: string,
    payload: Readonly<Record<string, string | number>>,
  ): void {
    this.#events.push({
      eventType,
      tenantId: incident.tenantId,
      incidentId: incident.incidentId,
      studentPersonId: incident.studentPersonId,
      occurredAt: this.#now(),
      correlationId,
      payload: Object.freeze({ ...payload }),
    });
  }

  #key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  #id(prefix: string): string {
    this.#sequence += 1;
    return `${prefix}-${this.#sequence}`;
  }
}
