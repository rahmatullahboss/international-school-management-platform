import { describe, expect, it } from 'vitest';

import {
  currencyCode,
  minorUnit,
  parseMoney,
  moneyZero,
  moneyEquals,
  moneyCompare,
  moneyIsZero,
  moneyIsPositive,
  moneyIsNegative,
  moneyAbsolute,
  moneyNegate,
  moneyAdd,
  moneySubtract,
  moneyMultiply,
  moneyDivide,
  allocateMoney,
  MoneyPrecisionError,
  MoneyCurrencyMismatchError,
  type CurrencyCode,
  type Money,
} from '../../packages/modules/billing/src/index.js';

import {
  createId,
  parseId,
  isValidId,
} from '../../packages/modules/billing/src/index.js';

import {
  createLegalEntityRef,
  createPersonRef,
  createTenantRef,
  createCampusRef,
} from '../../packages/modules/billing/src/index.js';

import {
  checkSeparationOfDuty,
  getFinancePermissionAssurance,
  SEPARATION_OF_DUTY_RULES,
  type SeparationOfDutyContext,
} from '../../packages/modules/billing/src/index.js';

import {
  canTransition,
  transitionApproval,
  type ApprovalRequest,
  type ApprovalState,
} from '../../packages/modules/billing/src/index.js';

import {
  allocateSequenceNumber,
  createDefaultInvoiceNumberingPolicy,
} from '../../packages/modules/billing/src/index.js';

import {
  createRoundingPolicy,
  getCurrencyRoundingPolicy,
  applyRounding,
} from '../../packages/modules/billing/src/index.js';

import {
  isSourceDocument,
  type SourceDocument,
} from '../../packages/modules/billing/src/index.js';

describe('Money contracts', () => {
  describe('currencyCode', () => {
    it('creates valid currency code', () => {
      const usd = currencyCode('USD');
      expect(usd).toBe('USD');
    });

    it('normalizes to uppercase', () => {
      const usd = currencyCode('usd');
      expect(usd).toBe('USD');
    });

    it('rejects unsupported currency', () => {
      expect(() => currencyCode('XYZ')).toThrow('Unsupported currency');
    });
  });

  describe('minorUnit', () => {
    it('creates integer minor unit', () => {
      expect(minorUnit(100)).toBe(100);
    });

    it('rejects non-integer', () => {
      expect(() => minorUnit(100.5)).toThrow('Minor unit must be integer');
    });
  });

  describe('parseMoney', () => {
    it('parses USD amount', () => {
      const m = parseMoney('123.45', 'USD' as CurrencyCode);
      expect(m.amount).toBe(12345);
      expect(m.currency).toBe('USD');
    });

    it('parses zero-decimal currency', () => {
      const m = parseMoney('1000', 'JPY' as CurrencyCode);
      expect(m.amount).toBe(1000);
    });

    it('rejects excessive precision', () => {
      expect(() => parseMoney('1.234', 'USD' as CurrencyCode)).toThrow(MoneyPrecisionError);
    });

    it('parses negative amount', () => {
      const m = parseMoney('-50.00', 'USD' as CurrencyCode);
      expect(m.amount).toBe(-5000);
    });
  });

  describe('arithmetic', () => {
    const usd100: Money = { amount: 10000, currency: 'USD' as CurrencyCode };
    const usd50: Money = { amount: 5000, currency: 'USD' as CurrencyCode };

    it('adds same currency', () => {
      const result = moneyAdd(usd100, usd50);
      expect(result.amount).toBe(15000);
      expect(result.currency).toBe('USD');
    });

    it('subtracts same currency', () => {
      const result = moneySubtract(usd100, usd50);
      expect(result.amount).toBe(5000);
    });

    it('rejects adding different currencies', () => {
      const eur: Money = { amount: 5000, currency: 'EUR' as CurrencyCode };
      expect(() => moneyAdd(usd100, eur)).toThrow(MoneyCurrencyMismatchError);
    });

    it('multiplies by factor', () => {
      const result = moneyMultiply(usd50, 3);
      expect(result.amount).toBe(15000);
    });

    it('divides by divisor', () => {
      const result = moneyDivide(usd100, 4);
      expect(result.amount).toBe(2500);
    });

    it('rejects division by zero', () => {
      expect(() => moneyDivide(usd100, 0)).toThrow('Divisor must be finite non-zero');
    });
  });

  describe('comparison and predicates', () => {
    const zero = moneyZero('USD' as CurrencyCode);
    const positive: Money = { amount: 100, currency: 'USD' as CurrencyCode };
    const negative: Money = { amount: -100, currency: 'USD' as CurrencyCode };

    it('moneyZero creates zero', () => {
      expect(zero.amount).toBe(0);
      expect(moneyIsZero(zero)).toBe(true);
    });

    it('moneyEquals same value', () => {
      const a: Money = { amount: 100, currency: 'USD' as CurrencyCode };
      const b: Money = { amount: 100, currency: 'USD' as CurrencyCode };
      expect(moneyEquals(a, b)).toBe(true);
    });

    it('moneyCompare ordering', () => {
      const a: Money = { amount: 100, currency: 'USD' as CurrencyCode };
      const b: Money = { amount: 200, currency: 'USD' as CurrencyCode };
      expect(moneyCompare(a, b)).toBe(-1);
      expect(moneyCompare(b, a)).toBe(1);
      expect(moneyCompare(a, a)).toBe(0);
    });

    it('predicates', () => {
      expect(moneyIsPositive(positive)).toBe(true);
      expect(moneyIsNegative(negative)).toBe(true);
      expect(moneyIsZero(zero)).toBe(true);
    });

    it('moneyAbsolute', () => {
      expect(moneyAbsolute(negative).amount).toBe(100);
    });

    it('moneyNegate', () => {
      expect(moneyNegate(positive).amount).toBe(-100);
    });
  });

  describe('allocateMoney', () => {
    it('allocates proportionally', () => {
      const total: Money = { amount: 100, currency: 'USD' as CurrencyCode };
      const shares = [1, 1, 1];
      const result = allocateMoney(total, shares);
      expect(result).toHaveLength(3);
      expect(result[0].amount + result[1].amount + result[2].amount).toBe(100);
    });

    it('handles last share as remainder', () => {
      const total: Money = { amount: 100, currency: 'USD' as CurrencyCode };
      const shares = [1, 2];
      const result = allocateMoney(total, shares);
      expect(result).toHaveLength(2);
      expect(result[0].amount + result[1].amount).toBe(100);
    });

    it('rejects empty shares', () => {
      const total: Money = { amount: 100, currency: 'USD' as CurrencyCode };
      expect(allocateMoney(total, [])).toHaveLength(0);
    });
  });
});

