# 05 — Offline Synchronization and Local Data

## 1. Offline principle

Offline capability is workflow-specific. The app does not promise that every screen works offline and does not cache every successful response. Each resource and command is classified as:

- online-only;
- cached read-only;
- offline draft;
- offline command with later synchronization;
- prohibited from local persistence.

The repository layer is the single source of truth presented to the UI and coordinates remote and local services.

## 2. Initial offline allowlist

### School Staff

Allowed:

- active day's timetable and assigned classes;
- permission-scoped roster for active/recent sessions;
- attendance session metadata and codes;
- attendance drafts and command outbox;
- minimized emergency indicator/contact where separately approved;
- selected announcements and acknowledgement drafts.

Not allowed by default:

- broad student directory;
- full medical record;
- safeguarding/counselling narratives;
- finance administration;
- grade publication/finalization;
- privileged approvals or support access.

### School Family

Allowed:

- recent timetable;
- published attendance and result summaries;
- recent announcements;
- form/absence-notice drafts;
- previously authorized documents where policy permits;
- notification inbox metadata.

Online-only by default:

- payment execution;
- new sensitive document retrieval;
- changes requiring step-up authentication;
- live relationship/authority changes;
- highly restricted records.

## 3. Authorization lease

Every protected offline namespace has a server-issued authorization lease containing:

- tenant/account/persona scope;
- permitted data classes/features;
- issued and expiry times;
- policy/version reference;
- optional device/session binding.

After expiry, protected data is hidden and pending commands are not sent until re-authentication/revalidation. The client clock is not trusted as the sole authority; the app stores last trusted server time and treats suspicious clock rollback conservatively.

## 4. Local database model

Recommended logical tables:

```text
sync_metadata
resource_snapshot
resource_tombstone
offline_command
command_attempt
sync_conflict
document_cache
local_draft
security_lease
```

Every protected row includes or inherits:

- tenant ID;
- account/actor ID;
- persona ID;
- resource/class scope where needed;
- data classification;
- server version/etag;
- last server timestamp;
- retention/expiry metadata.

No cross-tenant or cross-persona query can omit its scope. Database access is only through typed data-access classes and repository implementations.

## 5. Offline command envelope

```text
command_id
command_type
command_version
tenant_scope
actor/persona/device context reference
idempotency_key
aggregate/resource_id
base_version or precondition
client_created_at
trusted_server_time_reference
encrypted_minimized_payload
attachment_intent references
status
attempt_count
next_attempt_at
last_error_code
correlation_id
```

The server derives authoritative actor and tenant context from the authenticated session and does not trust client-supplied privilege claims.

## 6. Command states

```text
draft
queued
sending
accepted
completed
duplicate_completed
retryable_failure
permanent_failure
conflict
blocked_reauth
blocked_lease_expired
blocked_scope_changed
cancelled
```

The UI must distinguish saved locally from accepted by the school server. A local success mark cannot imply attendance, form or message submission is complete.

## 7. Synchronization sequence

1. Validate authenticated session and offline lease.
2. Refresh session/capabilities when required.
3. Push eligible commands in deterministic order.
4. Process per-command results, not only HTTP batch status.
5. Pull incremental server changes from the current cursor.
6. Apply updates/tombstones transactionally.
7. Reconcile local drafts/conflicts.
8. Advance cursor only after the local transaction commits.
9. Surface unresolved user action and privacy-safe diagnostics.

Connectivity callbacks may trigger a sync attempt but never prove network or server availability.

## 8. Retry policy

- Retry only errors marked retryable or known transient transport failures.
- Use exponential backoff with jitter and bounded attempts/windows.
- Respect `Retry-After` and server rate limits.
- Do not retry non-idempotent operations without an idempotency contract.
- Background tasks remain short and resumable; foreground/manual sync is available for time-critical attendance.
- Battery/network policies can defer non-critical media and large pulls.
- Logout/revocation cancels retry work and prevents later execution under a new account/persona.

## 9. Conflict policy

Generic last-write-wins is prohibited.

