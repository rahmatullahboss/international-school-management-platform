from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
text = path.read_text()
gate = 'GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1'
if gate in text:
    raise SystemExit(0)


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one tracker marker, found {count}: {old[:160]!r}')
    text = text.replace(old, new, 1)


replace_once(
    '`GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` and `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` have passed.',
    '`GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1`, `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` and `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` have passed.',
)
replace_once(
    'and database-owned admin and teacher home composers with authoritative scoped metrics, deterministic unchanged-payload no-op evidence, canonical teacher capabilities and cross-campus isolation, while real provider login, production mapping/publisher/composer credentials and source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.',
    'and database-owned admin, teacher and guardian home composers with authoritative scoped metrics, deterministic unchanged-payload no-op evidence, canonical persona capabilities, verified guardian authority, education/billing separation and canonical campus-lineage isolation, while real provider login, production mapping/publisher/composer credentials and source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.',
)
replace_once(
    'and the database-owned teacher runtime composer in [42-pilot-teacher-runtime-projection-composer-v1.md](42-pilot-teacher-runtime-projection-composer-v1.md) and [43-pilot-teacher-runtime-projection-composer-release-evidence.md](43-pilot-teacher-runtime-projection-composer-release-evidence.md).',
    'and the database-owned teacher runtime composer in [42-pilot-teacher-runtime-projection-composer-v1.md](42-pilot-teacher-runtime-projection-composer-v1.md) and [43-pilot-teacher-runtime-projection-composer-release-evidence.md](43-pilot-teacher-runtime-projection-composer-release-evidence.md), followed by the database-owned guardian runtime composer in [44-pilot-guardian-runtime-projection-composer-v1.md](44-pilot-guardian-runtime-projection-composer-v1.md) and [45-pilot-guardian-runtime-projection-composer-release-evidence.md](45-pilot-guardian-runtime-projection-composer-release-evidence.md).',
)

teacher_gate = "| `GATE-PILOT-TEACHER-RUNTIME-COMPOSER-V1` | passed | Implementation proof `0db23a475b8cd5db980b657922813e907077bed8`; main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`; root CI `30659200077`; privileged teacher composition, database-owned staff identity, canonical capabilities, exact campus isolation and composer-to-worker projection `4 → 5` verified |"
replace_once(
    teacher_gate,
    teacher_gate
    + "\n| `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; root CI `30662644211`; verified child authority, education/billing separation, canonical campus lineage and composer-to-worker projection `3 → 4` verified |",
)

teacher_stream = "| `PILOT-09` | post-integration | database-owned teacher runtime composer gate passed; production composer credential, cadence and source population disabled | proof `0db23a475b8cd5db980b657922813e907077bed8`; main merge `e6301efaaa374e34b9e2719977f3a5eee51ec651`; CI `30659200077`; non-HTTP staging deploy not required |"
replace_once(
    teacher_stream,
    teacher_stream
    + "\n| `PILOT-10` | post-integration | database-owned guardian runtime composer gate passed; production composer credential, authority data, cadence and source population disabled | proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; CI `30662644211`; non-HTTP staging deploy not required |",
)

closure = '''## PILOT-10 database-owned guardian runtime composer gate closure

Completed and verified on implementation proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286` and main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`:

- the existing no-login, no-bypass-RLS composer role has function-only guardian composition authority;
- `app_runtime`, persona mapping and source publisher roles cannot execute the guardian composer;
- active account, exact campus membership and reviewed guardian persona mapping determine scope;
- account-to-active-person guardian linkage is database-owned and cannot be supplied by the caller;
- current verified portal authority plus active exact-campus child enrollment determines child visibility;
- education and billing authority independently gate attendance/grade and finance metrics;
- responsible-party finance scope is limited to the exact campus legal entity, currency and responsibility basis points;
- canonical capabilities are `student.household.read`, `attendance.household.read`, `records.household.read` and `finance.household.read`;
- attendance and grades are constrained through canonical published timetable campus lineage;
- unverified, expired, cross-campus and forged-campus child rows remain excluded;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- successful persona-tagged composition runs and audit evidence are append-only;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `3 → 4` using source revision two;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus ten post-integration migrations, producing 50 ledger entries;
- full authoring CI `30661567046` and campus-lineage hardening CI `30662369824` passed;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- final root CI `30662644211` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

'''
replace_once('## Live staging routes', closure + '## Live staging routes')

lineage = '- PILOT-09 main merge: `e6301efaaa374e34b9e2719977f3a5eee51ec651`'
replace_once(
    lineage,
    lineage
    + "\n- PILOT-10 proof: `d59334952813afafd00b2ddf4ae9b5e06d5f3286`\n- PILOT-10 main merge: `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`",
)
replace_once(
    '- Repository application suite: the complete canonical suite passed; PILOT-09 adds database-owned teacher identity, canonical capability metadata, exact campus isolation, deterministic unchanged no-op evidence and teacher composer-to-worker lifecycle coverage without changing domain invariants.',
    '- Repository application suite: the complete canonical suite passed; PILOT-10 adds database-owned guardian identity and verified child authority, education/billing separation, canonical campus-lineage isolation, deterministic unchanged no-op evidence and guardian composer-to-worker lifecycle coverage without changing domain invariants.',
)
replace_once(
    '- Post-integration manifest: nine migrations through PILOT-09; 49 total ledger entries verified.',
    '- Post-integration manifest: ten migrations through PILOT-10; 50 total ledger entries verified.',
)
replace_once(
    '- provision reviewed production mapping, publisher and composer credentials; approve admin and teacher composition cadence and add separate guardian and student composers where required;',
    '- provision reviewed production mapping, publisher and composer credentials; approve admin, teacher and guardian composition cadence and add a separate student composer where required;',
)
replace_once(
    'PILOT-04 through PILOT-09 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and database-owned admin and teacher composers while real login, production mapping/publisher/composer credentials and source population, database/worker bindings and schedule activation remain explicitly disabled.',
    'PILOT-04 through PILOT-10 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and database-owned admin, teacher and guardian composers while real login, production mapping/publisher/composer credentials, guardian authority data and source population, database/worker bindings and schedule activation remain explicitly disabled.',
)

path.write_text(text)
