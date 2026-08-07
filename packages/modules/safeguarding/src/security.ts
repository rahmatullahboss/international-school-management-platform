export const CARE_SECURITY_CONTRACT_VERSION = 1 as const;

export type CareClassification = 'CARE-C1' | 'CARE-C2' | 'CARE-C3' | 'CARE-C4' | 'CARE-E';
export type AssuranceLevel = 'aal1' | 'aal2';
export type CarePersona =
  | 'student'
  | 'guardian'
  | 'teacher'
  | 'nurse'
  | 'medication-administrator'
  | 'behavior-lead'
  | 'counselor'
  | 'learning-support'
  | 'safeguarding-lead'
  | 'safeguarding-case-member'
  | 'principal'
  | 'tenant-admin'
  | 'privacy-reviewer'
  | 'security-reviewer'
  | 'platform-support'
  | 'report-builder'
  | 'connector';

export type CarePurpose =
  | 'direct-care'
  | 'medication-administration'
  | 'emergency-response'
  | 'student-support-plan'
  | 'behavior-management'
  | 'safeguarding-assessment'
  | 'mandatory-reporting'
  | 'case-supervision'
  | 'legal-rights-response'
  | 'security-investigation'
  | 'approved-data-transfer';

export type CareAction =
  | 'read'
  | 'search'
  | 'create'
  | 'amend'
  | 'medication-administer'
  | 'case-membership-change'
  | 'external-disclosure'
  | 'high-risk-export'
  | 'legal-hold-apply'
  | 'legal-hold-release'
  | 'destruction-approve'
  | 'signed-url-issue'
  | 'offline-bundle-create'
  | 'print';

export type CareDenialCode =
  | 'not-found'
  | 'tenant-context-required'
  | 'tenant-mismatch'
  | 'membership-inactive'
  | 'permission-not-granted'
  | 'purpose-not-permitted'
  | 'relationship-required'
  | 'release-required'
  | 'step-up-required'
  | 'machine-credential-denied'
  | 'break-glass-invalid'
  | 'break-glass-action-denied'
  | 'audit-unavailable';

export interface CareRequestContext {
  tenantId?: string;
  campusId?: string;
  principalId?: string;
  linkedPersonId?: string;
  persona: CarePersona;
  assurance: AssuranceLevel;
  purpose?: CarePurpose;
  correlationId: string;
  sessionId?: string;
  deviceId?: string;
  membershipActive: boolean;
  permissions: readonly string[];
  machineCredential?: boolean;
}

export interface CareResource {
  tenantId: string;
  resourceId: string;
  studentPersonId: string;
  classification: CareClassification;
  caseId?: string;
  campusId?: string;
  fields?: readonly string[];
}

export interface CareRelationshipScope {
  studentPersonId: string;
  active: boolean;
  expiresAt?: Date;
}

