# CARE-01 Restricted Interface Evidence

## Implemented surfaces

`apps/web-admin/src/features/student-support/index.tsx` provides module-local restricted interfaces:

- aggregate student-support summary;
- clinic queue and medication step-up entry;
- behavior and restorative follow-up queue;
- pastoral/wellbeing referral queue;
- existence-protected safeguarding case workspace;
- learning-support referral and plan queue;
- break-glass review panel;
- exact disclosure approval panel.

The interfaces accept already-authorized projections. They do not query CARE source stores directly
and do not accept narrative fields in broad-role queue props.

## Privacy and authorization states

- Unauthorized restricted records render a generic “Record unavailable” state.
- Safeguarding case references render only inside the active case-membership workspace.
- AAL1 sessions see step-up guidance and disabled high-risk controls.
- Audit-service failure disables restricted reads instead of rendering stale or unaudited content.
- Suppressed metrics render “Suppressed,” never zero, null or an inferred range.
- Empty states describe the current authorized scope and do not imply that hidden records do or do not
  exist.

## Accessibility and internationalization

- semantic headings, tables, captions, row/column headers and named regions;
- keyboard-reachable scroll regions and controls;
- visible focus styles in browser proof;
- controls use explicit accessible names;
- logical text alignment and `dir="rtl"` support;
- mobile tables remain horizontally scrollable rather than clipping actions;
- no color-only status contract;
- reduced-motion-safe browser fixture;
- dates use machine-readable `<time>` values;
- no duplicate IDs in the browser evidence fixture.

## Automated evidence

- `tests/student-support/interfaces.test.tsx` performs static React rendering checks for suppression,
  existence masking, step-up, RTL and prohibited-field absence.
- `tests/student-support/browser.e2e.ts` checks semantic navigation, keyboard focus, mobile overflow,
  RTL alignment, disabled high-risk actions, duplicate IDs and absence of restricted terms.
- `tests/student-support/playwright.config.ts` fixes viewport and execution settings for deterministic
  browser evidence.

## Prohibited broad-interface fields

Broad operational surfaces do not accept or render:

- clinic or counselling narrative;
- diagnosis-like findings;
- medication details;
- behavior source narrative;
- safeguarding allegation, reporter or chronology;
- learning assessment findings or accommodation rationale;
- family detail;
- exact disclosure recipient internals;
- direct attachment or object-storage URLs.

## Design authority limitation

The requested root `PRODUCT.md`, root `DESIGN.md`, `docs/design/README.md` and
`.agents/skills/impeccable/SKILL.md` were not present on the reviewed branch/base available through
GitHub. CARE therefore followed the existing React/shared-package conventions and the module prompt’s
accessibility, localization and mobile requirements without inventing a new foundation design system.
This missing-authority evidence must be reviewed during integration if those files exist only in an
unpublished workspace.
