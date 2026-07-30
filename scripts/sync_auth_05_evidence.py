#!/usr/bin/env python3
from pathlib import Path

tracker = Path('docs/execution/04-progress-tracker.md')
source = tracker.read_text(encoding='utf-8')

replacements = [
    (
        '**Updated:** 2026-07-30  \n**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1`, `GATE-AUTH-DURABLE-CONTEXT-V1` and `GATE-AUTH-SESSION-TERMINATION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state and exact-origin current/account-wide browser logout, while real provider routes, production identity and mutations remain disabled.',
        '**Updated:** 2026-07-31  \n**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1`, `GATE-AUTH-DURABLE-CONTEXT-V1`, `GATE-AUTH-SESSION-TERMINATION-V1` and `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state, exact-origin browser logout, bounded provider discovery/JWKS caching and signing-key rotation governance, while real provider routes, production identity and mutations remain disabled.',
    ),
    (
        'with browser session termination in [22-auth-session-termination-v1.md](22-auth-session-termination-v1.md) and [23-auth-session-termination-release-evidence.md](23-auth-session-termination-release-evidence.md).',
        'with browser session termination in [22-auth-session-termination-v1.md](22-auth-session-termination-v1.md) and [23-auth-session-termination-release-evidence.md](23-auth-session-termination-release-evidence.md), and provider cache/key rotation governance in [24-auth-provider-cache-key-rotation-v1.md](24-auth-provider-cache-key-rotation-v1.md) and [25-auth-provider-cache-key-rotation-release-evidence.md](25-auth-provider-cache-key-rotation-release-evidence.md).',
    ),
    (
        '| `GATE-AUTH-SESSION-TERMINATION-V1` | passed | Implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; root CI `30533390869`; deploy/smoke `30533390917`; exact-origin current/account-wide logout and secure cookie deletion verified |',
        '| `GATE-AUTH-SESSION-TERMINATION-V1` | passed | Implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; root CI `30533390869`; deploy/smoke `30533390917`; exact-origin current/account-wide logout and secure cookie deletion verified |\n| `GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` | passed | Implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; root CI `30574007099`; deploy/smoke `30574006810`; bounded cache timestamps, endpoint-origin pins and signing-key rotation verified |',
    ),
    (
        '| `AUTH-04` | post-integration | browser session termination gate passed; provider routes disabled | proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; CI `30533390869`; deploy `30533390917` |',
        '| `AUTH-04` | post-integration | browser session termination gate passed; provider routes disabled | proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; CI `30533390869`; deploy `30533390917` |\n| `AUTH-05` | post-integration | provider cache and signing-key rotation gate passed; provider routes disabled | proof `d8e60bc045265799d6ecf63da6a75e22c9287459`; main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`; CI `30574007099`; deploy `30574006810` |',
    ),
    (
        '- AUTH-04 proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`',
        '- AUTH-04 proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`\n- AUTH-05 proof: `d8e60bc045265799d6ecf63da6a75e22c9287459`\n- AUTH-05 main merge: `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`',
    ),
    (
        '- Repository tests: 575 passed; AUTH-04 adds exact-origin logout, strict request-shape, current-session and account-wide termination coverage without changing domain invariants.',
        '- Repository tests: 584 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately; AUTH-05 adds cache revalidation, bounded timestamp, stale-if-error, endpoint-origin and signing-key rotation coverage without changing domain invariants.',
    ),
    (
        '- add approved discovery/JWKS caching and key-rotation governance;\n- configure a reviewed provider and production database binding;',
        '- configure a reviewed provider, production provider-cache binding and production database binding;',
    ),
    (
        'No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-04 provide provider-neutral verification, PKCE flow, durable identity state and browser session termination contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.',
        'No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-05 provide provider-neutral verification, PKCE flow, durable identity state, browser session termination, bounded provider caching and signing-key rotation contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.',
    ),
]

for old, new in replacements:
    if source.count(old) != 1:
        raise SystemExit(f'Expected tracker fragment exactly once: {old[:80]!r}')
    source = source.replace(old, new)

closure_marker = '## Live staging routes\n'
if source.count(closure_marker) != 1:
    raise SystemExit('Expected one live staging routes section.')
closure = '''## AUTH-05 provider cache and signing-key rotation gate closure

Completed and verified on implementation proof `d8e60bc045265799d6ecf63da6a75e22c9287459` and main merge `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`:

- exact HTTPS origin pins for issuer, authorization, token and JWKS endpoints;
- reviewed provider endpoint changes denied after cached discovery;
- bounded discovery and JWKS freshness with conditional ETag revalidation;
- bounded stale-if-error use only for previously approved provider data;
- single-flight discovery and JWKS refreshes;
- bounded retired signing-key overlap;
- same-`kid` key-material reuse denied;
- unknown token `kid` triggers exactly one forced refresh;
- known-key signature failure does not refresh;
- malformed, future-dated and overlong durable-cache records fail closed;
- Cloudflare readiness exposes only generic cache/origin requirements while `loginEnabled` remains false.

Verification evidence:

- repository tests: 584 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- TDD red gate proved both timestamp-poisoning regressions failed before implementation;
- migrations: 40 canonical migrations plus one AUTH post-integration migration passed on fresh PostgreSQL;
- all platform, SIS, finance, integrations, student-support and experience browser suites passed;
- root CI `30574007099` and Cloudflare deploy/smoke `30574006810` passed;
- all asset budgets remained within approved limits.

'''
source = source.replace(closure_marker, closure + closure_marker)
tracker.write_text(source, encoding='utf-8')
