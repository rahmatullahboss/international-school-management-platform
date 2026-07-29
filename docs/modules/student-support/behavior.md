# CARE-01 Behavior and Restorative Support

## Scope

The behavior module owns incident intake, controlled review transitions, actions, restorative plans,
follow-up, correction history and minimized student/guardian publication. It consumes SIS person and
campus identifiers without updating SIS-owned records.

## Classification and access

Routine incident workflow metadata is `CARE-C2`. Critical incidents, restorative content, follow-up
outcomes and restricted notes are `CARE-C3`. Teachers may submit a relationship-scoped incident only
when granted the named intake permission. They do not inherit restricted follow-up or restorative
content. Behavior leads remain subject to tenant, permission, purpose, current relationship and
immutable access evidence checks.

## Workflow and history

Incidents transition only through `draft → submitted → under-review → actioned/resolved → closed`.
Every transition creates append-only history. Source category, severity, occurrence, location,
student, reporter and narrative cannot be rewritten. Corrections are independent attributed records
with a reason and replacement value.

Actions support warning, reflection, restorative, restriction and support-referral workflows.
Restorative plans record goals and participant role codes rather than unrestricted participant lists.
Follow-ups are `CARE-C3`; completion records only a controlled outcome code plus an optional
restricted note.

## Publication

Student and guardian views are versioned projections, not source incident reads. Publication requires
AAL2 and an approver other than the incident reporter. Guardian retrieval additionally requires a
current verified SIS guardian-authority snapshot and portal permission. Projections contain only an
approved category label and optional action/restorative summaries. Source narrative, reporter,
location, restricted follow-up and internal review notes are excluded.

## Events and reports

Events are versioned and minimum necessary:

- `care.behavior.incident.submitted.v1`
- `care.behavior.action.assigned.v1`
- `care.behavior.follow-up.completed.v1`
- `care.behavior.publication.released.v1`

Events never include source narrative or action detail. Operational reports contain tenant-scoped
counts only and suppress cohorts below five. The database reporting view is `security_invoker` and
therefore remains constrained by forced RLS.

## Migration

`202607290203_CARE-01_behavior.sql` creates eight tenant-keyed tables in the CARE-owned `behavior`
schema. All tables enable and force RLS. Status history, corrections, publication versions and
revocations are append-only. Runtime grants contain no DELETE privilege. Incident source identity and
narrative can be corrected only through the correction ledger.
