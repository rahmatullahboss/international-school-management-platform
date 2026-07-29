# CARE-01 Wellbeing and Counselling

## Scope

The wellbeing module owns pastoral referrals, counselling cases and confidential sessions, risk
assessments, support plans and reviews, safeguarding escalation references and minimized portal
publication. It consumes canonical SIS people/campus identifiers and communicates with safeguarding
through opaque references and minimum events only.

## Access and legal basis

Relationship-scoped teachers may submit a `CARE-C2` pastoral referral with the named permission.
Triage, counselling cases, session notes, risk, plans and escalation are `CARE-C3`. Only the assigned
counselor may create or read session content; privacy and security reviewers remain separately
controlled. Every operation requires tenant, membership, permission, purpose, relationship and
immutable access evidence.

An active consent or other documented legal basis is required independently of authorization.
Withdrawal and expiry deny new processing. Consent never bypasses tenant isolation, safeguarding,
legal hold or retention policy.

## Counselling and corrections

Counselling sessions record controlled session type and outcome plus a restricted note. Session
records are append-only. Corrections create attributed records with a reason and replacement outcome
or date; the source note is never rewritten. Database grants and triggers enforce the same boundary.

High or immediate risk assessment and safeguarding escalation require AAL2. Escalation events contain
only urgency, controlled reason category and an opaque intake reference. Risk factors, protective
factors, required actions and counselling narrative are excluded from events and notifications.

## Plans and publication

Support plans are versioned and require approval before activation. Reviews use controlled outcomes
and optional restricted notes. Student and guardian publication is a separately approved projection,
requires AAL2 and an approver other than the assigned counselor, and exposes only an approved support
summary and optional next-review date. Guardian access also requires a verified current SIS authority
snapshot.

## Reporting and migration

Reports contain only tenant-scoped counts and suppress cohorts below five. The PostgreSQL aggregate
view is `security_invoker` and remains under forced RLS.

`202607290204_CARE-01_wellbeing.sql` creates ten tenant-keyed tables in the CARE-owned `wellbeing`
schema. All tables enable and force RLS. Basis evidence, sessions, corrections, risk assessments,
reviews, escalation and publication are append-only. Runtime grants contain no DELETE privilege.

## Events

- `care.wellbeing.referral.submitted.v1`
- `care.wellbeing.risk.updated.v1`
- `care.wellbeing.safeguarding-escalation.requested.v1`
- `care.wellbeing.publication.released.v1`
