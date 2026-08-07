# MOB-01 Restricted-Data Threat Model

## Status and authority

This document records the client/native threat model for the School Family and School Staff applications. It does not authorize production activation, server endpoint implementation, database mutation, notification-provider credentials, native restricted-document presentation, or use of real student data.

The mobile stream owns client behavior under `mobile/**`. Identity policy, endpoint authorization, audit issuance, authoritative academic and financial state, notification issuance, secure-document exchange responses, and platform-specific document viewers remain server/platform-owner responsibilities.

## Protected assets

- OIDC access, refresh, ID, end-session, and transient step-up proofs.
- Tenant, campus, account, persona, capability, student, class, roster, conversation, and operation scope.
- Published academic information, attendance, results, timetable, forms, consents, messages, receipts, and exact financial values.
- Teacher attendance and grade-draft operations before server acceptance.
- Push provider tokens and privacy-minimised notification envelopes.
- Restricted-document grants, streamed document bytes, digest metadata, temporary leases, and presentation lifecycle.
- Local encryption keys, encrypted sync payloads, cursors, operation journals, and quarantine metadata.

## Security objectives

1. A client must never gain authority by changing local state, locale, route, notification data, cache contents, or offline operations.
2. Tenant, campus, account, persona, capability, and subject scope must remain exact across authentication, API transport, notification routing, sync, storage, and presentation.
3. Restricted bytes and credentials must not persist beyond their approved lifecycle or appear in diagnostics, filenames, analytics, notifications, screenshots, backups, or unrestricted caches.
4. Replay, stale response, duplicate command, and cross-scope substitution must fail closed.
5. Accessibility and localization changes must not hide written security status, change authority, switch scope, or expose sensitive values to assistive technology beyond what is visibly authorized.

## Trust boundaries

| Boundary | Trusted side | Untrusted or separately owned side | Required control |
| --- | --- | --- | --- |
| Native app ↔ OIDC provider | AppAuth/OIDC contract | Browser, network, provider policy | PKCE, exact redirect scheme, nonce, fresh step-up prompt, bounded transient proof |
| Mobile app ↔ platform API | Scoped API client | Network and server implementation | HTTPS, bearer auth, exact scope headers, stable errors, server authorization |
| Mobile process ↔ device storage | Scoped encryption/storage runtime | Filesystem, backups, other apps, diagnostic tooling | AES-GCM, secure key vault, opaque paths, disabled Android backup, purge and quarantine |
| Notification provider ↔ app | Privacy-minimised envelope parser | FCM/APNs payload and operating-system launch data | Allow-list fields, exact app/scope/capability routing, no display text or credentials |
| Secure exchange ↔ native presenter | Verified stream and temporary lease | Network response, filesystem, viewer integration | No redirects, size and digest verification, no-store, single use, finally cleanup |
| UI ↔ assistive technology | Authorized visible state | Screen reader, switch control, accessibility services | Written status, no hidden secrets, deterministic labels, no authority changes |
| Locale/directionality ↔ application state | Local shell-copy catalog | Device locale and translated presentation | Safe fallback, explicit RTL policy, no tenant/persona/authorization inference |

## Threat analysis and mitigations

### Spoofing and account confusion

**Threats**

- Malicious application claims the redirect URI.
- A restored token is used under a different account, tenant, campus, or persona.
- A notification deep link silently changes active school or role.
- A localized label makes one persona or action appear to be another.

**Implemented client controls**

- Separate lowercase redirect schemes and application identifiers for Family and Staff.
- Account-scoped bootstrap and secure token storage.
- Exact tenant, campus, persona, application, capability, and validity checks before notification routing.
- Locale policy changes presentation only; unsupported locales fall back to English and cannot select school, account, student, or role.

**Owner activation gate**

- OIDC provider registration and redirect ownership must be approved independently.
- Server sessions and notification issuance must enforce the same exact scope.

### Tampering and integrity loss

**Threats**

- Local encrypted sync records, cursors, grants, or temporary files are modified.
- Restricted document bytes differ from the declared digest or length.
- A stale Family child response or Teacher roster response replaces the current scope.
- Accessibility or localization work accidentally truncates written status or hides a security warning.

**Implemented client controls**

- Authenticated AES-GCM storage, scope-bound associated data, atomic replacement, key rotation, and tamper quarantine.
- SHA-256, declared length, maximum size, media type, document identity, and no-store response enforcement.
- Stale-response rejection and exact profile, meeting, roster, and section identity checks.
- Source tests exercise 200% text scaling, explicit RTL direction, written status semantics, and 48 logical-pixel controls.

**Owner activation gate**

- The exchange service must issue matching response identity, digest, media type, content length, and cache policy.
- Platform presenters must not copy restricted content into unrestricted recent-files, downloads, backups, or share sheets.

### Repudiation and ambiguous outcomes

