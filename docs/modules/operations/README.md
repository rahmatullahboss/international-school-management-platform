# School Operations ERP (`OPS-01`)

## Scope and ownership

OPS-01 owns school operating workflows and their operational source records. It does not own student master data, journals, payment allocation, localization infrastructure or external integration internals.

- SIS references are opaque `personRef`, `staffRef`, `studentRef` and guardian references.
- FIN references are opaque fiscal-period, cost-centre, account, budget, payable and settlement references.
- INT integration is through versioned public event/import/export contracts.
- Operational corrections append a superseding record, reversal or new event; they never rewrite posted finance history.

## Delivered checkpoints

### HR and staff

- Tenant/legal-entity/campus-scoped staff profiles linked to opaque SIS person references
- Versioned employment contract history and explicit supersession
- Leave workflow with AAL2 approval and requester/approver separation of duties
- Idempotent daily staff attendance and exception reporting
- Versioned domain events, append-only audit evidence and forced-RLS migration

### Procurement, budgets and payables

- Suppliers, finance-referenced budget envelopes and line-level requisitions
- Submission/approval workflow with AAL2 and separation of duties
- Purchase orders, budget commitments, partial/full goods receipt and quantity controls
- Supplier invoice duplicate prevention and three-way match status
- Immutable, versioned `FinancePayableSourceDocument` export contract; FIN remains authoritative for payable posting, journal creation, payment and settlement
- Budget commitment release, operational spend reporting, audit/events and forced-RLS migration

### Inventory and assets

- Item catalogue, scoped locations and append-only/idempotent stock movements
- On-hand and availability derived from movement history; no mutable balance table
- Reservations, atomic transfers and approved stock-count variance adjustments
- Low-stock, negative-stock and minor-unit inventory valuation reports
- Asset register, custody assignments, straight-line depreciation schedule and maintenance history
- AAL2/separation-of-duties disposal approval, asset reporting, audit/events and forced-RLS migrations

### Library

- Bibliographic titles, physical copies and patrons linked by opaque SIS person references
- Patron-type loan limits, policy-driven due dates and renewal controls
- Ordered holds with priority enforcement and ready-copy workflow
- Overdue, damaged and lost-copy fine source documents exported through a versioned FIN boundary
- Circulation/overdue/collection reports, audit/events and forced-RLS migration

### Transport

- Fleet and licensed-driver registers with inspection and maintenance readiness
- Ordered routes/stops and capacity-controlled rider assignments using opaque SIS references
- Trip start/completion controls, boarding/alighting events and resource-conflict prevention
- Trip completion blocks on unreconciled riders and persists critical safeguarding exceptions
- Capacity utilisation, inspection, trip and incident reports, audit/events and forced-RLS migration

### Hostel and cafeteria

- Hostel buildings, rooms and beds with date-effective, non-overlapping resident allocations
- Checkout history, visitors, safeguarding/health/discipline/facility incidents and maintenance reporting
- Cafeteria menu items linked through opaque inventory references with explicit allergen metadata
- Date-effective meal plans, entitlement/daily-limit checks, allergen conflict prevention and idempotent service confirmation
- Versioned pay-per-meal FIN charge source documents, occupancy/uptake reports, audit/events and forced-RLS migrations

### Activities and trips

- Clubs/activities with capacity, fair waitlists, cancellation promotion and optional fee source records
- Trip plans with opaque budget/medical references, capacity and consent-gated participant states
- Hazard-level risk assessments with AAL2 and recorder/approver separation of duties
- Guardian consent, idempotent attendance, incident reporting and trip readiness reports
- Versioned participant-charge and trip-payable FIN source documents, audit/events and forced-RLS migration

### API, admin UI and contract hardening

- Typed operations summary/report/command routes with tenant, principal, campus, correlation and idempotency context
- Permission-filtered application façade with wildcard grants, AAL2 enforcement and duplicate handler/provider protection
- Exception-first operations command centre with source-labelled metrics, owned queues and module drill-down
- Semantic landmarks, keyboard focus, responsive labelled tables, RTL logical CSS, reduced motion and forced-colour support
- Escaped content and safe internal/fragment link policy including protocol-relative URL rejection
- Central permission catalogue, requester/approver role bundles and high-risk step-up metadata
- Versioned operations event-name/envelope validation applied to the shared event factory
- Ordered seven-step OPS migration manifest with ownership and forced-RLS replay guards
- Impeccable context, critique, audit, accessibility, responsive/RTL, hardening and polish evidence in `ui-impeccable-evidence.md`

## Public finance integration contract

`FinancePayableSourceDocument` version `1.0` contains only the approved operational source facts required by FIN: tenant/legal entity/campus, supplier, PO and budget references, dates, minor-unit amounts, currency, approval evidence, correlation and idempotency keys. OPS receives only an opaque FIN document reference after submission.

No OPS migration references FIN-owned tables. This keeps the source-document boundary enforceable before and after serial integration.

## Verification state

- HR focused tests: 8 passing
- Procurement focused tests: 9 passing
- Inventory/assets focused tests: 10 passing
- Library focused tests: 9 passing
- Transport focused tests: 9 passing
- Hostel/cafeteria focused tests: 11 passing
- Activities/trips focused tests: 11 passing
- Previously executed combined OPS domain tests: 67 passing
- Previously executed API/admin UI focused tests before the workspace runner became unavailable: 10 passing
- Finalization guard tests added: API 6, application 4, admin UI 5, permissions 4, events 3 and migration manifest 3
- Final OPS test inventory: 92 tests; the 25 finalization tests require one clean external run before `GATE-OPS-COMPLETE`
- TypeScript, ESLint and architecture boundaries were passing before the final API/permission/event files; a clean rerun is still required
- Dependency audit last verified at 0 vulnerabilities
- GitHub repository has no PR-triggered workflow/status check configured for this branch
- Neon migration application remains pending foundation/Wave 1 schema composition on the isolated OPS branch; prior attempts rolled back atomically and persisted no schema/data mutation

## Exact next checkpoint

Run `npm ci`, the 92 OPS tests, TypeScript, ESLint, architecture boundaries, deterministic build and migration replay on a workspace/CI runner. Resolve any failures, then record the final SHA and mark the module completion gate.
