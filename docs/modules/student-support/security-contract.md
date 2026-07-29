# CARE-01 Security Contract

## Authority and base

CARE-01 implements the approved `GATE-STUDENT-SUPPORT-THREAT-MODEL` by reading source commit
`1ee5ef8dd5c38234cf67acfda5b73df4602f64d4` without merging or cherry-picking it into the
implementation branch. The implementation remains based on reviewed Wave 1 SHA
`8cc8ee1562ade672b14c1c44af935fe7e2307976`.

## Deny-by-default decision

A restricted decision requires a valid tenant and active principal membership, named permission,
controlled purpose, current student relationship or explicit case membership, classification-aware
field release, required assurance and durable access evidence. A role only makes an actor eligible
for evaluation. Principal, tenant administrator, general teacher, finance, HR, admissions,
report-builder, connector and platform-support roles do not inherit `CARE-C3` or `CARE-C4`
content access.

Guardian and student views use a separate versioned publication decision. Guardian access also
requires a current verified SIS `GuardianAuthoritySnapshot`, portal authority, portal access and no
active restriction. Portal views never query unrestricted source narratives.

## High-risk controls

- Medication administration, safeguarding content, case membership, external disclosure,
  high-risk export, legal hold and destruction require AAL2.
- Break-glass is independently approved, reasoned, resource/classification scoped, expiring,
  revocable and reviewable. It cannot grant bulk search/export, membership administration,
  destruction or hold release.
- `CARE-C3`, `CARE-C4` and `CARE-E` reads fail closed if immutable access evidence cannot be
  persisted.
- Exports bind exact subjects, fields, recipient, purpose and expiry and reauthorize at generation
  and download.
- Connector transfer requires the exact INT manifest version, tenant approval, category and
  purpose.
- Notifications use generic content and reject sensitive variables.
- Offline data is limited to encrypted, device-bound, expiring `CARE-E` projections.
- Destruction is policy-versioned, legal-hold aware, idempotent, AAL2 and independently approved.

## Invariant coverage

`CARE_SECURITY_INVARIANTS` publishes all 40 stable IDs `SS-TM-001` through `SS-TM-040`.
Executable tests cover tenant/context denial, broad-role denial, relationship and case scope,
guardian publication, AAL2, break-glass prohibitions, fail-closed audit, immutable evidence,
export and connector exactness, notification minimization, offline-device revocation, retention
and incident isolation. Domain checkpoints add resource-specific tests against the same contract.

## Database boundary

Migration `202607290201_CARE-01_security_contract.sql` creates only `safeguarding` objects. Every
authoritative row is tenant keyed, all tenant tables enable and force RLS, missing tenant context
resolves to no rows, and `app_runtime` cannot update or delete access evidence. No SIS, FIN, INT,
ACAD, OPS or foundation-owned table is changed.
