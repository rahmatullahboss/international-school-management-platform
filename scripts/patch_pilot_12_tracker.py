from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one marker, got {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


replace_once(
    "`GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` and `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` have passed.",
    "`GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1`, `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` and `GATE-PILOT-RUNTIME-PROJECTION-OPERATIONS-MONITOR-V1` have passed.",
)
replace_once(
    "exact student identity/enrollment/roster derivation and canonical campus-lineage isolation, while real provider login",
    "exact student identity/enrollment/roster derivation and canonical campus-lineage isolation, plus a privileged tenant-scoped projection operations monitor with redacted aggregate backlog, dead-letter, source-health and persona-mapping signals, while real provider login",
)
replace_once(
    "and the database-owned student runtime composer in [46-pilot-student-runtime-projection-composer-v1.md](46-pilot-student-runtime-projection-composer-v1.md) and [47-pilot-student-runtime-projection-composer-release-evidence.md](47-pilot-student-runtime-projection-composer-release-evidence.md).",
    "and the database-owned student runtime composer in [46-pilot-student-runtime-projection-composer-v1.md](46-pilot-student-runtime-projection-composer-v1.md) and [47-pilot-student-runtime-projection-composer-release-evidence.md](47-pilot-student-runtime-projection-composer-release-evidence.md), followed by the runtime projection operations monitor in [48-pilot-runtime-projection-operations-monitor-v1.md](48-pilot-runtime-projection-operations-monitor-v1.md) and [49-pilot-runtime-projection-operations-monitor-release-evidence.md](49-pilot-runtime-projection-operations-monitor-release-evidence.md).",
)

student_gate = "| `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` | passed | Implementation proof `9a3978e294bc3d9f463780ec9154bed67d802eb8`; main merge `f260d18bab8084ab2132767f2d8fb3040290c6cd`; root CI `30678621687`; exact active student identity, campus enrollment and roster derivation, authoritative self-service metrics, cross-campus isolation and composer-to-worker projection `2 → 3` verified |"
replace_once(
    student_gate,
    student_gate + "\n| `GATE-PILOT-RUNTIME-PROJECTION-OPERATIONS-MONITOR-V1` | passed | Implementation proof `d87297777ddac389fcfc983a260f0c146978c3c4`; main merge `1106bc88cb3323de540b1d4b14c67b913ba02f5d`; root CI `30679892474`; tenant-scoped redacted aggregate backlog, retry, dead-letter, source-health and persona-mapping monitoring with function-only least privilege and 52-migration verification |",
)

guardian_stream = "| `PILOT-10` | post-integration | database-owned guardian runtime composer gate passed; production composer credential, authority data, cadence and source population disabled | proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; CI `30662644211`; non-HTTP staging deploy not required |"
replace_once(
    guardian_stream,
    guardian_stream
    + "\n| `PILOT-11` | post-integration | database-owned student runtime composer gate passed; production student identity/data, composer credential, cadence and source population disabled | proof `9a3978e294bc3d9f463780ec9154bed67d802eb8`; main merge `f260d18bab8084ab2132767f2d8fb3040290c6cd`; CI `30678621687`; non-HTTP staging deploy not required |"
    + "\n| `PILOT-12` | post-integration | runtime projection operations monitor gate passed; production monitor credential, binding, cadence and alert destination disabled | proof `d87297777ddac389fcfc983a260f0c146978c3c4`; main merge `1106bc88cb3323de540b1d4b14c67b913ba02f5d`; CI `30679892474`; non-HTTP staging deploy not required |",
)

live_staging = "## Live staging routes"
closures = """## PILOT-11 database-owned student runtime composer gate closure

Completed and verified on implementation proof `9a3978e294bc3d9f463780ec9154bed67d802eb8` and main merge `f260d18bab8084ab2132767f2d8fb3040290c6cd`:

- active account, exact campus membership and reviewed student persona determine the database-owned student scope;
- account-to-person-to-active-student-profile linkage and current exact-campus enrollment are derived server-side;
- current roster and published section/timetable lineage constrain every lesson, attendance, assessment and grade query to the exact campus;
- caller-supplied payload, person, profile, enrollment, section or capability scope is rejected;
- canonical capabilities are `timetable.self.read`, `attendance.self.read` and `records.self.read`;
- adversarial cross-campus roster, lesson and result rows remain excluded;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `2 → 3` using source revision two;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus eleven post-integration migrations, producing 51 ledger entries;
- full authoring CI `30678506882` and final canonical CI `30678621687` passed;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- Cloudflare staging was expectedly skipped for this non-HTTP milestone.

## PILOT-12 runtime projection operations monitor gate closure

Completed and verified on implementation proof `d87297777ddac389fcfc983a260f0c146978c3c4` and main merge `1106bc88cb3323de540b1d4b14c67b913ba02f5d`:

- a separate no-login monitor role has function-only access to one tenant-scoped operations snapshot;
- exact allowlisted projection backlog and retry-scheduled events are counted without exposing event identifiers or payloads;
- recent dead-letter totals use fixed sanitized error-code buckets;
- current, stale, unapplied and missing projection-source coverage is aggregated;
- unique, unmapped and ambiguous persona-mapping coverage is aggregated without exposing membership identifiers;
- response controls assert exact event allowlisting, tenant scope, payload redaction and function-only access;
- caller-expanded campus, membership, payload or event scope is rejected before database access;
- malformed thresholds, cross-tenant/malformed database responses and secret-bearing response fields fail closed;
- the monitor is read-only and cannot retry, replay, delete, reset or mutate runtime state;
- no public route, monitor credential, Worker/database binding, schedule or alert destination was introduced.

Verification evidence:

- test-first red CI `30679326523` reached strict lint after formatting and failed on intentionally unresolved monitor modules;
- full authoring CI `30679744735` and final canonical CI `30679892474` passed;
- migrations: 40 canonical plus twelve post-integration migrations, producing 52 ledger entries;
- fresh PostgreSQL verified least privilege and exact aggregate monitoring fixtures;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance, browser and artifact gates passed;
- Cloudflare staging was expectedly skipped for this non-HTTP milestone.

""" + live_staging
replace_once(live_staging, closures)

pilot10_lineage = "- PILOT-10 main merge: `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`"
replace_once(
    pilot10_lineage,
    pilot10_lineage
    + "\n- PILOT-11 proof: `9a3978e294bc3d9f463780ec9154bed67d802eb8`"
    + "\n- PILOT-11 main merge: `f260d18bab8084ab2132767f2d8fb3040290c6cd`"
    + "\n- PILOT-12 proof: `d87297777ddac389fcfc983a260f0c146978c3c4`"
    + "\n- PILOT-12 main merge: `1106bc88cb3323de540b1d4b14c67b913ba02f5d`",
)

replace_once(
    "Repository application suite: the complete canonical suite passed; PILOT-10 adds database-owned guardian identity and verified child authority, education/billing separation, canonical campus-lineage isolation, deterministic unchanged no-op evidence and guardian composer-to-worker lifecycle coverage without changing domain invariants.",
    "Repository application suite: the complete canonical suite passed; PILOT-08 through PILOT-11 provide database-owned admin, teacher, guardian and student home composers with exact persona/campus authority, deterministic unchanged evidence and reviewed composer-to-worker lifecycle coverage, and PILOT-12 adds tenant-scoped redacted runtime projection operations monitoring without changing domain invariants.",
)
replace_once(
    "Post-integration manifest: ten migrations through PILOT-10; 50 total ledger entries verified.",
    "Post-integration manifest: twelve migrations through PILOT-12; 52 total ledger entries verified.",
)
replace_once(
    "- provision reviewed production mapping, publisher and composer credentials; approve admin, teacher and guardian composition cadence and add a separate student composer where required;",
    "- provision reviewed production mapping, publisher and composer credentials; approve admin, teacher, guardian and student composition cadence;",
)
replace_once(
    "- add projection outbox, retry and dead-letter monitoring plus approved source seed/reset tooling;",
    "- provision the reviewed projection-monitor credential and binding; approve polling cadence, thresholds, alert destination/escalation and source seed/reset tooling;",
)
replace_once(
    "PILOT-04 through PILOT-10 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and database-owned admin, teacher and guardian composers while real login, production mapping/publisher/composer credentials, guardian authority data and source population, database/worker bindings and schedule activation remain explicitly disabled.",
    "PILOT-04 through PILOT-12 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher, database-owned admin, teacher, guardian and student composers, and a tenant-scoped redacted projection operations monitor while real login, production mapping/publisher/composer/monitor credentials, production identity/authority data and source population, database/worker/monitor bindings, alert integration and schedule activation remain explicitly disabled.",
)

path.write_text(text)
