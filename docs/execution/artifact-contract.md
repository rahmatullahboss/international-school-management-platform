# Execution Artifact Contract

The whole-module roadmap is valid only when all conditions below pass.

## Required files

- `docs/execution/README.md`
- `docs/execution/FND-01-ONE-SHOT-PROMPT.md`
- `docs/execution/01-module-stream-short-commands.md`
- `docs/execution/02-module-stream-full-prompts.md`
- `docs/execution/03-agent-board.json`
- `docs/execution/04-progress-tracker.md`
- `docs/execution/05-module-ownership-and-integration-contracts.md`
- `docs/execution/06-open-source-clean-room-policy.md`
- `docs/execution/artifact-contract.md`
- `docs/design/README.md`
- `docs/design/01-product-design-input.md`
- `docs/design/02-ui-delivery-workflow.md`
- `docs/design/03-agent-design-contract.md`
- `docs/adr/ADR-006-impeccable-design-governance.md`
- `.agents/skills/impeccable/SKILL.md`
- `.codex/hooks.json`
- `.github/skills/impeccable/SKILL.md`
- `.github/hooks/impeccable.json`
- `THIRD_PARTY_NOTICES`
- `scripts/validate_execution_artifacts.py`

## Required streams

- `FND-01`
- `SIS-01`
- `FIN-01`
- `INT-01`
- `ACAD-01`
- `OPS-01`
- `CARE-01`
- `EXP-01`
- `INTEG-01`

## Structural requirements

- Every stream has a unique Git branch, except the foundation bootstrap checkout may use the repository root worktree.
- Every non-foundation stream has a unique fixed worktree.
- Every stream has a unique Neon branch.
- Every stream has at least four substantial internal milestones.
- `microtask_agents_allowed` and `agent_delegation_allowed` are false.
- Hyperdrive is not required by the database baseline.
- The full-prompt document contains a section matching every board `full_prompt_section`.
- The short-command catalog and progress tracker reference every stream ID.
- The foundation stream is Wave 0 and has no dependencies.
- Wave 1 depends on foundation.
- Wave 2 depends on reviewed Wave 1 integration.
- `EXP-01` depends on reviewed Wave 2 integration.
- `INTEG-01` is serial and accepts reviewed SHAs only.

## Execution requirements

Every prompt states:

- one agent owns the whole stream;
- no delegation/subagent spawning;
- exact branch/worktree/Neon branch verification;
- ordered milestones;
- focused tests and checkpoint commits;
- automatic continuation after normal milestones;
- context-limit checkpoint/resume behavior;
- hard stops;
- no unauthorized production mutation;
- final completion report fields.

## Ownership requirements

- Module paths do not overlap intentionally.
- Shared foundation paths are frozen after foundation integration.
- Cross-module writes use contracts/events rather than direct table mutation.
- Contract-change requests have a documented path and approval process.
- The integration stream cannot silently redesign semantic invariants.

## Design requirements

- The repository-local Impeccable skill is installed for Codex and GitHub providers.
- Codex and GitHub hook manifests point to the installed skill scripts.
- `FND-01` owns `PRODUCT.md`, `DESIGN.md`, shared design-system contracts and detector CI.
- UI-bearing module prompts require the same module agent to shape, build, critique, audit, harden and polish.
- UI checkpoint evidence includes skill version, design authority SHAs, detector, accessibility, responsive/RTL and polish results.
- Microtask design agents are prohibited.

## Open-source requirements

- GPL/AGPL/no-license code is not approved for direct copying into proprietary core.
- Permissive reuse requires notices and provenance.
- LGPL reuse requires case-specific compliance review.
- The implementation prompt prohibits line-by-line translation of restricted source.
- Foundation must create SBOM, notices and license-gate infrastructure.

## Validation command

After Git/bootstrap creates the application repository, run:

```bash
python3 scripts/validate_execution_artifacts.py
```

Expected result:

```text
execution artifact validation: PASS
```

This validator checks document structure only. It does not replace human architecture, license, security or implementation review.
