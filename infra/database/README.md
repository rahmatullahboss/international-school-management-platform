# Database foundation

## Connection profiles

- `DATABASE_URL`: direct Neon hostname for one-shot HTTP queries and request-scoped WebSocket transactions.
- `DATABASE_URL_POOLED`: pooled Neon hostname for measured burst workloads. It is not an authorization boundary.
- Hyperdrive is intentionally excluded from the baseline.

No database client or tenant context may be stored in global mutable state. WebSocket `Pool`/`Client` instances are created, used, and closed inside one Worker execution lifetime.

## Migration policy

Migrations are ordered by `YYYYMMDDHHMM_<stream>_<description>.sql`. Each stream edits only its owned schemas and uses expand/migrate/contract for incompatible changes. Every migration must run on an empty Neon branch and on an upgraded branch, then record its identifier in `platform.schema_migration`.

The initial approved extensions are:

- `pgcrypto`, for PostgreSQL-native random UUID generation and reviewed cryptographic utilities.
- `citext`, for bounded case-insensitive identifiers such as normalized domains or login aliases.

Any additional extension requires portability, security, restore, and provider-support review.

## Roles and RLS

`app_runtime` is a non-login, non-`BYPASSRLS` role used to verify policies. Production login credentials are provisioned separately through managed secrets. Tenant context is always transaction-local through `set_config('app.tenant_id', ..., true)`.

## Branch lifecycle

Each Git stream uses one matching Neon branch with synthetic data only. Record project ID, branch ID, parent branch ID, creation time, PostgreSQL version, migration version, and Git SHA in the progress tracker. Never reset or delete a stream branch until reviewed integration and reachability verification are complete.
