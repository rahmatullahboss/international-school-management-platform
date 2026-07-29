# Whole-Module Multi-Agent Execution System

**Status:** Active execution policy  
**Date:** 2026-07-28  
**Mobile continuation documented:** 2026-07-29  
**Operating rule:** one agent owns one complete large module; internal milestones are not separate agent assignments.

## 1. Purpose

এই execution system-টি foundation শেষ হওয়ার পর বড় বড় module আলাদা branch, worktree এবং যেখানে প্রয়োজন Neon database branch-এ নিরাপদভাবে parallel development করার জন্য। এটি microtask delegation plan নয়। প্রতিটি module agent end-to-end outcome-এর মালিক।

Owner operating decision: separate agents are used only for complete module streams. Small tasks, fixes and internal milestones stay with the agent that owns the module. The coordinator keeps documentation, the machine-readable agent board and the progress tracker synchronized throughout execution.

Native mobile is a client continuation of the same platform. It follows the same whole-module ownership rule but does not receive direct database ownership merely because earlier server modules use Neon branches.

## 2. Required artifacts

1. [FND-01 one-shot prompt](FND-01-ONE-SHOT-PROMPT.md)
2. [Short-command catalog](01-module-stream-short-commands.md)
3. [Complete agent prompts](02-module-stream-full-prompts.md)
4. [Machine-readable agent board](03-agent-board.json)
5. [Progress tracker](04-progress-tracker.md)
6. [Ownership and integration contracts](05-module-ownership-and-integration-contracts.md)
7. [Open-source clean-room policy](06-open-source-clean-room-policy.md)
8. [Artifact contract](artifact-contract.md)
9. Validation script: `scripts/validate_execution_artifacts.py`
10. [Planned native mobile documentation and MOB-01 workpack](../mobile/README.md)

The core board/validator currently governs FND-01 through EXP-01 and INTEG-01. MOB-01 remains planned and non-executable until the coordinator promotes it after its activation gate and updates the structural validator for a client-only stream.

## 3. Repository baseline

The public GitHub repository is `rahmatullahboss/international-school-management-platform`. The canonical documentation/base branch is `main`. `FND-01` must:

1. fetch and verify `origin/main` without rewriting its history;
2. resolve the latest reviewed `origin/main` HEAD and record the exact base SHA;
3. create or safely resume `program/foundation-neon-platform` in fixed worktree `.worktrees/fnd-01-foundation`;
4. preserve all current documentation and repository policy files;
5. create the application/engineering foundation on the target branch;
6. push traceable checkpoint commits without merging to `main`;
7. record the exact reviewed foundation commit in the progress tracker.

No module stream can start until its recorded entry gate passes.

## 4. Execution waves

### Wave 0 — Foundation only

- `FND-01` — Platform, Neon, tenancy, identity, security and shared contracts

No parallel agent is active in Wave 0.

### Wave 1 — Parallel business foundations

After `FND-01` is reviewed and integrated, these streams can start from the same exact reviewed base:

- `SIS-01` — People, households, admissions and student lifecycle
- `FIN-01` — Billing, payments, receivables and accounting ledger
- `INT-01` — Country packs, integration platform, migration and interoperability

These three streams are the first approved parallel set. They start only after `GATE-FOUNDATION-READY`, use the same exact reviewed foundation SHA, and each receives its own fixed Git branch/worktree and matching database branch. The parallel limit for the wave is three whole-module agents; no extra agents are created for their internal milestones.

### Wave 2 — Parallel operational domains

After Wave 1 contracts are integrated:

- `ACAD-01` — Academic structure, timetable, attendance, assessment and records
- `OPS-01` — HR, procurement, inventory, library, transport, hostel, cafeteria and activities
- `CARE-01` — Health, wellbeing, behavior, safeguarding and learning support

### Wave 3 — Unified experience

After the APIs/read models from the previous waves are stable:

- `EXP-01` — Admin, teacher, guardian and student experiences, communications, documents, reporting and PWA

### Planned Wave 4 — Native mobile applications

After reviewed Wave 3/mobile contracts and the mobile security gate are stable:

- `MOB-01` — One Flutter workspace producing School Family and School Staff native applications

`MOB-01` is documented in `docs/mobile/` but is not yet an active core-board stream. Documentation and contract-independent mobile foundations may proceed through a separately approved Stage A architecture branch while EXP-01 runs. Domain-integrated feature work starts only after `GATE-MOBILE-CONTRACTS-READY`.

### Serial integration

- `INTEG-01` — Reviews and integrates each completed server/web wave, orders migrations, resolves contract mismatches without violating ownership, runs cross-module verification and prepares release evidence.

`INTEG-01` is one continuous integration program. When a later wave is not yet complete, waiting for required reviewed SHAs is a documented gate, not permission to start unrelated work. Mobile integration/release evidence will require an approved extension of this program or a separately named client integration stream before MOB-01 activation.

## 5. Whole-module completion boundary

