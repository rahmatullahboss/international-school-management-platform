# PROD-08 Database Recovery Alignment v1

**Program:** `international-school-platform-v1`  
**Status:** implementation in progress; production activation is not authorized

## Objective

Prove that the current forward-only `PROD-08` SECURITY DEFINER hardening survives an isolated PostgreSQL backup/restore cycle without weakening the reviewed execution boundary.

This supplements, rather than replaces, the broader database backup/restore/rollback rehearsal. The existing recovery rehearsal proves deterministic full-database restore and rollback for the reviewed `PROD-06`/`PROD-07` readiness state. This alignment gate specifically covers the newer production-security layer.

## Source build chain

The ephemeral source database is built through:

1. canonical Wave 2 and post-integration migrations;
2. production runtime migrations;
3. `PROD-06` projection recovery;
4. `PROD-07` projection-recovery credential readiness;
5. `PROD-08` SECURITY DEFINER hygiene through `production-security-migration-manifest.json`.

The source must contain exactly 63 reviewed migration rows and exactly one `PROD-08` row.

## Preserved security contract

Before backup and after clean restore, all four remediated functions must:

- exist with the expected identity arguments;
- have an explicit function-level `search_path` beginning with `pg_catalog`;
- retain the reviewed owning schema and `pg_temp` in the path;
- deny PostgreSQL `PUBLIC` execute;
- retain `app_runtime` execute;
- keep the `PROD-08` migration ledger row.

Functions:

- `billing.allocate_document_number(uuid,text,text)`;
- `ledger.post_journal_entry(uuid,text)`;
- `ledger.close_period(uuid,text)`;
- `ledger.reopen_period(uuid,text,text)`.

## Safety boundary

- ephemeral PostgreSQL databases only;
- caller/system databases are protected from drop operations;
- process-scoped database names;
- restrictive temporary dump directory;
- owner-neutral custom-format dump;
- automatic source/restore/dump cleanup;
- no production URL, password, token or backup bytes committed.

## Production boundary

A green repository rehearsal is not evidence of real production backup scheduling, encrypted backup storage, measured RTO/RPO, deployed restore/rollback, or owner/security acceptance. Those remain external activation requirements.
