import { describe, expect, it } from 'vitest';

import {
  BillingService,
  currencyCode,
  FinanceReportingService,
  HmacTestPaymentProviderAdapter,
  minorUnit,
  PaymentService,
  type FinancePrincipal,
  type VerifiedProviderEvent,
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
const clock = { now: () => new Date('2026-07-28T11:00:00.000Z') };
const adapter = new HmacTestPaymentProviderAdapter('report-pay', 'report-secret-value-123456');

function principal(
  principalId: string,
  permissions: FinancePrincipal['permissions'],
  assurance: FinancePrincipal['assurance'] = 'aal2',
): FinancePrincipal {
  return { principalId, permissions, assurance, scope: { tenantId, legalEntityId } };
}

const admin = principal('admin', [
  'billing.account.write',
  'billing.fee.write',
  'billing.invoice.write',
  'billing.credit-note.write',
  'billing.payment.write',
  'billing.payment.verify',
  'billing.allocation.write',
  'ledger.journal.post',
]);
const invoicePoster = principal('invoice-poster', ['billing.invoice.post', 'ledger.journal.post']);
const creditPoster = principal('credit-poster', [
  'billing.credit-note.post',
  'ledger.journal.post',
]);
const reporter = principal('reporter', ['finance.report.read']);

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

function setup() {
  const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
  ledger.registerAccount(account('cash', '1000', 'asset'));
  ledger.registerAccount(account('receivable', '1100', 'asset', true));
  ledger.registerAccount(account('unapplied-cash', '2200', 'liability', true));
  ledger.registerAccount(account('tuition-income', '4100', 'income'));
  ledger.registerAccount(account('supplies-expense', '5100', 'expense'));
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
        { personRef: 'guardian-1', responsibilityBasisPoints: 10_000, priority: 1 },
      ],
    },
    admin,
  );
  billing.registerFeeItem(
    {
      id: 'tuition',
      tenantId,
      legalEntityId,
      code: 'TUITION',
      name: 'Tuition',
      description: null,
      amountMinor: minorUnit(11_000),
      currency: gbp,
      incomeAccountId: 'tuition-income',
      taxBasisPoints: 0,
      taxAccountId: null,
      active: true,
    },
    admin,
  );
  const draft = billing.createInvoice({
    billingAccountId: 'family-account-1',
    issueDate: '2026-07-01',
    dueDate: '2026-07-31',
    lines: [{ feeItemId: 'tuition', quantity: 1 }],
    createdBy: admin,
    idempotencyKey: 'report-invoice',
  });
  const invoice = billing.postInvoice({
    invoiceId: draft.id,
    periodId,
    postedBy: invoicePoster,
    idempotencyKey: 'report-invoice',
    correlationId: 'corr-report-invoice',
  });

  const payments = new PaymentService(
    { tenantId, legalEntityId },
    billing,
    ledger,
    {
      bookId,
      cashAccountId: 'cash',
      bankDepositAccountId: 'cash',
      receivableAccountId: 'receivable',
      unappliedCashAccountId: 'unapplied-cash',
    },
    clock,
  );
  const intent = payments.createPaymentIntent({
    billingAccountId: 'family-account-1',
    amountMinor: 5_000,
    currency: gbp,
    provider: adapter.provider,
    expiresAt: '2026-07-29T11:00:00.000Z',
    createdBy: admin,
    idempotencyKey: 'report-intent',
  });
  payments.bindProviderIntent(intent.id, 'report-provider-intent', admin);
  const providerEvent: VerifiedProviderEvent = {
    eventId: 'report-payment-event',
    eventType: 'payment.settled',
    provider: adapter.provider,
    providerPaymentId: 'report-provider-payment',
    paymentIntentId: intent.id,
    amountMinor: 5_000,
    currency: 'GBP',
    occurredAt: '2026-07-28T10:30:00.000Z',
    metadata: { fixture: 'reporting' },
  };
  const payload = JSON.stringify(providerEvent);
  const payment = payments.processProviderEvent({
    payload,
    signature: adapter.sign(payload),
    adapter,
    verifiedBy: admin,
    periodId,
    correlationId: 'corr-report-payment',
  })!;
  payments.allocatePayment({
    paymentId: payment.id,
    invoiceId: invoice.id,
    amountMinor: 4_000,
    principal: admin,
    periodId,
    idempotencyKey: 'report-allocation',
    correlationId: 'corr-report-allocation',
  });

  const credit = billing.createCreditNote({
    invoiceId: invoice.id,
    issueDate: '2026-07-29',
    reason: 'Reporting fixture credit',
    lineCredits: [{ invoiceLineId: invoice.lines[0]!.id, amountMinor: 1_000 }],
    createdBy: admin,
    idempotencyKey: 'report-credit',
  });
  billing.postCreditNote({
    creditNoteId: credit.id,
    periodId,
    postedBy: creditPoster,
    idempotencyKey: 'report-credit',
    correlationId: 'corr-report-credit',
  });

  ledger.post({
    tenantId,
    legalEntityId,
    bookId,
    periodId,
    entryDate: '2026-07-30',
    description: 'Supplies expense',
    sourceDocumentType: 'manual-journal',
    sourceDocumentId: 'expense-1',
    createdBy: 'expense-creator',
    postedBy: principal('expense-poster', ['ledger.journal.post']),
    idempotencyKey: 'report-expense',
    correlationId: 'corr-report-expense',
    lines: [
      { accountId: 'supplies-expense', side: 'debit', amountMinor: 2_000, currency: gbp },
      { accountId: 'cash', side: 'credit', amountMinor: 2_000, currency: gbp },
    ],
  });

  const reporting = new FinanceReportingService(
    { tenantId, legalEntityId },
    billing,
    payments,
    ledger,
    { receivableAccountId: 'receivable', unappliedCashAccountId: 'unapplied-cash', maxRows: 100 },
  );
  return { billing, ledger, payments, reporting, invoice, payment };
}

