# ADR-003 — Regional Pooled Tenancy with Dedicated Enterprise Option

- **Status:** Accepted for planning baseline
- **Date:** 2026-07-27

## Context

The platform must economically serve small and mid-sized schools while supporting large school groups, privacy requirements and data-residency commitments. Database-per-campus would fragment school-group data, while one global database would weaken residency and blast-radius controls.

## Decision

- Assign every tenant to a home region.
- Use a shared PostgreSQL database/schema per region for standard tenants.
- Include `tenant_id` on every tenant-owned row.
- Enforce tenant context in the application and PostgreSQL row-level security.
- Treat a tenant as one contracted school organization/group; campuses remain scoped children of a tenant.
- Offer a dedicated database or deployment profile for enterprise/regulatory customers while preserving the same logical schema and APIs.

## Rationale

- Shared regional tenancy is cost-effective and operationally manageable.
- Regional separation supports residency and limits incidents.
- RLS provides defense in depth against application mistakes.
- Dedicated profiles provide an upgrade path without maintaining a different product.
- One tenant containing multiple campuses supports transfers, shared families/staff and consolidated finance.

## Consequences

### Positive

- Efficient onboarding and upgrades for most schools
- Strong region and tenant boundaries
- Enterprise isolation path
- Shared school-group records without cross-tenant workarounds

### Negative

- Pooled tenants can create noisy-neighbor risk
- RLS and pooled-connection context require rigorous testing
- Moving a tenant between regions/profiles is a controlled migration
- Platform-wide analytics must avoid bypassing residency and consent rules

## Controls

- Composite tenant-scoped uniqueness and foreign-key checks
- Normal application database role cannot bypass RLS
- Tenant context is transaction-local and reset safely across pooled connections
- Tenant-aware cache/object keys and queues
- Per-tenant quotas and capacity monitoring
- Separate platform-operations role and audited support access
- Regional backups, logs and object storage aligned to the deployment profile

## Migration between profiles

A pooled-to-dedicated or region migration includes backup, write control/change capture, copy, checksums, ledger and record reconciliation, routing switch, observation and destruction/retention of the old copy according to policy.

## Revisit conditions

- A regional cluster reaches capacity or unacceptable noisy-neighbor behavior.
- A customer contract requires physical/database isolation.
- Residency requirements cannot be met by the current region.
- Operational evidence supports a different sharding unit.
