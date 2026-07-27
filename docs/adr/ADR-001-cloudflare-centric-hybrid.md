# ADR-001 — Cloudflare-Centric Hybrid Architecture

- **Status:** Accepted for planning baseline
- **Date:** 2026-07-27
- **Decision owners:** Product and architecture team

## Context

The product is an international multi-tenant K–12 SIS and School ERP. It must support child data, academic history, attendance bursts, payments, double-entry accounting, complex reporting, regional data residency and optional dedicated enterprise deployments.

Cloudflare provides an attractive global application/security platform. The key decision is whether Cloudflare D1 should also be the main authoritative database.

## Decision

Use:

- Cloudflare Workers and edge security for application delivery
- Regional Neon Serverless PostgreSQL for authoritative transactions
- Direct `@neondatabase/serverless` HTTP/WebSocket connectivity from Workers
- Neon pooled endpoints for serverless connection pooling and burst traffic
- R2 or another jurisdiction-compatible object store for files
- KV for non-authoritative configuration/cache
- Queues for asynchronous events/jobs
- Workflows for durable multi-step processes
- Durable Objects only for narrowly scoped coordination
- D1 only for optional lightweight/read-model use, not the default core database

Every tenant has a home region. Normal writes occur in that region. Avoid synchronous multi-primary writes across regions.

## Rationale

- PostgreSQL better fits finance-grade transactions, constraints, partitioning, RLS, reporting and ecosystem needs.
- D1 currently has a 10 GB maximum per paid database and each individual database executes queries on a single thread.
- D1-per-tenant would make migrations and cross-tenant operations more complex.
- Cloudflare still provides most of the operational and global-delivery benefits around PostgreSQL.
- The design preserves an enterprise path to dedicated regional databases.

## Consequences

### Positive

- Strong relational correctness and standard tooling
- Better large-tenant and reporting path
- Data residency and dedicated deployment options
- Cloudflare-native edge/security/async services remain available

### Negative

- More infrastructure than D1-only
- Database provider and regional coverage require active governance
- Write latency depends on tenant home region
- Neon HTTP/WebSocket, pooled endpoint, autoscaling and cold-start behavior need benchmarking
- Exact-country object storage may require a provider other than R2

## Guardrails

- Do not use KV/cache as source of truth.
- Do not introduce a second authoritative D1 architecture without a commercial and operational decision.
- Keep provider-specific APIs behind infrastructure adapters.
- Benchmark Neon direct HTTP, WebSocket transaction and pooled-endpoint profiles before production selection.
- Keep Hyperdrive outside the baseline; introduce it only through an ADR after measured benefit.
- Test pooled connection tenant context and RLS aggressively.

## Revisit conditions

- Cloudflare database limits/capabilities materially change.
- A starter tier has validated need for database-per-tenant D1.
- A launch country cannot be served by available regional profiles.
- Production measurements require a different topology.
