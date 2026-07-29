import type {
  AssuranceLevel,
  CareClassification,
  CarePurpose,
  CareRequestContext,
} from './security.js';

export type CareApiMethod = 'GET' | 'POST' | 'PATCH';
export type CareApiAudience =
  | 'clinical'
  | 'behavior'
  | 'wellbeing'
  | 'safeguarding'
  | 'learning-support'
  | 'teacher-projection'
  | 'portal-projection'
  | 'privacy-review';

export interface CareApiRoute {
  readonly id: string;
  readonly version: 'v1';
  readonly method: CareApiMethod;
  readonly path: string;
  readonly classification: CareClassification;
  readonly permission: string;
  readonly purposes: readonly CarePurpose[];
  readonly assurance: AssuranceLevel;
  readonly audience: CareApiAudience;
  readonly idempotent: boolean;
  readonly boundedQuery: boolean;
  readonly masksExistence: boolean;
  readonly allowsNarrativeResponse: boolean;
}

function route(input: CareApiRoute): CareApiRoute {
  return Object.freeze({ ...input, purposes: Object.freeze([...input.purposes]) });
}

export const CARE_API_V1_ROUTES: readonly CareApiRoute[] = Object.freeze([
  route({
    id: 'health.profile.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/health/profiles/:profileId',
    classification: 'CARE-C3',
    permission: 'care.health.read',
    purposes: ['direct-care'],
    assurance: 'aal1',
    audience: 'clinical',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'health.encounter.create',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/health/encounters',
    classification: 'CARE-C3',
    permission: 'care.health.encounter.write',
    purposes: ['direct-care'],
    assurance: 'aal1',
    audience: 'clinical',
    idempotent: true,
    boundedQuery: false,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'health.medication.administer',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/health/medication-administrations',
    classification: 'CARE-C3',
    permission: 'care.health.medication.administer',
    purposes: ['medication-administration', 'direct-care'],
    assurance: 'aal2',
    audience: 'clinical',
    idempotent: true,
    boundedQuery: false,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'health.emergency.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/emergency/:studentPersonId',
    classification: 'CARE-E',
    permission: 'care.emergency.read',
    purposes: ['emergency-response'],
    assurance: 'aal2',
    audience: 'clinical',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'behavior.incident.create',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/behavior/incidents',
    classification: 'CARE-C2',
    permission: 'care.behavior.incident.create',
    purposes: ['behavior-management'],
    assurance: 'aal1',
    audience: 'behavior',
    idempotent: true,
    boundedQuery: false,
    masksExistence: false,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'behavior.follow-up.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/behavior/follow-ups/:followUpId',
    classification: 'CARE-C3',
    permission: 'care.behavior.follow-up.read',
    purposes: ['behavior-management'],
    assurance: 'aal1',
    audience: 'behavior',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'wellbeing.referral.create',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/wellbeing/referrals',
    classification: 'CARE-C2',
    permission: 'care.wellbeing.referral.create',
    purposes: ['student-support-plan'],
    assurance: 'aal1',
    audience: 'wellbeing',
    idempotent: true,
    boundedQuery: false,
    masksExistence: false,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'wellbeing.session.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/wellbeing/sessions/:sessionId',
    classification: 'CARE-C3',
    permission: 'care.wellbeing.session.read',
    purposes: ['student-support-plan'],
    assurance: 'aal1',
    audience: 'wellbeing',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: true,
  }),
  route({
    id: 'safeguarding.concern.create',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/safeguarding/concerns',
    classification: 'CARE-C4',
    permission: 'care.safeguarding.concern.create',
    purposes: ['mandatory-reporting', 'safeguarding-assessment'],
    assurance: 'aal1',
    audience: 'safeguarding',
    idempotent: true,
    boundedQuery: false,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'safeguarding.case.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/safeguarding/cases/:caseId',
    classification: 'CARE-C4',
    permission: 'care.safeguarding.read',
    purposes: ['safeguarding-assessment', 'case-supervision'],
    assurance: 'aal2',
    audience: 'safeguarding',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'safeguarding.membership.change',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/safeguarding/cases/:caseId/memberships',
    classification: 'CARE-C4',
    permission: 'care.safeguarding.membership.manage',
    purposes: ['safeguarding-assessment', 'case-supervision'],
    assurance: 'aal2',
    audience: 'safeguarding',
    idempotent: true,
    boundedQuery: false,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'safeguarding.disclosure.create',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/safeguarding/cases/:caseId/disclosures',
    classification: 'CARE-C4',
    permission: 'care.safeguarding.disclosure.approve',
    purposes: ['mandatory-reporting', 'approved-data-transfer'],
    assurance: 'aal2',
    audience: 'privacy-review',
    idempotent: true,
    boundedQuery: false,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'learning-support.referral.create',
    version: 'v1',
    method: 'POST',
    path: '/v1/care/learning-support/referrals',
    classification: 'CARE-C2',
    permission: 'care.learning-support.referral.create',
    purposes: ['student-support-plan'],
    assurance: 'aal1',
    audience: 'learning-support',
    idempotent: true,
    boundedQuery: false,
    masksExistence: false,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'learning-support.assessment.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/learning-support/assessments/:assessmentId',
    classification: 'CARE-C3',
    permission: 'care.learning-support.assessment.read',
    purposes: ['student-support-plan'],
    assurance: 'aal1',
    audience: 'learning-support',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: true,
  }),
  route({
    id: 'learning-support.academic-projection.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/learning-support/plans/:supportPlanId/academic-projection',
    classification: 'CARE-C2',
    permission: 'care.learning-support.academic-projection.read',
    purposes: ['student-support-plan'],
    assurance: 'aal1',
    audience: 'teacher-projection',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'portal.publication.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/publications/:publicationId',
    classification: 'CARE-C2',
    permission: 'care.portal.read',
    purposes: ['legal-rights-response'],
    assurance: 'aal1',
    audience: 'portal-projection',
    idempotent: true,
    boundedQuery: true,
    masksExistence: true,
    allowsNarrativeResponse: false,
  }),
  route({
    id: 'reports.aggregate.read',
    version: 'v1',
    method: 'GET',
    path: '/v1/care/reports/:reportKey',
    classification: 'CARE-C1',
    permission: 'care.reports.aggregate.read',
    purposes: ['case-supervision', 'security-investigation'],
    assurance: 'aal1',
    audience: 'privacy-review',
    idempotent: true,
    boundedQuery: true,
    masksExistence: false,
    allowsNarrativeResponse: false,
  }),
]);

