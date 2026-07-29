# EXP-01 Milestone 2 — Administration Experience

## Scope

This milestone turns the administration persona shell into a governed cross-module command centre. It presents only authorised read-model data and links back to module-owned records; it does not query private domain tables, post domain changes directly or redefine domain permissions.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 1 `7742a993a4959ae75c900ae1ce4b77041d991f92`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Mode: Operate; exception-first, source-defined and flat-by-default.

## Surface brief

- **Audience:** school leaders, registrars, finance administrators, academic coordinators and operations administrators.
- **Job:** understand school readiness, investigate highest-risk exceptions, find authorised records, review approvals and prepare safe bulk work.
- **Primary action:** open the highest-priority authorised record with its source and operational context intact.
- **Constraints:** capability filtering, masked restricted data, AAL2 visibility before approval, exact metric definitions, long records, keyboard tables, mobile overflow containment, RTL and recoverable loading/error states.
- **Memorable moment:** the command centre says why a number or queue item exists, where it came from and what the administrator can safely do next.

## Contract

`AdminCommandCentre` accepts bounded, already-authorised metric, exception, approval, search-result and bulk-operation read models. Optional `requiredCapability` fields are enforced again at composition time as defence in depth. Restricted search matches are indistinguishable from absent records when the capability is not present.

## Implementation checkpoint

- Source-defined metric ledger with definition, source, timestamp and drill-down.
- Severity-ordered cross-module exception queue with owner and deadline context.
- Governed search form and masked empty-result state.
- Approval queue that exposes assurance requirements before navigation.
- Bulk-operation readiness that preserves blockers and never silently skips invalid rows.
- Responsive, RTL-safe, keyboard-focusable tables and forms using the root semantic palette.

## Verification

Checkpoint commit `85b5c81d9bb76ae0e811f2db9ebdfaa901843781` passed focused ESLint, architecture boundaries, repository typecheck, the dedicated admin-command-centre Vitest suite and execution-artifact validation. The formatter also removed a decorative gradient and preserved a flat semantic blocked state. Full repository CI, build and browser suites remain required before Milestone 2 is marked complete.
