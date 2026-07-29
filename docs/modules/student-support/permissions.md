# CARE-01 Permissions and Role Restrictions

## Authorization rule

A role name never authorizes a CARE operation by itself. Every request must satisfy all applicable
conditions:

1. exact tenant and active membership;
2. authenticated principal and linked person where required;
3. named permission;
4. controlled purpose;
5. current relationship, publication decision or case membership;
6. classification-specific assurance;
7. field minimization;
8. immutable access evidence for sensitive reads;
9. legal basis or consent where the domain requires it;
10. independent approval where the actor prepares and another principal must approve.

Failures for `CARE-C3`, `CARE-C4` and existence-sensitive projections are returned as not found unless
a step-up instruction is safe to expose.

## Role and action matrix

| Persona | Permitted minimum | Explicitly prohibited by default |
| --- | --- | --- |
| Student | own released projection | source health, counselling, safeguarding, behavior or learning records |
| Guardian | released projection for a currently verified SIS authority relationship | source records, safeguarding case existence, another guardian’s subjects |
| Teacher | relationship-scoped behavior, wellbeing or learning referral; active classroom accommodation projection | health source, counselling notes, learning findings/rationale, safeguarding reads, medication, export |
| Nurse / clinician | assigned health profiles and encounters; medication only with named permission and AAL2 | counselling, safeguarding case access, unrelated students, unrestricted export |
| Behavior lead | assigned incidents, actions, restorative and follow-up workflow | health, counselling sessions, safeguarding cases, self-approved publication |
| Counselor | assigned counselling case and sessions | another counselor’s sessions, safeguarding case content without membership, self-approved publication |
| Learning-support practitioner | assigned referrals, assessments, accommodations and plans | unrelated students, teacher-wide source access, self-approved active plan/publication |
| Safeguarding lead | write-only intake triage and explicitly assigned cases | tenant-wide unrestricted case search, self-approved assessment/disclosure/closure |
| Safeguarding case member | one active tenant/case/principal/purpose membership | other cases, expired/revoked membership, a different purpose |
| Principal / head | approved aggregates and operational metadata only | automatic `CARE-C3`/`CARE-C4` inheritance |
| Tenant administrator | configuration and aggregate operations | sensitive student-record inheritance |
| Privacy reviewer | exact rights request, export, disclosure and retention review | operational care decisions or unrestricted browsing |
| Security reviewer | access evidence, incident and break-glass review | ordinary source content unless separately authorized |
| Support user | technical metadata and correlation references | student content, case existence and credential use |
| Report builder | approved aggregate views | source rows, small-cohort inference and narrative |
| Connector credential | exact approved route, tenant, scope, categories, purpose and expiry | interactive user routes, wildcard categories, safeguarding by default |

## High-risk actions requiring AAL2

- medication administration and correction;
- emergency projection access;
- safeguarding case opening and case access;
- case membership grant/revocation;
- high or immediate wellbeing risk assessment;
- safeguarding escalation, mandatory reporting and external disclosure;
- active support-plan approval and restricted publication approval;
- break-glass activation and review;
- restricted export, legal-rights response and deletion/retention exception approval.

## Independent approval

The requester/preparer must differ from the approver for:

- break-glass grants;
- safeguarding assessment, active safety plan, report, disclosure and closure;
- behavior, wellbeing and learning-support publication;
- active learning-support plan and accommodation approval;
- restricted exports and connector disclosure scopes;
- legal-hold release or irreversible deletion authorization.

## Break-glass restrictions

Break-glass is short-lived, AAL2-only, reasoned, resource-specific, purpose-specific and independently
approved. It may permit an emergency read but never permits membership administration, export,
disclosure approval, legal-hold release, retention deletion, audit mutation, connector authorization or
publication approval. Every use creates immutable access evidence and a review obligation.

## Permission naming

Permissions use `care.<domain>.<resource>.<action>` where possible. Projection permissions are
separate from source permissions. Examples:

- `care.health.read`
- `care.health.medication.administer`
- `care.behavior.follow-up.read`
- `care.wellbeing.session.read`
- `care.safeguarding.read`
- `care.safeguarding.membership.manage`
- `care.safeguarding.disclosure.approve`
- `care.learning-support.assessment.read`
- `care.learning-support.academic-projection.read`
- `care.portal.read`
- `care.reports.aggregate.read`

No wildcard permission is accepted for a restricted operation.
