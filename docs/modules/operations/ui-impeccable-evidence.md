# OPS-01 admin UI — Impeccable workflow evidence

## Context

Target: a school-wide operations command centre for administrators and domain managers across HR, procurement, inventory/assets, library, transport, hostel, cafeteria and activities/trips.

Primary user tasks:

1. Identify safety, service and financial-control exceptions quickly.
2. Understand the scoped operational position and the source behind each number.
3. Work approval/exception queues without exposing actions the current role cannot perform.
4. Navigate into the relevant domain record while retaining campus/date context.

Constraints applied:

- Existing admin shell remains the composition boundary.
- No foundation-owned design token or shell changes.
- Permission visibility is enforced before rendering actions, queues and modules.
- Critical approvals show an AAL2/step-up cue.
- Content must work with keyboard, screen readers, narrow viewports, RTL and forced-colour modes.
- Untrusted labels/details are escaped and only internal/fragment links are rendered.

Implementation:

- `apps/web-admin/src/features/operations/operations-command-centre.ts`
- `tests/operations/operations-admin-ui.test.ts`

## Critique

### Findings before composition

- A grid of isolated totals would repeat the existing “number wall” problem: users could not see why a value changed, where it came from or what action was required.
- Domain-first navigation would force users to inspect every module before finding critical exceptions.
- Wide operational tables would lose labels and context on mobile.
- Permission-blind quick actions would create dead ends and unsafe escalation paths.
- Colour-only severity or status would fail non-visual and forced-colour use.
- Physical left/right CSS would break RTL layouts.

### Responses

- Exceptions are the first major section and are sorted critical → high → medium → low.
- Every exception includes domain, title, detail, owner, age and a record link.
- Metrics include context and a source label rather than a bare number.
- Approval/work queues include count and oldest age.
- Modules are ordered by exception count and expose a textual status.
- Quick actions are permission-filtered; step-up actions include explicit text and `data-step-up="aal2"`.
- Mobile tables become labelled record blocks using `data-label`.
- Severity always has visible text; colour is supplementary.
- CSS uses logical properties such as `margin-inline`, `padding-block`, `border-inline-start` and `inset-inline-start`.

## Audit

Automated audit coverage:

- Semantic landmarks, one page heading, section headings and skip link.
- Live operational status via `role="status"` and `aria-live="polite"`.
- Table caption and column scopes.
- Permission filtering for exceptions, queues, modules and actions.
- Severity ordering.
- RTL `lang`/`dir` output and absence of physical margin properties.
- Responsive breakpoint and mobile table labels.
- Reduced-motion and forced-colour media queries.
- HTML escaping and unsafe URL rejection.
- Scoped empty state rather than a blank dashboard.

Proof command:

```sh
npx vitest run tests/operations/operations-admin-ui.test.ts
```

## Accessibility

- Skip link targets the focusable `main` region.
- Keyboard focus uses a high-visibility `:focus-visible` outline.
- Headings and landmarks provide a navigable document outline.
- Exception status is announced without requiring focus movement.
- Table semantics remain intact on desktop; mobile cells retain programmatic visible labels.
- Links contain meaningful task/domain text, not icon-only controls.
- Severity and module state are expressed in text.
- Reduced-motion mode removes non-essential transition/animation duration.
- Forced-colour mode restores explicit borders.
- `lang` and `dir` are rendered from the scoped locale.

## Responsive and RTL

- Metric and module grids use `auto-fit` with bounded minimum sizes.
- The queue/action two-column layout collapses to one column below 50rem.
- Exception rows become labelled blocks below 50rem; horizontal scrolling is not required.
- As-of metadata changes from end alignment to start alignment on narrow screens.
- All directional spacing/borders use logical properties, so the same markup supports LTR and RTL.

## Hardening

- All user/data labels are HTML escaped before rendering.
- Links that do not begin with `/` or `#` are replaced with `#`; `javascript:` and external injection are rejected.
- Duplicate IDs in metrics/exceptions/queues/modules/actions are removed deterministically.
- Permission checks support exact, domain wildcard and `operations.*` grants.
- API errors return stable codes/messages without stack traces.
- API summary/report/command routes require tenant, principal and campus context.
- State-changing commands carry correlation and optional/required idempotency context; the application façade enforces handler policy.

Proof commands:

```sh
npx vitest run \
  tests/operations/operations-api.test.ts \
  tests/operations/operations-application.test.ts \
  tests/operations/operations-admin-ui.test.ts \
  tests/operations/permissions.test.ts
npm run typecheck
```

## Polish

- Page hierarchy is “Act first → Understand → Work next → Do → Explore”.
- Exception summary states total, critical and high counts.
- Metrics use tabular numerals and show their data source.
- Queues show oldest age to expose stalled work.
- A positive state replaces empty exception/queue areas.
- A scoped empty state directs the user to check campus, date and permissions.
- Timestamps distinguish report date from generated/update time.
- Reusable model/render functions keep UI logic testable and independent of transport/runtime wiring.

## Evidence limitation

The workspace has no documented browser-automation or visual-regression harness in the reviewed base. Evidence is therefore semantic-render, CSS-contract, security and type/test based rather than screenshot-diff based. No browser or production deployment was performed.
