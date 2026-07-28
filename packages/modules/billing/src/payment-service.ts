import { createHmac, timingSafeEqual } from 'node:crypto';

import type { BillingService, Invoice } from './billing-service.js';
import { currencyCode, minorUnit, type CurrencyCode, type MinorUnit } from './contracts/money.js';
import { authorizeFinance, type FinancePrincipal, type FinanceScope } from './contracts/permissions.js';
import type { LedgerService } from '../../ledger/src/ledger-service.js';

export type PaymentIntentStatus = 'pending' | 'authorized' | 'cancelled' | 'expired';
export type PaymentStatus = 'settled' | 'partially-refunded' | 'refunded' | 'reversed';
export type RefundStatus = 'pending-approval' | 'approved' | 'rejected' | 'settled';
export type CashierSessionStatus = 'open' | 'closed' | 'deposited';
export type ReconciliationStatus = 'unmatched' | 'matched' | 'reconciled' | 'ignored';

export interface PaymentIntent {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly billingAccountId: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly provider: string;
  readonly providerIntentId: string | null;
  readonly status: PaymentIntentStatus;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
}

export interface VerifiedProviderEvent {
  readonly eventId: string;
  readonly eventType: 'payment.settled' | 'payment.failed' | 'payment.reversed';
  readonly provider: string;
  readonly providerPaymentId: string;
  readonly paymentIntentId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAt: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface PaymentProviderAdapter {
  readonly provider: string;
  verifyEvent(payload: string, signature: string): VerifiedProviderEvent;
}

export interface PaymentRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly billingAccountId: string;
  readonly paymentIntentId: string;
  readonly provider: string;
  readonly providerPaymentId: string;
  readonly providerEventId: string;
  readonly receiptNumber: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly status: PaymentStatus;
  readonly allocatedMinor: MinorUnit;
  readonly refundedMinor: MinorUnit;
  readonly unappliedMinor: MinorUnit;
  readonly receivedAt: string;
  readonly verifiedBy: string;
  readonly journalEntryId: string;
  readonly cashierSessionId: string | null;
}

export interface PaymentAllocation {
  readonly id: string;
  readonly paymentId: string;
  readonly invoiceId: string;
  readonly amountMinor: MinorUnit;
  readonly allocatedAt: string;
  readonly allocatedBy: string;
  readonly reversedAt: string | null;
  readonly reversedBy: string | null;
  readonly reversalReason: string | null;
  readonly journalEntryId: string;
  readonly reversalJournalEntryId: string | null;
  readonly idempotencyKey: string;
}

export interface RefundRecord {
  readonly id: string;
  readonly refundNumber: string;
  readonly paymentId: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly reason: string;
  readonly status: RefundStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly settledAt: string | null;
  readonly journalEntryId: string | null;
  readonly idempotencyKey: string;
}

export interface CashierSession {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly cashierId: string;
  readonly openedBy: string;
  readonly openedAt: string;
  readonly openingFloatMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly status: CashierSessionStatus;
  readonly expectedCashMinor: MinorUnit;
  readonly countedCashMinor: MinorUnit | null;
  readonly varianceMinor: MinorUnit | null;
  readonly closedBy: string | null;
  readonly closedAt: string | null;
  readonly depositId: string | null;
}

export interface CashierDeposit {
  readonly id: string;
  readonly sessionId: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly preparedBy: string;
  readonly preparedAt: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly journalEntryId: string | null;
}

export interface BankStatementLine {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly bankAccountRef: string;
  readonly statementRef: string;
  readonly lineNumber: number;
  readonly bookingDate: string;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly externalReference: string | null;
  readonly importHash: string;
  readonly status: ReconciliationStatus;
  readonly matchedPaymentId: string | null;
  readonly matchedBy: string | null;
  readonly matchedAt: string | null;
}

export interface PaymentClock { now(): Date; }

export interface PaymentLedgerConfiguration {
  readonly bookId: string;
  readonly cashAccountId: string;
  readonly bankDepositAccountId: string;
  readonly receivableAccountId: string;
  readonly unappliedCashAccountId: string;
}

const systemClock: PaymentClock = { now: () => new Date() };

function assertIdentifier(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 300) throw new Error(`FIN_INVALID_IDENTIFIER:${field}`);
}

function assertDateTime(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`FIN_INVALID_DATETIME:${field}`);
}

function frozenArray<T>(values: readonly T[]): readonly T[] { return Object.freeze([...values]); }

