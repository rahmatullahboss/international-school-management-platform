# ACAD-01 UI Workflow Evidence

## Authority and workflow substitution

Impeccable 4.0.2 was loaded from the repository skill. The required context command was run once for `apps/web-admin/src/features/academics`.

The exact reviewed base `8cc8ee1562ade672b14c1c44af935fe7e2307976` does not contain foundation-owned `PRODUCT.md` or `DESIGN.md`. ACAD did not create or modify those authorities. UI decisions therefore use the repository's existing semantic React surfaces, incumbent design language, product/architecture documents and the Impeccable Operate workflow. Both workspaces include a direction contract at the top of the component source.

## Direction

### Admin

The admin surface is a bright institutional operations ledger. Its purpose is to show what can publish or close, what is blocked and why, and the exact queue/action that resolves the blocker. It intentionally avoids a generic metric-card dashboard. Tables, definition lists and explicit row actions are the dominant forms.

### Teacher

The teacher surface follows the teaching day: synchronization integrity, next class, attendance reconciliation, assessment results and report-card comments. It intentionally avoids modal-first workflows and decorative classroom metaphors. Ordinary HTML forms make the server-side permission and validation boundary visible.

## Impeccable detector

Command:

```text
node .agents/skills/impeccable/scripts/detector/detect-antipatterns.mjs apps/web-admin/src/features/academics apps/web-teacher/src/features/academics
```

Result: 0 findings across 6 checked files.

The detector found no excessive card grids, gradient misuse, floating rounded containers, oversized headline treatment, fake icons, repeated helper-text titles, or competing accent colours.

## Critique pass

The critique was performed as a single-agent/manual pass because the ACAD execution contract prohibits creating implementation agents for small tasks.

### Findings and resolutions

1. **Long-page keyboard access** — the first version required tabbing through the masthead/navigation to reach core work. Both surfaces now provide focused skip links.
2. **Locale-dependent counts** — raw English plural concatenation was not safe for non-English plural rules. Counts now use `Intl.NumberFormat` and `Intl.PluralRules`.
3. **Teacher recovery states** — the first version represented synchronization errors but not a failed teacher read model. Explicit loading and recoverable error surfaces were added.
4. **Global token leakage** — prefixed custom properties initially lived on `:root`. They are now scoped to each workspace root.
5. **Long content** — names, course labels and error messages could overflow narrow cells. Both workspaces use `overflow-wrap: anywhere` and horizontally scrollable, focusable table regions.
6. **Grade-entry placeholder** — `not-entered` could be posted as a result state. The select now uses a disabled empty placeholder and requires an explicit valid state.

## Accessibility audit

Source and SSR assertions cover:

- one `main` landmark per rendered state;
- visible `h1` and ordered section headings;
- table captions and column headers;
- keyboard-focusable overflow regions;
- visible `:focus-visible` indicators;
- hidden labels/`aria-label` for compact row forms;
- `role="status"`, `aria-live`, `aria-busy` and `role="alert"` where appropriate;
- no colour-only status communication (status text is always present);
- disabled attendance finalization while roster results are missing;
- permission-gated mutation forms/links;
- forced-colour borders;
- reduced-motion treatment for skeleton animation.

Automated browser accessibility tooling is not configured in the reviewed base, so the gate uses semantic source review, strict TypeScript, SSR markup tests and CSS assertions rather than claiming an unavailable axe/browser scan.

## Responsive and RTL audit

- Components accept explicit `direction` and infer RTL for Arabic locales.
- CSS uses logical properties (`padding-inline`, `margin-inline`, `inset-block-start`, `inset-inline-start`, block/inline borders).
- Static tests reject physical left/right margin and padding declarations.
- Sticky navigation remains horizontally scrollable at narrow widths.
- Tables retain semantic structure and scroll inside keyboard-focusable regions rather than collapsing into unlabeled cards.
- Admin masthead and teacher masthead collapse to one column.
- Teacher schedule and row forms collapse to compact single-column layouts.
- SSR tests exercise both admin and teacher with `dir="rtl"`.

## Hardening

Covered states:

- admin: ready, loading, recoverable read error, empty queues, blocked rows, permission-limited actions;
- teacher: ready, loading, recoverable read error, online/offline/syncing/error synchronization, no schedule, no selected attendance session, incomplete/finalized attendance, no assessments, draft/approved/published comments;
- long content and narrow layouts;
- stale/offline changes remain visible rather than being silently treated as saved;
- finalization and locked/finalized corrections route through explicit workflows;
- destructive actions are not placed in these overview surfaces.

## Polish pass

The final polish pass removed global CSS token scope, duplicate overview identifiers, empty retry links and implicit invalid grade-state submission. Numeric values use locale-aware formatting. Action language is explicit (`Review issue`, `Resolve conflict`, `Reconcile session`, `Open gradebook`) rather than generic `View` or `Submit` labels.

## Verification

Focused checks:

- application-service tests: 6/6 pass;
- SSR academic UI tests: 6/6 pass after hardening;
- admin TypeScript project build: pass;
- standalone teacher strict TypeScript: pass;
- focused ESLint: pass;
- Prettier: pass.

The UI test suite also inspects CSS for responsive breakpoints, logical properties, forced-colour support, reduced-motion support and visible focus rules.
