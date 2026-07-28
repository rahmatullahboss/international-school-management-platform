# Country-Pack Engine

## Contract

A `CountryPackManifest` is identified by `packKey` and positive integer `version`. Released manifests are deep-frozen by the application catalogue and persisted with immutable release metadata. The manifest records:

- country, locale and IANA time-zone defaults;
- ISO-style currency and minor-unit configuration;
- address requirements;
- academic weekend, grade-label and attendance-code configuration;
- required student/staff fields;
- retention defaults;
- versioned document-template keys;
- translation catalogues;
- explicit references to the frozen foundation security and accounting invariants.

Validation rejects a missing default locale/time zone, malformed currency configuration, duplicate locales, invalid weekend values and any attempt to replace foundation security or accounting invariants.

## Tenant activation and overrides

A tenant activation records the exact `<pack>@<version>`. Overrides are limited to supported locale, supported time zone, existing grade labels, existing attendance codes and registered template keys. Effective configuration is calculated without mutating the released pack.

Upgrade preview compares two published versions recursively, returns auditable changed paths and records the current version as the rollback target. Applying an upgrade remains a later tenant command and is not performed by the preview operation.

## Localization behavior

`LocalizationCatalog` provides case-insensitive locale resolution, generic-language fallback, tenant-pack fallback, interpolation and right-to-left direction for Arabic, Persian, Hebrew and Urdu language tags. Translation keys are stored independently from source-language UI text.

## Regression packs

Two synthetic, non-production data packs exercise materially different behavior:

1. `bd-national@1`: Bengali/English, `Asia/Dhaka`, BDT, Friday weekend and Bangladesh-oriented labels/templates.
2. `synthetic-gulf-validation@1`: Arabic/English, `Asia/Dubai`, AED, Saturday/Sunday weekend, RTL and different required fields/attendance semantics.

The regression harness validates the contract and produces a deterministic manifest fingerprint. The Gulf pack is intentionally synthetic and must not be presented as legal or regulatory compliance for any jurisdiction.

## Database migration

`202607280101_INT-01_country_pack_engine` creates:

- `country_pack.manifest_release` for validation/fingerprint evidence;
- `country_pack.tenant_override` with forced tenant RLS;
- `country_pack.regression_result` for immutable test evidence.

Neon evidence on 2026-07-28:

- project: `lingering-brook-52999532`;
- branch: `agent/int-01-integrations` (`br-super-truth-axp0urxi`);
- parent: `main` (`br-cool-wildflower-axsot8l1`);
- foundation migrations `202607280001` through `202607280005` replayed before the module migration;
- migration history contains `202607280101_INT-01_country_pack_engine`;
- `country_pack.tenant_override` has row-level security enabled.

## Focused verification

- `npx vitest run tests/integrations/country-packs.test.ts`: 6 passed.
- `npx tsc -p packages/modules/country-packs/tsconfig.json --noEmit`: passed.
