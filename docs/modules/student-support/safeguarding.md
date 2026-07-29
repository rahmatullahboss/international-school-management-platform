# CARE-01 Safeguarding

## Scope

The safeguarding module owns write-only concern intake, existence-masked case files, explicit
case-membership grants, chronology, assessments, safety plans, mandatory reports, exact external
disclosures, restricted document references and independently approved closure review. Every source
record is `CARE-C4`.

## Write-only concern intake

A current staff relationship may submit a concern only with the exact
`care.safeguarding.concern.create` permission and the controlled `mandatory-reporting` or
`safeguarding-assessment` purpose. The caller receives an opaque idempotent receipt. The intake API
has no reporter read, search or list method. Case existence remains masked from teachers, principals,
tenant administrators, support users, report builders and connectors.

At the database boundary, concern intake permits tenant-scoped inserts while SELECT requires a
safeguarding-lead session, AAL2 and `safeguarding-assessment` purpose.

## Case bootstrap and membership

The first case shell can be opened only by an AAL2 safeguarding lead with the named case-open
permission and current relationship. Opening creates a short-lived lead membership. Every later
case operation resolves current membership from the authoritative store and requires matching tenant,
case, principal and exact purpose. A stale caller snapshot cannot survive revocation.

PostgreSQL case policies check `app.tenant_id`, `app.principal_id` and `app.purpose_code` against
`safeguarding.case_memberships`. Case existence is therefore protected in the application and
database layers.

## Immutable history

Concern sources, status events, chronology, assessments, safety plans, mandatory-report approvals,
disclosure approvals, status events, restricted documents and closure reviews are append-only. Case
identity cannot be rewritten, and case status changes require a version increment. Runtime grants
contain no DELETE privilege.

## High-risk controls

Case membership changes, assessments, mandatory reports, external disclosure and closure require
AAL2. Assessments, active safety plans, reports, disclosures and closure require a distinct reviewer
or approver. Mandatory reporting runs only under `mandatory-reporting` purpose and matching case
membership. External disclosure requires the approved transfer purpose, exact fields, exact recipient
and unexpired authorization.

## Portal, events and reporting

There is no default student or guardian safeguarding publication API. Consent or guardianship alone
never opens a safeguarding case.

Minimum events are:

- `care.safeguarding.concern.received.v1`
- `care.safeguarding.case.opened.v1`
- `care.safeguarding.membership.revoked.v1`
- `care.safeguarding.mandatory-report.submitted.v1`
- `care.safeguarding.case.closed.v1`

Events exclude reporter, allegation, narrative, chronology, factors, actions and recipient details.
Operational reports contain counts only, suppress cohorts below ten, and use a `security_invoker`
view constrained by RLS.

## Migration

`202607290205_CARE-01_safeguarding_domain.sql` extends only the CARE-owned `safeguarding` schema.
It consumes canonical SIS person/campus identifiers and INT document identifiers without mutating
those schemas. All domain tables enable and force RLS.