export interface CareCaseMembership {
  tenantId: string;
  caseId: string;
  principalId: string;
  purpose: CarePurpose;
  status: 'active' | 'revoked' | 'expired' | 'closed';
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface GuardianAuthoritySnapshot {
  tenantId: string;
  guardianPersonId: string;
  studentPersonId: string;
  authorities: readonly string[];
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  portalAccess: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  restrictionReference?: string;
}

export interface CarePublicationDecision {
  tenantId: string;
  studentPersonId: string;
  audience: 'student' | 'guardian';
  version: number;
  status: 'released' | 'withheld' | 'revoked';
  allowedFields: readonly string[];
  effectiveFrom: Date;
  expiresAt?: Date;
}

export interface BreakGlassGrant {
  grantId: string;
  tenantId: string;
  requestedBy: string;
  approvedBy: string;
  purpose: 'emergency-response' | 'security-investigation';
  reason: string;
  resourceIds: readonly string[];
  classifications: readonly CareClassification[];
  effectiveFrom: Date;
  expiresAt: Date;
  status: 'active' | 'revoked' | 'expired' | 'reviewed';
}

export interface CareAccessRequest {
  context: CareRequestContext;
  resource: CareResource;
  action: CareAction;
  permission: string;
  now?: Date;
  relationship?: CareRelationshipScope;
  caseMembership?: CareCaseMembership;
  guardianAuthority?: GuardianAuthoritySnapshot;
  publication?: CarePublicationDecision;
  breakGlass?: BreakGlassGrant;
}

export interface CareAuthorizationDecision {
  allowed: boolean;
  reason: 'need-to-know' | 'published-projection' | 'break-glass' | CareDenialCode;
  masked: boolean;
  auditEvidenceId?: string;
}

export interface CareAuditEvidence {
  evidenceId: string;
  tenantId: string;
  principalId: string;
  linkedPersonId?: string;
  persona: CarePersona;
  action: CareAction | 'break-glass-review' | 'export-download' | 'connector-transfer';
  resourceId: string;
  classification: CareClassification;
  fields: readonly string[];
  purpose: CarePurpose;
  assurance: AssuranceLevel;
  correlationId: string;
  outcome: 'allowed' | 'denied';
  occurredAt: Date;
  recipient?: string;
  grantId?: string;
}

const invariantDescriptions = [
  'Missing or invalid tenant context denies access',
  'No CARE row crosses tenants under app_runtime',
  'Broad roles do not inherit CARE-C3/C4 access',
  'Restricted access requires purpose and relationship or case scope',
  'Suspended, expired or revoked access denies immediately',
  'Safeguarding existence is protected like content',
  'Guardian access requires verified authority and CARE release',
  'Student access requires explicit policy-aware CARE release',
  'Consent never bypasses tenant, restriction, hold or safeguarding controls',
  'Machine credentials never inherit human case membership',
  'High-risk actions require AAL2',
  'High-risk requester and approver differ',
  'Break-glass is narrow, expiring, revocable, alerted and reviewed',
  'Break-glass cannot perform prohibited bulk or destructive actions',
  'Emergency views expose only minimum approved fields',
  'Every CARE-C3/C4/E read creates immutable evidence',
  'Audit failure causes a sensitive read to fail closed',
  'Download, print, signed URL, offline, export and disclosure are distinct evidence',
  'Normal application roles cannot mutate access or disclosure evidence',
  'Audit metadata omits sensitive narrative',
  'Material corrections preserve history',
  'CARE-C3/C4 fields are excluded from general search, report, export and analytics',
  'Events and notifications omit sensitive narrative and identifiers',
  'High-risk exports use exact scope and reauthorization',
  'Connectors require exact manifest category and purpose approval',
  'Portal publication uses minimized versioned projections',
  'File derivatives retain source classification',
  'All CARE tenant tables force RLS',
  'Tenant identity is preserved in keys and derived artifacts',
  'Pool reuse cannot leak tenant or privileged context',
  'CARE-C3/C4 content is excluded from generic offline caches and telemetry',
  'Offline emergency bundles are encrypted, minimum and expiring',
  'Lost-device response identifies bundle scope and access window',
  'Retention and destruction are policy-versioned, hold-aware and evidenced',
  'Ordinary roles cannot hard-delete restricted records',
  'Hold release and destruction approval require AAL2 and separation of duties',
  'Incident response can revoke and isolate affected credentials and devices',
  'Non-production artifacts contain synthetic student-support data only',
  'CARE never directly updates another module owned table',
  'Frozen contract changes require documented approval',
] as const;

export const CARE_SECURITY_INVARIANTS = Object.freeze(
  invariantDescriptions.map((description, index) =>
    Object.freeze({ id: `SS-TM-${String(index + 1).padStart(3, '0')}`, description }),
  ),
);

const highRiskActions = new Set<CareAction>([
  'medication-administer',
  'case-membership-change',
  'external-disclosure',
  'high-risk-export',
  'legal-hold-apply',
  'legal-hold-release',
  'destruction-approve',
]);
const prohibitedBreakGlassActions = new Set<CareAction>([
  'search',
  'high-risk-export',
  'case-membership-change',
  'legal-hold-release',
  'destruction-approve',
]);
const broadRestrictedPersonas = new Set<CarePersona>([
  'principal',
  'tenant-admin',
  'teacher',
  'report-builder',
  'platform-support',
  'connector',
]);
const sensitiveClasses = new Set<CareClassification>(['CARE-C3', 'CARE-C4', 'CARE-E']);

function activeAt(now: Date, start: Date, end?: Date): boolean {
  return start <= now && (!end || end > now);
}

export class ImmutableCareAuditStore {
  readonly #evidence: Readonly<CareAuditEvidence>[] = [];
  #available = true;
  #sequence = 0;