export interface CareApiRequestDecision {
  readonly allowed: boolean;
  readonly status: 200 | 400 | 401 | 403 | 404;
  readonly code:
    | 'CARE_API_ALLOWED'
    | 'CARE_API_ROUTE_NOT_FOUND'
    | 'CARE_API_CONTEXT_REQUIRED'
    | 'CARE_API_MEMBERSHIP_INACTIVE'
    | 'CARE_API_PERMISSION_DENIED'
    | 'CARE_API_PURPOSE_DENIED'
    | 'CARE_API_STEP_UP_REQUIRED'
    | 'CARE_API_PAGE_SIZE_INVALID';
  readonly masked: boolean;
}

export function authorizeCareApiRoute(input: {
  readonly routeId: string;
  readonly context: CareRequestContext;
  readonly pageSize?: number;
}): CareApiRequestDecision {
  const selected = CARE_API_V1_ROUTES.find((candidate) => candidate.id === input.routeId);
  if (!selected) {
    return { allowed: false, status: 404, code: 'CARE_API_ROUTE_NOT_FOUND', masked: true };
  }
  if (!input.context.tenantId || !input.context.principalId) {
    return {
      allowed: false,
      status: selected.masksExistence ? 404 : 401,
      code: 'CARE_API_CONTEXT_REQUIRED',
      masked: selected.masksExistence,
    };
  }
  if (!input.context.membershipActive) {
    return {
      allowed: false,
      status: selected.masksExistence ? 404 : 403,
      code: 'CARE_API_MEMBERSHIP_INACTIVE',
      masked: selected.masksExistence,
    };
  }
  if (!input.context.permissions.includes(selected.permission)) {
    return {
      allowed: false,
      status: selected.masksExistence ? 404 : 403,
      code: 'CARE_API_PERMISSION_DENIED',
      masked: selected.masksExistence,
    };
  }
  if (!input.context.purpose || !selected.purposes.includes(input.context.purpose)) {
    return {
      allowed: false,
      status: selected.masksExistence ? 404 : 403,
      code: 'CARE_API_PURPOSE_DENIED',
      masked: selected.masksExistence,
    };
  }
  if (selected.assurance === 'aal2' && input.context.assurance !== 'aal2') {
    return {
      allowed: false,
      status: 403,
      code: 'CARE_API_STEP_UP_REQUIRED',
      masked: selected.masksExistence,
    };
  }
  if (
    selected.boundedQuery &&
    input.pageSize !== undefined &&
    (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100)
  ) {
    return {
      allowed: false,
      status: 400,
      code: 'CARE_API_PAGE_SIZE_INVALID',
      masked: false,
    };
  }
  return { allowed: true, status: 200, code: 'CARE_API_ALLOWED', masked: false };
}

export interface CareApiEnvelope<T> {
  readonly version: 'v1';
  readonly correlationId: string;
  readonly data: T;
}

export interface CareApiErrorEnvelope {
  readonly version: 'v1';
  readonly correlationId: string;
  readonly error: Readonly<{ code: string; message: string; retryable: boolean }>;
}

export function createCareApiEnvelope<T>(correlationId: string, data: T): CareApiEnvelope<T> {
  return Object.freeze({ version: 'v1', correlationId, data });
}

export function createCareApiError(input: {
  readonly correlationId: string;
  readonly code: string;
  readonly retryable?: boolean;
  readonly masked?: boolean;
}): CareApiErrorEnvelope {
  return Object.freeze({
    version: 'v1',
    correlationId: input.correlationId,
    error: Object.freeze({
      code: input.masked ? 'CARE_NOT_FOUND' : input.code,
      message: input.masked
        ? 'The requested resource was not found.'
        : 'The student-support request could not be completed.',
      retryable: input.retryable ?? false,
    }),
  });
}
