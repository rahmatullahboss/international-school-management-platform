import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_TYPE_NATURAL_BALANCE,
  getContraType,
  getNaturalBalance,
  isBalanceSheetAccount,
  isContraAccount,
  isIncomeStatementAccount,
  type Account as ContractAccount,
  type AccountType as ContractAccountType,
  validateAccount,
} from './accounts.js';
import {
  findAccountByCode,
  getAccountHierarchy,
  getControlAccounts,
  getNaturalBalance as getBookNaturalBalance,
  isBalanceSheetAccount as isBookBalanceSheetAccount,
  isIncomeStatementAccount as isBookIncomeStatementAccount,
  type Account,
  type AccountType,
  validateBook,
  validateChartOfAccounts,
} from './books.js';
import {
  getDimensionValue,
  mergeDimensions,
  type Dimension,
  validateDimensions,
} from './dimensions.js';
import {
  canTransitionPeriod,
  type FiscalPeriod,
  getCurrentPeriod,
  getPeriodsForYear,
  validatePeriodTransition,
} from './fiscal-periods.js';
import {
  calculateTotals,
  createReversalEntry,
  isBalanced,
  type JournalEntry,
  type JournalLine,
  validateJournalEntry,
} from './journal.js';
import {
  calculateLineAmount,
  evaluateConditions,
  type PostingRule,
  validatePostingRule,
} from './posting-rules.js';

const now = new Date('2026-08-01T00:00:00.000Z');

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    code: '1000',
    name: 'Cash',
    type: 'asset',
    subtype: null,
    naturalBalance: 'debit',
    parentId: null,
    isPostingAllowed: true,
    isActive: true,
    description: null,
    controlAccount: false,
    controlAccountType: null,
    metadata: {},
    ...overrides,
  };
}

function period(overrides: Partial<FiscalPeriod> = {}): FiscalPeriod {
  return {
    id: 'period-1',
    fiscalYearId: 'fy-1',
    periodNumber: 1,
    name: 'January',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-31T23:59:59.999Z'),
    status: 'open',
    closedAt: null,
    closedBy: null,
    reopenedAt: null,
    reopenedBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    batchId: 'batch-1',
    entryNumber: 1,
    description: 'Tuition',
    reference: null,
    entryDate: now,
    status: 'posted',
    createdBy: 'author-1',
    createdAt: now,
    postedAt: now,
    postedBy: 'poster-1',
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    sourceDocumentId: 'invoice-1',
    sourceDocumentType: 'invoice',
    ...overrides,
  };
}

function journalLine(overrides: Partial<JournalLine> = {}): JournalLine {
  return {
    id: 'line-1',
    entryId: 'entry-1',
    lineNumber: 1,
    accountId: 'cash',
    side: 'debit',
    amount: 100,
    currency: 'GBP',
    description: null,
    dimensionValues: new Map(),
    createdAt: now,
    ...overrides,
  };
}

describe('ledger account contracts', () => {
  it('covers every account classification and contra mapping', () => {
    for (const [type, balance] of ACCOUNT_TYPE_NATURAL_BALANCE) {
      expect(getNaturalBalance(type)).toBe(balance);
    }
    expect(() => getNaturalBalance('unknown' as ContractAccountType)).toThrow(
      'Unknown account type: unknown',
    );

    expect(isBalanceSheetAccount('asset')).toBe(true);
    expect(isBalanceSheetAccount('revenue')).toBe(false);
    expect(isIncomeStatementAccount('expense')).toBe(true);
    expect(isIncomeStatementAccount('equity')).toBe(false);
    expect(isContraAccount('contra-asset')).toBe(true);
    expect(isContraAccount('asset')).toBe(false);
    expect(getContraType('asset')).toBe('contra-asset');
    expect(getContraType('contra-expense')).toBe('expense');
    expect(getContraType('unknown' as ContractAccountType)).toBeNull();
  });

  it('validates required account fields, type and parent identity', () => {
    const valid: Partial<ContractAccount> = {
      id: 'a',
      code: '1000',
      name: 'Cash',
      type: 'asset',
      parentId: null,
    };
    expect(validateAccount(valid)).toEqual({ isValid: true, errors: [] });

    expect(
      validateAccount({
        id: 'same',
        code: ' ',
        name: '',
        type: 'invalid' as ContractAccountType,
        parentId: 'same',
      }),
    ).toEqual({
      isValid: false,
      errors: [
        'Account code is required',
        'Account name is required',
        'Invalid account type: invalid',
        'Account cannot be its own parent',
      ],
    });
  });
});

