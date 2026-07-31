from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
text = path.read_text()
gate = 'GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1'
if gate in text:
    raise SystemExit(0)


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one tracker marker, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


replace_once(
    '`GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1` and `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` have passed.',
    '`GATE-PILOT-RUNTIME-PROJECTION-WORKER-V1`, `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` and `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` have passed.',
)
replace_once(
    'plus a privileged non-HTTP projection source publisher with database-owned persona/subject derivation, monotonic source revisions and append-only evidence, while real provider login, production publisher credentials/mappings/source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.',
    'plus a privileged non-HTTP projection source publisher with database-owned persona/subject derivation, monotonic source revisions and append-only evidence, and a database-owned admin home composer with authoritative enrollment, attendance and finance metrics plus unchanged-payload no-op evidence, while real provider login, production mapping/publisher/composer credentials and source population, production database/worker bindings, production schedule activation and general production mutations remain disabled.',
)
replace_once(
    'and the controlled runtime projection source publisher in [38-pilot-runtime-projection-source-publisher-v1.md](38-pilot-runtime-projection-source-publisher-v1.md) and [39-pilot-runtime-projection-source-publisher-release-evidence.md](39-pilot-runtime-projection-source-publisher-release-evidence.md).',
    'and the controlled runtime projection source publisher in [38-pilot-runtime-projection-source-publisher-v1.md](38-pilot-runtime-projection-source-publisher-v1.md) and [39-pilot-runtime-projection-source-publisher-release-evidence.md](39-pilot-runtime-projection-source-publisher-release-evidence.md), followed by the database-owned admin runtime composer in [40-pilot-admin-runtime-projection-composer-v1.md](40-pilot-admin-runtime-projection-composer-v1.md) and [41-pilot-admin-runtime-projection-composer-release-evidence.md](41-pilot-admin-runtime-projection-composer-release-evidence.md).',
)

gate_row = "| `GATE-PILOT-RUNTIME-PROJECTION-SOURCE-PUBLISHER-V1` | passed | Implementation proof `0ae5b782adb2443d74fafdf4c191638b949d379d`; main merge `1321466a690c1f70be4d1528ed7015f029083302`; root CI `30648006915`; privileged function-only publication, reviewed persona mapping, server-owned subject, monotonic source revisions, append-only evidence and publisher-to-worker projection `8 → 9` verified |"
replace_once(
    gate_row,
    gate_row
    + "\n| `GATE-PILOT-ADMIN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`; root CI `30651595094`; privileged function-only composition, authoritative admin metrics, deterministic unchanged no-op and composer-to-worker projection `9 → 10` verified |",
)

stream_row = "| `PILOT-07` | post-integration | controlled runtime projection source publisher gate passed; production credentials, mappings and source population disabled | proof `0ae5b782adb2443d74fafdf4c191638b949d379d`; main merge `1321466a690c1f70be4d1528ed7015f029083302`; CI `30648006915`; non-HTTP staging deploy not required |"
replace_once(
    stream_row,
    stream_row
    + "\n| `PILOT-08` | post-integration | database-owned admin runtime composer gate passed; production composer credential, cadence and source population disabled | proof `22802925c2a38b355b0f219e762c6e18cc5cd1be`; main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`; CI `30651595094`; non-HTTP staging deploy not required |",
)

closure = '''## PILOT-08 database-owned admin runtime composer gate closure

Completed and verified on implementation proof `22802925c2a38b355b0f219e762c6e18cc5cd1be` and main merge `7476fbfe8830ba98e3a7500165950f26b8bd1310`:

- a separate no-login, no-bypass-RLS role has function-only composer authority;
- `app_runtime`, persona mapping and source publisher roles cannot execute the composer;
- active account, exact membership/campus and reviewed database-owned persona mapping determine scope;
- the caller cannot provide payload, persona, subject, capabilities or expanded browser scope;
- active enrollment, open attendance, unmatched bank lines and open cashier sessions provide bounded authoritative admin metrics;
- campus-local date and legal-entity finance scope are database-derived;
- deterministic payload digests produce audited `unchanged` no-ops without advancing source revision or publication evidence;
- changed domain state publishes only through the reviewed PILOT-07 source publisher;
- successful composition runs and audit evidence are append-only;
- fresh PostgreSQL verified published → unchanged → published composition and projection revision `9 → 10` using source revision four;
- no public HTTP route or composer credential was introduced.

Verification evidence:

- complete canonical application and browser suites passed;
- migrations: 40 canonical plus eight post-integration migrations, producing 48 ledger entries;
- format, lint, boundaries, TypeScript, live Neon, builds, budget, audit, licence, provenance and artifact gates passed;
- root CI `30651595094` passed; Cloudflare staging was expectedly skipped for this non-HTTP milestone.

'''
replace_once('## Live staging routes', closure + '## Live staging routes')

lineage = '- PILOT-07 main merge: `1321466a690c1f70be4d1528ed7015f029083302`'
replace_once(
    lineage,
    lineage
    + "\n- PILOT-08 proof: `22802925c2a38b355b0f219e762c6e18cc5cd1be`\n- PILOT-08 main merge: `7476fbfe8830ba98e3a7500165950f26b8bd1310`",
)
replace_once(
    '- Repository tests: 662 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; PILOT-07 adds privileged source publication, persona/subject derivation, monotonic revision, append-only evidence and publisher-to-worker lifecycle coverage without changing domain invariants.',
    '- Repository application suite: the complete canonical suite passed; PILOT-08 adds privileged database-owned admin composition, authoritative metrics, deterministic unchanged no-op evidence and composer-to-worker lifecycle coverage without changing domain invariants.',
)
replace_once(
    '- Browser journeys: 22 passed.',
    '- Browser journeys: the complete canonical browser suite passed.',
)
replace_once(
    '- Post-integration manifest: seven migrations through PILOT-07; 47 total ledger entries verified.',
    '- Post-integration manifest: eight migrations through PILOT-08; 48 total ledger entries verified.',
)
replace_once(
    '- configure reviewed domain-owned snapshot composers, production persona mappings and least-privilege publisher credentials;',
    '- provision reviewed production mapping, publisher and composer credentials; approve admin composition cadence and add separate teacher, guardian and student composers where required;',
)
replace_once(
    'PILOT-04 through PILOT-07 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor and a controlled non-HTTP source publisher while real login, production publisher credentials/mappings/source population, database/worker bindings and schedule activation remain explicitly disabled.',
    'PILOT-04 through PILOT-08 add tenant-safe database read models, one allowlisted safe mutation, a durable projection processor, a controlled non-HTTP source publisher and a database-owned admin composer while real login, production mapping/publisher/composer credentials and source population, database/worker bindings and schedule activation remain explicitly disabled.',
)

path.write_text(text)