describe('FIN-01 reconciliation and reporting', () => {
  it('reconciles receivable subledger to its control account as of a date', () => {
    const { reporting } = setup();
    expect(reporting.receivableReconciliation('2026-07-28', reporter)).toMatchObject({
      subledgerMinor: 7_000,
      controlAccountMinor: 7_000,
      differenceMinor: 0,
      reconciled: true,
      invoiceCount: 1,
    });
    expect(reporting.receivableReconciliation('2026-07-29', reporter)).toMatchObject({
      subledgerMinor: 6_000,
      controlAccountMinor: 6_000,
      differenceMinor: 0,
      reconciled: true,
      invoiceCount: 1,
    });
  });

  it('reconciles unapplied cash and returns traceable payment rows', () => {
    const { reporting, payment } = setup();
    const report = reporting.unappliedCash('2026-07-31', reporter);
    expect(report).toMatchObject({
      subledgerMinor: 1_000,
      controlAccountMinor: 1_000,
      differenceMinor: 0,
      reconciled: true,
    });
    expect(report.payments).toEqual([
      expect.objectContaining({
        paymentId: payment.id,
        receiptNumber: 'RCT-000001',
        unappliedMinor: 1_000,
      }),
    ]);
  });

  it('places invoice balances into deterministic aging buckets', () => {
    const { reporting } = setup();
    const report = reporting.aging('2026-08-15', reporter);
    expect(report.totalOutstandingMinor).toBe(6_000);
    expect(report.totals).toEqual({ current: 0, '1-30': 6_000, '31-60': 0, '61-90': 0, '91+': 0 });
    expect(report.rows[0]).toMatchObject({
      daysOverdue: 15,
      bucket: '1-30',
      outstandingMinor: 6_000,
    });
  });

  it('produces an account statement with invoice, payment and credit-note drill-through', () => {
    const { reporting } = setup();
    const report = reporting.accountStatement('family-account-1', '2026-08-15', reporter);
    expect(
      report.entries.map((entry) => [entry.type, entry.debitMinor, entry.creditMinor]),
    ).toEqual([
      ['invoice', 11_000, 0],
      ['payment', 0, 5_000],
      ['credit-note', 0, 1_000],
    ]);
    expect(report.closingBalanceMinor).toBe(5_000);
  });

  it('produces a balanced trial balance and bounded general ledger', () => {
    const { reporting } = setup();
    const trial = reporting.trialBalance('2026-07-31', reporter);
    expect(trial.balanced).toBe(true);
    expect(trial.totalDebitMinor).toBe(trial.totalCreditMinor);
    const receivable = reporting.generalLedger(
      'receivable',
      '2026-07-01',
      '2026-07-31',
      reporter,
      10,
    );
    expect(
      receivable.rows.map((row) => [
        row.sourceDocumentType,
        row.debitMinor,
        row.creditMinor,
        row.runningBalanceMinor,
      ]),
    ).toEqual([
      ['invoice', 11_000, 0, 11_000],
      ['payment-allocation', 0, 4_000, 7_000],
      ['credit-note', 0, 1_000, 6_000],
    ]);
    expect(receivable.truncated).toBe(false);
  });

  it('produces income statement, balance sheet and fiscal-period summary', () => {
    const { reporting } = setup();
    expect(reporting.incomeStatement('2026-07-01', '2026-07-31', reporter)).toMatchObject({
      incomeMinor: 10_000,
      expenseMinor: 2_000,
      netIncomeMinor: 8_000,
    });
    expect(reporting.balanceSheet('2026-07-31', reporter)).toMatchObject({
      assetsMinor: 9_000,
      liabilitiesMinor: 1_000,
      equityMinor: 0,
      currentEarningsMinor: 8_000,
      liabilitiesAndEquityMinor: 9_000,
      differenceMinor: 0,
      balanced: true,
    });
    expect(reporting.fiscalPeriodSummary(periodId, reporter)).toMatchObject({
      journalCount: 5,
      debitMinor: 23_000,
      creditMinor: 23_000,
      incomeMinor: 10_000,
      expenseMinor: 2_000,
      netIncomeMinor: 8_000,
    });
  });

  it('publishes metric definitions with reproducible drill-down parameters', () => {
    const { reporting } = setup();
    const metrics = reporting.dashboard('2026-08-15', reporter);
    expect(metrics.map((metric) => [metric.id, metric.valueMinor])).toEqual([
      ['outstanding-receivables', 6_000],
      ['overdue-receivables', 6_000],
      ['unapplied-cash', 1_000],
      ['pending-refunds', 0],
    ]);
    expect(
      metrics.every(
        (metric) =>
          metric.definition.length > 20 &&
          metric.source.length > 10 &&
          metric.drillDown.asOf === '2026-08-15',
      ),
    ).toBe(true);
  });

  it('enforces report permission, scope and row limits', () => {
    const { reporting } = setup();
    expect(() => reporting.trialBalance('2026-07-31', principal('unauthorized', []))).toThrow(
      'FIN_FORBIDDEN',
    );
    expect(() =>
      reporting.trialBalance('2026-07-31', {
        ...reporter,
        scope: { tenantId: 'tenant-b', legalEntityId },
      }),
    ).toThrow('FIN_SCOPE_MISMATCH');
    expect(() =>
      reporting.generalLedger('receivable', '2026-07-01', '2026-07-31', reporter, 101),
    ).toThrow('FIN_INVALID_REPORT_LIMIT');
  });
});