| Workflow | Conflict handling |
|---|---|
| Attendance draft | Server validates assignment/session/version; conflict is reconciled explicitly |
| Grade draft | Preserve local draft and server version; teacher resolves or discards |
| Grade publication | Online-only and server-authoritative |
| Form draft | Preserve local input; compare form/version and show field-level recovery |
| Absence notice | Idempotent submission; duplicate links to original result |
| Secure message | Client-generated message ID; duplicate-safe send; server ordering authoritative |
| Payment | Online-only; provider/server idempotency and reconciliation |
| Profile correction request | Preserve request draft; server workflow owns accepted values |

A conflict stores enough local/server metadata for recovery without retaining prohibited sensitive content.

## 10. Attendance offline flow

1. Teacher receives an authorized roster/session snapshot with version and lease.
2. Marks are saved transactionally on-device.
3. UI shows `saved on device`, pending count and last trusted sync time.
4. Submission creates idempotent commands; repeated taps do not create new logical commands.
5. Server verifies tenant, teacher assignment, roster/session, code, version and finalization state.
6. Accepted/duplicate results update local evidence.
7. Assignment removed, roster changed or finalized session becomes an explicit conflict/block.
8. Office corrections occur through the backend amendment workflow, not local overwrite.
9. The device eventually removes expired roster data according to retention policy.

## 11. Pull model and tombstones

- Use opaque incremental cursors, not client-generated timestamps alone.
- Changes are permission-filtered for the active context.
- Revocation/removal produces tombstones or a scope-reset instruction so local data is deleted.
- Cursor invalidation triggers a bounded full resync after old scoped data is quarantined/cleared.
- Server event internals are not exposed as a public mobile event log.
- A full resync never sends old queued commands until their scope and preconditions are revalidated.

## 12. Local encryption

- Database and protected files are encrypted using keys protected by platform secure storage.
- Keys are scoped to app/device/account policy and removed on wipe.
- Encryption implementation and key rotation are documented and tested; do not invent cryptography.
- Plaintext temporary files, thumbnails and export directories are prohibited for protected data.
- Database journaling, diagnostics and backups are included in leakage tests.

## 13. Retention and cleanup

Each resource declares:

- maximum offline age;
- last-access/last-sync cleanup rule;
- authorization-lease dependency;
- logout/revocation behavior;
- document/cache size cap;
- legal/tenant policy reference;
- whether an unsent draft can survive re-authentication.

Highly restricted data defaults to no offline persistence. Staff roster/contact caches use the shortest practical period.

## 14. Schema migration and recovery

- Local schema migrations are versioned and tested from every supported app version.
- A migration failure must not silently discard unsent commands.
- Encrypted backup/export of the outbox for support is prohibited unless a separately authorized diagnostic workflow exists.
- If data cannot be migrated safely, the app preserves a minimized recovery marker, requires online reconciliation and clears unauthorized content.
- Downgrade behavior is tested; unsupported old binaries do not open newer protected stores unsafely.

## 15. User experience requirements

Every offline-capable screen shows:

- current network/sync state in text, not color only;
- last trusted sync time;
- stale/expired state;
- locally saved versus server accepted status;
- pending/conflict count and direct recovery action;
- reason when an operation requires online access;
- preserved user input after retryable errors;
- non-disclosing denied/removed state.

Toasts alone are insufficient for synchronization outcomes.

## 16. Test matrix

- airplane mode before/after login;
- network loss during read/write/upload;
- duplicate command and reused mismatched idempotency key;
- app/process kill during local transaction and during sync;
- device reboot and background restrictions;
- cursor expiration/full resync;
- tenant/persona/child switch with pending work;
- relationship/class assignment removed while offline;
- session/device remotely revoked;
- authorization lease expiration and clock rollback;
- local database migration across supported versions;
- storage full/corruption/encryption-key loss;
- partial batch success;
- unsupported app/API version;
- low-cost device performance and large roster bounds;
- leakage through backup, logs, screenshots, temporary files and notifications.
