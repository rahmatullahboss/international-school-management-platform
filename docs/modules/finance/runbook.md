# FIN-01 Operations, Migration and Recovery Runbook

This runbook covers the FIN-01 billing and accounting schemas, domain services, reconciliation controls, finance user interfaces and recovery procedures. It is intentionally forward-only: posted financial records are never edited or deleted to undo a deployment.

## Scope and safety boundary

FIN-01 owns the `ledger` and `billing` schemas, the finance feature packages and finance-facing UI components. It consumes tenant, legal-entity, campus and person references as opaque identifiers. It does not write tables owned by other modules.

The following invariants are mandatory during normal operations and recovery:

- All monetary values are integer minor units with an explicit supported currency.
- A posted journal has at least two positive lines, one currency and equal debit and credit totals.
- Posted journal lines, provider events and posted invoice lines are immutable.
- Corrections use credit notes, unallocations, refunds or linked reversals.
- Every command and provider event is tenant-scoped and idempotent.
- Receivable and unapplied-cash subledgers reconcile to their control accounts.
- Period close/reopen, posting, refund approval and cashier deposit approval enforce step-up authentication and separation of duties.
- Tenant context is required; forced row-level security denies no-context and cross-tenant reads.

## Deployment identity

- Git branch: `module/finance-ledger`
- Fixed worktree: `.worktrees/fin-01-finance`
- Reviewed foundation SHA: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Neon project: `lingering-brook-52999532`
- Neon branch: `agent/fin-01-finance`
- Neon branch ID: `br-broad-butterfly-ax8ywyqj`
- Neon parent: `main` (`br-cool-wildflower-axsot8l1`)

Never apply FIN-01 migrations directly to Neon `main` during module development or rehearsal.

## Migration prerequisites and order

The reviewed foundation migrations must exist first:

1. `202607280001_FND-01_foundation`
2. `202607280002_FND-01_tenancy`
3. `202607280003_FND-01_identity_policy`
4. `202607280004_FND-01_transactional_primitives`
5. `202607280005_FND-01_shared_services`

Apply FIN-01 migrations in this exact order:

1. `packages/modules/ledger/migrations/202607280101_FIN-01_ledger.sql`
2. `packages/modules/billing/migrations/202607280102_FIN-01_billing.sql`
3. `packages/modules/billing/migrations/202607280103_FIN-01_payments.sql`
4. `packages/modules/billing/migrations/202607280104_FIN-01_reporting.sql`

Each migration records itself in `platform.schema_migration` with `stream_id = 'FIN-01'`. Re-running a completed migration is expected to be harmless because tables, indexes, functions, triggers, policies, views and migration-ledger inserts are defined idempotently.

## Pre-deployment gate

Run from `.worktrees/fin-01-finance`:

```bash
npm ci
npx vitest run tests/finance
npx playwright test -c tests/finance/playwright.config.ts
npx eslint packages/modules/billing packages/modules/ledger apps/web-admin/src/features/finance apps/web-family/src/features/finance tests/finance --max-warnings=0
npx tsc -p packages/modules/billing/tsconfig.json --noEmit
npx tsc -p packages/modules/ledger/tsconfig.json --noEmit
npx tsc -p tests/finance/tsconfig.json
npx prettier --check packages/modules/billing packages/modules/ledger apps/web-admin/src/features/finance apps/web-family/src/features/finance tests/finance docs/modules/finance
```

Do not deploy when any finance test, migration safety test, reconciliation assertion or browser test fails.

## Safe migration procedure

1. Confirm the target database is the intended Neon child branch, not `main`.
2. Record the branch ID, current migration ledger and current Git SHA in the change ticket.
3. Create a Neon restore point or time-based branch before applying the first FIN migration.
4. Apply migrations one file at a time in the documented order, inside transactions where supported by the execution tool.
5. After every migration, query `platform.schema_migration` and confirm exactly one new expected row.
6. Run the smoke checks below under an administrator connection and under `SET LOCAL ROLE app_runtime` with a synthetic tenant context.
7. Do not promote the branch until ledger, subledger and RLS checks pass.

## Post-migration smoke checks

### Migration ledger

```sql
SELECT migration_id, stream_id, applied_at
FROM platform.schema_migration
WHERE stream_id = 'FIN-01'
ORDER BY migration_id;
```

Expected IDs are `202607280101` through `202607280104` in order.

### Forced RLS

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity,
       c.relforcerowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('ledger', 'billing')
  AND c.relkind = 'r'
ORDER BY n.nspname, c.relname;
```

Every tenant-owned finance table must have both RLS flags enabled. Under `app_runtime` without `app.tenant_id`, finance tables must return zero rows. With tenant A context, tenant B rows must remain invisible.

### Trial balance

```sql
SELECT currency,
       SUM(debit_minor) AS total_debit_minor,
       SUM(credit_minor) AS total_credit_minor
