import { describe, expect, it } from 'vitest';

import { canTransition, transitionApproval, type ApprovalRequest } from './approval.js';
import { createId, formatId, isValidId, parseId, type OpaqueId } from './ids.js';
import {
  allocateMoney,
  currencyCode,
  formatMoney,
  minorUnit,
  moneyAbsolute,
  moneyAdd,
  moneyCompare,
  moneyDivide,
  moneyEquals,
  moneyIsNegative,
  moneyIsPositive,
  moneyIsZero,
  moneyMultiply,
  moneyNegate,
  moneySubtract,
  moneyToNumber,
  moneyZero,
  MoneyCurrencyMismatchError,
  MoneyPrecisionError,
  parseMoney,
  type CurrencyCode,
  type Money,
} from './money.js';
import {
  authorizeFinance,
  checkSeparationOfDuty,
  getFinancePermissionAssurance,
  SEPARATION_OF_DUTY_RULES,
  type FinancePrincipal,
  type SeparationOfDutyRule,
} from './permissions.js';
import {
  createCampusRef,
  createLegalEntityRef,
  createPersonRef,
  createTenantRef,
} from './references.js';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    requestId: 'approval-1',
    documentType: 'refund',
    documentId: 'refund-1',
    requestedBy: 'requester-1',
    requestedAt: new Date('2026-08-01T00:00:00.000Z'),
    state: 'pending',
    requiredApprovers: 2,
    approvers: ['approver-1', 'approver-2'],
    approvedBy: [],
    rejectedBy: null,
    rejectionReason: null,
    escalatedAt: null,
    escalatedTo: null,
    expiresAt: null,
    ...overrides,
  };
}

function gbp(amount: number): Money {
  return { amount: minorUnit(amount), currency: currencyCode('GBP') };
}

describe('approval state machine', () => {
  it('reports valid and invalid transition capabilities', () => {
    expect(canTransition('pending', 'approve')).toBe(true);
    expect(canTransition('pending', 'reject')).toBe(true);
    expect(canTransition('pending', 'cancel')).toBe(true);
    expect(canTransition('pending', 'escalate')).toBe(true);
    expect(canTransition('escalated', 'approve')).toBe(true);
    expect(canTransition('escalated', 'reject')).toBe(true);
    expect(canTransition('approved', 'approve')).toBe(false);
    expect(canTransition('cancelled', 'reject')).toBe(false);
  });

  it('holds partial approval pending and de-duplicates repeat approvers', () => {
    const first = transitionApproval(approval(), 'approve', 'approver-1');
    expect(first).toMatchObject({ state: 'pending', approvedBy: ['approver-1'] });
    const repeat = transitionApproval(first, 'approve', 'approver-1');
    expect(repeat).toMatchObject({ state: 'pending', approvedBy: ['approver-1'] });
    const complete = transitionApproval(first, 'approve', 'approver-2');
    expect(complete).toMatchObject({ state: 'approved', approvedBy: ['approver-1', 'approver-2'] });
  });

  it('covers reject defaults, explicit comments, cancellation and escalation', () => {
    expect(transitionApproval(approval(), 'reject', 'approver-1')).toMatchObject({
      state: 'rejected',
      rejectedBy: 'approver-1',
      rejectionReason: 'Rejected',
    });
    expect(transitionApproval(approval(), 'reject', 'approver-1', 'Policy mismatch')).toMatchObject(
      {
        state: 'rejected',
        rejectionReason: 'Policy mismatch',
      },
    );
    expect(transitionApproval(approval(), 'cancel', 'requester-1')).toMatchObject({
      state: 'cancelled',
    });
    const escalated = transitionApproval(approval(), 'escalate', 'approver-1');
    expect(escalated.state).toBe('escalated');
    expect(escalated.escalatedAt).toBeInstanceOf(Date);
    expect(transitionApproval(escalated, 'approve', 'approver-2').state).toBe('escalated');
  });

  it('rejects forbidden state, assignee and self-approval paths', () => {
    expect(() =>
      transitionApproval(approval({ state: 'approved' }), 'reject', 'approver-1'),
    ).toThrow('Cannot reject from state approved');
    expect(() => transitionApproval(approval(), 'approve', 'outsider')).toThrow(
      'Principal is not an assigned approver',
    );
    expect(() =>
      transitionApproval(approval({ requestedBy: 'approver-1' }), 'approve', 'approver-1'),
    ).toThrow('Requester cannot approve own request');
  });
});

