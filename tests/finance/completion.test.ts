import { describe, expect, it } from 'vitest';

import {
  allocateMoney,
  applyRounding,
  BillingService,
  createRoundingPolicy,
  currencyCode,
  FinanceReportingService,
  HmacTestPaymentProviderAdapter,
  minorUnit,
  PaymentService,
  type CurrencyCode,
  type FinancePrincipal,
  type VerifiedProviderEvent,
} from '../../packages/modules/billing/src/index.js';
import {
  LedgerService,
  type LedgerAccountRecord,
} from '../../packages/modules/ledger/src/index.js';

const tenantId = 'tenant-finance-completion';
const legalEntityId = 'entity-finance-completion';
const bookId = 'book-finance-completion';
const periodId = 'period-fy-2026';
const gbp = currencyCode('GBP');
const clock = { now: () => new Date('2026-07-28T12:00:00.000Z') };

function principal(
  principalId: string,
  permissions: FinancePrincipal['permissions'],
  assurance: FinancePrincipal['assurance'] = 'aal2',
  scope: FinancePrincipal['scope'] = { tenantId, legalEntityId },
): FinancePrincipal {
  return { principalId, permissions, assurance, scope };
}

const operator = principal('finance-operator', [
  'billing.account.write',
  'billing.fee.write',
  'billing.invoice.write',
  'billing.credit-note.write',
  'billing.payment.write',
  'billing.allocation.write',
  'billing.allocation.unallocate',
  'billing.refund.write',
]);
const invoicePoster = principal('invoice-poster', ['billing.invoice.post', 'ledger.journal.post']);
const creditPoster = principal('credit-poster', [
  'billing.credit-note.post',
  'ledger.journal.post',
]);
const paymentVerifier = principal('payment-verifier', [
  'billing.payment.verify',
  'ledger.journal.post',
]);
const refundApprover = principal('refund-approver', [
  'billing.refund.approve',
  'ledger.journal.post',
]);
const reporter = principal('finance-reporter', ['finance.report.read']);
const periodCloser = principal('period-closer', ['ledger.period.close']);
const periodReopener = principal('period-reopener', ['ledger.period.reopen'], 'aal3');
const manualPoster = principal('manual-poster', ['ledger.journal.post']);

interface CompletionEnvironment {
  readonly ledger: LedgerService;
  readonly billing: BillingService;
  readonly payments: PaymentService;
  readonly reporting: FinanceReportingService;
  readonly adapter: HmacTestPaymentProviderAdapter;
}

function ledgerAccount(
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

function createEnvironment(): CompletionEnvironment {
  const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
  ledger.registerAccount(ledgerAccount('cash', '1000', 'asset'));
  ledger.registerAccount(ledgerAccount('bank-deposit', '1010', 'asset'));
  ledger.registerAccount(ledgerAccount('receivable', '1100', 'asset', true));
  ledger.registerAccount(ledgerAccount('unapplied-cash', '2200', 'liability', true));
  ledger.registerAccount(ledgerAccount('tuition-income', '4100', 'income'));
  ledger.registerAccount(ledgerAccount('supplies-expense', '5100', 'expense'));
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
      id: 'family-account',
      tenantId,
      legalEntityId,
      accountHolderRef: 'student-1',
      currency: gbp,
      status: 'active',
      responsibleParties: [
        { personRef: 'guardian-1', responsibilityBasisPoints: 10_000, priority: 1 },
      ],
    },
    operator,
  );
  billing.registerFeeItem(
    {
      id: 'tuition-fee',
      tenantId,
      legalEntityId,
      code: 'TUITION',
      name: 'Tuition fee',
      description: null,
      amountMinor: minorUnit(1_000),
      currency: gbp,
      incomeAccountId: 'tuition-income',
      taxBasisPoints: 0,
      taxAccountId: null,
      active: true,
    },
    operator,
  );

  const payments = new PaymentService(
    { tenantId, legalEntityId },
    billing,
    ledger,
    {
      bookId,
      cashAccountId: 'cash',
      bankDepositAccountId: 'bank-deposit',
      receivableAccountId: 'receivable',
      unappliedCashAccountId: 'unapplied-cash',
    },
    clock,
  );
  const reporting = new FinanceReportingService(
    { tenantId, legalEntityId },
    billing,
    payments,
    ledger,
    {
      receivableAccountId: 'receivable',
      unappliedCashAccountId: 'unapplied-cash',
      maxRows: 10_000,
    },
  );
  return {
    ledger,
    billing,
    payments,
    reporting,
    adapter: new HmacTestPaymentProviderAdapter(
      'completion-pay',
      'completion-provider-secret-123456789',
    ),
  };
}

