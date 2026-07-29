# EXP-01 PWA, Offline and Low-Bandwidth Support Runbook

## Purpose

This runbook covers installation, service-worker updates, low-bandwidth operation, approved offline drafts, replay recovery, privacy-safe telemetry and performance-budget response for the administration, teacher, guardian and student web experiences.

The PWA is an application shell and recovery aid. It does not turn every workflow into an offline workflow.

## Safety boundaries

Offline durable actions are limited to:

- attendance drafts;
- form drafts;
- survey drafts;
- request drafts.

The following must remain online and must never be queued by the client:

- payments, refunds or financial posting;
- publication, approval or finalisation;
- document or report downloads;
- authentication, sign-out or privilege changes;
- restricted health, safeguarding or banking payloads;
- attachments or payloads containing secrets.

Each queued envelope is tenant- and principal-scoped, idempotent, limited to 16 KiB, retained for at most seven days and limited to 100 active records per principal. Synced or expired records have their payload removed before cleanup.

## Installation and update behaviour

The platform exposes `/manifest.webmanifest` and registers `/sw.js` only in a production build. The service worker precaches the shell, offline support page, manifest and icons only when the response is cacheable.

The cache must bypass:

- non-GET requests;
- cross-origin requests;
- `/api/`;
- `/auth/`;
- `/documents/download/`;
- `/reports/jobs/`;
- `/logout`;
- responses marked `no-store` or `private`.

An installed update is announced in the resilience panel. The application does not force-refresh while drafts may still be pending. Ask the user to sync or finish current drafts, then refresh.

## Low-bandwidth mode

Low-bandwidth mode is selected when the user chooses it or the browser reports data-saver mode. It:

- disables optional route prefetch and background polling;
- limits normal list requests to 20 rows;
- prefers textual summaries;
- suppresses elements explicitly marked `data-optional-media="true"`;
- disables smooth scrolling and optional motion.

A trusted connection is still required for final submission and sensitive reads.

## Offline queue recovery

1. Confirm the user is on the expected tenant and account. Never inspect or replay another principal's queue.
2. Record the visible pending count and any safe reason code. Do not copy draft payloads into support tickets.
3. Restore a trusted connection and use the application's retry action.
4. The replay sender must preserve the envelope idempotency key. A successful response changes the state to `synced` and removes the local payload.
5. A transient failure changes the state to `failed` with a safe reason code. It may retry up to five times.
6. A record older than seven days changes to `expired`, removes its payload and must be re-entered from the authoritative workflow.
7. After the user confirms server-side success, clear completed records.

Do not clear site data, unregister the service worker or sign the user out while pending drafts exist unless the user accepts losing those drafts.

## Common incidents

### Application opens only the offline support page

- Confirm the device has network access and DNS resolution.
- Retry `/` and verify the application server is reachable.
- Check whether the root response is marked `no-store` or `private`; such a response is intentionally not added to the shell cache.
- Verify that `offline.html` exists in the production build.

### Update remains available

- Confirm the user has no pending drafts.
- Refresh the application once.
- If the old worker remains active, close all tabs for the origin and reopen the application.
- Do not send `SKIP_WAITING` automatically while work is pending.

### Draft repeatedly fails to replay

- Capture only the action kind, attempt count, safe reason code and correlation reference.
- Confirm the server accepts the same idempotency key.
- Check tenant and principal context before retrying.
- After five failed attempts, stop automatic replay and escalate to the owning module team.

### Queue storage is corrupt

- The client raises `OFFLINE_QUEUE_STORAGE_CORRUPT` and must not guess at partial records.
- Preserve the device and browser profile until the user decides whether to abandon local drafts.
- Do not manually edit browser storage in production.

### Performance budget fails

Run:

```bash
npm run build
npm run check:experience-budget
```

Current production limits are:

- total initial platform-web JavaScript: 250,000 bytes;
- total initial platform-web CSS: 50,000 bytes;
- low-bandwidth page size: 20 records;
- first contentful paint target: 2,500 ms;
- interaction latency target: 200 ms.

Review dependency growth, eager imports, optional media and duplicate CSS before changing a budget. A budget increase requires reviewed product and performance evidence.

## Telemetry policy

Allowed telemetry event names are connectivity change, offline queue, offline replay, navigation performance, service-worker status and support-opened. Routes must be templates, such as `/teacher/classes/:class-id`, never concrete record URLs.

Allowed attributes are limited to persona, connectivity, bandwidth mode, workflow and safe reason code. Names, email addresses, phone numbers, document identifiers, student identifiers, payload contents, authentication values and unrestricted URLs are prohibited.

The local telemetry buffer holds at most 100 events and records a dropped-event count when older events are evicted.

## Verification commands

```bash
npm run format:check
npm run lint
npm run check:boundaries
npm run typecheck
npx vitest run tests/experience/pwa-resilience.test.tsx
npm run test:browser:experience
npm run test
npm run build
npm run check:experience-budget
npm run validate:artifacts
```

No production deployment, production cache purge or production database mutation is part of this runbook.
