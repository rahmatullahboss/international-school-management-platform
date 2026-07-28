import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrations = [
  {
    id: '202607280101_FIN-01_ledger',
    path: 'packages/modules/ledger/migrations/202607280101_FIN-01_ledger.sql',
  },
  {
    id: '202607280102_FIN-01_billing',
    path: 'packages/modules/billing/migrations/202607280102_FIN-01_billing.sql',
  },
  {
    id: '202607280103_FIN-01_payments',
    path: 'packages/modules/billing/migrations/202607280103_FIN-01_payments.sql',
  },
  {
    id: '202607280104_FIN-01_reporting',
    path: 'packages/modules/billing/migrations/202607280104_FIN-01_reporting.sql',
  },
] as const;

function sql(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('FIN-01 migration replay and safety contract', () => {
  it('keeps a stable forward-only migration order with schema ledger evidence', () => {
    expect(migrations.map((migration) => migration.id)).toEqual([
      '202607280101_FIN-01_ledger',
      '202607280102_FIN-01_billing',
      '202607280103_FIN-01_payments',
      '202607280104_FIN-01_reporting',
    ]);
    for (const migration of migrations) {
      const source = sql(migration.path);
      expect(source).toContain(`'${migration.id}'`);
      expect(source).toContain("'FIN-01'");
      expect(source).toContain('INSERT INTO platform.schema_migration');
      expect(source).toContain('ON CONFLICT (migration_id) DO NOTHING');
    }
  });

  it('contains no destructive rollback primitives and preserves forced tenant RLS', () => {
    for (const migration of migrations) {
      const source = sql(migration.path);
      expect(source).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(source).not.toMatch(/\bTRUNCATE\b/i);
      expect(source).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(source).not.toMatch(/\bDELETE\s+FROM\s+(ledger|billing)\./i);
    }
    const ledger = sql(migrations[0].path);
    const billing = sql(migrations[1].path);
    const payments = sql(migrations[2].path);
    expect(ledger).toContain('FORCE ROW LEVEL SECURITY');
    expect(billing).toContain('FORCE ROW LEVEL SECURITY');
    expect(payments).toContain('FORCE ROW LEVEL SECURITY');
  });

  it('pins SECURITY DEFINER search paths and protects immutable financial records', () => {
    for (const migration of migrations.slice(0, 3)) {
      const source = sql(migration.path);
      const securityDefinerCount = source.match(/SECURITY DEFINER/g)?.length ?? 0;
      const pinnedSearchPathCount = source.match(/SECURITY DEFINER SET search_path/g)?.length ?? 0;
      expect(pinnedSearchPathCount).toBe(securityDefinerCount);
    }
    expect(sql(migrations[0].path)).toContain('FIN_POSTED_JOURNAL_IMMUTABLE');
    expect(sql(migrations[1].path)).toContain('FIN_POSTED_INVOICE_LINE_IMMUTABLE');
    expect(sql(migrations[2].path)).toContain('FIN_PROVIDER_EVENT_IMMUTABLE');
  });

  it('uses security-invoker reporting views so underlying RLS remains authoritative', () => {
    const reporting = sql(migrations[3].path);
    expect(reporting.match(/WITH \(security_invoker = true\)/g)).toHaveLength(4);
    expect(reporting).toContain('billing.receivable_subledger_v');
    expect(reporting).toContain('billing.unapplied_cash_v');
    expect(reporting).toContain('ledger.trial_balance_v');
    expect(reporting).toContain('ledger.general_ledger_v');
  });
});