describe('Opaque ID contracts', () => {
  it('creates and parses ID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id = createId('inv', uuid);
    expect(id).toBe(`inv_${uuid}`);
    const parsed = parseId(id);
    expect(parsed.prefix).toBe('inv');
    expect(parsed.uuid).toBe(uuid);
  });

  it('rejects invalid UUID', () => {
    expect(() => createId('inv', 'not-a-uuid')).toThrow('Invalid UUID');
  });

  it('validates ID format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id = createId('inv', uuid);
    expect(isValidId(id, 'inv')).toBe(true);
    expect(isValidId(id, 'pay')).toBe(false);
    expect(isValidId('bad', 'inv')).toBe(false);
  });
});

describe('Opaque reference contracts', () => {
  it('creates typed references', () => {
    const le = createLegalEntityRef('le-1');
    const person = createPersonRef('p-1');
    const tenant = createTenantRef('t-1');
    const campus = createCampusRef('c-1');

    expect(typeof le).toBe('string');
    expect(typeof person).toBe('string');
    expect(typeof tenant).toBe('string');
    expect(typeof campus).toBe('string');
  });
});

describe('Separation of duty contracts', () => {
  it('detects SOD violations', () => {
    const context: SeparationOfDutyContext = {
      principalId: 'user-1',
      tenantId: 'tenant-1',
      requestedPermissions: ['billing.invoice.write', 'billing.invoice.post'],
      scope: { tenantId: 'tenant-1' },
    };
    const result = checkSeparationOfDuty(SEPARATION_OF_DUTY_RULES, context);
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('allows non-conflicting permissions', () => {
    const context: SeparationOfDutyContext = {
      principalId: 'user-1',
      tenantId: 'tenant-1',
      requestedPermissions: ['billing.invoice.read', 'billing.payment.read'],
      scope: { tenantId: 'tenant-1' },
    };
    const result = checkSeparationOfDuty(SEPARATION_OF_DUTY_RULES, context);
    expect(result.allowed).toBe(true);
  });

  it('returns correct assurance levels', () => {
    expect(getFinancePermissionAssurance('billing.invoice.post')).toBe('aal2');
    expect(getFinancePermissionAssurance('billing.invoice.read')).toBe('aal1');
    expect(getFinancePermissionAssurance('ledger.journal.post')).toBe('aal2');
    expect(getFinancePermissionAssurance('ledger.journal.read')).toBe('aal1');
  });
});

describe('Approval contracts', () => {
  const baseRequest: ApprovalRequest = {
    requestId: 'req-1',
    documentType: 'invoice',
    documentId: 'inv-1',
    requestedBy: 'user-1',
    requestedAt: new Date(),
    state: 'pending',
    requiredApprovers: 1,
    approvers: ['approver-1'],
    approvedBy: [],
    rejectedBy: null,
    rejectionReason: null,
    escalatedAt: null,
    escalatedTo: null,
    expiresAt: null,
  };

  it('allows valid transitions', () => {
    expect(canTransition('pending', 'approve')).toBe(true);
    expect(canTransition('pending', 'reject')).toBe(true);
    expect(canTransition('pending', 'cancel')).toBe(true);
    expect(canTransition('pending', 'escalate')).toBe(true);
    expect(canTransition('escalated', 'approve')).toBe(true);
    expect(canTransition('escalated', 'reject')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('approved', 'approve')).toBe(false);
    expect(canTransition('rejected', 'reject')).toBe(false);
    expect(canTransition('cancelled', 'cancel')).toBe(false);
  });

  it('transitions approval state', () => {
    const result = transitionApproval(baseRequest, 'approve', 'approver-1');
    expect(result.state).toBe('approved');
    expect(result.approvedBy).toContain('approver-1');
  });

  it('rejects invalid transition', () => {
    const approved = { ...baseRequest, state: 'approved' as ApprovalState };
    expect(() => transitionApproval(approved, 'approve', 'user-1')).toThrow(
      'Cannot approve from state approved'
    );
  });
});

describe('Numbering contracts', () => {
  it('creates and allocates sequence', () => {
    const policy = createDefaultInvoiceNumberingPolicy('tenant-1');
    const allocation = allocateSequenceNumber(
      policy,
      'invoice',
      {
        tenantId: 'tenant-1',
        date: new Date(),
      },
      'idem-key-1'
    );
    expect(allocation.formatted).toMatch(/^INV-\d{6}$/);
    expect(allocation.idempotencyKey).toBe('idem-key-1');
  });

  it('rejects unknown document type', () => {
    const policy = createDefaultInvoiceNumberingPolicy('tenant-1');
    expect(() =>
      allocateSequenceNumber(
        policy,
        'unknown',
        { tenantId: 'tenant-1', date: new Date() },
        'key'
      )
    ).toThrow('No numbering rule for document type');
  });
});

describe('Rounding contracts', () => {
  it('creates rounding policy', () => {
    const policy = createRoundingPolicy('half-even', 2);
    expect(policy.mode).toBe('half-even');
    expect(policy.precision).toBe(2);
  });

  it('rejects invalid precision', () => {
    expect(() => createRoundingPolicy('half-even', -1)).toThrow('Precision must be between');
    expect(() => createRoundingPolicy('half-even', 11)).toThrow('Precision must be between');
  });

  it('gets currency rounding policy', () => {
    const usd = getCurrencyRoundingPolicy('USD');
    expect(usd.precision).toBe(2);
    const jpy = getCurrencyRoundingPolicy('JPY');
    expect(jpy.precision).toBe(0);
  });

  it('applies rounding', () => {
    const policy = createRoundingPolicy('half-even', 2);
    expect(applyRounding(1.235, policy)).toBe(1.24);
    expect(applyRounding(1.225, policy)).toBe(1.22);
  });
});

describe('Source document contracts', () => {
  it('validates source document shape', () => {
    const doc: SourceDocument = {
      id: 'src-1',
      type: 'invoice',
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      reference: 'INV-001',
      issuedAt: new Date(),
      metadata: {},
    };
    expect(isSourceDocument(doc)).toBe(true);
  });

  it('rejects invalid source document', () => {
    expect(isSourceDocument(null)).toBe(false);
    expect(isSourceDocument({})).toBe(false);
    expect(isSourceDocument({ id: '1' })).toBe(false);
  });
});
