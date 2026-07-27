# ADR-005 — Whole-Module Agent Ownership

- **Status:** Accepted for execution planning
- **Date:** 2026-07-28

## Context

The product contains large but related domains. Assigning a different agent to every table, endpoint, screen or test would fragment understanding, create conflicting implementations and require excessive integration work. The desired operating model is parallel development by large business module, after shared foundations are stable.

## Decision

One agent owns one complete execution stream for one large module.

A module agent owns its module’s:

- domain model and invariants;
- PostgreSQL schema, migrations and RLS policies;
- application commands, queries and events;
- APIs and integration contracts;
- administrative and persona-facing UI;
- authorization, audit and privacy behavior;
- imports, exports and reports;
- automated tests, performance checks and operational documentation.

Internal milestones are checkpoint boundaries, not separate agent assignments. The same stream continues automatically after each successful milestone.

## Branch and environment model

- One stream uses one exact Git branch.
- One stream uses one fixed worktree.
- One stream uses one matching Neon database branch.
- A stream cannot edit another stream’s owned paths.
- Shared contracts are frozen after the foundation gate; changes require a versioned contract-change request.
- Agents cannot spawn or delegate to other agents.
- A serial integration stream reviews and combines module branches.

## Dependency waves

1. Foundation executes alone.
2. Core SIS, Finance and International/Integration modules may run in parallel after foundation approval.
3. Academics, Operations and Student Support may run in parallel after Wave 1 contracts are integrated.
4. Experience/Portals runs after the domain APIs and read models it consumes are stable.
5. The integration stream performs serial merge, migration-order, boundary, regression and release verification.

## Checkpoint and continuation rule

After every meaningful milestone, the agent runs focused checks, commits only stream-owned changes, updates the tracker and continues automatically. It stops only at module completion, a documented safety/authorization gate, an ownership conflict, an unresolved correctness failure or a context limit after a safe checkpoint.

## Consequences

### Positive

- One agent retains complete module context.
- Fewer handoffs and less duplicated reasoning.
- Each branch can produce a coherent end-to-end module.
- Parallel work is limited to genuinely independent ownership boundaries.

### Negative

- A module stream can span multiple sessions and requires exact resume records.
- Large modules demand strong checkpoint discipline.
- Shared contract mistakes can block several streams.
- Final integration remains a substantial serial engineering task.

## Guardrails

- Do not create one agent per internal milestone.
- Do not share a writable worktree or Neon branch between agents.
- Do not let module agents modify foundation-owned files without an approved contract change.
- Do not mark a module complete when only backend, UI or schema is complete.
- Do not merge parallel streams directly into each other.
- Do not delete branches/worktrees until reviewed commits are reachable from the integration branch.
