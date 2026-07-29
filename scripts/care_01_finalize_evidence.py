#!/usr/bin/env python3
"""Finalize CARE-01 board and progress-tracker evidence."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOARD_PATH = ROOT / "docs" / "execution" / "03-agent-board.json"
TRACKER_PATH = ROOT / "docs" / "execution" / "04-progress-tracker.md"

VERIFIED_IMPLEMENTATION_SHA = "d257a9af11b03d573c4bb2165f934397be8e7fbe"
CI_RUN_ID = 30426849884


def update_board() -> None:
    board = json.loads(BOARD_PATH.read_text(encoding="utf-8"))
    board["updated_at"] = "2026-07-29"
    care = next(stream for stream in board["streams"] if stream["id"] == "CARE-01")
    care.update(
        {
            "status": "complete_review_ready_recovery_rehearsal_pending",
            "starting_base_sha": "8cc8ee1562ade672b14c1c44af935fe7e2307976",
            "threat_model_sha": "1ee5ef8dd5c38234cf67acfda5b73df4602f64d4",
            "verified_implementation_sha": VERIFIED_IMPLEMENTATION_SHA,
            "draft_pull_request": 19,
            "ci": {
                "run_id": CI_RUN_ID,
                "status": "success",
                "gates": [
                    "format",
                    "lint",
                    "architecture-boundaries",
                    "typecheck",
                    "unit-tests",
                    "fresh-postgresql",
                    "live-neon-driver",
                    "build",
                    "audit",
                    "licenses",
                    "provenance",
                    "chromium-browser",
                    "execution-artifacts",
                ],
            },
            "neon_branch_id": "br-raspy-smoke-ax0msb57",
            "module_migrations": [
                "202607290201_CARE-01_security_contract",
                "202607290202_CARE-01_health",
                "202607290203_CARE-01_behavior",
                "202607290204_CARE-01_wellbeing",
                "202607290205_CARE-01_safeguarding_domain",
                "202607290206_CARE-01_learning_support",
            ],
            "remaining_integration_gate": {
                "gate": "fresh-disposable-wave1-to-care-recovery-rehearsal",
                "status": "pending_external_capacity",
                "reason": (
                    "Neon project branch limit is 10/10; satisfying the gate would require "
                    "deleting or resetting another active agent branch, which CARE-01 did not do."
                ),
                "owner": "INTEG-01",
            },
        }
    )
    BOARD_PATH.write_text(
        json.dumps(board, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def care_tracker_section() -> str:
    return f"""## CARE-01 evidence

### Stream summary

Status: complete and review-ready; integration-owned fresh disposable recovery rehearsal pending
Git branch: `module/student-support`
Fixed worktree: `.worktrees/care-01-student-support`
Neon branch: `agent/care-01-student-support` (`br-raspy-smoke-ax0msb57`)
Exact starting base: `8cc8ee1562ade672b14c1c44af935fe7e2307976`
Approved threat-model evidence: `1ee5ef8dd5c38234cf67acfda5b73df4602f64d4`, read through Git history only
Verified implementation SHA: `{VERIFIED_IMPLEMENTATION_SHA}`
Draft integration PR: `#19`
CI evidence: run `{CI_RUN_ID}` SUCCESS
Production/default Neon mutation: none
ACAD-01/OPS-01 unmerged code or worktree touched: no

### Checkpoint 1 — security-contract

Checkpoint SHA: `3e82c6598e8e4aae4b93d39de5d2c7e20fda8c70`
Completed: 2026-07-29
Evidence:

- all 40 `SS-TM-001` through `SS-TM-040` invariants published and tested;
- deny-by-default need-to-know authorization, guardian release, AAL2, break-glass, immutable read evidence, exact export/connector, safe notification, offline emergency, retention and incident controls;
- security migration applied on the CARE Neon branch;
- no-context rows `0`, tenant-A isolation clean, cross-tenant write denied, access-evidence mutation denied.

### Checkpoint 2 — health

Checkpoint SHA: `88a1e3a`
Completed: 2026-07-29
Evidence:

- health profiles, conditions, allergies, medication orders, AAL2 administration, contraindication checks, immutable corrections, immunizations, care plans, clinic encounters and emergency-minimum projection;
- `202607290202_CARE-01_health` applied;
- 12/12 health tables force RLS;
- no-context `0`, tenant-B leak `0`, cross-tenant write denied and medication-administration rewrite denied;
- events/reports exclude narrative and small cohorts are suppressed.

### Checkpoint 3 — behavior

Checkpoint SHA: `cc26e80`
Completed: 2026-07-29
Evidence:

