# FIN-01 Billing and Accounting

FIN-01 owns billing, receivables, cashier operations, immutable double-entry accounting, reconciliation and finance reporting. It consumes opaque tenant, legal-entity, campus and person references and never writes another module's tables.

## Non-negotiable invariants

- Monetary values use integer minor units and an explicit ISO 4217 currency.
- Cross-currency arithmetic is rejected unless an explicit exchange transaction exists.
- Posted journals are balanced and immutable; correction is by linked reversal.
- Source documents, commands and provider events are tenant-scoped and idempotent.
- Every posted invoice, payment, refund, credit and deposit traces to journal entries and back.
- Allocation, receivable-subledger and control-account totals reconcile.
- Period close, journal posting/reversal, refund approval and cashier close are authorized and separation-of-duty protected.

## Public documentation

- [Finance contract v1](./contracts.md)
- [Database migration and recovery runbook](./runbook.md)
- [Completion report](./completion-report.md)
