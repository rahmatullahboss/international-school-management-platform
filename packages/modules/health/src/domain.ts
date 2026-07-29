import {
  CareSecurityService,
  type BreakGlassGrant,
  type CareAuthorizationDecision,
  type CarePublicationDecision,
  type CareRequestContext,
  type CareRelationshipScope,
  type GuardianAuthoritySnapshot,
} from '../../safeguarding/src/security.js';

export type HealthRecordStatus = 'active' | 'resolved' | 'entered-in-error';
export type LegalBasisCode =
  | 'consent'
  | 'vital-interests'
  | 'legal-obligation'
  | 'public-task';

export interface LegalBasisEvidence {
  basis: LegalBasisCode;
  evidenceReference: string;
  status: 'active' | 'withdrawn' | 'expired';
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface HealthProfile {
  tenantId: string;
  profileId: string;
  studentPersonId: string;
  bloodGroup?: string;
  primaryClinicCampusId?: string;
  emergencyInstructions?: string;
  status: HealthRecordStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCondition {
  tenantId: string;
  conditionId: string;
  profileId: string;
  studentPersonId: string;
  code: string;
  display: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  status: HealthRecordStatus;
  onsetDate?: string;
  recordedAt: Date;
}

export interface HealthAllergy {
  tenantId: string;
  allergyId: string;
  profileId: string;
  studentPersonId: string;
  substanceCode: string;
  display: string;
  reaction?: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  status: HealthRecordStatus;
  recordedAt: Date;
}

export interface MedicationOrder {
  tenantId: string;
  medicationOrderId: string;
  profileId: string;
  studentPersonId: string;
  medicationCode: string;
  display: string;
  ingredientCodes: readonly string[];
  dose: string;
  route: string;
  schedule: string;
  startsAt: Date;
  endsAt?: Date;
  status: 'active' | 'held' | 'completed' | 'cancelled';
  prescriberReference: string;
  authorizationDocumentReference: string;
  recordedAt: Date;
}

export interface MedicationAdministration {
  tenantId: string;
  administrationId: string;
  medicationOrderId: string;
  profileId: string;
  studentPersonId: string;
  administeredAt: Date;
  dose: string;
  route: string;
  administratorPrincipalId: string;
  outcome: 'given' | 'refused' | 'omitted' | 'partial';
  reasonCode?: string;
  idempotencyKey: string;
  recordedAt: Date;
}

export interface MedicationAdministrationCorrection {
  tenantId: string;
  correctionId: string;
  administrationId: string;
  correctedByPrincipalId: string;
  reason: string;
  replacementOutcome?: MedicationAdministration['outcome'];
  replacementDose?: string;
  recordedAt: Date;
}

export interface ImmunizationRecord {
  tenantId: string;
  immunizationId: string;
  profileId: string;
  studentPersonId: string;
  vaccineCode: string;
  administeredOn: string;
  doseNumber?: string;
  evidenceReference: string;
  status: HealthRecordStatus;
  recordedAt: Date;
}

export interface HealthCarePlan {
  tenantId: string;
  carePlanId: string;
  profileId: string;
  studentPersonId: string;
  title: string;
  goals: readonly string[];
  actions: readonly string[];
  emergencyActions: readonly string[];
  validFrom: Date;
  validTo?: Date;
  status: 'draft' | 'active' | 'superseded' | 'closed';
  approvedByPrincipalId?: string;
  version: number;
  recordedAt: Date;
}

export interface ClinicEncounter {
  tenantId: string;
  encounterId: string;
  profileId: string;
  studentPersonId: string;
  campusId: string;
  openedAt: Date;
  openedByPrincipalId: string;
  reasonCategory: string;
  narrative: string;
  status: 'open' | 'closed';
  closedAt?: Date;
  disposition?: 'returned-to-class' | 'sent-home' | 'emergency-transfer' | 'follow-up';
  followUpAt?: Date;
  version: number;
}

export interface RestrictedHealthDocument {
  tenantId: string;
  healthDocumentId: string;
  profileId: string;
  studentPersonId: string;
  documentId: string;
  documentType: string;
  classification: 'CARE-C3';
  sourceClassification: 'CARE-C3';
  status: 'active' | 'superseded' | 'quarantined';
  recordedAt: Date;
}

export interface EmergencyHealthProjection {
  tenantId: string;
  studentPersonId: string;
  profileId: string;
  projectionVersion: number;
  bloodGroup?: string;
  lifeThreateningAllergies: readonly { substanceCode: string; display: string }[];
  activeMedicationSummaries: readonly { medicationCode: string; display: string; dose: string; route: string }[];
  emergencyActions: readonly string[];
  generatedAt: Date;
}

export interface HealthDomainEvent {
  eventType:
    | 'care.health.profile.created.v1'
    | 'care.health.allergy.recorded.v1'
    | 'care.health.medication.ordered.v1'
    | 'care.health.medication.administered.v1'
    | 'care.health.encounter.closed.v1';
  tenantId: string;
  aggregateId: string;
  studentPersonId: string;
  classification: 'CARE-C3' | 'CARE-E';
  occurredAt: Date;
  correlationId: string;
  payload: Readonly<Record<string, string | number>>;
}

export interface HealthAccessScope {
  context: CareRequestContext;
  relationship?: CareRelationshipScope;
  guardianAuthority?: GuardianAuthoritySnapshot;
  publication?: CarePublicationDecision;
  breakGlass?: BreakGlassGrant;
}

export class HealthDomainError extends Error {
  constructor(
    readonly code:
      | 'HEALTH_NOT_FOUND'
      | 'HEALTH_ACCESS_DENIED'
      | 'HEALTH_LEGAL_BASIS_INVALID'
      | 'HEALTH_MEDICATION_ORDER_INACTIVE'
      | 'HEALTH_ALLERGY_CONTRAINDICATION'
      | 'HEALTH_DUPLICATE_ADMINISTRATION'
      | 'HEALTH_ENCOUNTER_STATE_INVALID'
      | 'HEALTH_CORRECTION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'HealthDomainError';
  }
}

function activeEvidence(evidence: LegalBasisEvidence, now: Date): boolean {
  return (
    evidence.status === 'active' &&
    evidence.effectiveFrom <= now &&
    (evidence.expiresAt === undefined || evidence.expiresAt > now) &&
    evidence.evidenceReference.trim().length > 0
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class HealthService {
  readonly #security: CareSecurityService;
  readonly #now: () => Date;
  #sequence = 0;
  readonly #profiles = new Map<string, HealthProfile>();
  readonly #conditions = new Map<string, HealthCondition>();
  readonly #allergies = new Map<string, HealthAllergy>();
  readonly #medicationOrders = new Map<string, MedicationOrder>();
  readonly #administrations = new Map<string, MedicationAdministration>();
  readonly #administrationByIdempotency = new Map<string, string>();
  readonly #corrections = new Map<string, MedicationAdministrationCorrection>();
  readonly #immunizations = new Map<string, ImmunizationRecord>();
  readonly #carePlans = new Map<string, HealthCarePlan>();
  readonly #encounters = new Map<string, ClinicEncounter>();
  readonly #documents = new Map<string, RestrictedHealthDocument>();
  readonly #events: HealthDomainEvent[] = [];

  constructor(security: CareSecurityService, now: () => Date = () => new Date()) {
    this.#security = security;
    this.#now = now;
  }

  createProfile(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      studentPersonId: string;
      legalBasis: LegalBasisEvidence;
      bloodGroup?: string;
      primaryClinicCampusId?: string;
      emergencyInstructions?: string;
    },
  ): HealthProfile {
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: `health-profile:${input.studentPersonId}`,
      studentPersonId: input.studentPersonId,
      action: 'create',
      permission: 'care.health.write',
      fields: ['profile'],
    });
    const existing = [...this.#profiles.values()].find(
      (profile) =>
        profile.tenantId === input.tenantId && profile.studentPersonId === input.studentPersonId,
    );
    if (existing) return clone(existing);
    const profile: HealthProfile = {
      tenantId: input.tenantId,
      profileId: this.#id('health-profile'),
      studentPersonId: input.studentPersonId,
      ...(input.bloodGroup ? { bloodGroup: input.bloodGroup } : {}),
      ...(input.primaryClinicCampusId
        ? { primaryClinicCampusId: input.primaryClinicCampusId }
        : {}),
      ...(input.emergencyInstructions
        ? { emergencyInstructions: input.emergencyInstructions }
        : {}),
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.#profiles.set(this.#key(profile.tenantId, profile.profileId), profile);
    this.#emit('care.health.profile.created.v1', profile, profile.profileId, access.context.correlationId, {
      version: profile.version,
    });
    return clone(profile);
  }