describe('opaque finance identifiers', () => {
  it('creates, parses, formats and validates branded IDs', () => {
    const id = createId('invoice', uuid);
    expect(id).toBe(`invoice_${uuid}`);
    expect(parseId(id)).toEqual({ prefix: 'invoice', uuid });
    expect(formatId(id)).toBe(id);
    expect(isValidId(String(id), 'invoice')).toBe(true);
    expect(isValidId(String(id), 'refund')).toBe(false);
    expect(isValidId('invoice_not-a-uuid', 'invoice')).toBe(false);
  });

  it('rejects malformed UUIDs and opaque ID formats', () => {
    expect(() => createId('invoice', 'bad')).toThrow('Invalid UUID: bad');
    expect(() => parseId('no-separator' as OpaqueId<'invoice'>)).toThrow('Invalid ID format');
    expect(() => parseId('invoice_bad' as OpaqueId<'invoice'>)).toThrow('Invalid UUID in ID');
  });
});

describe('money primitive contracts', () => {
  it('normalizes supported currencies and rejects unsupported values', () => {
    expect(currencyCode(' gbp ')).toBe('GBP');
    expect(() => currencyCode('XYZ')).toThrow('Unsupported currency: XYZ');
    expect(minorUnit(42)).toBe(42);
    expect(() => minorUnit(1.2)).toThrow('Minor unit must be integer and safe');
    expect(() => minorUnit(Number.MAX_VALUE)).toThrow('Minor unit must be integer and safe');
  });

  it('parses zero, decimal, negative and zero-precision monetary inputs', () => {
    const gbpCode = currencyCode('GBP');
    expect(parseMoney('12', gbpCode)).toEqual({ amount: 1200, currency: gbpCode });
    expect(parseMoney('12.3', gbpCode)).toEqual({ amount: 1230, currency: gbpCode });
    expect(parseMoney('-12.34', gbpCode)).toEqual({ amount: -1234, currency: gbpCode });
    const jpy = currencyCode('JPY');
    expect(parseMoney('12', jpy)).toEqual({ amount: 12, currency: jpy });
    expect(() => parseMoney('01.00', gbpCode)).toThrow('Invalid monetary amount');
    expect(() => parseMoney('1.234', gbpCode)).toThrow(MoneyPrecisionError);
    expect(() => parseMoney('1', 'XYZ' as CurrencyCode)).toThrow('Unsupported currency: XYZ');
  });

  it('performs same-currency arithmetic and rejects mismatches', () => {
    const left = gbp(125);
    const right = gbp(25);
    expect(moneyZero(left.currency)).toEqual(gbp(0));
    expect(moneyAdd(left, right)).toEqual(gbp(150));
    expect(moneySubtract(left, right)).toEqual(gbp(100));
    expect(moneyMultiply(left, 2)).toEqual(gbp(250));
    expect(moneyDivide(left, 5)).toEqual(gbp(25));
    expect(moneyEquals(left, gbp(125))).toBe(true);
    expect(moneyCompare(gbp(1), gbp(2))).toBe(-1);
    expect(moneyCompare(gbp(2), gbp(1))).toBe(1);
    expect(moneyCompare(gbp(2), gbp(2))).toBe(0);

    const usd = { amount: minorUnit(125), currency: currencyCode('USD') };
    expect(() => moneyAdd(left, usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => moneySubtract(left, usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => moneyEquals(left, usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => moneyCompare(left, usd)).toThrow(MoneyCurrencyMismatchError);
    expect(() => moneyMultiply(left, Number.POSITIVE_INFINITY)).toThrow('Factor must be finite');
    expect(() => moneyDivide(left, 0)).toThrow('Divisor must be finite non-zero');
    expect(() => moneyDivide(left, Number.NaN)).toThrow('Divisor must be finite non-zero');
  });

  it('covers sign helpers, allocation validation and deterministic remainder distribution', () => {
    expect(moneyAbsolute(gbp(-5))).toEqual(gbp(5));
    expect(moneyNegate(gbp(5))).toEqual(gbp(-5));
    expect(moneyIsPositive(gbp(1))).toBe(true);
    expect(moneyIsPositive(gbp(0))).toBe(false);
    expect(moneyIsNegative(gbp(-1))).toBe(true);
    expect(moneyIsNegative(gbp(0))).toBe(false);
    expect(moneyIsZero(gbp(0))).toBe(true);
    expect(moneyIsZero(gbp(1))).toBe(false);
    expect(allocateMoney(gbp(100), [])).toEqual([]);
    expect(() => allocateMoney(gbp(100), [1, -1])).toThrow(
      'Weights must be finite and non-negative',
    );
    expect(() => allocateMoney(gbp(100), [1, Number.NaN])).toThrow(
      'Weights must be finite and non-negative',
    );
    expect(() => allocateMoney(gbp(100), [0, 0])).toThrow('Weights must sum to a positive value');
    expect(allocateMoney(gbp(100), [1, 1, 1])).toEqual([gbp(34), gbp(33), gbp(33)]);
    expect(allocateMoney(gbp(-100), [1, 1, 1])).toEqual([gbp(-34), gbp(-33), gbp(-33)]);
    expect(allocateMoney(gbp(100), [1])).toEqual([gbp(100)]);
  });

  it('converts and formats currencies with supported precision only', () => {
    expect(moneyToNumber(gbp(1234))).toBe(12.34);
    expect(formatMoney(gbp(1234), 'en-GB')).toContain('12.34');
    expect(() => moneyToNumber({ amount: minorUnit(1), currency: 'XYZ' as CurrencyCode })).toThrow(
      'Unsupported currency: XYZ',
    );
  });
});

describe('finance permission contracts', () => {
  it('maps permissions to their required assurance level', () => {
    expect(getFinancePermissionAssurance('ledger.period.reopen')).toBe('aal3');
    expect(getFinancePermissionAssurance('billing.invoice.post')).toBe('aal2');
    expect(getFinancePermissionAssurance('billing.invoice.read')).toBe('aal1');
  });

  it('finds separation-of-duty conflicts and respects entity/campus scope filters', () => {
    const result = checkSeparationOfDuty(SEPARATION_OF_DUTY_RULES, {
      principalId: 'finance-1',
      tenantId: 'tenant-1',
      requestedPermissions: ['billing.invoice.write', 'billing.invoice.post'],
      scope: { tenantId: 'tenant-1' },
    });
    expect(result.allowed).toBe(false);
    expect(result.violations).toContain('Invoice creator cannot post (sod-invoice-create-post)');

    const scopedRule: SeparationOfDutyRule = {
      ruleId: 'scoped',
      name: 'Scoped conflict',
      conflictingPermissions: ['billing.invoice.write', 'billing.invoice.post'],
      requiredApprovers: 1,
      scope: { tenantId: 'tenant-1', legalEntityId: 'entity-1', campusId: 'campus-1' },
    };
    expect(
      checkSeparationOfDuty([scopedRule], {
        principalId: 'finance-1',
        tenantId: 'tenant-1',
        requestedPermissions: ['billing.invoice.write', 'billing.invoice.post'],
        scope: { tenantId: 'tenant-1', legalEntityId: 'entity-2', campusId: 'campus-1' },
      }).allowed,
    ).toBe(true);
    expect(
      checkSeparationOfDuty([scopedRule], {
        principalId: 'finance-1',
        tenantId: 'tenant-1',
        requestedPermissions: ['billing.invoice.write', 'billing.invoice.post'],
        scope: { tenantId: 'tenant-1', legalEntityId: 'entity-1', campusId: 'campus-2' },
      }).allowed,
    ).toBe(true);
    expect(
      checkSeparationOfDuty([scopedRule], {
        principalId: 'finance-1',
        tenantId: 'tenant-1',
        requestedPermissions: ['billing.invoice.write', 'billing.invoice.post'],
        scope: { tenantId: 'tenant-1', legalEntityId: 'entity-1', campusId: 'campus-1' },
      }).allowed,
    ).toBe(false);
  });

  it('authorizes permission, scope and assurance and fails closed for each mismatch', () => {
    const principal: FinancePrincipal = {
      principalId: 'finance-1',
      permissions: ['billing.invoice.read', 'billing.invoice.post', 'ledger.period.reopen'],
      assurance: 'aal2',
      scope: { tenantId: 'tenant-1', legalEntityId: 'entity-1', campusId: 'campus-1' },
    };
    expect(() =>
      authorizeFinance(principal, 'billing.invoice.read', {
        tenantId: 'tenant-1',
        legalEntityId: 'entity-1',
        campusId: 'campus-1',
      }),
    ).not.toThrow();
    expect(() =>
      authorizeFinance(principal, 'billing.refund.write', { tenantId: 'tenant-1' }),
    ).toThrow('FIN_FORBIDDEN:billing.refund.write');
    expect(() =>
      authorizeFinance(principal, 'billing.invoice.read', { tenantId: 'tenant-2' }),
    ).toThrow('FIN_SCOPE_MISMATCH');
    expect(() =>
      authorizeFinance(principal, 'ledger.period.reopen', {
        tenantId: 'tenant-1',
        legalEntityId: 'entity-1',
        campusId: 'campus-1',
      }),
    ).toThrow('FIN_STEP_UP_REQUIRED:aal3');
  });
});

describe('finance reference contracts', () => {
  it('trims valid opaque references for every supported reference kind', () => {
    expect(createTenantRef(' tenant-1 ')).toBe('tenant-1');
    expect(createLegalEntityRef(' entity-1 ')).toBe('entity-1');
    expect(createCampusRef(' campus-1 ')).toBe('campus-1');
    expect(createPersonRef(' person-1 ')).toBe('person-1');
  });

  it('rejects empty and overlong opaque references', () => {
    expect(() => createTenantRef(' ')).toThrow('Invalid tenant reference');
    expect(() => createLegalEntityRef('x'.repeat(201))).toThrow('Invalid legal entity reference');
    expect(() => createCampusRef('x'.repeat(201))).toThrow('Invalid campus reference');
    expect(() => createPersonRef('x'.repeat(201))).toThrow('Invalid person reference');
  });
});
