# EXP-01 Milestone 2 — Admin Experience

## Objective

Deliver one permission-aware administration surface that composes reviewed module read models without reading or mutating another module’s private tables. The surface must help school leaders move from school/campus scope to evidence, exceptions, approvals, governed search, bulk work and traceable record pages.

## Surface brief

- **Mode:** Operate.
- **Primary job:** resolve the highest-risk permitted school exception with its source and current state visible.
- **Primary action:** open the selected exception or approval in its owning module workflow.
- **Information order:** scope and timestamp, readiness definitions, priority exceptions, approvals, governed search and record evidence.
- **Safety constraints:** filter before rendering, do not reveal unauthorized module labels or counts, use generic masked states, make AAL2 requirements explicit before action, and keep bulk actions within one compatible operation group.
- **Visual direction:** extend the Operational Ledger authority from `PRODUCT.md` and `DESIGN.md`; use ruled ledgers and tables rather than disconnected statistic cards.

## Implementation

`AdminOperationsHome` provides:

- capability-filtered readiness definitions with source links and timestamps;
- severity/due-time sorted cross-module exception queues;
- AAL2 step-up states that preserve the task but prevent unsafe action;
- capability-scoped approval inbox projection;
- governed search that filters results before labels or counts render;
- bulk operations only for one compatible selected group and an explicit permission;
- loading, error and empty states in the task location.

`AdminRecordWorkspace` provides:

- generic restricted/not-found behavior that does not echo supplied sensitive content;
- capability-filtered fields and related records;
- evidence history and explicit assurance requirements for actions;
- links back to the owning search or queue rather than private cross-module mutation.

## Verification intent

Focused rendering tests cover filter-before-sort, governed search privacy, compatible bulk selection, AAL2 step-up, evidence/source rendering, unavailable-record masking and field/related-record capability filtering. Full CI and browser evidence remain required before the milestone checkpoint is passed.
