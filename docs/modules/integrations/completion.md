# INT-01 Completion Evidence

## Status

All seven INT-01 implementation milestones are complete on `module/international-integrations`. The code, module contracts, migrations, focused tests, full repository verification, browser/accessibility test, security checks, performance checks and operations documentation are committed.

`GATE-INT-COMPLETE` is **not yet passed** because migrations `202607280102` through `202607280107` still require live application and fresh-branch replay evidence on Neon. The resumed execution shell did not expose a branch-specific connection or Neon API access. A guarded GitHub inspection proved that the existing generic `DATABASE_URL` repository secret targets Neon `main` (`br-cool-wildflower-axsot8l1`), not `agent/int-01-integrations` (`br-super-truth-axp0urxi`); the guard stopped before any schema write. The workflow now requires a dedicated `INT01_DATABASE_URL` secret and checks the exact Neon project and branch IDs before migration or replay. Milestone 1 migration `202607280101` was previously applied to the agent branch after replaying foundation migrations `202607280001` through `202607280005`, and tenant RLS was verified.

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
- GitHub CI after the clean-checkout browser fix and final evidence push: PASS (`30329479311`, `30329744058`, `30330768874`).
- Guarded Neon inspections: `30329744096` stopped because the generic secret was not foundation-ready; `30330061274` identified project `lingering-brook-52999532` and branch `br-cool-wildflower-axsot8l1`, then stopped before writes because it was Neon `main`.
- Branch-specific Neon workflow `30330768882`: PASS as an explicit pending no-op because `INT01_DATABASE_URL` is not configured; no database connection or mutation was attempted.
- Security checks include cross-tenant credential rejection, digest-only persistence, tenant-partitioned external IDs and metrics, webhook assertion tamper detection, LTI nonce/state replay, SAML assertion replay and unsafe SCIM patch rejection.
- Performance checks link and resolve 10,000 external identifiers and enqueue/select 10,000 due webhook deliveries within the bounded local test budget.

## Remaining live Neon gate

To pass `GATE-INT-COMPLETE`:

1. Add repository secret `INT01_DATABASE_URL` with the connection string for project `lingering-brook-52999532`, branch `br-super-truth-axp0urxi`; the gate will reject every other project or branch.
2. Dispatch `INT-01 Neon Gate` in `inspect` mode and verify the foundation plus INT-101 baseline.
3. Dispatch `apply` to apply INT migrations `202607280102` through `202607280107` in order to the agent branch. Do not reapply or mutate production.
4. Verify `platform.schema_migration` contains foundation migrations `202607280001`–`202607280005` and INT migrations `202607280101`–`202607280107`.
5. Inspect `country_pack`, `integration` and `migration_studio` objects.
6. Verify forced RLS and tenant-negative probes with `app_runtime` on every tenant-owned table.
7. Verify immutable/append-only triggers.
8. Dispatch `replay-database` to replay foundation and INT migrations in a fresh logical database on the isolated agent branch; treat this as schema-replay rehearsal, not as fresh-branch evidence.
9. When Neon API/MCP access is available, create a fresh Neon branch from the reviewed parent and replay foundation plus INT migrations there.
10. Run the secret-backed direct Neon integration test and record exact branch/database IDs and results.
11. Update the agent board and progress tracker to `complete; gate passed`, commit and push the evidence.

## Safety and cleanup

- Production deployment or mutation: none.
- Production data in agent branches: none.
- Branch/worktree force reset or deletion: none.
- Existing dirty changes overwritten or discarded: none.
- Worker branch/worktree cleanup: retained, as required until reviewed integration.
