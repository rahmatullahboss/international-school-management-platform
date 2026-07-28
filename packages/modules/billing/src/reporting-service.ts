import type { BillingService, CreditNote, Invoice } from './billing-service.js';
import type {
  PaymentAllocation,
  PaymentRecord,
  PaymentService,
  RefundRecord,
} from './payment-service.js';
import type { CurrencyCode } from './contracts/money.js';
import {
  authorizeFinance,
  type FinancePrincipal,
  type FinanceScope,
} from './contracts/permissions.js';
import type {
  AccountBalance,
  LedgerAccountRecord,
  LedgerPeriodRecord,
  LedgerService,
  PostedJournal,
  PostedJournalLine,
} from '../../ledger/src/ledger-service.js';

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '91+';

export interface ReceivableReconciliationReport {
  readonly asOf: string;
  readonly currency: string;
  readonly subledgerMinor: number;
  readonly controlAccountMinor: number;
  readonly differenceMinor: number;
  readonly reconciled: boolean;
  readonly invoiceCount: number;
}

export interface UnappliedCashReport {
  readonly asOf: string;
  readonly currency: string;
  readonly subledgerMinor: number;
  readonly controlAccountMinor: number;
  readonly differenceMinor: number;
  readonly reconciled: boolean;
  readonly payments: readonly {
    paymentId: string;
    receiptNumber: string;
    billingAccountId: string;
    unappliedMinor: number;
    receivedAt: string;
  }[];
}

export interface AgingRow {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly billingAccountId: string;
  readonly dueDate: string;
  readonly daysOverdue: number;
  readonly bucket: AgingBucket;
  readonly outstandingMinor: number;
}

export interface AgingReport {
  readonly asOf: string;
  readonly currency: string;
  readonly totals: Readonly<Record<AgingBucket, number>>;
  readonly totalOutstandingMinor: number;
  readonly rows: readonly AgingRow[];
}

export interface FinanceStatementEntry {
  readonly date: string;
  readonly type: 'invoice' | 'credit-note' | 'payment' | 'refund';
  readonly documentId: string;
  readonly documentNumber: string;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly runningBalanceMinor: number;
}

export interface FinanceAccountStatement {
  readonly billingAccountId: string;
  readonly asOf: string;
  readonly currency: string;
  readonly openingBalanceMinor: number;
  readonly closingBalanceMinor: number;
  readonly entries: readonly FinanceStatementEntry[];
}

export interface TrialBalanceRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: LedgerAccountRecord['type'];
  readonly naturalBalance: LedgerAccountRecord['naturalBalance'];
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly balanceMinor: number;
  readonly currency: string;
}

export interface TrialBalanceReport {
  readonly asOf: string;
  readonly rows: readonly TrialBalanceRow[];
  readonly totalDebitMinor: number;
  readonly totalCreditMinor: number;
  readonly balanced: boolean;
}

export interface GeneralLedgerRow {
  readonly journalEntryId: string;
  readonly entryDate: string;
  readonly sourceDocumentType: string;
  readonly sourceDocumentId: string;
  readonly description: string;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly runningBalanceMinor: number;
  readonly dimensions: Readonly<Record<string, string>>;
}

export interface GeneralLedgerReport {
  readonly accountId: string;
  readonly from: string;
  readonly to: string;
  readonly rows: readonly GeneralLedgerRow[];
  readonly truncated: boolean;
}

export interface IncomeStatementReport {
  readonly from: string;
  readonly to: string;
  readonly incomeMinor: number;
  readonly expenseMinor: number;
  readonly netIncomeMinor: number;
  readonly accounts: readonly {
    accountId: string;
    accountCode: string;
    accountName: string;
    amountMinor: number;
  }[];
}

export interface BalanceSheetReport {
  readonly asOf: string;
  readonly assetsMinor: number;
  readonly liabilitiesMinor: number;
  readonly equityMinor: number;
  readonly currentEarningsMinor: number;
  readonly liabilitiesAndEquityMinor: number;
  readonly differenceMinor: number;
  readonly balanced: boolean;
}

