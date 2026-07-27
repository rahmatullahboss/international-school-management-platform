#!/usr/bin/env python3
"""Validate the whole-module execution documentation contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXEC = ROOT / "docs" / "execution"

REQUIRED_FILES = [
    EXEC / "README.md",
    EXEC / "FND-01-ONE-SHOT-PROMPT.md",
    EXEC / "01-module-stream-short-commands.md",
    EXEC / "02-module-stream-full-prompts.md",
    EXEC / "03-agent-board.json",
    EXEC / "04-progress-tracker.md",
    EXEC / "05-module-ownership-and-integration-contracts.md",
    EXEC / "06-open-source-clean-room-policy.md",
    EXEC / "artifact-contract.md",
    ROOT / "scripts" / "validate_execution_artifacts.py",
]

REQUIRED_STREAMS = {
    "FND-01",
    "SIS-01",
    "FIN-01",
    "INT-01",
    "ACAD-01",
    "OPS-01",
    "CARE-01",
    "EXP-01",
    "INTEG-01",
}

FORBIDDEN_PLACEHOLDERS = re.compile(r"\b(?:TBD|FIXME|PLACEHOLDER)\b", re.IGNORECASE)


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    errors: list[str] = []

    for path in REQUIRED_FILES:
        if not path.is_file():
            fail(errors, f"missing required file: {path.relative_to(ROOT)}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    try:
        board = json.loads((EXEC / "03-agent-board.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: invalid agent board: {exc}")
        return 1

    if board.get("execution_mode") != "whole-module-agent-ownership":
        fail(errors, "execution_mode must be whole-module-agent-ownership")
    if board.get("microtask_agents_allowed") is not False:
        fail(errors, "microtask_agents_allowed must be false")
    if board.get("agent_delegation_allowed") is not False:
        fail(errors, "agent_delegation_allowed must be false")

    database = board.get("database_baseline", {})
    if database.get("provider") != "Neon Serverless PostgreSQL":
        fail(errors, "database provider must be Neon Serverless PostgreSQL")
    if database.get("worker_driver") != "@neondatabase/serverless":
        fail(errors, "worker driver must be @neondatabase/serverless")
    if database.get("hyperdrive_required") is not False:
        fail(errors, "Hyperdrive must not be required")
    if database.get("branch_per_stream") is not True:
        fail(errors, "a Neon branch is required per stream")
    if database.get("production_data_in_agent_branches") is not False:
        fail(errors, "production data must be forbidden in agent branches")

    streams = board.get("streams")
    if not isinstance(streams, list):
        fail(errors, "streams must be a list")
        streams = []

    ids = [stream.get("id") for stream in streams if isinstance(stream, dict)]
    if set(ids) != REQUIRED_STREAMS:
        fail(errors, f"stream IDs mismatch: found {sorted(str(item) for item in ids)}")
    if len(ids) != len(set(ids)):
        fail(errors, "stream IDs must be unique")

    branches = [stream.get("branch") for stream in streams]
    worktrees = [stream.get("worktree") for stream in streams if stream.get("id") != "FND-01"]
    neon_branches = [stream.get("neon_branch") for stream in streams]
    if len(branches) != len(set(branches)):
        fail(errors, "Git branches must be unique")
    if len(worktrees) != len(set(worktrees)):
        fail(errors, "non-foundation worktrees must be unique")
    if len(neon_branches) != len(set(neon_branches)):
        fail(errors, "Neon branches must be unique")

    by_id = {stream.get("id"): stream for stream in streams}
    foundation = by_id.get("FND-01", {})
    if foundation.get("wave") != 0 or foundation.get("dependencies") != []:
        fail(errors, "FND-01 must be Wave 0 with no dependencies")

    for stream in streams:
        stream_id = stream.get("id")
        for field in (
            "branch",
            "worktree",
            "neon_branch",
            "entry_gate",
            "full_prompt_section",
            "completion_gate",
        ):
            if not stream.get(field):
                fail(errors, f"{stream_id} missing {field}")
        milestones = stream.get("milestones")
        if not isinstance(milestones, list) or len(milestones) < 4:
            fail(errors, f"{stream_id} must have at least four substantial milestones")
        paths = stream.get("owned_paths")
        if not isinstance(paths, list) or not paths:
            fail(errors, f"{stream_id} must declare owned_paths")

    for stream_id in ("SIS-01", "FIN-01", "INT-01"):
        if "FND-01" not in by_id.get(stream_id, {}).get("dependencies", []):
            fail(errors, f"{stream_id} must depend on FND-01")

    if "INTEG-01:wave-1" not in by_id.get("ACAD-01", {}).get("dependencies", []):
        fail(errors, "ACAD-01 must depend on Wave 1 integration")
    if "INTEG-01:wave-1" not in by_id.get("OPS-01", {}).get("dependencies", []):
        fail(errors, "OPS-01 must depend on Wave 1 integration")
    if "INTEG-01:wave-2" not in by_id.get("EXP-01", {}).get("dependencies", []):
        fail(errors, "EXP-01 must depend on Wave 2 integration")

    short_commands = (EXEC / "01-module-stream-short-commands.md").read_text(encoding="utf-8")
    prompts = (EXEC / "02-module-stream-full-prompts.md").read_text(encoding="utf-8")
    tracker = (EXEC / "04-progress-tracker.md").read_text(encoding="utf-8")

    for stream in streams:
        stream_id = stream["id"]
        section = stream["full_prompt_section"]
        if stream_id not in short_commands:
            fail(errors, f"short-command catalog missing {stream_id}")
        if stream_id not in tracker:
            fail(errors, f"progress tracker missing {stream_id}")
        if f"## {section}" not in prompts:
            fail(errors, f"full prompts missing section: {section}")

    combined = "\n".join(
        path.read_text(encoding="utf-8")
        for path in REQUIRED_FILES
        if path.suffix in {".md", ".json"}
    )
    match = FORBIDDEN_PLACEHOLDERS.search(combined)
    if match:
        fail(errors, f"forbidden placeholder found: {match.group(0)}")

    required_phrases = [
        "Do not spawn or delegate to another agent",
        "checkpoint-commit",
        "continue automatically",
        "no unauthorized production mutation",
        "GPL/AGPL/no-license",
    ]
    for phrase in required_phrases:
        if phrase.lower() not in prompts.lower():
            fail(errors, f"full prompts missing required phrase: {phrase}")

    markdown_link = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
    for path in EXEC.glob("*.md"):
        text = path.read_text(encoding="utf-8")
        for link in markdown_link.findall(text):
            if link.startswith(("http://", "https://", "#", "mailto:")):
                continue
            target = (path.parent / link.split("#", 1)[0]).resolve()
            if not target.exists():
                fail(errors, f"broken local link in {path.relative_to(ROOT)}: {link}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("execution artifact validation: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