A module is not complete merely because its database, API or screen exists. The owning agent must finish the parts applicable to its stream:

- domain model and invariants for domain-owning streams;
- migrations, indexes, constraints and RLS for database-owning streams;
- commands, queries, events and idempotency;
- API and integration contracts;
- admin/persona/mobile UI required by the module;
- authorization, masking, audit and privacy behavior;
- imports, exports, operational reports and reconciliation where applicable;
- unit, integration, browser/device, tenant-isolation and performance tests;
- telemetry, alerts, runbook and module documentation.

A client-only stream does not invent database objects to appear complete. It proves compatibility with reviewed backend contracts, local-storage migrations and mobile release/security gates.

## 6. Branch, worktree and database-environment rules

- One stream has one Git branch.
- One stream has one fixed worktree.
- Every database-owning stream has one unique Neon branch.
- A client-only stream has no direct database ownership; it uses a traceable synthetic integration environment and exact backend schema version. The core artifact validator must be approved/updated before such a stream becomes executable.
- Module agents do not share writable paths.
- Module agents do not merge other module branches.
- Database and preview environments contain synthetic data only unless a separate approved pilot-data process exists.
- The Git base SHA and database/backend environment point are recorded before work begins.
- Preview environments and mobile builds are traceable to Git SHA, API schema and environment.

## 7. Internal milestone behavior

Each stream contains several large serial milestones. The same agent:

1. completes the milestone;
2. runs focused verification;
3. checkpoint-commits only owned changes;
4. updates `04-progress-tracker.md`, the approved mobile board/evidence or an approved machine-generated equivalent;
5. automatically continues to the next milestone.

The agent must not stop after a normal checkpoint and must not delegate an internal milestone to another agent.

## 8. Shared-contract freeze

Foundation-owned contracts include:

- repository/tooling conventions;
- tenant and region context;
- identity/policy interfaces;
- database adapter and migration framework;
- audit, outbox and idempotency contracts;
- shared event envelope and error contract;
- localization/country-pack registration contract;
- object/document, workflow and notification primitives;
- design-system primitives and module registration.

After foundation integration, module agents extend these contracts but do not rewrite them. A required incompatible change is recorded as a contract-change request and treated as a hard stop until reviewed.

Mobile adds no authority to bypass these contracts. Flutter consumes versioned application APIs/read models, and missing mobile behavior returns to the server/EXP/domain owner through contract review.

## 9. Open-source rule during implementation

Implementation agents may use approved permissive dependencies and public standards. They must not copy GPL/AGPL/no-license school-platform source into the proprietary core or translate it line-by-line. Research-derived behavior must come through approved internal specifications under the [clean-room policy](06-open-source-clean-room-policy.md).

Flutter/Dart packages and native plugins additionally require licence, provenance, maintenance, privacy, platform support, binary-size and replacement-plan review. Mobile release artifacts include transitive native dependencies in SBOM/provenance evidence.

## 10. Design governance during implementation

All frontend work uses the repository-local Impeccable skill and the contracts under [`docs/design/`](../design/README.md).

- `FND-01` owns `PRODUCT.md`, `DESIGN.md`, shared tokens/components, Codex/GitHub skill payloads and detector hooks.
- A module agent owns its module UI together with its database/domain/API work; design phases are not delegated to small agents.
- UI-bearing checkpoints include shape/brief, critique, audit, detector, accessibility, responsive/adaptive/RTL, hardening and polish evidence.
- `EXP-01` composes cross-module web experiences but does not move domain logic into presentation code.
- `MOB-01`, after activation, owns Flutter presentation and local client orchestration but not server domain semantics.
- `INTEG-01` or the approved mobile integrator rejects UI modules that lack the required design evidence.

## 11. Hard stops

A stream stops only when:

- its entry gate is not passed;
- branch/worktree/base/database or backend schema/environment is wrong or shared;
- the worktree contains overlapping unowned changes;
- implementation requires an unapproved shared-contract change;
- a destructive production action, app-store submission or real-data access is required without authorization;
- a security, tenant-isolation, accounting, migration, academic-history, mobile-auth or sync invariant fails and cannot be safely resolved;
- a mobile client would need direct database/private-table access or duplicated server policy;
- context/tool limits approach after a safe checkpoint;
- the entire stream completion boundary is reached.

## 12. Context-limit resume

Before stopping for context limits, the agent must:

- finish the smallest safe unit;
- run minimum focused checks;
- create a checkpoint commit;
- record branch, worktree, base, current HEAD, database/backend schema environment, completed milestone and exact next milestone;
- leave a clean worktree or list exact remaining files;
- provide the exact resume command for the same stream.

A resumed agent continues from the first incomplete milestone and does not repeat completed work.

## 13. Cleanup

Branches, worktrees, database branches, preview environments and internal mobile builds are cleaned only after reviewed integration and reachability verification. Workers never delete their own execution resources. No force deletion is allowed.
