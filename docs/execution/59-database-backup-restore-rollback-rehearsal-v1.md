# Database Backup / Restore / Rollback Rehearsal v1

**Program:** `international-school-platform-v1`  
**Status:** repository rehearsal in implementation; production activation is not authorized

## Objective

Add a deterministic, non-production PostgreSQL recovery rehearsal that proves the current reviewed database shape and representative durable data can be backed up, restored into a clean database, deliberately drifted, and rolled back by restoring the same immutable backup again.

This rehearsal must never connect to or mutate a real production database. CI uses temporary databases inside the existing ephemeral PostgreSQL service only.

## Source database construction

The rehearsal creates a uniquely named temporary source database and builds it through the same reviewed migration/verification chain used by CI:

1. canonical Wave-2 migrations plus post-integration migrations through the current 56-migration post-integration gate;
2. production runtime migrations `PROD-01` through `PROD-04`;
3. production-readiness migrations `PROD-06` and `PROD-07` plus the existing controlled-recovery and recovery-credential rehearsals.

The source therefore represents the current repository database contract instead of a hand-written fixture schema.

A dedicated deterministic recovery sentinel is then inserted into normal application tables so restore verification proves durable row data is present, not only schema objects.

## Backup contract

The rehearsal uses PostgreSQL `pg_dump` custom format with:

- an owner-neutral database dump (`--no-owner`);
- a private temporary directory created with restrictive permissions;
- an explicit SHA-256 digest of the produced dump;
- no committed backup artifact;
- cleanup on both success and failure.

PostgreSQL login roles are cluster-global and are not contained in a normal database dump. This rehearsal therefore validates the application database backup/restore boundary; production credential/role provisioning and rotation remain separate activation evidence governed by the existing runtime/recovery credential controls.

## Restore verification

The first restore target is a newly created empty database. `pg_restore --exit-on-error --no-owner` must complete successfully.

A deterministic database fingerprint is computed for source and restore from:

- ordered migration ledger rows;
- application schema/table identities and RLS/forced-RLS flags;
- ordered RLS policy metadata;
- SECURITY DEFINER function identities;
- counts for representative identity, tenant, outbox/audit, runtime projection, dead-letter/recovery and Admissions tables;
- the deterministic recovery sentinel.

The restored fingerprint must equal the source fingerprint exactly.

The rehearsal also asserts:

- the migration ledger contains the expected current reviewed streams including `PROD-06` and `PROD-07`;
- representative forced-RLS protections remain present;
- reviewed runtime and recovery functions still exist;
- the sentinel data matches exactly after restore.

## Rollback rehearsal

To prove recovery from post-restore drift without touching the source database:

1. deliberately modify only the first restored database's sentinel and insert a rollback-drift marker;
2. prove its fingerprint no longer matches the source baseline;
3. prove the source fingerprint remains unchanged;
4. drop the drifted restore target;
5. create a second clean restore target from the same backup artifact;
6. prove the second restore fingerprint equals the original source baseline and the drift marker is absent.

This is a database-backup rollback rehearsal, not an application release rollback. Deployed Worker/version rollback remains an external deployment concern.

## Safety requirements

- unique temporary database names per process;
- refuse to use `postgres`, `template0`, `template1` or any caller-supplied production database as source/restore names;
- no destructive command against the caller's `PGDATABASE`;
- source, restore databases and dump directory always removed by `trap`;
- no secrets or raw database URLs written to logs or artifacts;
- no backup bytes committed to Git;
- no production authorization change.

## CI gate

A dedicated CI step runs after the existing projection recovery database rehearsal and before Admissions/live-Neon/build gates. It must fail closed on any dump, restore, fingerprint, RLS, migration-ledger, sentinel or rollback mismatch.

## Remaining external recovery evidence

Repository rehearsal success is necessary but not sufficient for production authorization. The production activation evidence gate `backupRestoreRollback` remains pending until an isolated production-like environment proves the real backup schedule/retention, encrypted storage, restore integrity, credential handling, recovery timing and release rollback procedure, and owner/security reviewers accept that external evidence.