export interface FiscalPeriodSummary {
  readonly periodId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: LedgerPeriodRecord['status'];
  readonly journalCount: number;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly incomeMinor: number;
  readonly expenseMinor: number;
  readonly netIncomeMinor: number;
}

export interface DashboardMetric {
  readonly id:
    'outstanding-receivables' | 'overdue-receivables' | 'unapplied-cash' | 'pending-refunds';
  readonly label: string;
  readonly valueMinor: number;
  readonly definition: string;
  readonly source: string;
  readonly asOf: string;
  readonly drillDown: Readonly<Record<string, string>>;
}

export interface FinanceReportingConfiguration {
  readonly receivableAccountId: string;
  readonly unappliedCashAccountId: string;
  readonly maxRows?: number;
}

function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`FIN_INVALID_DATE:${field}`);
  }
}

function endOfDay(value: string): number {
  assertDate(value, 'asOf');
  return Date.parse(`${value}T23:59:59.999Z`);
}

function startOfDay(value: string): number {
  assertDate(value, 'date');
  return Date.parse(`${value}T00:00:00.000Z`);
}

function frozenArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function isAtOrBefore(value: string | null, cutoff: number): boolean {
  return (
    value !== null && Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value) <= cutoff
  );
}

function activeAllocationAsOf(allocation: PaymentAllocation, cutoff: number): boolean {
  return (
    Date.parse(allocation.allocatedAt) <= cutoff &&
    (allocation.reversedAt === null || Date.parse(allocation.reversedAt) > cutoff)
  );
}

function postedInvoiceAsOf(invoice: Invoice, cutoff: number): boolean {
  return (
    invoice.postedAt !== null &&
    Date.parse(invoice.postedAt) <= cutoff &&
    startOfDay(invoice.issueDate) <= cutoff &&
    invoice.status !== 'voided'
  );
}

function postedCreditAsOf(credit: CreditNote, cutoff: number): boolean {
  return (
    credit.status === 'posted' &&
    credit.postedAt !== null &&
    Date.parse(credit.postedAt) <= cutoff &&
    startOfDay(credit.issueDate) <= cutoff
  );
}

function paymentAsOf(payment: PaymentRecord, cutoff: number): boolean {
  return Date.parse(payment.receivedAt) <= cutoff;
}

function settledRefundAsOf(refund: RefundRecord, cutoff: number): boolean {
  return refund.status === 'settled' && isAtOrBefore(refund.settledAt, cutoff);
}

export class FinanceReportingService {
  readonly #scope: FinanceScope;
  readonly #billing: BillingService;
  readonly #payments: PaymentService;
  readonly #ledger: LedgerService;
  readonly #config: Required<FinanceReportingConfiguration>;

