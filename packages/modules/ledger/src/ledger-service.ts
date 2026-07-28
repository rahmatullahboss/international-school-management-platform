import {
  authorizeFinance,
  type FinancePrincipal,
  type FinanceScope,
} from '../../billing/src/contracts/permissions.js';
import { minorUnit, type CurrencyCode, type MinorUnit } from '../../billing/src/contracts/money.js';

export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type LedgerNaturalBalance = 'debit' | 'credit';
export type LedgerPeriodStatus = 'open' | 'closed';
export type LedgerSide = 'debit' | 'credit';

export interface LedgerAccountRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly bookId: string;
  readonly code: string;
  readonly name: string;
  readonly type: LedgerAccountType;
  readonly naturalBalance: LedgerNaturalBalance;
  readonly controlAccount: boolean;
  readonly active: boolean;
}

export interface LedgerPeriodRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly bookId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: LedgerPeriodStatus;
  readonly closedBy: string | null;
  readonly closedAt: string | null;
  readonly reopenReason: string | null;
}

export interface JournalCommandLine {
  readonly accountId: string;
  readonly side: LedgerSide;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly description?: string;
  readonly dimensions?: Readonly<Record<string, string>>;
}

export interface PostJournalCommand {
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly bookId: string;
  readonly periodId: string;
  readonly entryDate: string;
  readonly description: string;
  readonly sourceDocumentType: string;
  readonly sourceDocumentId: string;
  readonly createdBy: string;
  readonly postedBy: FinancePrincipal;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly lines: readonly JournalCommandLine[];
}

export interface PostedJournalLine {
  readonly id: string;
  readonly lineNumber: number;
  readonly accountId: string;
  readonly side: LedgerSide;
  readonly amountMinor: MinorUnit;
  readonly currency: CurrencyCode;
  readonly description: string | null;
  readonly dimensions: Readonly<Record<string, string>>;
}

export interface PostedJournal {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly bookId: string;
  readonly periodId: string;
  readonly entryDate: string;
  readonly description: string;
  readonly sourceDocumentType: string;
  readonly sourceDocumentId: string;
  readonly createdBy: string;
  readonly postedBy: string;
  readonly postedAt: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly reversalOf: string | null;
  readonly lines: readonly PostedJournalLine[];
}

export interface AccountBalance {
  readonly accountId: string;
  readonly debitsMinor: number;
  readonly creditsMinor: number;
  readonly balanceMinor: number;
  readonly currency: CurrencyCode;
}

export interface LedgerClock {
  now(): Date;
}

const systemClock: LedgerClock = { now: () => new Date() };

function cloneFrozenRecord<T extends Readonly<Record<string, string>>>(value: T): T {
  return Object.freeze({ ...value });
}

function scopeOf(tenantId: string, legalEntityId: string): FinanceScope {
  return { tenantId, legalEntityId };
}

function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`FIN_INVALID_DATE:${field}`);
  }
}

function assertIdentifier(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 200)
    throw new Error(`FIN_INVALID_IDENTIFIER:${field}`);
}

export class LedgerService {
  readonly #scope: FinanceScope;
  readonly #clock: LedgerClock;
  readonly #accounts = new Map<string, LedgerAccountRecord>();
  readonly #periods = new Map<string, LedgerPeriodRecord>();
  readonly #entries = new Map<string, PostedJournal>();
  readonly #idempotency = new Map<string, string>();
  readonly #sourceIndex = new Map<string, readonly string[]>();
  readonly #reversalIndex = new Map<string, string>();

  constructor(scope: FinanceScope, clock: LedgerClock = systemClock) {
    assertIdentifier(scope.tenantId, 'tenantId');
    assertIdentifier(scope.legalEntityId ?? '', 'legalEntityId');
    this.#scope = Object.freeze({ ...scope });
    this.#clock = clock;
  }

