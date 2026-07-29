# CARE Restricted API v1

## Contract

CARE publishes a bounded application contract under `/v1/care`. The route registry is source
controlled in `packages/modules/safeguarding/src/api.ts`. Every route declares classification,
permission, permitted purposes, minimum assurance, audience, idempotency, query bounds, existence
masking and whether narrative may appear in a response.

Sensitive routes never infer permission from an application role. The gateway validates context,
active membership, exact permission, exact purpose and AAL2 where required before a domain query is
executed. `GET` routes are bounded to a maximum page size of 100.

## Response envelopes

Successful responses use:

```json
{
  "version": "v1",
  "correlationId": "opaque-correlation-reference",
  "data": {}
}
```

Errors use a stable code and generic message. Existence-masked resources return `CARE_NOT_FOUND` and
never reveal whether a student, concern, case, assessment or publication exists.

## Primary routes

| Route ID | Method and path | Source/projection | Key controls |
| --- | --- | --- | --- |
| `health.profile.read` | `GET /v1/care/health/profiles/:profileId` | source `CARE-C3` | direct-care purpose, relationship, immutable read evidence |
| `health.encounter.create` | `POST /v1/care/health/encounters` | source `CARE-C3` | idempotency and legal basis |
| `health.medication.administer` | `POST /v1/care/health/medication-administrations` | source `CARE-C3` | AAL2, allergy check, exact order, idempotency |
| `health.emergency.read` | `GET /v1/care/emergency/:studentPersonId` | minimum `CARE-E` projection | AAL2, emergency purpose, short expiry |
| `behavior.incident.create` | `POST /v1/care/behavior/incidents` | intake `CARE-C2` | current relationship and idempotency |
| `behavior.follow-up.read` | `GET /v1/care/behavior/follow-ups/:followUpId` | source `CARE-C3` | behavior lead, relationship, masked denial |
| `wellbeing.referral.create` | `POST /v1/care/wellbeing/referrals` | intake `CARE-C2` | legal basis, relationship and idempotency |
| `wellbeing.session.read` | `GET /v1/care/wellbeing/sessions/:sessionId` | source `CARE-C3` | assigned counselor only |
| `safeguarding.concern.create` | `POST /v1/care/safeguarding/concerns` | write-only `CARE-C4` intake | opaque receipt; no reporter read/list |
| `safeguarding.case.read` | `GET /v1/care/safeguarding/cases/:caseId` | source `CARE-C4` | AAL2 and active tenant/case/principal/purpose membership |
| `safeguarding.membership.change` | `POST /v1/care/safeguarding/cases/:caseId/memberships` | access control | AAL2, current lead membership, independent action |
| `safeguarding.disclosure.create` | `POST /v1/care/safeguarding/cases/:caseId/disclosures` | exact disclosure | AAL2, legal basis, exact fields/recipient/purpose/expiry, independent approval |
| `learning-support.referral.create` | `POST /v1/care/learning-support/referrals` | intake `CARE-C2` | legal basis, relationship and idempotency |
| `learning-support.assessment.read` | `GET /v1/care/learning-support/assessments/:assessmentId` | source `CARE-C3` | learning-support relationship and immutable read evidence |
| `learning-support.academic-projection.read` | `GET /v1/care/learning-support/plans/:supportPlanId/academic-projection` | classroom `CARE-C2` projection | current teacher relationship; no findings/rationale |
| `portal.publication.read` | `GET /v1/care/publications/:publicationId` | released `CARE-C2` projection | exact audience, version, authority and expiry |
| `reports.aggregate.read` | `GET /v1/care/reports/:reportKey` | `CARE-C1` aggregate | approved dimensions and cohort suppression |

## Idempotency and concurrency

Every create or external-effect command carries a tenant-scoped idempotency key. Medication
administration, concern/referral intake, export generation, mandatory reporting and disclosure
delivery return the original result on an identical replay. A key reused for conflicting content is
rejected. Versioned plans and case status changes use optimistic version checks. Corrections append a
new attributed record; source history is not overwritten.

## Files and attachments

Restricted documents use the INT public document identifier. CARE persists classification and source
classification and never creates an unrestricted download URL. Downloads require a fresh
authorization decision, short-lived object reference and immutable disclosure/read evidence.

## Integration boundary

No connector receives a generic CARE query. Machine routes require a reviewed manifest with exact
tenant, route, categories, purpose, subject scope, recipient and expiry. `CARE-C4` is denied by
default. Academic consumers receive the dedicated accommodation projection, not CARE source tables.
