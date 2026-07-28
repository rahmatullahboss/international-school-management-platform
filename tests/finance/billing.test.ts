import { describe, expect, it } from 'vitest';

import {
  BillingService,
  currencyCode,
  minorUnit,
  type FinancePrincipal,
} from '../../packages/modules/billing/src/index.js';
import {
  LedgerService,
  type LedgerAccountRecord,
} from '../../packages/modules/ledger/src/index.js';

const tenantId = 'tenant-a';
const legalEntityId = 'entity-a';
const bookId = 'book-a';
const periodId = 'period-2026';
const gbp = currencyCode('GBP');
const now = new Date('2026-07-28T09:35:00.000Z');
const clock = { now: () => now };

function principal(
  principalId: string,
  permissions: FinancePrincipal['permissions'],
  assurance: FinancePrincipal['assurance'] = 'aal2',
): FinancePrincipal {
  return { principalId, permissions, assurance, scope: { tenantId, legalEntityId } };
}

const setupPrincipal = principal('finance-admin', [
  'billing.account.write',
  'billing.fee.write',
  'billing.invoice.write',
  'billing.credit-note.write',
  'billing.allocation.write',
  'billing.allocation.unallocate',
]);
const invoicePoster = principal('invoice-poster', ['billing.invoice.post', 'ledger.journal.post']);
const creditPoster = principal('credit-poster', [
  'billing.credit-note.post',
  'ledger.journal.post',
]);

function account(
  id: string,
  code: string,
  type: LedgerAccountRecord['type'],
  controlAccount = false,
): LedgerAccountRecord {
  return {
    id,
    tenantId,
    legalEntityId,
    bookId,
    code,
    name: id,
    type,
    naturalBalance: type === 'asset' || type === 'expense' ? 'debit' : 'credit',
    controlAccount,
    active: true,
  };
}

function setup(): { billing: BillingService; ledger: LedgerService } {
  const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
  ledger.registerAccount(account('receivable', '1100', 'asset', true));
  ledger.registerAccount(account('cash', '1000', 'asset'));
  ledger.registerAccount(account('tuition-income', '4100', 'income'));
  ledger.registerAccount(account('tax-payable', '2100', 'liability'));
  ledger.createPeriod({
    id: periodId,
    tenantId,
    legalEntityId,
    bookId,
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
  });

  const billing = new BillingService(
    { tenantId, legalEntityId },
    ledger,
    { bookId, receivableAccountId: 'receivable' },
    clock,
  );
  billing.createBillingAccount(
    {
      id: 'family-account-1',
      tenantId,
      legalEntityId,
      accountHolderRef: 'student-1',
      currency: gbp,
      status: 'active',
      responsibleParties: [
        { personRef: 'guardian-1', responsibilityBasisPoints: 6000, priority: 1 },
        { personRef: 'guardian-2', responsibilityBasisPoints: 4000, priority: 2 },
      ],
    },
    setupPrincipal,
  );
  billing.registerFeeItem(
    {
      id: 'tuition-fee',
      tenantId,
      legalEntityId,
      code: 'tuition',
      name: 'Tuition fee',
      description: 'Term tuition',
      amountMinor: minorUnit(10_000),
      currency: gbp,
      incomeAccountId: 'tuition-income',
      taxBasisPoints: 1000,
      taxAccountId: 'tax-payable',
      active: true,
    },
    setupPrincipal,
  );
  billing.createFeeSchedule(
    {
      id: 'term-fee-schedule',
      tenantId,
      legalEntityId,
      feeItemId: 'tuition-fee',
      frequency: 'termly',
      startsOn: '2026-01-01',
      endsOn: null,
      dueDays: 14,
      active: true,
    },
    setupPrincipal,
  );
  billing.assignFee(
    {
      id: 'assignment-1',
      tenantId,
      legalEntityId,
      billingAccountId: 'family-account-1',
      feeScheduleId: 'term-fee-schedule',
      quantity: 2,
      adjustments: [
        {
          kind: 'discount',
          basisPoints: 1000,
          reason: 'Sibling discount',
          approvedBy: 'approver-1',
        },
        { kind: 'waiver', basisPoints: 500, reason: 'Approved waiver', approvedBy: 'approver-2' },
      ],
      startsOn: '2026-01-01',
      endsOn: null,
      active: true,
    },
    setupPrincipal,
  );
  return { billing, ledger };
}