export class HmacTestPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly provider: string;
  readonly #secret: string;

  constructor(provider: string, secret: string) {
    assertIdentifier(provider, 'provider');
    if (secret.length < 16) throw new Error('Provider secret must contain at least 16 characters');
    this.provider = provider;
    this.#secret = secret;
  }

  sign(payload: string): string {
    return createHmac('sha256', this.#secret).update(payload, 'utf8').digest('hex');
  }

  verifyEvent(payload: string, signature: string): VerifiedProviderEvent {
    const expected = Buffer.from(this.sign(payload), 'hex');
    let actual: Buffer;
    try { actual = Buffer.from(signature, 'hex'); } catch { throw new Error('FIN_PROVIDER_SIGNATURE_INVALID'); }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('FIN_PROVIDER_SIGNATURE_INVALID');
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('FIN_PROVIDER_EVENT_INVALID');
    }
    if (typeof parsed !== 'object' || parsed === null) throw new Error('FIN_PROVIDER_EVENT_INVALID');
    const event = parsed as Partial<VerifiedProviderEvent>;
    if (
      typeof event.eventId !== 'string'
      || !['payment.settled', 'payment.failed', 'payment.reversed'].includes(event.eventType ?? '')
      || event.provider !== this.provider
      || typeof event.providerPaymentId !== 'string'
      || typeof event.paymentIntentId !== 'string'
      || typeof event.amountMinor !== 'number'
      || typeof event.currency !== 'string'
      || typeof event.occurredAt !== 'string'
      || typeof event.metadata !== 'object'
      || event.metadata === null
    ) throw new Error('FIN_PROVIDER_EVENT_INVALID');
    assertDateTime(event.occurredAt, 'occurredAt');
    if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor <= 0) throw new Error('FIN_INVALID_AMOUNT');
    return Object.freeze({
      eventId: event.eventId,
      eventType: event.eventType as VerifiedProviderEvent['eventType'],
      provider: event.provider,
      providerPaymentId: event.providerPaymentId,
      paymentIntentId: event.paymentIntentId,
      amountMinor: event.amountMinor,
      currency: event.currency,
      occurredAt: event.occurredAt,
      metadata: Object.freeze({ ...(event.metadata as Record<string, string>) }),
    });
  }
}

export class PaymentService {
  readonly #scope: FinanceScope;
  readonly #billing: BillingService;
  readonly #ledger: LedgerService;
  readonly #config: PaymentLedgerConfiguration;
  readonly #clock: PaymentClock;
  readonly #intents = new Map<string, PaymentIntent>();
  readonly #intentIdempotency = new Map<string, string>();
  readonly #payments = new Map<string, PaymentRecord>();
  readonly #paymentByProviderEvent = new Map<string, string>();
  readonly #paymentByProviderReference = new Map<string, string>();
  readonly #allocations = new Map<string, PaymentAllocation>();
  readonly #allocationIdempotency = new Map<string, string>();
  readonly #refunds = new Map<string, RefundRecord>();
  readonly #refundIdempotency = new Map<string, string>();
  readonly #cashierSessions = new Map<string, CashierSession>();
  readonly #deposits = new Map<string, CashierDeposit>();
  readonly #statementLines = new Map<string, BankStatementLine>();
  readonly #statementImportHashes = new Map<string, string>();
  #receiptSequence = 0;
  #refundSequence = 0;

  constructor(
    scope: FinanceScope,
    billing: BillingService,
    ledger: LedgerService,
    config: PaymentLedgerConfiguration,
    clock: PaymentClock = systemClock,
  ) {
    assertIdentifier(scope.tenantId, 'tenantId');
    assertIdentifier(scope.legalEntityId ?? '', 'legalEntityId');
    [
      config.bookId,
      config.cashAccountId,
      config.bankDepositAccountId,
      config.receivableAccountId,
      config.unappliedCashAccountId,
    ].forEach((value) => assertIdentifier(value, 'ledgerConfiguration'));
    this.#scope = Object.freeze({ ...scope });
    this.#billing = billing;
    this.#ledger = ledger;
    this.#config = Object.freeze({ ...config });
    this.#clock = clock;
  }

