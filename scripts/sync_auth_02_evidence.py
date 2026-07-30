import json
from pathlib import Path

readme_path = Path('docs/execution/README.md')
readme = readme_path.read_text(encoding='utf-8')
readme = readme.replace(
    '**Status:** Provider-neutral OIDC trust boundary verified; real login and production promotion gated',
    '**Status:** Authorization Code + PKCE contracts verified; durable identity adapters and real login gated',
)
readme = readme.replace(
    '18. [AUTH-01 release evidence](17-oidc-trust-boundary-release-evidence.md)\n19. Validation script:',
    '18. [AUTH-01 release evidence](17-oidc-trust-boundary-release-evidence.md)\n19. [AUTH-02 Authorization Code + PKCE](18-oidc-pkce-flow-v1.md)\n20. [AUTH-02 release evidence](19-oidc-pkce-flow-release-evidence.md)\n21. Validation script:',
)
readme = readme.replace(
    '- `AUTH-01` — Establishes strict provider-neutral OIDC token verification, server-owned tenant/campus membership resolution and secure host-cookie browser-session contracts while real login remains disabled.\n',
    '- `AUTH-01` — Establishes strict provider-neutral OIDC token verification, server-owned tenant/campus membership resolution and secure host-cookie browser-session contracts while real login remains disabled.\n- `AUTH-02` — Verifies browser-bound Authorization Code + PKCE transactions, provider discovery, bounded JWKS retrieval, confidential code exchange, replay protection and secure login orchestration while real provider routes remain disabled.\n',
)
readme_path.write_text(readme, encoding='utf-8')

tracker_path = Path('docs/execution/04-progress-tracker.md')
tracker = tracker_path.read_text(encoding='utf-8')
tracker = tracker.replace(
    '`GATE-PILOT-SIGNED-SESSION-V1` and `GATE-OIDC-TRUST-BOUNDARY-V1` have passed.',
    '`GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1` and `GATE-OIDC-PKCE-FLOW-V1` have passed.',
)
tracker = tracker.replace(
    'secure browser-session contracts, while real login, production identity and mutations remain disabled.',
    'secure browser-session and Authorization Code + PKCE contracts, while durable identity adapters, real login, production identity and mutations remain disabled.',
)
tracker = tracker.replace(
    'and [17-oidc-trust-boundary-release-evidence.md](17-oidc-trust-boundary-release-evidence.md).',
    'and [17-oidc-trust-boundary-release-evidence.md](17-oidc-trust-boundary-release-evidence.md), with the PKCE flow in [18-oidc-pkce-flow-v1.md](18-oidc-pkce-flow-v1.md) and [19-oidc-pkce-flow-release-evidence.md](19-oidc-pkce-flow-release-evidence.md).',
)
tracker = tracker.replace(
    '| `GATE-OIDC-TRUST-BOUNDARY-V1` | passed | Implementation proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; root CI `30515626535`; deploy/smoke `30515626541`; RS256, issuer/audience/nonce, membership isolation and secure-cookie boundaries verified |\n',
    '| `GATE-OIDC-TRUST-BOUNDARY-V1` | passed | Implementation proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; root CI `30515626535`; deploy/smoke `30515626541`; RS256, issuer/audience/nonce, membership isolation and secure-cookie boundaries verified |\n| `GATE-OIDC-PKCE-FLOW-V1` | passed | Implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; root CI `30517446940`; deploy/smoke `30517446956`; S256 transaction, discovery, replay, confidential exchange and token-withholding boundaries verified |\n',
)
tracker = tracker.replace(
    '| `AUTH-01` | post-integration | OIDC trust boundary passed; login disabled | proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; CI `30515626535`; deploy `30515626541` |\n',
    '| `AUTH-01` | post-integration | OIDC trust boundary passed; login disabled | proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; CI `30515626535`; deploy `30515626541` |\n| `AUTH-02` | post-integration | Authorization Code + PKCE contract passed; provider routes disabled | proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; CI `30517446940`; deploy `30517446956` |\n',
)
auth_section = '''## AUTH-02 Authorization Code + PKCE gate closure

Completed and verified on implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`:

- 256-bit state, nonce and verifier with S256-only PKCE;
- signed `__Host-school_oauth` browser transaction cookie with short bounded lifetime;
- same-origin return-path enforcement, constant-time state validation and authorization-response issuer validation;
- atomic transaction replay dependency before provider token exchange;
- exact discovery issuer and required code, RS256 and S256 capability validation;
- bounded no-redirect discovery, JWKS and token responses;
- unique approved RSA signing keys;
- confidential `client_secret_basic` server-side exchange with exact redirect URI and verifier;
- ordered callback orchestration through ID-token verification, membership resolution and secure session issuance;
- access, refresh and ID tokens withheld from browser-facing results;
- Cloudflare readiness smoke proving every BFF control while `loginEnabled` remains false.

Verification evidence:

- repository tests: 557 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

'''
tracker = tracker.replace('## Live staging routes\n', auth_section + '## Live staging routes\n')
tracker = tracker.replace(
    '- AUTH-01 proof: `5d58706e119e34e72fee17d2a67be74428ad5ab3`\n',
    '- AUTH-01 proof: `5d58706e119e34e72fee17d2a67be74428ad5ab3`\n- AUTH-02 proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`\n',
)
tracker = tracker.replace(
    '- Repository tests: 534 passed; AUTH-01 adds OIDC cryptographic, membership-isolation and secure-cookie coverage without changing domain invariants.\n',
    '- Repository tests: 557 passed; AUTH-02 adds PKCE transaction, provider-discovery, replay, code-exchange and complete login-orchestration coverage without changing domain invariants.\n',
)
tracker = tracker.replace(
    '- implement Authorization Code + PKCE transaction issuance, callback and token exchange;\n- add approved discovery/JWKS retrieval, caching and key rotation;\n- configure a reviewed provider and database-backed membership adapter;\n',
    '- add a durable atomic OAuth transaction replay ledger;\n- add approved discovery/JWKS caching and key-rotation governance;\n- configure a reviewed provider and database-backed membership adapter;\n',
)
tracker = tracker.replace(
    'PILOT-03 remains a synthetic staging identity bridge, while AUTH-01 provides provider-neutral contracts with login explicitly disabled.',
    'PILOT-03 remains a synthetic staging identity bridge. AUTH-01 and AUTH-02 provide provider-neutral verification and PKCE flow contracts with real login explicitly disabled.',
)
tracker_path.write_text(tracker, encoding='utf-8')

