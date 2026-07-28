# Whole-Module Program Progress Tracker

**Program:** `international-school-platform-v1`
**Updated:** 2026-07-28
**Current repository state:** `FND-01` is active on `program/foundation-neon-platform`; repository bootstrap is checkpointed and Neon branch `agent/fnd-01-foundation` is ready.

## Gate status

| Gate | Status | Evidence / required condition |
|---|---|---|
| `GATE-DOCUMENTS-APPROVED` | passed | Owner authorized FND-01 execution; `python3 scripts/validate_execution_artifacts.py` passed on 2026-07-28 |
| `GATE-FOUNDATION-READY` | blocked | `FND-01` complete, reviewed HEAD recorded, foundation tests and Neon proof pass |
| `GATE-WAVE-1-INTEGRATED` | blocked | `SIS-01`, `FIN-01`, `INT-01` reviewed and serially integrated |
| `GATE-STUDENT-SUPPORT-THREAT-MODEL` | blocked | Wave 1 integrated plus approved student-support threat model |
| `GATE-WAVE-2-INTEGRATED` | blocked | `ACAD-01`, `OPS-01`, `CARE-01` reviewed and integrated |
| `GATE-PILOT-READY` | blocked | `EXP-01` integrated and final system/recovery verification passed |

## Stream tracker

| Stream | Wave | Status | Base | Current/next milestone | Final/last checkpoint | Blocking condition |
|---|---:|---|---|---|---|---|
| `FND-01` | 0 | in progress | `4038081bc122c41d4a312bd75d01c784e3f4eee1` | direct Neon data platform | `8d328d1cf04e8076bcf705a5198dc4eb8b449ada` | none |
| `SIS-01` | 1 | blocked | reviewed foundation SHA | module contract | none | `GATE-FOUNDATION-READY` |
| `FIN-01` | 1 | blocked | reviewed foundation SHA | finance contract | none | `GATE-FOUNDATION-READY` |
| `INT-01` | 1 | blocked | reviewed foundation SHA | country-pack engine | none | `GATE-FOUNDATION-READY` |
| `ACAD-01` | 2 | blocked | reviewed Wave 1 integration SHA | academic structure | none | `GATE-WAVE-1-INTEGRATED` |
| `OPS-01` | 2 | blocked | reviewed Wave 1 integration SHA | HR/staff | none | `GATE-WAVE-1-INTEGRATED` |
| `CARE-01` | 2 | blocked | reviewed Wave 1 integration SHA | security contract | none | threat-model and Wave 1 gates |
| `EXP-01` | 3 | blocked | reviewed Wave 2 integration SHA | persona shells | none | `GATE-WAVE-2-INTEGRATED` |
| `INTEG-01` | gated serial | blocked | reviewed stream SHAs | foundation integration | none | reviewed SHA set unavailable |

## Required checkpoint evidence format

For each checkpoint append one record under the stream heading:

```text
Date/time:
Stream:
Milestone completed:
Git branch:
Worktree:
Neon branch:
Starting base:
Checkpoint SHA:
Changed owned paths:
Focused checks and results:
Gate outcome:
Exact next milestone:
Dirty/uncommitted state:
Production mutation performed: no
```

## FND-01 evidence

Date/time: 2026-07-28T06:06:00+06:00
Stream: FND-01
Milestone completed: 1 — repository and engineering bootstrap
Git branch: `program/foundation-neon-platform`
Worktree: `.worktrees/fnd-01-foundation`
Neon branch: `agent/fnd-01-foundation` (`br-misty-frost-ax8ij4vw`), parent `main` (`br-cool-wildflower-axsot8l1`)
Starting base: `4038081bc122c41d4a312bd75d01c784e3f4eee1`
Checkpoint SHA: `8d328d1cf04e8076bcf705a5198dc4eb8b449ada`
Changed owned paths: root npm/TypeScript/lint/format/test configuration; `.github/workflows/ci.yml`; `apps/platform-api`; `apps/platform-web`; `packages/platform`; `tests/browser`; contribution/security/environment conventions
Focused checks and results: execution artifact validator PASS; focused Vitest 3/3 PASS; TypeScript project build PASS; ESLint PASS; Prettier check PASS; Wrangler dry-run build PASS; Vite production build PASS
Gate outcome: milestone 1 passed; `GATE-DOCUMENTS-APPROVED` passed; foundation gate remains blocked pending milestones 2–8
Exact next milestone: 2 — direct Neon data platform
Dirty/uncommitted state: tracker evidence update only
Production mutation performed: no

## SIS-01 evidence

No execution evidence recorded.

## FIN-01 evidence

No execution evidence recorded.

## INT-01 evidence

No execution evidence recorded.

## ACAD-01 evidence

No execution evidence recorded.

## OPS-01 evidence

No execution evidence recorded.

## CARE-01 evidence

No execution evidence recorded.

## EXP-01 evidence

No execution evidence recorded.

## INTEG-01 evidence

No execution evidence recorded.

## Resume rule

A resumed stream must verify this tracker against Git history, the exact worktree and Neon branch. Git history is authoritative when a stale tracker conflicts with committed evidence; the agent must correct the tracker before continuing. It must resume from the first incomplete milestone, not replay completed milestones.

## Program completion rule

Only `INTEG-01` may mark `GATE-PILOT-READY` passed, and only after all required streams are integrated, migrations/recovery are rehearsed, critical tests pass and a pilot-ready report is committed. Module completion never equals program completion.