function createAndPostInvoice(
  environment: CompletionEnvironment,
  key: string,
  quantity = 1,
  issueDate = '2026-07-01',
  dueDate = '2026-07-31',
) {
  const draft = environment.billing.createInvoice({
    billingAccountId: 'family-account',
    issueDate,
    dueDate,
    lines: [{ feeItemId: 'tuition-fee', quantity }],
    createdBy: operator,
    idempotencyKey: `invoice:${key}`,
  });
  return environment.billing.postInvoice({
    invoiceId: draft.id,
    periodId,
    postedBy: invoicePoster,
    idempotencyKey: `invoice:${key}`,
    correlationId: `correlation:invoice:${key}`,
  });
}

function settlePayment(
  environment: CompletionEnvironment,
  key: string,
  amountMinor: number,
  occurredAt = '2026-07-28T11:00:00.000Z',
) {
  const intent = environment.payments.createPaymentIntent({
    billingAccountId: 'family-account',
    amountMinor,
    currency: gbp,
    provider: environment.adapter.provider,
    expiresAt: '2026-07-29T12:00:00.000Z',
    createdBy: operator,
    idempotencyKey: `intent:${key}`,
  });
  environment.payments.bindProviderIntent(intent.id, `provider-intent:${key}`, operator);
  const event: VerifiedProviderEvent = {
    eventId: `event:${key}`,
    eventType: 'payment.settled',
    provider: environment.adapter.provider,
    providerPaymentId: `provider-payment:${key}`,
    paymentIntentId: intent.id,
    amountMinor,
    currency: 'GBP',
    occurredAt,
    metadata: { fixture: 'completion' },
  };
  const payload = JSON.stringify(event);
  const input = {
    payload,
    signature: environment.adapter.sign(payload),
    adapter: environment.adapter,
    verifiedBy: paymentVerifier,
    periodId,
    correlationId: `correlation:payment:${key}`,
  } as const;
  const payment = environment.payments.processProviderEvent(input);
  if (payment === null) throw new Error('Expected settled payment');
  return { payment, replay: () => environment.payments.processProviderEvent(input) };
}

function normalizedReplayResult(environment: CompletionEnvironment) {
  const trialBalance = environment.reporting
    .trialBalance('2026-07-31', reporter)
    .rows.map((row) => ({
      code: row.accountCode,
      debitMinor: row.debitMinor,
      creditMinor: row.creditMinor,
      balanceMinor: row.balanceMinor,
    }));
  const statement = environment.reporting
    .accountStatement('family-account', '2026-07-31', reporter)
    .entries.map((entry) => ({
      date: entry.date,
      type: entry.type,
      number: entry.documentNumber,
      debitMinor: entry.debitMinor,
      creditMinor: entry.creditMinor,
      runningBalanceMinor: entry.runningBalanceMinor,
    }));
  const aging = environment.reporting.aging('2026-07-31', reporter);
  return {
    receivable: environment.reporting.receivableReconciliation('2026-07-31', reporter),
    unappliedCash: environment.reporting.unappliedCash('2026-07-31', reporter),
    aging: {
      asOf: aging.asOf,
      currency: aging.currency,
      totals: aging.totals,
      totalOutstandingMinor: aging.totalOutstandingMinor,
      rows: aging.rows.map((row) => ({
        invoiceNumber: row.invoiceNumber,
        billingAccountId: row.billingAccountId,
        dueDate: row.dueDate,
        daysOverdue: row.daysOverdue,
        bucket: row.bucket,
        outstandingMinor: row.outstandingMinor,
      })),
    },
    trialBalance,
    statement,
    incomeStatement: environment.reporting.incomeStatement('2026-07-01', '2026-07-31', reporter),
    balanceSheet: environment.reporting.balanceSheet('2026-07-31', reporter),
  };
}

