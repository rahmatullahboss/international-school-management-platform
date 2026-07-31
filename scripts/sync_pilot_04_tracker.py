#!/usr/bin/env python3
from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
source = path.read_text(encoding='utf-8')

replacements = [
    (
        "`GATE-AUTH-BACKCHANNEL-LOGOUT-V1` and `GATE-AUTH-DATABASE-PERMISSION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout and database-backed permission governance, while real provider login, production identity and mutations remain disabled.",
        "`GATE-AUTH-BACKCHANNEL-LOGOUT-V1`, `GATE-AUTH-DATABASE-PERMISSION-V1` and `GATE-PILOT-DATABASE-READ-MODEL-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout, database-backed permission governance and tenant-safe database runtime projections with current-grant revalidation, while real provider login, production identity, production projection population and mutations remain disabled.",
    ),
    (
        "with database-backed permission evaluation in [30-auth-database-permission-evaluation-v1.md](30-auth-database-permission-evaluation-v1.md) and [31-auth-database-permission-release-evidence.md](31-auth-database-permission-release-evidence.md).",
        "with database-backed permission evaluation in [30-auth-database-permission-evaluation-v1.md](30-auth-database-permission-evaluation-v1.md) and [31-auth-database-permission-release-evidence.md](31-auth-database-permission-release-evidence.md), followed by tenant-safe database runtime read models in [32-pilot-database-read-models-v1.md](32-pilot-database-read-models-v1.md) and [33-pilot-database-read-models-release-evidence.md](33-pilot-database-read-models-release-evidence.md).",
    ),
    (
        "| `GATE-AUTH-DATABASE-PERMISSION-V1` | passed | Implementation proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; root CI `30601433379`; deploy/smoke `30601433411`; current grants, assurance, server-owned scope and bounded request streaming verified |",
        "| `GATE-AUTH-DATABASE-PERMISSION-V1` | passed | Implementation proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; root CI `30601433379`; deploy/smoke `30601433411`; current grants, assurance, server-owned scope and bounded request streaming verified |\n| `GATE-PILOT-DATABASE-READ-MODEL-V1` | passed | Implementation proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; root CI `30605205955`; deploy/smoke `30605205966`; exact session scope, current roles/grants, digest-bound payloads, private ETags and bounded cache verified |",
    ),
    (
        "| `AUTH-08` | post-integration | database-backed permission gate passed; real provider login disabled | proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; CI `30601433379`; deploy `30601433411` |",
        "| `AUTH-08` | post-integration | database-backed permission gate passed; real provider login disabled | proof `6a1d49cc47ebae090470db4ee8c7c6f56953b514`; main merge `3a81f7f32c794b18524f0050828300e76ad4df95`; CI `30601433379`; deploy `30601433411` |\n| `PILOT-04` | post-integration | tenant-safe database runtime read-model gate passed; production projection source disabled | proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; CI `30605205955`; deploy `30605205966` |",
    ),
]

for old, new in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one tracker marker, found {count}: {old[:120]!r}')
    source = source.replace(old, new)

path.write_text(source, encoding='utf-8')
