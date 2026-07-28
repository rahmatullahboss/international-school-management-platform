# SIS-01 Completion Checklist

## Foundation and isolation

- [x] Started from reviewed foundation SHA `55114f55a375d3d79dba7ea21f984b789b5dbca1`.
- [x] Used branch `module/core-sis-admissions` and fixed worktree `.worktrees/sis-01-core-sis`.
- [x] Used isolated Neon branch `agent/sis-01-core-sis`.
- [x] Preserved all pre-existing worktrees and dirty state.
- [x] Kept foundation contracts unchanged.
- [x] Forced tenant RLS on every SIS-owned base table.
- [x] Proved no-context and cross-tenant isolation.

## People and households

- [x] Person master with effective-dated names.
- [x] Tenant-scoped identifiers.
- [x] Contact points and addresses.
- [x] Multiple household memberships.
- [x] Effective-dated relationships.
- [x] Guardian legal, education, billing, communication, pickup and portal authority.
- [x] Emergency contacts and authorized pickup.
- [x] Communication preferences and consent records.
- [x] Document references.
- [x] Duplicate candidates and reviewed merge without hard deletion.

## Profiles and lifecycle access

- [x] Student profile linked to person.
- [x] Staff profile linked to person.
- [x] Effective status history.
- [x] Tenant-unique student/staff identifiers.
- [x] Profile documents.
- [x] Status-driven interactive, guardian and operational access effects.

## Admissions

- [x] Admissions cycles and enquiries.
- [x] Applicants and programme choices.
- [x] Immutable published form versions.
- [x] Versioned application responses and amendments.
- [x] Document requirements and checklist.
- [x] Reviews, interviews and confidential references.
- [x] Decisions and waitlist state.
- [x] Offers and expiration.
- [x] Enrollment contracts.
- [x] Opaque application-fee/deposit references.
- [x] Guardian-safe status view.
- [x] Replay-safe single conversion to profile/enrollment references.

## Enrollment

- [x] Effective-dated enrollment aggregate.
- [x] Overlap prevention.
- [x] Status history.
- [x] Transfer closes source and creates destination.
- [x] Withdrawal retains reason and destination.
- [x] Promotion preserves prior academic year.
- [x] Re-enrollment references a closed prior enrollment.
- [x] Previous-school history.
- [x] Admission and placement history.
- [x] Alumni transition.
- [x] Database protection against placement identity rewrite.

## Imports, reports and UI

- [x] Import staging and column mapping.
- [x] Required-field and type validation.
- [x] Duplicate source-key detection.
- [x] Dry-run and partial success.
- [x] Row-level errors and data-quality queue.
- [x] Row replay protection by source key and checksum.
- [x] Privacy-aware field-allowlisted export.
- [x] Admissions funnel report.
- [x] Enrollment summary report.
- [x] Movement report.
- [x] Guardian data-quality report.
- [x] Cross-aggregate reconciliation.
- [x] Immutable report snapshots.
- [x] Accessible admin operations workspace.
- [x] Privacy-safe family admissions workspace.
- [x] Versioned tenant- and permission-scoped SIS application service.
- [x] Private registries prevent authorization bypass.
- [x] Authenticated reviewer, decision, conversion and signer actors.
- [x] Verified guardian authority for application submission and family contract signing.
- [x] Accountable contract signer schema and migration.

## Verification and documentation

- [x] Focused tests at every milestone.
- [x] Commit and push at every milestone.
- [x] Full local Vitest suite passed: 78 tests; the credential-dependent Neon driver test is conditional locally and mandatory in same-repository CI.
- [x] Repository lint passed with zero warnings.
- [x] Boundary checks passed, including typed admin/family workspace packages.
- [x] Type checks passed.
- [x] Deterministic clean project-reference build passed.
- [x] SIS, admin/family and production workspace builds passed.
- [x] Artifact validation passed.
- [x] Chromium browser flows passed: one platform and two SIS flows.
- [x] V8 coverage recorded: 84.58% statements and 85.42% lines.
- [x] 5,000-row import load test passed.
- [x] Fresh Neon replay through migration 105 passed.
- [x] Fresh disposable PostgreSQL replay through migration 106 passed.
- [x] 59 of 59 SIS tables verified with forced RLS.
- [x] Contract signer columns and constraints verified on a fresh database.
- [x] Dependency audit passed with zero high-severity vulnerabilities.
- [x] Licence and provenance validation passed for 342 packages.
- [x] Module contracts, domain documentation, operations runbook and verification report completed.
- [x] No production mutation performed.
