# CARE-01 Learning Support

## Scope

The learning-support module owns referrals, legal-basis evidence, restricted assessments,
accommodations, support plans, goals, review cycles, restricted documents, minimized academic
projections and separately approved student/guardian publication.

## Classification and authorization

Teacher referral and classroom accommodation projections are minimized `CARE-C2` resources and
require a current student relationship plus a named permission. Assessments, need categories,
strengths, rationales, plans and reviews are `CARE-C3`. Teachers, principals, tenant administrators,
report builders, connectors and support users do not inherit source access.

An active consent or other documented legal basis is required independently of authorization.
Withdrawal or expiry denies new processing but never bypasses safeguarding, legal hold, retention or
tenant isolation.

## Assessments, accommodations and plans

Assessments preserve need categories, strengths, restricted findings and an independent reviewer.
Accommodations separate a classroom-safe instruction from the restricted rationale. Active plans
require AAL2 and an approver other than the preparer. Goals, plan/accommodation links and reviews are
append-only and versioned. Reviews require an independent approver and controlled outcome codes.

## Academic integration

CARE does not import or reference ACAD unmerged code or tables. The academic integration is a public
contract returning only active accommodation code, category and classroom instruction for one
student and one active plan version. It excludes assessment findings, diagnosis-like categories,
rationale, family information and counselling/safeguarding content. Projections expire after twelve
hours and can be regenerated only after authorization.

## Portal publication

Student and guardian views use a separately approved versioned projection. Publication requires AAL2
and an approver other than the plan preparer. Guardian retrieval additionally requires a current
verified SIS guardian-authority snapshot. Only approved support and goal summaries plus the next
review date are exposed.

## Events and reporting

Events are minimum necessary:

- `care.learning-support.referral.submitted.v1`
- `care.learning-support.plan.activated.v1`
- `care.learning-support.plan.reviewed.v1`
- `care.learning-support.academic-projection.generated.v1`
- `care.learning-support.publication.released.v1`

Events exclude classroom narratives, findings, rationales, goals and family details. Operational
reports contain tenant-scoped counts only, suppress cohorts below five and use a `security_invoker`
view constrained by forced RLS.

## Migration

`202607290206_CARE-01_learning_support.sql` creates eleven tenant-keyed tables in the CARE-owned
`learning_support` schema. All tables enable and force RLS. Basis evidence, assessments,
accommodations, plans, goals, reviews, projections, publications and restricted documents are
append-only. Runtime grants contain no DELETE privilege. The migration consumes SIS person/campus
and INT document identifiers without mutating those schemas.
