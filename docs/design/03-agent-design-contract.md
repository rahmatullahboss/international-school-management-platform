# Agent Design Contract

## 1. Whole-module rule remains authoritative

Impeccable is a design capability used by the owning module agent. It does not authorize microtask agents.

One module agent remains responsible for:

- UX shaping and state inventory
- Feature UI implementation
- Responsive and accessibility behaviour
- Design-system alignment
- Critique, audit, hardening and polish
- Browser, visual and interaction tests
- Design evidence in the module completion report

The agent must not spawn one agent for design, another for accessibility, another for mobile and another for polishing the same module.

## 2. Foundation ownership

`FND-01` owns and freezes:

- `.agents/skills/impeccable/**`
- `.codex/hooks.json`
- `.github/skills/impeccable/**`
- `.github/hooks/impeccable.json`
- `PRODUCT.md`
- `DESIGN.md`
- `.impeccable/config.json`
- Shared design tokens and component primitives
- Shared app shells, focus/accessibility utilities and responsive conventions
- Storybook/component catalogue or equivalent design-system documentation
- Design detector CI wiring
- `docs/design/**` governance documents

Generated upstream skill files are updated only through the official Impeccable installer/update command, not manually edited.

## 3. Module ownership

Each module agent owns feature UI only under its declared feature paths. It may:

- Compose shared components
- Add module-local components when their intent is genuinely module-specific
- Add compatible variants through existing extension contracts
- Create module surface briefs and critique evidence
- Fix design issues inside its owned feature scope

It may not:

- Change global tokens, typography, component APIs or navigation conventions silently
- Copy a shared component into a module to avoid requesting a compatible extension
- Create a competing theme or design-system package
- Move domain calculations or authorization rules into UI components
- Edit another module’s feature UI

A required breaking design-system change uses the standard contract-change request process.

## 4. Stream requirements

### FND-01

- Install/verify Impeccable for Codex and GitHub providers.
- Run `$impeccable init` and create reviewed `PRODUCT.md`.
- Establish the initial visual direction through the approved Impeccable new-work decision flow.
- Build shared tokens, typography, semantic colour, spacing, focus, form, table, feedback and layout primitives.
- Create `DESIGN.md` only after the direction and implementation agree.
- Configure hook/CI detector behavior.
- Provide reference shells and states for admin/product UI.
- Pass accessibility, responsive, RTL and long-content foundation tests.

### SIS-01

- Shape and implement admissions/admin/family workflows using the shared system.
- Verify long names, households, multi-child relationships, document states and incomplete applications.
- Provide guardian-safe empty/error/permission states.

### FIN-01

- Optimize for dense, traceable Operate-mode workflows.
- Ensure amounts, source documents, posting status and reconciliation are visually unambiguous.
- Do not hide accounting state behind decorative summaries.
- Test large values, currency formats, negative/credit values, closed periods and permission separation.

### INT-01

- Own country-pack/integration administration UX.
- Verify locale switching, RTL, long translation, date/number/currency formatting and mapping/reconciliation errors.
- Ensure connector health, retry and disclosure status are understandable.

### ACAD-01

- Prioritize rapid attendance, timetable readability and explainable grade calculations.
- Test dense rosters, small screens, offline/retry, long course names and publication/lock states.

### OPS-01

- Maintain one coherent operational vocabulary across HR, procurement, inventory, library, transport, hostel, cafeteria and activities.
- Internal operational areas remain part of the same stream, but shared patterns should be reused rather than visually fragmented.

### CARE-01

- Use calm, precise, non-sensational interfaces.
- Restricted, masked, break-glass and disclosure states must be unmistakable without exposing sensitive content.
- Design review includes privacy and safety impact, not aesthetics alone.

### EXP-01

- Compose persona shells and cross-module journeys from stable module contracts.
- Own navigation, responsive application composition, communications, documents and governed reporting experience.
- Run broad cross-module critique/audit/polish passes without rewriting module domain behavior.

### INTEG-01

- Verify `PRODUCT.md`, `DESIGN.md`, skill version, hook manifests and design evidence are coherent after integration.
- Run deterministic scans, accessibility suites, persona journeys and visual regression checks.
- Reject a module completion report missing required design evidence.

## 5. Design hard stops

A UI milestone stops when:

- `PRODUCT.md` is missing for first product design work.
- The requested visual change conflicts with an approved `DESIGN.md` contract and lacks authorization.
- The module needs to edit foundation-owned design paths.
- P0/P1 accessibility or task-completion failures remain unresolved.
- The interface exposes or implies unauthorized data.
- Required real content/claims/assets are unavailable and cannot be honestly represented with labelled synthetic material.
- A design decision needs owner confirmation and cannot be inferred from approved product facts.

## 6. Completion report fields

Every UI-bearing stream report includes:

- Impeccable skill version
- Design mode used per major surface
- Surface briefs created or updated
- Shared components/tokens consumed or extended
- Critique findings and resolution
- Audit score and unresolved exceptions
- Detector result
- Accessibility/browser/responsive/RTL evidence
- `PRODUCT.md`/`DESIGN.md` SHAs used
- Screenshots or visual-regression references where available
- Confirmation that no separate microtask design agents were used
