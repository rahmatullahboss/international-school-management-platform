# Mobile bearer authentication and bootstrap activation

## Purpose

School Family and School Staff are public native clients. They must not reuse the browser application's confidential OIDC BFF session or embed a client secret. The mobile runtime therefore uses an OIDC authorization-code + PKCE client flow and presents the resulting access token to the platform API as a bearer credential.

The server-side source contract is now implemented for:

- `GET /v1/mobile/readiness`
- `GET /v1/mobile/bootstrap`
- `GET /v1/mobile/family/profiles`
- `GET /v1/mobile/family/students/{studentId}/dashboard`
- `GET /v1/mobile/teacher/today`
- `GET /v1/mobile/teacher/meetings/{meetingId}/roster`
- `POST /v1/mobile/device-sessions`
- `POST /v1/mobile/device-sessions/{deviceSessionId}/revoke`
- `POST /v1/mobile/teacher/attendance-batches`
- `POST /v1/mobile/teacher/assessments/{assessmentId}/grade-drafts`
- `GET /v1/mobile/family/students/{studentId}/documents`
- `POST /v1/mobile/family/documents/{documentId}/download-grants`
- `POST /v1/mobile/family/document-download-grants/{grantId}/exchange`
- `GET /v1/mobile/family/students/{studentId}/forms`
- `GET /v1/mobile/family/forms/{formId}`
- `POST /v1/mobile/family/forms/{formId}/submit`
- `GET /v1/mobile/family/students/{studentId}/consents`
- `POST /v1/mobile/family/consents/{consentId}/decisions`
- `GET /v1/mobile/family/students/{studentId}/conversations`
- `GET /v1/mobile/family/conversations/{conversationId}/messages`
- `POST /v1/mobile/family/conversations/{conversationId}/messages`
- `POST /v1/mobile/family/conversations/{conversationId}/read-receipts`
- `GET /v1/mobile/sync/delta`

The implementation remains fail closed until the reviewed identity-provider configuration and database migration are activated in the target environment.

## Trust boundary

The platform API accepts a mobile access token only when all of the following are true:

- the configured issuer is an exact HTTPS issuer;
- the token is a bounded three-segment JWT signed with RS256;
- the signature validates against a bounded, origin-pinned JWKS response;
- redirects are denied when fetching JWKS;
- the configured API audience is present in the token audience;
- the exact `school_api` scope is present in `scope` or `scp`;
- the token is within its issued/not-before/expiry window and the maximum token lifetime policy;
- an unknown signing-key id causes at most one forced JWKS refresh before failing closed.

The browser session cookie is not accepted by this endpoint, and the mobile application must never contain an OIDC client secret.

## Server configuration

The following non-secret runtime bindings are required before `/v1/mobile/readiness` reports `ready`:

- `MOBILE_OIDC_ISSUER`
- `MOBILE_OIDC_AUDIENCE`
- `MOBILE_OIDC_JWKS_URI`
- `MOBILE_OIDC_JWKS_ORIGIN`
- `MOBILE_OIDC_REQUIRED_SCOPE=school_api`
- `MOBILE_MEMBERSHIP_SOURCE=database`

`DATABASE_URL` remains the existing protected server-side database credential and must not be exposed to the mobile client or committed to source control.

The JWKS origin must exactly match the origin of `MOBILE_OIDC_JWKS_URI`. The API never discovers or follows an arbitrary provider URL supplied by a device.

## Database projection

Migration `202608190001_MOB-02_mobile_bearer_bootstrap.sql` adds the bounded mobile capability keys and the `iam.resolve_mobile_bootstrap_access(text,text)` resolver.

The resolver is `SECURITY DEFINER`, uses an explicit `pg_catalog` search path, is not executable by `PUBLIC`, and is executable by `app_runtime`. It resolves only:

- enabled accounts matching the verified OIDC issuer and subject;
- active OIDC membership bindings;
- active memberships;
- active tenants;
- the exact bound campus and its authoritative timezone;
- the canonical `guardian`, `student`, or `teacher` personas;
- persona-specific mobile capabilities that are also present in the role-permission authority.

