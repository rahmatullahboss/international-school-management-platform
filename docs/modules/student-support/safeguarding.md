# CARE-01 Safeguarding

## Scope

The safeguarding module owns write-only concern intake, existence-masked case files, explicit
case-membership grants, chronology, assessments, safety plans, mandatory reports, exact external
disclosures, restricted document references and independently approved closure review. Every source
record is `CARE-C4`.

## Write-only concern intake

A teacher, nurse, counselor or other current student relationship may submit a concern only with the
exact `care.safeguarding.concern.create` permission and the controlled `mandatory-reporting` or
`safeguarding-assessment` purpose. The caller receives an opaque, idempotent receipt. The intake
contract does not provide a read/search/list path to the reporter. AAL2 safeguarding leads may triage
the queue; every other broad role receives a masked not-found result.

At the database boundary, `app_runtime` has an INSERT policy for tenant-scoped concern intake. SELECT
is allowed only when the session persona is `safeguarding-lead`, assurance is `aal2`, and purpose is
`safeguarding-assessment`.

## Case bootstrap and need-to-know membership

The first case shell can be opened only by an AAL2 safeguarding lead with the named case-open
permission, safeguarding purpose and a current student relationship. Opening creates a short-lived
lead membership. Every later case read or write requires an active membership matching tenant, case,
principal and exact purpose. Revocation is immediate: services resolve the current membership from
the authoritative store rather than trusting a stale caller snapshot.

Case-bound PostgreSQL RLS checks `app.tenant_id`, `app.principal_id` and `app.purpose_code` against the
active membership table for every select, insert and update. Case existence is therefore protected in
both the application and database layers.

## Immutable case history

Concern sources, chronology, assessments, mandatory-report approvals, disclosure approvals,
restricted documents and closure reviews are append-only. Case identity cannot be rewritten; case
status changes require a version increment. Superseding assessments and plans create new versions.
Mandatory-report and disclosure lifecycle changes are independent append-only status events.

Chronology and assessment narratives never enter events, notifications, exports or operational
reports. Safety plans contain controlled actions and responsible role codes, not unrestricted staff or
family directories.

## AAL2, independent approval and purpose binding

Case opening, membership management, high-risk assessment, mandatory reporting, disclosure and
closure require AAL2. Assessments, active safety plans, reports, disclosures and closure require an
independent reviewer or approver.

Mandatory reporting runs only in a `mandatory-reporting` session with a matching case membership.
External disclosure runs only in an `approved-data-transfer` or approved mandatory-reporting session
with a matching membership. Field categories and recipient must exactly match the approved scope,
and disclosure approval expires. Broader generation is denied.

## Portal, events and reporting

There is no default student or guardian safeguarding publication API. A future legal-rights response
must use a separately reviewed, case-specific release contract; consent or guardianship alone never
opens a case.

Minimum events:

- `care.safeguarding.concern.received.v1`
- `care.safeguarding.case.opened.v1`
- `care.safeguarding.membership.revoked.v1`
- `care.safeguarding.mandatory-report.submitted.v1`
- `care.safeguarding.case.closed.v1`

Events contain opaque identifiers and controlled category/status metadata only. They exclude reporter,
allegation, narrative, chronology, factors, actions and recipients. Operational reports use counts
only, suppress cohorts below ten, and run through a `security_invoker` view constrained by case
membership RLS.

## Migration

`202607290205_CARE-01_safeguarding_domain.sql` extends the CARE-owned `safeguarding` schema with
concern, case and restricted-history tables. All domain tables enable and force RLS. Runtime grants
contain no DELETE privilege. The migration consumes canonical SIS person/campus identifiers and INT
document identifiers without mutating their schemas.
