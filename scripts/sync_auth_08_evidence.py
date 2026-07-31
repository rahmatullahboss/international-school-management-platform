#!/usr/bin/env python3
from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
source = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one tracker marker, found {count}: {old[:120]!r}')
    source = source.replace(old, new)


replace_once(
    '`GATE-AUTH-FRESH-STEP-UP-V1` and `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` have passed.',
    '`GATE-AUTH-FRESH-STEP-UP-V1`, `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` and `GATE-AUTH-DATABASE-PERMISSION-V1` have passed.',
)
replace_once(
    'signing-key rotation, fresh-AAL2 step-up and atomic provider back-channel logout governance, while real provider login, production identity and mutations remain disabled.',
    'signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout and database-backed permission governance, while real provider login, production identity and mutations remain disabled.',
)
replace_once(
    'and provider back-channel logout in [28-auth-backchannel-logout-v1.md](28-auth-backchannel-logout-v1.md) and [29-auth-backchannel-logout-release-evidence.md](29-auth-backchannel-logout-release-evidence.md).',
    'and provider back-channel logout in [28-auth-backchannel-logout-v1.md](28-auth-backchannel-logout-v1.md) and [29-auth-backchannel-logout-release-evidence.md](29-auth-backchannel-logout-release-evidence.md), with database-backed permission evaluation in [30-auth-database-permission-evaluation-v1.md](30-auth-database-permission-evaluation-v1.md) and [31-auth-database-permission-release-evidence.md](31-auth-database-permission-release-evidence.md).',
)
replace_once(
    '| `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` | passed | Implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; root CI `30581812037`; deploy/smoke `30581812029`; typed Logout Tokens, atomic replay/revocation and no-CORS provider route verified |',
    '| `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` | passed | Implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; root CI `30581812037`; deploy/smoke `30581812029`; typed Logout Tokens, atomic replay/revocation and no-CORS provider route verified |\n| `GATE-AUTH-DATABASE-PERMISSION-V1` | passed | Implementation proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; root CI `30601433379`; deploy/smoke `30601433411`; current grants, assurance, server-owned scope and bounded request streaming verified |',
)
replace_once(
    '| `AUTH-07` | post-integration | atomic provider back-channel logout gate passed; real provider login disabled | proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; CI `30581812037`; deploy `30581812029` |',
    '| `AUTH-07` | post-integration | atomic provider back-channel logout gate passed; real provider login disabled | proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; CI `30581812037`; deploy `30581812029` |\n| `AUTH-08` | post-integration | database-backed permission gate passed; real provider login disabled | proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; CI `30601433379`; deploy `30601433411` |',
)

closure = '''
## AUTH-08 database permission gate closure

Completed and verified on implementation proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514` and main merge `3a81f7f32c794b18524f0050828300e76ad4df95`:

- permission decisions derive only from an active durable browser session and current database-owned membership, role and grant state;
- browser-declared tenant, campus, membership, principal, role, assurance and session scope are not accepted;
- revoked or expired sessions, disabled accounts, removed roles and missing grants fail closed;
- AAL2-required permissions return an explicit step-up decision for AAL1 sessions;
- `/auth/v1/authorize` requires the exact configured web origin, signed HttpOnly cookie and exact permission-only JSON body;
- public session introspection omits the opaque session identifier;
- unsupported media types and malformed or extra fields are rejected;
- declared and chunked request bodies are bounded to 2 KiB before parsing;
- `app_runtime` retains function-only database access;
- provider login, production identity/data and mutations remain disabled.

Verification evidence:

- TDD red gates proved database authority, malformed permission, exact-origin HTTP and chunked-body regressions before implementation;
- repository tests: 613 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed;
- post-integration manifest: three AUTH migrations after the immutable 40-migration canonical manifest; 43 ledger entries verified on fresh PostgreSQL;
- format, lint, architecture boundaries, TypeScript, builds, budget, audit, licence, provenance and artifact validation passed;
- root CI `30601433379` and Cloudflare deploy/smoke `30601433411` passed.

'''
replace_once('\n## Live staging routes\n', '\n' + closure + '## Live staging routes\n')
replace_once(
    '- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`',
    '- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`\n- Database permission decision: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/authorize` — currently fail-closed without reviewed identity and database bindings',
)
replace_once(
    '- AUTH-07 main merge: `ace9f6f45e21468ae29a68f4ff741ac3994764af`',
    '- AUTH-07 main merge: `ace9f6f45e21468ae29a68f4ff741ac3994764af`\n- AUTH-08 proof: `6a1d49cc47ebae090470db4ee8c7c6f56953b514`\n- AUTH-08 main merge: `3a81f7f32c794b18524f0050828300e76ad4df95`',
)
replace_once(
    '- Repository tests: 602 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-07 adds typed Logout Token, atomic replay/revocation, provider-session and no-CORS HTTP coverage without changing domain invariants.',
    '- Repository tests: 613 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-08 adds database-owned permission, current-grant/role, assurance, exact-origin HTTP and bounded-stream coverage without changing domain invariants.',
)
replace_once(
    '- Post-integration AUTH manifest: two migrations; 42 total ledger entries verified.',
    '- Post-integration AUTH manifest: three migrations; 43 total ledger entries verified.',
)
replace_once(
    '- connect the verified membership context to database-backed permission evaluation;\n',
    '',
)
replace_once(
    '- add reviewed provider front-channel logout/token revocation where supported and live negative authorization tests;',
    '- add reviewed provider front-channel logout/token revocation where supported;',
)
replace_once(
    'AUTH-01 through AUTH-07 provide provider-neutral verification, PKCE flow, durable identity state, browser and provider session termination, bounded provider caching, signing-key rotation and fresh-AAL2 step-up contracts with real login explicitly disabled.',
    'AUTH-01 through AUTH-08 provide provider-neutral verification, PKCE flow, durable identity state, browser and provider session termination, bounded provider caching, signing-key rotation, fresh-AAL2 step-up and database-backed permission contracts with real login explicitly disabled.',
)

path.write_text(source, encoding='utf-8')