  recordCondition(
    access: HealthAccessScope,
    input: Omit<HealthCondition, 'conditionId' | 'recordedAt' | 'status'> & {
      legalBasis: LegalBasisEvidence;
      status?: HealthRecordStatus;
    },
  ): HealthCondition {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.write',
      fields: ['condition'],
    });
    const record: HealthCondition = {
      tenantId: input.tenantId,
      conditionId: this.#id('condition'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      code: input.code,
      display: input.display,
      severity: input.severity,
      status: input.status ?? 'active',
      ...(input.onsetDate ? { onsetDate: input.onsetDate } : {}),
      recordedAt: now,
    };
    this.#conditions.set(this.#key(record.tenantId, record.conditionId), record);
    return clone(record);
  }

  recordAllergy(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      profileId: string;
      substanceCode: string;
      display: string;
      severity: HealthAllergy['severity'];
      reaction?: string;
      legalBasis: LegalBasisEvidence;
    },
  ): HealthAllergy {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.write',
      fields: ['allergy'],
    });
    const allergy: HealthAllergy = {
      tenantId: input.tenantId,
      allergyId: this.#id('allergy'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      substanceCode: input.substanceCode.trim().toLowerCase(),
      display: input.display,
      ...(input.reaction ? { reaction: input.reaction } : {}),
      severity: input.severity,
      status: 'active',
      recordedAt: now,
    };
    this.#allergies.set(this.#key(allergy.tenantId, allergy.allergyId), allergy);
    this.#emit('care.health.allergy.recorded.v1', allergy, allergy.allergyId, access.context.correlationId, {
      severity: allergy.severity,
    });
    return clone(allergy);
  }

  orderMedication(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      profileId: string;
      medicationCode: string;
      display: string;
      ingredientCodes?: readonly string[];
      dose: string;
      route: string;
      schedule: string;
      startsAt: Date;
      endsAt?: Date;
      prescriberReference: string;
      authorizationDocumentReference: string;
      legalBasis: LegalBasisEvidence;
    },
  ): MedicationOrder {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.medication.order',
      fields: ['medication-order'],
    });
    const order: MedicationOrder = {
      tenantId: input.tenantId,
      medicationOrderId: this.#id('medication-order'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      medicationCode: input.medicationCode.trim().toLowerCase(),
      display: input.display,
      ingredientCodes: Object.freeze(
        [...(input.ingredientCodes ?? [])].map((code) => code.trim().toLowerCase()),
      ),
      dose: input.dose,
      route: input.route,
      schedule: input.schedule,
      startsAt: input.startsAt,
      ...(input.endsAt ? { endsAt: input.endsAt } : {}),
      status: 'active',
      prescriberReference: input.prescriberReference,
      authorizationDocumentReference: input.authorizationDocumentReference,
      recordedAt: now,
    };
    this.#medicationOrders.set(this.#key(order.tenantId, order.medicationOrderId), order);
    this.#emit('care.health.medication.ordered.v1', order, order.medicationOrderId, access.context.correlationId, {
      orderVersion: 1,
    });
    return clone(order);
  }

  administerMedication(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      medicationOrderId: string;
      administeredAt: Date;
      dose: string;
      route: string;
      outcome: MedicationAdministration['outcome'];
      reasonCode?: string;
      idempotencyKey: string;
    },
  ): MedicationAdministration {
    const order = this.#requireMedicationOrder(input.tenantId, input.medicationOrderId);
    const idempotencyScope = this.#key(input.tenantId, input.idempotencyKey);
    const existingId = this.#administrationByIdempotency.get(idempotencyScope);
    if (existingId) {
      const existing = this.#administrations.get(this.#key(input.tenantId, existingId));
      if (!existing) throw new HealthDomainError('HEALTH_NOT_FOUND', 'Administration missing');
      return clone(existing);
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: order.medicationOrderId,
      studentPersonId: order.studentPersonId,
      action: 'medication-administer',
      permission: 'care.health.medication.administer',
      fields: ['medication-administration'],
    });
    if (
      order.status !== 'active' ||
      input.administeredAt < order.startsAt ||
      (order.endsAt !== undefined && input.administeredAt > order.endsAt)
    ) {
      throw new HealthDomainError(
        'HEALTH_MEDICATION_ORDER_INACTIVE',
        'Medication order is not active at the administration time',
      );
    }
    const substances = new Set([order.medicationCode, ...order.ingredientCodes]);
    const contraindication = [...this.#allergies.values()].find(
      (allergy) =>
        allergy.tenantId === input.tenantId &&
        allergy.profileId === order.profileId &&
        allergy.status === 'active' &&
        substances.has(allergy.substanceCode),
    );
    if (contraindication) {
      throw new HealthDomainError(
        'HEALTH_ALLERGY_CONTRAINDICATION',
        'Active allergy conflicts with the medication order',
      );
    }
    const now = this.#now();
    const administration: MedicationAdministration = {
      tenantId: input.tenantId,
      administrationId: this.#id('medication-administration'),
      medicationOrderId: order.medicationOrderId,
      profileId: order.profileId,
      studentPersonId: order.studentPersonId,
      administeredAt: input.administeredAt,
      dose: input.dose,
      route: input.route,
      administratorPrincipalId: access.context.principalId ?? 'missing-principal',
      outcome: input.outcome,
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      idempotencyKey: input.idempotencyKey,
      recordedAt: now,
    };
    this.#administrations.set(
      this.#key(administration.tenantId, administration.administrationId),
      administration,
    );
    this.#administrationByIdempotency.set(idempotencyScope, administration.administrationId);
    this.#emit('care.health.medication.administered.v1', administration, administration.administrationId, access.context.correlationId, {
      outcome: administration.outcome,
    });
    return clone(administration);
  }

  correctAdministration(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      administrationId: string;
      reason: string;
      replacementOutcome?: MedicationAdministration['outcome'];
      replacementDose?: string;
    },
  ): MedicationAdministrationCorrection {
    const administration = this.#administrations.get(
      this.#key(input.tenantId, input.administrationId),
    );
    if (!administration) throw new HealthDomainError('HEALTH_NOT_FOUND', 'Administration not found');
    if (
      input.reason.trim().length < 8 ||
      (input.replacementOutcome === undefined && input.replacementDose === undefined)
    ) {
      throw new HealthDomainError(
        'HEALTH_CORRECTION_INVALID',
        'Correction requires a reason and a replacement value',
      );
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: administration.administrationId,
      studentPersonId: administration.studentPersonId,
      action: 'amend',
      permission: 'care.health.medication.correct',
      fields: ['medication-administration-correction'],
    });
    const correction: MedicationAdministrationCorrection = {
      tenantId: input.tenantId,
      correctionId: this.#id('medication-correction'),
      administrationId: input.administrationId,
      correctedByPrincipalId: access.context.principalId ?? 'missing-principal',
      reason: input.reason.trim(),
      ...(input.replacementOutcome
        ? { replacementOutcome: input.replacementOutcome }
        : {}),
      ...(input.replacementDose ? { replacementDose: input.replacementDose } : {}),
      recordedAt: this.#now(),
    };
    this.#corrections.set(this.#key(correction.tenantId, correction.correctionId), correction);
    return clone(correction);
  }

  recordImmunization(
    access: HealthAccessScope,
    input: Omit<ImmunizationRecord, 'immunizationId' | 'studentPersonId' | 'status' | 'recordedAt'> & {
      legalBasis: LegalBasisEvidence;
    },
  ): ImmunizationRecord {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.write',
      fields: ['immunization'],
    });
    const record: ImmunizationRecord = {
      tenantId: input.tenantId,
      immunizationId: this.#id('immunization'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      vaccineCode: input.vaccineCode,
      administeredOn: input.administeredOn,
      ...(input.doseNumber ? { doseNumber: input.doseNumber } : {}),
      evidenceReference: input.evidenceReference,
      status: 'active',
      recordedAt: now,
    };
    this.#immunizations.set(this.#key(record.tenantId, record.immunizationId), record);
    return clone(record);
  }

  createCarePlan(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      profileId: string;
      title: string;
      goals: readonly string[];
      actions: readonly string[];
      emergencyActions: readonly string[];
      validFrom: Date;
      validTo?: Date;
      approvedByPrincipalId?: string;
      legalBasis: LegalBasisEvidence;
    },
  ): HealthCarePlan {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.care-plan.write',
      fields: ['care-plan'],
    });
    const plan: HealthCarePlan = {
      tenantId: input.tenantId,
      carePlanId: this.#id('health-care-plan'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      title: input.title,
      goals: Object.freeze([...input.goals]),
      actions: Object.freeze([...input.actions]),
      emergencyActions: Object.freeze([...input.emergencyActions]),
      validFrom: input.validFrom,
      ...(input.validTo ? { validTo: input.validTo } : {}),
      status: input.approvedByPrincipalId ? 'active' : 'draft',
      ...(input.approvedByPrincipalId
        ? { approvedByPrincipalId: input.approvedByPrincipalId }
        : {}),
      version: 1,
      recordedAt: now,
    };
    this.#carePlans.set(this.#key(plan.tenantId, plan.carePlanId), plan);
    return clone(plan);
  }

  openEncounter(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      profileId: string;
      campusId: string;
      reasonCategory: string;
      narrative: string;
      legalBasis: LegalBasisEvidence;
    },
  ): ClinicEncounter {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    const now = this.#now();
    this.#assertLegalBasis(input.legalBasis, now);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.encounter.write',
      fields: ['clinic-encounter'],
    });
    const encounter: ClinicEncounter = {
      tenantId: input.tenantId,
      encounterId: this.#id('clinic-encounter'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      campusId: input.campusId,
      openedAt: now,
      openedByPrincipalId: access.context.principalId ?? 'missing-principal',
      reasonCategory: input.reasonCategory,
      narrative: input.narrative,
      status: 'open',
      version: 1,
    };
    this.#encounters.set(this.#key(encounter.tenantId, encounter.encounterId), encounter);
    return clone(encounter);
  }

  closeEncounter(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      encounterId: string;
      disposition: NonNullable<ClinicEncounter['disposition']>;
      followUpAt?: Date;
    },
  ): ClinicEncounter {
    const key = this.#key(input.tenantId, input.encounterId);
    const encounter = this.#encounters.get(key);
    if (!encounter) throw new HealthDomainError('HEALTH_NOT_FOUND', 'Encounter not found');
    if (encounter.status !== 'open') {
      throw new HealthDomainError('HEALTH_ENCOUNTER_STATE_INVALID', 'Encounter is already closed');
    }
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: encounter.encounterId,
      studentPersonId: encounter.studentPersonId,
      action: 'amend',
      permission: 'care.health.encounter.write',
      fields: ['clinic-encounter-disposition'],
    });
    const closed: ClinicEncounter = {
      ...encounter,
      status: 'closed',
      closedAt: this.#now(),
      disposition: input.disposition,
      ...(input.followUpAt ? { followUpAt: input.followUpAt } : {}),
      version: encounter.version + 1,
    };
    this.#encounters.set(key, closed);
    this.#emit('care.health.encounter.closed.v1', closed, closed.encounterId, access.context.correlationId, {
      disposition: input.disposition,
    });
    return clone(closed);
  }

  attachRestrictedDocument(
    access: HealthAccessScope,
    input: {
      tenantId: string;
      profileId: string;
      documentId: string;
      documentType: string;
    },
  ): RestrictedHealthDocument {
    const profile = this.#requireProfile(input.tenantId, input.profileId);
    this.#authorize(access, {
      tenantId: input.tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'create',
      permission: 'care.health.document.write',
      fields: ['restricted-document-reference'],
    });
    const document: RestrictedHealthDocument = {
      tenantId: input.tenantId,
      healthDocumentId: this.#id('health-document'),
      profileId: input.profileId,
      studentPersonId: profile.studentPersonId,
      documentId: input.documentId,
      documentType: input.documentType,
      classification: 'CARE-C3',
      sourceClassification: 'CARE-C3',
      status: 'active',
      recordedAt: this.#now(),
    };
    this.#documents.set(this.#key(document.tenantId, document.healthDocumentId), document);
    return clone(document);
  }

  readProfile(access: HealthAccessScope, tenantId: string, profileId: string): HealthProfile {
    const profile = this.#requireProfile(tenantId, profileId);
    this.#authorize(access, {
      tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'read',
      permission: 'care.health.read',
      fields: ['profile'],
    });
    return clone(profile);
  }

  readEmergencyProjection(
    access: HealthAccessScope,
    tenantId: string,
    profileId: string,
  ): EmergencyHealthProjection {
    const profile = this.#requireProfile(tenantId, profileId);
    this.#authorize(access, {
      tenantId,
      resourceId: profile.profileId,
      studentPersonId: profile.studentPersonId,
      action: 'read',
      permission: 'care.emergency.read',
      fields: [
        'blood-group',
        'life-threatening-allergies',
        'active-medication-summary',
        'emergency-actions',
      ],
      classification: 'CARE-E',
    });
    const lifeThreateningAllergies = [...this.#allergies.values()]
      .filter(
        (allergy) =>
          allergy.tenantId === tenantId &&
          allergy.profileId === profileId &&
          allergy.status === 'active' &&
          allergy.severity === 'life-threatening',
      )
      .map((allergy) => ({ substanceCode: allergy.substanceCode, display: allergy.display }));
    const now = this.#now();
    const activeMedicationSummaries = [...this.#medicationOrders.values()]
      .filter(
        (order) =>
          order.tenantId === tenantId &&
          order.profileId === profileId &&
          order.status === 'active' &&
          order.startsAt <= now &&
          (order.endsAt === undefined || order.endsAt > now),
      )
      .map((order) => ({
        medicationCode: order.medicationCode,
        display: order.display,
        dose: order.dose,
        route: order.route,
      }));
    const emergencyActions = [...this.#carePlans.values()]
      .filter(
        (plan) =>
          plan.tenantId === tenantId &&
          plan.profileId === profileId &&
          plan.status === 'active' &&
          plan.validFrom <= now &&
          (plan.validTo === undefined || plan.validTo > now),
      )
      .flatMap((plan) => plan.emergencyActions);
    return {
      tenantId,
      studentPersonId: profile.studentPersonId,
      profileId,
      projectionVersion: profile.version,
      ...(profile.bloodGroup ? { bloodGroup: profile.bloodGroup } : {}),
      lifeThreateningAllergies,
      activeMedicationSummaries,
      emergencyActions,
      generatedAt: now,
    };
  }

  listEvents(tenantId: string): readonly HealthDomainEvent[] {
    return this.#events.filter((event) => event.tenantId === tenantId).map(clone);
  }

  listAdministrations(tenantId: string, profileId: string): readonly MedicationAdministration[] {
    return [...this.#administrations.values()]
      .filter((record) => record.tenantId === tenantId && record.profileId === profileId)
      .map(clone);
  }

  listAdministrationCorrections(
    tenantId: string,
    administrationId: string,
  ): readonly MedicationAdministrationCorrection[] {
    return [...this.#corrections.values()]
      .filter(
        (record) =>
          record.tenantId === tenantId && record.administrationId === administrationId,
      )
      .map(clone);
  }

  snapshotForReports(tenantId: string): Readonly<{
    profiles: readonly HealthProfile[];
    encounters: readonly ClinicEncounter[];
    administrations: readonly MedicationAdministration[];
  }> {
    return {
      profiles: [...this.#profiles.values()].filter((item) => item.tenantId === tenantId).map(clone),
      encounters: [...this.#encounters.values()].filter((item) => item.tenantId === tenantId).map(clone),
      administrations: [...this.#administrations.values()]
        .filter((item) => item.tenantId === tenantId)
        .map(clone),
    };
  }

  #assertLegalBasis(evidence: LegalBasisEvidence, now: Date): void {
    if (!activeEvidence(evidence, now)) {
      throw new HealthDomainError(
        'HEALTH_LEGAL_BASIS_INVALID',
        'An active legal-basis or consent record is required',
      );
    }
  }

  #authorize(
    access: HealthAccessScope,
    request: {
      tenantId: string;
      resourceId: string;
      studentPersonId: string;
      action: 'read' | 'create' | 'amend' | 'medication-administer';
      permission: string;
      fields: readonly string[];
      classification?: 'CARE-C3' | 'CARE-E';
    },
  ): CareAuthorizationDecision {
    const decision = this.#security.authorize({
      context: access.context,
      resource: {
        tenantId: request.tenantId,
        resourceId: request.resourceId,
        studentPersonId: request.studentPersonId,
        classification: request.classification ?? 'CARE-C3',
        fields: request.fields,
      },
      action: request.action,
      permission: request.permission,
      ...(access.relationship ? { relationship: access.relationship } : {}),
      ...(access.guardianAuthority ? { guardianAuthority: access.guardianAuthority } : {}),
      ...(access.publication ? { publication: access.publication } : {}),
      ...(access.breakGlass ? { breakGlass: access.breakGlass } : {}),
    });
    if (!decision.allowed) {
      throw new HealthDomainError(
        'HEALTH_ACCESS_DENIED',
        `Health operation denied: ${decision.reason}`,
      );
    }
    return decision;
  }

  #requireProfile(tenantId: string, profileId: string): HealthProfile {
    const profile = this.#profiles.get(this.#key(tenantId, profileId));
    if (!profile) throw new HealthDomainError('HEALTH_NOT_FOUND', 'Health profile not found');
    return profile;
  }

  #requireMedicationOrder(tenantId: string, medicationOrderId: string): MedicationOrder {
    const order = this.#medicationOrders.get(this.#key(tenantId, medicationOrderId));
    if (!order) throw new HealthDomainError('HEALTH_NOT_FOUND', 'Medication order not found');
    return order;
  }

  #emit(
    eventType: HealthDomainEvent['eventType'],
    aggregate: { tenantId: string; studentPersonId: string },
    aggregateId: string,
    correlationId: string,
    payload: Readonly<Record<string, string | number>>,
  ): void {
    this.#events.push({
      eventType,
      tenantId: aggregate.tenantId,
      aggregateId,
      studentPersonId: aggregate.studentPersonId,
      classification: 'CARE-C3',
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