describe('accounting books and chart hierarchy', () => {
  it('classifies book account types and validates book configuration', () => {
    expect(getBookNaturalBalance('asset')).toBe('debit');
    expect(getBookNaturalBalance('revenue')).toBe('credit');
    expect(isBookBalanceSheetAccount('contra_equity')).toBe(true);
    expect(isBookBalanceSheetAccount('expense')).toBe(false);
    expect(isBookIncomeStatementAccount('contra_revenue')).toBe(true);
    expect(isBookIncomeStatementAccount('liability')).toBe(false);

    expect(
      validateBook({
        code: 'PRIMARY',
        name: 'Primary book',
        baseCurrency: 'GBP',
        type: 'primary',
      }),
    ).toEqual({ isValid: true, errors: [] });
    expect(
      validateBook({ code: ' ', name: '', baseCurrency: 'US', type: 'consolidation' }),
    ).toEqual({
      isValid: false,
      errors: [
        'Book code is required',
        'Book name is required',
        'Valid base currency (ISO 4217) is required',
        'Consolidation book must have a legal entity',
      ],
    });
  });

  it('validates chart duplicates and exposes chart lookup helpers', () => {
    expect(validateChartOfAccounts({ accounts: [] })).toEqual({
      isValid: false,
      errors: ['Chart of accounts must have at least one account'],
    });

    const parent = account({ id: 'parent', code: '1000', controlAccount: true });
    const child = account({ id: 'child', code: '1010', parentId: 'parent' });
    expect(validateChartOfAccounts({ accounts: [parent, child] })).toEqual({
      isValid: true,
      errors: [],
    });
    expect(findAccountByCode([parent, child], '1010')).toBe(child);
    expect(findAccountByCode([parent, child], '9999')).toBeUndefined();
    expect(getAccountHierarchy([child, parent])).toEqual([parent, child]);
    expect(getControlAccounts([parent, child])).toEqual([parent]);

    const invalidType = account({
      id: 'parent',
      code: '1000',
      type: 'invalid' as AccountType,
    });
    const duplicate = account({ id: 'parent', code: '1000' });
    expect(validateChartOfAccounts({ accounts: [invalidType, duplicate] }).errors).toEqual([
      'Invalid account type: invalid',
      'Duplicate account code: 1000',
      'Duplicate account ID: parent',
    ]);
  });

  it('caps pathological hierarchy traversal instead of looping forever', () => {
    const cyclic = account({ id: 'cycle', parentId: 'cycle' });
    expect(getAccountHierarchy([cyclic])).toEqual([cyclic]);
  });
});

describe('ledger analytical dimensions', () => {
  const definition: Dimension = {
    id: 'dimension-1',
    code: 'campus',
    name: 'Campus',
    type: 'campus',
    isRequired: true,
    allowedValues: ['north', 'south'],
    hierarchy: [],
    createdAt: now,
    updatedAt: now,
  };

  it('validates required and allow-listed values', () => {
    expect(validateDimensions({}, [definition])).toEqual({
      isValid: false,
      errors: ['Required dimension missing: campus'],
    });
    expect(validateDimensions({ campus: 'east' }, [definition])).toEqual({
      isValid: false,
      errors: ['Invalid value for dimension campus: east'],
    });
    expect(validateDimensions({ campus: 'north' }, [definition])).toEqual({
      isValid: true,
      errors: [],
    });
    expect(
      validateDimensions(
        { custom: 'anything' },
        [{ ...definition, code: 'custom', isRequired: false, allowedValues: [] }],
      ),
    ).toEqual({ isValid: true, errors: [] });
  });

  it('reads and merges dimension assignments', () => {
    expect(getDimensionValue({ campus: 'north' }, 'campus')).toBe('north');
    expect(getDimensionValue({}, 'campus')).toBeUndefined();
    expect(mergeDimensions({ campus: 'north', fund: 'general' }, { campus: 'south' })).toEqual({
      campus: 'south',
      fund: 'general',
    });
  });
});

