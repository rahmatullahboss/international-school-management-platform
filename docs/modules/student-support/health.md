# CARE-01 Health and Clinic

## Scope

The health module owns student health profiles, conditions, allergies, medication orders and
administrations, immunization evidence, care plans, clinic encounters, dispositions, restricted
document references and minimum emergency projections. It consumes canonical person, campus and
document identifiers through SIS and foundation public contracts and never updates those records.

## Authorization and legal basis

Every operation passes through the CARE need-to-know service with tenant, active membership,
named permission, controlled purpose, current student relationship, classification and immutable
access evidence. Health source records are `CARE-C3`. Emergency projections are `CARE-E` and expose
only approved minimum fields. A broad principal, tenant administrator, teacher, report builder,
connector or support role does not inherit health access.

A current legal-basis record is required independently of authorization. Supported basis codes are
consent, vital interests, legal obligation and public task. Consent withdrawal or expiry denies new
processing but never bypasses safeguarding, legal hold, retention or tenant-isolation rules.

## Medication safety

Medication orders preserve medication and ingredient codes, dose, route, schedule, validity,
prescriber reference and authorization evidence. Administration requires AAL2 and the dedicated
`care.health.medication.administer` permission. An active allergy matching either the medication or
an ingredient blocks administration. The operation is idempotent per tenant.

Administration records are append-only. Corrections create independently attributed correction
records with a reason and replacement value; the source administration is not rewritten. Database
triggers and restricted grants provide the same immutability boundary under `app_runtime`.

## Clinic and emergency workflows

Clinic encounters open with an authorized clinician, campus, controlled reason category and
restricted narrative. Closing records a disposition and optional follow-up. A closed encounter
cannot be rewritten. Public events include category and outcome metadata only and never include
narrative, diagnosis, allergy reaction, medication detail or family information.

The emergency projection contains only blood group, life-threatening allergy labels, active
medication summaries and approved emergency actions. It excludes source narrative and routine care
plan details. Offline delivery must use the separate encrypted, device-bound and expiring `CARE-E`
bundle contract.

## Reporting

Operational reports contain tenant-scoped counts for active profiles, encounters, dispositions and
medication administration outcomes. Cohorts smaller than the configured threshold are suppressed.
The PostgreSQL operational view is `security_invoker`, remains subject to forced RLS and emits only
groups of at least five encounters.

## Migration

`202607290202_CARE-01_health.sql` creates twelve tenant-keyed tables in the CARE-owned `health`
schema. Every table enables and forces RLS. Tenant identity is preserved in all keys and references.
The runtime role has no DELETE privilege and cannot update medication administration, correction,
legal-basis, allergy, condition, medication order, immunization, care-plan or document history.

## Events

- `care.health.profile.created.v1`
- `care.health.allergy.recorded.v1`
- `care.health.medication.ordered.v1`
- `care.health.medication.administered.v1`
- `care.health.encounter.closed.v1`

All events are minimum necessary, tenant scoped, versioned and synthetic-data tested.