function replayCommandLog() {
  const environment = createEnvironment();
  const invoiceOne = createAndPostInvoice(environment, 'one', 1);
  const invoiceTwo = createAndPostInvoice(environment, 'two', 2);
  const { payment, replay } = settlePayment(environment, 'combined', 1_500);
  expect(replay()).toBe(payment);
  environment.payments.allocatePayment({
    paymentId: payment.id,
    invoiceId: invoiceOne.id,
    amountMinor: 1_000,
    principal: operator,
    periodId,
    idempotencyKey: 'allocation:one',
    correlationId: 'correlation:allocation:one',
  });
  environment.payments.allocatePayment({
    paymentId: payment.id,
    invoiceId: invoiceTwo.id,
    amountMinor: 500,
    principal: operator,
    periodId,
    idempotencyKey: 'allocation:two',
    correlationId: 'correlation:allocation:two',
  });
  const credit = environment.billing.createCreditNote({
    invoiceId: invoiceTwo.id,
    issueDate: '2026-07-29',
    reason: 'Replay fixture adjustment',
    lineCredits: [{ invoiceLineId: invoiceTwo.lines[0]!.id, amountMinor: 250 }],
    createdBy: operator,
    idempotencyKey: 'credit:two',
  });
  environment.billing.postCreditNote({
    creditNoteId: credit.id,
    periodId,
    postedBy: creditPoster,
    idempotencyKey: 'credit:two',
    correlationId: 'correlation:credit:two',
  });
  environment.ledger.post({
    tenantId,
    legalEntityId,
    bookId,
    periodId,
    entryDate: '2026-07-30',
    description: 'Supplies expense',
    sourceDocumentType: 'manual-journal',
    sourceDocumentId: 'expense:one',
    createdBy: 'manual-creator',
    postedBy: manualPoster,
    idempotencyKey: 'manual:expense:one',
    correlationId: 'correlation:manual:expense:one',
    lines: [
      { accountId: 'supplies-expense', side: 'debit', amountMinor: 300, currency: gbp },
      { accountId: 'cash', side: 'credit', amountMinor: 300, currency: gbp },
    ],
  });
  return normalizedReplayResult(environment);
}