Administrator, finance, admissions, support and other non-mobile roles are not returned. A mistaken cross-persona role permission is filtered from the mobile bootstrap projection rather than becoming a client capability.

## Client bootstrap contract

The response contains:

- `accountId`;
- presentation locale fallback (`en` until an authoritative account preference is activated server-side);
- schools/tenants;
- campuses, including each campus's authoritative `timeZone`;
- allowed mobile personas;
- bounded mobile capabilities for each persona.

Timezone is campus-scoped. The client no longer assumes one account-global timezone when an account can access more than one campus.

## Core mobile read models

Migration `202608190002_MOB-03_mobile_core_read_models.sql` adds database-owned, tenant-safe Family and Teacher read functions. Each function re-resolves the verified issuer/subject against the exact tenant, campus and persona before reading domain tables; request headers are selectors, not authority.

The first data-bearing tranche intentionally covers the journeys that can be served from existing authoritative school records without inventing new write semantics:

- Family authorized student/profile selection;
- Family current published timetable, finalized attendance summary and currently published results;
- Teacher current-day assigned/substitution meetings;
- Teacher exact assigned meeting roster with a server version suitable for the existing attendance-draft client contract.

Family billing/messages remain `null` and Staff assessment/conversation lists remain fail closed until their owning authoritative mobile read contracts are added. The API never falls back to pilot fixture JSON when an authoritative read model is unavailable.

Every scoped read requires `X-Tenant-Id`, `X-Campus-Id` and `X-Persona`, validates identifiers and database response shapes, bounds returned arrays/payload bytes, sends `Cache-Control: no-store`, and redacts database failures behind stable mobile error codes.

## Mobile device sessions and push credentials

Migration `202608190003_MOB-04_mobile_device_sessions.sql` adds account-scoped notification device sessions for the already-implemented Flutter native-notification lifecycle. Registration is authenticated by the same verified mobile bearer identity but is deliberately account-scoped rather than tenant-scoped, because one installation may switch between authorized school/campus contexts after bootstrap.

The server stores only app-generated installation IDs plus the provider credential required for delivery; it does not accept hardware IDs, advertising IDs, phone numbers, email addresses or device names. Provider credentials are never returned by the API, copied into idempotency responses, written to application logs or exposed through public/app-runtime table grants.

Registration and revocation are idempotent. A repeated idempotency key with different input fails closed. Re-registering the same installation updates the existing session/revision, and registering an installation or provider token under a different account defensively revokes the previous active owner before the new session becomes active. Android registrations accept Firebase/FCM credentials only; iOS accepts APNs credentials only. Non-production API environments accept only `development` notification credentials, while production accepts only `production` credentials.

Both mutation routes bound request bodies, validate exact known fields/identifiers, use `Cache-Control: no-store`, and return stable redacted errors. The notification-sending worker/provider activation remains a separate server/platform responsibility; MOB-04 only establishes the safe registration lifecycle and delivery-address authority.

## Teacher attendance and grade-draft writes

Migration `202608210001_MOB-05_mobile_teacher_writes.sql` adds function-only Teacher mutation authority for the existing Flutter attendance-batch and grade-draft contracts. Every write re-resolves the verified issuer/subject against the exact tenant, campus and `teacher` persona and then requires the canonical `attendance.take` or `grades.write` capability.

Attendance writes require the active teacher/substitute to own the scheduled meeting, validate every student against the current section roster, resolve each mobile mark through exactly one published attendance code, and keep the attendance session open. Grade drafts require an active teacher/co-teacher assignment for the assessment section, validate current roster membership, preserve integer score-unit conversion, reject canonical reporting-period `gradebook_lock` state before mutation and keep the assessment publication state unchanged. The mobile request contract cannot request attendance finalization, assessment publication or grade publication.

Both write functions use idempotency receipts plus optimistic revisions and resource-level serialization. An exact replay returns the stored receipt; changed reuse conflicts. Initial stale revisions are rejected before creating attendance sessions, grade revision rows or assessment-result rows. MOB-05's command/revision tables are not directly granted to `PUBLIC` or `app_runtime`; only the reviewed mutation functions are executable by `app_runtime`, while the internal authority resolver is not.