describe('fiscal period contracts', () => {
  it('enforces the transition map and close/reopen prerequisites', () => {
    expect(canTransitionPeriod('open', 'closing')).toBe(true);
    expect(canTransitionPeriod('closing', 'closed')).toBe(true);
    expect(canTransitionPeriod('closed', 'reopening')).toBe(true);
    expect(canTransitionPeriod('reopening', 'open')).toBe(true);
    expect(canTransitionPeriod('closed', 'open')).toBe(false);

    expect(validatePeriodTransition(period(), 'closing', 'user-1', 'Month end')).toEqual({
      isValid: true,
      errors: [],
    });
    expect(
      validatePeriodTransition(period({ status: 'closing' }), 'closed', 'user-1', 'Month end'),
    ).toEqual({ isValid: true, errors: [] });
    expect(
      validatePeriodTransition(period({ status: 'reopening' }), 'open', 'user-1', 'Correction'),
    ).toEqual({ isValid: true, errors: [] });

    expect(validatePeriodTransition(period(), 'closed', ' ', '')).toEqual({
      isValid: false,
      errors: [
        'Authorizing principal is required',
        'Transition reason is required',
        'Period must be in closing status before closing',
      ],
    });
    expect(validatePeriodTransition(period({ status: 'closed' }), 'open', 'u', 'reason').errors).toEqual([
      'Cannot transition from closed to open',
      'Period must be in reopening status before reopening',
    ]);
  });

  it('finds current periods and sorts a fiscal year', () => {
    const first = period({ id: 'p1', periodNumber: 1 });
    const second = period({
      id: 'p2',
      periodNumber: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-02-28T23:59:59.999Z'),
    });
    const otherYear = period({ id: 'p3', fiscalYearId: 'fy-2', periodNumber: 1 });
    expect(getCurrentPeriod([first, second], new Date('2026-02-10T00:00:00.000Z'))).toBe(second);
    expect(getCurrentPeriod([first], new Date('2027-01-01T00:00:00.000Z'))).toBeNull();
    expect(getPeriodsForYear([second, otherYear, first], 'fy-1')).toEqual([first, second]);
  });
});

describe('posting rule contracts', () => {
  it('evaluates all supported condition operators and scalar guards', () => {
    const context = { status: 'paid', amount: 100, active: true, object: { nested: true } };
    expect(evaluateConditions([], context)).toBe(true);
    expect(evaluateConditions([{ field: 'status', operator: 'equals', value: 'paid' }], context)).toBe(
      true,
    );
    expect(
      evaluateConditions([{ field: 'status', operator: 'not-equals', value: 'void' }], context),
    ).toBe(true);
    expect(evaluateConditions([{ field: 'status', operator: 'in', value: ['paid'] }], context)).toBe(
      true,
    );
    expect(
      evaluateConditions([{ field: 'amount', operator: 'greater-than', value: [50, 99] }], context),
    ).toBe(true);
    expect(
      evaluateConditions([{ field: 'amount', operator: 'less-than', value: [101, 200] }], context),
    ).toBe(true);
    expect(evaluateConditions([{ field: 'missing', operator: 'equals', value: 'x' }], context)).toBe(
      false,
    );
    expect(evaluateConditions([{ field: 'object', operator: 'equals', value: 'x' }], context)).toBe(
      false,
    );
    expect(
      evaluateConditions([{ field: 'amount', operator: 'greater-than', value: ['50'] }], context),
    ).toBe(false);
    expect(
      evaluateConditions([{ field: 'amount', operator: 'less-than', value: ['101'] }], context),
    ).toBe(false);
  });

  it('evaluates the safe amount-expression language and rejects unsafe inputs', () => {
    expect(calculateLineAmount(' 12.5 ', {})).toBe(12.5);
    expect(calculateLineAmount('gross', { gross: 80 })).toBe(80);
    expect(calculateLineAmount('gross * 1.5', { gross: 80 })).toBe(120);
    expect(calculateLineAmount('gross / 4', { gross: 80 })).toBe(20);
    expect(() => calculateLineAmount('missing', {})).toThrow('Unknown numeric variable: missing');
    expect(() => calculateLineAmount('value', { value: Number.POSITIVE_INFINITY })).toThrow(
      'Unknown numeric variable: value',
    );
    expect(() => calculateLineAmount('gross / 0', { gross: 80 })).toThrow('Failed to evaluate');
    expect(() => calculateLineAmount('gross + 1', { gross: 80 })).toThrow('Failed to evaluate');
  });

  it('validates posting-rule version, line count, sides and unique numbering', () => {
    const rule: PostingRule = {
      id: 'rule-1',
      version: 1,
      name: 'Invoice posting',
      trigger: 'invoice-posted',
      conditions: [],
      lines: [
        {
          lineNumber: 1,
          accountId: 'receivable',
          side: 'debit',
          amountExpression: 'gross',
          dimensionExpressions: new Map(),
          descriptionTemplate: 'Receivable',
        },
        {
          lineNumber: 2,
          accountId: 'income',
          side: 'credit',
          amountExpression: 'gross',
          dimensionExpressions: new Map(),
          descriptionTemplate: 'Income',
        },
      ],
      active: true,
      effectiveFrom: now,
      effectiveTo: null,
      createdBy: 'user-1',
      createdAt: now,
    };
    expect(validatePostingRule(rule)).toEqual({ isValid: true, errors: [] });
    expect(
      validatePostingRule({
        ...rule,
        version: 0.5,
        lines: [{ ...rule.lines[0]!, lineNumber: 1 }, { ...rule.lines[0]!, lineNumber: 1 }],
      }),
    ).toEqual({
      isValid: false,
      errors: [
        'Posting rule version must be a positive integer',
        'Posting rule requires a credit line',
        'Posting rule line numbers must be unique',
      ],
    });
    expect(validatePostingRule({ ...rule, lines: [] }).errors).toEqual([
      'Posting rule must contain at least two lines',
      'Posting rule requires a debit line',
      'Posting rule requires a credit line',
    ]);
  });
});