  constructor(
    scope: FinanceScope,
    billing: BillingService,
    payments: PaymentService,
    ledger: LedgerService,
    config: FinanceReportingConfiguration,
  ) {
    if (scope.tenantId.trim().length === 0 || (scope.legalEntityId ?? '').trim().length === 0)
      throw new Error('FIN_SCOPE_REQUIRED');
    if (
      config.receivableAccountId.trim().length === 0 ||
      config.unappliedCashAccountId.trim().length === 0
    )
      throw new Error('FIN_REPORT_CONTROL_ACCOUNT_REQUIRED');
    const maxRows = config.maxRows ?? 1_000;
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10_000)
      throw new Error('FIN_INVALID_REPORT_LIMIT');
    this.#scope = Object.freeze({ ...scope });
    this.#billing = billing;
    this.#payments = payments;
    this.#ledger = ledger;
    this.#config = Object.freeze({ ...config, maxRows });
  }

  receivableReconciliation(
    asOf: string,
    principal: FinancePrincipal,
  ): ReceivableReconciliationReport {
    this.#authorize(principal);
    const cutoff = endOfDay(asOf);
    const outstanding = this.#invoiceOutstandingAsOf(cutoff);
    const subledgerMinor = [...outstanding.values()].reduce((sum, value) => sum + value, 0);
    const control = this.#ledgerBalance(this.#config.receivableAccountId, asOf);
    const differenceMinor = subledgerMinor - control.balanceMinor;
    return Object.freeze({
      asOf,
      currency: control.currency,
      subledgerMinor,
      controlAccountMinor: control.balanceMinor,
      differenceMinor,
      reconciled: differenceMinor === 0,
      invoiceCount: [...outstanding.values()].filter((value) => value > 0).length,
    });
  }

  unappliedCash(asOf: string, principal: FinancePrincipal): UnappliedCashReport {
    this.#authorize(principal);
    const cutoff = endOfDay(asOf);
    const allocations = this.#payments.listAllocations();
    const refunds = this.#payments.listRefunds();
    const rows = this.#payments
      .listPayments()
      .filter((payment) => paymentAsOf(payment, cutoff))
      .map((payment) => {
        const allocated = allocations
          .filter(
            (allocation) =>
              allocation.paymentId === payment.id && activeAllocationAsOf(allocation, cutoff),
          )
          .reduce((sum, allocation) => sum + allocation.amountMinor, 0);
        const refunded = refunds
          .filter((refund) => refund.paymentId === payment.id && settledRefundAsOf(refund, cutoff))
          .reduce((sum, refund) => sum + refund.amountMinor, 0);
        return Object.freeze({
          paymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          billingAccountId: payment.billingAccountId,
          unappliedMinor: Math.max(0, payment.amountMinor - allocated - refunded),
          receivedAt: payment.receivedAt,
        });
      })
      .filter((row) => row.unappliedMinor > 0)
      .sort(
        (left, right) =>
          left.receivedAt.localeCompare(right.receivedAt) ||
          left.receiptNumber.localeCompare(right.receiptNumber),
      );
    const subledgerMinor = rows.reduce((sum, row) => sum + row.unappliedMinor, 0);
    const control = this.#ledgerBalance(this.#config.unappliedCashAccountId, asOf);
    const differenceMinor = subledgerMinor - control.balanceMinor;
    return Object.freeze({
      asOf,
      currency: control.currency,
      subledgerMinor,
      controlAccountMinor: control.balanceMinor,
      differenceMinor,
      reconciled: differenceMinor === 0,
      payments: frozenArray(rows.slice(0, this.#config.maxRows)),
    });
  }

  aging(asOf: string, principal: FinancePrincipal): AgingReport {
    this.#authorize(principal);
    const cutoff = endOfDay(asOf);
    const outstanding = this.#invoiceOutstandingAsOf(cutoff);
    const totals: Record<AgingBucket, number> = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '91+': 0,
    };
    const rows = this.#billing
      .listInvoices()
      .filter((invoice) => postedInvoiceAsOf(invoice, cutoff))
      .map((invoice): AgingRow | null => {
        const outstandingMinor = outstanding.get(invoice.id) ?? 0;
        if (outstandingMinor <= 0) return null;
        const daysOverdue = Math.max(
          0,
          Math.floor((startOfDay(asOf) - startOfDay(invoice.dueDate)) / 86_400_000),
        );
        const bucket: AgingBucket =
          daysOverdue === 0
            ? 'current'
            : daysOverdue <= 30
              ? '1-30'
              : daysOverdue <= 60
                ? '31-60'
                : daysOverdue <= 90
                  ? '61-90'
                  : '91+';
        totals[bucket] += outstandingMinor;
        return Object.freeze({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          billingAccountId: invoice.billingAccountId,
          dueDate: invoice.dueDate,
          daysOverdue,
          bucket,
          outstandingMinor,
        });
      })
      .filter((row): row is AgingRow => row !== null)
      .sort(
        (left, right) =>
          right.daysOverdue - left.daysOverdue ||
          left.invoiceNumber.localeCompare(right.invoiceNumber),
      );
    return Object.freeze({
      asOf,
      currency: this.#reportCurrency(),
      totals: Object.freeze({ ...totals }),
      totalOutstandingMinor: Object.values(totals).reduce((sum, value) => sum + value, 0),
      rows: frozenArray(rows.slice(0, this.#config.maxRows)),
    });
  }

  accountStatement(
    billingAccountId: string,
    asOf: string,
    principal: FinancePrincipal,
  ): FinanceAccountStatement {
    this.#authorize(principal);
    const account = this.#billing
      .listBillingAccounts()
      .find((candidate) => candidate.id === billingAccountId);
    if (!account) throw new Error('FIN_NOT_FOUND:billing-account');
    const cutoff = endOfDay(asOf);
    const documents: {
      date: string;
      type: FinanceStatementEntry['type'];
      id: string;
      number: string;
      debit: number;
      credit: number;
    }[] = [];
    for (const invoice of this.#billing.listInvoices()) {
      if (invoice.billingAccountId === billingAccountId && postedInvoiceAsOf(invoice, cutoff)) {
        documents.push({
          date: invoice.issueDate,
          type: 'invoice',
          id: invoice.id,
          number: invoice.invoiceNumber,
          debit: invoice.totalMinor,
          credit: 0,
        });
      }
    }
    for (const credit of this.#billing.listCreditNotes()) {
      const invoice = this.#billing.getInvoice(credit.invoiceId);
      if (invoice?.billingAccountId === billingAccountId && postedCreditAsOf(credit, cutoff)) {
        documents.push({
          date: credit.issueDate,
          type: 'credit-note',
          id: credit.id,
          number: credit.creditNoteNumber,
          debit: 0,
          credit: credit.totalMinor,
        });
      }
    }
    for (const payment of this.#payments.listPayments()) {
      if (payment.billingAccountId === billingAccountId && paymentAsOf(payment, cutoff)) {
        documents.push({
          date: payment.receivedAt.slice(0, 10),
          type: 'payment',
          id: payment.id,
          number: payment.receiptNumber,
          debit: 0,
          credit: payment.amountMinor,
        });
      }
    }
    for (const refund of this.#payments.listRefunds()) {
      const payment = this.#payments.getPayment(refund.paymentId);
      if (payment?.billingAccountId === billingAccountId && settledRefundAsOf(refund, cutoff)) {
        documents.push({
          date: refund.settledAt!.slice(0, 10),
          type: 'refund',
          id: refund.id,
          number: refund.refundNumber,
          debit: refund.amountMinor,
          credit: 0,
        });
      }
    }
    const typeOrder: Readonly<Record<FinanceStatementEntry['type'], number>> = {
      invoice: 1,
      payment: 2,
      'credit-note': 3,
      refund: 4,
    };
    documents.sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        typeOrder[left.type] - typeOrder[right.type] ||
        left.number.localeCompare(right.number),
    );
    let runningBalanceMinor = 0;
    const entries = documents
      .slice(0, this.#config.maxRows)
      .map((document): FinanceStatementEntry => {
        runningBalanceMinor += document.debit - document.credit;
        return Object.freeze({
          date: document.date,
          type: document.type,
          documentId: document.id,
          documentNumber: document.number,
          debitMinor: document.debit,
          creditMinor: document.credit,
          runningBalanceMinor,
        });
      });
    return Object.freeze({
      billingAccountId,
      asOf,
      currency: account.currency,
      openingBalanceMinor: 0,
      closingBalanceMinor: runningBalanceMinor,
      entries: frozenArray(entries),
    });
  }

  trialBalance(asOf: string, principal: FinancePrincipal): TrialBalanceReport {
    this.#authorize(principal);
    assertDate(asOf, 'asOf');
    const accounts = new Map(this.#ledger.accounts().map((account) => [account.id, account]));
    const rows = this.#ledger
      .balances(asOf)
      .map((balance): TrialBalanceRow => {
        const account = accounts.get(balance.accountId);
        if (!account) throw new Error(`FIN_NOT_FOUND:account:${balance.accountId}`);
        return Object.freeze({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          naturalBalance: account.naturalBalance,
          debitMinor: balance.debitsMinor,
          creditMinor: balance.creditsMinor,
          balanceMinor: balance.balanceMinor,
          currency: balance.currency,
        });
      })
      .sort((left, right) => left.accountCode.localeCompare(right.accountCode));
    const totalDebitMinor = rows.reduce((sum, row) => sum + row.debitMinor, 0);
    const totalCreditMinor = rows.reduce((sum, row) => sum + row.creditMinor, 0);
    return Object.freeze({
      asOf,
      rows: frozenArray(rows),
      totalDebitMinor,
      totalCreditMinor,
      balanced: totalDebitMinor === totalCreditMinor,
    });
  }

  generalLedger(
    accountId: string,
    from: string,
    to: string,
    principal: FinancePrincipal,
    limit = this.#config.maxRows,
  ): GeneralLedgerReport {
    this.#authorize(principal);
    assertDate(from, 'from');
    assertDate(to, 'to');
    if (from > to) throw new Error('FIN_INVALID_DATE_RANGE');
    if (!Number.isInteger(limit) || limit < 1 || limit > this.#config.maxRows)
      throw new Error('FIN_INVALID_REPORT_LIMIT');
    const account = this.#ledger.accounts().find((candidate) => candidate.id === accountId);
    if (!account) throw new Error('FIN_NOT_FOUND:account');
    const movements: { entry: PostedJournal; line: PostedJournalLine }[] = [];
    for (const entry of this.#ledger.listEntries(to)) {
      if (entry.entryDate < from) continue;
      for (const line of entry.lines)
        if (line.accountId === accountId) movements.push({ entry, line });
    }
    movements.sort(
      (left, right) =>
        left.entry.entryDate.localeCompare(right.entry.entryDate) ||
        left.entry.id.localeCompare(right.entry.id) ||
        left.line.lineNumber - right.line.lineNumber,
    );
    let runningBalanceMinor = 0;
    const rows = movements.slice(0, limit).map(({ entry, line }): GeneralLedgerRow => {
      const debitMinor = line.side === 'debit' ? line.amountMinor : 0;
      const creditMinor = line.side === 'credit' ? line.amountMinor : 0;
      runningBalanceMinor +=
        account.naturalBalance === 'debit' ? debitMinor - creditMinor : creditMinor - debitMinor;
      return Object.freeze({
        journalEntryId: entry.id,
        entryDate: entry.entryDate,
        sourceDocumentType: entry.sourceDocumentType,
        sourceDocumentId: entry.sourceDocumentId,
        description: line.description ?? entry.description,
        debitMinor,
        creditMinor,
        runningBalanceMinor,
        dimensions: line.dimensions,
      });
    });
    return Object.freeze({
      accountId,
      from,
      to,
      rows: frozenArray(rows),
      truncated: movements.length > limit,
    });
  }

  incomeStatement(from: string, to: string, principal: FinancePrincipal): IncomeStatementReport {
    this.#authorize(principal);
    assertDate(from, 'from');
    assertDate(to, 'to');
    if (from > to) throw new Error('FIN_INVALID_DATE_RANGE');
    const rows = this.#periodMovementByAccount(from, to)
      .filter(({ account }) => account.type === 'income' || account.type === 'expense')
      .map(({ account, balance }) =>
        Object.freeze({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amountMinor: balance,
        }),
      )
      .sort((left, right) => left.accountCode.localeCompare(right.accountCode));
    const incomeMinor = rows
      .filter((row) => this.#account(row.accountId).type === 'income')
      .reduce((sum, row) => sum + row.amountMinor, 0);
    const expenseMinor = rows
      .filter((row) => this.#account(row.accountId).type === 'expense')
      .reduce((sum, row) => sum + row.amountMinor, 0);
    return Object.freeze({
      from,
      to,
      incomeMinor,
      expenseMinor,
      netIncomeMinor: incomeMinor - expenseMinor,
      accounts: frozenArray(rows),
    });
  }

  balanceSheet(asOf: string, principal: FinancePrincipal): BalanceSheetReport {
    this.#authorize(principal);
    assertDate(asOf, 'asOf');
    const balances = new Map(
      this.#ledger.balances(asOf).map((balance) => [balance.accountId, balance.balanceMinor]),
    );
    const total = (type: LedgerAccountRecord['type']) =>
      this.#ledger
        .accounts()
        .filter((account) => account.type === type)
        .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);
    const assetsMinor = total('asset');
    const liabilitiesMinor = total('liability');
    const equityMinor = total('equity');
    const currentEarningsMinor = total('income') - total('expense');
    const liabilitiesAndEquityMinor = liabilitiesMinor + equityMinor + currentEarningsMinor;
    const differenceMinor = assetsMinor - liabilitiesAndEquityMinor;
    return Object.freeze({
      asOf,
      assetsMinor,
      liabilitiesMinor,
      equityMinor,
      currentEarningsMinor,
      liabilitiesAndEquityMinor,
      differenceMinor,
      balanced: differenceMinor === 0,
    });
  }

  fiscalPeriodSummary(periodId: string, principal: FinancePrincipal): FiscalPeriodSummary {
    this.#authorize(principal);
    const period = this.#ledger.periods().find((candidate) => candidate.id === periodId);
    if (!period) throw new Error('FIN_NOT_FOUND:period');
    const entries = this.#ledger
      .listEntries(period.endsOn)
      .filter((entry) => entry.periodId === period.id && entry.entryDate >= period.startsOn);
    const debitMinor = entries.reduce(
      (sum, entry) =>
        sum +
        entry.lines
          .filter((line) => line.side === 'debit')
          .reduce((lineSum, line) => lineSum + line.amountMinor, 0),
      0,
    );
    const creditMinor = entries.reduce(
      (sum, entry) =>
        sum +
        entry.lines
          .filter((line) => line.side === 'credit')
          .reduce((lineSum, line) => lineSum + line.amountMinor, 0),
      0,
    );
    const income = this.incomeStatement(period.startsOn, period.endsOn, principal);
    return Object.freeze({
      periodId: period.id,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      status: period.status,
      journalCount: entries.length,
      debitMinor,
      creditMinor,
      incomeMinor: income.incomeMinor,
      expenseMinor: income.expenseMinor,
      netIncomeMinor: income.netIncomeMinor,
    });
  }

  dashboard(asOf: string, principal: FinancePrincipal): readonly DashboardMetric[] {
    this.#authorize(principal);
    const receivable = this.receivableReconciliation(asOf, principal);
    const aging = this.aging(asOf, principal);
    const unapplied = this.unappliedCash(asOf, principal);
    const cutoff = endOfDay(asOf);
    const pendingRefunds = this.#payments
      .listRefunds()
      .filter(
        (refund) =>
          refund.status === 'pending-approval' && Date.parse(refund.requestedAt) <= cutoff,
      )
      .reduce((sum, refund) => sum + refund.amountMinor, 0);
    return frozenArray([
      Object.freeze({
        id: 'outstanding-receivables' as const,
        label: 'Outstanding receivables',
        valueMinor: receivable.subledgerMinor,
        definition:
          'Posted invoice totals less posted credits and active payment allocations as of the selected date.',
        source:
          'billing invoices, credit notes, payment allocations and receivable control account',
        asOf,
        drillDown: Object.freeze({ report: 'aging', asOf }),
      }),
      Object.freeze({
        id: 'overdue-receivables' as const,
        label: 'Overdue receivables',
        valueMinor: aging.totalOutstandingMinor - aging.totals.current,
        definition: 'Outstanding receivables with a due date before the selected date.',
        source: 'invoice due dates and reconstructed as-of balances',
        asOf,
        drillDown: Object.freeze({ report: 'aging', asOf, overdue: 'true' }),
      }),
      Object.freeze({
        id: 'unapplied-cash' as const,
        label: 'Unapplied cash',
        valueMinor: unapplied.subledgerMinor,
        definition:
          'Settled payments less active allocations and settled refunds as of the selected date.',
        source: 'payment, allocation, refund and unapplied-cash control account',
        asOf,
        drillDown: Object.freeze({ report: 'unapplied-cash', asOf }),
      }),
      Object.freeze({
        id: 'pending-refunds' as const,
        label: 'Pending refunds',
        valueMinor: pendingRefunds,
        definition: 'Refund requests awaiting approval as of the selected date.',
        source: 'refund approval queue',
        asOf,
        drillDown: Object.freeze({ report: 'refund-approvals', asOf, status: 'pending-approval' }),
      }),
    ]);
  }

  #invoiceOutstandingAsOf(cutoff: number): Map<string, number> {
    const credits = this.#billing.listCreditNotes();
    const allocations = this.#payments.listAllocations();
    const result = new Map<string, number>();
    for (const invoice of this.#billing.listInvoices()) {
      if (!postedInvoiceAsOf(invoice, cutoff)) continue;
      const credited = credits
        .filter((credit) => credit.invoiceId === invoice.id && postedCreditAsOf(credit, cutoff))
        .reduce((sum, credit) => sum + credit.totalMinor, 0);
      const allocated = allocations
        .filter(
          (allocation) =>
            allocation.invoiceId === invoice.id && activeAllocationAsOf(allocation, cutoff),
        )
        .reduce((sum, allocation) => sum + allocation.amountMinor, 0);
      result.set(invoice.id, Math.max(0, invoice.totalMinor - credited - allocated));
    }
    return result;
  }

  #periodMovementByAccount(
    from: string,
    to: string,
  ): readonly { account: LedgerAccountRecord; balance: number }[] {
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const entry of this.#ledger.listEntries(to)) {
      if (entry.entryDate < from) continue;
      for (const line of entry.lines) {
        const total = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        if (line.side === 'debit') total.debit += line.amountMinor;
        else total.credit += line.amountMinor;
        totals.set(line.accountId, total);
      }
    }
    return frozenArray(
      [...totals.entries()].map(([accountId, total]) => {
        const account = this.#account(accountId);
        const balance =
          account.naturalBalance === 'debit'
            ? total.debit - total.credit
            : total.credit - total.debit;
        return Object.freeze({ account, balance });
      }),
    );
  }

  #ledgerBalance(accountId: string, asOf: string): AccountBalance {
    const balance = this.#ledger
      .balances(asOf)
      .find((candidate) => candidate.accountId === accountId);
    if (balance) return balance;
    return Object.freeze({
      accountId,
      debitsMinor: 0,
      creditsMinor: 0,
      balanceMinor: 0,
      currency: this.#reportCurrency(),
    });
  }

  #reportCurrency(): CurrencyCode {
    const account = this.#billing.listBillingAccounts()[0];
    if (!account) throw new Error('FIN_REPORT_CURRENCY_UNAVAILABLE');
    return account.currency;
  }

  #account(accountId: string): LedgerAccountRecord {
    const account = this.#ledger.accounts().find((candidate) => candidate.id === accountId);
    if (!account) throw new Error(`FIN_NOT_FOUND:account:${accountId}`);
    return account;
  }

  #authorize(principal: FinancePrincipal): void {
    authorizeFinance(principal, 'finance.report.read', this.#scope);
  }
}