## Family documents and secure download grants

Migration `202608210002_MOB-06A_mobile_family_documents.sql` adds Family document metadata reads plus account-scoped, short-lived, single-use secure download grants. Mobile publication rows contain only presentation and integrity policy metadata; they do not create student/document authority. Every list, grant and exchange re-resolves the verified mobile identity, exact tenant/campus/Family persona, `documents.read`, active student/enrollment authority and the canonical student profile-document linkage.

Only canonical document objects with `scan_status='clean'` and mobile-safe profile-document visibility are eligible. Canonical `restricted` profile-document visibility is never widened by a mobile publication row. API metadata and grant responses never return object keys, storage URLs, bearer credentials or provider access tokens. Restricted mobile classification requires `Cache-Control: no-store` and AAL2 before database claim/consumption.

Secure byte exchange additionally requires a reviewed `MOBILE_DOCUMENT_BUCKET` runtime binding. The API authenticates first and verifies the storage binding before claiming the grant, preventing missing storage from consuming a single-use grant. After claim, the object must exist at the canonical `document_object.object_key`, have the exact published byte size and carry matching immutable `school-sha256` metadata. Publication withdrawal, guardian/student authority revocation, missing objects or integrity drift fail closed. No bucket name or production binding is committed by MOB-06A; target-environment object storage activation remains an explicit platform operation.

## Family forms and consent decisions

Migration `202608210003_MOB-06B_mobile_family_forms_consents.sql` adds authoritative Family form requests/submissions and consent requests/decisions for the existing Flutter contracts. These routes are guardian-only because the canonical MOB-02 mobile capability projection grants `forms.consent` only to the guardian persona. Every operation re-resolves verified issuer/subject, tenant, campus, `forms.consent`, exactly one active linked guardian person, current student enrollment and verified current guardian `portal_access` authority.

Form definitions use a bounded explicit schema with `text`, `boolean`, `singleChoice` and `date` fields. The database rejects malformed schemas at publication time and validates submitted answers against required fields, exact field types and choice/date policy. Submission requires the current schema version plus optimistic form `baseVersion`; stale, schema-mismatched, invalid or closed requests do not create submission rows or advance revisions. Account-scoped idempotency digests include tenant/campus/persona/resource/student and exact payload, and replay still re-resolves current authority and exact resource binding. Completed form identity/schema is immutable.

Consent requests remain separate from canonical consent evidence because `people.consent_record` represents granted/withdrawn/expired evidence rather than pending/declined requests. A guardian `grant` transactionally appends a canonical `people.consent_record` for the student person, deciding guardian and request purpose, then links that record to the request. A `decline` advances the request without creating a granted-consent record. Past-due pending requests are exposed as `expired` and cannot be decided. Decided consent requests are immutable; while pending, purpose changes require a new policy version and student reassignment requires a revision advance. MOB-06B tables are not directly accessible to `PUBLIC` or `app_runtime`; `app_runtime` can execute only the reviewed form/consent API functions, not internal schema/authority helpers.

## Family conversations and explicit read receipts

Migration `202608210004_MOB-06C_mobile_family_conversations.sql` adds a shared authoritative conversation ledger plus the existing Family conversation/message routes and an explicit read-receipt command. Guardian and student personas are both supported, but every operation re-resolves the verified OIDC issuer/subject, exact tenant/campus/persona, required `messages.read` or `messages.send` capability, exactly one active linked person, current active student enrollment and current guardian/student authority. The viewer must also be a current explicit participant in the requested thread.

Conversation/message GETs use bounded canonical keyset cursors and are side-effect free. A participant can see only messages at or after that participant's immutable `joined_at` boundary, and conversation summary ordering/`latestMessageAt` is derived only from that visible history so pre-join message timing is not disclosed. Unread/read state uses the exact `(sent_at, message_id)` cursor rather than timestamp alone, preserving correct ordering for equal-timestamp messages. Unread state changes only through `POST /v1/mobile/family/conversations/{conversationId}/read-receipts`, which is account-scoped and idempotent. The Family client sends that command only after loading the first message page and clears local unread state only after the server accepts the receipt; a receipt failure does not discard the already-loaded messages or manufacture a read state.

