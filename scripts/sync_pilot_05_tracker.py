#!/usr/bin/env python3
from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
source = path.read_text(encoding='utf-8')

replacements = [
    (
        "`GATE-AUTH-DATABASE-PERMISSION-V1` and `GATE-PILOT-DATABASE-READ-MODEL-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout, database-backed permission governance and tenant-safe database runtime projections with current-grant revalidation, while real provider login, production identity, production projection population and mutations remain disabled.",
        "`GATE-AUTH-DATABASE-PERMISSION-V1`, `GATE-PILOT-DATABASE-READ-MODEL-V1` and `GATE-PILOT-SAFE-MUTATION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up, atomic provider back-channel logout, database-backed permission governance, tenant-safe database runtime projections with current-grant revalidation and one tightly allowlisted AAL2/idempotent/revision-checked runtime refresh command with atomic audit/outbox persistence, while real provider login, production identity, production projection population, production mutation consumers and general production mutations remain disabled.",
    ),
    (
        "followed by tenant-safe database runtime read models in [32-pilot-database-read-models-v1.md](32-pilot-database-read-models-v1.md) and [33-pilot-database-read-models-release-evidence.md](33-pilot-database-read-models-release-evidence.md).",
        "followed by tenant-safe database runtime read models in [32-pilot-database-read-models-v1.md](32-pilot-database-read-models-v1.md) and [33-pilot-database-read-models-release-evidence.md](33-pilot-database-read-models-release-evidence.md), and the first safe database mutation envelope in [34-pilot-safe-database-mutation-v1.md](34-pilot-safe-database-mutation-v1.md) and [35-pilot-safe-database-mutation-release-evidence.md](35-pilot-safe-database-mutation-release-evidence.md).",
    ),
    (
        "| `GATE-PILOT-DATABASE-READ-MODEL-V1` | passed | Implementation proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; root CI `30605205955`; deploy/smoke `30605205966`; exact session scope, current roles/grants, digest-bound payloads, private ETags and bounded cache verified |",
        "| `GATE-PILOT-DATABASE-READ-MODEL-V1` | passed | Implementation proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; root CI `30605205955`; deploy/smoke `30605205966`; exact session scope, current roles/grants, digest-bound payloads, private ETags and bounded cache verified |\n| `GATE-PILOT-SAFE-MUTATION-V1` | passed | Implementation proof `2ff251c17d2b4d939a6f274402da99e6447707fd`; main merge `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`; root CI `30608179482`; deploy/smoke `30608179484`; exact-origin AAL2/current-grant authorization, optimistic revision, replay-safe idempotency and atomic receipt/audit/outbox verified |",
    ),
    (
        "| `PILOT-04` | post-integration | tenant-safe database runtime read-model gate passed; production projection source disabled | proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; CI `30605205955`; deploy `30605205966` |",
        "| `PILOT-04` | post-integration | tenant-safe database runtime read-model gate passed; production projection source disabled | proof `f766fc6b426aa1f0f0c9074036a9fb25d27e9a80`; main merge `a81b0025d0427398a616b316dd96451d5e15bcaf`; CI `30605205955`; deploy `30605205966` |\n| `PILOT-05` | post-integration | safe allowlisted database mutation gate passed; production mutation source/consumer disabled | proof `2ff251c17d2b4d939a6f274402da99e6447707fd`; main merge `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`; CI `30608179482`; deploy `30608179484` |",
    ),
]

for old, new in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one tracker marker, found {count}: {old[:140]!r}')
    source = source.replace(old, new)

path.write_text(source, encoding='utf-8')