describe('FIN-01 billing and receivables', () => {
  it('validates responsible-party ownership percentages', () => {
    const { billing } = setup();
    expect(() =>
      billing.createBillingAccount(
        {
          id: 'invalid-account',
          tenantId,
          legalEntityId,
          accountHolderRef: 'student-2',
          currency: gbp,
          status: 'active',
          responsibleParties: [
            { personRef: 'guardian-3', responsibilityBasisPoints: 9000, priority: 1 },
          ],
        },
        setupPrincipal,
      ),
    ).toThrow('FIN_RESPONSIBILITY_MUST_TOTAL_100_PERCENT');
  });

  it('generates an idempotent invoice from a fee assignment with deterministic adjustments, tax, due date and instalments', () => {
    const { billing } = setup();
    const invoice = billing.createInvoiceFromAssignment(
      'assignment-1',
      '2026-07-01',
      setupPrincipal,
      'invoice-assignment-1',
    );
    const replay = billing.createInvoiceFromAssignment(
      'assignment-1',
      '2026-07-01',
      setupPrincipal,
      'invoice-assignment-1',
    );
    expect(replay).toBe(invoice);
    expect(invoice.invoiceNumber).toBe('INV-000001');
    expect(invoice.dueDate).toBe('2026-07-15');
    expect(invoice.subtotalMinor).toBe(20_000);
    expect(invoice.adjustmentMinor).toBe(3_000);
    expect(invoice.taxMinor).toBe(1_700);
    expect(invoice.totalMinor).toBe(18_700);
    expect(invoice.balanceMinor).toBe(18_700);
    expect(invoice.lines[0]).toMatchObject({
      grossMinor: 20_000,
      discountMinor: 2_000,
      waiverMinor: 1_000,
      taxableMinor: 17_000,
      taxMinor: 1_700,
      totalMinor: 18_700,
    });
  });

  it('splits invoice totals into stable instalments without losing a minor unit', () => {
    const { billing } = setup();
    const invoice = billing.createInvoice({
      billingAccountId: 'family-account-1',
      issueDate: '2026-07-01',
      dueDate: '2026-09-01',
      lines: [{ feeItemId: 'tuition-fee', quantity: 1 }],
      instalmentDueDates: ['2026-07-15', '2026-08-15', '2026-09-01'],
      createdBy: setupPrincipal,
      idempotencyKey: 'invoice-three-instalments',
    });
    expect(invoice.totalMinor).toBe(11_000);
    expect(invoice.instalments.map((instalment) => instalment.amountMinor)).toEqual([
      3667, 3667, 3666,
    ]);
    expect(invoice.instalments.reduce((sum, instalment) => sum + instalment.amountMinor, 0)).toBe(
      invoice.totalMinor,
    );
  });

  it('posts each invoice once and traces receivable, income and tax to a balanced journal', () => {
    const { billing, ledger } = setup();
    const draft = billing.createInvoiceFromAssignment(
      'assignment-1',
      '2026-07-01',
      setupPrincipal,
      'invoice-post-proof',
    );
    const posted = billing.postInvoice({
      invoiceId: draft.id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'invoice-post-proof',
      correlationId: 'corr-invoice-post-proof',
    });
    const replay = billing.postInvoice({
      invoiceId: draft.id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'invoice-post-proof',
      correlationId: 'corr-invoice-post-proof',
    });
    expect(replay).toBe(posted);
    expect(posted.status).toBe('posted');
    expect(posted.journalEntryId).not.toBeNull();
    const journal = ledger.getEntry(posted.journalEntryId!);
    expect(journal?.lines.map((line) => [line.accountId, line.side, line.amountMinor])).toEqual([
      ['receivable', 'debit', 18_700],
      ['tuition-income', 'credit', 17_000],
      ['tax-payable', 'credit', 1_700],
    ]);
    expect(ledger.getEntriesForSource('invoice', draft.id)).toEqual([journal]);
  });

  it('enforces invoice creator/poster separation and requires credit notes after posting', () => {
    const { billing } = setup();
    const creatorAndPoster = principal('same-user', [
      'billing.invoice.write',
      'billing.invoice.post',
      'ledger.journal.post',
    ]);
    const draft = billing.createInvoice({
      billingAccountId: 'family-account-1',
      issueDate: '2026-07-01',
      dueDate: '2026-07-15',
      lines: [{ feeItemId: 'tuition-fee', quantity: 1 }],
      createdBy: creatorAndPoster,
      idempotencyKey: 'invoice-sod-proof',
    });
    expect(() =>
      billing.postInvoice({
        invoiceId: draft.id,
        periodId,
        postedBy: creatorAndPoster,
        idempotencyKey: 'invoice-sod-proof',
        correlationId: 'corr-sod',
      }),
    ).toThrow('FIN_SOD_VIOLATION');

    const posted = billing.postInvoice({
      invoiceId: draft.id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'invoice-sod-proof',
      correlationId: 'corr-sod',
    });
    expect(() =>
      billing.voidDraftInvoice(posted.id, principal('voider', ['billing.invoice.void'])),
    ).toThrow('FIN_POSTED_INVOICE_REQUIRES_CREDIT_NOTE');
  });

  it('posts a bounded credit note, updates invoice balance and preserves bidirectional ledger trace', () => {
    const { billing, ledger } = setup();
    const invoice = billing.postInvoice({
      invoiceId: billing.createInvoiceFromAssignment(
        'assignment-1',
        '2026-07-01',
        setupPrincipal,
        'invoice-credit-proof',
      ).id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'invoice-credit-proof',
      correlationId: 'corr-credit-proof',
    });
    const line = invoice.lines[0]!;
    const credit = billing.createCreditNote({
      invoiceId: invoice.id,
      issueDate: '2026-07-10',
      reason: 'Service withdrawn',
      lineCredits: [{ invoiceLineId: line.id, amountMinor: 5_000, taxMinor: 500 }],
      createdBy: setupPrincipal,
      idempotencyKey: 'credit-note-proof',
    });
    const posted = billing.postCreditNote({
      creditNoteId: credit.id,
      periodId,
      postedBy: creditPoster,
      idempotencyKey: 'credit-note-proof',
      correlationId: 'corr-credit-proof',
    });
    expect(posted.creditNoteNumber).toBe('CN-000001');
    expect(posted.totalMinor).toBe(5_500);
    expect(billing.getInvoice(invoice.id)).toMatchObject({
      creditedMinor: 5_500,
      balanceMinor: 13_200,
    });
    expect(
      ledger
        .getEntriesForSource('credit-note', credit.id)[0]
        ?.lines.map((journalLine) => [
          journalLine.accountId,
          journalLine.side,
          journalLine.amountMinor,
        ]),
    ).toEqual([
      ['tuition-income', 'debit', 5_000],
      ['tax-payable', 'debit', 500],
      ['receivable', 'credit', 5_500],
    ]);
    expect(() =>
      billing.createCreditNote({
        invoiceId: invoice.id,
        issueDate: '2026-07-11',
        reason: 'Excessive credit',
        lineCredits: [{ invoiceLineId: line.id, amountMinor: 17_000, taxMinor: 1_700 }],
        createdBy: setupPrincipal,
        idempotencyKey: 'credit-note-excessive',
      }),
    ).toThrow('FIN_CREDIT_EXCEEDS_LINE');
  });

  it('allocates and unallocates oldest instalments while keeping invoice totals consistent', () => {
    const { billing } = setup();
    const invoice = billing.postInvoice({
      invoiceId: billing.createInvoice({
        billingAccountId: 'family-account-1',
        issueDate: '2026-07-01',
        dueDate: '2026-08-01',
        lines: [{ feeItemId: 'tuition-fee', quantity: 1 }],
        instalmentDueDates: ['2026-07-15', '2026-08-01'],
        createdBy: setupPrincipal,
        idempotencyKey: 'invoice-allocation-proof',
      }).id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'invoice-allocation-proof',
      correlationId: 'corr-allocation-proof',
    });
    const partial = billing.applyAllocation(invoice.id, 7_000, setupPrincipal);
    expect(partial).toMatchObject({
      status: 'partially-paid',
      allocatedMinor: 7_000,
      balanceMinor: 4_000,
    });
    expect(partial.instalments.map((instalment) => instalment.allocatedMinor)).toEqual([
      5_500, 1_500,
    ]);
    const reversed = billing.reverseAllocation(invoice.id, 2_000, setupPrincipal);
    expect(reversed).toMatchObject({
      status: 'partially-paid',
      allocatedMinor: 5_000,
      balanceMinor: 6_000,
    });
    expect(reversed.instalments.map((instalment) => instalment.allocatedMinor)).toEqual([5_000, 0]);
  });

  it('produces a reproducible as-of statement from posted invoices and credit notes', () => {
    const { billing } = setup();
    const invoice = billing.postInvoice({
      invoiceId: billing.createInvoiceFromAssignment(
        'assignment-1',
        '2026-07-01',
        setupPrincipal,
        'invoice-statement-proof',
      ).id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'invoice-statement-proof',
      correlationId: 'corr-statement-proof',
    });
    const credit = billing.createCreditNote({
      invoiceId: invoice.id,
      issueDate: '2026-07-10',
      reason: 'Statement credit',
      lineCredits: [{ invoiceLineId: invoice.lines[0]!.id, amountMinor: 2_000, taxMinor: 200 }],
      createdBy: setupPrincipal,
      idempotencyKey: 'credit-statement-proof',
    });
    billing.postCreditNote({
      creditNoteId: credit.id,
      periodId,
      postedBy: creditPoster,
      idempotencyKey: 'credit-statement-proof',
      correlationId: 'corr-statement-proof',
    });
    expect(billing.statement('family-account-1', '2026-07-05')).toMatchObject({
      closingBalanceMinor: 18_700,
    });
    expect(billing.statement('family-account-1', '2026-07-31')).toMatchObject({
      closingBalanceMinor: 16_500,
    });
    expect(
      billing.statement('family-account-1', '2026-07-31').entries.map((entry) => entry.type),
    ).toEqual(['invoice', 'credit-note']);
  });

  it('rejects cross-currency fee use and over-adjustment deterministically', () => {
    const { billing } = setup();
    billing.registerFeeItem(
      {
        id: 'usd-fee',
        tenantId,
        legalEntityId,
        code: 'USD-FEE',
        name: 'USD fee',
        description: null,
        amountMinor: minorUnit(1000),
        currency: currencyCode('USD'),
        incomeAccountId: 'tuition-income',
        taxBasisPoints: 0,
        taxAccountId: null,
        active: true,
      },
      setupPrincipal,
    );
    expect(() =>
      billing.createInvoice({
        billingAccountId: 'family-account-1',
        issueDate: '2026-07-01',
        dueDate: '2026-07-15',
        lines: [{ feeItemId: 'usd-fee', quantity: 1 }],
        createdBy: setupPrincipal,
        idempotencyKey: 'invoice-cross-currency',
      }),
    ).toThrow('FIN_CURRENCY_MISMATCH');
    expect(() =>
      billing.createInvoice({
        billingAccountId: 'family-account-1',
        issueDate: '2026-07-01',
        dueDate: '2026-07-15',
        lines: [
          {
            feeItemId: 'tuition-fee',
            quantity: 1,
            adjustments: [
              { kind: 'discount', basisPoints: 7000, reason: 'Discount', approvedBy: 'a' },
              { kind: 'waiver', basisPoints: 4000, reason: 'Waiver', approvedBy: 'b' },
            ],
          },
        ],
        createdBy: setupPrincipal,
        idempotencyKey: 'invoice-over-adjusted',
      }),
    ).toThrow('FIN_ADJUSTMENT_EXCEEDS_100_PERCENT');
  });
});