  setAvailable(available: boolean): void {
    this.#available = available;
  }

  append(input: Omit<CareAuditEvidence, 'evidenceId'>): Readonly<CareAuditEvidence> {
    if (!this.#available) throw new Error('CARE audit persistence unavailable');
    this.#sequence += 1;
    const evidence = Object.freeze({
      ...input,
      evidenceId: `care-audit-${this.#sequence}`,
      fields: Object.freeze([...input.fields]),
    });
    this.#evidence.push(evidence);
    return evidence;
  }

  list(tenantId: string): readonly Readonly<CareAuditEvidence>[] {
    return this.#evidence.filter((item) => item.tenantId === tenantId);
  }

  update(): never {
    throw new Error('CARE audit evidence is immutable');
  }

  delete(): never {
    throw new Error('CARE audit evidence is immutable');
  }
}

export interface CareSecurityOptions {
  auditStore?: ImmutableCareAuditStore;
  now?: () => Date;
}

export class CareSecurityService {
  readonly auditStore: ImmutableCareAuditStore;
  readonly #now: () => Date;

  constructor(options: CareSecurityOptions = {}) {
    this.auditStore = options.auditStore ?? new ImmutableCareAuditStore();
    this.#now = options.now ?? (() => new Date());
  }

  authorize(request: CareAccessRequest): CareAuthorizationDecision {
    const now = request.now ?? this.#now();
    const { context, resource } = request;
    if (!context.tenantId || !context.principalId) return this.#deny(request, 'tenant-context-required', now);
    if (context.tenantId !== resource.tenantId) return this.#deny(request, 'tenant-mismatch', now);
    if (!context.membershipActive) return this.#deny(request, 'membership-inactive', now);
    if (!context.permissions.includes(request.permission)) return this.#deny(request, 'permission-not-granted', now);
    if (!context.purpose) return this.#deny(request, 'purpose-not-permitted', now);
    if (highRiskActions.has(request.action) && context.assurance !== 'aal2') {
      return this.#deny(request, 'step-up-required', now);
    }
    if (context.machineCredential && sensitiveClasses.has(resource.classification)) {
      return this.#deny(request, 'machine-credential-denied', now);
    }
    if (context.persona === 'guardian' || context.persona === 'student') {
      return this.#authorizePortal(request, now);
    }
    const breakGlass = this.#authorizeBreakGlass(request, now);
    if (breakGlass) return breakGlass;
    const isWriteOnlySafeguardingIntake =
      resource.classification === 'CARE-C4' &&
      request.action === 'create' &&
      request.permission === 'care.safeguarding.concern.create' &&
      (context.purpose === 'mandatory-reporting' ||
        context.purpose === 'safeguarding-assessment');
    const isSafeguardingCaseBootstrap =
      resource.classification === 'CARE-C4' &&
      request.action === 'create' &&
      request.permission === 'care.safeguarding.case.open' &&
      context.persona === 'safeguarding-lead' &&
      context.assurance === 'aal2' &&
      context.purpose === 'safeguarding-assessment';
    if (isWriteOnlySafeguardingIntake || isSafeguardingCaseBootstrap) {
      const relationship = request.relationship;
      if (
        !relationship ||
        relationship.studentPersonId !== resource.studentPersonId ||
        !relationship.active ||
        (relationship.expiresAt !== undefined && relationship.expiresAt <= now)
      ) {
        return this.#deny(request, 'relationship-required', now);
      }
      return this.#allow(request, 'need-to-know', now, true);
    }
    if (
      broadRestrictedPersonas.has(context.persona) &&
      (resource.classification === 'CARE-C3' || resource.classification === 'CARE-C4')
    ) {
      return this.#deny(request, 'not-found', now);
    }
    if (resource.classification === 'CARE-C4') {
      const membership = request.caseMembership;
      if (
        !resource.caseId ||
        !membership ||
        membership.tenantId !== resource.tenantId ||
        membership.caseId !== resource.caseId ||
        membership.principalId !== context.principalId ||
        membership.purpose !== context.purpose ||
        membership.status !== 'active' ||
        !activeAt(now, membership.effectiveFrom, membership.expiresAt)
      ) {
        return this.#deny(request, 'not-found', now);
      }
    } else if (resource.classification === 'CARE-C3') {
      const relationship = request.relationship;
      if (
        !relationship ||
        relationship.studentPersonId !== resource.studentPersonId ||
        !relationship.active ||
        (relationship.expiresAt !== undefined && relationship.expiresAt <= now)
      ) {
        return this.#deny(request, 'relationship-required', now);
      }
    }
    return this.#allow(request, 'need-to-know', now, false);
  }

