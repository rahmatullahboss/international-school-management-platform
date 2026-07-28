import {
  authorizeFinance,
  type FinancePrincipal,
  type FinanceScope,
} from './contracts/permissions.js';
import {
  minorUnit,
  type CurrencyCode,
  type MinorUnit,
} from './contracts/money.js';
import type { LedgerService, PostedJournal } from '../../ledger/src/ledger-service.js';

export type BillingAccountStatus = 'active' | 'suspended' | 'closed';
export type InvoiceStatus = 'draft' | 'posted' | 'partially-paid' | 'paid' | 'credited' | 'voided';
export type CreditNoteStatus = 'draft' | 'posted' | 'voided';
export type AdjustmentKind = 'discount' | 'scholarship' | 'waiver';
export type FeeFrequency = 'one-time' | 'weekly' | 'monthly' | 'termly' | 'annually';

export interface ResponsibleParty {
  readonly personRef: string;
  readonly responsibilityBasisPoints: number;
  readonly priority: number;
}

export interface BillingAccount {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly accountHolderRef: string;
  readonly currency: CurrencyCode;
  readonly status: BillingAccountStatus;
  readonly responsibleParties: readonly ResponsibleParty[];
  readonly createdAt: string;
}

export interface FeeItem {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly incomeAccountId: string;
  readonly taxBasisPoints: number;
  readonly taxAccountId: string | null;
  readonly active: boolean;
}

export interface FeeSchedule {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly feeItemId: string;
  readonly frequency: FeeFrequency;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly dueDays: number;
  readonly active: boolean;
}

export interface FeeAssignmentAdjustment {
  readonly kind: AdjustmentKind;
  readonly basisPoints: number;
  readonly reason: string;
  readonly approvedBy: string;
}

export interface FeeAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly billingAccountId: string;
  readonly feeScheduleId: string;
  readonly quantity: number;
  readonly adjustments: readonly FeeAssignmentAdjustment[];
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly active: boolean;
}

export interface InvoiceLineInput {
  readonly feeItemId: string;
  readonly quantity: number;
  readonly description?: string;
  readonly adjustments?: readonly FeeAssignmentAdjustment[];
}

export interface InvoiceLine {
  readonly id: string;
  readonly invoiceId: string;
  readonly lineNumber: number;
  readonly feeItemId: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountMinor: MinorUnit;
  readonly grossMinor: MinorUnit;
  readonly discountMinor: MinorUnit;
  readonly scholarshipMinor: MinorUnit;
  readonly waiverMinor: MinorUnit;
  readonly taxableMinor: MinorUnit;
  readonly taxMinor: MinorUnit;
  readonly totalMinor: MinorUnit;
  readonly incomeAccountId: string;
  readonly taxAccountId: string | null;
}

export interface InvoiceInstalment {
  readonly id: string;
  readonly invoiceId: string;
  readonly sequence: number;
  readonly dueOn: string;
  readonly amountMinor: MinorUnit;
  readonly allocatedMinor: MinorUnit;
}

export interface Invoice {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly billingAccountId: string;
  readonly invoiceNumber: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly currency: CurrencyCode;
  readonly status: InvoiceStatus;
  readonly lines: readonly InvoiceLine[];
  readonly instalments: readonly InvoiceInstalment[];
  readonly subtotalMinor: MinorUnit;
  readonly adjustmentMinor: MinorUnit;
  readonly taxMinor: MinorUnit;
  readonly totalMinor: MinorUnit;
  readonly allocatedMinor: MinorUnit;
  readonly creditedMinor: MinorUnit;
  readonly balanceMinor: MinorUnit;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly postedBy: string | null;
  readonly postedAt: string | null;
  readonly journalEntryId: string | null;
  readonly idempotencyKey: string;
}

export interface CreditNoteLine {
  readonly id: string;
  readonly invoiceLineId: string;
  readonly amountMinor: MinorUnit;
  readonly taxMinor: MinorUnit;
  readonly incomeAccountId: string;
  readonly taxAccountId: string | null;
}

export interface CreditNote {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly invoiceId: string;
  readonly creditNoteNumber: string;
  readonly issueDate: string;
  readonly currency: CurrencyCode;
  readonly status: CreditNoteStatus;
  readonly reason: string;
  readonly lines: readonly CreditNoteLine[];
  readonly totalMinor: MinorUnit;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly postedBy: string | null;
  readonly postedAt: string | null;
  readonly journalEntryId: string | null;
  readonly idempotencyKey: string;
}

