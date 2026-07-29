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

## Required active streams

- `FND-01`
- `SIS-01`
- `FIN-01`
- `INT-01`
- `ACAD-01`
- `OPS-01`
- `CARE-01`
- `EXP-01`
- `INTEG-01`

`MOB-01` is a documented planned extension, not an active required stream. Its planning artifacts live under `docs/mobile/`. It must not be inserted into the active board or treated as executable until `GATE-MOBILE-CONTRACTS-READY` and the client-only structural rules below are approved and implemented in the validator.

## Structural requirements

- Every stream has a unique Git branch, except the foundation bootstrap checkout may use the repository root worktree.
- Every non-foundation stream has a unique fixed worktree.
- Every database-owning stream has a unique Neon branch.
- The current validator assumes every active stream has a Neon branch. Before a client-only stream such as MOB-01 is activated, the schema/validator must support an explicit `database_branch_required: false` or an approved non-owning integration-environment representation.
- A client-only stream must never create direct database ownership merely to satisfy a structural assumption.
- Every stream has at least four substantial internal milestones.
- `microtask_agents_allowed` and `agent_delegation_allowed` are false.
- Hyperdrive is not required by the database baseline.
- The full-prompt document contains a section matching every active board `full_prompt_section`.
- The short-command catalog and progress tracker reference every active stream ID.
- The foundation stream is Wave 0 and has no dependencies.
- Wave 1 depends on foundation.
- Wave 2 depends on reviewed Wave 1 integration.
- `EXP-01` depends on reviewed Wave 2 integration.
- Planned `MOB-01` depends on reviewed Wave 3/mobile application contracts, exact API schema and mobile security approval.
- `INTEG-01` is serial and accepts reviewed SHAs only.

## Execution requirements

Every active prompt states:

- one agent owns the whole stream;
- no delegation/subagent spawning;
- exact branch/worktree/base and applicable database/API environment verification;
- ordered milestones;
- focused tests and checkpoint commits;
- automatic continuation after normal milestones;
- context-limit checkpoint/resume behavior;
- hard stops;
- no unauthorized production mutation or store submission;
- final completion report fields.

## Ownership requirements

- Module paths do not overlap intentionally.
- Shared foundation paths are frozen after foundation integration.
- Cross-module writes use contracts/events rather than direct table mutation.
- Client applications consume versioned APIs/read models and never private tables.
- Contract-change requests have a documented path and approval process.
- The integration stream cannot silently redesign semantic invariants.
- A client-only stream owns local client code, local-store migrations and generated clients only; backend domain behavior remains with its server owner.

## Design requirements

- The repository-local Impeccable skill is installed for Codex and GitHub providers.
- Codex and GitHub hook manifests point to the installed skill scripts.
- `FND-01` owns `PRODUCT.md`, `DESIGN.md`, shared design-system contracts and detector CI.
- UI-bearing module prompts require the same module agent to shape, build, critique, audit, harden and polish.
- UI checkpoint evidence includes skill version, design authority SHAs, detector, accessibility, responsive/adaptive/RTL and polish results.
- Native mobile checkpoints additionally include Android/iOS semantics, text scaling, device/window profiles, offline/sync/conflict states and privacy-safe notification/deep-link evidence.
- Microtask design agents are prohibited.

## Open-source requirements

- GPL/AGPL/no-license code is not approved for direct copying into proprietary core.
- Permissive reuse requires notices and provenance.
- LGPL reuse requires case-specific compliance review.
- The implementation prompt prohibits line-by-line translation of restricted source.
- Foundation must create SBOM, notices and license-gate infrastructure.
- Flutter/Dart packages and native plugins require transitive licence, provenance, maintenance, privacy, platform-support and replacement-plan review.

## Planned MOB-01 activation contract

Before MOB-01 can move from `docs/mobile/mobile-program-board.json` into the active execution board:

1. ADR-007 and mobile documentation are approved.
2. Reviewed Wave 3 or equivalent mobile-contract base SHA is recorded.
3. Exact mobile OpenAPI/read-model schema version is recorded.
4. Mobile threat model, offline allowlist and app identities are approved.
5. `scripts/validate_execution_artifacts.py` and board schema are updated/tested for a client-only stream without direct database ownership.
6. Short command, full prompt, progress tracker, ownership contract and integration plan include MOB-01 consistently.
7. Documentation validation and human architecture/security review pass.

Until then, `docs/mobile/MOB-01-WORKPACK.md` is a planning artifact and must not be used as an execution authorization.

## Validation command

After Git/bootstrap creates the application repository, run:

```bash
python3 scripts/validate_execution_artifacts.py
```

Expected result:

```text
execution artifact validation: PASS
```

This validator checks document structure only. It does not replace human architecture, licence, security, mobile privacy or implementation review.
