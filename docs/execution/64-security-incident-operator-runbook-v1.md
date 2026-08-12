# Security Incident Operator Runbook v1

**Status:** pre-production operating procedure; production activation is not authorized

## Scope

Use this runbook for production security/privacy/integrity/availability incident coordination. It does not authorize bypassing domain-specific controls, direct production database edits, secret disclosure, ad-hoc destructive recovery or automatic production mutation.

Projection-specific recovery remains governed by `docs/execution/57-projection-recovery-operator-runbook-v1.md`.

## 1. Detect and open the incident record

1. Open an incident record immediately using the external incident system.
2. Record an opaque incident identifier, detection timestamp, incident category and initial severity.
3. Use only role labels for owners in repository-compatible evidence; named people/contact details remain external.
4. Do not paste request payloads, credentials, tokens, session cookies, database URLs, student/person identifiers or raw restricted-domain data into the incident record.
5. If category is unknown, treat it as at least `sev2` until deliberately reclassified.

## 2. Triage and assign

Apply the policy response target for the selected severity:

- `sev1`: acknowledge 10 min; lead 15 min; containment plan 30 min;
- `sev2`: acknowledge 30 min; lead 60 min; containment plan 120 min;
- `sev3`: acknowledge 240 min; lead 480 min; containment plan 1440 min;
- `sev4`: acknowledge 1440 min; lead 2880 min; containment plan 4320 min.

Escalate to `sev1` when there is confirmed or credible active cross-tenant exposure, credential/secret compromise, unauthorized privileged action, finance-integrity compromise, material data exposure or projection-recovery misuse.

Do not lower severity merely because impact has not yet been fully measured.

## 3. Preserve evidence before mutation

Before any production recovery/destructive action when operationally possible:

1. capture redacted state/evidence through reviewed interfaces;
2. store evidence externally;
3. record only `evidence://...` reference, SHA-256 digest, UTC timestamp and owner/verifier role;
4. enable a preservation hold when deletion/rotation could destroy material incident evidence;
5. preserve existing immutable audit/outbox/recovery evidence rather than rewriting it.

A preservation hold prohibits evidence disposal until the hold is explicitly released through the external incident/security process.

## 4. Contain or stabilize

Containment must use reviewed controls and least-privilege credentials. Examples include session revocation, credential rotation, disabling a compromised external integration, restricting a failing path, or applying an approved recovery procedure.

For any destructive or production-recovery action:

- an incident record must already exist;
- a primary operator must be assigned;
- a different authorized human must record secondary approval;
- required dedicated credentials/assurance must be used;
- the action must follow its domain-specific runbook where one exists;
- automatic mutation from an alert alone is prohibited.

If a safe reviewed action does not exist, fail closed and escalate rather than improvising direct SQL or credential sharing.

## 5. Recover and verify

Recovery is not complete merely because a command returned success. Verify:

- affected business-facing behavior is correct;
- tenant/campus/persona boundaries remain intact;
- relevant sessions/credentials/revocations have the intended state;
- audit/evidence integrity remains intact;
- monitoring/alerts return to an acceptable state;
- no repeat destructive/replay action is required without a fresh review.

Projection incidents must additionally complete the verification steps in the projection recovery runbook.

## 6. Communication boundary

External/customer/regulatory communication requires the external communications/security ownership process. Repository policy does not name recipients and does not authorize sending notifications automatically.

Record only communications metadata required for incident evidence; do not store raw customer messages or sensitive payloads in repository-compatible incident evidence.

## 7. Post-incident review and closure

Complete review within the severity target:

- `sev1`: 72 hours;
- `sev2`: 120 hours;
- `sev3`: 168 hours;
- `sev4`: 336 hours.

Before `review-complete`, require:

- explicit `detected → triaged → contained → recovered → review-complete` timeline;
- outcome/recovery verification;
- contributing factors or root cause recorded;
- corrective-action owner role recorded;
- evidence references/digests verified;
- unresolved customer/business impact cleared or explicitly escalated.

Evidence integrity failure, missing required evidence or renewed impact reopens/escalates the incident.

## 8. Retention and disposal

Apply repository minimums:

- incident timeline 365 days;
- security decision/sign-off evidence 730 days;
- recovery evidence 365 days;
- credential rotation/revocation evidence 365 days;
- audit/boundary evidence 730 days;
- communications metadata 365 days.

Applicable legal/contractual/security requirements may extend these periods. A preservation hold overrides normal disposal. Never shorten repository baselines through an operational shortcut.

## Prohibited actions

- automatic production mutation solely from alert severity;
- direct database/outbox/audit evidence edits to make an incident appear resolved;
- deleting evidence under an active preservation hold;
- using the same human as both primary operator and required secondary approver;
- pasting credentials, tokens, session values, database URLs or raw restricted data into incident evidence;
- replacing `required-external` policy bindings with real people, webhooks or credentials in the repository;
- treating repository policy validation as production incident-operations acceptance.
