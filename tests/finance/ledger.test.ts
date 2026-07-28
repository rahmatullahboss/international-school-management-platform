import { describe, expect, it } from 'vitest';

import { currencyCode, type FinancePrincipal } from '../../packages/modules/billing/src/index.js';
import {
  LedgerService,
  type LedgerAccountRecord,
  type PostJournalCommand,
} from '../../packages/modules/ledger/src/index.js';

const tenantId = 'tenant-a';
const legalEntityId = 'entity-a';
const bookId = 'book-a';
const periodId = 'period-2026';
const gbp = currencyCode('GBP');

const clock = { now: () => new Date('2026-07-28T09:10:00.000Z') };

function principal(
  principalId: string,
  permissions: FinancePrincipal['permissions'],
  assurance: FinancePrincipal['assurance'] = 'aal2',
): FinancePrincipal {
  return { principalId, permissions, assurance, scope: { tenantId, legalEntityId } };
}

const poster = principal('poster', ['ledger.journal.post']);
const reverser = principal('reverser', ['ledger.journal.post', 'ledger.journal.reverse']);
const closer = principal('closer', ['ledger.period.close']);
const reopener = principal('reopener', ['ledger.period.reopen'], 'aal3');

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

function setup(): LedgerService {
  const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
  ledger.registerAccount(account('receivable', '1100', 'asset', true));
  ledger.registerAccount(account('cash', '1000', 'asset'));
  ledger.registerAccount(account('tuition-income', '4100', 'income'));
  ledger.createPeriod({
    id: periodId,
    tenantId,
    legalEntityId,
    bookId,
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
  });
  return ledger;
}

function invoiceCommand(overrides: Partial<PostJournalCommand> = {}): PostJournalCommand {
  return {
    tenantId,
    legalEntityId,
    bookId,
    periodId,
    entryDate: '2026-07-28',
    description: 'Tuition invoice',
    sourceDocumentType: 'invoice',
    sourceDocumentId: 'invoice-1',
    createdBy: 'creator',
    postedBy: poster,
    idempotencyKey: 'invoice-post:invoice-1',
    correlationId: 'corr-invoice-1',
    lines: [
      { accountId: 'receivable', side: 'debit', amountMinor: 25000, currency: gbp },
      { accountId: 'tuition-income', side: 'credit', amountMinor: 25000, currency: gbp },
    ],
    ...overrides,
  };
}

