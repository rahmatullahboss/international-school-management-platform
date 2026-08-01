export type PilotOperatorRole = 'admissions' | 'finance' | 'support';
export type PilotOperatorAssurance = 'aal1' | 'aal2';

export interface PilotOperatorScope {
  readonly tenantId: string;
  readonly campusId: string;
  readonly role: PilotOperatorRole;
  readonly subjectId: string;
  readonly assurance: PilotOperatorAssurance;
  readonly capabilities: readonly string[];
}

export interface PilotOperatorSnapshot {
  readonly schemaVersion: 1;
  readonly sourceVersion: string;
  readonly generatedAt: string;
  readonly scope: PilotOperatorScope;
  readonly data: Readonly<Record<string, unknown>>;
}

export type PilotOperatorResolution =
  | { readonly ok: true; readonly snapshot: PilotOperatorSnapshot; readonly etag: string }
  | {
      readonly ok: false;
      readonly status: 400 | 403 | 404;
      readonly code: string;
      readonly message: string;
    };

export type PilotOperatorPermissionDecision =
  | { readonly allowed: true; readonly reason: 'role-grant' }
  | { readonly allowed: false; readonly reason: 'permission-not-granted' }
  | {
      readonly allowed: false;
      readonly reason: 'step-up-required';
      readonly requiredAssurance: 'aal2';
    };

export const PILOT_OPERATOR_TENANT_ID = 'tenant-pilot-001';
export const PILOT_OPERATOR_CAMPUS_ID = 'campus-main';
const SOURCE_VERSION = 'pilot-operator-v2-2026-08-01';
const timestamp = '2026-08-01T14:00:00+06:00';

const operatorDefinitions = {
  admissions: {
    subjectId: 'admissions-1',
    assurance: 'aal1',
    capabilities: [
      'admissions.enquiry.read',
      'admissions.application.read',
      'admissions.application.review',
      'admissions.interview.manage',
      'admissions.offer.prepare',
      'admissions.enrolment.convert',
    ],
    data: {
      metrics: [
        { label: 'Open enquiries', value: '18', detail: 'Six require first response today' },
        { label: 'Applications in review', value: '27', detail: 'Across current intake cycles' },
        { label: 'Interviews scheduled', value: '9', detail: 'Next seven days' },
      ],
      workItems: [
        {
          id: 'application-1',
          title: 'Review Nabil Noor application',
          detail: 'Required documents are complete and ready for admissions review.',
          status: 'Ready',
          href: '/admissions/applications',
          requiredCapability: 'admissions.application.review',
        },
        {
          id: 'enquiry-1',
          title: 'Respond to Year 6 enquiry',
          detail: 'Family requested curriculum and transport information.',
          status: 'Due today',
          href: '/admissions/enquiries',
          requiredCapability: 'admissions.enquiry.read',
        },
      ],
      actions: [
        { label: 'Open applications', href: '/admissions/applications' },
        { label: 'Review interviews', href: '/admissions/interviews' },
      ],
    },
  },
  finance: {
    subjectId: 'cashier-1',
    assurance: 'aal1',
    capabilities: [
      'finance.invoice.read',
      'finance.receipt.create',
      'finance.cash-session.manage',
      'finance.reconciliation.write',
      'finance.statement.read',
    ],
    data: {
      metrics: [
        { label: 'Receipts today', value: '63', detail: 'BDT 486k verified' },
        { label: 'Open cash session', value: '1', detail: 'Counter A · balanced so far' },
        { label: 'Unreconciled receipts', value: '7', detail: 'Waiting for deposit matching' },
      ],
      workItems: [
        {
          id: 'cash-1',
          title: 'Reconcile Counter A cash session',
          detail: 'Receipt total and counted cash are ready for review.',
          status: 'Ready',
          href: '/finance/cashier',
          requiredCapability: 'finance.cash-session.manage',
        },
        {
          id: 'reconcile-1',
          title: 'Match seven verified receipts',
          detail: 'Deposit evidence is available.',
          status: 'Review',
          href: '/finance/reconciliation',
          requiredCapability: 'finance.reconciliation.write',
        },
      ],
      actions: [
        { label: 'Open cashier', href: '/finance/cashier' },
        { label: 'Open reconciliation', href: '/finance/reconciliation' },
      ],
    },
  },
  support: {
    subjectId: 'support-operator-1',
    assurance: 'aal2',
    capabilities: [
      'platform.tenant.select',
      'platform.deployment-health.read',
      'support.diagnostics.read',
      'support.access.request',
      'support.break-glass.request',
    ],
    data: {
      metrics: [
        { label: 'Healthy tenants', value: '24 / 24', detail: 'No active deployment incidents' },
        { label: 'Open support cases', value: '3', detail: 'All tenant-scoped and audited' },
        { label: 'Privileged grants', value: '0', detail: 'No active break-glass access' },
      ],
      workItems: [
        {
          id: 'support-1',
          title: 'Capture tenant diagnostics',
          detail: 'Read-only deployment and projection health for the selected tenant.',
          status: 'Diagnostic',
          href: '/support/health',
          requiredCapability: 'support.diagnostics.read',
        },
        {
          id: 'support-2',
          title: 'Review privileged access request',
          detail:
            'Any sensitive access requires explicit tenant, purpose, expiry and audit evidence.',
          status: 'Restricted',
          href: '/support/access',
          requiredCapability: 'support.access.request',
        },
      ],
      actions: [
        { label: 'Select tenant', href: '/support/tenants' },
        { label: 'Open deployment health', href: '/support/health' },
      ],
    },
  },
} as const satisfies Readonly<
  Record<
    PilotOperatorRole,
    {
      readonly subjectId: string;
      readonly assurance: PilotOperatorAssurance;
      readonly capabilities: readonly string[];
      readonly data: Readonly<Record<string, unknown>>;
    }
  >
