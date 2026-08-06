# PILOT-07 — Controlled Runtime Projection Source Publisher

**Status:** passed and merged to `main`  
**Runtime merge:** `1321466a690c1f70be4d1528ed7015f029083302`  
**Reviewed implementation head:** `0ae5b782adb2443d74fafdf4c191638b949d379d`

## Objective

Introduce the first controlled publisher for the database-owned runtime projection source consumed by PILOT-06, without exposing a browser route, granting the normal application runtime publication authority or activating production source population.

PILOT-07 accepts only an exact tenant, membership, campus, previous source revision, bounded payload, source timestamp, publisher identity and correlation identifier at a privileged non-HTTP boundary. Persona and subject are derived from current database-owned identity and reviewed role mapping. The caller cannot declare tenant scope inside the payload or choose role, persona, subject or capabilities.

## Least-privilege roles

The migration creates two separate PostgreSQL roles:

- `app_projection_admin` configures reviewed role-to-persona mappings;
- `app_projection_publisher` publishes runtime source payloads through one security-definer function.

Both roles are `NOLOGIN` and `NOBYPASSRLS`. They receive no direct table privileges. `app_runtime` cannot configure mappings, publish source payloads or read the publisher governance tables directly.

No application or production credential for either privileged role is introduced by this milestone.

## Reviewed persona mapping

`platform.runtime_projection_persona_role` maps an exact tenant role to one of `admin`, `teacher`, `guardian` or `student`.

Mappings are changed only through `platform.configure_runtime_projection_persona_role(...)`, which:

1. validates the tenant, role, persona and administrator identity;
2. verifies that the role exists in the exact tenant;
3. updates the current mapping;
4. appends immutable configuration evidence to `platform.runtime_projection_persona_role_event`.

A membership with no reviewed mapping fails as `persona-unmapped`. A membership whose roles resolve to more than one persona fails as `persona-ambiguous`. The publisher never accepts persona from its caller.

Configuration history is append-only and retains referential role evidence.

## Server-owned subject and scope

`platform.publish_runtime_projection_source(...)` locks and verifies:

- the exact active membership;
- the exact campus, including null-campus equivalence;
- the linked account is not disabled;
- current membership roles and reviewed persona mappings.

The subject reference is derived from `iam.person_link` when available and otherwise from the durable account identifier. The caller cannot submit a subject reference.

Payloads containing any browser-like scope key are rejected. The denylist includes tenant, membership, campus, role, persona, subject and capability fields. This keeps identity, authorization and publication scope outside caller-controlled data.

## Monotonic source lifecycle

The publisher requires the exact previous source revision. A first publication requires revision zero; each accepted publication increments the source revision by one. A stale expected revision returns a bounded `revision-conflict` result with the current revision.

Source timestamps cannot move backwards and cannot be materially in the future. A stale source timestamp returns `source-stale`.

The existing `runtime_projection_source` integrity trigger computes the SHA-256 payload digest and serialized byte count. Payloads must be non-empty JSON objects and remain within the 262,144-byte limit.

## Publication evidence

Every accepted publication atomically:

1. upserts the exact `home` source row;
2. records persona, derived subject, revision, digest, bytes, publisher and correlation data in `platform.runtime_projection_source_publication`;
3. records `runtime.projection.source.published` in the append-only audit stream.

`runtime_projection_source_publication` is append-only. Direct access is denied to the public, `app_runtime`, the mapping administrator and the publisher role.

## Application adapter

The TypeScript publisher boundary:

- validates the exact input shape before any database call;
- rejects malformed UUIDs, publisher identities and timestamps;
- rejects empty, oversized or scope-bearing payloads;
- returns `publisher-disabled` without calling the store;
- sanitizes store failures as `publisher-unavailable`.

`DatabaseProjectionSourcePublisherStore` calls only the reviewed database function and validates exactly one strict response. Malformed accepted or rejected database responses fail closed.

The adapter is exported for privileged server-side composition only. No Hono route or browser-accessible endpoint was added.

## End-to-end projection proof

Fresh PostgreSQL verification established this complete path:

1. an administrator configures the reviewed admin persona mapping;
2. the privileged publisher creates source revision one;
3. revision conflict, injected scope and stale timestamp attempts are rejected;
4. the publisher creates source revision two;
5. a conflicting persona mapping causes `persona-ambiguous`;
6. a suspended membership causes `scope-inactive`;
7. `app_runtime` submits the reviewed AAL2 runtime refresh command at projection revision eight;
8. the PILOT-06 worker processes the exact outbox event;
9. the projection advances from revision eight to nine using source revision two;
10. publication, command, worker and audit evidence remain durable and tenant-scoped.

## Explicit exclusions

PILOT-07 does not:

- expose a public or browser-facing publisher route;
- create an application credential for either privileged database role;
- configure production role-to-persona mappings;
- publish production tenant, student, family or staff payloads;
- activate a production database or Worker source binding;
- activate the Cloudflare Cron Trigger;
- enable real identity-provider login;
- enable arbitrary projection keys or general event publication;
- replace monitoring, backup/restore rehearsal, owner UAT, security approval or explicit production authorization.