Messages are append-only. Thread student scope, participant identity/join evidence and historical messages cannot be rewritten; participant rows cannot be deleted, removal must use `left_at`, and once `left_at` is set that leave evidence cannot be cleared or rewritten. Conversation/read revisions and read cursors cannot regress. Sends use resource serialization and account-scoped idempotency; exact replay returns the stored message, changed reuse conflicts, and locked/read-only threads reject sends. Direct table access is not granted to `PUBLIC` or `app_runtime`; only the reviewed Family conversation API functions are executable by `app_runtime`, while cursor/authority/integrity helpers remain internal.

## Provider-neutral mobile notification issuance

Migration `202608210005_MOB-07_mobile_notification_issuance.sql` adds internal provider-neutral logical notification issuance and a bounded per-device outbox. The issuance contract is data-only: it carries only school/account/application/persona/kind scope, optional Family form/conversation resource identity, notification environment, idempotency key and expiry. It does not copy message bodies, student names, amounts, display URLs, provider credentials or raw push tokens into the mobile issuance/outbox tables.

Issuance rechecks current tenant/campus membership, exact Family/Staff persona, required mobile capability, exactly one active linked person and current domain authority. Family form/conversation resource notifications recheck current resource authority. Targets are only active MOB-04 device sessions for the same account, application and development/production environment, with a maximum fan-out of 32. Explicit push opt-out suppresses issuance before target creation; device revocation suppresses stale pending targets. Exact idempotent replay also rechecks authority and suppresses pending targets if access has since been revoked.

MOB-07 writes minimal shared `integration_core.notification_delivery` evidence using the `mobile.data-only.family` or `mobile.data-only.staff` template key. The migration does not expose a mobile-client issuance endpoint and deliberately does not provide a provider dispatch/claim function. Firebase/APNs credentials and actual push-provider delivery remain a separate activation step and are not enabled by applying MOB-07.

## Subject-scoped mobile sync delta

Migration `202608220001_MOB-08_mobile_sync_delta.sql` adds a data-free refresh-hint ledger plus opaque tenant/campus/account/persona-scoped cursors for `GET /v1/mobile/sync/delta`. The response contains only `cursor`, `changed` and canonical UTC `serverTime`; internal revisions, student/section identifiers, payloads and event details are never returned. Unknown or duplicate query parameters, malformed cursors and unexpected response fields fail closed.

Family invalidations are student-subject scoped and are visible only while the active guardian/student is currently authorized for that student. Staff invalidations are section-subject scoped and are visible only while the active Teacher is currently assigned to or substituted into that section. Unrelated students and unassigned classes therefore cannot advance a viewer's cursor. Teacher attendance/grade drafts remain Staff-only refresh signals; Family attendance signals are emitted when the attendance session is finalized and Family grade signals when a grade publication is created.

The native encrypted cursor includes the active persona. A legacy persona-less cursor is ignored, while a stale/expired/foreign server cursor is cleared locally and retried exactly once from a clean baseline. MOB-08 does not create a generic operation endpoint: offline writes continue to use their reviewed attendance, grade, form/consent and messaging APIs. Delta remains a refresh hint only and does not replace bootstrap, membership, capability, enrollment or guardian/staff authority revalidation.

## Authoritative Staff assessment and conversation reads

Migration `202608220002_MOB-09_mobile_staff_reads.sql` adds bounded Teacher assessment-list and Staff conversation/message read models. Assessment reads require the Teacher persona, `grades.write`, the selected-campus active Staff identity and a current `teacher`/`co-teacher` assignment to the section. They return canonical assessment state/lock/revision plus fixed-point score metadata and current roster/entered counts; unassigned sections are excluded.

Staff conversation reads reuse the MOB-06C shared conversation ledger. They require `messages.read`, an explicit current `staff` participant, an active student profile and current active enrollment in the selected campus. History begins at the Staff participant's `joined_at`, so pre-join messages/timing remain hidden; participant leave or campus-enrollment revocation removes read access. `messages.send` alone is not treated as read authority.

