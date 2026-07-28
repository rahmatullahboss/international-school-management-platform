# UI Delivery Workflow with Impeccable

## 1. Purpose

This workflow turns design quality into an executable module gate. It applies to every new page, screen, flow, dashboard, form, portal and shared UI component.

The same module agent performs discovery, implementation, critique, audit, hardening and polish. These phases are not separate agent assignments.

## 2. Session bootstrap

At the start of a UI-design session, from the repository root run once:

```bash
node .agents/skills/impeccable/scripts/context.mjs --target <representative-route-or-source-file>
```

Follow the returned directives and load the one command reference that owns the task. Do not rerun context repeatedly in the same session.

Before the first UI implementation in the project:

1. `FND-01` runs `$impeccable init`.
2. The resulting `PRODUCT.md` is reviewed against the approved product documents.
3. The first visual direction is selected through Impeccable’s new-work process.
4. Shared tokens/components are implemented.
5. `DESIGN.md` is created from the approved direction and implemented system.
6. `PRODUCT.md`, `DESIGN.md`, design tokens and shared primitives become foundation-owned contracts.

## 3. New feature sequence

### Phase A — Shape

Use `$impeccable shape <feature-or-surface>` when the workflow, hierarchy, states or responsive structure are materially open.

The brief must identify:

- Persona and operating context
- Primary job and success condition
- Real records/data the surface carries
- Main action and secondary actions
- Permission and relationship context
- Loading, empty, validation, error, restricted, read-only and success states
- Typical and maximum content/data ranges
- Mobile/tablet/desktop behavior
- Localization, RTL, accessibility and low-bandwidth constraints
- Explicit anti-goals and untouched boundaries

Persist an approved surface brief where the Impeccable workflow specifies. The brief is module-owned documentation.

### Phase B — Build

Before editing UI, load the Impeccable craft floor. Build against:

- `PRODUCT.md`
- `DESIGN.md`
- Shared design tokens and components
- The feature surface brief
- Module domain/API/permission contracts

Rules:

- Use semantic tokens rather than feature-local colour inventions.
- Standard controls must remain familiar in Operate mode.
- Every interactive component implements default, hover, focus, active, disabled, loading and applicable error/success states.
- Domain logic remains in module application/domain layers, never duplicated in presentation code.
- Dashboards define every metric and provide traceable drill-down.
- Tables and forms must support keyboard, touch, responsive layouts and long/localized content.
- Synthetic examples must be labelled when a user could mistake them for real claims or customer data.

### Phase C — Critique

Run `$impeccable critique <target>` after the complete representative workflow is usable.

Critique must assess:

- Product-specific hierarchy rather than generic visual attractiveness
- Task clarity and information architecture
- Whether the interface fits the real school-work scene
- Cognitive load and progressive disclosure
- Meaningful empty/error/permission states
- Consistency with the approved visual world
- Generic AI/SaaS patterns and unnecessary card-heavy structure

P0/P1 findings block the UI checkpoint. Relevant critique reports under `.impeccable/critique/` are committed as evidence.

### Phase D — Audit

Run `$impeccable audit <target>` and ordinary automated checks.

The audit covers:

- Accessibility
- Performance
- Theming and token compliance
- Responsive behavior
- Implementation integrity

Minimum technical checks include:

- Axe/accessibility tests where available
- Keyboard and focus-path verification
- Mobile, intermediate and wide viewport tests
- 200% zoom/text scaling
- RTL and long-translation fixtures
- Empty, large-data and error fixtures
- Reduced-motion behavior
- Console and network failures
- Deterministic Impeccable detector

The module report records the audit score and all unresolved accepted exceptions.

### Phase E — Harden

Use `$impeccable harden <target>` for production states:

- Long/empty/special-character content
- RTL, CJK and translated text expansion
- Offline, slow, timeout and retry
- 400/401/403/404/409/429/500 behavior
- Duplicate action and concurrent update
- Permission changes during a workflow
- Large datasets, pagination/virtualization and bounded queries
- Safe recovery without losing user input

Use `$impeccable adapt`, `clarify`, `layout`, `typeset`, `optimize` or another specific command when an audit finding has a narrower owner.

### Phase F — Polish

Run `$impeccable polish <target>` only after the flow is functionally complete.

Polish is not permission to redesign the feature. It resolves:

- Remaining visual hierarchy and spacing drift
- Inconsistent controls, icons, states and terminology
- Cross-viewport defects
- Token/component drift
- Motion and feedback inconsistencies
- Dead CSS, temporary assets and duplicated implementations

Walk the complete path again with keyboard, pointer and touch-sized viewport before completion.

## 4. Checkpoint evidence

A UI-bearing milestone cannot be marked complete without:

```text
Impeccable skill version:
Target/surface:
PRODUCT.md version or SHA:
DESIGN.md version or SHA:
Surface brief path:
Critique report/result:
Audit score and P0/P1 result:
Detector command/result:
Accessibility command/result:
Browser/E2E command/result:
Responsive/RTL/long-content fixtures:
Polish completed:
Intentional exceptions and approval:
```

## 5. CI and hook behavior

Repository hooks run on direct UI edits for Codex and GitHub Copilot. CI should additionally run a deterministic scan against frontend source once source paths exist, for example:

```bash
npx impeccable detect apps packages --json
```

The final source paths and failure threshold are established by `FND-01`. The detector does not replace browser, accessibility, visual or product-UX review.

## 6. Definition of done

A UI scope is complete only when:

- The complete user job is functional, not merely visually mocked.
- Permission and data states match backend contracts.
- P0/P1 critique/audit issues are resolved.
- The deterministic detector has no unreviewed blocking finding.
- Keyboard, touch, screen-reader semantics and focus are verified.
- Responsive, long-content, RTL, slow/error and empty states are verified.
- The implementation uses shared tokens/components or has an approved extension.
- The rendered result is inspected and polished.
- Evidence is committed with the owning module checkpoint.
