# Production Activation Evidence Contract v1

**Program:** `international-school-platform-v1`  
**Status:** repository contract in implementation; production activation is not authorized

## Objective

Define a secret-free, machine-verifiable contract for the external evidence that must exist before anyone can claim the School ERP is production-authorized.

The repository must never contain the real OIDC client secret, database passwords, Cloudflare secrets, alert webhooks, tokens, recovery credentials, student/person data or raw security evidence. The contract stores only opaque evidence references and SHA-256 digests.

## Repository boundary

The repository contains:

- a non-authorized template at `config/production/activation-evidence.template.json`;
- a validator at `scripts/validate-production-activation-evidence.mjs`;
- adversarial self-tests that prove incomplete, widened or secret-bearing manifests fail closed;
- CI validation of the committed template and contract behavior.

The repository does **not** contain a real production activation manifest. A real candidate manifest is an external release artifact and must be validated with this script before approval/deployment.

## Evidence record shape

Every required gate uses one of two states:

- `pending-external`: repository knows the evidence is required but does not claim it exists;
- `verified`: the external evidence has been reviewed and the record includes:
  - an opaque `evidence://...` reference;
  - the SHA-256 digest of the external evidence artifact;
  - an RFC 3339 UTC verification timestamp;
  - a reviewed verifier role, never a person's name or email.

The reference must not contain URL query strings, fragments, bearer tokens, passwords or other secret material.

## Required production gates

A production authorization candidate must verify all of the following:

1. `realExternalOidc` — exact real issuer/authorization/token/JWKS origins, real client configuration, real identity bindings, PKCE/nonce/key rotation/AAL2/logout/revocation rehearsal;
2. `productionRuntimeCredential` — password-bearing runtime login with only the reviewed capability role, secret-bound deployed readiness and rotation/revocation proof;
3. `deployedSevenPersonaE2e` — deployed production-like E2E for Admin, Teacher, Guardian, Student, Admissions, Finance/Cashier and Platform/Support;
4. `projectionCredentialsAndSchedule` — reviewed publisher/composer/worker/monitor/recovery credentials and approved poller/Cron binding;
5. `alertDestinationsAndOwners` — primary/secondary real alert destinations and named operations ownership recorded externally;
6. `monitorAlertRehearsal` — deployed monitor polling, threshold and alert-delivery rehearsal;
7. `controlledRecoveryRehearsal` — one isolated production-like transient dead-letter recovery using the reviewed PROD-06/07 boundary;
8. `credentialRotationRevocation` — runtime/projection credential rotation and revocation rehearsal;
9. `securityPrivacyReview` — targeted identity, finance, support, student/guardian and projection-recovery review plus deployed redaction/boundary verification;
10. `backupRestoreRollback` — accepted backup, restore-integrity and rollback rehearsal;
11. `ownerUat` — representative owner-led UAT across required production workflows;
12. `incidentOperationsAcceptance` — on-call/escalation/runbook/evidence-retention acceptance.

## Explicit authorization

A manifest may set `productionAuthorized: true` only when:

- every required gate is `verified`;
- every verified gate has a valid opaque evidence reference, SHA-256 digest, UTC timestamp and allowed verifier role;
- the manifest is bound to an exact 40-hex Git commit through `releaseCommit`;
- `ownerAuthorization` is verified by the `owner` role;
- `securityAuthorization` is verified by the `security` role;
- owner and security approval use different evidence references and digests;
- no unknown keys or unknown gate names exist.

The validator can optionally receive `--expected-commit <sha>` and must reject an authorization manifest bound to a different release commit.

## Allowed verifier roles

Evidence may be verified only by one of these role labels:

- `engineering`
- `operations`
- `security`
- `owner`
- `data-protection`

These are role classifications, not human identities. The actual named approver remains in the external evidence system.

## Fail-closed behavior

The validator must reject:

- missing or additional required gates;
- unknown top-level or nested fields;
- `productionAuthorized: true` with any pending gate;
- an authorized manifest without an exact release commit;
- raw `http://` / `https://` evidence links, query strings or fragments instead of `evidence://` references;
- malformed/non-SHA-256 evidence digests;
- non-UTC or malformed timestamps;
- unauthorized verifier roles;
- owner/security authorization by the wrong role;
- reused owner/security evidence reference or digest;
- strings containing common secret-bearing prefixes or credential field names;
- an expected-release-commit mismatch.

## Activation boundary

Passing this validator is necessary but not sufficient to deploy. The actual deployment path must still enforce branch protection, reviewed release artifacts, environment protections and deployment-specific credentials outside repository source.

The committed template remains `productionAuthorized: false` with every external gate pending. No code change in this workstream authorizes production.