## Authoritative Staff conversation writes

Migration `202608220003_MOB-10_mobile_staff_conversation_writes.sql` adds Teacher conversation sends and explicit read receipts on the same shared ledger. Sends require the Teacher persona, `messages.send`, the selected-campus active Staff identity, an explicit current `staff` participant, active student/current campus enrollment, an open thread and `can_reply=true`. Read receipts separately require `messages.read`, cannot acknowledge pre-join messages, and advance participant read evidence monotonically.

Teacher conversation command idempotency is account-scoped. Exact replays revalidate current Staff participant and enrollment authority before returning prior evidence; changed-request key reuse conflicts without mutation. `app_runtime` can execute only the reviewed send/read functions and has no direct conversation-ledger or command-table write access. The Staff app displays a composer only when both canonical `canReply` and `messages.send` are present and preserves loaded messages if send/read-receipt commands fail.

Canonical API failures use the nested shape:

```json
{
  "error": {
    "code": "mobile_access_unavailable",
    "message": "No active mobile school access is available for this account."
  }
}
```

The Flutter API client accepts this canonical nested error shape and retains compatibility with the earlier top-level error shape.

## Mobile compile-time configuration

A test build that is intended to authenticate against the activated environment must receive the reviewed values for:

- `SCHOOL_API_BASE_URL`
- `SCHOOL_OIDC_ISSUER`
- `SCHOOL_OIDC_CLIENT_ID`
- `SCHOOL_OIDC_SCOPES` including `openid` and `school_api`
- `SCHOOL_FAMILY_OIDC_REDIRECT_URI`
- `SCHOOL_STAFF_OIDC_REDIRECT_URI`
- optional reviewed post-logout redirect URI

The Family and Staff redirect schemes remain separate. The identity provider must register the exact native redirect URIs for the corresponding public clients.

## Activation order

1. Review the target identity provider and create public native OIDC clients using authorization code + PKCE; do not create an app-embedded secret.
2. Configure the API audience and issue RS256 access tokens containing the exact `school_api` scope.
3. Review and apply `202608190001_MOB-02_mobile_bearer_bootstrap.sql`, `202608190002_MOB-03_mobile_core_read_models.sql`, `202608190003_MOB-04_mobile_device_sessions.sql`, `202608210001_MOB-05_mobile_teacher_writes.sql`, `202608210002_MOB-06A_mobile_family_documents.sql`, `202608210003_MOB-06B_mobile_family_forms_consents.sql`, `202608210004_MOB-06C_mobile_family_conversations.sql`, `202608210005_MOB-07_mobile_notification_issuance.sql`, `202608220001_MOB-08_mobile_sync_delta.sql`, `202608220002_MOB-09_mobile_staff_reads.sql` and `202608220003_MOB-10_mobile_staff_conversation_writes.sql` to the intended non-production database branch first.
4. Populate/review account, active membership, OIDC binding, campus, canonical mobile role mappings, explicit Family document publication metadata backed by canonical student profile-document links, reviewed Family form/consent requests bound to the intended students, and shared conversation threads with explicit current participants.
5. Configure the `MOBILE_OIDC_*` bindings and `MOBILE_MEMBERSHIP_SOURCE=database` on the intended API environment.
6. Provision/review the intended secure object-storage bucket, upload only clean canonical document objects with matching byte length and immutable `school-sha256` metadata, then bind it as `MOBILE_DOCUMENT_BUCKET`. Do not reuse an unrelated project bucket.
7. Confirm `GET /v1/mobile/readiness` reports `ready` without exposing configuration values.
8. Build Family and Staff with the reviewed `SCHOOL_*` values and distribute them through the dedicated `school-management-mobile-dev` Firebase App Distribution project.
9. Verify real-device sign-in, multi-school/campus selection, logout, token refresh, expired-token behavior and revoked/suspended membership behavior.
10. Verify the implemented Family/Teacher core reads, Family document list/grant/exchange, Family form list/load/submission and consent list/decision flows, Family conversation/message list/send and explicit read-receipt flows, Teacher assessment-list and Staff conversation/message reads, Teacher conversation sends/read receipts, Teacher attendance/grade-draft writes, device-session registration/revocation, subject-scoped sync delta and internal provider-neutral notification issuance on that same verified bearer context. Confirm restricted documents trigger AAL2 and one-use presentation, guardian form submissions preserve schema/revision authority, granted consents append exact canonical evidence and declines do not manufacture granted records, Family conversation GETs do not mutate read state, guardian/student sends remain participant- and authority-scoped, Staff conversation reads require `messages.read`, explicit current Staff participation and current active selected-campus enrollment, pre-join Staff history remains hidden, Staff sends require `messages.send`, open/can-reply state and current participant/enrollment authority, exact Staff command replays revalidate current authority, unrelated students/unassigned sections do not advance a sync cursor, expired/stale cursor conflicts recover through exactly one clean baseline pull, notification environment targeting is exact, opt-out suppresses target creation and device/authority revocation suppresses stale pending notification targets. Do not enable Firebase/APNs provider dispatch as part of this database verification.

