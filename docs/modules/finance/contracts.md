# Finance Contract v1

## Money, precision and rounding

`Money` is an integer `amount` in the currency's minor unit plus an uppercase ISO 4217 `currency`. Operations require matching currencies. Tax, discount and allocation calculations declare a rounding policy; the default tie rule is half-even. Remainders are distributed deterministically by largest remainder and stable input order.

## Opaque references and source documents

Finance stores opaque tenant, legal-entity, campus and person IDs. Optional snapshots are display-only. A source document declares a stable document ID/type/number, tenant, legal entity, state, currency, amount and idempotency key. Its trace lists generated journal entries and correlation/causation IDs.

## Numbering

Numbering sequences are transactionally allocated within tenant/legal-entity/campus scope. A command idempotency key maps to one allocation; retry returns that allocation. Gaps are permitted after rollback or cancellation and numbers are never reused.

## Authorization and separation of duties

Every command/query includes a tenant and legal-entity scope. High-risk permissions require AAL2; fiscal-period reopen requires AAL3. The same principal cannot create and post the same journal/invoice, verify a payment and approve its refund, close and reopen the same period, or close a cashier session and approve its deposit.

## Stable errors

Public errors use `FIN_*` codes including forbidden, scope mismatch, step-up required, SoD violation, currency mismatch, invalid amount, unbalanced journal, closed period, duplicate command, invalid state, refund exceeds available and not found.

## Events

The v1 event catalogue is:

- `finance.invoice.posted.v1`
- `finance.credit-note.posted.v1`
- `finance.payment.received.v1`
- `finance.payment.allocated.v1`
- `finance.refund.approved.v1`
- `finance.journal.posted.v1`
- `finance.journal.reversed.v1`
- `finance.fiscal-period.closed.v1`
- `finance.bank-reconciliation.completed.v1`

The envelope includes event ID/name/version, tenant/legal entity, aggregate ID/version, occurred time, producer, correlation/causation IDs, idempotency key, classification and payload. Events are append-only and replay-safe; consumers deduplicate by event ID and idempotency key. Financial records follow the legal entity's statutory retention policy.

## Commands and queries

Commands are idempotent and return the same aggregate/result for a repeated key. Queries are bounded, scoped and accept an explicit `asOf` date or fiscal period for historical reports. Finance UI imports services/read models only and never a database client.
