#!/usr/bin/env python3
from pathlib import Path

path = Path('docs/execution/04-progress-tracker.md')
source = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected one tracker marker, found {count}: {old[:100]!r}')
    source = source.replace(old, new)

replace_once(
    "`GATE-AUTH-SESSION-TERMINATION-V1` and `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching and signing-key rotation governance, while real provider routes, production identity and mutations remain disabled.",
    "`GATE-AUTH-SESSION-TERMINATION-V1`, `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` and `GATE-AUTH-FRESH-STEP-UP-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching, signing-key rotation governance and signed fresh-AAL2 step-up assurance, while real provider routes, production identity and mutations remain disabled.",
)

replace_once(
    "and provider cache/key rotation governance in [24-auth-provider-cache-key-rotation-v1.md](24-auth-provider-cache-key-rotation-v1.md) and [25-auth-provider-cache-key-rotation-release-evidence.md](25-auth-provider-cache-key-rotation-release-evidence.md).",
    "and provider cache/key rotation governance in [24-auth-provider-cache-key-rotation-v1.md](24-auth-provider-cache-key-rotation-v1.md) and [25-auth-provider-cache-key-rotation-release-evidence.md](25-auth-provider-cache-key-rotation-release-evidence.md), with fresh step-up assurance in [26-auth-fresh-step-up-assurance-v1.md](26-auth-fresh-step-up-assurance-v1.md) and [27-auth-fresh-step-up-assurance-release-evidence.md](27-auth-fresh-step-up-assurance-release-evidence.md).",
)

replace_once(
    "| `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` | passed | Implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; root CI `30574007099`; deploy/smoke `30574006810`; bounded cache timestamps, endpoint-origin pins and signing-key rotation verified |",
    "| `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` | passed | Implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; root CI `30574007099`; deploy/smoke `30574006810`; bounded cache timestamps, endpoint-origin pins and signing-key rotation verified |\n| `GATE-AUTH-FRESH-STEP-UP-V1` | passed | Implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; root CI `30578058983`; deploy/smoke `30578058937`; signed step-up intent, forced reauthentication and bounded fresh AAL2 verified |",
)

replace_once(
    "| `AUTH-05` | post-integration | provider cache and signing-key rotation gate passed; provider routes disabled | proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; CI `30574007099`; deploy `30574006810` |",
    "| `AUTH-05` | post-integration | provider cache and signing-key rotation gate passed; provider routes disabled | proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; CI `30574007099`; deploy `30574006810` |\n| `AUTH-06` | post-integration | fresh AAL2 step-up gate passed; provider routes disabled | proof `17b53865900c3606bf5781a9ed0cf0b856262782`; main merge `12881a80c6776020c8e26ca70ffb4af5c6b42b39`; CI `30578058983`; deploy `30578058937` |",
)

auth06 = """
## AUTH-06 fresh step-up assurance gate closure

Completed and verified on implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`:

- signed OAuth transactions bind the requested AAL2 assurance and freshness window;
- step-up authorization forces `prompt=login` and `max_age=0`;
- optional reviewed ACR values are count-, length-, whitespace- and control-character bounded;
- callback completion requires locally verified AAL2 and an `auth_time` no older than five minutes;
- missing, future, stale or AAL1 authentication fails closed before membership or session issuance;
- readiness exposes forced reauthentication, bounded fresh authentication and reviewed ACR controls while `loginEnabled` remains false.

Verification evidence:

- TDD red gate proved the fresh-AAL2 and stale/AAL1 regressions failed before implementation;
- repository tests: 588 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical migrations plus one AUTH post-integration migration passed on fresh PostgreSQL;
- all platform, SIS, finance, integrations, student-support and experience browser suites passed;
- root CI `30578058983` and Cloudflare deploy/smoke `30578058937` passed;
- build, budget, audit, licence, provenance and execution-artifact gates passed.

"""
replace_once("## Live staging routes\n", auth06 + "## Live staging routes\n")

replace_once(
    "- AUTH-05 main merge: `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`",
    "- AUTH-05 main merge: `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`\n- AUTH-06 proof: `17b53865900c3606bf5781a9ed0cf0b856262782`\n- AUTH-06 main merge: `12881a80c6776020c8e26ca70ffb4af5c6b42b39`",
)

replace_once(
    "- Repository tests: 584 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-05 adds cache revalidation, bounded timestamp, stale-if-error, endpoint-origin and signing-key rotation coverage without changing domain invariants.",
    "- Repository tests: 588 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-06 adds signed step-up intent, forced provider reauthentication, reviewed ACR and fresh-AAL2 callback coverage without changing domain invariants.",
)

replace_once(
    "- add provider logout/back-channel revocation, step-up assurance and live negative authorization tests;",
    "- add provider logout/back-channel revocation and live negative authorization tests;",
)

replace_once(
    "AUTH-01 through AUTH-05 provide provider-neutral verification, PKCE flow, durable identity state, browser session termination, bounded provider caching and signing-key rotation contracts with real login explicitly disabled.",
    "AUTH-01 through AUTH-06 provide provider-neutral verification, PKCE flow, durable identity state, browser session termination, bounded provider caching, signing-key rotation and fresh-AAL2 step-up contracts with real login explicitly disabled.",
)

path.write_text(source, encoding='utf-8')
