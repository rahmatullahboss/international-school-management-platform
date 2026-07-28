# SIS-01 Module Contract

**Stream:** SIS-01 — Core SIS and Admissions  
**Contract version:** 1  
**Starting base:** `55114f55a375d3d79dba7ea21f984b789b5dbca1`  
**Git branch:** `module/core-sis-admissions`  
**Neon branch:** `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`)  
**Owned PostgreSQL schemas:** `people`, `admissions`, `student_lifecycle`

## Boundaries

SIS owns person and family master records, guardian authority, admissions workflows and historically correct student/enrollment lifecycle records. It consumes foundation tenant, campus, identity, audit, outbox, idempotency, document and workflow contracts without altering them. Finance references such as deposits remain opaque external references; SIS does not maintain balances or post journals.

## Public references

- `PersonReference`: opaque person ID, tenant ID, display name, status and aggregate version.
- `GuardianAuthoritySnapshot`: guardian/student IDs, effective dates, verified authority flags and portal-access decision.
- `ApplicationReference`: applicant, admissions cycle, immutable form version, status and version.
- `EnrollmentReference`: student profile, campus, program, academic year, optional grade level, effective dates, status and version.

Consumers must not join internal SIS tables or depend on undocumented status fields. Cross-module consumers use these references, versioned APIs or events.

## Application-service boundary

`SisApplicationService` is the versioned `v1` module API used by SIS feature components and future integration adapters. It owns no application shell or persona navigation; those are composed by EXP-01. Internal registries are private so callers cannot bypass authorization.

Every public operation receives a `SisRequestContext` containing tenant, authenticated principal, assurance level and correlation ID. The service derives reviewers, decision actors, converters and contract signers from that authenticated context rather than accepting spoofable actor IDs.

Published permissions are:

- `sis.people.read`, `sis.people.manage`, `sis.guardian.manage`;
- `sis.admissions.read`, `sis.admissions.manage`, `sis.admissions.review`, `sis.admissions.convert`;
- `sis.enrollment.read`, `sis.enrollment.manage`;
- `sis.import.manage`, `sis.export.read`;
- `sis.family.application.read`, `sis.family.contract.sign`.

A submitting guardian requires current verified legal or education authority. A family contract signature additionally requires the authenticated person to be the submitting guardian and records both account and person signer evidence.

## API rules

- Commands are tenant-scoped, authorization-checked and idempotent where retries can occur; a reused key with a different payload is rejected.
- Queries are bounded and return only permitted fields.
- Submitted application responses are immutable; amendments create new versions.
- Guardian views require a current verified authority with portal access.
- Applicant conversion and offer acceptance are replay-safe; issued offers and contracts cannot be replaced by conflicting reissue requests.
- Enrollment history is append-oriented; transfer, withdrawal, promotion and re-enrollment create explicit records.
- Import batches and rows are tenant-scoped, validate before apply and replay by stable source key plus checksum.
- Exports require an explicit purpose and field allowlist; restricted documents require separate authorization.
- Report snapshots are immutable and retain parameters, generation time and accountable actor.
- Reconciliation produces actionable issues rather than repairing or deleting records automatically.

## Event catalog

Events use the foundation envelope and additive versioning.

### People

- `sis.people.person-created.v1`
- `sis.people.person-merged.v1`
- `sis.people.guardian-authority-changed.v1`

### Admissions

- `sis.admissions.application-submitted.v1`
- `sis.admissions.decision-recorded.v1`
- `sis.admissions.offer-accepted.v1`
- `sis.admissions.applicant-converted.v1`

### Student lifecycle

- `sis.lifecycle.student-profile-created.v1`
- `sis.lifecycle.enrollment-created.v1`
- `sis.lifecycle.student-transferred.v1`
- `sis.lifecycle.student-withdrawn.v1`

Payloads contain identifiers and minimum workflow facts only. Sensitive restriction text, confidential references and document contents are excluded.

## Security and history invariants

1. Every authoritative row is tenant-owned and protected by forced RLS for `app_runtime`.
2. A login account is not a person; guardian access requires both identity membership and effective guardian authority.
3. Merge preserves aliases, source mappings and an audit record; the absorbed person becomes non-authoritative.
4. One accepted offer can produce at most one conversion and one initial enrollment.
5. Historical enrollment/status records are never overwritten by rollover.
6. Withdrawal or transfer closes the prior active enrollment before a new active period begins.
7. Development and preview branches use synthetic data only.
