# CARE-01 Security Incident Response

## Trigger conditions

Open a CARE security incident for suspected cross-tenant access, unauthorized sensitive read,
missing/tampered audit evidence, safeguarding existence disclosure, connector over-scope, export or
object-link leakage, stale case membership, break-glass misuse, offline-bundle compromise, credential
exposure, notification content leakage or unexpected source narrative in an event/report.

## Immediate containment

1. Preserve correlation IDs, immutable access evidence, outbox/delivery evidence and affected policy
   versions.
2. Revoke the relevant session, case membership, connector credential, export link, publication,
   break-glass grant or offline bundle.
3. Disable the smallest affected route/worker/connector. For missing audit persistence, disable all
   restricted reads that depend on it.
4. Block further export/disclosure generation and dead-letter unsafe deliveries.
5. Do not edit or delete source/audit rows while investigating.

## Triage

Classify tenant, subjects, CARE classifications, fields, actors, purposes, time window, systems,
recipients and whether data left the authorized boundary. Verify current SIS relationship and
identity state, case-membership history, permission release, AAL level, legal basis, connector
manifest, object-link usage and notification rendering.

Cross-tenant access, `CARE-C4` existence exposure, altered immutable evidence or uncontrolled
external disclosure is critical severity.

## Investigation queries

Use bounded queries by tenant, correlation ID, principal, resource, classification and time window.
Do not run unrestricted narrative searches. Evidence collection must itself create read evidence.
Report builders receive aggregate incident counts only; source review is limited to the assigned
security/privacy/safeguarding team.

## Remediation

- rotate/revoke credentials and signing references;
- correct policy or relationship release through a new version;
- revoke stale membership/publication/export/disclosure/bundle grants;
- append corrections rather than rewriting source history;
- reprocess safe outbox work by stable idempotency key;
- purge leaked cached objects only after preserving incident evidence and checking legal hold;
- add a regression test reproducing the authorization or minimization failure.

## Notification and legal review

Privacy and safeguarding leads determine regulatory, guardian/student and authority notification
requirements using the active country/legal pack and counsel. Ordinary application notifications must
not reveal incident subject, safeguarding existence or compromised source detail.

## Recovery and closure

Before closure, verify tenant isolation, membership revocation, immutable audit continuity, event and
notification minimization, export/connector scope, object-link expiry and negative tests. Record root
cause, affected scope, remediation commits/migrations, residual risk, reviewer and follow-up date.

Break-glass usage related to the incident receives a separate independent review even when the access
was technically authorized.