  createPaymentIntent(input: {
    billingAccountId: string;
    amountMinor: number;
    currency: CurrencyCode;
    provider: string;
    expiresAt: string;
    createdBy: FinancePrincipal;
    idempotencyKey: string;
  }): PaymentIntent {
    authorizeFinance(input.createdBy, 'billing.payment.write', this.#scope);
    const existingId = this.#intentIdempotency.get(input.idempotencyKey);
    if (existingId) return this.#intents.get(existingId)!;
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('FIN_INVALID_AMOUNT');
    assertDateTime(input.expiresAt, 'expiresAt');
    if (Date.parse(input.expiresAt) <= this.#clock.now().getTime()) throw new Error('FIN_PAYMENT_INTENT_EXPIRY_INVALID');
    if (!this.#billing.listBillingAccounts().some((account) => account.id === input.billingAccountId && account.currency === input.currency)) {
      throw new Error('FIN_NOT_FOUND:billing-account-or-currency');
    }
    const intent: PaymentIntent = Object.freeze({
      id: crypto.randomUUID(),
      tenantId: this.#scope.tenantId,
      legalEntityId: this.#scope.legalEntityId!,
      billingAccountId: input.billingAccountId,
      amountMinor: minorUnit(input.amountMinor),
      currency: input.currency,
      provider: input.provider,
      providerIntentId: null,
      status: 'pending',
      createdBy: input.createdBy.principalId,
      createdAt: this.#clock.now().toISOString(),
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
    });
    this.#intents.set(intent.id, intent);
    this.#intentIdempotency.set(input.idempotencyKey, intent.id);
    return intent;
  }

  bindProviderIntent(intentId: string, providerIntentId: string, principal: FinancePrincipal): PaymentIntent {
    const intent = this.#requireIntent(intentId);
    authorizeFinance(principal, 'billing.payment.write', this.#scope);
    if (intent.status !== 'pending') throw new Error('FIN_INVALID_PAYMENT_INTENT_STATE');
    assertIdentifier(providerIntentId, 'providerIntentId');
    const updated = Object.freeze({ ...intent, providerIntentId, status: 'authorized' as const });
    this.#intents.set(intent.id, updated);
    return updated;
  }

  processProviderEvent(input: {
    payload: string;
    signature: string;
    adapter: PaymentProviderAdapter;
    verifiedBy: FinancePrincipal;
    periodId: string;
    correlationId: string;
    cashierSessionId?: string;
  }): PaymentRecord | null {
    authorizeFinance(input.verifiedBy, 'billing.payment.verify', this.#scope);
    const event = input.adapter.verifyEvent(input.payload, input.signature);
    const existingId = this.#paymentByProviderEvent.get(`${event.provider}:${event.eventId}`);
    if (existingId) return existingId === 'ignored' ? null : this.#payments.get(existingId)!;
    const intent = this.#requireIntent(event.paymentIntentId);
    if (intent.provider !== event.provider || intent.providerIntentId === null) throw new Error('FIN_PROVIDER_INTENT_MISMATCH');
    if (event.amountMinor !== intent.amountMinor || currencyCode(event.currency) !== intent.currency) throw new Error('FIN_PROVIDER_AMOUNT_MISMATCH');
    if (event.eventType === 'payment.failed') {
      this.#paymentByProviderEvent.set(`${event.provider}:${event.eventId}`, 'ignored');
      return null;
    }
    if (event.eventType === 'payment.reversed') {
      const paymentId = this.#paymentByProviderReference.get(`${event.provider}:${event.providerPaymentId}`);
      if (!paymentId) throw new Error('FIN_NOT_FOUND:payment');
      const reversed = this.reversePayment(
        paymentId,
        input.verifiedBy,
        input.periodId,
        `Provider reversal ${event.eventId}`,
        `provider-reversal:${event.eventId}`,
        input.correlationId,
      );
      this.#paymentByProviderEvent.set(`${event.provider}:${event.eventId}`, reversed.id);
      return reversed;
    }
    if (this.#paymentByProviderReference.has(`${event.provider}:${event.providerPaymentId}`)) throw new Error('FIN_DUPLICATE_PROVIDER_PAYMENT');
    if (input.cashierSessionId !== undefined) {
      const session = this.#requireSession(input.cashierSessionId);
      if (session.status !== 'open') throw new Error('FIN_CASHIER_SESSION_CLOSED');
      if (session.currency !== intent.currency) throw new Error('FIN_CURRENCY_MISMATCH');
    }
    const journal = this.#ledger.post({
      tenantId: this.#scope.tenantId,
      legalEntityId: this.#scope.legalEntityId!,
      bookId: this.#config.bookId,
      periodId: input.periodId,
      entryDate: event.occurredAt.slice(0, 10),
      description: `Payment receipt ${event.providerPaymentId}`,
      sourceDocumentType: 'payment',
      sourceDocumentId: event.providerPaymentId,
      createdBy: `provider:${event.provider}`,
      postedBy: input.verifiedBy,
      idempotencyKey: `payment:${event.provider}:${event.eventId}`,
      correlationId: input.correlationId,
      lines: [
        { accountId: this.#config.cashAccountId, side: 'debit', amountMinor: event.amountMinor, currency: intent.currency },
        { accountId: this.#config.unappliedCashAccountId, side: 'credit', amountMinor: event.amountMinor, currency: intent.currency },
      ],
    });
    const payment: PaymentRecord = Object.freeze({
      id: crypto.randomUUID(),
      tenantId: this.#scope.tenantId,
      legalEntityId: this.#scope.legalEntityId!,
      billingAccountId: intent.billingAccountId,
      paymentIntentId: intent.id,
      provider: event.provider,
      providerPaymentId: event.providerPaymentId,
      providerEventId: event.eventId,
      receiptNumber: this.#nextReceiptNumber(),
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      status: 'settled',
      allocatedMinor: minorUnit(0),
      refundedMinor: minorUnit(0),
      unappliedMinor: intent.amountMinor,
      receivedAt: event.occurredAt,
      verifiedBy: input.verifiedBy.principalId,
      journalEntryId: journal.id,
      cashierSessionId: input.cashierSessionId ?? null,
    });
    this.#payments.set(payment.id, payment);
    this.#paymentByProviderEvent.set(`${event.provider}:${event.eventId}`, payment.id);
    this.#paymentByProviderReference.set(`${event.provider}:${event.providerPaymentId}`, payment.id);
    if (input.cashierSessionId !== undefined) this.#incrementSessionExpectedCash(input.cashierSessionId, payment.amountMinor);
    return payment;
  }

  allocatePayment(input: {
    paymentId: string;
    invoiceId: string;
    amountMinor: number;
    principal: FinancePrincipal;
    periodId: string;
    idempotencyKey: string;
    correlationId: string;
  }): PaymentAllocation {
    authorizeFinance(input.principal, 'billing.allocation.write', this.#scope);
    const existingId = this.#allocationIdempotency.get(input.idempotencyKey);
    if (existingId) return this.#allocations.get(existingId)!;
    const payment = this.#requirePayment(input.paymentId);
    const invoice = this.#requireInvoice(input.invoiceId);
    if (payment.billingAccountId !== invoice.billingAccountId || payment.currency !== invoice.currency) throw new Error('FIN_ALLOCATION_SCOPE_MISMATCH');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > payment.unappliedMinor || input.amountMinor > invoice.balanceMinor) {
      throw new Error('FIN_ALLOCATION_EXCEEDS_AVAILABLE');
    }
    const journal = this.#ledger.post({
      tenantId: payment.tenantId,
      legalEntityId: payment.legalEntityId,
      bookId: this.#config.bookId,
      periodId: input.periodId,
      entryDate: this.#clock.now().toISOString().slice(0, 10),
      description: `Allocate ${payment.receiptNumber} to ${invoice.invoiceNumber}`,
      sourceDocumentType: 'payment-allocation',
      sourceDocumentId: `${payment.id}:${invoice.id}`,
      createdBy: input.principal.principalId,
      postedBy: this.#asSystemPoster(input.principal, `allocation-poster:${input.principal.principalId}`),
      idempotencyKey: `allocation:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      lines: [
        { accountId: this.#config.unappliedCashAccountId, side: 'debit', amountMinor: input.amountMinor, currency: payment.currency },
        { accountId: this.#config.receivableAccountId, side: 'credit', amountMinor: input.amountMinor, currency: payment.currency },
      ],
    });
    this.#billing.applyAllocation(invoice.id, input.amountMinor, input.principal);
    const allocation: PaymentAllocation = Object.freeze({
      id: crypto.randomUUID(),
      paymentId: payment.id,
      invoiceId: invoice.id,
      amountMinor: minorUnit(input.amountMinor),
      allocatedAt: this.#clock.now().toISOString(),
      allocatedBy: input.principal.principalId,
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      journalEntryId: journal.id,
      reversalJournalEntryId: null,
      idempotencyKey: input.idempotencyKey,
    });
    this.#allocations.set(allocation.id, allocation);
    this.#allocationIdempotency.set(input.idempotencyKey, allocation.id);
    this.#payments.set(payment.id, Object.freeze({
      ...payment,
      allocatedMinor: minorUnit(payment.allocatedMinor + input.amountMinor),
      unappliedMinor: minorUnit(payment.unappliedMinor - input.amountMinor),
    }));
    return allocation;
  }

  reverseAllocation(input: {
    allocationId: string;
    amountMinor: number;
    reason: string;
    principal: FinancePrincipal;
    periodId: string;
    idempotencyKey: string;
    correlationId: string;
  }): PaymentAllocation {
    authorizeFinance(input.principal, 'billing.allocation.unallocate', this.#scope);
    const allocation = this.#requireAllocation(input.allocationId);
    if (allocation.reversedAt !== null) return allocation;
    if (input.reason.trim().length < 8) throw new Error('FIN_UNALLOCATION_REASON_REQUIRED');
    if (input.amountMinor !== allocation.amountMinor) throw new Error('FIN_PARTIAL_UNALLOCATION_NOT_SUPPORTED');
    const payment = this.#requirePayment(allocation.paymentId);
    const invoice = this.#requireInvoice(allocation.invoiceId);
    const journal = this.#ledger.post({
      tenantId: payment.tenantId,
      legalEntityId: payment.legalEntityId,
      bookId: this.#config.bookId,
      periodId: input.periodId,
      entryDate: this.#clock.now().toISOString().slice(0, 10),
      description: `Unallocate ${payment.receiptNumber} from ${invoice.invoiceNumber}`,
      sourceDocumentType: 'allocation-reversal',
      sourceDocumentId: allocation.id,
      createdBy: input.principal.principalId,
      postedBy: this.#asSystemPoster(input.principal, `unallocation-poster:${input.principal.principalId}`),
      idempotencyKey: `unallocation:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      lines: [
        { accountId: this.#config.receivableAccountId, side: 'debit', amountMinor: allocation.amountMinor, currency: payment.currency },
        { accountId: this.#config.unappliedCashAccountId, side: 'credit', amountMinor: allocation.amountMinor, currency: payment.currency },
      ],
    });
    this.#billing.reverseAllocation(invoice.id, allocation.amountMinor, input.principal);
    const reversed = Object.freeze({
      ...allocation,
      reversedAt: this.#clock.now().toISOString(),
      reversedBy: input.principal.principalId,
      reversalReason: input.reason.trim(),
      reversalJournalEntryId: journal.id,
    });
    this.#allocations.set(reversed.id, reversed);
    this.#payments.set(payment.id, Object.freeze({
      ...payment,
      allocatedMinor: minorUnit(payment.allocatedMinor - allocation.amountMinor),
      unappliedMinor: minorUnit(payment.unappliedMinor + allocation.amountMinor),
    }));
    return reversed;
  }

  requestRefund(input: {
    paymentId: string;
    amountMinor: number;
    reason: string;
    requestedBy: FinancePrincipal;
    idempotencyKey: string;
  }): RefundRecord {
    authorizeFinance(input.requestedBy, 'billing.refund.write', this.#scope);
    const existingId = this.#refundIdempotency.get(input.idempotencyKey);
    if (existingId) return this.#refunds.get(existingId)!;
    const payment = this.#requirePayment(input.paymentId);
    const refundable = payment.amountMinor - payment.refundedMinor;
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > refundable) throw new Error('FIN_REFUND_EXCEEDS_AVAILABLE');
    if (input.reason.trim().length < 8) throw new Error('FIN_REFUND_REASON_REQUIRED');
    const refund: RefundRecord = Object.freeze({
      id: crypto.randomUUID(),
      refundNumber: this.#nextRefundNumber(),
      paymentId: payment.id,
      amountMinor: minorUnit(input.amountMinor),
      currency: payment.currency,
      reason: input.reason.trim(),
      status: 'pending-approval',
      requestedBy: input.requestedBy.principalId,
      requestedAt: this.#clock.now().toISOString(),
      approvedBy: null,
      approvedAt: null,
      settledAt: null,
      journalEntryId: null,
      idempotencyKey: input.idempotencyKey,
    });
    this.#refunds.set(refund.id, refund);
    this.#refundIdempotency.set(input.idempotencyKey, refund.id);
    return refund;
  }

  approveAndSettleRefund(input: {
    refundId: string;
    approvedBy: FinancePrincipal;
    periodId: string;
    correlationId: string;
  }): RefundRecord {
    const refund = this.#requireRefund(input.refundId);
    if (refund.status === 'settled') return refund;
    authorizeFinance(input.approvedBy, 'billing.refund.approve', this.#scope);
    const payment = this.#requirePayment(refund.paymentId);
    if (refund.requestedBy === input.approvedBy.principalId || payment.verifiedBy === input.approvedBy.principalId) throw new Error('FIN_SOD_VIOLATION:refund');
    if (refund.status !== 'pending-approval') throw new Error('FIN_INVALID_REFUND_STATE');
    if (refund.amountMinor > payment.unappliedMinor) throw new Error('FIN_REFUND_REQUIRES_UNALLOCATION');
    const journal = this.#ledger.post({
      tenantId: payment.tenantId,
      legalEntityId: payment.legalEntityId,
      bookId: this.#config.bookId,
      periodId: input.periodId,
      entryDate: this.#clock.now().toISOString().slice(0, 10),
      description: `Refund ${refund.refundNumber}`,
      sourceDocumentType: 'refund',
      sourceDocumentId: refund.id,
      createdBy: refund.requestedBy,
      postedBy: input.approvedBy,
      idempotencyKey: `refund:${refund.idempotencyKey}`,
      correlationId: input.correlationId,
      lines: [
        { accountId: this.#config.unappliedCashAccountId, side: 'debit', amountMinor: refund.amountMinor, currency: payment.currency },
        { accountId: this.#config.cashAccountId, side: 'credit', amountMinor: refund.amountMinor, currency: payment.currency },
      ],
    });
    const settled = Object.freeze({
      ...refund,
      status: 'settled' as const,
      approvedBy: input.approvedBy.principalId,
      approvedAt: this.#clock.now().toISOString(),
      settledAt: this.#clock.now().toISOString(),
      journalEntryId: journal.id,
    });
    this.#refunds.set(settled.id, settled);
    const refunded = payment.refundedMinor + refund.amountMinor;
    const status: PaymentStatus = refunded === payment.amountMinor ? 'refunded' : 'partially-refunded';
    this.#payments.set(payment.id, Object.freeze({
      ...payment,
      status,
      refundedMinor: minorUnit(refunded),
      unappliedMinor: minorUnit(payment.unappliedMinor - refund.amountMinor),
    }));
    return settled;
  }

