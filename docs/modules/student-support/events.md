# CARE-01 Events and Safe Notifications

## Event rules

CARE events are versioned, tenant scoped and minimum necessary. Event payloads contain controlled
category/status metadata and opaque aggregate identifiers. They do not contain clinic narrative,
allergy reaction detail, medication dose, counselling note, behavior narrative, learning finding,
restricted rationale, safeguarding allegation, reporter identity, chronology, family detail or exact
external recipient.

Every event is written through the foundation outbox contract with correlation and causation evidence.
Consumers must authorize their own projection; event possession never grants record access.

## Published events

### Health

- `care.health.profile.created.v1`
- `care.health.allergy.recorded.v1`
- `care.health.medication.ordered.v1`
- `care.health.medication.administered.v1`
- `care.health.encounter.closed.v1`

### Behavior

- `care.behavior.incident.submitted.v1`
- `care.behavior.action.assigned.v1`
- `care.behavior.follow-up.completed.v1`
- `care.behavior.publication.released.v1`

### Wellbeing

- `care.wellbeing.referral.submitted.v1`
- `care.wellbeing.risk.updated.v1`
- `care.wellbeing.safeguarding-escalation.requested.v1`
- `care.wellbeing.publication.released.v1`

### Safeguarding

- `care.safeguarding.concern.received.v1`
- `care.safeguarding.case.opened.v1`
- `care.safeguarding.membership.revoked.v1`
- `care.safeguarding.mandatory-report.submitted.v1`
- `care.safeguarding.case.closed.v1`

### Learning support

- `care.learning-support.referral.submitted.v1`
- `care.learning-support.plan.activated.v1`
- `care.learning-support.plan.reviewed.v1`
- `care.learning-support.academic-projection.generated.v1`
- `care.learning-support.publication.released.v1`

## Safe notification contract

Notifications use a generic route token and a non-sensitive action label. Example:

> A student-support task requires your attention. Sign in to review the authorized item.

A notification may include tenant branding, a generic due date and an opaque route token. It must not
include student name, health condition, medication, behavior category, counselling status,
learning-support need, safeguarding existence, allegation, reporter, recipient or attachment name.

Opening the notification always starts a fresh authorization decision. A route token is not a bearer
credential and does not contain a direct object-storage URL.

## Emergency and escalation messages

An emergency message may say that an approved emergency response is required and may route an AAL2
clinician to the minimum `CARE-E` projection. A safeguarding alert may say that an assigned case task
requires review, but only after the recipient already has active case membership. Notifications do not
create membership.

## Delivery evidence

Delivery evidence records tenant, notification template key, recipient account reference, route-token
reference, channel, status, attempt count, correlation ID and timestamp. It excludes the restricted
source payload. Failed or dead-letter notifications are visible to authorized operations users without
revealing source content.
