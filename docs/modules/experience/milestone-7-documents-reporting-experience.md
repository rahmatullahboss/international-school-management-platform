# EXP-01 Milestone 7 — Governed Documents and Reporting Experience

## Scope

This milestone delivers authorised document access, evidence-defined dashboards, a versioned standard report catalog, asynchronous report jobs, drill-down links and permission-aware exports across the administration, teacher, guardian and student experiences. It consumes tenant-, principal- and capability-scoped read models; it does not read private domain tables, reveal storage object keys or bypass module-owned report definitions.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 6 evidence commit `f487f84bec880ebfc9f8614ac26dd0ab1bc895d3`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Impeccable version: `4.0.2`.
- Mode: Operate; evidence-led, recipient-scoped, reproducible, bounded and non-disclosing.

## Surface brief

- **Audience:** authorised school operators, teachers, guardians and students using desktop and mobile devices across multilingual and intermittent-network contexts.
- **Job:** understand governed metrics, open reproducible drill-downs, run authorised report definitions, follow queued work and obtain eligible documents through short-lived grants.
- **Primary action:** resolve the highest-priority governed exception or continue the most relevant report/document task available to the current principal.
- **Constraints:** exact tenant/principal/capability filtering, metric provenance, format-level permissions, bounded row counts, idempotent jobs, opaque document grants, publication and malware-scan gates, expiry, RTL, keyboard use, reduced motion and narrow screens.
- **Memorable moment:** a dashboard exception, its definition/source/as-of evidence and its governed drill-down remain connected while another tenant, principal or restricted document cannot influence the screen.

## Contract

`DocumentsReportingWorkspace` accepts governed metrics, report definitions, job status and document artifacts. `selectReportingRecords` filters tenant, principal visibility and capability before sorting, totals or rendering. `availableReportFormats` applies output-format permissions independently of report-read permission. `ReportJobQueue` provides idempotent submission, explicit queued/running/completed/failed state, tenant isolation and definition row limits. `DocumentAccessBroker` issues only opaque, short-lived download grants after tenant, principal, capability, publication, scan, expiry and TTL checks; it never returns a storage key or reuses a source URL.

## Implementation checkpoint

- Evidence-defined dashboard metrics with state, definition, source, as-of timestamp and governed drill-down.
- Versioned standard report catalog with filters, source, row bound and permission-aware CSV/XLSX/PDF formats.
- Idempotent report-job lifecycle with progress, terminal failure evidence and bounded completion artifacts.
- Tenant-isolated job snapshots and duplicate-submission protection.
- Published/clean/non-expired document availability with classification and checksum evidence.
- Opaque short-lived document download grants with 30–900 second TTL policy.
- Shared persona wrappers for admin, teacher, guardian and student applications.
- Loading, recoverable error and non-disclosing empty states.

## Design critique, audit and polish

- Extends the Operational Ledger rather than introducing a generic analytics-card dashboard.
- Leads with exceptions, freshness and provenance; no metric appears without a definition, source and drill-down.
- Uses written status and evidence labels; colour does not carry meaning alone.
- Keeps report jobs in a labelled keyboard-focusable overflow region and document availability in a direct ledger.
- Uses logical CSS properties, mobile single-column collapse and RTL-compatible alignment.
- Avoids gradients, decorative shadows, excessive pills, nested cards and unnecessary motion.
- Browser evidence covers mobile RTL layout, single-column metric collapse, contained job-table overflow and keyboard focus.

## Verification

Implementation checkpoint `7a7aa79b278fc25b4cfa9bd93efce80f0d914966` passed local format, lint, architecture boundaries, typecheck, full build, focused documents/reporting tests `7/7`, full repository tests `494/494` with one credential-gated local skip, EXP browser tests `5/5` and execution-artifact validation.

GitHub CI run `30461899197` passed format, lint, architecture boundaries, repository typecheck, all tests, fresh 40-migration PostgreSQL replay, live Neon driver, build, dependency audit, licences, provenance, every Chromium suite and execution-artifact validation. No production deployment or production database mutation was performed.

## Next milestone

Milestone 8 — PWA shell, low-bandwidth mode, offline-safe approved workflows, browser/mobile/accessibility/RTL/localization/performance tests, telemetry and support runbooks.
