# Foundation Operations Runbook

## Environments and secrets

Cloudflare environment variables may contain non-sensitive routing metadata only. Database credentials, OAuth credentials, signing keys, webhook secrets, and provider tokens must be stored through managed secret facilities and must never appear in Git, logs, screenshots, test fixtures, generated provenance, or issue text.

The baseline uses the direct Neon serverless driver:

- HTTP `neon()` for one-shot parameterized queries.
- Request-scoped WebSocket `Pool`/`Client` for interactive transactions.
- Every Pool and Client must be closed within the Worker execution.
- Hyperdrive is not part of the foundation baseline.

## Neon branch lifecycle

1. Create one Neon branch for each assigned Git stream from its reviewed parent.
2. Record the project ID, branch name/ID, parent branch ID, PostgreSQL version, migration IDs, Git SHA, and synthetic-data status in the progress tracker.
3. Apply migrations only to the assigned child branch during implementation.
4. Run empty-state, upgrade/replay, RLS negative, and tenant-isolation tests.
5. Do not reset or delete a branch while reviewed evidence or an open integration depends on it.
6. Before deletion, verify the Git checkpoint is reachable, the schema is represented by committed migrations, and no unique evidence remains only on the branch.

## Migration procedure

Use ordered, stream-owned migrations and expand/migrate/contract for incompatible changes.

Before application:

- review table rewrites, locks, defaults, backfills, indexes, constraints, and foreign-key order;
- ensure identifiers are unique and ordered;
- confirm the target is the intended child branch;
- capture a recovery point or preserve the current branch when destructive risk exists.

After application:

- verify `platform.schema_migration`;
- re-run the migration to prove idempotent replay where supported;
- inspect RLS enablement, forced RLS, policies, grants, and the `app_runtime` role;
- run positive same-tenant and negative no-context/cross-tenant checks.

## Recovery

For application regressions, roll back the Worker/web deployment to the last verified artifact. For database regressions, prefer a forward corrective migration. When data or schema recovery is necessary, create or restore a Neon branch from the appropriate point-in-time recovery position, validate it independently, and switch traffic only through an approved change. Never use an unpreserved branch reset as an incident shortcut.

## Tenant isolation checks

The runtime role must remain non-login and non-`BYPASSRLS`. Tenant context must be transaction-local:

```sql
SELECT set_config('app.tenant_id', '<tenant-uuid>', true);
```

Required checks:

- no tenant context returns zero tenant-owned rows;
- tenant A cannot read or write tenant B records;
- tenant-owned cache keys begin with `tenant:<tenant-id>:`;
- object keys begin with `tenants/<tenant-id>/`;
- privileged support access has a reason, approval, expiry, and audit trail.

## Operational verification

```bash
npm ci
npm run verify
npm run test:browser
npm audit --audit-level=high
npm run licenses:check
npm run provenance:generate
```

Run `npm run test:neon` only in a secret-enabled environment scoped to a non-production branch. Do not print or inspect the connection string.

## Incident priorities

1. Stop cross-tenant access or credential exposure immediately.
2. Preserve logs, correlation IDs, deployment versions, migration IDs, and branch state.
3. Disable or revoke affected credentials and privileged grants.
4. Restore safe service using a reviewed deployment or recovery branch.
5. Reconcile outbox/idempotency/audit evidence before replaying commands.
6. Document root cause, affected tenants/data classes, corrective migration, and prevention controls.
