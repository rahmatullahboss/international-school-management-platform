# SIS People, Households and Guardian Authority

## Scope delivered

The people bounded context stores person identities separately from login accounts, supports effective-dated names, identifiers, contact points and addresses, and models households independently from legal or portal authority. A student may belong to multiple households while each guardian receives explicit, effective-dated authority flags.

Implemented authority dimensions are legal, educational decision-making, billing, communication, pickup and portal access. Portal or other guardian access is valid only when the authority is verified and the requested date falls within its effective period.

## Duplicate and merge workflow

Duplicate candidates are scored from normalized names, dates of birth, identifiers and contact points. A reviewed merge preserves the surviving person as authoritative, marks the absorbed person as merged, retains an immutable merge record and rewires guardian references. It does not hard-delete the absorbed identity.

## Database and security

Migration `202607280101_SIS-01_people` creates the `people` schema and 17 tenant-owned tables. All tenant-owned tables enable and force RLS for `app_runtime`. The SIS Neon branch was aligned by replaying foundation migrations 1–5 before this module migration.

Synthetic Neon proof on `agent/sis-01-core-sis` (`br-ancient-sunset-axuhcmof`):

- no tenant context: 0 people visible;
- Tenant A context: 1 Tenant A row visible, 0 foreign rows;
- Tenant B context: 1 Tenant B row visible, 0 foreign rows.

No production data or production branch was mutated.