  #authorizePortal(request: CareAccessRequest, now: Date): CareAuthorizationDecision {
    const { context, resource, publication } = request;
    if (
      !publication ||
      publication.tenantId !== resource.tenantId ||
      publication.studentPersonId !== resource.studentPersonId ||
      publication.audience !== context.persona ||
      publication.status !== 'released' ||
      !activeAt(now, publication.effectiveFrom, publication.expiresAt)
    ) {
      return this.#deny(request, 'not-found', now);
    }
    if (context.persona === 'guardian') {
      const authority = request.guardianAuthority;
      const valid =
        authority?.tenantId === resource.tenantId &&
        authority.guardianPersonId === context.linkedPersonId &&
        authority.studentPersonId === resource.studentPersonId &&
        authority.verificationStatus === 'verified' &&
        authority.portalAccess &&
        authority.authorities.includes('portal') &&
        !authority.restrictionReference &&
        new Date(authority.effectiveFrom) <= now &&
        (!authority.effectiveTo || new Date(authority.effectiveTo) > now);
      if (!valid) return this.#deny(request, 'not-found', now);
    }
    return this.#allow(request, 'published-projection', now, true);
  }

  #authorizeBreakGlass(request: CareAccessRequest, now: Date): CareAuthorizationDecision | undefined {
    const grant = request.breakGlass;
    if (!grant) return undefined;
    if (request.context.assurance !== 'aal2') return this.#deny(request, 'step-up-required', now);
    if (prohibitedBreakGlassActions.has(request.action)) {
      return this.#deny(request, 'break-glass-action-denied', now);
    }
    if (
      grant.tenantId !== request.resource.tenantId ||
      grant.requestedBy !== request.context.principalId ||
      grant.requestedBy === grant.approvedBy ||
      grant.reason.trim().length < 12 ||
      grant.status !== 'active' ||
      !activeAt(now, grant.effectiveFrom, grant.expiresAt) ||
      !grant.resourceIds.includes(request.resource.resourceId) ||
      !grant.classifications.includes(request.resource.classification) ||
      grant.purpose !== request.context.purpose
    ) {
      return this.#deny(request, 'break-glass-invalid', now);
    }
    return this.#allow(request, 'break-glass', now, true, grant.grantId);
  }

