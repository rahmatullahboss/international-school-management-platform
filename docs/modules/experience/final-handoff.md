# EXP-01 Final Handoff — Portals, Communications and Reporting Experience

## Candidate

- Module: `EXP-01`
- Branch: `module/experience-portals-reporting`
- Fixed worktree: `.worktrees/exp-01-experience`
- Neon branch: `agent/exp-01-experience` (`br-billowing-bar-axe2et95`)
- Reviewed base: `60836a8fe92f64ba581c4bde65005729d1fe14b2`
- Candidate implementation SHA: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`
- Pull request: `#27` — `EXP-01: portals, communications and reporting experience`
- Completion gate: `GATE-EXP-COMPLETE`
- Gate CI: `30464998020` — success

The pull request remains draft for reviewed Wave 3 serial integration. No deployment or merge is authorized by this handoff.

## Delivered milestones

1. Shared persona shell, capability-shaped navigation, session/device context, responsive/RTL/accessibility and resilient states.
2. Administration operational ledger and authorised record workspace.
3. Teacher daily classes, attendance, gradebook, communication and permitted student context.
4. Guardian multi-child household experience for applications, attendance, grades, fees, consent, documents and communication.
5. Age-appropriate student timetable, attendance, results, resources, requests, documents and secure messaging.
6. Tenant/principal/capability-scoped announcements, secure messaging, multilingual templates, adapters, preferences, forms, surveys, consent, acknowledgements and delivery evidence.
7. Governed dashboard provenance, versioned report catalog, idempotent asynchronous jobs, permission-aware exports and short-lived document grants.
8. Installable PWA shell, low-bandwidth mode, approved offline drafts, privacy-safe telemetry, performance budgets, browser evidence and support runbook.

## Integration contracts

### Authorization and isolation

- Tenant, principal visibility and capability filtering occurs before sorting, totals or rendering.
- Restricted care/support information does not inherit broad administration or report access.
- Document grants require tenant, principal, capability, publication, clean scan, expiry and TTL checks.
- Report output formats may require capabilities independent of report-read permission.
- Offline records are tenant/principal scoped and reject restricted classifications.

### Communications

- `CommunicationsWorkspace` consumes authorised read models only.
- `NotificationDispatcher` plans in-app/email/SMS/push outcomes through explicit adapters.
- Editable opt-outs are honoured; locked mandatory channels remain attempted and failures remain traceable.
- Localized copy resolves exact locale, language fallback and default locale.

### Reporting and documents

- Dashboard metrics name definition, source, as-of time and governed drill-down.
- Report jobs are idempotent and enforce tenant scope, lifecycle and definition row limits.
- Document download grants are opaque and short-lived; source URLs or object keys are not returned.

### PWA and offline

- Offline durable actions are limited to attendance, form, survey and request drafts.
- Payments, publication, approval, finalisation, authentication changes, restricted records and downloads remain online-only.
- The service worker bypasses APIs, authentication, downloads, report artifacts, logout, non-GET, cross-origin, `private` and `no-store` responses.
- Updates are announced and are not forced while drafts may remain pending.

## Verification evidence

Implementation candidate `5c952703c24ee9927fcf2cd480d3ce8d0d139847` passed locally:

- full `npm run verify`;
- `504/504` repository tests with one credential-gated local Neon test skipped;
- all browser suites: `15/15` total, including EXP `6/6`;
- Worker and web production builds;
- platform-web bundle budget: JavaScript `201,022` bytes, CSS `4,054` bytes;
- required PWA artifacts in build output;
- execution-artifact validation;
- clean provenance generation.

GitHub CI run `30464998020` passed all 21 steps, including fresh 40-migration PostgreSQL replay and live Neon verification.

Earlier accepted evidence:

- Milestone 6 implementation `4b9629fee735c7f6dbcd9561ed14a4207e8ba3ff`, CI `30460170124`.
- Milestone 7 implementation `7a7aa79b278fc25b4cfa9bd93efce80f0d914966`, CI `30461899197`.

## Integration procedure

1. Review PR `#27` and this handoff against `PRODUCT.md`, `DESIGN.md` and the EXP-01 execution prompt.
2. Verify the candidate SHA remains `5c952703c24ee9927fcf2cd480d3ce8d0d139847`; do not integrate a moving branch implicitly.
3. Preserve the fixed worktree and Neon branch until the reviewed candidate is accepted.
4. Integrate serially through INTEG-01 using coordinator-owned shared-file conflict resolution.
5. Re-run the canonical migration replay, live Neon check, full tests, all browser suites, bundle budget and recovery verification on the integration branch.
6. Mark the module `complete_and_integrated` only after the Wave 3 integration gate passes.

## Known non-blocking observations

- The platform foundation screen displays a zero pending count until authenticated persona routing supplies a real tenant/principal queue context; it does not fabricate or aggregate another account's local drafts.
- Service-worker cache versioning is explicit and should be bumped when shell cache semantics change.
- The PWA icon source is SVG. Store-specific PNG assets can be generated during deployment packaging if a target store or install surface requires them.

## Operational references

- `docs/modules/experience/milestone-1-persona-foundation.md`
- `docs/modules/experience/milestone-2-admin-experience.md`
- `docs/modules/experience/milestone-3-teacher-experience.md`
- `docs/modules/experience/milestone-4-guardian-experience.md`
- `docs/modules/experience/milestone-5-student-experience.md`
- `docs/modules/experience/milestone-6-communications-experience.md`
- `docs/modules/experience/milestone-7-documents-reporting-experience.md`
- `docs/modules/experience/milestone-8-pwa-resilience-experience.md`
- `docs/operations/experience-pwa-offline-runbook.md`

## Production mutation

None. No production deployment, production database mutation, production cache purge, branch deletion, worktree deletion or Neon branch deletion was performed.