export interface BillingStatementEntry {
  readonly date: string;
  readonly type: 'invoice' | 'credit-note' | 'payment' | 'refund';
  readonly documentId: string;
  readonly documentNumber: string;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly runningBalanceMinor: number;
}

export interface BillingStatement {
  readonly billingAccountId: string;
  readonly currency: CurrencyCode;
  readonly asOf: string;
  readonly openingBalanceMinor: number;
  readonly closingBalanceMinor: number;
  readonly entries: readonly BillingStatementEntry[];
}

export interface BillingClock {
  now(): Date;
}

export interface BillingLedgerConfiguration {
  readonly bookId: string;
  readonly receivableAccountId: string;
}

export interface CreateInvoiceCommand {
  readonly billingAccountId: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly lines: readonly InvoiceLineInput[];
  readonly instalmentDueDates?: readonly string[];
  readonly createdBy: FinancePrincipal;
  readonly idempotencyKey: string;
}

export interface PostInvoiceCommand {
  readonly invoiceId: string;
  readonly periodId: string;
  readonly postedBy: FinancePrincipal;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface CreateCreditNoteCommand {
  readonly invoiceId: string;
  readonly issueDate: string;
  readonly reason: string;
  readonly lineCredits: readonly { invoiceLineId: string; amountMinor: number; taxMinor?: number }[];
  readonly createdBy: FinancePrincipal;
  readonly idempotencyKey: string;
}

export interface PostCreditNoteCommand {
  readonly creditNoteId: string;
  readonly periodId: string;
  readonly postedBy: FinancePrincipal;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

const systemClock: BillingClock = { now: () => new Date() };

function assertIdentifier(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 200) throw new Error(`FIN_INVALID_IDENTIFIER:${field}`);
}

function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`FIN_INVALID_DATE:${field}`);
  }
}

function roundRatioHalfEven(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('FIN_INVALID_ROUNDING_INPUT');
  }
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator % denominator;
  const doubled = Math.abs(remainder) * 2;
  const sign = numerator < 0 ? -1 : 1;
  if (doubled < denominator) return quotient;
  if (doubled > denominator) return quotient + sign;
  return Math.abs(quotient) % 2 === 0 ? quotient : quotient + sign;
}

