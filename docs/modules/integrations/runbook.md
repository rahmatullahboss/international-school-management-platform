# Internationalisation and Integration Operations Runbook

## 1. Pre-enable checklist

Before enabling a country pack or connector:

1. Confirm the tenant and operator context.
2. Record the exact immutable country-pack or connector version.
3. Review upgrade diff, scopes, data categories, destination, retention and subprocessor metadata.
4. Ensure the requester and reviewer are different people for connector approval.
5. Run the sandbox with synthetic data only.
6. Confirm connection health, disclosure-audit destination and reconciliation ownership.
7. Obtain any required local legal, contractual or school-owner approval.
8. Schedule rollback and communication steps.

Activation must use an application command and audit correlation ID. It must not be implemented as a direct table update from the browser.

## 2. Country-pack activation and upgrade

### Activate

- Publish and validate the exact pack version.
- Preview tenant overrides.
- Run both launch-country and materially different regression packs.
- Record the tenant activation and effective fingerprint.
- Verify locale fallback, RTL, time zone, currency and required-field rendering.

### Upgrade

- Generate recursive changed-path evidence.
- Review retention, academic labels/codes, templates and required-field changes.
- Execute a dry-run against representative synthetic tenant configuration.
- Record the previous version as the rollback target.
- Activate only after owner approval.

### Roll back

- Stop new operations that depend on the changed pack behavior.
- Re-activate the previous immutable version through the audited command path.
- Reconcile documents, jobs or exports created during the affected window.
- Record the incident and corrective action; do not mutate the released pack version.

## 3. Credential rotation and revocation

### Rotate

1. Issue a replacement value through the managed encrypted binding or vault.
2. Update the connector runtime without logging the value.
3. Test the connection with the replacement.
4. Invalidate the previous digest/value.
5. Record rotation time and operator evidence.

### Revoke

- Require a non-empty reason.
- Revoke immediately on suspected exposure, staff departure or provider termination.
- Disable scheduled synchronisation and outbound delivery.
- Review disclosure evidence after the last known valid use.
- Reissue only after configuration and privacy review.

PostgreSQL stores digests or managed key references, never reusable credential values.

## 4. Webhook delivery incident

### Symptoms

- dead-letter alert;
- delivery failure rate at or above the configured threshold;
- increasing latency;
- provider authentication or rate-limit responses;
- reconciliation drift.

### Response

1. Check connection health and provider status.
2. Inspect status code, attempt count, event type and correlation ID without exposing full sensitive payloads.
3. Confirm the subscription remains approved for the event/data category.
4. Fix configuration, provider availability or mapping.
5. Replay one dead-letter delivery in the sandbox or non-production path first.
6. Replay production deliveries only through the explicit replay command.
7. Reconcile all affected event IDs and destination records.
8. Close or acknowledge alerts with evidence.

Do not create a new delivery identity for a replay. The original delivery retains replay count and history.

## 5. Inbound duplicate or ordering incident

- Verify tenant, connection and provider event ID.
- Compare the stored payload hash.
- Identical duplicate: return the stored result without repeating the domain command.
- Same event ID with different payload: reject and investigate provider behavior.
- Out-of-order change: apply the connector's source-version/time policy.
- Run full reconciliation when events may be missing.

## 6. Import/export incident

### Import

- Confirm the file passed malware/content policy before decoding.
- Check byte, row, column and sheet limits.
- Review mapping version, source checksum and row-level errors.
- Re-run a dry run before commit execution.
- Use deterministic `<job>:<row>` idempotency keys.
- Reconcile counts and domain outcomes; never correct another module by direct table writes.

### Export

- Confirm explicit columns, maximum rows and tenant permissions.
- Verify formula neutralisation and disclosure purpose.
- Record output checksum and destination.
- Delete or expire generated files according to tenant policy.

## 7. Migration cutover

1. Freeze source-template, mapping and transformation versions.
2. Register every source-file checksum.
3. Complete repeatable migration runs until required metrics pass.
4. Confirm rollback plan has been tested.
5. Complete source freeze, stakeholder notification and operational checklist.
6. Obtain explicit cutover sign-off.
7. Perform production switching only through a separately authorised deployment procedure.
8. Run immediate post-cutover reconciliation.
9. Retain evidence and keep the source system read-only until the rollback window closes.

Cutover approval in Migration Studio is evidence; it does not itself deploy or switch traffic.

## 8. OneRoster incident

- Validate the exchange against the declared supported subset.
- Check missing headers, duplicate `sourcedId` values and broken references.
- Confirm full versus delta mode and `dateLastModified` behavior.
- Map records through domain commands and external-ID ownership.
- Reconcile object and relationship counts.
- Do not claim full OneRoster certification from a passing supported-profile test.

## 9. LTI and SSO incident

### LTI

- Confirm issuer/client, deployment and exact target-link registration.
- Verify key-set source and key rotation status.
- Check issue/expiry time and system clock.
- Reject reused state or nonce.
- Record minimised launch audit and correlation ID.

### OpenID Connect

- Confirm HTTPS issuer, redirect URI, state, nonce and PKCE challenge.
- Verify the signed identity assertion through the provider adapter.
- Map only verified email and allow-listed groups.

### SAML

- Verify XML signature and metadata through a reviewed XML-signature adapter.
- Check issuer, audience, recipient, `InResponseTo` and validity window.
- Reject reused assertion IDs.
- Investigate clock drift before widening skew.

### SCIM

- Enforce tenant scope and If-Match versions.
- Reject writes to immutable paths.
- Treat deactivation as a domain disablement command unless deletion is explicitly approved.
- Reconcile external/internal resource mappings.

## 10. Monitoring and SLO evidence

Review at minimum:

- connection health and last check;
- webhook delivered/failed/dead-letter counts and average latency;
- import runs, failed rows and duration;
- sandbox age and last result;
- credential rotation/revocation age;
- open alerts;
- disclosure records and retention expiry;
- OneRoster/migration reconciliation differences.

Immediate investigation is required for any dead-letter delivery, replay collision, tenant-isolation failure, invalid-signature acceptance or unexplained reconciliation difference.

## 11. Restore and verification

For database recovery rehearsal:

1. Create a fresh Neon branch from the reviewed integration parent.
2. Replay foundation migrations followed by INT migrations `202607280101` through `202607280107` in order.
3. Verify `platform.schema_migration` history.
4. Confirm `country_pack`, `integration` and `migration_studio` schemas.
5. Confirm forced RLS on every tenant-owned table.
6. Confirm immutable/append-only triggers.
7. Run tenant-negative SQL probes with the runtime role.
8. Run the full module test, browser and performance suites.

The long-lived agent branch alone is not sufficient integration evidence; migrations must replay on a fresh branch before acceptance.

## 12. Escalation and evidence

Every incident record should include:

- tenant, connector/pack/project version and environment;
- detection time and reporter;
- correlation, event, delivery, import or migration reference;
- affected data categories and destinations;
- containment, replay/rollback and reconciliation actions;
- evidence of recovery;
- follow-up owner and deadline.

Never put reusable credential values, complete authentication assertions or unnecessary sensitive payloads in incident notes.