  #allow(
    request: CareAccessRequest,
    reason: 'need-to-know' | 'published-projection' | 'break-glass',
    now: Date,
    masked: boolean,
    grantId?: string,
  ): CareAuthorizationDecision {
    let auditEvidenceId: string | undefined;
    if (sensitiveClasses.has(request.resource.classification)) {
      try {
        const evidence = this.auditStore.append({
          tenantId: request.resource.tenantId,
          principalId: request.context.principalId ?? 'missing-principal',
          ...(request.context.linkedPersonId ? { linkedPersonId: request.context.linkedPersonId } : {}),
          persona: request.context.persona,
          action: request.action,
          resourceId: request.resource.resourceId,
          classification: request.resource.classification,
          fields: request.resource.fields ?? [],
          purpose: request.context.purpose ?? 'security-investigation',
          assurance: request.context.assurance,
          correlationId: request.context.correlationId,
          outcome: 'allowed',
          occurredAt: now,
          ...(grantId ? { grantId } : {}),
        });
        auditEvidenceId = evidence.evidenceId;
      } catch {
        return { allowed: false, reason: 'audit-unavailable', masked: true };
      }
    }
    return {
      allowed: true,
      reason,
      masked,
      ...(auditEvidenceId ? { auditEvidenceId } : {}),
    };
  }

  #deny(request: CareAccessRequest, reason: CareDenialCode, now: Date): CareAuthorizationDecision {
    if (request.resource.classification === 'CARE-C4' || highRiskActions.has(request.action)) {
      try {
        this.auditStore.append({
          tenantId: request.context.tenantId ?? request.resource.tenantId,
          principalId: request.context.principalId ?? 'missing-principal',
          persona: request.context.persona,
          action: request.action,
          resourceId: request.resource.resourceId,
          classification: request.resource.classification,
          fields: [],
          purpose: request.context.purpose ?? 'security-investigation',
          assurance: request.context.assurance,
          correlationId: request.context.correlationId,
          outcome: 'denied',
          occurredAt: now,
        });
      } catch {
        // The primary operation is already denied; the outage is handled by security telemetry.
      }
    }
    return { allowed: false, reason, masked: true };
  }
}

export interface HighRiskExportRequest {
  exportId: string;
  tenantId: string;
  requestedBy: string;
  approvedBy?: string;
  purpose: 'approved-data-transfer' | 'legal-rights-response';
  subjectIds: readonly string[];
  fields: readonly string[];
  recipient: string;
  expiresAt: Date;
  status: 'requested' | 'approved' | 'generated' | 'downloaded' | 'revoked';
}

export class CareExportController {
  readonly #exports = new Map<string, Readonly<HighRiskExportRequest>>();

  request(input: Omit<HighRiskExportRequest, 'approvedBy' | 'status'>): Readonly<HighRiskExportRequest> {
    if (input.subjectIds.length === 0 || input.fields.length === 0 || input.recipient.trim() === '') {
      throw new Error('High-risk export requires exact subject, field and recipient scope');
    }
    const record = Object.freeze({ ...input, status: 'requested' as const });
    this.#exports.set(input.exportId, record);
    return record;
  }

  approve(exportId: string, approverId: string, assurance: AssuranceLevel): Readonly<HighRiskExportRequest> {
    const current = this.#require(exportId);
    if (assurance !== 'aal2') throw new Error('step-up-required');
    if (current.requestedBy === approverId) throw new Error('Independent export approval required');
    if (current.status !== 'requested') throw new Error('Export is not awaiting approval');
    const approved = Object.freeze({ ...current, approvedBy: approverId, status: 'approved' as const });
    this.#exports.set(exportId, approved);
    return approved;
  }

  generate(exportId: string, now: Date, requestedFields: readonly string[], rowCount: number): void {
    const current = this.#require(exportId);
    if (current.status !== 'approved' || current.expiresAt <= now) throw new Error('Export approval is stale');
    if (rowCount > current.subjectIds.length) throw new Error('Export population exceeds approval');
    if (requestedFields.some((field) => !current.fields.includes(field))) {
      throw new Error('Export requested an unapproved field');
    }
    this.#exports.set(exportId, Object.freeze({ ...current, status: 'generated' as const }));
  }

  download(exportId: string, now: Date, recipient: string): void {
    const current = this.#require(exportId);
    if (current.status !== 'generated' || current.expiresAt <= now || current.recipient !== recipient) {
      throw new Error('Export download authorization failed');
    }
    this.#exports.set(exportId, Object.freeze({ ...current, status: 'downloaded' as const }));
  }

  #require(exportId: string): Readonly<HighRiskExportRequest> {
    const record = this.#exports.get(exportId);
    if (!record) throw new Error('Export not found');
    return record;
  }
}

