# SIS Imports, Data Quality, Reports and User Interfaces

## Import workflow

SIS imports are staged before any authoritative write. Each batch records the tenant, entity type, column mapping, dry-run flag and tenant-scoped idempotency key. Each row has a stable source key, normalized values, checksum, status, row-level errors and result reference.

The pipeline supports required-field checks, type transforms, duplicate source-key detection, partial success and replay-safe application. Replaying an applied row with the same tenant, entity, source key and checksum returns the prior result rather than creating another record. Invalid rows create actionable data-quality issues instead of being silently discarded.

Privacy-aware exports require a stated purpose and explicit field allowlist. Restricted documents are excluded unless the caller has separately authorized their inclusion. Every persisted export request is auditable.

## Reports and reconciliation

The reporting layer includes:

- admissions funnel, conversion, offer-acceptance and decision-time measures;
- enrollment counts by status, campus, programme and academic year;
- transfer, withdrawal, promotion, re-enrollment and alumni movement summaries;
- guardian-authority and household data-quality measures;
- reconciliation across converted applications, student profiles, enrollments and guardian portal authority.

Generated report snapshots preserve parameters, accountable actor and generation time. Both the domain object and PostgreSQL record are immutable.

## Admin user interface

`apps/web-admin/src/features/sis/SisAdminWorkspace.tsx` provides one accessible operational workspace for:

- queue severity, ownership, status, due date and direct review action;
- people and household lookup;
- admissions checklist and application review;
- student/enrollment register with guardian-authority readiness;
- import validation and data-quality queues;
- report and reconciliation entry points.

Statuses and severity are written as text and are not conveyed by colour alone. Tables include captions and scoped headers; forms include explicit labels; live queue state uses status semantics.

## Family user interface

`apps/web-family/src/features/admissions/FamilyAdmissionsWorkspace.tsx` exposes only guardian-safe application information: status explanation, checklist, timeline, offer, contract, deposit status and support. Confidential review notes, reviewer identities and restriction references are not rendered.

## Database and verification

Migration `202607280105_SIS-01_operations` creates seven forced-RLS tables for import batches/rows, data-quality issues, export audit, report snapshots and reconciliation runs/issues.

Synthetic Neon verification on `agent/sis-01-core-sis` showed:

- no tenant context: zero import rows visible;
- Tenant A context: one own import batch and report snapshot visible, zero foreign rows;
- report snapshot update rejected by the immutable database trigger.

Focused validation passed 11 tests, including a 5,000-row import staging test, SSR UI assertions, privacy checks and migration-contract checks. No production branch or production data was mutated.