>;

const aal2Permissions = new Set(['support.break-glass.request']);

export function isPilotOperatorRole(value: unknown): value is PilotOperatorRole {
  return value === 'admissions' || value === 'finance' || value === 'support';
}

export function pilotOperatorSubject(role: PilotOperatorRole): string {
  return operatorDefinitions[role].subjectId;
}

export function pilotOperatorAssurance(role: PilotOperatorRole): PilotOperatorAssurance {
  return operatorDefinitions[role].assurance;
}

export function pilotOperatorCapabilities(role: PilotOperatorRole): readonly string[] {
  return operatorDefinitions[role].capabilities;
}

export function authorizePilotOperatorPermission(
  role: PilotOperatorRole,
  permission: string,
  assurance: PilotOperatorAssurance,
): PilotOperatorPermissionDecision {
  if (!operatorDefinitions[role].capabilities.some((capability) => capability === permission)) {
    return { allowed: false, reason: 'permission-not-granted' };
  }
  if (aal2Permissions.has(permission) && assurance !== 'aal2') {
    return { allowed: false, reason: 'step-up-required', requiredAssurance: 'aal2' };
  }
  return { allowed: true, reason: 'role-grant' };
}

function requiredHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)?.trim();
  return value === '' ? undefined : value;
}

export function resolvePilotOperatorSnapshot(
  headers: Headers,
  roleValue: string,
  generatedAt = new Date().toISOString(),
): PilotOperatorResolution {
  if (!isPilotOperatorRole(roleValue)) {
    return {
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
      message: 'The requested pilot role is not available.',
    };
  }

  const tenantId = requiredHeader(headers, 'x-school-tenant-id');
  const campusId = requiredHeader(headers, 'x-school-campus-id');
  const declaredRole = requiredHeader(headers, 'x-school-role');
  const subjectId = requiredHeader(headers, 'x-school-subject-id');
  const assurance = requiredHeader(headers, 'x-school-assurance');
  if (
    tenantId === undefined ||
    campusId === undefined ||
    declaredRole === undefined ||
    subjectId === undefined ||
    assurance === undefined
  ) {
    return {
      ok: false,
      status: 400,
      code: 'pilot_scope_incomplete',
      message: 'Tenant, campus, role, subject and assurance scope are required.',
    };
  }

  const definition = operatorDefinitions[roleValue];
  if (
    tenantId !== PILOT_OPERATOR_TENANT_ID ||
    campusId !== PILOT_OPERATOR_CAMPUS_ID ||
    declaredRole !== roleValue ||
    subjectId !== definition.subjectId ||
    assurance !== definition.assurance
  ) {
    return {
      ok: false,
      status: 403,
      code: 'pilot_scope_denied',
      message: 'The requested pilot scope is not permitted.',
    };
  }

  const scope: PilotOperatorScope = {
    tenantId,
    campusId,
    role: roleValue,
    subjectId,
    assurance: definition.assurance,
    capabilities: definition.capabilities,
  };
  return {
    ok: true,
    etag: `W/"${SOURCE_VERSION}:${tenantId}:${campusId}:${roleValue}:${subjectId}"`,
    snapshot: {
      schemaVersion: 1,
      sourceVersion: SOURCE_VERSION,
      generatedAt,
      scope,
      data: definition.data,
    },
  };
}

export function pilotOperatorHeaders(role: PilotOperatorRole): Headers {
  const definition = operatorDefinitions[role];
  return new Headers({
    'x-school-tenant-id': PILOT_OPERATOR_TENANT_ID,
    'x-school-campus-id': PILOT_OPERATOR_CAMPUS_ID,
    'x-school-role': role,
    'x-school-subject-id': definition.subjectId,
    'x-school-assurance': definition.assurance,
  });
}

export const pilotOperatorTimestamp = timestamp;
