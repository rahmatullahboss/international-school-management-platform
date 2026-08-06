# Impeccable Design Governance

**Status:** Installed and adopted for all frontend work
**Installed skill:** Impeccable skill v4.0.2
**CLI used for installation:** `impeccable` 3.4.0
**Upstream:** `pbakaus/impeccable`
**License:** Apache-2.0

## 1. Decision

All frontend design, redesign, UX shaping, UI critique, accessibility audit, responsive hardening and final visual polish must use the repository-local Impeccable skill.

Installed provider paths:

- Codex/agent skill: `.agents/skills/impeccable/`
- Codex design hook: `.codex/hooks.json`
- GitHub Copilot skill: `.github/skills/impeccable/`
- GitHub Copilot hook: `.github/hooks/impeccable.json`

Agents must load the local skill rather than relying on remembered design conventions. The skill supplies product/brand modes, typography, colour, spatial design, motion, interaction, responsive behaviour, UX writing, anti-pattern detection and visual review workflows.

## 2. Product files controlled by the design system

Impeccable separates product truth from visual truth:

- `PRODUCT.md` records durable product facts: users, jobs, workflows, positioning, constraints, terminology, platform and accessibility requirements.
- `DESIGN.md` records the approved visual system: tokens, typography, colour, layout, depth, shapes, components and explicit design rules.
- `.impeccable/design.json` and surface briefs may be generated when the selected workflow requires them.
- `.impeccable/critique/*.md` stores committed design review evidence.
- [`04-operational-ux-continuity-research.md`](04-operational-ux-continuity-research.md) records the reviewed interaction research, external skill comparison and project-specific continuity rules.

`FND-01` must create `PRODUCT.md` through `$impeccable init` using the approved product documents and owner-confirmed facts. It must not invent commercial claims or visual direction.

`DESIGN.md` is created only after the initial product visual direction and shared UI implementation are approved. Before real UI exists, use the factual input brief in [`01-product-design-input.md`](01-product-design-input.md); do not create a fake mature design system.

## 3. Product modes

Most authenticated school-management interfaces use **Operate** mode:

- Admin, finance, admissions, teacher and operational workflows
- Dense tables, forms, dashboards, settings and case-management screens
- Familiar affordances, scanability, accessibility and consistency over decorative novelty

Other modes:

- **Persuade:** public website, pricing, admissions marketing and launch pages
- **Read:** reports, help, documentation, policies and long-form content
- **Experience:** rare showcase or portfolio-like surfaces only

The surface mode is chosen from the user’s task, not from the overall product category.

## 4. Required delivery sequence

For a new surface or materially new workflow:

1. Run the Impeccable session context command once.
2. Confirm `PRODUCT.md` exists; otherwise complete `$impeccable init`.
3. Run `$impeccable shape <surface>` before implementation when information architecture, states or interaction remain open.
4. Build inside the owning module using the approved `DESIGN.md`, shared tokens and components.
5. Run `$impeccable critique <surface>` for product-specific hierarchy and UX quality.
6. Run `$impeccable audit <surface>` for accessibility, performance, theming, responsive behaviour and implementation integrity.
7. Resolve material findings with the appropriate commands, commonly `adapt`, `clarify`, `layout`, `typeset`, `harden` and `optimize`.
8. Run `$impeccable polish <surface>` as the final visual and interaction pass.
9. Run the deterministic detector and ordinary browser/accessibility tests before checkpoint completion.

Full workflow: [`02-ui-delivery-workflow.md`](02-ui-delivery-workflow.md).

## 5. Agent ownership

Impeccable does not change the whole-module ownership rule.

- The module agent that owns a business module also owns that module’s feature UI end-to-end.
- A separate agent is not created for each screen, component, audit issue or polish pass.
- `FND-01` owns `PRODUCT.md`, `DESIGN.md`, design tokens, shared UI primitives, accessibility baseline and design tooling.
- Module agents may extend compatible feature patterns inside their owned paths.
- `EXP-01` owns application composition, persona navigation and cross-module journeys, but cannot move domain rules into UI code.
- `UX-01` may refine cross-persona navigation, loading infrastructure and task discovery without moving domain rules or weakening capability filtering.
- Breaking shared design-system changes require a contract-change request.

See [`03-agent-design-contract.md`](03-agent-design-contract.md).

## 6. Automatic hooks

The installed Codex and GitHub hooks run Impeccable’s deterministic detector after design-relevant edits. They surface mechanical problems such as contrast, overflow, broken imagery, touch targets and design-system drift.

A clean hook result is necessary but not sufficient. Agents must still inspect rendered output, complete the actual workflow, verify keyboard/touch behaviour and run critique/audit/polish at the documented gates.

Codex users must approve the repository hook in `/hooks` after first checkout or when `.codex/hooks.json` changes.

## 7. Update procedure

From the repository root:

```bash
npx impeccable check
npx impeccable update --providers=codex,github --scope=project
```

After update:

1. Review all generated skill/hook changes.
2. Re-approve the Codex hook when requested.
3. Run `npx impeccable check`.
4. Run `python3 scripts/validate_execution_artifacts.py`.
5. Commit the skill update separately with upstream version evidence.

Never hand-edit generated files inside `.agents/skills/impeccable/` or `.github/skills/impeccable/`. Project-specific policy belongs under `docs/design/`, `PRODUCT.md`, `DESIGN.md` and shared configuration.