## Verification

Source verification includes:

- policy tests for RS256 signature, issuer, audience, exact scope, expiry, denied algorithms and unknown signing keys;
- bounded/origin-pinned JWKS tests;
- platform mobile-auth and route tests;
- Flutter bootstrap/error/timezone tests;
- `tests/integration/verify-mobile-bearer-bootstrap.sh`, which uses a disposable PostgreSQL 16 database (Docker fallback when local PostgreSQL client tools are absent, with two consecutive readiness checks to avoid PostgreSQL init-restart flakes) and verifies tenant/campus projection, persona capability isolation, Family authorized-student isolation, MOB-04 device-session authority, MOB-05 Teacher attendance/grade-draft authority, MOB-06A Family document pagination/clean-scan/visibility/grant authority, MOB-06B Family form schema/answer validation, optimistic revision and idempotency behavior, canonical granted-consent evidence, decline/expiry behavior and request immutability, MOB-06C guardian/student conversation authority, pagination/unread projection, side-effect-free GETs, explicit read receipts, idempotent sends, authority revocation and ledger immutability, MOB-07 provider-neutral notification targeting, exact environment isolation, push opt-out, resource/capability authority, device/authority revocation suppression, idempotency and immutable evidence, MOB-08 subject-scoped Family/Staff invalidation visibility, unrelated-subject isolation, assigned-section visibility, expired/foreign cursor rejection, replay behavior and sync privilege boundaries, MOB-09 assigned/unassigned assessment isolation, exact score/lock/revision/count projection, `messages.read` enforcement, explicit Staff participation, pre-join history isolation, selected-campus enrollment revocation, participant leave revocation and read-function/table privilege boundaries, plus MOB-10 `messages.send` enforcement, exact send replay, changed-key conflict/no mutation, can-reply locking, pre-join read denial, monotonic explicit read evidence, enrollment/participant revocation replay denial and write-function/table privilege boundaries.

The reviewed post-integration migration manifest now includes MOB-02, MOB-03, MOB-04, MOB-05, MOB-06A, MOB-06B, MOB-06C, MOB-07, MOB-08, MOB-09 and MOB-10 so the normal reviewed migration runner cannot silently omit the mobile authority, read-model, device-session, Teacher-write, Family-document, Family form/consent, Family conversation, provider-neutral notification issuance, subject-scoped sync-delta, authoritative Staff reads or Staff conversation command functions.

As of August 22, 2026, the staging Worker still has no reviewed `DATABASE_URL` secret, no reviewed `MOBILE_OIDC_*` provider bindings and no reviewed `MOBILE_DOCUMENT_BUCKET` binding, so live staging authentication/data/document exchange remains deliberately disabled even though the source contracts are implemented. MOB-07 supplies no Firebase/APNs dispatcher credentials or provider-send activation; MOB-08 does not activate live synchronization; MOB-09/MOB-10 have not been applied to a target database or activated against live Staff accounts. No production provider/storage configuration, real account data, provider message dispatch or production deployment is performed by this source tranche.
