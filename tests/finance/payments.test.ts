import { describe, expect, it } from 'vitest';

import {
  BillingService,
  currencyCode,
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
const clock = { now: () => new Date('2026-07-28T10:00:00.000Z') };
const adapter = new HmacTestPaymentProviderAdapter('test-pay', 'test-secret-value-123456');

function principal(
  principalId: string,
  permissions: FinancePrincipal['permissions'],
  assurance: FinancePrincipal['assurance'] = 'aal2',
): FinancePrincipal {
  return { principalId, permissions, assurance, scope: { tenantId, legalEntityId } };
}

const financeAdmin = principal('finance-admin', [
  'billing.account.write',
  'billing.fee.write',
  'billing.invoice.write',
  'billing.allocation.write',
  'billing.allocation.unallocate',
  'billing.payment.write',
  'billing.refund.write',
  'billing.refund.approve',
]);
const invoicePoster = principal('invoice-poster', ['billing.invoice.post', 'ledger.journal.post']);
const verifier = principal('payment-verifier', ['billing.payment.verify', 'ledger.journal.post']);
const refundApprover = principal('refund-approver', [
  'billing.refund.approve',
  'ledger.journal.post',
]);
const cashier = principal('cashier', [
  'cashier.session.open',
  'cashier.session.close',
  'cashier.deposit.approve',
]);
const depositApprover = principal('deposit-approver', [
  'cashier.deposit.approve',
  'ledger.journal.post',
]);
const reconciler = principal('reconciler', ['ledger.reconciliation.write']);
const reconciliationApprover = principal('reconciliation-approver', [
  'ledger.reconciliation.approve',
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

function setup(): {
  billing: BillingService;
  ledger: LedgerService;
  payments: PaymentService;
  invoiceId: string;
} {
  const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
  ledger.registerAccount(account('cash', '1000', 'asset'));
  ledger.registerAccount(account('bank-deposit', '1010', 'asset'));
  ledger.registerAccount(account('receivable', '1100', 'asset', true));
  ledger.registerAccount(account('unapplied-cash', '2200', 'liability', true));
  ledger.registerAccount(account('tuition-income', '4100', 'income'));
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
    financeAdmin,
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
    financeAdmin,
  );
  const invoice = billing.createInvoice({
    billingAccountId: 'family-account-1',
    issueDate: '2026-07-01',
    dueDate: '2026-07-31',
    lines: [{ feeItemId: 'tuition', quantity: 1 }],
    createdBy: financeAdmin,
    idempotencyKey: 'payment-test-invoice',
  });
  billing.postInvoice({
    invoiceId: invoice.id,
    periodId,
    postedBy: invoicePoster,
    idempotencyKey: 'payment-test-invoice',
    correlationId: 'corr-invoice',
  });

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
  return { billing, ledger, payments, invoiceId: invoice.id };
}

function createBoundIntent(payments: PaymentService, amountMinor = 11_000, key = 'intent-1') {
  const intent = payments.createPaymentIntent({
    billingAccountId: 'family-account-1',
    amountMinor,
    currency: gbp,
    provider: adapter.provider,
    expiresAt: '2026-07-29T10:00:00.000Z',
    createdBy: financeAdmin,
    idempotencyKey: key,
  });
  return payments.bindProviderIntent(intent.id, `provider-${key}`, financeAdmin);
}

function event(
  intentId: string,
  eventId = 'event-1',
  providerPaymentId = 'payment-1',
  eventType: VerifiedProviderEvent['eventType'] = 'payment.settled',
  amountMinor = 11_000,
): VerifiedProviderEvent {
  return {
    eventId,
    eventType,
    provider: adapter.provider,
    providerPaymentId,
    paymentIntentId: intentId,
    amountMinor,
    currency: 'GBP',
    occurredAt: '2026-07-28T09:59:00.000Z',
    metadata: { source: 'synthetic-test' },
  };
}

function process(
  payments: PaymentService,
  providerEvent: VerifiedProviderEvent,
  cashierSessionId?: string,
) {
  const payload = JSON.stringify(providerEvent);
  return payments.processProviderEvent({
    payload,
    signature: adapter.sign(payload),
    adapter,
    verifiedBy: verifier,
    periodId,
    correlationId: `corr-${providerEvent.eventId}`,
    ...(cashierSessionId === undefined ? {} : { cashierSessionId }),
  });
}

describe('FIN-01 payments, refunds, cashier and reconciliation inputs', () => {
  it('creates and binds payment intents idempotently', () => {
    const { payments } = setup();
    const first = createBoundIntent(payments);
    const replay = payments.createPaymentIntent({
      billingAccountId: 'family-account-1',
      amountMinor: 11_000,
      currency: gbp,
      provider: adapter.provider,
      expiresAt: '2026-07-29T10:00:00.000Z',
      createdBy: financeAdmin,
      idempotencyKey: 'intent-1',
    });
    expect(replay).toBe(first);
    expect(first).toMatchObject({ status: 'authorized', providerIntentId: 'provider-intent-1' });
  });

  it('verifies signatures, rejects malformed events, and makes provider retries harmless', () => {
    const { payments, ledger } = setup();
    const intent = createBoundIntent(payments);
    const providerEvent = event(intent.id);
    const payload = JSON.stringify(providerEvent);
    expect(() =>
      payments.processProviderEvent({
        payload,
        signature: '00',
        adapter,
        verifiedBy: verifier,
        periodId,
        correlationId: 'corr-invalid',
      }),
    ).toThrow('FIN_PROVIDER_SIGNATURE_INVALID');
    const malformed = '{bad-json';
    expect(() =>
      payments.processProviderEvent({
        payload: malformed,
        signature: adapter.sign(malformed),
        adapter,
        verifiedBy: verifier,
        periodId,
        correlationId: 'corr-invalid-json',
      }),
    ).toThrow('FIN_PROVIDER_EVENT_INVALID');

    const first = process(payments, providerEvent);
    const replay = process(payments, providerEvent);
    expect(replay).toBe(first);
    expect(first).toMatchObject({
      receiptNumber: 'RCT-000001',
      amountMinor: 11_000,
      unappliedMinor: 11_000,
      status: 'settled',
    });
    expect(
      ledger
        .getEntriesForSource('payment', 'payment-1')[0]
        ?.lines.map((line) => [line.accountId, line.side, line.amountMinor]),
    ).toEqual([
      ['cash', 'debit', 11_000],
      ['unapplied-cash', 'credit', 11_000],
    ]);
  });

  it('deduplicates failed events and rejects duplicate provider-payment references', () => {
    const { payments } = setup();
    const intent = createBoundIntent(payments);
    const failed = event(intent.id, 'failed-event', 'failed-payment', 'payment.failed');
    expect(process(payments, failed)).toBeNull();
    expect(process(payments, failed)).toBeNull();
    process(payments, event(intent.id, 'settled-event', 'provider-payment'));
    expect(() => process(payments, event(intent.id, 'second-event', 'provider-payment'))).toThrow(
      'FIN_DUPLICATE_PROVIDER_PAYMENT',
    );
  });

  it('allocates and unallocates payment idempotently while invoice, payment and journals remain consistent', () => {
    const { billing, payments, ledger, invoiceId } = setup();
    const payment = process(payments, event(createBoundIntent(payments).id))!;
    const allocation = payments.allocatePayment({
      paymentId: payment.id,
      invoiceId,
      amountMinor: 7_000,
      principal: financeAdmin,
      periodId,
      idempotencyKey: 'allocation-1',
      correlationId: 'corr-allocation-1',
    });
    expect(
      payments.allocatePayment({
        paymentId: payment.id,
        invoiceId,
        amountMinor: 7_000,
        principal: financeAdmin,
        periodId,
        idempotencyKey: 'allocation-1',
        correlationId: 'corr-allocation-1',
      }),
    ).toBe(allocation);
    expect(payments.getPayment(payment.id)).toMatchObject({
      allocatedMinor: 7_000,
      unappliedMinor: 4_000,
    });
    expect(billing.getInvoice(invoiceId)).toMatchObject({
      allocatedMinor: 7_000,
      balanceMinor: 4_000,
      status: 'partially-paid',
    });
    expect(
      ledger
        .getEntry(allocation.journalEntryId)
        ?.lines.map((line) => [line.accountId, line.side, line.amountMinor]),
    ).toEqual([
      ['unapplied-cash', 'debit', 7_000],
      ['receivable', 'credit', 7_000],
    ]);

    const reversed = payments.reverseAllocation({
      allocationId: allocation.id,
      amountMinor: 7_000,
      reason: 'Allocation entered against wrong invoice',
      principal: financeAdmin,
      periodId,
      idempotencyKey: 'unallocation-1',
      correlationId: 'corr-unallocation-1',
    });
    expect(reversed.reversalJournalEntryId).not.toBeNull();
    expect(payments.getPayment(payment.id)).toMatchObject({
      allocatedMinor: 0,
      unappliedMinor: 11_000,
    });
    expect(billing.getInvoice(invoiceId)).toMatchObject({
      allocatedMinor: 0,
      balanceMinor: 11_000,
      status: 'posted',
    });
  });

  it('bounds refunds, requires unallocation and enforces requester/verifier/approver separation', () => {
    const { payments, invoiceId } = setup();
    const payment = process(payments, event(createBoundIntent(payments).id))!;
    const allocation = payments.allocatePayment({
      paymentId: payment.id,
      invoiceId,
      amountMinor: 7_000,
      principal: financeAdmin,
      periodId,
      idempotencyKey: 'refund-allocation',
      correlationId: 'corr-refund-allocation',
    });
    const refund = payments.requestRefund({
      paymentId: payment.id,
      amountMinor: 5_000,
      reason: 'Family requested overpayment return',
      requestedBy: financeAdmin,
      idempotencyKey: 'refund-1',
    });
    expect(() =>
      payments.approveAndSettleRefund({
        refundId: refund.id,
        approvedBy: refundApprover,
        periodId,
        correlationId: 'corr-refund',
      }),
    ).toThrow('FIN_REFUND_REQUIRES_UNALLOCATION');
    payments.reverseAllocation({
      allocationId: allocation.id,
      amountMinor: 7_000,
      reason: 'Refund requires clearing allocation',
      principal: financeAdmin,
      periodId,
      idempotencyKey: 'refund-unallocation',
      correlationId: 'corr-refund-unallocation',
    });
    expect(() =>
      payments.approveAndSettleRefund({
        refundId: refund.id,
        approvedBy: financeAdmin,
        periodId,
        correlationId: 'corr-refund-sod',
      }),
    ).toThrow('FIN_SOD_VIOLATION');
    const settled = payments.approveAndSettleRefund({
      refundId: refund.id,
      approvedBy: refundApprover,
      periodId,
      correlationId: 'corr-refund',
    });
    expect(settled).toMatchObject({
      status: 'settled',
      amountMinor: 5_000,
      approvedBy: 'refund-approver',
    });
    expect(payments.getPayment(payment.id)).toMatchObject({
      status: 'partially-refunded',
      refundedMinor: 5_000,
      unappliedMinor: 6_000,
    });
    expect(() =>
      payments.requestRefund({
        paymentId: payment.id,
        amountMinor: 7_000,
        reason: 'Exceeds remaining refundable amount',
        requestedBy: financeAdmin,
        idempotencyKey: 'refund-excess',
      }),
    ).toThrow('FIN_REFUND_EXCEEDS_AVAILABLE');
  });

  it('reverses an unapplied provider payment once and blocks reversal after allocation', () => {
    const { payments, invoiceId } = setup();
    const firstIntent = createBoundIntent(payments, 11_000, 'reversal-intent');
    const payment = process(
      payments,
      event(firstIntent.id, 'settle-reversal', 'provider-reversal-payment'),
    )!;
    const reversalEvent = event(
      firstIntent.id,
      'provider-reversal-event',
      'provider-reversal-payment',
      'payment.reversed',
    );
    expect(process(payments, reversalEvent)).toMatchObject({
      status: 'reversed',
      unappliedMinor: 0,
    });
    expect(process(payments, reversalEvent)).toBe(payments.getPayment(payment.id));

    const secondIntent = createBoundIntent(payments, 11_000, 'allocated-intent');
    const allocatedPayment = process(
      payments,
      event(secondIntent.id, 'settle-allocated', 'provider-allocated-payment'),
    )!;
    payments.allocatePayment({
      paymentId: allocatedPayment.id,
      invoiceId,
      amountMinor: 1_000,
      principal: financeAdmin,
      periodId,
      idempotencyKey: 'allocated-before-reversal',
      correlationId: 'corr-allocated-before-reversal',
    });
    expect(() =>
      process(
        payments,
        event(
          secondIntent.id,
          'reverse-allocated',
          'provider-allocated-payment',
          'payment.reversed',
        ),
      ),
    ).toThrow('FIN_PAYMENT_REVERSAL_REQUIRES_CLEAR_BALANCE');
  });

  it('closes cashier sessions with variance and requires independent deposit approval', () => {
    const { payments, ledger } = setup();
    const session = payments.openCashierSession({
      cashierId: 'cashier-1',
      openingFloatMinor: 0,
      currency: gbp,
      openedBy: cashier,
    });
    const intent = createBoundIntent(payments, 5_000, 'cashier-intent');
    process(
      payments,
      event(intent.id, 'cash-event', 'cash-payment', 'payment.settled', 5_000),
      session.id,
    );
    const closed = payments.closeCashierSession({
      sessionId: session.id,
      countedCashMinor: 4_900,
      closedBy: cashier,
    });
    expect(closed).toMatchObject({
      expectedCashMinor: 5_000,
      countedCashMinor: 4_900,
      varianceMinor: -100,
      status: 'closed',
    });
    const deposit = payments.prepareCashierDeposit(session.id, cashier);
    expect(() =>
      payments.approveCashierDeposit({
        depositId: deposit.id,
        approvedBy: cashier,
        periodId,
        correlationId: 'corr-deposit-sod',
      }),
    ).toThrow('FIN_SOD_VIOLATION');
    const approved = payments.approveCashierDeposit({
      depositId: deposit.id,
      approvedBy: depositApprover,
      periodId,
      correlationId: 'corr-deposit',
    });
    expect(approved.journalEntryId).not.toBeNull();
    expect(
      ledger
        .getEntry(approved.journalEntryId!)
        ?.lines.map((line) => [line.accountId, line.side, line.amountMinor]),
    ).toEqual([
      ['bank-deposit', 'debit', 4_900],
      ['cash', 'credit', 4_900],
    ]);
  });

  it('imports bank lines idempotently, matches exact payments and requires approval to reconcile', () => {
    const { payments } = setup();
    const payment = process(payments, event(createBoundIntent(payments).id))!;
    const importInput = {
      bankAccountRef: 'bank-account-1',
      statementRef: 'statement-2026-07',
      currency: gbp,
      lines: [
        {
          lineNumber: 1,
          bookingDate: '2026-07-28',
          amountMinor: 11_000,
          description: 'School fee payment',
          externalReference: 'payment-1',
        },
      ],
      principal: reconciler,
    } as const;
    const first = payments.importBankStatementLines(importInput)[0]!;
    expect(payments.importBankStatementLines(importInput)[0]).toBe(first);
    const matched = payments.matchBankLine(first.id, payment.id, reconciler);
    expect(matched.status).toBe('matched');
    expect(payments.completeReconciliation([matched.id], reconciliationApprover)[0]?.status).toBe(
      'reconciled',
    );
  });
});