describe('FIN-01 immutable double-entry ledger', () => {
  it('posts a balanced entry and returns the same immutable result for retries', () => {
    const ledger = setup();
    const first = ledger.post(invoiceCommand());
    const replay = ledger.post(invoiceCommand());
    expect(replay).toBe(first);
    expect(first.lines).toHaveLength(2);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.lines)).toBe(true);
    expect(ledger.getEntriesForSource('invoice', 'invoice-1')).toEqual([first]);
  });

  it('rejects unbalanced, mixed-currency and cross-tenant postings', () => {
    const ledger = setup();
    expect(() =>
      ledger.post(
        invoiceCommand({
          lines: [
            { accountId: 'receivable', side: 'debit', amountMinor: 25001, currency: gbp },
            { accountId: 'tuition-income', side: 'credit', amountMinor: 25000, currency: gbp },
          ],
        }),
      ),
    ).toThrow('FIN_UNBALANCED_JOURNAL');
    expect(() =>
      ledger.post(
        invoiceCommand({
          idempotencyKey: 'mixed-currency-1',
          lines: [
            { accountId: 'receivable', side: 'debit', amountMinor: 25000, currency: gbp },
            {
              accountId: 'tuition-income',
              side: 'credit',
              amountMinor: 25000,
              currency: currencyCode('USD'),
            },
          ],
        }),
      ),
    ).toThrow('FIN_CURRENCY_MISMATCH');
    expect(() =>
      ledger.post(invoiceCommand({ tenantId: 'tenant-b', idempotencyKey: 'cross-tenant-1' })),
    ).toThrow('FIN_SCOPE_MISMATCH');
  });

  it('enforces creator/poster separation and assurance', () => {
    const ledger = setup();
    expect(() => ledger.post(invoiceCommand({ createdBy: 'poster' }))).toThrow('FIN_SOD_VIOLATION');
    expect(() =>
      ledger.post(
        invoiceCommand({
          idempotencyKey: 'low-assurance-1',
          postedBy: principal('low', ['ledger.journal.post'], 'aal1'),
        }),
      ),
    ).toThrow('FIN_STEP_UP_REQUIRED');
  });

  it('closes periods, blocks posting, and requires a different AAL3 reopener', () => {
    const ledger = setup();
    ledger.closePeriod(periodId, closer);
    expect(() => ledger.post(invoiceCommand())).toThrow('FIN_PERIOD_CLOSED');
    expect(() =>
      ledger.reopenPeriod(
        periodId,
        principal('closer', ['ledger.period.reopen'], 'aal3'),
        'Correction required',
      ),
    ).toThrow('FIN_SOD_VIOLATION');
    expect(ledger.reopenPeriod(periodId, reopener, 'Correction required').status).toBe('open');
    expect(ledger.post(invoiceCommand()).sourceDocumentId).toBe('invoice-1');
  });

  it('creates one linked, balanced reversal and nets account balances to zero', () => {
    const ledger = setup();
    const original = ledger.post(invoiceCommand());
    const reversal = ledger.reverse(
      original.id,
      reverser,
      'Invoice cancelled',
      'reverse:invoice-1',
    );
    expect(reversal.reversalOf).toBe(original.id);
    expect(ledger.reverse(original.id, reverser, 'Invoice cancelled', 'reverse:invoice-1')).toBe(
      reversal,
    );
    expect(ledger.balances().map((balance) => balance.balanceMinor)).toEqual([0, 0]);
    expect(() =>
      ledger.reverse(
        original.id,
        principal('poster', ['ledger.journal.post', 'ledger.journal.reverse']),
        'Second reversal',
        'reverse:invoice-1-again',
      ),
    ).toThrow('FIN_SOD_VIOLATION');
  });

  it('preserves historical as-of balances', () => {
    const ledger = setup();
    ledger.post(
      invoiceCommand({
        entryDate: '2026-06-30',
        idempotencyKey: 'invoice-post:june',
        sourceDocumentId: 'invoice-june',
      }),
    );
    ledger.post(
      invoiceCommand({
        entryDate: '2026-07-28',
        idempotencyKey: 'invoice-post:july',
        sourceDocumentId: 'invoice-july',
      }),
    );
    expect(ledger.listEntries('2026-06-30')).toHaveLength(1);
    expect(
      ledger.balances('2026-06-30').find((balance) => balance.accountId === 'receivable')
        ?.balanceMinor,
    ).toBe(25000);
    expect(
      ledger.balances('2026-07-28').find((balance) => balance.accountId === 'receivable')
        ?.balanceMinor,
    ).toBe(50000);
  });

  it('maintains balance over a deterministic high-volume property sweep', () => {
    const ledger = setup();
    for (let index = 1; index <= 500; index += 1) {
      const amount = index * 17;
      ledger.post(
        invoiceCommand({
          sourceDocumentId: `invoice-${index}`,
          idempotencyKey: `invoice-post:${index}`,
          correlationId: `corr-${index}`,
          lines: [
            { accountId: 'receivable', side: 'debit', amountMinor: amount, currency: gbp },
            { accountId: 'tuition-income', side: 'credit', amountMinor: amount, currency: gbp },
          ],
        }),
      );
    }
    const totals = ledger.balances();
    expect(totals.find((balance) => balance.accountId === 'receivable')?.balanceMinor).toBe(
      2_129_250,
    );
    expect(totals.find((balance) => balance.accountId === 'tuition-income')?.balanceMinor).toBe(
      2_129_250,
    );
  });
});