- relationship-scoped intake, idempotency, controlled transitions, append-only status history, actions, restorative plans, restricted follow-up, corrections and independently approved publication;
- `202607290203_CARE-01_behavior` applied;
- 8/8 behavior tables force RLS;
- no-context `0`, tenant-B leak `0`, cross-tenant write denied and source rewrite denied;
- teacher access does not inherit restricted follow-up.

### Checkpoint 4 — wellbeing

Checkpoint SHA: `e619555955bdcdd2e6dc63d1880018a553bca581`
Completed: 2026-07-29
Evidence:

- pastoral referrals, active legal basis, assigned-counselor cases/sessions, append-only corrections, AAL2 risk/escalation, support plans/reviews and minimized publication;
- `202607290204_CARE-01_wellbeing` applied;
- 10/10 wellbeing tables force RLS;
- no-context `0`, tenant-B leak `0`, cross-tenant write denied and counselling-session rewrite denied;
- events exclude narrative/factors/actions and small cohorts are suppressed.

### Checkpoint 5 — safeguarding-domain

Completed: 2026-07-29
Evidence:

- write-only idempotent concern intake and opaque receipt;
- narrow AAL2 case bootstrap, authoritative principal/case/purpose membership and immediate revocation;
- immutable chronology, independently reviewed assessments/safety plans, mandatory reports, exact expiring disclosures, C4 document references and independently approved closure;
- no default student/guardian safeguarding publication;
- `202607290205_CARE-01_safeguarding_domain` applied;
- 16/16 safeguarding tables force RLS;
- no-context concern rows `0`, teacher concern reads `0`, AAL2 lead tenant-A `1` with tenant-B leak `0`, unrelated principal case rows `0`, cross-tenant intake denied and chronology rewrite denied.

### Checkpoint 6 — learning-support

Completed: 2026-07-29
Evidence:

- legal-basis and relationship-scoped referrals, restricted assessments, independently approved accommodations/plans, goals/reviews, classroom-safe academic projection and versioned portal publication;
- no ACAD-01 unmerged code or table dependency;
- `202607290206_CARE-01_learning_support` applied;
- 11/11 learning-support tables force RLS;
- no-context `0`, tenant-B leak `0`, cross-tenant insert denied and plan-review rewrite denied.

### Checkpoint 7 — restricted-interface-verification

Verified implementation SHA: `{VERIFIED_IMPLEMENTATION_SHA}`
Completed: 2026-07-29
Evidence:

- versioned bounded `/v1/care` API registry with exact permission/purpose/AAL and masked errors;
- accessible responsive RTL-aware admin surfaces for clinic, behavior, wellbeing, safeguarding, learning support, break-glass review and exact disclosure approval;
- permission/role matrix, API, events/notifications, retention/export/disclosure, incident-response, interface and recovery documentation;
- draft PR `#19` targets `integration/international-school-platform-v1` and remains draft;
- CI run `{CI_RUN_ID}` passed format, lint, architecture boundaries, typecheck, full tests, fresh PostgreSQL migration validation, live Neon driver, build, audit, license, provenance, Chromium browser suite and execution-artifact validator.

### Migration and recovery status

CARE ledger contains migrations `201` through `206`. The reviewed integration Neon branch
`br-shiny-silence-axznuy37` was compared and contains the authoritative FND 5, SIS 6, FIN 4 and INT 7
ledger. CARE does not mutate FIN/INT schemas and consumes their reviewed public contracts.

A new disposable branch could not be created because the Neon project is at its 10/10 branch limit.
Creating capacity would require deleting or resetting another active agent branch, which is destructive
and prohibited for this stream. Therefore CARE-01 does not claim a fresh FND→SIS→FIN→INT→CARE replay.
The exact integration-owned recovery procedure is documented in
`docs/modules/student-support/recovery.md`. This pending integration gate does not weaken CARE RLS,
authorization, audit or negative-test evidence and does not mark any program/pilot gate passed.

Exact next action: INTEG-01 reviews PR `#19`, provisions a disposable branch slot without destroying
active work, executes the documented Wave 1→CARE replay, and records the integration gate result.
Dirty/uncommitted state: no module source changes after verified implementation SHA; tracker/board evidence only

"""


def update_tracker() -> None:
    tracker = TRACKER_PATH.read_text(encoding="utf-8")
    start_marker = "## CARE-01 evidence\n"
    end_marker = "## EXP-01 evidence\n"
    start = tracker.index(start_marker)
    end = tracker.index(end_marker, start)
    TRACKER_PATH.write_text(
        tracker[:start] + care_tracker_section() + tracker[end:], encoding="utf-8"
    )


def main() -> None:
    update_board()
    update_tracker()


if __name__ == "__main__":
    main()