  reversePayment(paymentId: string, principal: FinancePrincipal, periodId: string, reason: string, idempotencyKey: string, correlationId: string): PaymentRecord {
    const payment = this.#requirePayment(paymentId);
    authorizeFinance(principal, 'billing.payment.verify', this.#scope);
    if (payment.status === 'reversed') return payment;
    if (payment.allocatedMinor > 0 || payment.refundedMinor > 0) throw new Error('FIN_PAYMENT_REVERSAL_REQUIRES_CLEAR_BALANCE');
    if (reason.trim().length < 8) throw new Error('FIN_REVERSAL_REASON_REQUIRED');
    this.#ledger.post({
      tenantId: payment.tenantId,
      legalEntityId: payment.legalEntityId,
      bookId: this.#config.bookId,
      periodId,
      entryDate: this.#clock.now().toISOString().slice(0, 10),
      description: `Payment reversal ${payment.receiptNumber}`,
      sourceDocumentType: 'payment-reversal',
      sourceDocumentId: payment.id,
      createdBy: `system:payment-reversal:${payment.id}`,
      postedBy: principal,
      idempotencyKey,
      correlationId,
      lines: [
        { accountId: this.#config.unappliedCashAccountId, side: 'debit', amountMinor: payment.unappliedMinor, currency: payment.currency },
        { accountId: this.#config.cashAccountId, side: 'credit', amountMinor: payment.unappliedMinor, currency: payment.currency },
      ],
    });
    const reversed = Object.freeze({ ...payment, status: 'reversed' as const, unappliedMinor: minorUnit(0) });
    this.#payments.set(payment.id, reversed);
    return reversed;
  }

  openCashierSession(input: {
    cashierId: string;
    openingFloatMinor: number;
    currency: CurrencyCode;
    openedBy: FinancePrincipal;
  }): CashierSession {
    authorizeFinance(input.openedBy, 'cashier.session.open', this.#scope);
    if (!Number.isSafeInteger(input.openingFloatMinor) || input.openingFloatMinor < 0) throw new Error('FIN_INVALID_AMOUNT');
    if ([...this.#cashierSessions.values()].some((session) => session.cashierId === input.cashierId && session.status === 'open')) throw new Error('FIN_CASHIER_SESSION_ALREADY_OPEN');
    const session: CashierSession = Object.freeze({
      id: crypto.randomUUID(),
      tenantId: this.#scope.tenantId,
      legalEntityId: this.#scope.legalEntityId!,
      cashierId: input.cashierId,
      openedBy: input.openedBy.principalId,
      openedAt: this.#clock.now().toISOString(),
      openingFloatMinor: minorUnit(input.openingFloatMinor),
      currency: input.currency,
      status: 'open',
      expectedCashMinor: minorUnit(input.openingFloatMinor),
      countedCashMinor: null,
      varianceMinor: null,
      closedBy: null,
      closedAt: null,
      depositId: null,
    });
    this.#cashierSessions.set(session.id, session);
    return session;
  }

  closeCashierSession(input: { sessionId: string; countedCashMinor: number; closedBy: FinancePrincipal }): CashierSession {
    const session = this.#requireSession(input.sessionId);
    authorizeFinance(input.closedBy, 'cashier.session.close', this.#scope);
    if (session.status !== 'open') throw new Error('FIN_INVALID_CASHIER_SESSION_STATE');
    if (!Number.isSafeInteger(input.countedCashMinor) || input.countedCashMinor < 0) throw new Error('FIN_INVALID_AMOUNT');
    const closed = Object.freeze({
      ...session,
      status: 'closed' as const,
      countedCashMinor: minorUnit(input.countedCashMinor),
      varianceMinor: minorUnit(input.countedCashMinor - session.expectedCashMinor),
      closedBy: input.closedBy.principalId,
      closedAt: this.#clock.now().toISOString(),
    });
    this.#cashierSessions.set(closed.id, closed);
    return closed;
  }

  prepareCashierDeposit(sessionId: string, preparedBy: FinancePrincipal): CashierDeposit {
    const session = this.#requireSession(sessionId);
    if (session.status !== 'closed' || session.countedCashMinor === null || session.depositId !== null) throw new Error('FIN_INVALID_CASHIER_SESSION_STATE');
    authorizeFinance(preparedBy, 'cashier.session.close', this.#scope);
    const deposit: CashierDeposit = Object.freeze({
      id: crypto.randomUUID(),
      sessionId: session.id,
      amountMinor: session.countedCashMinor,
      currency: session.currency,
      preparedBy: preparedBy.principalId,
      preparedAt: this.#clock.now().toISOString(),
      approvedBy: null,
      approvedAt: null,
      journalEntryId: null,
    });
    this.#deposits.set(deposit.id, deposit);
    this.#cashierSessions.set(session.id, Object.freeze({ ...session, depositId: deposit.id }));
    return deposit;
  }

  approveCashierDeposit(input: {
    depositId: string;
    approvedBy: FinancePrincipal;
    periodId: string;
    correlationId: string;
  }): CashierDeposit {
    const deposit = this.#requireDeposit(input.depositId);
    if (deposit.approvedAt !== null) return deposit;
    authorizeFinance(input.approvedBy, 'cashier.deposit.approve', this.#scope);
    if (deposit.preparedBy === input.approvedBy.principalId) throw new Error('FIN_SOD_VIOLATION:cashier-deposit');
    const session = this.#requireSession(deposit.sessionId);
    const journal = this.#ledger.post({
      tenantId: session.tenantId,
      legalEntityId: session.legalEntityId,
      bookId: this.#config.bookId,
      periodId: input.periodId,
      entryDate: this.#clock.now().toISOString().slice(0, 10),
      description: `Cashier deposit ${deposit.id}`,
      sourceDocumentType: 'cashier-deposit',
      sourceDocumentId: deposit.id,
      createdBy: deposit.preparedBy,
      postedBy: input.approvedBy,
      idempotencyKey: `cashier-deposit:${deposit.id}`,
      correlationId: input.correlationId,
      lines: [
        { accountId: this.#config.bankDepositAccountId, side: 'debit', amountMinor: deposit.amountMinor, currency: deposit.currency },
        { accountId: this.#config.cashAccountId, side: 'credit', amountMinor: deposit.amountMinor, currency: deposit.currency },
      ],
    });
    const approved = Object.freeze({
      ...deposit,
      approvedBy: input.approvedBy.principalId,
      approvedAt: this.#clock.now().toISOString(),
      journalEntryId: journal.id,
    });
    this.#deposits.set(approved.id, approved);
    this.#cashierSessions.set(session.id, Object.freeze({ ...session, status: 'deposited' as const }));
    return approved;
  }

  importBankStatementLines(input: {
    bankAccountRef: string;
    statementRef: string;
    currency: CurrencyCode;
    lines: readonly { lineNumber: number; bookingDate: string; amountMinor: number; description: string; externalReference?: string }[];
    principal: FinancePrincipal;
  }): readonly BankStatementLine[] {
    authorizeFinance(input.principal, 'ledger.reconciliation.write', this.#scope);
    assertIdentifier(input.bankAccountRef, 'bankAccountRef');
    assertIdentifier(input.statementRef, 'statementRef');
    const imported: BankStatementLine[] = [];
    for (const line of input.lines) {
      if (!Number.isInteger(line.lineNumber) || line.lineNumber <= 0 || !Number.isSafeInteger(line.amountMinor) || line.amountMinor === 0) throw new Error('FIN_INVALID_BANK_LINE');
      assertDateTime(`${line.bookingDate}T00:00:00.000Z`, 'bookingDate');
      const hash = createHmac('sha256', `${this.#scope.tenantId}:${this.#scope.legalEntityId}`)
        .update(`${input.bankAccountRef}|${input.statementRef}|${line.lineNumber}|${line.bookingDate}|${line.amountMinor}|${line.description}|${line.externalReference ?? ''}`)
        .digest('hex');
      const existingId = this.#statementImportHashes.get(hash);
      if (existingId) { imported.push(this.#statementLines.get(existingId)!); continue; }
      const record: BankStatementLine = Object.freeze({
        id: crypto.randomUUID(),
        tenantId: this.#scope.tenantId,
        legalEntityId: this.#scope.legalEntityId!,
        bankAccountRef: input.bankAccountRef,
        statementRef: input.statementRef,
        lineNumber: line.lineNumber,
        bookingDate: line.bookingDate,
        amountMinor: minorUnit(line.amountMinor),
        currency: input.currency,
        description: line.description.trim(),
        externalReference: line.externalReference?.trim() || null,
        importHash: hash,
        status: 'unmatched',
        matchedPaymentId: null,
        matchedBy: null,
        matchedAt: null,
      });
      this.#statementLines.set(record.id, record);
      this.#statementImportHashes.set(hash, record.id);
      imported.push(record);
    }
    return frozenArray(imported);
  }

  matchBankLine(lineId: string, paymentId: string, principal: FinancePrincipal): BankStatementLine {
    authorizeFinance(principal, 'ledger.reconciliation.write', this.#scope);
    const line = this.#statementLines.get(lineId);
    if (!line) throw new Error('FIN_NOT_FOUND:bank-statement-line');
    const payment = this.#requirePayment(paymentId);
    if (line.currency !== payment.currency || Math.abs(line.amountMinor) !== payment.amountMinor) throw new Error('FIN_RECONCILIATION_AMOUNT_MISMATCH');
    if (line.status !== 'unmatched') throw new Error('FIN_BANK_LINE_ALREADY_MATCHED');
    const matched = Object.freeze({
      ...line,
      status: 'matched' as const,
      matchedPaymentId: payment.id,
      matchedBy: principal.principalId,
      matchedAt: this.#clock.now().toISOString(),
    });
    this.#statementLines.set(matched.id, matched);
    return matched;
  }

  completeReconciliation(lineIds: readonly string[], principal: FinancePrincipal): readonly BankStatementLine[] {
    authorizeFinance(principal, 'ledger.reconciliation.approve', this.#scope);
    const lines = lineIds.map((id) => {
      const line = this.#statementLines.get(id);
      if (!line || line.status !== 'matched') throw new Error('FIN_RECONCILIATION_NOT_MATCHED');
      const reconciled = Object.freeze({ ...line, status: 'reconciled' as const });
      this.#statementLines.set(id, reconciled);
      return reconciled;
    });
    return frozenArray(lines);
  }

  getPayment(id: string): PaymentRecord | undefined { return this.#payments.get(id); }
  getAllocation(id: string): PaymentAllocation | undefined { return this.#allocations.get(id); }
  getRefund(id: string): RefundRecord | undefined { return this.#refunds.get(id); }
  listPayments(): readonly PaymentRecord[] { return frozenArray([...this.#payments.values()]); }
  listAllocations(): readonly PaymentAllocation[] { return frozenArray([...this.#allocations.values()]); }
  listRefunds(): readonly RefundRecord[] { return frozenArray([...this.#refunds.values()]); }
  listCashierSessions(): readonly CashierSession[] { return frozenArray([...this.#cashierSessions.values()]); }
  listBankStatementLines(): readonly BankStatementLine[] { return frozenArray([...this.#statementLines.values()]); }

  #asSystemPoster(principal: FinancePrincipal, principalId: string): FinancePrincipal {
    return Object.freeze({
      principalId,
      permissions: frozenArray([...new Set([...principal.permissions, 'ledger.journal.post' as const])]),
      assurance: principal.assurance === 'aal1' ? 'aal2' : principal.assurance,
      scope: principal.scope,
    });
  }

  #incrementSessionExpectedCash(sessionId: string, amount: number): void {
    const session = this.#requireSession(sessionId);
    this.#cashierSessions.set(session.id, Object.freeze({ ...session, expectedCashMinor: minorUnit(session.expectedCashMinor + amount) }));
  }

  #nextReceiptNumber(): string { this.#receiptSequence += 1; return `RCT-${String(this.#receiptSequence).padStart(6, '0')}`; }
  #nextRefundNumber(): string { this.#refundSequence += 1; return `RF-${String(this.#refundSequence).padStart(6, '0')}`; }

  #requireIntent(id: string): PaymentIntent {
    const value = this.#intents.get(id); if (!value) throw new Error('FIN_NOT_FOUND:payment-intent'); return value;
  }
  #requirePayment(id: string): PaymentRecord {
    const value = this.#payments.get(id); if (!value) throw new Error('FIN_NOT_FOUND:payment'); return value;
  }
  #requireAllocation(id: string): PaymentAllocation {
    const value = this.#allocations.get(id); if (!value) throw new Error('FIN_NOT_FOUND:allocation'); return value;
  }
  #requireRefund(id: string): RefundRecord {
    const value = this.#refunds.get(id); if (!value) throw new Error('FIN_NOT_FOUND:refund'); return value;
  }
  #requireSession(id: string): CashierSession {
    const value = this.#cashierSessions.get(id); if (!value) throw new Error('FIN_NOT_FOUND:cashier-session'); return value;
  }
  #requireDeposit(id: string): CashierDeposit {
    const value = this.#deposits.get(id); if (!value) throw new Error('FIN_NOT_FOUND:cashier-deposit'); return value;
  }
  #requireInvoice(id: string): Invoice {
    const value = this.#billing.getInvoice(id); if (!value) throw new Error('FIN_NOT_FOUND:invoice'); return value;
  }
}
