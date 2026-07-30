import json
from pathlib import Path

readme_path = Path('docs/execution/README.md')
readme = readme_path.read_text(encoding='utf-8')
readme = readme.replace(
    '**Status:** Pilot runtime signed session context connected; production promotion gated',
    '**Status:** Provider-neutral OIDC trust boundary verified; real login and production promotion gated',
)
readme = readme.replace(
    '16. [PILOT-03 release evidence](15-pilot-signed-session-release-evidence.md)\n17. Validation script:',
    '16. [PILOT-03 release evidence](15-pilot-signed-session-release-evidence.md)\n17. [AUTH-01 OIDC trust boundary](16-oidc-trust-boundary-v1.md)\n18. [AUTH-01 release evidence](17-oidc-trust-boundary-release-evidence.md)\n19. Validation script:',
)
readme = readme.replace(
    '- `PILOT-03` — Replaces browser-declared scope headers with short-lived HMAC-signed synthetic staging sessions that bind tenant, campus, role and subject before a snapshot is read.\n',
    '- `PILOT-03` — Replaces browser-declared scope headers with short-lived HMAC-signed synthetic staging sessions that bind tenant, campus, role and subject before a snapshot is read.\n- `AUTH-01` — Establishes strict provider-neutral OIDC token verification, server-owned tenant/campus membership resolution and secure host-cookie browser-session contracts while real login remains disabled.\n',
)
readme_path.write_text(readme, encoding='utf-8')

tracker_path = Path('docs/execution/04-progress-tracker.md')
tracker = tracker_path.read_text(encoding='utf-8')
tracker = tracker.replace(
    '`GATE-PILOT-READ-API-V1` and `GATE-PILOT-SIGNED-SESSION-V1` have passed. The non-production Cloudflare pilot now requires a short-lived signed synthetic session before role-scoped Worker snapshots are read, while production identity and mutations remain disabled.',
    '`GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1` and `GATE-OIDC-TRUST-BOUNDARY-V1` have passed. The non-production Cloudflare pilot now includes strict provider-neutral OIDC verification, server-owned membership selection and secure browser-session contracts, while real login, production identity and mutations remain disabled.',
)
tracker = tracker.replace(
    'and [15-pilot-signed-session-release-evidence.md](15-pilot-signed-session-release-evidence.md).',
    '[15-pilot-signed-session-release-evidence.md](15-pilot-signed-session-release-evidence.md), and the OIDC trust boundary in [16-oidc-trust-boundary-v1.md](16-oidc-trust-boundary-v1.md) and [17-oidc-trust-boundary-release-evidence.md](17-oidc-trust-boundary-release-evidence.md).',
)
tracker = tracker.replace(
    '| `GATE-PILOT-SIGNED-SESSION-V1` | passed | Implementation proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; root CI `30501350771`; deploy/smoke `30501350785`; signature, expiry, wrong-secret, cross-role and live bearer flow verified |\n',
    '| `GATE-PILOT-SIGNED-SESSION-V1` | passed | Implementation proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; root CI `30501350771`; deploy/smoke `30501350785`; signature, expiry, wrong-secret, cross-role and live bearer flow verified |\n| `GATE-OIDC-TRUST-BOUNDARY-V1` | passed | Implementation proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; root CI `30515626535`; deploy/smoke `30515626541`; RS256, issuer/audience/nonce, membership isolation and secure-cookie boundaries verified |\n',
)
tracker = tracker.replace(
    '| `PILOT-03` | post-integration | signed staging session gate passed and staged | proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; CI `30501350771`; deploy `30501350785` |\n',
    '| `PILOT-03` | post-integration | signed staging session gate passed and staged | proof `0a36ef62ec1622bdea6de7d0135bf30026845528`; CI `30501350771`; deploy `30501350785` |\n| `AUTH-01` | post-integration | OIDC trust boundary passed; login disabled | proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`; CI `30515626535`; deploy `30515626541` |\n',
)
auth_section = '''## AUTH-01 OIDC trust boundary closure

Completed and verified on implementation proof `5d58706e119e34e72fee17d2a67be74428ad5ab3`:

- RS256-only ID-token verification with exact issuer, audience/`azp`, nonce, signing-key, signature and time validation;
- denied unsigned, malformed, tampered, expired, future and excessive-lifetime tokens;
- AAL1/AAL2 derived from trusted `acr`/`amr` claims only;
- exact `issuer + subject` membership lookup with active-status, tenant, campus and role isolation;
- explicit selection for multi-tenant and multi-campus identities;
- suspended, revoked, cross-tenant and cross-campus denial;
- signed `__Host-school_session` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, bounded lifetime and no profile/provider tokens;
- cookie-only session introspection and non-sensitive readiness reporting;
- Cloudflare readiness smoke proving login disabled and session verification fail-closed without approved configuration.

Verification evidence:

- repository tests: 534 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

'''
tracker = tracker.replace('## Live staging routes\n', auth_section + '## Live staging routes\n')
tracker = tracker.replace(
    '- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`\n',
    '- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`\n- OIDC readiness: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/readiness`\n- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`\n',
)
tracker = tracker.replace(
    '- PILOT-03 proof: `0a36ef62ec1622bdea6de7d0135bf30026845528`\n',
    '- PILOT-03 proof: `0a36ef62ec1622bdea6de7d0135bf30026845528`\n- AUTH-01 proof: `5d58706e119e34e72fee17d2a67be74428ad5ab3`\n',
)
tracker = tracker.replace(
    '- Repository tests: 514 passed; PILOT-03 adds signed-session, expiry and role-binding coverage without changing domain invariants.\n',
    '- Repository tests: 534 passed; AUTH-01 adds OIDC cryptographic, membership-isolation and secure-cookie coverage without changing domain invariants.\n',
)
tracker = tracker.replace(
    '- implement reviewed OAuth/OIDC Authorization Code with PKCE and issuer/JWKS validation;\n- resolve real user memberships, tenant/campus context and database-backed permissions;\n- adopt a reviewed same-origin BFF/HttpOnly production session design or approved equivalent;\n',
    '- implement Authorization Code + PKCE transaction issuance, callback and token exchange;\n- add approved discovery/JWKS retrieval, caching and key rotation;\n- configure a reviewed provider and database-backed membership adapter;\n- connect the verified membership context to database-backed permissions;\n',
)
tracker = tracker.replace(
    'PILOT-03 remains a synthetic staging identity bridge.',
    'PILOT-03 remains a synthetic staging identity bridge, while AUTH-01 provides provider-neutral contracts with login explicitly disabled.',
)
tracker_path.write_text(tracker, encoding='utf-8')

