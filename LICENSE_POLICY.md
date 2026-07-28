# Dependency Licence Policy

All runtime and development dependencies must be pinned by `package-lock.json`, represented in the generated dependency inventory, and accepted by `npm run licenses:check` before merge.

## Allowed baseline

The current baseline permits permissive licences such as MIT, ISC, BSD, Apache-2.0, 0BSD, BlueOak, CC0, and compatible dual-licence expressions.

The following require explicit review notes in the pull request and retained notices:

- LGPL components must remain dynamically linked or separately replaceable; source and relinking obligations must not be obstructed. The current instances are transitive Sharp/libvips platform binaries.
- MPL-2.0 components may be used when modifications to MPL-covered files remain identifiable and the required source obligations can be met. The current instances are Lightning CSS packages.
- CC-BY-4.0 data must retain attribution. The current instance is browser-compatibility data supplied by `caniuse-lite`.

## Prohibited without legal approval

Unknown or missing licence metadata, AGPL, GPL, SSPL, Commons Clause, BUSL, Elastic License, source-available licences, non-commercial restrictions, field-of-use restrictions, or incompatible copyleft terms block merge until legal and architecture review is complete.

## Evidence

Run:

```bash
npm ci
npm run licenses:check
npm run provenance:generate
```

Generated evidence is stored in:

- `artifacts/dependency-licenses.json`
- `artifacts/sbom.cdx.json`
- `THIRD_PARTY_NOTICES.md`

The package distributions remain authoritative for complete licence texts and notices.
