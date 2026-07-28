import { describe, expect, it } from 'vitest';

import {
  allocateMoney,
  applyRounding,
  checkSeparationOfDuty,
  createRoundingPolicy,
  currencyCode,
  moneyAdd,
  moneyEquals,
  parseMoney,
  SEPARATION_OF_DUTY_RULES,
} from '../../packages/modules/billing/src/index.js';
import {
  calculateLineAmount,
  type JournalEntry,
  type JournalLine,
  validateJournalEntry,
} from '../../packages/modules/ledger/src/index.js';

const now = new Date('2026-07-28T00:00:00.000Z');

describe('FIN-01 public finance contracts', () => {
  it('uses integer minor units and rejects cross-currency arithmetic', () => {
    const gbp = currencyCode('GBP');
    const total = moneyAdd(parseMoney('10.05', gbp), parseMoney('0.95', gbp));
    expect(moneyEquals(total, parseMoney('11.00', gbp))).toBe(true);
    expect(() => moneyAdd(total, parseMoney('1.00', currencyCode('USD')))).toThrow('Currency mismatch');
    expect(() => parseMoney('1.001', gbp)).toThrow('requires 2 decimal places');
  });

  it('allocates every minor unit deterministically', () => {
    const allocations = allocateMoney(parseMoney('10.00', currencyCode('GBP')), [1, 1, 1]);
    expect(allocations.map((money) => money.amount)).toEqual([334, 333, 333]);
    expect(allocations.reduce((sum, money) => sum + money.amount, 0)).toBe(1000);
  });

  it('applies true half-even rounding for positive and negative ties', () => {
    const policy = createRoundingPolicy('half-even', 0);
    expect(applyRounding(2.5, policy)).toBe(2);
    expect(applyRounding(3.5, policy)).toBe(4);
    expect(applyRounding(-2.5, policy)).toBe(-2);
    expect(applyRounding(-3.5, policy)).toBe(-4);
  });

  it('detects only complete scoped separation-of-duty conflicts', () => {
    const singlePermission = checkSeparationOfDuty(SEPARATION_OF_DUTY_RULES, {
      principalId: 'user-a',
      tenantId: 'tenant-a',
      requestedPermissions: ['ledger.journal.write'],
      scope: { tenantId: 'tenant-a' },
    });
    expect(singlePermission.allowed).toBe(true);

    const conflict = checkSeparationOfDuty(SEPARATION_OF_DUTY_RULES, {
      principalId: 'user-a',
      tenantId: 'tenant-a',
      requestedPermissions: ['ledger.journal.write', 'ledger.journal.post'],
      scope: { tenantId: 'tenant-a' },
    });
    expect(conflict.allowed).toBe(false);
    expect(conflict.violations).toContain('Journal creator cannot post (sod-journal-create-post)');
  });

  it('requires balanced, positive, single-currency journal lines', () => {
    const entry: JournalEntry = {
      id: 'entry-1',
      batchId: 'batch-1',
      entryNumber: 1,
      description: 'Tuition invoice',
      reference: 'INV-1',
      entryDate: now,
      status: 'draft',
      createdBy: 'user-a',
      createdAt: now,
      postedAt: null,
      postedBy: null,
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      sourceDocumentId: 'invoice-1',
      sourceDocumentType: 'invoice',
    };
    const lines: JournalLine[] = [
      { id: 'line-1', entryId: entry.id, lineNumber: 1, accountId: 'receivable', side: 'debit', amount: 5000, currency: 'GBP', description: null, dimensionValues: new Map(), createdAt: now },
      { id: 'line-2', entryId: entry.id, lineNumber: 2, accountId: 'tuition-income', side: 'credit', amount: 5000, currency: 'GBP', description: null, dimensionValues: new Map(), createdAt: now },
    ];
    expect(validateJournalEntry(entry, lines)).toEqual({ isValid: true, errors: [] });
    expect(validateJournalEntry(entry, [{ ...lines[0]!, amount: 5001 }, lines[1]!]).isValid).toBe(false);
  });

  it('evaluates a deliberately small safe posting expression language', () => {
    expect(calculateLineAmount('grossAmount', { grossAmount: 5000 })).toBe(5000);
    expect(calculateLineAmount('grossAmount * 0.15', { grossAmount: 5000 })).toBe(750);
    expect(calculateLineAmount('grossAmount / 4', { grossAmount: 5000 })).toBe(1250);
    expect(() => calculateLineAmount('globalThis.process.exit()', {})).toThrow('Failed to evaluate');
  });
});
