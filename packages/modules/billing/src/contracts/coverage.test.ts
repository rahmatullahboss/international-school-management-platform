import { describe, expect, it } from 'vitest';

import {
  allocateSequenceNumber,
  createDefaultInvoiceNumberingPolicy,
  createNumberingPolicy,
  type NumberingPolicy,
  type NumberingSequence,
} from './numbering.js';
import {
  applyRounding,
  createRoundingPolicy,
  getCurrencyRoundingPolicy,
  roundMinorUnits,
} from './rounding.js';
import { isFinanceError, isSourceDocument, type SourceDocument } from './source-documents.js';

function sequence(overrides: Partial<NumberingSequence> = {}): NumberingSequence {
  return {
    sequenceId: 'seq-1',
    scope: 'tenant',
    scopeRef: 'tenant-1',
    prefix: 'INV-',
    suffix: '-A',
    minLength: 4,
    nextValue: 12,
    resetFrequency: 'never',
    ...overrides,
  };
}

describe('billing rounding contracts', () => {
  it('rejects invalid precision definitions', () => {
    expect(() => createRoundingPolicy('half-even', -1)).toThrow(
      'Precision must be between 0 and 10',
    );
    expect(() => createRoundingPolicy('half-even', 11)).toThrow(
      'Precision must be between 0 and 10',
    );
    expect(() => createRoundingPolicy('half-even', 1.5)).toThrow(
      'Precision must be between 0 and 10',
    );
  });

  it('covers every rounding mode, ties, signs and finite guards', () => {
    expect(applyRounding(2.49, createRoundingPolicy('half-even', 0))).toBe(2);
    expect(applyRounding(2.51, createRoundingPolicy('half-even', 0))).toBe(3);
    expect(applyRounding(2.5, createRoundingPolicy('half-even', 0))).toBe(2);
    expect(applyRounding(3.5, createRoundingPolicy('half-even', 0))).toBe(4);
    expect(applyRounding(-3.5, createRoundingPolicy('half-even', 0))).toBe(-4);
    expect(applyRounding(2.5, createRoundingPolicy('half-up', 0))).toBe(3);
    expect(applyRounding(-2.5, createRoundingPolicy('half-up', 0))).toBe(-3);
    expect(applyRounding(2.5, createRoundingPolicy('half-down', 0))).toBe(2);
    expect(applyRounding(-2.5, createRoundingPolicy('half-down', 0))).toBe(-2);
    expect(applyRounding(2.99, createRoundingPolicy('floor', 0))).toBe(2);
    expect(applyRounding(2.01, createRoundingPolicy('ceiling', 0))).toBe(3);
    expect(applyRounding(-2.99, createRoundingPolicy('truncate', 0))).toBe(-2);
    expect(applyRounding(-0.1, createRoundingPolicy('truncate', 0))).toBe(0);
    expect(applyRounding(1.235, createRoundingPolicy('half-even', 2))).toBe(1.24);
    expect(() => applyRounding(Number.NaN, createRoundingPolicy('half-even', 2))).toThrow(
      'Value must be finite',
    );
  });

  it('resolves currency precision and validates ISO-like codes', () => {
    expect(getCurrencyRoundingPolicy(' jpy ')).toEqual({ mode: 'half-even', precision: 0 });
    expect(getCurrencyRoundingPolicy('kwd')).toEqual({ mode: 'half-even', precision: 3 });
    expect(getCurrencyRoundingPolicy('GBP')).toEqual({ mode: 'half-even', precision: 2 });
    expect(() => getCurrencyRoundingPolicy('GB')).toThrow('Invalid currency code: GB');
    expect(roundMinorUnits(10.6, createRoundingPolicy('half-even', 0))).toBe(11);
  });
});