  registerAccount(account: LedgerAccountRecord): LedgerAccountRecord {
    this.#assertScope(account.tenantId, account.legalEntityId);
    assertIdentifier(account.id, 'account.id');
    assertIdentifier(account.bookId, 'account.bookId');
    if (!/^\d{3,20}$/.test(account.code)) throw new Error('FIN_INVALID_ACCOUNT_CODE');
    if (this.#accounts.has(account.id)) throw new Error('FIN_DUPLICATE_ACCOUNT_ID');
    if (
      [...this.#accounts.values()].some(
        (existing) => existing.bookId === account.bookId && existing.code === account.code,
      )
    ) {
      throw new Error('FIN_DUPLICATE_ACCOUNT_CODE');
    }
    const expectedNaturalBalance: LedgerNaturalBalance =
      account.type === 'asset' || account.type === 'expense' ? 'debit' : 'credit';
    if (account.naturalBalance !== expectedNaturalBalance)
      throw new Error('FIN_INVALID_NATURAL_BALANCE');
    const frozen = Object.freeze({ ...account });
    this.#accounts.set(frozen.id, frozen);
    return frozen;
  }

  createPeriod(
    period: Omit<LedgerPeriodRecord, 'status' | 'closedBy' | 'closedAt' | 'reopenReason'>,
  ): LedgerPeriodRecord {
    this.#assertScope(period.tenantId, period.legalEntityId);
    assertDate(period.startsOn, 'startsOn');
    assertDate(period.endsOn, 'endsOn');
    if (period.startsOn > period.endsOn) throw new Error('FIN_INVALID_PERIOD_RANGE');
    if (this.#periods.has(period.id)) throw new Error('FIN_DUPLICATE_PERIOD');
    const overlaps = [...this.#periods.values()].some(
      (existing) =>
        existing.bookId === period.bookId &&
        period.startsOn <= existing.endsOn &&
        period.endsOn >= existing.startsOn,
    );
    if (overlaps) throw new Error('FIN_OVERLAPPING_PERIOD');
    const created: LedgerPeriodRecord = Object.freeze({
      ...period,
      status: 'open',
      closedBy: null,
      closedAt: null,
      reopenReason: null,
    });
    this.#periods.set(created.id, created);
    return created;
  }

  closePeriod(periodId: string, principal: FinancePrincipal): LedgerPeriodRecord {
    const period = this.#requirePeriod(periodId);
    authorizeFinance(
      principal,
      'ledger.period.close',
      scopeOf(period.tenantId, period.legalEntityId),
    );
    if (period.status !== 'open') throw new Error('FIN_INVALID_PERIOD_STATE');
    const next = Object.freeze({
      ...period,
      status: 'closed' as const,
      closedBy: principal.principalId,
      closedAt: this.#clock.now().toISOString(),
      reopenReason: null,
    });
    this.#periods.set(periodId, next);
    return next;
  }

  reopenPeriod(periodId: string, principal: FinancePrincipal, reason: string): LedgerPeriodRecord {
    const period = this.#requirePeriod(periodId);
    authorizeFinance(
      principal,
      'ledger.period.reopen',
      scopeOf(period.tenantId, period.legalEntityId),
    );
    if (period.status !== 'closed') throw new Error('FIN_INVALID_PERIOD_STATE');
    if (period.closedBy === principal.principalId)
      throw new Error('FIN_SOD_VIOLATION:period-close-reopen');
    if (reason.trim().length < 8) throw new Error('FIN_REOPEN_REASON_REQUIRED');
    const next = Object.freeze({
      ...period,
      status: 'open' as const,
      closedBy: null,
      closedAt: null,
      reopenReason: reason.trim(),
    });
    this.#periods.set(periodId, next);
    return next;
  }

  post(command: PostJournalCommand): PostedJournal {
    this.#assertScope(command.tenantId, command.legalEntityId);
    authorizeFinance(
      command.postedBy,
      'ledger.journal.post',
      scopeOf(command.tenantId, command.legalEntityId),
    );
    if (command.createdBy === command.postedBy.principalId)
      throw new Error('FIN_SOD_VIOLATION:journal-create-post');
    assertIdentifier(command.idempotencyKey, 'idempotencyKey');
    const existingId = this.#idempotency.get(command.idempotencyKey);
    if (existingId) return this.#entries.get(existingId)!;
    const period = this.#requirePeriod(command.periodId);
    if (period.bookId !== command.bookId) throw new Error('FIN_BOOK_PERIOD_MISMATCH');
    if (period.status !== 'open') throw new Error('FIN_PERIOD_CLOSED');
    assertDate(command.entryDate, 'entryDate');
    if (command.entryDate < period.startsOn || command.entryDate > period.endsOn)
      throw new Error('FIN_ENTRY_OUTSIDE_PERIOD');
    if (command.lines.length < 2) throw new Error('FIN_JOURNAL_REQUIRES_TWO_LINES');
    const currencies = new Set(command.lines.map((line) => line.currency));
    if (currencies.size !== 1) throw new Error('FIN_CURRENCY_MISMATCH');
    let debitTotal = 0;
    let creditTotal = 0;
    const lines = command.lines.map((line, index): PostedJournalLine => {
      const account = this.#accounts.get(line.accountId);
      if (!account || !account.active) throw new Error(`FIN_ACCOUNT_NOT_FOUND:${line.accountId}`);
      if (account.bookId !== command.bookId) throw new Error('FIN_ACCOUNT_BOOK_MISMATCH');
      if (!Number.isSafeInteger(line.amountMinor) || line.amountMinor <= 0)
        throw new Error('FIN_INVALID_AMOUNT');
      if (line.side === 'debit') debitTotal += line.amountMinor;
      else creditTotal += line.amountMinor;
      return Object.freeze({
        id: crypto.randomUUID(),
        lineNumber: index + 1,
        accountId: line.accountId,
        side: line.side,
        amountMinor: minorUnit(line.amountMinor),
        currency: line.currency,
        description: line.description?.trim() || null,
        dimensions: cloneFrozenRecord(line.dimensions ?? {}),
      });
    });
    if (debitTotal !== creditTotal)
      throw new Error(`FIN_UNBALANCED_JOURNAL:${debitTotal}:${creditTotal}`);
    const id = crypto.randomUUID();
    const posted: PostedJournal = Object.freeze({
      id,
      tenantId: command.tenantId,
      legalEntityId: command.legalEntityId,
      bookId: command.bookId,
      periodId: command.periodId,
      entryDate: command.entryDate,
      description: command.description.trim(),
      sourceDocumentType: command.sourceDocumentType,
      sourceDocumentId: command.sourceDocumentId,
      createdBy: command.createdBy,
      postedBy: command.postedBy.principalId,
      postedAt: this.#clock.now().toISOString(),
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      reversalOf: null,
      lines: Object.freeze(lines),
    });
    this.#entries.set(id, posted);
    this.#idempotency.set(command.idempotencyKey, id);
    const sourceKey = `${command.sourceDocumentType}:${command.sourceDocumentId}`;
    this.#sourceIndex.set(
      sourceKey,
      Object.freeze([...(this.#sourceIndex.get(sourceKey) ?? []), id]),
    );
    return posted;
  }

  reverse(
    entryId: string,
    principal: FinancePrincipal,
    reason: string,
    idempotencyKey: string,
  ): PostedJournal {
    const existingReversal = this.#idempotency.get(idempotencyKey);
    if (existingReversal) return this.#entries.get(existingReversal)!;
    const original = this.#entries.get(entryId);
    if (!original) throw new Error('FIN_NOT_FOUND:journal');
    authorizeFinance(
      principal,
      'ledger.journal.reverse',
      scopeOf(original.tenantId, original.legalEntityId),
    );
    if (original.postedBy === principal.principalId)
      throw new Error('FIN_SOD_VIOLATION:poster-reversal');
    if (this.#reversalIndex.has(entryId)) throw new Error('FIN_ALREADY_REVERSED');
    if (reason.trim().length < 8) throw new Error('FIN_REVERSAL_REASON_REQUIRED');
    const reversal = this.post({
      tenantId: original.tenantId,
      legalEntityId: original.legalEntityId,
      bookId: original.bookId,
      periodId: original.periodId,
      entryDate: original.entryDate,
      description: `Reversal — ${reason.trim()}`,
      sourceDocumentType: 'journal-reversal',
      sourceDocumentId: original.id,
      createdBy: `system:reversal:${original.id}`,
      postedBy: principal,
      idempotencyKey,
      correlationId: original.correlationId,
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        side: line.side === 'debit' ? 'credit' : 'debit',
        amountMinor: line.amountMinor,
        currency: line.currency,
        description: `Reversal of ${line.id}`,
        dimensions: line.dimensions,
      })),
    });
    const linked = Object.freeze({ ...reversal, reversalOf: original.id });
    this.#entries.set(linked.id, linked);
    this.#reversalIndex.set(original.id, linked.id);
    return linked;
  }

  getEntry(entryId: string): PostedJournal | undefined {
    return this.#entries.get(entryId);
  }

  getEntriesForSource(
    sourceDocumentType: string,
    sourceDocumentId: string,
  ): readonly PostedJournal[] {
    return Object.freeze(
      (this.#sourceIndex.get(`${sourceDocumentType}:${sourceDocumentId}`) ?? []).map((id) =>
        this.#entries.get(id)!,
      ),
    );
  }

  listEntries(asOf?: string): readonly PostedJournal[] {
    if (asOf !== undefined) assertDate(asOf, 'asOf');
    return Object.freeze(
      [...this.#entries.values()].filter((entry) => asOf === undefined || entry.entryDate <= asOf),
    );
  }

  balances(asOf?: string): readonly AccountBalance[] {
    const balances = new Map<string, { debit: number; credit: number; currency: CurrencyCode }>();
    for (const entry of this.listEntries(asOf)) {
      for (const line of entry.lines) {
        const current = balances.get(line.accountId) ?? {
          debit: 0,
          credit: 0,
          currency: line.currency,
        };
        if (current.currency !== line.currency) throw new Error('FIN_CURRENCY_MISMATCH');
        if (line.side === 'debit') current.debit += line.amountMinor;
        else current.credit += line.amountMinor;
        balances.set(line.accountId, current);
      }
    }
    return Object.freeze(
      [...balances.entries()].map(([accountId, total]) => {
        const account = this.#accounts.get(accountId)!;
        const signed =
          account.naturalBalance === 'debit'
            ? total.debit - total.credit
            : total.credit - total.debit;
        return Object.freeze({
          accountId,
          debitsMinor: total.debit,
          creditsMinor: total.credit,
          balanceMinor: signed,
          currency: total.currency,
        });
      }),
    );
  }

  accounts(): readonly LedgerAccountRecord[] {
    return Object.freeze([...this.#accounts.values()]);
  }

  periods(): readonly LedgerPeriodRecord[] {
    return Object.freeze([...this.#periods.values()]);
  }

  #assertScope(tenantId: string, legalEntityId: string): void {
    if (tenantId !== this.#scope.tenantId || legalEntityId !== this.#scope.legalEntityId)
      throw new Error('FIN_SCOPE_MISMATCH');
  }

  #requirePeriod(periodId: string): LedgerPeriodRecord {
    const period = this.#periods.get(periodId);
    if (!period) throw new Error('FIN_NOT_FOUND:period');
    this.#assertScope(period.tenantId, period.legalEntityId);
    return period;
  }
}
