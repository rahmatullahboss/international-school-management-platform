# CARE-01 Migration and Recovery Evidence

## Branches and reviewed points

- Git base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
- Git branch: `module/student-support`
- CARE Neon branch: `agent/care-01-student-support` (`br-raspy-smoke-ax0msb57`)
- reviewed Wave 1 integration Neon branch:
  `integration/international-school-platform-v1` (`br-shiny-silence-axznuy37`)
- approved threat-model source:
  `1ee5ef8dd5c38234cf67acfda5b73df4602f64d4`, read through Git history only

No production/default Neon branch was mutated. ACAD-01 and OPS-01 branches were not read for module
code and were not modified.

## CARE migration ledger

The CARE branch records these migrations:

1. `202607290201_CARE-01_security_contract`
2. `202607290202_CARE-01_health`
3. `202607290203_CARE-01_behavior`
4. `202607290204_CARE-01_wellbeing`
5. `202607290205_CARE-01_safeguarding_domain`
6. `202607290206_CARE-01_learning_support`

Verified CARE schema evidence:

| Schema | Base tables | Forced-RLS tables |
| --- | ---: | ---: |
| `health` | 12 | 12 |
| `behavior` | 8 | 8 |
| `wellbeing` | 10 | 10 |
| `safeguarding` | 16 | 16 |
| `learning_support` | 11 | 11 |

The security contract also forces RLS on its tenant-owned access-evidence, case-membership,
break-glass, publication, export, connector, offline-bundle, retention and incident-control tables.

## Isolation and immutability probes

Synthetic tenant-A/tenant-B probes on the CARE branch verified:

- no tenant context returns zero CARE rows;
- tenant-A reads do not expose tenant-B rows;
- cross-tenant inserts are rejected by RLS;
- an unrelated safeguarding principal sees zero cases;
- teacher concern reads return zero while an AAL2 safeguarding lead sees the authorized tenant queue;
- active principal/case/purpose membership exposes only the matching safeguarding case;
- access-evidence update is denied;
- medication-administration rewrite is denied;
- behavior source-incident rewrite is denied;
- counselling-session rewrite is denied;
- safeguarding chronology rewrite raises `CARE_SAFEGUARDING_APPEND_ONLY_RECORD`;
- learning plan-review rewrite raises `CARE_LEARNING_SUPPORT_APPEND_ONLY_RECORD`.

The probes use synthetic UUIDs and no production data.

## Reviewed Wave 1 ledger comparison

The reviewed integration branch contains FND 5, SIS 6, FIN 4 and INT 7 canonical migrations.
The CARE branch was created from the project default database point and therefore initially contained
FND and replayed SIS, but not the FIN/INT schemas. The exact missing reviewed migrations are:

### FIN

- `202607280101_FIN-01_ledger`
- `202607280102_FIN-01_billing`
- `202607280103_FIN-01_payments`
- `202607280104_FIN-01_reporting`

### INT

- `202607280101_INT-01_country_pack_engine`
- `202607280102_INT-01_integration_runtime`
- `202607280103_INT-01_import_export`
- `202607280104_INT-01_migration_studio`
- `202607280105_INT-01_oneroster_profile`
- `202607280106_INT-01_lti_sso_scim`
- `202607280107_INT-01_connector_governance`

The authoritative integration branch currently contains 7 ledger tables, 21 billing tables,
28 integration tables, 3 country-pack tables and 7 migration-studio tables. CARE does not create,
mutate or directly reference those schemas. CARE consumes only reviewed public identifiers/contracts;
its document foreign keys resolve through the foundation `integration_core.document_object` contract.

## Fresh disposable replay limitation

The Neon project is at its branch limit of 10/10. Creating a fresh disposable branch would require
deleting or resetting an existing FND/SIS/FIN/INT/ACAD/OPS/integration agent branch. That would be a
destructive mutation and is explicitly outside this execution. The connector also executes each
transaction item as one prepared statement, so it cannot stream a complete multi-statement migration
file as one item.

Therefore this module does **not** claim a fresh FND→SIS→FIN→INT→CARE branch replay. Instead it
provides:

- an authoritative reviewed Wave 1 ledger comparison;
- source-path verification for all missing FIN/INT migrations;
- complete CARE migration application on the dedicated branch;
- forced-RLS/table inventory;
- negative cross-tenant and append-only probes;
- exact recovery steps below.

This limitation is an integration/release rehearsal blocker, not a reason to weaken or delete another
agent’s branch.

## Required integration recovery procedure

When a disposable branch slot is available:

1. create the branch from `br-shiny-silence-axznuy37`, not from Neon `main`;
2. verify all 22 reviewed Wave 1 migration IDs before CARE execution;
3. apply CARE migrations `201` through `206` in order;
4. rerun every migration to prove idempotent ledger/object behavior;
5. verify 57/57 CARE domain tables force RLS and security-contract tables retain their policies;
6. execute no-context, tenant-A/tenant-B, stale-membership, broad-role, AAL1/AAL2, break-glass,
   export, connector, notification and offline negative suites;
7. restore a snapshot into a second disposable branch and verify current authorization state is
   reevaluated rather than restored from expired grants;
8. compare ledger and schema inventories with the source branch;
9. retain logs and delete the disposable branch only after integration approval.

No migration may be applied to the default or production branch by a module agent.
