# INT-01 Completion Evidence

## Status

All seven INT-01 implementation milestones are complete on `module/international-integrations`. The code, module contracts, migrations, focused tests, full repository verification, browser/accessibility test, security checks, performance checks and operations documentation are committed.

`GATE-INT-COMPLETE` is **not yet passed** because migrations `202607280102` through `202607280107` still require live application and fresh-branch replay evidence on Neon. The resumed execution shell did not expose `DATABASE_URL`, `NEON_API_KEY` or the Neon MCP tools. Milestone 1 migration `202607280101` was previously applied to `agent/int-01-integrations`, after replaying foundation migrations `202607280001` through `202607280005`, and tenant RLS was verified.

## Repository identity

- Starting foundation SHA: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Branch: `module/international-integrations`
- Worktree: `.worktrees/int-01-integrations`
- Neon project: `lingering-brook-52999532`
- Neon branch: `agent/int-01-integrations`
- Neon branch ID: `br-super-truth-axp0urxi`
- Neon parent: `main` (`br-cool-wildflower-axsot8l1`)
- Final implementation checkpoint: `ad4ec0789b7760b26123afef39969d36fd538915`

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
  - Vitest: 102/102 PASS; one direct Neon test skipped because connection configuration was unavailable
  - all workspace builds: PASS
  - execution artefact validator: PASS
- `npm run test:browser --workspace=@school/integrations`: 1/1 PASS
- Security checks include cross-tenant credential rejection, digest-only persistence, tenant-partitioned external IDs and metrics, webhook assertion tamper detection, LTI nonce/state replay, SAML assertion replay and unsafe SCIM patch rejection.
- Performance checks link and resolve 10,000 external identifiers and enqueue/select 10,000 due webhook deliveries within the bounded local test budget.

## Remaining live Neon gate

To pass `GATE-INT-COMPLETE`:

1. Verify `agent/int-01-integrations` still matches project and parent identity.
2. Apply INT migrations `202607280102` through `202607280107` in order to the agent branch. Do not reapply or mutate production.
3. Verify `platform.schema_migration` contains foundation migrations `202607280001`–`202607280005` and INT migrations `202607280101`–`202607280107`.
4. Inspect `country_pack`, `integration` and `migration_studio` objects.
5. Verify forced RLS and tenant-negative probes with `app_runtime` on every tenant-owned table.
6. Verify immutable/append-only triggers.
7. Create a fresh Neon branch from the reviewed integration parent and replay all INT migrations from an empty/foundation-ready state.
8. Run the secret-backed direct Neon integration test and record exact branch IDs/results.
9. Update the agent board and progress tracker to `complete; gate passed`, commit and push the evidence.

## Safety and cleanup

- Production deployment or mutation: none.
- Production data in agent branches: none.
- Branch/worktree force reset or deletion: none.
- Existing dirty changes overwritten or discarded: none.
- Worker branch/worktree cleanup: retained, as required until reviewed integration.
