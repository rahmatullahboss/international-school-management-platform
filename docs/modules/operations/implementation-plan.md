# OPS-01 School Operations ERP implementation plan

## Execution identity

- Stream: `OPS-01`
- Git branch: `module/school-operations`
- Fixed worktree: `.worktrees/ops-01-operations`
- Reviewed Wave 1 base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Neon branch: `agent/ops-01-operations` (`br-polished-voice-ax2fsdfg`)
- Production deployment or production database mutation: prohibited

## Contract and ownership constraints

1. Own only the OPS domain packages, operations admin surface, operations tests and operations documentation.
2. Consume SIS, FIN and INT through exported TypeScript/public event contracts only. Never query or mutate their internal schemas.
3. Operational payables and budget commitments are source documents. Finance remains authoritative for posting, journals, payment allocation and settlement.
4. Every tenant-owned table uses `tenant_id`, explicit indexes, enabled and forced RLS, and an `app_runtime` policy.
5. State transitions requiring approval use explicit permissions, assurance level checks and separation of duties.
6. Material state changes append audit records and publish versioned outbox events. Corrections are new records or reversals, never destructive rewrites.
7. All Neon verification uses synthetic data on the OPS branch or a temporary child replay branch.

## Known frozen-contract gap

The exact reviewed base does not contain root `PRODUCT.md` or `DESIGN.md`, and no reachable Git history contains those paths. OPS-01 will not invent or modify foundation-owned contract files. UI work will follow the committed design contract in `docs/design/01-product-design-input.md`, `docs/design/02-ui-delivery-workflow.md`, `docs/design/03-agent-design-contract.md`, the incumbent admin shell, and the Impeccable workflow. The missing root artifacts remain a handoff issue for Foundation/INTEG ownership.

## Milestones

### 1. HR and staff

- Staff profiles linked by opaque SIS person references
- Positions, employment contracts, campus assignments, leave requests, approvals and staff attendance
- Tenant/campus permissions, separation of duties, audit and outbox events
- HR operational reports and migration/RLS tests

### 2. Procurement, budgets and payables

- Suppliers, requisitions, approval workflow, purchase orders, receipts and supplier invoices
- Budget envelopes, commitments, releases and variance reporting
- Immutable operational payable source-document export to FIN public integration contract
- Three-way match, duplicate invoice prevention and approval thresholds

### 3. Inventory and assets

- Item catalogue, stock locations, immutable stock movements, reservations, transfers and counts
- Asset register, assignment, maintenance, depreciation schedule and disposal approval
- Reconciliation, low-stock, valuation and custody reports

### 4. Library

- Bibliographic records, copies, patrons by opaque person reference, loans, renewals, returns and holds
- Policy-driven due dates, overdue/fine source records, lost/damaged workflow and circulation reports

### 5. Transport

- Vehicles, drivers, routes, stops, rider assignments, trip runs, attendance, incidents and maintenance
- Capacity, safeguarding, route utilisation and exception reports

### 6. Hostel and cafeteria

- Buildings, rooms, beds, allocation/checkout, visitors, incidents and maintenance
- Menus, allergens, meal plans, orders, service confirmation and meal entitlement controls
- Occupancy, safeguarding, meal uptake and exception reports

### 7. Activities and trips

- Clubs, activities, events, trip plans, budgets, risk assessments, consent, attendance and incident records
- Capacity/waitlist, safeguarding, medical note reference and trip settlement source documents

### 8. APIs, admin UI and unified verification

- Typed Hono route factory over public OPS services
- Responsive, RTL-safe, accessible operations command centre and detail views
- Impeccable context, critique/audit, hardening and polish evidence
- Cross-domain journey tests, permission tests, migration/RLS checks, fresh-branch replay and complete repository verification

## Checkpoint protocol

For each milestone: write failing tests, implement the smallest coherent slice, run focused tests, run typecheck/lint/boundary checks, update this module documentation and the OPS tracker section, commit, push, and continue automatically.
