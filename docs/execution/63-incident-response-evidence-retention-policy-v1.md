# Incident Response and Evidence Retention Policy v1

**Program:** `international-school-platform-v1`  
**Status:** repository policy design; production activation is not authorized

## Objective

Define one machine-verifiable, secret-free operating contract for security/availability incident coordination and evidence retention across the School ERP. The policy coordinates existing domain-specific controls; it does not replace them.

Projection incidents continue to use `docs/execution/57-projection-recovery-operator-runbook-v1.md` for recovery eligibility, second-human approval and replay verification. This policy supplies the overarching incident severity, response timing, evidence lifecycle, preservation-hold and closure requirements.

## Repository boundary

The repository may contain only policy values and role/destination placeholders. It must not contain:

- named production responders or personal contact details;
- alert webhooks, ticket-system credentials or external destination URLs;
- database/OIDC/API credentials or tokens;
- raw student, guardian, staff, finance, health or safeguarding payloads;
- real incident evidence bytes or customer communications;
- a claim that incident operations have been accepted for production.

All real people, destinations, evidence objects, exercises and approvals remain external.

## Severity targets

Response targets are repository operating baselines, not a legal or regulatory representation.

| Severity | Acknowledge | Incident lead assigned | Containment/stabilization plan | Post-incident review |
| --- | ---: | ---: | ---: | ---: |
| `sev1` | 10 min | 15 min | 30 min | 72 h |
| `sev2` | 30 min | 60 min | 120 min | 120 h |
| `sev3` | 240 min | 480 min | 1440 min | 168 h |
| `sev4` | 1440 min | 2880 min | 4320 min | 336 h |

The default category mapping is intentionally conservative:

- identity/session compromise → `sev1`;
- privileged-access misuse → `sev1`;
- cross-tenant boundary → `sev1`;
- data exposure → `sev1`;
- finance-integrity compromise → `sev1`;
- projection-recovery misuse → `sev1`;
- secret exposure → `sev1`;
- infrastructure availability/recovery → `sev2`.

An unknown incident class fails closed at minimum `sev2` until deliberately reclassified.

## Incident lifecycle

Every incident record must progress through explicitly recorded states:

1. `detected`;
2. `triaged`;
3. `contained`;
4. `recovered`;
5. `review-complete`.

No production recovery/destructive mutation may be automated from alert state alone. A production recovery or destructive action requires an existing incident record, an authorized primary operator and a different authorized secondary approver. Dedicated recovery credentials are required where an existing domain runbook requires them.

## Evidence model

Evidence records are references, not evidence bytes. Every retained evidence object must be represented externally by:

- an opaque `evidence://...` reference;
- a SHA-256 digest;
- a UTC verification/capture timestamp;
- a verifier/owner role label from the approved role set.

Repository and incident-record evidence metadata must remain redacted. Raw payloads, tokens, credentials/passwords and direct person/student identifiers are prohibited in the evidence record.

### Operational minimum retention baselines

- incident timeline: **365 days**;
- security decision/sign-off evidence: **730 days**;
- recovery evidence: **365 days**;
- credential rotation/revocation evidence: **365 days**;
- audit/boundary evidence: **730 days**;
- communications metadata: **365 days**.

These are minimum operational baselines, not legal retention advice. An applicable legal, contractual, privacy or security requirement may require longer retention. Repository policy must never silently shorten these baselines.

A security/legal preservation hold always overrides scheduled disposal. While a hold is active, disposal is prohibited regardless of the normal retention period.

## Evidence integrity and closure

- incident timeline is append-only;
- recovery receipts and before/after redacted evidence remain immutable where existing runbooks require them;
- evidence digests/references must not be reused to represent different evidence objects;
- an incident cannot reach `review-complete` without recovery/outcome verification, contributing-factor or root-cause recording, and corrective-action ownership by role;
- evidence integrity failure reopens/escalates the incident;
- unresolved customer/business impact prevents closure even when a technical action succeeded.

## External bindings

The machine policy keeps these bindings as `required-external`:

- incident system;
- primary incident owner;
- secondary incident owner;
- security owner;
- communications owner;
- evidence store;
- primary alert destination;
- secondary alert destination.

No repository PR may replace these placeholders with real people, URLs, credentials or destination identifiers.

## Production authorization boundary

A passing repository validator means only that the policy shape has not drifted. Production remains unauthorized until the existing production activation evidence contract has verified external `incidentOperationsAcceptance` plus the other required gates and explicit owner/security authorizations.
