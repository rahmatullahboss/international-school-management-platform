# ADR-004 — Direct Neon Serverless PostgreSQL Connectivity

- **Status:** Accepted for planning baseline
- **Date:** 2026-07-28

## Context

The application runs on Cloudflare Workers and requires PostgreSQL transactions, row-level security, branching for isolated development, autoscaling and serverless connection management. Neon provides a serverless driver that can connect directly from Workers over HTTP or WebSockets and also provides pooled endpoints.

## Decision

Use Neon as the initial managed PostgreSQL provider and connect directly through `@neondatabase/serverless`.

- Use HTTP queries for short, one-shot, non-interactive operations.
- Use request-scoped WebSocket `Pool` or `Client` connections for interactive multi-statement transactions.
- Use Neon pooled endpoint hostnames for bursty serverless workloads where pooling is appropriate.
- Give each Git module branch/worktree a matching Neon database branch populated only with synthetic or approved test data.
- Keep schema and migrations standard PostgreSQL behind an infrastructure adapter.
- Do not include Cloudflare Hyperdrive in the default request path.

## Rationale

- Direct Workers support removes a mandatory extra database proxy layer.
- Neon branching aligns with pull-request previews, migration rehearsals and module isolation.
- Autoscaling and scale-to-zero support early-stage cost efficiency.
- Native PostgreSQL preserves constraints, transactions, RLS, reporting and provider portability.
- Hyperdrive can still be evaluated later without changing domain code.

## Connection rules

1. A WebSocket connection must be created, used and closed inside the Worker request or background execution lifetime.
2. No global mutable database client may carry tenant or transaction state.
3. Tenant context is set transaction-locally and tested against pooled-connection reuse.
4. Commands requiring atomic multi-statement behavior use a real transaction path; they do not emulate transactions through independent HTTP queries.
5. Query time, connection time, cold-start time and pool saturation are measured separately.
6. Production suspend/autoscaling settings are selected from measured attendance, payment and publication workloads.

## Consequences

### Positive

- Fewer baseline infrastructure components
- Natural serverless and edge integration
- Isolated database branches for agents and previews
- Standard PostgreSQL application model

### Negative

- Write latency still depends on the tenant’s database region.
- WebSocket transaction lifecycle requires discipline in Workers.
- Scale-to-zero can introduce cold-start latency.
- Region, restore-window and enterprise-contract coverage must be validated before country launch.
- A future provider migration still requires tested export/restore and adapter discipline.

## Hyperdrive revisit gate

Hyperdrive may be proposed only when a production-like benchmark shows a material improvement in latency, connection behavior or cost that Neon direct and pooled endpoints do not provide. Adoption requires a new ADR, failure-mode analysis, tenant-context tests and rollback plan.
