# 04 — Offline Synchronization and Local Data

## 1. Principle

Offline behavior is feature-specific, not an application-wide promise. Each feature declares whether reads may be cached, writes may be queued, conflicts may be reconciled and background execution is optional or required.

Repositories are the single access point for local and remote data. The local database is a cache, draft store and durable command queue; the server remains authoritative.

## 2. Offline capability classes

| Class | Behavior | Examples |
|---|---|---|
| `ONLINE_ONLY` | no durable local write; explain connectivity requirement | payment execution, grade publication, finalized correction, high-risk approval |
| `CACHE_READ` | encrypted cached read with freshness and last-sync display | timetable, announcements, published results |
| `DRAFT_LOCAL` | local draft retained; explicit online submit | forms, grade draft, message draft |
| `QUEUE_WRITE` | durable idempotent command queue and later reconciliation | attendance capture, acknowledgement, approved absence submission |
| `EPHEMERAL` | memory only; cleared on background/context change where required | highly sensitive transient detail |

Every feature specification includes one class and a data allowlist.

## 3. Local data namespaces

Persisted data is partitioned by:

```text
app target / tenant / actor / persona / resource scope / schema version
```

Guardian child context is included in resource keys. A tenant or persona switch cannot read another namespace. Logout, account unlink, session revocation, tenant removal and policy-driven wipe close and remove affected namespaces.

## 4. Local data allowlist

### Family application

May be approved for encrypted caching:

- tenant-safe branding and localization configuration;
- authorized household/child summary;
- bounded timetable/calendar window;
- recent published attendance summary;
- recent published result summary;
- announcement metadata;
- document metadata and explicitly downloaded files;
- form drafts;
- notification inbox metadata;
- message drafts and bounded recent conversation metadata.

### Staff application

May be approved for encrypted caching:

- teacher timetable;
- assigned class roster snapshot;
- attendance session, codes and drafts;
- minimum necessary emergency indicators/contacts where policy permits;
- bounded announcements and acknowledgements;
- grade drafts without publication authority.

### Default deny

Do not persist by default:

- access/refresh tokens in the relational cache;
- full health, counseling or safeguarding narratives;
- broad financial ledgers or exports;
- identity documents and national identifiers;
- support/break-glass data;
- unrelated student directories;
- server secrets, signing keys or provider credentials;
- raw notification payloads containing sensitive content.

An exception requires classification, retention, wipe and threat-model approval.

## 5. Storage architecture

Use an encrypted relational local database behind `core_database` for structured cache, drafts, sync cursors and command queue. Use platform secure credential storage for token material and key references. Downloaded files use an application-private encrypted location with metadata and expiry.

All persistence engines are adapters. Feature repositories depend on typed interfaces and migration tests.

## 6. Read strategy

A repository may expose a stream that emits:

1. local cached value and freshness metadata;
2. loading/refresh state;
3. remote result persisted transactionally;
4. updated local value;
5. non-destructive refresh error if stale data remains usable.

The UI always distinguishes current, cached, stale and unavailable data. Cached data is never presented as live without timestamp/context.

## 7. Command queue

Minimum durable queue fields:

```text
command_id
app_target
tenant_id
actor_id
persona_id
device_id
resource_scope
command_type
idempotency_key
request_fingerprint
base_version
encrypted_payload
created_at
expires_at
status
attempt_count
next_attempt_at
last_error_code
correlation_id
```

Statuses:

```text
DRAFT -> READY -> SENDING -> ACCEPTED
                       |-> PARTIAL
                       |-> CONFLICT
                       |-> RETRY_WAIT
                       |-> REJECTED
                       |-> EXPIRED
                       |-> CANCELLED
```

Transitions are transactional and covered by state-machine tests.

## 8. Sync protocol

Sync is command/query based rather than generic database replication.

### Push

1. select eligible commands for active context;
2. verify session, capability and expiry;
3. send bounded batch with idempotency keys and base versions;
4. persist server result before marking local commands complete;
5. update local projections from authoritative response;
6. surface partial/conflict/rejected items for reconciliation.

### Pull

Use feature-specific cursors, ETags or version windows. The server may invalidate a cursor and require a bounded resnapshot. Tombstones or explicit revocations remove stale cached records.

## 9. Attendance-specific behavior

Attendance is the first required offline write.

- Teacher downloads only current assigned roster/session.
- Each mark has a stable client record ID and server session/version.
- Drafts save after each interaction.
- Batch submission uses one batch idempotency key plus stable item IDs.
- Server rechecks teacher assignment, session status, code validity and version.
- Duplicate replay returns the original item outcome.
- Finalized/changed sessions become conflicts, not silent overwrites.
- Office corrections remain server-side amendment workflows.
- The UI shows unsynced count, last sync, accepted, rejected and conflict items.

## 10. Conflict policy

| Data | Policy |
|---|---|
| Attendance draft | server session/version validation; per-item reconciliation |
| Form draft | preserve local draft; compare form version; user-assisted resubmit |
| Grade draft | preserve both local and server versions; explicit resolution |
| Message send | client message ID and duplicate-safe server acknowledgement |
| Acknowledgement | idempotent accept; original timestamp retained server-side |
| Payment | online only; status queried after uncertain outcome |
| Published/finalized records | server authoritative; client cannot overwrite |

Last-write-wins is prohibited unless the data owner explicitly documents that lost updates are harmless.

## 11. Retry and background execution

Retry uses exponential backoff with jitter, connectivity/power constraints and server retry hints. Authentication, validation, permission, conflict and finalized errors are not blindly retried.

Operating systems do not guarantee immediate or continuous background execution. Therefore:

- foreground/app-resume sync is mandatory;
- user-triggered sync is available for critical drafts;
- platform background schedulers are opportunistic accelerators;
- push may signal that data is available but does not carry authoritative content;
- critical workflows show pending state until server acknowledgement.

The design must remain correct if background work never runs before the next app launch.

## 12. Local migrations and recovery

Local schema migrations are forward-tested across all supported app versions. Before destructive local migration:

- pending commands are preserved or blocked with recovery guidance;
- encryption keys and namespaces are available;
- migration runs transactionally where supported;
- failure leaves a recoverable database or triggers a safe cache rebuild;
- unsent drafts are never silently deleted.

Caches may be rebuilt; pending user-created data requires export/recovery or explicit consent before removal.

## 13. Time, ordering and clocks

Server time is authoritative for accepted events. Client timestamps record user/device observation only. Queue ordering is explicit per aggregate where required; global device order is not assumed.

Clock skew cannot determine financial, attendance-finalization, publication or retention outcomes.

## 14. Telemetry

Collect privacy-safe operational metrics:

- pending queue depth by command type;
- sync duration and outcome;
- conflict/rejection category;
- cursor reset frequency;
- local migration result;
- cache hit/staleness;
- background versus foreground sync;
- app version and platform.

Do not log payloads, names, student identifiers, message bodies, health details, balances or tokens.

## 15. Verification gates

Offline readiness requires tests for airplane mode, intermittent network, duplicate send, timeout after server commit, token expiry, persona revocation, assignment change, session finalization, clock skew, app termination, OS restart, local migration, low storage, corrupted cache and forced logout.