describe('journal contracts', () => {
  const debit = journalLine();
  const credit = journalLine({ id: 'line-2', lineNumber: 2, side: 'credit' });

  it('calculates totals and recognizes balanced entries', () => {
    expect(calculateTotals([debit, credit])).toEqual({ debits: 100, credits: 100 });
    expect(isBalanced([debit, credit])).toBe(true);
    expect(isBalanced([debit])).toBe(false);
    expect(isBalanced([debit, { ...credit, amount: 90 }])).toBe(false);
    expect(isBalanced([debit, { ...credit, amount: 0 }])).toBe(false);
  });

  it('reports all journal validation errors', () => {
    expect(validateJournalEntry(journalEntry(), [debit, credit])).toEqual({
      isValid: true,
      errors: [],
    });
    const invalid = validateJournalEntry(journalEntry(), [
      { ...debit, amount: 0 },
      { ...credit, lineNumber: 1, amount: 1.5, currency: 'USD' },
    ]);
    expect(invalid).toEqual({
      isValid: false,
      errors: [
        'Line 1: amount must be a positive safe integer',
        'Line 1: amount must be a positive safe integer',
        'Duplicate line number: 1',
        'Journal entry lines must use one currency',
        'Entry is not balanced: debits=0, credits=1.5',
      ],
    });
    expect(validateJournalEntry(journalEntry(), [debit]).errors).toContain(
      'Journal entry must have at least 2 lines',
    );
  });

  it('reverses posted entries and rejects invalid reversal requests', () => {
    expect(() => createReversalEntry(journalEntry({ status: 'draft' }), [debit, credit], 'u', 'fix')).toThrow(
      'Only posted entries may be reversed',
    );
    expect(() => createReversalEntry(journalEntry(), [debit, credit], 'u', ' ')).toThrow(
      'Reversal reason is required',
    );

    const reversedAt = new Date('2026-08-01T10:00:00.000Z');
    const reversal = createReversalEntry(journalEntry(), [debit, credit], 'reviewer', 'Correction', reversedAt);
    expect(reversal.entry).toMatchObject({
      description: 'Reversal: Tuition',
      reference: 'entry-1',
      status: 'posted',
      createdBy: 'reviewer',
      postedBy: 'reviewer',
      reversalReason: 'Correction',
      sourceDocumentId: 'entry-1',
      sourceDocumentType: 'journal-reversal',
      idempotencyKey: 'reversal:entry-1',
    });
    expect(reversal.entry.entryDate).toEqual(reversedAt);
    expect(reversal.lines).toHaveLength(2);
    expect(reversal.lines[0]).toMatchObject({ lineNumber: 1, side: 'credit', entryId: reversal.entry.id });
    expect(reversal.lines[1]).toMatchObject({ lineNumber: 2, side: 'debit', entryId: reversal.entry.id });
  });
});