FROM ledger.trial_balance_v
GROUP BY currency;
```

For each currency, debit and credit totals must match.

### Receivable reconciliation

```sql
SELECT currency, SUM(outstanding_minor) AS receivable_subledger_minor
FROM billing.receivable_subledger_v
GROUP BY currency;
```

Compare the result with the receivable control-account balance from `ledger.trial_balance_v`. The difference must be zero.

### Unapplied cash reconciliation

```sql
SELECT currency, SUM(unapplied_minor) AS unapplied_subledger_minor
FROM billing.unapplied_cash_v
GROUP BY currency;
```

Compare the result with the unapplied-cash control account. The difference must be zero.

## Daily operational controls

### Opening checks

Before cashier or billing operations begin:

- Confirm the active fiscal period is open.
- Confirm document sequences exist for invoice, credit-note, receipt and refund numbers.
- Confirm the receivable and unapplied-cash reconciliations have zero difference as of the prior business day.
- Confirm there are no stale provider events awaiting investigation and no payment intent using an expired provider reference.
- Confirm only one open cashier session exists per cashier and legal entity.

### End-of-day checks

- Close every cashier session and record counted cash and variance.
- Require a different principal to approve each cashier deposit.
- Reconcile imported bank-statement lines to verified payment records.
- Review unapplied cash, pending refunds, failed provider events and unmatched statement lines.
- Run receivable reconciliation, unapplied-cash reconciliation and trial balance.
- Preserve the reports and approval evidence with the business date and legal entity.

### Period close

1. Resolve all reconciliation differences.
2. Review draft invoices, draft credit notes, pending refunds and unmatched bank lines.
3. Run trial balance, income statement, balance sheet and fiscal-period summary.
4. Obtain the configured approval.
5. Close the period using a principal with `ledger.period.close` and AAL2 or stronger assurance.
6. Verify new invoice, payment, credit-note and manual-journal posting is rejected for the closed period.

A reopen requires AAL3, a reason of at least eight characters and a principal different from the closer. Record the reason and approval in the incident/change ticket.

## Incident playbooks

### Duplicate provider webhook

Provider event identity is `(tenant, legal entity, provider, provider_event_id)`. Re-send the original payload and signature through the normal verification path. A valid duplicate returns the existing payment result and must not create another receipt or journal. Do not manually insert a payment to compensate for a retry.

### Provider amount or currency mismatch

Quarantine the event, retain the payload hash and provider reference, and do not post it. Compare the event with the payment intent and provider dashboard. Correct the upstream intent or obtain a provider-side reversal; never change the posted amount in place.

### Reconciliation difference

1. Stop period close and finance export for the affected legal entity.
2. Determine whether the difference is in invoices/credits/allocations, payments/refunds or journal posting.
3. Trace source documents through `source_document_type`, `source_document_id`, correlation ID and journal entry ID.
4. Correct with a credit note, unallocation, refund or journal reversal.
5. Re-run the report for the same `asOf` date and then for the current date.
6. Record before/after totals and authorizers.

### Cashier variance

Close the session with the actual counted cash. Do not overwrite expected cash. Investigate receipt, refund and reversal activity. Deposit only the counted amount; use an approved journal for any accepted variance according to the institution's accounting policy.

### Refund blocked by allocation

A refund can settle only from unapplied cash. Reverse the affected allocation with a reason, confirm the invoice balance is restored, then submit the refund for an independent approver. The payment verifier and refund approver must be different principals.

### Posted document correction

- Draft invoice: void it.
- Posted invoice: issue a bounded credit note.
- Posted allocation: unallocate with reason and reversal journal.
- Posted payment: reverse only when allocation and refund balances are clear.
- Posted journal: create a linked reversal; never update or delete the original.

### Numbering gap

Document numbers are never reused. A gap after rollback, cancellation or failed downstream work is acceptable and must be explained by the number-allocation/idempotency evidence. Do not decrement a sequence.

## Backup, restore and replay

FIN-01 uses forward recovery rather than destructive down migrations.

1. Create a Neon branch from the required point-in-time or the pre-change restore point.
2. Confirm the foundation migration ledger and tenant directory are present.
3. Apply missing FIN migrations in order. Re-running already recorded migrations must not alter posted records.
4. Restore application secrets and provider configuration outside the database; do not copy secrets into migration files.
5. Replay only events absent from the immutable provider-event ledger. Deduplicate by provider event ID and provider payment reference.
6. Replay source commands with their original idempotency keys. A repeated key must return the same document/payment/journal result.
7. Run RLS, trial-balance, receivable and unapplied-cash smoke checks.
8. Compare aging, statements, income statement and balance sheet with the retained pre-incident evidence for the same `asOf` date.
9. Obtain finance and platform approval before redirecting traffic.

The automated replay test executes the same finance command log in two fresh runtimes and requires identical normalized statements and financial reports. The high-volume test also repeats every provider event and verifies that 1,000 invoice/payment/allocation chains create exactly one payment and three journals per chain.

## Forward-fix policy

Do not write a down migration that drops finance tables, disables RLS or deletes posted records. When a migration is defective:

- stop promotion;
- branch from the pre-migration restore point when no new accepted transactions exist; or
- publish a new numbered forward migration that preserves data and audit history;
- repeat the full migration, RLS, reconciliation and browser gates.

## Monitoring and alerting

Alert on:

- non-zero receivable or unapplied-cash reconciliation difference;
- unbalanced trial balance;
- provider signature failures or amount/currency mismatch;
- duplicate provider payment references with different event IDs;
- payment events that cannot be posted because the period is closed;
- pending refund age above institution policy;
- open cashier session beyond the business day;
- cashier variance outside institution tolerance;
- unmatched bank-statement lines beyond the reconciliation window;
- any attempt to mutate an immutable journal, invoice line, provider event or payment record;
- no-context or cross-tenant access attempts.

## Evidence retention

Retain source documents, approvals, provider-event hashes, journal traces, reconciliation reports, period-close reports, exports and recovery evidence according to the legal entity's statutory retention policy. Finance exports must be access-controlled and protected against spreadsheet formula execution.