export interface ConnectorTransferApproval {
  tenantId: string;
  connectorKey: string;
  manifestVersion: number;
  approvedCategories: readonly string[];
  approvedPurposes: readonly CarePurpose[];
  status: 'approved' | 'revoked';
  expiresAt: Date;
}

export function authorizeConnectorTransfer(
  approval: ConnectorTransferApproval,
  input: {
    tenantId: string;
    connectorKey: string;
    manifestVersion: number;
    category: string;
    purpose: CarePurpose;
    now: Date;
  },
): boolean {
  return (
    approval.status === 'approved' &&
    approval.expiresAt > input.now &&
    approval.tenantId === input.tenantId &&
    approval.connectorKey === input.connectorKey &&
    approval.manifestVersion === input.manifestVersion &&
    approval.approvedCategories.includes(input.category) &&
    approval.approvedPurposes.includes(input.purpose)
  );
}

const prohibitedNotificationKeys = new Set([
  'diagnosis', 'medication', 'dose', 'allergy', 'counselling', 'allegation', 'caseType', 'reporter', 'narrative',
]);

export function createSafeCareNotification(input: {
  recipientId: string;
  routeReference: string;
  variables?: Readonly<Record<string, string>>;
}): Readonly<{ recipientId: string; title: string; body: string; routeReference: string }> {
  for (const key of Object.keys(input.variables ?? {})) {
    if (prohibitedNotificationKeys.has(key)) {
      throw new Error('Sensitive CARE notification variable is prohibited');
    }
  }
  return Object.freeze({
    recipientId: input.recipientId,
    title: 'Secure student-support action',
    body: 'A secure student-support action requires review.',
    routeReference: input.routeReference,
  });
}

export interface OfflineEmergencyBundle {
  bundleId: string;
  tenantId: string;
  deviceId: string;
  studentIds: readonly string[];
  fields: readonly ('allergy-summary' | 'medication-summary' | 'emergency-action' | 'contact-instruction')[];
  encrypted: true;
  deviceBound: true;
  generatedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export function validateOfflineBundle(bundle: OfflineEmergencyBundle, now: Date, deviceId: string): boolean {
  return (
    bundle.encrypted &&
    bundle.deviceBound &&
    bundle.deviceId === deviceId &&
    bundle.studentIds.length > 0 &&
    bundle.fields.length > 0 &&
    bundle.expiresAt > now &&
    bundle.revokedAt === undefined
  );
}

export interface RetentionDecision {
  recordId: string;
  policyVersion: string;
  legalHold: boolean;
  requestedBy: string;
  approvedBy: string;
  assurance: AssuranceLevel;
  idempotencyKey: string;
}

export function authorizeDestruction(decision: RetentionDecision): boolean {
  return (
    !decision.legalHold &&
    decision.assurance === 'aal2' &&
    decision.requestedBy !== decision.approvedBy &&
    decision.policyVersion.trim() !== '' &&
    decision.idempotencyKey.trim() !== ''
  );
}

export class CareIncidentIsolation {
  readonly #revokedSessions = new Set<string>();
  readonly #revokedGrants = new Set<string>();
  readonly #isolatedDevices = new Set<string>();
  readonly #isolatedConnectors = new Set<string>();

  revokeSession(sessionId: string): void { this.#revokedSessions.add(sessionId); }
  revokeGrant(grantId: string): void { this.#revokedGrants.add(grantId); }
  isolateDevice(deviceId: string): void { this.#isolatedDevices.add(deviceId); }
  isolateConnector(connectorId: string): void { this.#isolatedConnectors.add(connectorId); }

  snapshot(): Readonly<{
    sessions: readonly string[];
    grants: readonly string[];
    devices: readonly string[];
    connectors: readonly string[];
  }> {
    return Object.freeze({
      sessions: Object.freeze([...this.#revokedSessions]),
      grants: Object.freeze([...this.#revokedGrants]),
      devices: Object.freeze([...this.#isolatedDevices]),
      connectors: Object.freeze([...this.#isolatedConnectors]),
    });
  }
}
