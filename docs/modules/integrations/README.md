# Internationalization and Integration Platform

`INT-01` owns the country-pack, integration-runtime and migration-studio modules. The module extends the frozen foundation contracts without changing foundation-owned packages or tables.

## Stream boundaries

- Country and curriculum configuration remains versioned and immutable after release.
- Tenant overrides are explicit, validated and tied to an exact pack version.
- Public APIs, credentials, webhooks and connector data transfers are tenant-scoped and auditable.
- Imports and migrations execute through domain commands rather than direct writes to another module's tables.
- Education standards are implemented as versioned adapter profiles, not as replacements for the internal domain model.
- Country packs provide configuration and approved templates; they do not make legal-compliance claims or replace security/accounting invariants.

## Database ownership

Module migrations are stored beside their owning package and create only the logical schemas assigned to `INT-01`:

- `country_pack`
- `integration`
- `migration_studio`

The long-lived agent database branch is `agent/int-01-integrations`. Foundation migrations are replayed before module migrations because the Neon project default branch did not contain the reviewed foundation schema at branch creation time.

## Evidence index

- [Country-pack engine](./country-packs.md)
- [Integration runtime](./integration-runtime.md)
- [Import/export foundation](./import-export.md)
- Migration studio: pending milestone 4
- OneRoster profile: pending milestone 5
- LTI and SSO profiles: pending milestone 6
- Administration, observability and final verification: pending milestone 7
