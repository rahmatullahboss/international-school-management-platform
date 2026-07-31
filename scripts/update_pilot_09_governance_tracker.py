from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
text = path.read_text()
gate = 'GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1'
if gate in text:
    raise SystemExit(0)


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one tracker marker, found {count}: {old[:140]!r}')
    text = text.replace(old, new, 1)


replace_once('**Updated:** 2026-07-31', '**Updated:** 2026-08-01')
replace_once(
    '`GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` and `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` have passed.',
    '`GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1`, `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` and `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` have passed.',
)
replace_once(
    'and a database-owned admin home composer with authoritative enrollment, attendance and finance metrics plus unchanged-payload no-op evidence, while real provider login, production mapping/publisher/composer credentials and source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.',
    'and database-owned admin and teacher home composers with authoritative scoped metrics, deterministic unchanged-payload no-op evidence, canonical teacher capabilities and cross-campus isolation, while real provider login, production mapping/publisher/composer credentials and source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.',
)
replace_once(
    'followed by the database-owned admin runtime composer in [40-pilot-admin-runtime-projection-composer-v1.md](40-pilot-admin-runtime-projection-composer-v1.md) and [41-pilot-admin-runtime-projection-composer-release-evidence.md](41-pilot-admin-runtime-projection-composer-release-evidence.md).',
    'followed by the database-owned admin runtime composer in [40-pilot-admin-runtime-projection-composer-v1.md](40-pilot-admin-runtime-projection-composer-v1.md) and [41-pilot-admin-runtime-projection-composer-release-evidence.md](41-pilot-admin-runtime-projection-composer-release-evidence.md), and the database-owned teacher runtime composer in [42-pilot-teacher-runtime-projection-composer-v1.md](42-pilot-teacher-runtime-projection-composer-v1.md) and [43-pilot-teacher-runtime-projection-composer-release-evidence.md](43-pilot-teacher-runtime-projection-composer-release-evidence.md).',
)

admin_gate = "| `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`; root CI `30651595094`; privileged function-only composition, authoritative admin metrics, deterministic unchanged no-op and composer-to-worker projection `9 → 10` verified |"
replace_once(
    admin_gate,
    admin_gate
    + "\n| `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` | passed | Implementation proof `0db23a475b8cd5db980b657922813e907077bed8`; main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`; root CI `30659200077`; privileged teacher composition, database-owned staff identity, canonical capabilities, exact campus isolation and composer-to-worker projection `4 → 5` verified |",
)

admin_stream = "| `PILOT-08` | post-integration | database-owned admin runtime composer gate passed; production composer credential, cadence and source population disabled | proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`; CI `30651595094`; non-HTTP staging deploy not required |"
replace_once(
    admin_stream,
    admin_stream
    + "\n| `PILOT-09` | post-integration | database-owned teacher runtime composer gate passed; production composer credential, cadence and source population disabled | proof `0db23a475b8cd5db980b657922813e907077bed8`; main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`; CI `30659200077`; non-HTTP staging deploy not required |",
)

closure = '''## PILOT-09 database-owned teacher runtime composer gate closure

Completed and verified on implementation proof `0db23a475b8cd5db980b657922813e907077bed8` and main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`:

- the existing no-login, no-bypass-RLS composer role has function-only teacher composition authority;
- `app_runtime`, persona mapping and source publisher roles cannot execute the teacher composer;
- active account, exact campus membership and reviewed teacher persona mapping determine scope;
- account-to-person-to-active-campus-staff linkage is database-owned and cannot be supplied by the caller;
- published campus timetables, assigned meetings, attendance sessions and gradebook rows provide bounded authoritative workload;
- canonical capabilities are `classes.assigned.read`, `attendance.assigned.write` and `gradebook.assigned.write`;
- every timetable and gradebook query is constrained through the canonical published timetable campus;
- adversarial second-campus classes, inconsistent attendance and gradebook rows remain excluded;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- successful persona-tagged composition runs and audit evidence are append-only;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `4 → 5` using source revision two;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus nine post-integration migrations, producing 49 ledger entries;
- capability hardening CI `30658568371` and campus-isolation CI `30658930197` passed;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- final root CI `30659200077` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

'''
replace_once('## Live staging routes', closure + '## Live staging routes')

lineage = '- PILOT-08 main merge: `7476fbfe8830ba98e3a7500165950f26b8bd1310`'
replace_once(
    lineage,
    lineage
    + "\n- PILOT-09 proof: `0db23a475b8cd5db980b657922813e907077bed8`\n- PILOT-09 main merge: `e6301efaaa374e34b9e2719977f3a5eee51ec651`",
)
replace_once(
    '- Repository application suite: the complete canonical suite passed; PILOT-08 adds privileged database-owned admin composition, authoritative metrics, deterministic unchanged no-op evidence and composer-to-worker lifecycle coverage without changing domain invariants.',
    '- Repository application suite: the complete canonical suite passed; PILOT-09 adds database-owned teacher identity, canonical capability metadata, exact campus isolation, deterministic unchanged no-op evidence and teacher composer-to-worker lifecycle coverage without changing domain invariants.',
)
replace_once(
    '- Post-integration manifest: eight migrations through PILOT-08; 48 total ledger entries verified.',
    '- Post-integration manifest: nine migrations through PILOT-09; 49 total ledger entries verified.',
)
replace_once(
    '- provision reviewed production mapping, publisher and composer credentials; approve admin composition cadence and add separate teacher, guardian and student composers where required;',
    '- provision reviewed production mapping, publisher and composer credentials; approve admin and teacher composition cadence and add separate guardian and student composers where required;',
)
replace_once(
    'PILOT-04 through PILOT-08 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and a database-owned admin composer while real login, production mapping/publisher/composer credentials and source population, database/worker bindings and schedule activation remain explicitly disabled.',
    'PILOT-04 through PILOT-09 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and database-owned admin and teacher composers while real login, production mapping/publisher/composer credentials and source population, database/worker bindings and schedule activation remain explicitly disabled.',
)

path.write_text(text)
