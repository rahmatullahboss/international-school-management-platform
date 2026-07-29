# EXP-01 Milestone 8 — PWA, Offline Resilience and Final Verification

## Scope

This milestone completes the installable web application shell, explicit low-bandwidth operation, approved offline-draft handling, privacy-safe telemetry, performance budgets, mobile/RTL/accessibility/browser evidence and operational recovery guidance for the administration, teacher, guardian and student experiences.

The PWA is a recovery and continuity layer. It does not authorize sensitive or final workflows to run offline.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 7 evidence commit `aae4e47ad431222fe1ee0582bb71c68f6e6fa8f5`.
- Reviewed Wave 2 base: `60836a8fe92f64ba581c4bde65005729d1fe14b2`.
- Implementation checkpoint: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Impeccable version: `4.0.2`.
- Mode: Operate; explicit, bounded, privacy-preserving, recoverable and measurable.

## Surface brief

- **Audience:** school operators, teachers, guardians and students using shared or personal desktops, tablets and phones across intermittent or expensive networks.
- **Job:** understand connectivity, choose low-bandwidth mode, continue only approved drafts, see pending-device state, recover safely and install/update the application without losing work.
- **Primary action:** sync or finish pending approved drafts before refresh, sign-out or update activation.
- **Constraints:** tenant/principal scope, idempotency, bounded local payloads, seven-day expiry, no restricted or financial content, no sensitive-route caching, RTL, keyboard use, reduced motion, narrow screens and measurable bundle limits.
- **Memorable moment:** a user can lose connectivity, retain an explicitly approved draft, see exactly what remains on the device and replay it once without exposing secrets or duplicating the server action.

## Offline contract

`OfflineActionQueue` permits only attendance, form, survey and request drafts. Each envelope is tenant- and principal-scoped, idempotent, limited to 16 KiB, retained for at most seven days and limited to 100 active actions per principal. Restricted classifications and payload keys associated with credentials, banking, medical or safeguarding content are rejected. Replay is capped at five attempts; synced and expired records have their payload removed.

Payments, refunds, publication, approval, finalisation, authentication changes, restricted records, report/document downloads and attachments remain online-only.

## PWA and cache contract

The production application exposes an installable manifest, maskable icon, offline support page and update-aware service-worker registration. The service worker caches only cacheable same-origin GET shell assets and bypasses:

- non-GET and cross-origin requests;
- `/api/` and `/auth/`;
- `/documents/download/` and `/reports/jobs/`;
- `/logout`;
- responses marked `no-store` or `private`.

An installed update is announced but never forced while drafts may remain pending.

## Low-bandwidth and telemetry contract

Low-bandwidth mode disables optional media, route prefetch and background polling, prefers text summaries and limits normal list pages to 20 records. Privacy-safe telemetry accepts only named operational events, route templates and allowlisted attributes; concrete record URLs, names, email addresses, phone-like values, identifiers, payloads and secrets are rejected. The local buffer is bounded and records dropped-event evidence.

## Performance budget

The production build gate enforces:

- initial platform-web JavaScript: at most 250,000 bytes;
- initial platform-web CSS: at most 50,000 bytes;
- required manifest, offline page, service worker and icons in build output;
- first contentful paint target: 2,500 ms;
- interaction latency target: 200 ms;
- low-bandwidth list size: 20 records.

Implementation checkpoint output was 201,022 bytes of JavaScript and 4,054 bytes of CSS with no violations.

## Implementation checkpoint

- Installable manifest, application metadata, maskable icons and offline fallback.
- Production-only update-aware service-worker registration.
- Sensitive-route and cache-control exclusions.
- Explicit connectivity and low-bandwidth resilience panel.
- Tenant/principal-scoped offline draft storage and idempotent replay.
- Expiry, attempt, count, classification, payload-size and forbidden-field controls.
- Privacy-safe bounded telemetry.
- CI-enforced production bundle and PWA-asset budget.
- Mobile RTL, keyboard, reduced-motion and overflow browser evidence.
- PWA/offline/low-bandwidth operational support runbook.

## Verification

Local verification on implementation checkpoint `5c952703c24ee9927fcf2cd480d3ce8d0d139847` passed:

- `npm run verify`;
- format, lint, architecture boundaries and typecheck;
- `504/504` repository tests, with one credential-gated local Neon test skipped;
- PWA/resilience focused tests `10/10`;
- all browser suites: platform `1/1`, SIS `2/2`, finance `2/2`, integrations `1/1`, student-support `3/3`, EXP `6/6`;
- production Worker and Vite builds;
- JavaScript/CSS/PWA build-budget gate;
- execution-artifact validation;
- provenance generation with no tracked drift.

GitHub CI run `30464998020` passed all 21 verification steps, including clean install, format, lint, boundaries, typecheck, all tests, fresh 40-migration PostgreSQL replay, live Neon serverless driver, build, PWA budget, dependency audit, licences, provenance drift check, every Chromium suite and execution-artifact validation.

## Operational evidence

Support and recovery procedures are recorded in `docs/operations/experience-pwa-offline-runbook.md`. No production deployment, production cache purge or production database mutation was performed.

## Gate outcome

`GATE-EXP-COMPLETE` is satisfied for the module candidate at `5c952703c24ee9927fcf2cd480d3ce8d0d139847`. EXP-01 is ready for reviewed Wave 3 serial integration by INTEG-01; the module branch and Neon branch must remain available until that review completes.
