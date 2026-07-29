# EXP-01 Design Authority Gap

## Request

- **Requesting stream:** `EXP-01`
- **Observed checkpoint:** reviewed Wave 2 integration `60836a8fe92f64ba581c4bde65005729d1fe14b2`
- **Affected shared contract:** foundation-owned `PRODUCT.md`, `DESIGN.md` and `.impeccable/config.json`

## Current contract and gap

The design governance documents require every UI-bearing stream to load and record exact `PRODUCT.md` and `DESIGN.md` authorities before implementation. They also define missing `PRODUCT.md` as a design hard stop. The reviewed Wave 2 integration contains the Impeccable skill and approved design-input/governance documents, but the three root authority artifacts are absent.

## Required change

Create a compatible foundation repair that:

1. records durable, already-approved product facts in `PRODUCT.md`;
2. documents the incumbent Wave 2 operational design system in `DESIGN.md` without inventing a public brand identity;
3. restores the default project detector configuration in `.impeccable/config.json`.

No shared component API, token implementation, module behavior, database object or production environment changes as part of this repair.

## Business reason

`EXP-01` owns all persona shells and broad cross-module experience composition. Proceeding without explicit product/design authority would make navigation, status vocabulary, responsive behavior and accessibility inconsistent across admin, teacher, guardian and student applications, and would invalidate required Impeccable checkpoint evidence.

## Alternatives considered

- **Continue using only `docs/design/01-product-design-input.md`:** rejected because governance explicitly says it is not a substitute for `PRODUCT.md` or `DESIGN.md`.
- **Let EXP-01 create feature-local design rules:** rejected because root design authority and shared shell conventions are foundation-owned.
- **Pause all work pending a future rebrand:** rejected because a coherent incumbent operational system already exists and can be documented without deciding the public brand.

## Impact

- **Affected streams:** foundation governance, `EXP-01`, later `INTEG-01` final verification.
- **Migrations/events/APIs:** none.
- **Security/privacy/finance:** positive documentation impact only; the authority explicitly preserves masked denials, non-disclosure, traceable metrics and immutable financial/academic state.
- **Backward compatibility:** additive documentation/configuration repair. Existing module UI remains valid.

## Required verification

- repository format/lint/artifact validation;
- Impeccable context/doctor or deterministic detector can resolve the root authorities;
- no architecture-boundary or module-owned implementation changes;
- `EXP-01` consumes the reviewed repair commit and records both authority SHAs.

## Coordinator decision

**Approved as a compatible foundation contract repair.** The repair documents confirmed product facts and the incumbent implemented visual system. Final public brand assets, logo, custom typography and marketing identity remain explicitly undecided and cannot be fabricated by module agents.
