# CARE-01 Retention, Legal Hold, Export and Disclosure

## Retention model

Retention is classification, record-type and jurisdiction-pack aware. A tenant override may shorten or
extend an approved default only through an authorized policy release; it cannot disable immutable
audit, legal hold, safeguarding obligations or tenant isolation.

Each retention decision records tenant, resource reference, classification, policy key/version,
calculated review date, decision status, legal basis and approver evidence. Background workers act only
on approved, bounded batches and emit evidence rather than silently deleting rows.

## Record correction and deletion

Clinical, medication, behavior, counselling, safeguarding, assessment, disclosure and access evidence
are not edited in place. Corrections append an attributed replacement/correction record. Deletion is
implemented as an approved disposition event and storage purge only where policy and law allow it.

The runtime role has no DELETE privilege on CARE history tables. Irreversible purge requires AAL2,
privacy permission, independent approval, an unexpired execution window and a second legal-hold check
inside the execution transaction.

## Legal hold

A hold identifies exact subjects/resources, reason, authority reference, effective date and reviewer.
Active holds block automated deletion, manual purge and export-destruction workflows. Hold release
requires an approver other than the requester and creates immutable evidence. Break-glass cannot
release a hold.

## Student and guardian rights requests

A rights request does not grant unrestricted portal access. The privacy workflow resolves current SIS
identity/guardian authority, legal basis, subject scope, applicable exemptions and third-party
redaction. Safeguarding and counselling content receives a specialist review. The output is a new,
versioned, expiring release object; source records are not copied to a generic portal store.

## Export approval

Restricted export requires:

- exact tenant and subjects;
- exact record categories and fields;
- purpose and legal basis;
- recipient and delivery channel;
- expiry and download limit;
- requester and independent approver;
- AAL2 for approval and generation;
- immutable generation, download, failure, expiry and revocation evidence.

Generation must exactly match approval. Adding a field, subject, recipient or purpose requires a new
approval. Exports are encrypted, short-lived and never attached directly to ordinary email or
notification messages.

## Connector disclosure

A connector must have a reviewed INT manifest and exact CARE disclosure approval. The approval binds
connector/version, tenant, route, categories, fields, purpose, subject scope, recipient/destination and
expiry. `CARE-C4` is denied by default. A connector cannot convert a notification route token into
record access.

Disclosure evidence records categories and counts rather than duplicating the sensitive payload.
Delivery failures retain retry/dead-letter evidence and never broaden scope.

## Offline and emergency retention

Only the minimum `CARE-E` emergency bundle may be cached offline. It is encrypted, device-bound,
account-bound, short-lived and remotely revocable. The device records issue, refresh, open, expiry,
revocation and wipe evidence. Routine `CARE-C3` and all `CARE-C4` records are not available in ordinary
offline caches.

## Recovery behavior

Backups and branch copies preserve tenant identifiers, classification, legal holds, access evidence and
append-only triggers. Restoring data does not reactivate expired membership, publication, consent,
export, disclosure or emergency-bundle authorization. Authorization is reevaluated against current
state after recovery.
