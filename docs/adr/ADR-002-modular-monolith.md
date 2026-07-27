# ADR-002 — Domain-Oriented Modular Monolith Before Microservices

- **Status:** Accepted for planning baseline
- **Date:** 2026-07-27

## Context

Student lifecycle, enrollment, attendance, timetable, grading, billing and accounting share transactions, identifiers and historical rules. The initial team is expected to be small, while the product scope is large.

Starting with many microservices would introduce distributed transactions, duplicated policy logic, event-ordering problems, multiple deployment surfaces and difficult debugging before module boundaries are proven.

## Decision

Build one deployable application as a modular monolith with:

- Explicit domain modules
- Module-owned tables
- Public application interfaces
- No direct cross-module table mutation
- Transactional outbox and versioned events
- Permission vocabulary and data classification per module
- Separate asynchronous Worker/consumer deployment only for background workloads where useful

## Rationale

- Allows atomic transactions for critical flows
- Easier local development, testing and deployment
- Lower observability and operational burden
- Supports product discovery while preserving future boundaries
- Prevents premature distributed-system complexity

## Consequences

### Positive

- Faster and safer core development
- Easier tenant-isolation and migration testing
- Shared transaction for applicant conversion, enrollment and finance source documents where necessary
- Clear future extraction path through interfaces/events

### Negative

- Requires discipline to prevent a “big ball of mud”
- One deployment can contain many modules
- Independent scaling is limited until a module is extracted
- Database ownership rules must be reviewed continuously

## Extraction criteria

A module becomes a separate service only with evidence of:

- Independent scale/latency need
- Strong isolation/security requirement
- Different runtime need
- Separate team ownership/release cadence
- Material failure isolation benefit
- Regulatory deployment boundary

Likely early extractions are notification delivery, import/export, document generation, timetable solving, analytics and search indexing—not student identity or the ledger.

## Guardrails

- Every module publishes ownership and contracts.
- Cross-module access goes through application interfaces or events.
- Shared utility packages cannot contain hidden domain rules.
- Cyclic module dependencies fail architecture checks.
- Service extraction requires a new ADR and migration plan.
