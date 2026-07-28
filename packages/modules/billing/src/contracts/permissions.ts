export type FinancePermission =
  | 'billing.account.read'
  | 'billing.account.write'
  | 'billing.fee.write'
  | 'billing.invoice.read'
  | 'billing.invoice.write'
  | 'billing.invoice.post'
  | 'billing.invoice.void'
  | 'billing.payment.read'
  | 'billing.payment.write'
  | 'billing.payment.verify'
  | 'billing.allocation.write'
  | 'billing.allocation.unallocate'
  | 'billing.refund.write'
  | 'billing.refund.approve'
  | 'billing.credit-note.write'
  | 'billing.credit-note.post'
  | 'cashier.session.open'
  | 'cashier.session.close'
  | 'cashier.deposit.approve'
  | 'ledger.account.read'
  | 'ledger.account.write'
  | 'ledger.journal.read'
  | 'ledger.journal.write'
  | 'ledger.journal.post'
  | 'ledger.journal.reverse'
  | 'ledger.period.read'
  | 'ledger.period.close'
  | 'ledger.period.reopen'
  | 'ledger.reconciliation.read'
  | 'ledger.reconciliation.write'
  | 'ledger.reconciliation.approve'
  | 'finance.report.read'
  | 'finance.export';

export type AssuranceLevel = 'aal1' | 'aal2' | 'aal3';

export interface FinanceScope {
  readonly tenantId: string;
  readonly legalEntityId?: string;
  readonly campusId?: string;
}

export interface FinancePrincipal {
  readonly principalId: string;
  readonly permissions: readonly FinancePermission[];
  readonly assurance: AssuranceLevel;
  readonly scope: FinanceScope;
}

export interface SeparationOfDutyRule {
  readonly ruleId: string;
  readonly name: string;
  readonly conflictingPermissions: readonly [FinancePermission, FinancePermission];
  readonly requiredApprovers: number;
  readonly scope: FinanceScope;
}

export interface SeparationOfDutyContext {
  readonly principalId: string;
  readonly tenantId: string;
  readonly requestedPermissions: readonly FinancePermission[];
  readonly scope: FinanceScope;
}

export const SEPARATION_OF_DUTY_RULES: readonly SeparationOfDutyRule[] = Object.freeze([
  {
    ruleId: 'sod-invoice-create-post',
    name: 'Invoice creator cannot post',
    conflictingPermissions: ['billing.invoice.write', 'billing.invoice.post'],
    requiredApprovers: 1,
    scope: { tenantId: '*' },
  },
  {
    ruleId: 'sod-payment-refund',
    name: 'Payment verifier cannot approve refund',
    conflictingPermissions: ['billing.payment.verify', 'billing.refund.approve'],
    requiredApprovers: 1,
    scope: { tenantId: '*' },
  },
  {
    ruleId: 'sod-journal-create-post',
    name: 'Journal creator cannot post',
    conflictingPermissions: ['ledger.journal.write', 'ledger.journal.post'],
    requiredApprovers: 1,
    scope: { tenantId: '*' },
  },
  {
    ruleId: 'sod-period-close-reopen',
    name: 'Period closer cannot reopen',
    conflictingPermissions: ['ledger.period.close', 'ledger.period.reopen'],
    requiredApprovers: 2,
    scope: { tenantId: '*' },
  },
  {
    ruleId: 'sod-cashier-deposit',
    name: 'Cashier cannot approve own deposit',
    conflictingPermissions: ['cashier.session.close', 'cashier.deposit.approve'],
    requiredApprovers: 1,
    scope: { tenantId: '*' },
  },
]);

function scopeMatches(rule: FinanceScope, context: FinanceScope): boolean {
  const tenantMatches = rule.tenantId === '*' || rule.tenantId === context.tenantId;
  const entityMatches =
    rule.legalEntityId === undefined || rule.legalEntityId === context.legalEntityId;
  const campusMatches = rule.campusId === undefined || rule.campusId === context.campusId;
  return tenantMatches && entityMatches && campusMatches;
}

export function checkSeparationOfDuty(
  rules: readonly SeparationOfDutyRule[],
  context: SeparationOfDutyContext,
): { allowed: boolean; violations: readonly string[] } {
  const requested = new Set(context.requestedPermissions);
  const violations = rules
    .filter((rule) => scopeMatches(rule.scope, context.scope))
    .filter((rule) => rule.conflictingPermissions.every((permission) => requested.has(permission)))
    .map((rule) => `${rule.name} (${rule.ruleId})`);
  return Object.freeze({ allowed: violations.length === 0, violations: Object.freeze(violations) });
}

export function getFinancePermissionAssurance(permission: FinancePermission): AssuranceLevel {
  const aal3: readonly FinancePermission[] = ['ledger.period.reopen'];
  if (aal3.includes(permission)) return 'aal3';
  const aal2: readonly FinancePermission[] = [
    'billing.invoice.post',
    'billing.invoice.void',
    'billing.payment.verify',
    'billing.allocation.unallocate',
    'billing.refund.approve',
    'billing.credit-note.post',
    'cashier.session.close',
    'cashier.deposit.approve',
    'ledger.journal.post',
    'ledger.journal.reverse',
    'ledger.period.close',
    'ledger.reconciliation.approve',
    'finance.export',
  ];
  return aal2.includes(permission) ? 'aal2' : 'aal1';
}

const assuranceRank: Readonly<Record<AssuranceLevel, number>> = { aal1: 1, aal2: 2, aal3: 3 };

export function authorizeFinance(
  principal: FinancePrincipal,
  permission: FinancePermission,
  scope: FinanceScope,
): void {
  if (!principal.permissions.includes(permission)) throw new Error(`FIN_FORBIDDEN:${permission}`);
  if (!scopeMatches(principal.scope, scope)) throw new Error('FIN_SCOPE_MISMATCH');
  const required = getFinancePermissionAssurance(permission);
  if (assuranceRank[principal.assurance] < assuranceRank[required])
    throw new Error(`FIN_STEP_UP_REQUIRED:${required}`);
}