describe('billing numbering contracts', () => {
  it('validates policy uniqueness and rule references', () => {
    const base = sequence();
    expect(
      createNumberingPolicy(
        [base],
        [{ ruleId: 'rule-1', documentType: 'invoice', sequenceId: base.sequenceId, priority: 1 }],
      ),
    ).toMatchObject({ sequences: [base] });
    expect(() => createNumberingPolicy([base, { ...base }], [])).toThrow(
      'Numbering sequence IDs must be unique',
    );
    expect(() =>
      createNumberingPolicy(
        [base],
        [{ ruleId: 'bad', documentType: 'invoice', sequenceId: 'missing', priority: 1 }],
      ),
    ).toThrow('Numbering rule references an unknown sequence');
  });

  it('creates the default invoice policy and rejects empty tenant references', () => {
    const policy = createDefaultInvoiceNumberingPolicy('tenant-1');
    expect(policy.sequences[0]).toMatchObject({
      sequenceId: 'invoice:tenant-1',
      scope: 'tenant',
      prefix: 'INV-',
      minLength: 6,
      nextValue: 1,
    });
    expect(() => createDefaultInvoiceNumberingPolicy(' ')).toThrow('Tenant reference is required');
  });

  it('allocates the highest-priority matching rule using both overloads', () => {
    const low = sequence({ sequenceId: 'low', prefix: 'LOW-', nextValue: 2 });
    const high = sequence({ sequenceId: 'high', prefix: 'HIGH-', nextValue: 7, suffix: '' });
    const policy = createNumberingPolicy(
      [low, high],
      [
        { ruleId: 'low', documentType: 'invoice', sequenceId: 'low', priority: 1 },
        { ruleId: 'high', documentType: 'invoice', sequenceId: 'high', priority: 10 },
      ],
    );
    expect(allocateSequenceNumber(policy, 'invoice', 'idem-key-123')).toEqual({
      sequenceId: 'high',
      allocatedValue: 7,
      formatted: 'HIGH-0007',
      idempotencyKey: 'idem-key-123',
    });
    expect(
      allocateSequenceNumber(policy, 'invoice', { tenantId: 'tenant-1' }, 'idem-key-456'),
    ).toMatchObject({ sequenceId: 'high', idempotencyKey: 'idem-key-456' });
  });

  it('rejects missing rules, short idempotency keys and missing sequences', () => {
    const base = sequence();
    const policy = createNumberingPolicy(
      [base],
      [{ ruleId: 'invoice', documentType: 'invoice', sequenceId: base.sequenceId, priority: 1 }],
    );
    expect(() => allocateSequenceNumber(policy, 'credit-note', 'idem-key-123')).toThrow(
      'No numbering rule for document type: credit-note',
    );
    expect(() => allocateSequenceNumber(policy, 'invoice', 'short')).toThrow(
      'Idempotency key must contain at least 8 characters',
    );
    const missingSequence: NumberingPolicy = {
      sequences: [],
      rules: [{ ruleId: 'invoice', documentType: 'invoice', sequenceId: 'missing', priority: 1 }],
    };
    expect(() => allocateSequenceNumber(missingSequence, 'invoice', 'idem-key-123')).toThrow(
      'Sequence not found: missing',
    );
  });

  it('enforces tenant, legal-entity and campus scopes', () => {
    const cases: readonly [NumberingSequence, Record<string, string>][] = [
      [sequence({ scope: 'tenant', scopeRef: 'tenant-1' }), { tenantId: 'tenant-2' }],
      [
        sequence({ scope: 'legal-entity', scopeRef: 'entity-1' }),
        { tenantId: 'tenant-1', legalEntityId: 'entity-2' },
      ],
      [
        sequence({ scope: 'campus', scopeRef: 'campus-1' }),
        { tenantId: 'tenant-1', campusId: 'campus-2' },
      ],
    ];
    for (const [scopedSequence, context] of cases) {
      const policy = createNumberingPolicy(
        [scopedSequence],
        [
          {
            ruleId: 'invoice',
            documentType: 'invoice',
            sequenceId: scopedSequence.sequenceId,
            priority: 1,
          },
        ],
      );
      expect(() => allocateSequenceNumber(policy, 'invoice', context, 'idem-key-123')).toThrow(
        'Numbering scope mismatch',
      );
    }
  });

  it('accepts matching non-tenant scopes and rejects unsafe next values', () => {
    for (const scopedSequence of [
      sequence({ scope: 'legal-entity', scopeRef: 'entity-1' }),
      sequence({ scope: 'campus', scopeRef: 'campus-1' }),
    ]) {
      const policy = createNumberingPolicy(
        [scopedSequence],
        [
          {
            ruleId: 'invoice',
            documentType: 'invoice',
            sequenceId: scopedSequence.sequenceId,
            priority: 1,
          },
        ],
      );
      expect(
        allocateSequenceNumber(
          policy,
          'invoice',
          { tenantId: 'tenant-1', legalEntityId: 'entity-1', campusId: 'campus-1' },
          'idem-key-123',
        ),
      ).toMatchObject({ allocatedValue: 12 });
    }

    const invalid = sequence({ nextValue: 0 });
    const invalidPolicy = createNumberingPolicy(
      [invalid],
      [{ ruleId: 'invoice', documentType: 'invoice', sequenceId: invalid.sequenceId, priority: 1 }],
    );
    expect(() => allocateSequenceNumber(invalidPolicy, 'invoice', 'idem-key-123')).toThrow(
      'Sequence next value must be a positive safe integer',
    );
  });
});

describe('finance source-document guards', () => {
  const valid: SourceDocument = {
    id: 'doc-1',
    type: 'invoice',
    tenantId: 'tenant-1',
    legalEntityId: 'entity-1',
    reference: 'INV-1',
    issuedAt: new Date('2026-08-01T00:00:00.000Z'),
    metadata: {},
  };

  it('recognizes complete source documents and rejects malformed values', () => {
    expect(isSourceDocument(valid)).toBe(true);
    expect(isSourceDocument(null)).toBe(false);
    expect(isSourceDocument('document')).toBe(false);
    expect(isSourceDocument({ ...valid, id: 1 })).toBe(false);
    expect(isSourceDocument({ ...valid, type: 1 })).toBe(false);
    expect(isSourceDocument({ ...valid, tenantId: 1 })).toBe(false);
    expect(isSourceDocument({ ...valid, legalEntityId: 1 })).toBe(false);
    expect(isSourceDocument({ ...valid, reference: 1 })).toBe(false);
    expect(isSourceDocument({ ...valid, issuedAt: '2026-08-01' })).toBe(false);
    expect(isSourceDocument({ ...valid, metadata: null })).toBe(false);
    expect(isSourceDocument({ ...valid, metadata: 'metadata' })).toBe(false);
  });

  it('recognizes finance-error envelopes only when required keys exist', () => {
    expect(isFinanceError({ code: 'FIN_NOT_FOUND', message: 'Missing', retryable: false })).toBe(
      true,
    );
    expect(isFinanceError(null)).toBe(false);
    expect(isFinanceError('error')).toBe(false);
    expect(isFinanceError({ message: 'Missing', retryable: false })).toBe(false);
    expect(isFinanceError({ code: 'FIN_NOT_FOUND', retryable: false })).toBe(false);
    expect(isFinanceError({ code: 'FIN_NOT_FOUND', message: 'Missing' })).toBe(false);
  });
});