release_path = Path('docs/execution/08-final-system-release-evidence.md')
release = release_path.read_text(encoding='utf-8')
if '## Post-gate OIDC Trust Boundary Evidence' not in release:
    release += '''

## Post-gate OIDC Trust Boundary Evidence

AUTH-01 establishes a provider-neutral authentication trust boundary without enabling real login.

- Reviewed base: `26e6f5b034dd62f0486f20d7f24194551b642191`.
- Implementation proof: `5d58706e119e34e72fee17d2a67be74428ad5ab3`.
- Root CI: `30515626535` passed all 21 gates with 534 repository tests, 40 migrations, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare deploy/smoke: `30515626541` passed readiness, fail-closed session, pilot bearer, persona, PWA and health checks.
- The ID-token verifier permits RS256 only and validates issuer, audience/`azp`, nonce, signing key, signature and timestamps.
- Membership resolution uses exact provider issuer+subject and denies inactive, cross-tenant and cross-campus context.
- The browser-session contract uses a signed `__Host-school_session` cookie with `HttpOnly`, `Secure` and `SameSite=Lax` attributes.
- The staged readiness endpoint reports `loginEnabled: false`; no provider credential, membership source or production session key is deployed.

`GATE-OIDC-TRUST-BOUNDARY-V1` passes. Authorization Code + PKCE transactions, callback and token exchange, approved discovery/JWKS retrieval and rotation, a real provider, database-backed memberships and permissions, revocation, step-up, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain blocked.
'''
release_path.write_text(release, encoding='utf-8')

board_path = Path('docs/execution/03-agent-board.json')
board = json.loads(board_path.read_text(encoding='utf-8'))
board['updated_at'] = '2026-07-30'
board['program_status'] = 'oidc_trust_boundary_verified'
board['auth_oidc_trust'] = {
    'id': 'AUTH-01',
    'status': 'gate_passed_login_disabled',
    'gate': 'GATE-OIDC-TRUST-BOUNDARY-V1',
    'branch': 'pilot/oidc-trust-boundary-v1',
    'reviewed_base_sha': '26e6f5b034dd62f0486f20d7f24194551b642191',
    'implementation_proof_sha': '5d58706e119e34e72fee17d2a67be74428ad5ab3',
    'root_ci_run': '30515626535',
    'cloudflare_deploy_run': '30515626541',
    'repository_tests_passed': 534,
    'browser_journeys_passed': 22,
    'oidc_algorithm_allowlist': ['RS256'],
    'issuer_audience_azp_nonce_verified': True,
    'jwks_key_and_signature_verified': True,
    'token_time_bounds_verified': True,
    'assurance_from_trusted_claims_only': True,
    'membership_key': ['issuer', 'subject'],
    'inactive_membership_denied': True,
    'tenant_campus_selection_required_when_ambiguous': True,
    'cross_tenant_and_cross_campus_denied': True,
    'browser_cookie_name': '__Host-school_session',
    'browser_cookie_controls': ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'],
    'profile_or_provider_tokens_in_session': False,
    'readiness_route': '/auth/v1/readiness',
    'session_route': '/auth/v1/session',
    'login_enabled': False,
    'real_provider_configured': False,
    'real_membership_source_configured': False,
    'production_identity_enabled': False,
    'production_mutations_enabled': False,
    'remaining_release_gate': 'Authorization Code with PKCE transaction and callback, token exchange, approved discovery/JWKS retrieval and rotation, reviewed provider credentials, database-backed memberships and policy, revocation and logout propagation, step-up initiation, monitoring, rollback, owner-led UAT and explicit production authorization',
}
board_path.write_text(json.dumps(board, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