release_path = Path('docs/execution/08-final-system-release-evidence.md')
release = release_path.read_text(encoding='utf-8')
if '## Post-gate Authorization Code and PKCE Evidence' not in release:
    release += '''

## Post-gate Authorization Code and PKCE Evidence

AUTH-02 completes the provider-neutral Authorization Code + PKCE contract without enabling a real provider.

- Reviewed base: `48f3fb311a60b87faad3ec4f643b4a32b323099f`.
- Implementation proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`.
- Root CI `30517446940` passed all 21 gates with 557 repository tests, 40 migrations, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare `30517446956` passed extended readiness, fail-closed session, pilot bearer, persona, PWA and health smoke tests.
- The browser transaction uses high-entropy state, nonce, verifier, S256 and a signed host-only cookie.
- Discovery, JWKS and token responses are no-redirect, JSON-only and size bounded.
- The confidential code exchange sends the exact redirect URI and verifier and never returns provider tokens to browser-facing results.
- Atomic replay consumption occurs before a provider request.
- Staging continues to report `loginEnabled: false` with no provider or durable identity adapter configured.

`GATE-OIDC-PKCE-FLOW-V1` passes. Durable replay, JWKS cache/rotation, database-backed membership and policy adapters, reviewed provider configuration, session revocation, refresh-token governance, step-up, monitoring, rollback, UAT and production authorization remain blocked.
'''
release_path.write_text(release, encoding='utf-8')

board_path = Path('docs/execution/03-agent-board.json')
board = json.loads(board_path.read_text(encoding='utf-8'))
board['updated_at'] = '2026-07-30'
board['program_status'] = 'oidc_pkce_flow_verified_login_disabled'
board['auth_oidc_pkce'] = {
    'id': 'AUTH-02',
    'status': 'gate_passed_provider_routes_disabled',
    'gate': 'GATE-OIDC-PKCE-FLOW-V1',
    'branch': 'pilot/oidc-pkce-flow-v1',
    'reviewed_base_sha': '48f3fb311a60b87faad3ec4f643b4a32b323099f',
    'implementation_proof_sha': 'fffd269a7f840f9f90cdca4c4268e46bec7f2a8e',
    'root_ci_run': '30517446940',
    'cloudflare_deploy_run': '30517446956',
    'repository_tests_passed': 557,
    'browser_journeys_passed': 22,
    'authorization_code': True,
    'pkce_method': 'S256',
    'random_entropy_bits': 256,
    'transaction_cookie': '__Host-school_oauth',
    'transaction_replay_dependency_required': True,
    'authorization_response_issuer_verified': True,
    'same_origin_return_path_only': True,
    'discovery_exact_issuer': True,
    'discovery_required_capabilities': ['code', 'RS256', 'S256'],
    'provider_response_redirects_allowed': False,
    'bounded_provider_responses': True,
    'jwks_unique_key_ids': True,
    'token_endpoint_authentication': 'client_secret_basic',
    'provider_tokens_returned_to_browser': False,
    'complete_orchestration_verified': True,
    'login_enabled': False,
    'real_provider_configured': False,
    'durable_replay_source_configured': False,
    'real_membership_source_configured': False,
    'production_identity_enabled': False,
    'production_mutations_enabled': False,
    'remaining_release_gate': 'durable OAuth replay ledger, approved JWKS cache and rotation, reviewed provider configuration, database-backed memberships and permissions, session revocation and refresh-token governance, step-up, monitoring, rollback, owner-led UAT and explicit production authorization',
}
board_path.write_text(json.dumps(board, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