function addDays(date: string, days: number): string {
  assertDate(date, 'date');
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function frozenArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export class BillingService {
  readonly #scope: FinanceScope;
  readonly #ledger: LedgerService;
  readonly #ledgerConfig: BillingLedgerConfiguration;
  readonly #clock: BillingClock;
  readonly #accounts = new Map<string, BillingAccount>();
  readonly #fees = new Map<string, FeeItem>();
  readonly #schedules = new Map<string, FeeSchedule>();
  readonly #assignments = new Map<string, FeeAssignment>();
  readonly #invoices = new Map<string, Invoice>();
  readonly #creditNotes = new Map<string, CreditNote>();
  readonly #invoiceIdempotency = new Map<string, string>();
  readonly #creditIdempotency = new Map<string, string>();
  readonly #invoiceSequenceByEntity = new Map<string, number>();
  readonly #creditSequenceByEntity = new Map<string, number>();

  constructor(scope: FinanceScope, ledger: LedgerService, ledgerConfig: BillingLedgerConfiguration, clock: BillingClock = systemClock) {
    assertIdentifier(scope.tenantId, 'tenantId');
    assertIdentifier(scope.legalEntityId ?? '', 'legalEntityId');
    assertIdentifier(ledgerConfig.bookId, 'bookId');
    assertIdentifier(ledgerConfig.receivableAccountId, 'receivableAccountId');
    this.#scope = Object.freeze({ ...scope });
    this.#ledger = ledger;
    this.#ledgerConfig = Object.freeze({ ...ledgerConfig });
    this.#clock = clock;
  }

  createBillingAccount(input: Omit<BillingAccount, 'createdAt'>, principal: FinancePrincipal): BillingAccount {
    this.#assertScope(input.tenantId, input.legalEntityId);
    authorizeFinance(principal, 'billing.account.write', this.#scope);
    if (this.#accounts.has(input.id)) throw new Error('FIN_DUPLICATE_BILLING_ACCOUNT');
    if (input.responsibleParties.length === 0) throw new Error('FIN_RESPONSIBLE_PARTY_REQUIRED');
    const totalBasisPoints = input.responsibleParties.reduce((sum, party) => {
      if (!Number.isInteger(party.responsibilityBasisPoints) || party.responsibilityBasisPoints <= 0) throw new Error('FIN_INVALID_RESPONSIBILITY');
      assertIdentifier(party.personRef, 'responsibleParty.personRef');
      return sum + party.responsibilityBasisPoints;
    }, 0);
    if (totalBasisPoints !== 10_000) throw new Error('FIN_RESPONSIBILITY_MUST_TOTAL_100_PERCENT');
    const account = Object.freeze({
      ...input,
      responsibleParties: frozenArray(input.responsibleParties.map((party) => Object.freeze({ ...party }))),
      createdAt: this.#clock.now().toISOString(),
    });
    this.#accounts.set(account.id, account);
    return account;
  }

  registerFeeItem(item: FeeItem, principal: FinancePrincipal): FeeItem {
    this.#assertScope(item.tenantId, item.legalEntityId);
    authorizeFinance(principal, 'billing.fee.write', this.#scope);
    if (this.#fees.has(item.id) || [...this.#fees.values()].some((existing) => existing.code === item.code)) throw new Error('FIN_DUPLICATE_FEE');
    if (item.amountMinor <= 0 || !Number.isSafeInteger(item.amountMinor)) throw new Error('FIN_INVALID_AMOUNT');
    if (!Number.isInteger(item.taxBasisPoints) || item.taxBasisPoints < 0 || item.taxBasisPoints > 10_000) throw new Error('FIN_INVALID_TAX_RATE');
    if (item.taxBasisPoints > 0 && item.taxAccountId === null) throw new Error('FIN_TAX_ACCOUNT_REQUIRED');
    const stored = Object.freeze({ ...item, code: item.code.trim().toUpperCase() });
    this.#fees.set(stored.id, stored);
    return stored;
  }

  createFeeSchedule(schedule: FeeSchedule, principal: FinancePrincipal): FeeSchedule {
    this.#assertScope(schedule.tenantId, schedule.legalEntityId);
    authorizeFinance(principal, 'billing.fee.write', this.#scope);
    if (!this.#fees.has(schedule.feeItemId)) throw new Error('FIN_NOT_FOUND:fee');
    assertDate(schedule.startsOn, 'startsOn');
    if (schedule.endsOn !== null) {
      assertDate(schedule.endsOn, 'endsOn');
      if (schedule.endsOn < schedule.startsOn) throw new Error('FIN_INVALID_DATE_RANGE');
    }
    if (!Number.isInteger(schedule.dueDays) || schedule.dueDays < 0 || schedule.dueDays > 365) throw new Error('FIN_INVALID_DUE_DAYS');
    if (this.#schedules.has(schedule.id)) throw new Error('FIN_DUPLICATE_FEE_SCHEDULE');
    const stored = Object.freeze({ ...schedule });
    this.#schedules.set(stored.id, stored);
    return stored;
  }

  assignFee(assignment: FeeAssignment, principal: FinancePrincipal): FeeAssignment {
    this.#assertScope(assignment.tenantId, assignment.legalEntityId);
    authorizeFinance(principal, 'billing.fee.write', this.#scope);
    if (!this.#accounts.has(assignment.billingAccountId)) throw new Error('FIN_NOT_FOUND:billing-account');
    if (!this.#schedules.has(assignment.feeScheduleId)) throw new Error('FIN_NOT_FOUND:fee-schedule');
    if (!Number.isSafeInteger(assignment.quantity) || assignment.quantity <= 0) throw new Error('FIN_INVALID_QUANTITY');
    this.#validateAdjustments(assignment.adjustments);
    if (this.#assignments.has(assignment.id)) throw new Error('FIN_DUPLICATE_FEE_ASSIGNMENT');
    const stored = Object.freeze({
      ...assignment,
      adjustments: frozenArray(assignment.adjustments.map((adjustment) => Object.freeze({ ...adjustment }))),
    });
    this.#assignments.set(stored.id, stored);
    return stored;
  }

  createInvoice(command: CreateInvoiceCommand): Invoice {
    authorizeFinance(command.createdBy, 'billing.invoice.write', this.#scope);
    const existingId = this.#invoiceIdempotency.get(command.idempotencyKey);
    if (existingId) return this.#invoices.get(existingId)!;
    const account = this.#requireAccount(command.billingAccountId);
    if (account.status !== 'active') throw new Error('FIN_BILLING_ACCOUNT_INACTIVE');
    assertDate(command.issueDate, 'issueDate');
    assertDate(command.dueDate, 'dueDate');
    if (command.dueDate < command.issueDate) throw new Error('FIN_DUE_DATE_BEFORE_ISSUE_DATE');
    if (command.lines.length === 0) throw new Error('FIN_INVOICE_LINE_REQUIRED');
    assertIdentifier(command.idempotencyKey, 'idempotencyKey');
    const id = crypto.randomUUID();
    const lines = command.lines.map((line, index) => this.#buildInvoiceLine(id, index + 1, account.currency, line));
    const subtotal = lines.reduce((sum, line) => sum + line.grossMinor, 0);
    const adjustment = lines.reduce((sum, line) => sum + line.discountMinor + line.scholarshipMinor + line.waiverMinor, 0);
    const tax = lines.reduce((sum, line) => sum + line.taxMinor, 0);
    const total = lines.reduce((sum, line) => sum + line.totalMinor, 0);
    if (total <= 0) throw new Error('FIN_INVOICE_TOTAL_MUST_BE_POSITIVE');
    const instalments = this.#buildInstalments(id, total, command.instalmentDueDates ?? [command.dueDate]);
    const invoice: Invoice = Object.freeze({
      id,
      tenantId: this.#scope.tenantId,
      legalEntityId: this.#scope.legalEntityId!,
      billingAccountId: account.id,
      invoiceNumber: this.#nextNumber('invoice'),
      issueDate: command.issueDate,
      dueDate: command.dueDate,
      currency: account.currency,
      status: 'draft',
      lines: frozenArray(lines),
      instalments: frozenArray(instalments),
      subtotalMinor: minorUnit(subtotal),
      adjustmentMinor: minorUnit(adjustment),
      taxMinor: minorUnit(tax),
      totalMinor: minorUnit(total),
      allocatedMinor: minorUnit(0),
      creditedMinor: minorUnit(0),
      balanceMinor: minorUnit(total),
      createdBy: command.createdBy.principalId,
      createdAt: this.#clock.now().toISOString(),
      postedBy: null,
      postedAt: null,
      journalEntryId: null,
      idempotencyKey: command.idempotencyKey,
    });
    this.#invoices.set(id, invoice);
    this.#invoiceIdempotency.set(command.idempotencyKey, id);
    return invoice;
  }

  createInvoiceFromAssignment(assignmentId: string, issueDate: string, createdBy: FinancePrincipal, idempotencyKey: string): Invoice {
    const assignment = this.#assignments.get(assignmentId);
    if (!assignment || !assignment.active) throw new Error('FIN_NOT_FOUND:fee-assignment');
    const schedule = this.#schedules.get(assignment.feeScheduleId)!;
    return this.createInvoice({
      billingAccountId: assignment.billingAccountId,
      issueDate,
      dueDate: addDays(issueDate, schedule.dueDays),
      lines: [{
        feeItemId: schedule.feeItemId,
        quantity: assignment.quantity,
        adjustments: assignment.adjustments,
      }],
      createdBy,
      idempotencyKey,
    });
  }

  postInvoice(command: PostInvoiceCommand): Invoice {
    const invoice = this.#requireInvoice(command.invoiceId);
    if (invoice.status === 'posted' || invoice.status === 'partially-paid' || invoice.status === 'paid' || invoice.status === 'credited') return invoice;
    authorizeFinance(command.postedBy, 'billing.invoice.post', this.#scope);
    if (invoice.createdBy === command.postedBy.principalId) throw new Error('FIN_SOD_VIOLATION:invoice-create-post');
    if (invoice.status !== 'draft') throw new Error('FIN_INVALID_INVOICE_STATE');
    const creditLines = new Map<string, number>();
    const taxLines = new Map<string, number>();
    for (const line of invoice.lines) {
      creditLines.set(line.incomeAccountId, (creditLines.get(line.incomeAccountId) ?? 0) + line.taxableMinor);
      if (line.taxMinor > 0 && line.taxAccountId !== null) taxLines.set(line.taxAccountId, (taxLines.get(line.taxAccountId) ?? 0) + line.taxMinor);
    }
    const journal = this.#ledger.post({
      tenantId: invoice.tenantId,
      legalEntityId: invoice.legalEntityId,
      bookId: this.#ledgerConfig.bookId,
      periodId: command.periodId,
      entryDate: invoice.issueDate,
      description: `Invoice ${invoice.invoiceNumber}`,
      sourceDocumentType: 'invoice',
      sourceDocumentId: invoice.id,
      createdBy: invoice.createdBy,
      postedBy: command.postedBy,
      idempotencyKey: `invoice:${command.idempotencyKey}`,
      correlationId: command.correlationId,
      lines: [
        { accountId: this.#ledgerConfig.receivableAccountId, side: 'debit', amountMinor: invoice.totalMinor, currency: invoice.currency },
        ...[...creditLines.entries()].map(([accountId, amountMinor]) => ({ accountId, side: 'credit' as const, amountMinor, currency: invoice.currency })),
        ...[...taxLines.entries()].map(([accountId, amountMinor]) => ({ accountId, side: 'credit' as const, amountMinor, currency: invoice.currency })),
      ],
    });
    const posted = Object.freeze({
      ...invoice,
      status: 'posted' as const,
      postedBy: command.postedBy.principalId,
      postedAt: this.#clock.now().toISOString(),
      journalEntryId: journal.id,
    });
    this.#invoices.set(posted.id, posted);
    return posted;
  }

  voidDraftInvoice(invoiceId: string, principal: FinancePrincipal): Invoice {
    const invoice = this.#requireInvoice(invoiceId);
    authorizeFinance(principal, 'billing.invoice.void', this.#scope);
    if (invoice.status !== 'draft') throw new Error('FIN_POSTED_INVOICE_REQUIRES_CREDIT_NOTE');
    const voided = Object.freeze({ ...invoice, status: 'voided' as const });
    this.#invoices.set(voided.id, voided);
    return voided;
  }

  createCreditNote(command: CreateCreditNoteCommand): CreditNote {
    authorizeFinance(command.createdBy, 'billing.credit-note.write', this.#scope);
    const existingId = this.#creditIdempotency.get(command.idempotencyKey);
    if (existingId) return this.#creditNotes.get(existingId)!;
    const invoice = this.#requireInvoice(command.invoiceId);
    if (!['posted', 'partially-paid', 'paid', 'credited'].includes(invoice.status)) throw new Error('FIN_INVOICE_NOT_POSTED');
    assertDate(command.issueDate, 'issueDate');
    if (command.reason.trim().length < 5) throw new Error('FIN_CREDIT_REASON_REQUIRED');
    if (command.lineCredits.length === 0) throw new Error('FIN_CREDIT_LINE_REQUIRED');
    const priorCredits = [...this.#creditNotes.values()].filter((credit) => credit.invoiceId === invoice.id && credit.status === 'posted');
    const creditedByLine = new Map<string, { net: number; tax: number }>();
    for (const credit of priorCredits) {
      for (const line of credit.lines) {
        const current = creditedByLine.get(line.invoiceLineId) ?? { net: 0, tax: 0 };
        current.net += line.amountMinor;
        current.tax += line.taxMinor;
        creditedByLine.set(line.invoiceLineId, current);
      }
    }
    const id = crypto.randomUUID();
    const lines = command.lineCredits.map((requested) => {
      const invoiceLine = invoice.lines.find((line) => line.id === requested.invoiceLineId);
      if (!invoiceLine) throw new Error('FIN_NOT_FOUND:invoice-line');
      const prior = creditedByLine.get(invoiceLine.id) ?? { net: 0, tax: 0 };
      const taxMinor = requested.taxMinor ?? 0;
      if (!Number.isSafeInteger(requested.amountMinor) || requested.amountMinor <= 0 || !Number.isSafeInteger(taxMinor) || taxMinor < 0) throw new Error('FIN_INVALID_AMOUNT');
      if (prior.net + requested.amountMinor > invoiceLine.taxableMinor || prior.tax + taxMinor > invoiceLine.taxMinor) throw new Error('FIN_CREDIT_EXCEEDS_LINE');
      return Object.freeze({
        id: crypto.randomUUID(),
        invoiceLineId: invoiceLine.id,
        amountMinor: minorUnit(requested.amountMinor),
        taxMinor: minorUnit(taxMinor),
        incomeAccountId: invoiceLine.incomeAccountId,
        taxAccountId: invoiceLine.taxAccountId,
      });
    });
    const total = lines.reduce((sum, line) => sum + line.amountMinor + line.taxMinor, 0);
    if (total > invoice.balanceMinor) throw new Error('FIN_CREDIT_EXCEEDS_BALANCE');
    const credit: CreditNote = Object.freeze({
      id,
      tenantId: invoice.tenantId,
      legalEntityId: invoice.legalEntityId,
      invoiceId: invoice.id,
      creditNoteNumber: this.#nextNumber('credit-note'),
      issueDate: command.issueDate,
      currency: invoice.currency,
      status: 'draft',
      reason: command.reason.trim(),
      lines: frozenArray(lines),
      totalMinor: minorUnit(total),
      createdBy: command.createdBy.principalId,
      createdAt: this.#clock.now().toISOString(),
      postedBy: null,
      postedAt: null,
      journalEntryId: null,
      idempotencyKey: command.idempotencyKey,
    });
    this.#creditNotes.set(id, credit);
    this.#creditIdempotency.set(command.idempotencyKey, id);
    return credit;
  }

  postCreditNote(command: PostCreditNoteCommand): CreditNote {
    const credit = this.#requireCredit(command.creditNoteId);
    if (credit.status === 'posted') return credit;
    authorizeFinance(command.postedBy, 'billing.credit-note.post', this.#scope);
    if (credit.createdBy === command.postedBy.principalId) throw new Error('FIN_SOD_VIOLATION:credit-create-post');
    if (credit.status !== 'draft') throw new Error('FIN_INVALID_CREDIT_STATE');
    const invoice = this.#requireInvoice(credit.invoiceId);
    const debitLines = new Map<string, number>();
    const taxLines = new Map<string, number>();
    for (const line of credit.lines) {
      debitLines.set(line.incomeAccountId, (debitLines.get(line.incomeAccountId) ?? 0) + line.amountMinor);
      if (line.taxMinor > 0 && line.taxAccountId !== null) taxLines.set(line.taxAccountId, (taxLines.get(line.taxAccountId) ?? 0) + line.taxMinor);
    }
    const journal: PostedJournal = this.#ledger.post({
      tenantId: credit.tenantId,
      legalEntityId: credit.legalEntityId,
      bookId: this.#ledgerConfig.bookId,
      periodId: command.periodId,
      entryDate: credit.issueDate,
      description: `Credit note ${credit.creditNoteNumber}`,
      sourceDocumentType: 'credit-note',
      sourceDocumentId: credit.id,
      createdBy: credit.createdBy,
      postedBy: command.postedBy,
      idempotencyKey: `credit-note:${command.idempotencyKey}`,
      correlationId: command.correlationId,
      lines: [
        ...[...debitLines.entries()].map(([accountId, amountMinor]) => ({ accountId, side: 'debit' as const, amountMinor, currency: credit.currency })),
        ...[...taxLines.entries()].map(([accountId, amountMinor]) => ({ accountId, side: 'debit' as const, amountMinor, currency: credit.currency })),
        { accountId: this.#ledgerConfig.receivableAccountId, side: 'credit', amountMinor: credit.totalMinor, currency: credit.currency },
      ],
    });
    const posted = Object.freeze({
      ...credit,
      status: 'posted' as const,
      postedBy: command.postedBy.principalId,
      postedAt: this.#clock.now().toISOString(),
      journalEntryId: journal.id,
    });
    this.#creditNotes.set(posted.id, posted);
    const credited = invoice.creditedMinor + posted.totalMinor;
    const balance = invoice.totalMinor - invoice.allocatedMinor - credited;
    const nextInvoice = Object.freeze({
      ...invoice,
      creditedMinor: minorUnit(credited),
      balanceMinor: minorUnit(balance),
      status: balance === 0 ? 'credited' as const : invoice.status,
    });
    this.#invoices.set(invoice.id, nextInvoice);
    return posted;
  }

  applyAllocation(invoiceId: string, amountMinor: number, principal: FinancePrincipal): Invoice {
    const invoice = this.#requireInvoice(invoiceId);
    authorizeFinance(principal, 'billing.allocation.write', this.#scope);
    if (!['posted', 'partially-paid'].includes(invoice.status)) throw new Error('FIN_INVALID_INVOICE_STATE');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > invoice.balanceMinor) throw new Error('FIN_ALLOCATION_EXCEEDS_BALANCE');
    const allocated = invoice.allocatedMinor + amountMinor;
    const balance = invoice.totalMinor - allocated - invoice.creditedMinor;
    const next = Object.freeze({
      ...invoice,
      allocatedMinor: minorUnit(allocated),
      balanceMinor: minorUnit(balance),
      status: balance === 0 ? 'paid' as const : 'partially-paid' as const,
      instalments: frozenArray(this.#allocateInstalments(invoice.instalments, amountMinor)),
    });
    this.#invoices.set(invoice.id, next);
    return next;
  }

  reverseAllocation(invoiceId: string, amountMinor: number, principal: FinancePrincipal): Invoice {
    const invoice = this.#requireInvoice(invoiceId);
    authorizeFinance(principal, 'billing.allocation.unallocate', this.#scope);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > invoice.allocatedMinor) throw new Error('FIN_INVALID_UNALLOCATION');
    const allocated = invoice.allocatedMinor - amountMinor;
    const balance = invoice.totalMinor - allocated - invoice.creditedMinor;
    const next = Object.freeze({
      ...invoice,
      allocatedMinor: minorUnit(allocated),
      balanceMinor: minorUnit(balance),
      status: allocated === 0 ? 'posted' as const : 'partially-paid' as const,
      instalments: frozenArray(this.#unallocateInstalments(invoice.instalments, amountMinor)),
    });
    this.#invoices.set(invoice.id, next);
    return next;
  }

  statement(billingAccountId: string, asOf: string): BillingStatement {
    const account = this.#requireAccount(billingAccountId);
    assertDate(asOf, 'asOf');
    const documents: { date: string; type: 'invoice' | 'credit-note'; id: string; number: string; debit: number; credit: number }[] = [];
    for (const invoice of this.#invoices.values()) {
      if (invoice.billingAccountId === billingAccountId && invoice.issueDate <= asOf && invoice.status !== 'draft' && invoice.status !== 'voided') {
        documents.push({ date: invoice.issueDate, type: 'invoice', id: invoice.id, number: invoice.invoiceNumber, debit: invoice.totalMinor, credit: 0 });
      }
    }
    for (const credit of this.#creditNotes.values()) {
      const invoice = this.#invoices.get(credit.invoiceId)!;
      if (invoice.billingAccountId === billingAccountId && credit.issueDate <= asOf && credit.status === 'posted') {
        documents.push({ date: credit.issueDate, type: 'credit-note', id: credit.id, number: credit.creditNoteNumber, debit: 0, credit: credit.totalMinor });
      }
    }
    documents.sort((left, right) => left.date.localeCompare(right.date) || left.type.localeCompare(right.type) || left.number.localeCompare(right.number));
    let runningBalance = 0;
    const entries = documents.map((document): BillingStatementEntry => {
      runningBalance += document.debit - document.credit;
      return Object.freeze({
        date: document.date,
        type: document.type,
        documentId: document.id,
        documentNumber: document.number,
        debitMinor: document.debit,
        creditMinor: document.credit,
        runningBalanceMinor: runningBalance,
      });
    });
    return Object.freeze({
      billingAccountId,
      currency: account.currency,
      asOf,
      openingBalanceMinor: 0,
      closingBalanceMinor: runningBalance,
      entries: frozenArray(entries),
    });
  }

  getInvoice(invoiceId: string): Invoice | undefined { return this.#invoices.get(invoiceId); }
  getCreditNote(creditNoteId: string): CreditNote | undefined { return this.#creditNotes.get(creditNoteId); }
  listInvoices(): readonly Invoice[] { return frozenArray([...this.#invoices.values()]); }
  listCreditNotes(): readonly CreditNote[] { return frozenArray([...this.#creditNotes.values()]); }
  listBillingAccounts(): readonly BillingAccount[] { return frozenArray([...this.#accounts.values()]); }
  listFeeItems(): readonly FeeItem[] { return frozenArray([...this.#fees.values()]); }
  listAssignments(): readonly FeeAssignment[] { return frozenArray([...this.#assignments.values()]); }

  #buildInvoiceLine(invoiceId: string, lineNumber: number, currency: CurrencyCode, input: InvoiceLineInput): InvoiceLine {
    const fee = this.#fees.get(input.feeItemId);
    if (!fee || !fee.active) throw new Error('FIN_NOT_FOUND:fee');
    if (fee.currency !== currency) throw new Error('FIN_CURRENCY_MISMATCH');
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error('FIN_INVALID_QUANTITY');
    const adjustments = input.adjustments ?? [];
    this.#validateAdjustments(adjustments);
    const gross = fee.amountMinor * input.quantity;
    if (!Number.isSafeInteger(gross)) throw new Error('FIN_AMOUNT_OVERFLOW');
    const totals: Record<AdjustmentKind, number> = { discount: 0, scholarship: 0, waiver: 0 };
    for (const adjustment of adjustments) {
      totals[adjustment.kind] += roundRatioHalfEven(gross * adjustment.basisPoints, 10_000);
    }
    const totalAdjustment = totals.discount + totals.scholarship + totals.waiver;
    if (totalAdjustment > gross) throw new Error('FIN_ADJUSTMENT_EXCEEDS_GROSS');
    const taxable = gross - totalAdjustment;
    const tax = roundRatioHalfEven(taxable * fee.taxBasisPoints, 10_000);
    return Object.freeze({
      id: crypto.randomUUID(),
      invoiceId,
      lineNumber,
      feeItemId: fee.id,
      description: input.description?.trim() || fee.name,
      quantity: input.quantity,
      unitAmountMinor: fee.amountMinor,
      grossMinor: minorUnit(gross),
      discountMinor: minorUnit(totals.discount),
      scholarshipMinor: minorUnit(totals.scholarship),
      waiverMinor: minorUnit(totals.waiver),
      taxableMinor: minorUnit(taxable),
      taxMinor: minorUnit(tax),
      totalMinor: minorUnit(taxable + tax),
      incomeAccountId: fee.incomeAccountId,
      taxAccountId: fee.taxAccountId,
    });
  }

  #buildInstalments(invoiceId: string, totalMinor: number, dueDates: readonly string[]): InvoiceInstalment[] {
    if (dueDates.length === 0) throw new Error('FIN_INSTALMENT_DUE_DATE_REQUIRED');
    const uniqueDates = [...new Set(dueDates)];
    if (uniqueDates.length !== dueDates.length) throw new Error('FIN_DUPLICATE_INSTALMENT_DATE');
    uniqueDates.forEach((date) => assertDate(date, 'instalmentDueDate'));
    uniqueDates.sort();
    const base = Math.floor(totalMinor / uniqueDates.length);
    let remainder = totalMinor - base * uniqueDates.length;
    return uniqueDates.map((dueOn, index) => {
      const amount = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return Object.freeze({
        id: crypto.randomUUID(),
        invoiceId,
        sequence: index + 1,
        dueOn,
        amountMinor: minorUnit(amount),
        allocatedMinor: minorUnit(0),
      });
    });
  }

  #allocateInstalments(instalments: readonly InvoiceInstalment[], amount: number): InvoiceInstalment[] {
    let remaining = amount;
    return instalments.map((instalment) => {
      const available = instalment.amountMinor - instalment.allocatedMinor;
      const applied = Math.min(remaining, available);
      remaining -= applied;
      return Object.freeze({ ...instalment, allocatedMinor: minorUnit(instalment.allocatedMinor + applied) });
    });
  }

  #unallocateInstalments(instalments: readonly InvoiceInstalment[], amount: number): InvoiceInstalment[] {
    let remaining = amount;
    return [...instalments].reverse().map((instalment) => {
      const removed = Math.min(remaining, instalment.allocatedMinor);
      remaining -= removed;
      return Object.freeze({ ...instalment, allocatedMinor: minorUnit(instalment.allocatedMinor - removed) });
    }).reverse();
  }

  #validateAdjustments(adjustments: readonly FeeAssignmentAdjustment[]): void {
    let total = 0;
    for (const adjustment of adjustments) {
      if (!Number.isInteger(adjustment.basisPoints) || adjustment.basisPoints < 0 || adjustment.basisPoints > 10_000) throw new Error('FIN_INVALID_ADJUSTMENT_RATE');
      if (adjustment.reason.trim().length < 3 || adjustment.approvedBy.trim().length === 0) throw new Error('FIN_ADJUSTMENT_APPROVAL_REQUIRED');
      total += adjustment.basisPoints;
    }
    if (total > 10_000) throw new Error('FIN_ADJUSTMENT_EXCEEDS_100_PERCENT');
  }

  #nextNumber(type: 'invoice' | 'credit-note'): string {
    const key = this.#scope.legalEntityId!;
    const map = type === 'invoice' ? this.#invoiceSequenceByEntity : this.#creditSequenceByEntity;
    const next = (map.get(key) ?? 0) + 1;
    map.set(key, next);
    return `${type === 'invoice' ? 'INV' : 'CN'}-${String(next).padStart(6, '0')}`;
  }

  #assertScope(tenantId: string, legalEntityId: string): void {
    if (tenantId !== this.#scope.tenantId || legalEntityId !== this.#scope.legalEntityId) throw new Error('FIN_SCOPE_MISMATCH');
  }

  #requireAccount(id: string): BillingAccount {
    const account = this.#accounts.get(id);
    if (!account) throw new Error('FIN_NOT_FOUND:billing-account');
    this.#assertScope(account.tenantId, account.legalEntityId);
    return account;
  }

  #requireInvoice(id: string): Invoice {
    const invoice = this.#invoices.get(id);
    if (!invoice) throw new Error('FIN_NOT_FOUND:invoice');
    this.#assertScope(invoice.tenantId, invoice.legalEntityId);
    return invoice;
  }

  #requireCredit(id: string): CreditNote {
    const credit = this.#creditNotes.get(id);
    if (!credit) throw new Error('FIN_NOT_FOUND:credit-note');
    this.#assertScope(credit.tenantId, credit.legalEntityId);
    return credit;
  }
}
