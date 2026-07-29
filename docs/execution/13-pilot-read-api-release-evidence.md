# PILOT-02 Scoped Staging Read API Release Evidence

## Candidate

- Base main merge: `0e054947b41ce7d8a4967dc94aa0b80672b99f58`
- Implementation proof candidate: `73be1c1eb0418c8c2f744729354bd9f1a63467b0`
- Branch: `pilot/permission-aware-read-api-v1`
- Pull request: #44
- Gate: `GATE-PILOT-READ-API-V1`

## API scope outcome

The staging Worker exposes `GET /pilot/v1/snapshots/:role` only outside production. Every allowed request requires the exact synthetic tenant, campus, role and subject scope. The response includes the server-resolved capability set and only the corresponding role snapshot.

Verified negative boundaries:

- incomplete scope returns `400`;
- cross-role and cross-subject requests return `403`;
- unrelated browser origins return `403`;
- unknown roles return `404`;
- all pilot endpoints return a generic `404` in a production runtime.

## Cache and continuity outcome

- API responses use `Cache-Control: private, max-age=0, must-revalidate`.
- Scope-specific ETags support `If-None-Match` and `304` responses.
- Browser cache identity includes API origin, tenant, campus, role and subject.
- Returned scope is validated before a snapshot is accepted.
- The current authorised screen stays rendered during refresh.
- The last safe in-memory/local snapshot remains visible after network failure.
- Refresh status is local and accessible; no detached full-screen loading page is introduced.
- The staging web bundle is built with the URL of the API Worker deployed in the same workflow.

## Root verification

Root CI `30495509757` passed all 21 gates on implementation proof candidate `73be1c1eb0418c8c2f744729354bd9f1a63467b0`:

- format, lint, architecture boundaries and TypeScript references;
- 509 repository tests;
- fresh canonical 40-migration replay;
- live Neon driver verification;
- Worker and Vite production builds;
- initial and total asset budgets;
- dependency audit, licence policy and provenance drift;
- 22 Chromium browser journeys;
- execution-artifact validation.

## Performance evidence

- Initial JavaScript: 208,406 / 250,000 bytes.
- Initial CSS: 15,022 / 50,000 bytes.
- Total route JavaScript: 297,916 / 350,000 bytes.
- Total route CSS: 73,158 / 85,000 bytes.
- Budget violations: none.

## Cloudflare staging evidence

Run `30495509773` passed repository verification, API Worker deployment, API-aware web build and deployment, and live smoke tests for:

- API health;
- scope-checked admin snapshot;
- role chooser;
- admin, teacher, guardian and student routes;
- PWA manifest;
- offline page.

## Live staging boundary

- Web: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`
- Scoped snapshot pattern: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/pilot/v1/snapshots/:role`

The snapshot endpoint intentionally requires scope headers and is not a public browser page.

## Gate outcome

`GATE-PILOT-READ-API-V1` passes for the implementation proof candidate. Final documentation and machine-board synchronization, exact-head verification and expected-head merge remain required before the branch becomes canonical.

## Production boundary

The Worker snapshots and identities remain synthetic. This release does not provide production authentication, database-backed authorization, real tenant data, shared server cache, live payments, publication, approvals or restricted-data mutations. Production promotion remains blocked until reviewed OAuth/OIDC, tenant/campus context, database-backed policy evaluation, server-side cache isolation tests, approved staging seed/reset tooling, safe mutation acceptance, monitoring, backup, rollback rehearsal and owner-led UAT are complete.
