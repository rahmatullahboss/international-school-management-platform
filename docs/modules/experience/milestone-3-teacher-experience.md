# EXP-01 Milestone 3 — Teacher Experience

## Scope

This milestone delivers the daily teacher workspace for assigned classes, attendance, gradebook work, secure communication and permitted student context. It consumes bounded, already-authorised application read models and links back to module-owned commands; it does not read private academic, SIS, communication or student-support tables.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 2 merge `422426b4ae47d698ab9364df254afef6948d25f9`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Mode: Operate; assigned-work-first, explicit sync/publication state and no inferred restricted context.

## Surface brief

- **Audience:** authenticated teachers working from desktops, tablets, school-managed devices and intermittent networks.
- **Job:** follow today’s teaching sequence, complete assigned attendance, progress gradebook tasks, communicate securely and open only permitted student context.
- **Primary action:** continue the current class or highest-risk assigned register without losing local work.
- **Constraints:** assigned-section filtering, offline-safe attendance, duplicate-safe sync guidance, publication/lock visibility, long names/translations, keyboard tables, mobile layout, RTL, restricted CARE non-disclosure and recoverable failure states.
- **Memorable moment:** class, register and grade state remain stable even when connectivity changes; the interface explains exactly what is local, synced, conflicted, published or locked.

## Contract

`TeacherDailyWorkspace` accepts capability-scoped class sessions, attendance tasks, gradebook tasks, student learning context and secure conversation summaries. Every item may declare a required capability. Filtering occurs before sorting, counting or rendering so unauthorised records do not influence visible totals or empty-state copy.

## Implementation checkpoint

- Assigned class timeline prioritising in-progress work, then scheduled, completed and cancelled sessions.
- Attendance register ledger with marked/roster counts and explicit not-started, local draft, syncing, synced, conflict and finalised states.
- Connectivity-aware attendance actions: continue locally when offline, retry local sync, reconcile conflicts and review before finalisation.
- Gradebook tasks with entry progress separated from draft, ready, published and locked states.
- Secure class/household conversation list with unread state.
- Permitted student learning context that explicitly excludes inferred health, safeguarding or counselling narratives.
- Capability-aware loading, error and non-disclosing empty states.

## Verification intent

Focused tests must prove capability filtering before schedule ordering, assigned-only class visibility, attendance progress and offline actions, gradebook publication state, secure-conversation filtering, restricted student-context masking and recoverable errors. Full format, lint, boundaries, typecheck, tests, build, browser and execution-artifact gates remain required before Milestone 3 is marked complete.
