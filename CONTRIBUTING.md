# Contributing

## Required workflow

1. Work only in the branch/worktree assigned by `docs/execution/03-agent-board.json`.
2. Preserve module ownership and request shared-contract changes through the documented process.
3. Add a failing characterization or behavior test before implementation code.
4. Run `npm run verify` before requesting review.
5. Never commit secrets, real student data, production exports, or restricted third-party source.

## Commit policy

Use focused commits with an imperative Conventional Commit-style subject. Checkpoint commits must include only the current stream's owned paths and tracker evidence.
