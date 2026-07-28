# Migration Studio

Migration Studio turns a one-off data move into a repeatable, versioned and auditable project. It composes the secure import foundation but owns the project/version, source-file, reconciliation and cutover evidence needed for controlled migration.

## Source templates

A source template identifies a source product, supported entities, expected file patterns, required columns and natural keys. Published `<template>@<version>` records are immutable. Product-specific templates describe source structure; they do not write target-domain tables or claim compatibility beyond their tested profile.

## Project versions

A tenant migration project records its source system, target environment and lifecycle. Each project version freezes:

- exact source-template version;
- mapping snapshot;
- transformation snapshot;
- SHA-256 configuration checksum;
- creator and creation time.

Creating another project version with identical configuration produces the same checksum, enabling repeatable comparison without reusing mutable configuration.

## File evidence and repeatable runs

Every source file records its name, media type, byte length and SHA-256 checksum. Re-registering the same name and content is idempotent; the same name with different content is rejected so evidence cannot silently change.

A run key is derived from project/version, configuration checksum and the sorted source-file checksums. Starting the same run twice returns the existing run rather than applying the migration again. Actual row/domain execution remains delegated to the import/export and domain-command contracts.

## Reconciliation

Reconciliation is recorded per run, entity and metric. Re-recording the same metric replaces its current evidence while preserving the run identity. A run completes as:

- `completed` when all current reconciliation metrics pass;
- `completed-with-errors` when any current metric differs.

Expected production migration profiles should include people/relationship counts, active and historical enrolments, class rosters, attendance/grade history, finance balances, file counts/checksums and external identifiers where applicable.

## Cutover evidence

A cutover references one exact completed migration run and contains:

- explicit checklist;
- required rollback plan;
- reconciliation gate;
- decision, signer, time and optional note.

Approval is blocked while any reconciliation metric fails or a checklist item is incomplete. Rejection may be recorded without pretending the project is ready. Approval changes project status to `cutover-approved`; it does not itself deploy, switch traffic, close the source system or mutate production.

## Database migration

`202607280104_INT-01_migration_studio` creates the `migration_studio` schema with:

- immutable source templates;
- tenant projects and version snapshots;
- source file checksum evidence;
- repeatable runs keyed by configuration and file checksums;
- reconciliation metrics;
- cutover checklist, rollback and sign-off evidence.

All tenant-owned tables use forced row-level security through `app.tenant_id`. Source templates are globally readable configuration and immutable after publication.

## Operational sequence

1. Approve a tested source-template version.
2. Create a tenant migration project and immutable project version.
3. Scan and register source files; verify names and checksums.
4. Run dry-run imports and domain reconciliation repeatedly.
5. Freeze the exact configuration/file set and start the repeatable run.
6. Record all required reconciliation metrics.
7. Complete the cutover and rollback checklist.
8. Obtain explicit authorised sign-off.
9. Perform any actual production cutover only through a separately authorised deployment/operations procedure.
