# ADR-006 — Impeccable Design Governance

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

The platform will be developed by several large module streams. Without a shared design authority, independent module agents can produce inconsistent navigation, controls, data density, responsive behaviour, accessibility and generic AI-generated SaaS patterns. Design review cannot be deferred entirely to the final portal stream because each module owns feature UI and domain-specific states.

## Decision

Adopt the repository-local Impeccable skill for all frontend design work.

- Install the Codex provider under `.agents/skills/impeccable/` with `.codex/hooks.json`.
- Install the GitHub provider under `.github/skills/impeccable/` with `.github/hooks/impeccable.json`.
- `FND-01` creates and freezes `PRODUCT.md`, `DESIGN.md`, shared design tokens/components and detector CI configuration.
- Every UI-owning module agent uses the Impeccable workflow inside its existing whole-module stream.
- A UI checkpoint requires shape/build/critique/audit/harden/polish evidence appropriate to scope.
- Deterministic detector hooks supplement but do not replace rendered visual, interaction, browser and accessibility verification.
- Generated skill files are updated only through the official installer/update command.

## Rationale

- Establishes a shared vocabulary and repeatable design process across agents.
- Keeps product truth separate from visual-system truth.
- Detects common mechanical and AI-generated UI anti-patterns during edits.
- Supports accessibility, responsive, internationalization, UX-writing and production-state hardening.
- Preserves the one-agent-per-whole-module operating model.

## Consequences

### Positive

- More consistent feature UI across parallel modules
- Earlier accessibility and responsive feedback
- Explicit design evidence at module checkpoints
- Version-controlled design skill and GitHub/Codex hooks
- Better resistance to generic template-driven UI

### Negative

- Larger repository due to provider-specific skill payloads
- Skill updates require generated-file review and hook re-approval
- `PRODUCT.md` and `DESIGN.md` become shared contracts that can create integration gates
- Design commands add verification work to every UI-bearing milestone

## Guardrails

- Do not create separate microtask design agents.
- Do not invent visual authority before product facts and direction are approved.
- Do not use a clean detector result as proof of good UX.
- Do not silently modify shared design tokens or component APIs from a module branch.
- Do not fabricate customer data, claims, metrics or regulatory proof in visual examples.
- Do not commit ephemeral screenshots, live session state or per-developer Impeccable configuration.

## Revisit conditions

- The skill becomes unmaintained or incompatible with the selected frontend stack.
- A formal design-system platform replaces the relevant workflow and provides equal or stronger automated/agent guidance.
- Repository size or provider duplication becomes materially problematic; evaluate a pinned submodule/link deployment.
