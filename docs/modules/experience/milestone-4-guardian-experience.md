# EXP-01 Milestone 4 — Guardian Household Experience

## Scope

This milestone delivers the guardian household and multi-child portal for linked child profiles, applications, published attendance, published grades, fees, forms and consent, authorised documents and secure communication. It consumes bounded relationship-authorised read models and links back to module-owned actions; it does not read private SIS, academic, finance, communication or CARE tables.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 3 merge `2521e7af3ddca7e958c29cc13c0c6153ecf1950a`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Mode: Operate; relationship-first, child-scoped, publication-aware and non-disclosing.

## Surface brief

- **Audience:** authenticated guardians managing one or more linked children and household-level tasks from desktops, low-cost phones and intermittent networks.
- **Job:** switch child context safely, understand published attendance and results, complete applications/forms/consent, review attributed balances, download authorised documents and communicate securely.
- **Primary action:** complete the highest-priority household or selected-child task without leaking another child’s context.
- **Constraints:** explicit relationship filtering, multi-child context integrity, published-only academic data, child/household fee attribution, currency preservation, AAL2 consent visibility, download authorization, secure-message filtering, long names, mobile layout, RTL, keyboard tables and recoverable errors.
- **Memorable moment:** switching a linked child changes every child-specific section consistently while household-wide records remain clearly labelled as household records.

## Contract

`GuardianHouseholdWorkspace` accepts linked child summaries plus capability-scoped applications, attendance, grades, fees, forms, documents and conversations. Child relationship and capability filtering occur before counts, totals, active-child resolution or rendering. Unlinked requested child identifiers produce a non-disclosing unavailable state. Unpublished grades are excluded even when present in the supplied read model.

## Implementation checkpoint

- Relationship-authorised linked-child switcher with one consistent active-child scope.
- Applications and admission next-action list.
- Published attendance summaries with publication timestamp and household notice.
- Published/revised grade view; unpublished results never render.
- Child/household-attributed fee statement table with preserved currency, balance state and payment link.
- Forms and consent queue with due/submission state and AAL2 requirement visible before action.
- Authorised document downloads bound to household/child scope.
- Secure conversations filtered by relationship and capability.
- Loading, recoverable error, no-linked-child and unlinked-child masked states.

## Verification

Canonical formatter checkpoint `d2ae2fd7ea19283add735cbd8929142abe1d3b1e` restored the standard repository CI and formatted the guardian workspace and focused tests. CSS side-effect declaration checkpoint `51439c9e906b866b7284662d61c6d12dc581d0cf` restored web-family type coverage.

Full verification run `30448315662` passed format, lint, architecture boundaries, repository typecheck, all tests, fresh 40-migration replay, live Neon driver, build, dependency audit, licences, provenance, all Chromium suites and execution-artifact validation. Focused tests prove relationship filtering, all-section child switching, published-only grades, child/household fee attribution, AAL2 consent visibility, authorised downloads/messages and unlinked/restricted non-disclosure. No production deployment or database mutation was performed.