**Threats**

- Attendance, grade, form, consent, message, or secure-document operations are repeated without a stable identity.
- A user cannot tell whether data is pending, accepted, rejected, conflicted, duplicated, or unavailable.

**Implemented client controls**

- Operation IDs, idempotency keys, base versions, explicit receipt states, scoped journals, and deterministic replay handling.
- Written status banners expose pending, warning, error, and success state without relying only on color or iconography.
- Restricted-document grants are blocked during concurrent use and after completion.

**Owner activation gate**

- Server audit and idempotency retention must be defined and reviewed for each proposed endpoint.

### Information disclosure

**Threats**

- Tokens, digests, paths, ciphertext, provider credentials, names, amounts, filenames, or document URLs enter logs or notifications.
- Restricted files remain after success or failure.
- Assistive technology announces hidden or stale sensitive content.
- Device backup or external storage captures protected state.

**Implemented client controls**

- Redacted diagnostic values for tokens, digests, ciphertext, and temporary paths.
- Notification allow-list excludes names, amounts, filenames, display text, message bodies, raw URLs, bearer tokens, and storage credentials.
- Restricted bytes use random opaque temporary leases and are deleted in `finally` after presentation or failure.
- Android backup is disabled; durable sync data is encrypted in application-support storage.
- Production UI hides unverifiable academic and financial values instead of substituting fixtures.

**Owner activation gate**

- Native presenters require platform privacy review, screenshot/recent-task policy, backup policy, and secure deletion evidence.
- Analytics and crash-reporting integrations must prove sensitive-value redaction before activation.

### Denial of service and resource exhaustion

**Threats**

- Oversized or endless document streams exhaust memory or storage.
- Notification replay or sync retries create unbounded work.
- Large text or RTL layouts make security actions unreachable.

**Implemented client controls**

- Declared length and maximum-size enforcement while streaming.
- Bounded notification duplicate suppression and capped sync retry/backoff.
- Adaptive scaffold, scrollable content, 200% text-scale source gate, and minimum interactive extent target.

**Owner activation gate**

- Server rate limits, grant issuance limits, timeout policy, and response streaming limits must match the client contract.
- Android/iOS integration tests must verify constrained storage, interruption, backgrounding, and process-death behavior.

### Elevation of privilege

**Threats**

- A local route, locale, cached command, or notification grants capabilities not present in the session.
- A normal access token is accepted where step-up proof is required.
- Teacher drafts finalize attendance or publish grades client-side.

**Implemented client controls**

- Capability-gated routes and repositories, exact session scope, and fail-closed production composition.
- Grant policy selects ordinary or transient step-up authorization; step-up proof is short lived and not persisted into the normal session.
- Attendance finalization, grade publication, consent authority, and sync acceptance remain server-owned.

**Owner activation gate**

- Server authorization must independently evaluate account, tenant, campus, persona, capability, subject relationship, grant state, and step-up policy.

## Abuse cases required before activation

- Reuse a completed or concurrently active document grant.
- Exchange a grant under a different account, tenant, campus, persona, student, or capability set.
- Return a redirect, missing `no-store`, mismatched digest, mismatched content length, unsupported media type, wrong document identity, or oversized stream.
- Background or terminate the app during download and presentation, then verify cleanup.
- Rotate locale, text scale, accessibility service, active student, and persona during an in-flight request.
- Deliver duplicate, expired, cross-application, cross-campus, or capability-incompatible notifications.
- Restore encrypted state after account removal, key rotation, school switch, or tamper quarantine.
- Attempt screenshots, recent-task previews, share-sheet export, backup, print, copy, and open-in-place behavior in the approved native presenter.

## Residual risks

- The proposed mobile endpoints and secure-document exchange service are inactive and have no live authorization or audit evidence.
- Firebase/APNs projects and credentials are inactive.
- Android/iOS restricted-document presenters are not implemented or approved.
- Full translated domain copy, pluralization, date/number formatting, bidirectional-content isolation, and user-selectable language are not yet integrated into production applications.
- Android/iOS integration tests, screen-reader device passes, performance baselines, and store-release evidence remain pending.

## Release-blocking evidence

Production activation remains blocked until all of the following exist:

- Server/platform-owner review and implementation for proposed mobile endpoints.
- Exact authorization, audit, idempotency, revocation, rate-limit, and data-retention evidence.
- Approved Firebase/APNs configuration and live device-session persistence.
- Approved Android and iOS restricted-document presenters and exchange-response policy.
- TalkBack and VoiceOver evidence for critical journeys.
- 200% text scaling and RTL evidence on representative Android and iOS devices.
- Integration tests for backgrounding, interruption, process death, storage pressure, cleanup, and replay.
- Signed release build, provenance, permissions/privacy declarations, store metadata, and rollback evidence.

No item in this document removes those release blockers.
