# UX-01 Smooth Operational Experience Release Evidence

## Candidate

- Base main merge: `4c0564642081bad534d73d96fd7d80c0052dca16`
- Verified UX candidate: `e74a30143eb7882e81ebd7d5b5c373d3132b309e`
- Branch: `ux/smooth-operational-experience-v1`
- Pull request: #43
- Gate: `GATE-UX-CONTINUITY-V1`

## Research and architecture

The implementation follows the project-specific research in `docs/design/04-operational-ux-continuity-research.md` and ADR-008. React 19 and Vite remain in place because the observed loading defect was caused by document navigation and a top-level fallback, not by the frontend framework.

## Interaction outcome

- Eligible internal links use conservative History API navigation.
- Role bundles preload on pointer intent, keyboard focus and suitable idle time.
- Current authorised content remains visible until the destination is ready.
- Same-role navigation never displays the boot skeleton.
- Initial direct deep links use a skeleton in the final shell layout.
- A thin progress line and polite status message announce route preparation.
- Browser back, forward, deep links, external links, modifier clicks, downloads, hashes and the offline page retain expected behaviour.
- Supported browsers receive a short View Transition and reduced-motion users receive no transition animation.
- Long role menus are grouped by school task and searchable by familiar terms.
- Active location, identity, connectivity and capability filtering remain explicit.

## Root verification

Root CI run `30490122291` passed all 21 gates on `e74a30143eb7882e81ebd7d5b5c373d3132b309e`:

- format, lint, architecture boundaries and TypeScript references;
- 504 repository tests;
- fresh canonical 40-migration replay;
- live Neon driver verification;
- Worker and Vite production builds;
- initial and total route asset budgets;
- dependency audit, licence policy and provenance drift;
- 20 Chromium browser journeys;
- execution-artifact validation.

## Performance evidence

- Initial JavaScript: 207,287 / 250,000 bytes.
- Initial CSS: 13,514 / 50,000 bytes.
- Total route JavaScript: 292,668 / 350,000 bytes.
- Total route CSS: 71,650 / 85,000 bytes.
- Budget violations: none.

## Cloudflare staging evidence

Run `30490122337` passed repository verification, API Worker deployment, web Worker deployment and live smoke tests for the role chooser, admin, teacher, guardian, student, manifest, offline page and API health endpoint. Deployment concurrency is keyed by branch so unrelated pull requests cannot cancel the UX verification run.

## Documentation reconciliation

`DESIGN.md`, the design research index, execution index, progress tracker, UX workstream, checkpoint, this release evidence and the machine-readable agent board are synchronized. Final exact-head CI/deployment and expected-head merge evidence are recorded on pull request #43.

## Gate outcome

`GATE-UX-CONTINUITY-V1` passes for the verified candidate. The staged application now behaves as one continuous workspace and exposes clearer task-led navigation without weakening role scoping or enabling production mutations.

## Production boundary

The environment still uses simulated role sessions and synthetic read models. Production promotion remains blocked until reviewed OAuth/OIDC and tenant/campus context, permission-aware Worker APIs, tenant-safe cache isolation, approved staging seed/reset tooling, safe mutation acceptance, live permission-negative tests, monitoring, backup and rollback rehearsal, owner-led UAT and explicit production authorization are complete.
