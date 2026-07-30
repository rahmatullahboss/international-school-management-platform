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
    "`GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` and `GATE-AUTH-FRESH-STEP-UP-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation governance and signed fresh-AAL2 step-up assurance, while real provider routes, production identity and mutations remain disabled.",
    "`GATE-AUTH-PROVIDER-CACHE-ROTATION-V1`, `GATE-AUTH-FRESH-STEP-UP-V1` and `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation, fresh-AAL2 step-up and atomic provider back-channel logout governance, while real provider login, production identity and mutations remain disabled.",
)
replace_once(
    "with fresh step-up assurance in [26-auth-fresh-step-up-assurance-v1.md](26-auth-fresh-step-up-assurance-v1.md) and [27-auth-fresh-step-up-assurance-release-evidence.md](27-auth-fresh-step-up-assurance-release-evidence.md).",
    "with fresh step-up assurance in [26-auth-fresh-step-up-assurance-v1.md](26-auth-fresh-step-up-assurance-v1.md) and [27-auth-fresh-step-up-assurance-release-evidence.md](27-auth-fresh-step-up-assurance-release-evidence.md), and provider back-channel logout in [28-auth-backchannel-logout-v1.md](28-auth-backchannel-logout-v1.md) and [29-auth-backchannel-logout-release-evidence.md](29-auth-backchannel-logout-release-evidence.md).",
)
replace_once(
    "| `GATE-AUTH-FRESH-STEP-UP-V1` | passed | Implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; root CI `30578058983`; deploy/smoke `30578058937`; signed step-up intent, forced reauthentication and bounded fresh AAL2 verified |",
    "| `GATE-AUTH-FRESH-STEP-UP-V1` | passed | Implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; root CI `30578058983`; deploy/smoke `30578058937`; signed step-up intent, forced reauthentication and bounded fresh AAL2 verified |\n| `GATE-AUTH-BACKCHANNEL-LOGOUT-V1` | passed | Implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; root CI `30581812037`; deploy/smoke `30581812029`; typed Logout Tokens, atomic replay/revocation and no-CORS provider route verified |",
)
replace_once(
    "| `AUTH-06` | post-integration | fresh AAL2 step-up gate passed; provider routes disabled | proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; CI `30578058983`; deploy `30578058937` |",
    "| `AUTH-06` | post-integration | fresh AAL2 step-up gate passed; provider routes disabled | proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; CI `30578058983`; deploy `30578058937` |\n| `AUTH-07` | post-integration | atomic provider back-channel logout gate passed; real provider login disabled | proof `fd30d6bd7c56e745a83114722147e83605f01cdd`; main merge `ace9f6f45e21468ae29a68f4ff741ac3994764af`; CI `30581812037`; deploy `30581812029` |",
)
closure = """
## AUTH-07 provider back-channel logout gate closure

Completed and verified on implementation proof `fd30d6bd7c56e745a83114722147e83605f01cdd`:

- strict RS256 `logout+jwt` verification with exact issuer, audience and empty logout event;
- nonce denial and required provider subject or session id;
- bounded token length, age, lifetime, audiences and identifiers;
- one forced JWKS refresh only for an unknown key id;
- provider `sid` retained in signed and durable browser-session context;
- JTI replay insertion and exact provider `sid`/`sub` revocation performed atomically;
- persistence failure rolls back JTI consumption so provider retry remains possible;
- function-only database access for replay, revocation and provider cache;
- form-only bounded provider endpoint with pre-body length rejection, no CORS, no cookie and `no-store`;
- readiness remains non-sensitive and real provider login remains disabled.

Verification evidence:

- TDD red gates covered cryptographic, durable, HTTP and atomic-outage behavior;
- repository tests: 602 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately;
- migrations: 40 canonical plus AUTH-03 and AUTH-07, producing 42 ledger entries;
- root CI `30581812037` and Cloudflare deploy/smoke `30581812029` passed;
- build, budget, audit, licence, provenance, browser and execution-artifact gates passed.

"""
replace_once("## Live staging routes\n", closure + "## Live staging routes\n")
replace_once(
    "- Browser logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/logout` — currently fail-closed because real browser identity configuration is disabled",
    "- Browser logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/logout` — currently fail-closed because real browser identity configuration is disabled\n- Provider back-channel logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/backchannel-logout` — currently fail-closed without a reviewed real provider and durable production binding",
)
replace_once(
    "- AUTH-06 main merge: `12881a80c6776020c8e26ca70ffb4af5c6b42b39`",
    "- AUTH-06 main merge: `12881a80c6776020c8e26ca70ffb4af5c6b42b39`\n- AUTH-07 proof: `fd30d6bd7c56e745a83114722147e83605f01cdd`\n- AUTH-07 main merge: `ace9f6f45e21468ae29a68f4ff741ac3994764af`",
)
replace_once(
    "- Repository tests: 588 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-06 adds signed step-up intent, forced provider reauthentication, reviewed ACR and fresh-AAL2 callback coverage without changing domain invariants.",
    "- Repository tests: 602 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-07 adds typed Logout Token, atomic replay/revocation, provider-session and no-CORS HTTP coverage without changing domain invariants.",
)
replace_once(
    "- Post-integration AUTH manifest: one migration; 41 total ledger entries verified.",
    "- Post-integration AUTH manifest: two migrations; 42 total ledger entries verified.",
)
replace_once(
    "- add provider logout/back-channel revocation and live negative authorization tests;",
    "- add reviewed provider front-channel logout/token revocation where supported and live negative authorization tests;",
)
replace_once(
    "AUTH-01 through AUTH-06 provide provider-neutral verification, PKCE flow, durable identity state, browser session termination, bounded provider caching, signing-key rotation and fresh-AAL2 step-up contracts with real login explicitly disabled.",
    "AUTH-01 through AUTH-07 provide provider-neutral verification, PKCE flow, durable identity state, browser and provider session termination, bounded provider caching, signing-key rotation and fresh-AAL2 step-up contracts with real login explicitly disabled.",
)
path.write_text(source, encoding='utf-8')
