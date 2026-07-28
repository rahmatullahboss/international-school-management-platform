# INT-01 Completion Evidence

## Status

All seven INT-01 implementation milestones are complete on `module/international-integrations`. The code, module contracts, migrations, focused tests, full repository verification, browser/accessibility test, security checks, performance checks and operations documentation are committed.

`GATE-INT-COMPLETE` is **passed**. The `NEON_API_KEY`-backed gate resolved only the exact agent branch `br-super-truth-axp0urxi`, applied INT migrations `202607280102` through `202607280107`, verified migration history, 31/31 forced-RLS tenant tables, required immutable/append-only triggers, cross-tenant negative probes and the direct Neon integration test. It then replayed foundation plus INT migrations in a fresh logical database and in a disposable fresh Neon branch created from reviewed parent `main` (`br-cool-wildflower-axsot8l1`). The temporary branch `br-twilight-lake-ax8ykaey` passed the same checks and was deleted after verification. The existing generic `DATABASE_URL`, which targets Neon `main`, was never used for schema mutation.

## Repository identity

- Starting foundation SHA: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Branch: `module/international-integrations`
- Worktree: `.worktrees/int-01-integrations`
- Neon project: `lingering-brook-52999532`
- Neon branch: `agent/int-01-integrations`
- Neon branch ID: `br-super-truth-axp0urxi`
- Neon parent: `main` (`br-cool-wildflower-axsot8l1`)
- Final implementation checkpoint: `ad4ec0789b7760b26123afef39969d36fd538915`
- Final Neon gate automation checkpoint: `ae88d8e`

## Milestones

### 1. Country-pack engine

Checkpoint: `0ac974fd7632079d1dc4f056285cb21e2aa77df4`

Delivered versioned immutable country/curriculum manifests, validation, exact tenant activation, bounded overrides, recursive upgrade diff, localisation/RTL behavior, Bangladesh launch configuration, materially different synthetic Gulf validation configuration, regression fingerprints and tenant-RLS schema evidence.

### Compatibility gate

Checkpoint: `a55d6d7284516395a195da0411ad50fa93a6cc75`

The owner approved the nested-module workspace resolution through the explicit `continue` instruction. Root workspace composition and architecture boundary discovery now support independently owned `packages/modules/*` packages without a shared mutable module manifest.

### 2. Integration runtime

Checkpoint: `c98c27716f87a94f60a55de97644f4811ae00c1d`

Delivered immutable OpenAPI, scoped and rotatable machine credentials with digest-only storage, external identifiers, HMAC webhook signatures, inbound payload deduplication, retry/dead-letter/replay, connection health and append-only disclosure audit.

### 3. Import/export foundation

Checkpoint: `f252c8ca4e7d2378514dba457edc91e372e45bce`

Delivered bounded secure CSV handling, XLSX decoder contract, formula neutralisation, versioned mappings, staging, dry run, row-level validation, idempotent domain-command execution, reconciliation and safe CSV/workbook exports.

### 4. Migration Studio

Checkpoint: `16135cf986304e75a478eb8985fe1ddfff6f6ed4`

Delivered immutable source templates, versioned migration projects, configuration/file checksums, repeatable run keys, reconciliation evidence, cutover checklist, rollback plan and independent sign-off gates.

### 5. OneRoster 1.2

Checkpoint: `0bcca38a87f5069890abfedd353d5528fbf57c00`

Delivered an explicit OneRoster 1.2 CSV supported subset for organisations, academic sessions, courses, classes, users and enrolments; full/delta validation, references, deterministic export, domain-command mapping and a cursor-based REST extension contract. No full certification or implemented REST-service claim is made.

### 6. LTI, SSO and SCIM

Checkpoint: `0fbb45c50ca5b77801dd43694e3e7f769e8265b5`

Delivered immutable LTI registration, one-time state/nonce sessions, WebCrypto RS256 compact verification, issuer/audience/time/deployment/target-link checks, claim minimisation, OIDC PKCE and identity semantics, SAML assertion/replay semantics and bounded SCIM Users/Groups contracts.

### 7. Governance, administration and observability

Checkpoint: `ad4ec0789b7760b26123afef39969d36fd538915`

Delivered immutable connector manifests, independent approval, synthetic sandbox evidence, subprocessor/privacy metadata, tenant metrics and alerts, RTL/accessibility-aware country-pack and connector administration, browser verification, security/performance tests and the operations runbook.

## Database migrations

Ordered INT-01 migrations:

1. `202607280101_INT-01_country_pack_engine`
2. `202607280102_INT-01_integration_runtime`
3. `202607280103_INT-01_import_export`
4. `202607280104_INT-01_migration_studio`
5. `202607280105_INT-01_oneroster_profile`
6. `202607280106_INT-01_lti_sso_scim`
7. `202607280107_INT-01_connector_governance`

Migrations create only INT-owned `country_pack`, `integration` and `migration_studio` schemas. Tenant-owned tables declare forced row-level security. Published profile/manifest objects and disclosure/launch evidence use immutable or append-only triggers where applicable.

## Final local verification

Executed after milestone 7:

- `npm run verify`: PASS
  - Prettier: PASS
  - ESLint: PASS
  - architecture boundaries: PASS
  - root and all workspace TypeScript projects: PASS
  - Vitest: 102/102 PASS; the direct Neon test is intentionally skipped only in local runs without credentials
  - all workspace builds: PASS
  - execution artefact validator: PASS
- `npm run test:browser --workspace=@school/integrations`: 1/1 PASS
- GitHub CI after the clean-checkout browser fix: PASS (`30329479311`, `30329744058`, `30330768874`).
- Guarded generic-secret inspections `30329744096` and `30330061274` stopped before writes and proved the generic `DATABASE_URL` targets Neon `main`.
- API-backed exact-branch inspection `30345672557`: PASS on `br-super-truth-axp0urxi`.
- Agent-branch migration/application gate `30345998526`: PASS; migrations `202607280101`–`202607280107`, required triggers, tenant isolation and direct Neon test verified.
- Fresh logical database replay `30346762735`: PASS; foundation `202607280001`–`202607280005` and INT `202607280101`–`202607280107` replayed and the disposable database was removed.
- Fresh Neon branch replay `30347294967`: PASS on temporary branch `br-twilight-lake-ax8ykaey`, created from `main` (`br-cool-wildflower-axsot8l1`); 31/31 tenant tables had forced RLS, the direct Neon test passed 1/1 and the temporary branch was deleted.
- Security checks include cross-tenant credential rejection, digest-only persistence, tenant-partitioned external IDs and metrics, webhook assertion tamper detection, LTI nonce/state replay, SAML assertion replay and unsafe SCIM patch rejection.
- Performance checks link and resolve 10,000 external identifiers and enqueue/select 10,000 due webhook deliveries within the bounded local test budget.

## Gate outcome

`GATE-INT-COMPLETE` passed on 2026-07-28. The module is ready for owner review and serial integration by `INTEG-01`; no additional INT-01 scope is required before integration.

## Safety and cleanup

- Production deployment or mutation: none.
- Production data in agent branches: none.
- Branch/worktree force reset or deletion: none.
- Existing dirty changes overwritten or discarded: none.
- Worker branch/worktree cleanup: retained, as required until reviewed integration.