describe('FIN-01 final resilience and completion gates', () => {
  it('processes 1,000 invoice/payment/allocation chains with duplicate provider replays and reconciles every control account', () => {
    const environment = createEnvironment();
    const count = 1_000;
    for (let index = 1; index <= count; index += 1) {
      const key = String(index).padStart(4, '0');
      const invoice = createAndPostInvoice(environment, `volume:${key}`);
      const { payment, replay } = settlePayment(environment, `volume:${key}`, 1_000);
      expect(replay()).toBe(payment);
      environment.payments.allocatePayment({
        paymentId: payment.id,
        invoiceId: invoice.id,
        amountMinor: 1_000,
        principal: operator,
        periodId,
        idempotencyKey: `allocation:volume:${key}`,
        correlationId: `correlation:allocation:volume:${key}`,
      });
    }

    expect(environment.billing.listInvoices()).toHaveLength(count);
    expect(environment.billing.listInvoices().every((invoice) => invoice.status === 'paid')).toBe(
      true,
    );
    expect(environment.payments.listPayments()).toHaveLength(count);
    expect(environment.payments.listAllocations()).toHaveLength(count);
    expect(environment.ledger.listEntries()).toHaveLength(count * 3);
    expect(environment.reporting.receivableReconciliation('2026-07-31', reporter)).toMatchObject({
      subledgerMinor: 0,
      controlAccountMinor: 0,
      differenceMinor: 0,
      reconciled: true,
    });
    expect(environment.reporting.unappliedCash('2026-07-31', reporter)).toMatchObject({
      subledgerMinor: 0,
      controlAccountMinor: 0,
      differenceMinor: 0,
      reconciled: true,
    });
    expect(
      environment.reporting.incomeStatement('2026-07-01', '2026-07-31', reporter),
    ).toMatchObject({
      incomeMinor: 1_000_000,
      expenseMinor: 0,
      netIncomeMinor: 1_000_000,
    });
    expect(environment.reporting.balanceSheet('2026-07-31', reporter)).toMatchObject({
      assetsMinor: 1_000_000,
      currentEarningsMinor: 1_000_000,
      differenceMinor: 0,
      balanced: true,
    });
    expect(environment.reporting.trialBalance('2026-07-31', reporter).balanced).toBe(true);
  }, 30_000);

  it('rebuilds identical financial results by replaying the same command log into a fresh runtime', () => {
    expect(replayCommandLog()).toEqual(replayCommandLog());
  });

  it('blocks invoice and payment posting in a closed period and resumes safely after independent AAL3 reopen', () => {
    const environment = createEnvironment();
    const draft = environment.billing.createInvoice({
      billingAccountId: 'family-account',
      issueDate: '2026-07-28',
      dueDate: '2026-08-15',
      lines: [{ feeItemId: 'tuition-fee', quantity: 1 }],
      createdBy: operator,
      idempotencyKey: 'invoice:closed-period',
    });
    environment.ledger.closePeriod(periodId, periodCloser);
    expect(() =>
      environment.billing.postInvoice({
        invoiceId: draft.id,
        periodId,
        postedBy: invoicePoster,
        idempotencyKey: 'invoice:closed-period',
        correlationId: 'correlation:closed-period:invoice',
      }),
    ).toThrow('FIN_PERIOD_CLOSED');

    const intent = environment.payments.createPaymentIntent({
      billingAccountId: 'family-account',
      amountMinor: 1_000,
      currency: gbp,
      provider: environment.adapter.provider,
      expiresAt: '2026-07-29T12:00:00.000Z',
      createdBy: operator,
      idempotencyKey: 'intent:closed-period',
    });
    environment.payments.bindProviderIntent(intent.id, 'provider-intent:closed-period', operator);
    const event: VerifiedProviderEvent = {
      eventId: 'event:closed-period',
      eventType: 'payment.settled',
      provider: environment.adapter.provider,
      providerPaymentId: 'provider-payment:closed-period',
      paymentIntentId: intent.id,
      amountMinor: 1_000,
      currency: 'GBP',
      occurredAt: '2026-07-28T11:30:00.000Z',
      metadata: {},
    };
    const payload = JSON.stringify(event);
    const paymentInput = {
      payload,
      signature: environment.adapter.sign(payload),
      adapter: environment.adapter,
      verifiedBy: paymentVerifier,
      periodId,
      correlationId: 'correlation:closed-period:payment',
    } as const;
    expect(() => environment.payments.processProviderEvent(paymentInput)).toThrow(
      'FIN_PERIOD_CLOSED',
    );
    expect(environment.payments.listPayments()).toHaveLength(0);

    environment.ledger.reopenPeriod(periodId, periodReopener, 'Correction window approved');
    expect(
      environment.billing.postInvoice({
        invoiceId: draft.id,
        periodId,
        postedBy: invoicePoster,
        idempotencyKey: 'invoice:closed-period',
        correlationId: 'correlation:closed-period:invoice',
      }).status,
    ).toBe('posted');
    expect(environment.payments.processProviderEvent(paymentInput)).toMatchObject({
      status: 'settled',
    });
  });

  it('rejects cross-tenant finance commands before mutating state', () => {
    const environment = createEnvironment();
    const wrongScope = principal(
      'wrong-tenant-operator',
      ['billing.invoice.write', 'billing.payment.write'],
      'aal2',
      { tenantId: 'tenant-other', legalEntityId },
    );
    expect(() =>
      environment.billing.createInvoice({
        billingAccountId: 'family-account',
        issueDate: '2026-07-28',
        dueDate: '2026-08-15',
        lines: [{ feeItemId: 'tuition-fee', quantity: 1 }],
        createdBy: wrongScope,
        idempotencyKey: 'invoice:wrong-tenant',
      }),
    ).toThrow('FIN_SCOPE_MISMATCH');
    expect(() =>
      environment.payments.createPaymentIntent({
        billingAccountId: 'family-account',
        amountMinor: 1_000,
        currency: gbp,
        provider: environment.adapter.provider,
        expiresAt: '2026-07-29T12:00:00.000Z',
        createdBy: wrongScope,
        idempotencyKey: 'intent:wrong-tenant',
      }),
    ).toThrow('FIN_SCOPE_MISMATCH');
    expect(environment.billing.listInvoices()).toHaveLength(0);
    expect(environment.payments.listPayments()).toHaveLength(0);
  });

  it('preserves every minor unit across currencies, signs and deterministic allocation weights', () => {
    const currencies: readonly CurrencyCode[] = [
      currencyCode('GBP'),
      currencyCode('BDT'),
      currencyCode('JPY'),
      currencyCode('KWD'),
    ];
    const weightSets: readonly (readonly number[])[] = [
      [1],
      [1, 1],
      [1, 2, 3],
      [0, 5, 5, 10],
      [3, 7, 11, 13, 17],
    ];
    for (const currency of currencies) {
      for (let amount = -2_000; amount <= 2_000; amount += 37) {
        for (const weights of weightSets) {
          const allocations = allocateMoney({ amount: minorUnit(amount), currency }, weights);
          expect(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(amount);
          expect(allocations.every((allocation) => allocation.currency === currency)).toBe(true);
        }
      }
    }
  });

  it('applies half-even ties symmetrically for positive and negative values', () => {
    const policy = createRoundingPolicy('half-even', 0);
    for (let integer = -100; integer <= 100; integer += 1) {
      const value = integer + 0.5;
      const lower = Math.floor(value);
      const expected = Math.abs(lower) % 2 === 0 ? lower : lower + 1;
      expect(applyRounding(value, policy)).toBe(expected);
    }
  });

  it('keeps refunds independently approved and fully traceable to the ledger', () => {
    const environment = createEnvironment();
    const invoice = createAndPostInvoice(environment, 'refund-trace');
    const { payment } = settlePayment(environment, 'refund-trace', 1_000);
    const allocation = environment.payments.allocatePayment({
      paymentId: payment.id,
      invoiceId: invoice.id,
      amountMinor: 1_000,
      principal: operator,
      periodId,
      idempotencyKey: 'allocation:refund-trace',
      correlationId: 'correlation:allocation:refund-trace',
    });
    environment.payments.reverseAllocation({
      allocationId: allocation.id,
      amountMinor: 1_000,
      reason: 'Refund requires clearing the invoice allocation',
      principal: operator,
      periodId,
      idempotencyKey: 'unallocation:refund-trace',
      correlationId: 'correlation:unallocation:refund-trace',
    });
    const refund = environment.payments.requestRefund({
      paymentId: payment.id,
      amountMinor: 1_000,
      reason: 'Duplicate family payment received',
      requestedBy: operator,
      idempotencyKey: 'refund:trace',
    });
    const settled = environment.payments.approveAndSettleRefund({
      refundId: refund.id,
      approvedBy: refundApprover,
      periodId,
      correlationId: 'correlation:refund:trace',
    });
    expect(settled).toMatchObject({ status: 'settled', approvedBy: 'refund-approver' });
    expect(environment.ledger.getEntriesForSource('refund', refund.id)).toHaveLength(1);
    expect(environment.payments.getPayment(payment.id)).toMatchObject({
      status: 'refunded',
      refundedMinor: 1_000,
      unappliedMinor: 0,
    });
    expect(environment.reporting.unappliedCash('2026-07-31', reporter)).toMatchObject({
      subledgerMinor: 0,
      controlAccountMinor: 0,
      reconciled: true,
    });
  });
});
