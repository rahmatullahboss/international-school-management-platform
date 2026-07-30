#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

PROOF = "ea9093af5e2707edf45fde73a19af371d01cb8ac"
ROOT_CI = "30533390869"
CLOUDFLARE = "30533390917"


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing expected fragment in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


replace(
    "docs/execution/README.md",
    "**Status:** Durable identity context and revocable session contracts verified; real login and production promotion gated",
    "**Status:** Origin-checked browser logout and durable session termination verified; real login and production promotion gated",
)
replace(
    "docs/execution/README.md",
    "21. [AUTH-03 durable identity context](20-auth-durable-context-v1.md)\n22. [AUTH-03 release evidence](21-auth-durable-context-release-evidence.md)\n23. Validation script: `scripts/validate_execution_artifacts.py`",
    "21. [AUTH-03 durable identity context](20-auth-durable-context-v1.md)\n22. [AUTH-03 release evidence](21-auth-durable-context-release-evidence.md)\n23. [AUTH-04 browser session termination](22-auth-session-termination-v1.md)\n24. [AUTH-04 release evidence](23-auth-session-termination-release-evidence.md)\n25. Validation script: `scripts/validate_execution_artifacts.py`",
)
replace(
    "docs/execution/README.md",
    "- `AUTH-03` — Adds a durable OAuth replay ledger, database-owned identity membership projection, mandatory browser-session registration and session revocation while real provider routes remain disabled.\n",
    "- `AUTH-03` — Adds a durable OAuth replay ledger, database-owned identity membership projection, mandatory browser-session registration and session revocation while real provider routes remain disabled.\n- `AUTH-04` — Adds exact-origin JSON browser logout, current-session and account-wide registry revocation and secure host-cookie deletion while real provider routes remain disabled.\n",
)

tracker = "docs/execution/04-progress-tracker.md"
replace(
    tracker,
    "**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1` and `GATE-AUTH-DURABLE-CONTEXT-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, a durable replay ledger, database membership projection and revocable browser-session contracts, while real provider routes, production identity and mutations remain disabled.",
    "**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1`, `GATE-AUTH-DURABLE-CONTEXT-V1` and `GATE-AUTH-SESSION-TERMINATION-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, durable identity state and exact-origin current/account-wide browser logout, while real provider routes, production identity and mutations remain disabled.",
)
replace(
    tracker,
    "and durable identity context in [20-auth-durable-context-v1.md](20-auth-durable-context-v1.md) and [21-auth-durable-context-release-evidence.md](21-auth-durable-context-release-evidence.md).",
    "and durable identity context in [20-auth-durable-context-v1.md](20-auth-durable-context-v1.md) and [21-auth-durable-context-release-evidence.md](21-auth-durable-context-release-evidence.md), with browser session termination in [22-auth-session-termination-v1.md](22-auth-session-termination-v1.md) and [23-auth-session-termination-release-evidence.md](23-auth-session-termination-release-evidence.md).",
)
replace(
    tracker,
    "| `GATE-AUTH-DURABLE-CONTEXT-V1` | passed | Implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`; root CI `30530441477`; deploy/smoke `30530441742`; durable replay, membership projection, session registration and revocation verified |\n",
    "| `GATE-AUTH-DURABLE-CONTEXT-V1` | passed | Implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`; root CI `30530441477`; deploy/smoke `30530441742`; durable replay, membership projection, session registration and revocation verified |\n| `GATE-AUTH-SESSION-TERMINATION-V1` | passed | Implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; root CI `30533390869`; deploy/smoke `30533390917`; exact-origin current/account-wide logout and secure cookie deletion verified |\n",
)
replace(
    tracker,
    "| `AUTH-03` | post-integration | durable identity context and revocation gate passed; provider routes disabled | proof `9886f41d198772c684d3b245258964d4bcb0e83c`; CI `30530441477`; deploy `30530441742` |\n",
    "| `AUTH-03` | post-integration | durable identity context and revocation gate passed; provider routes disabled | proof `9886f41d198772c684d3b245258964d4bcb0e83c`; CI `30530441477`; deploy `30530441742` |\n| `AUTH-04` | post-integration | browser session termination gate passed; provider routes disabled | proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`; CI `30533390869`; deploy `30533390917` |\n",
)
auth04_closure = """
## AUTH-04 browser session termination gate closure

Completed and verified on implementation proof `ea9093af5e2707edf45fde73a19af371d01cb8ac`:

- exact HTTPS browser-origin allowlisting with no wildcard credentialed CORS;
- credentialed `OPTIONS` preflight only for an approved exact origin;
- JSON-only bounded logout requests with exact `current` or `all` scope;
- unknown fields and browser-supplied account identifiers rejected;
- signed-cookie and durable-registry activity verification before revocation;
- current-session revocation with secure host-cookie deletion;
- account-wide revocation using only the signed server-owned principal id;
- origin, request-shape, cookie and registry failures remain fail-closed and sanitized;
- Cloudflare staging exposes the route but returns generic service unavailable while origins and real identity bindings are unconfigured.

Verification evidence:

- repository tests: 575 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical migrations plus one AUTH post-integration migration passed on fresh PostgreSQL;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

"""
replace(tracker, "## Live staging routes\n", auth04_closure + "## Live staging routes\n")
replace(
    tracker,
    "- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`\n",
    "- Browser session introspection: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/session`\n- Browser logout: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/logout` — currently fail-closed because real browser identity configuration is disabled\n",
)
replace(
    tracker,
    "- AUTH-03 proof: `9886f41d198772c684d3b245258964d4bcb0e83c`\n",
    "- AUTH-03 proof: `9886f41d198772c684d3b245258964d4bcb0e83c`\n- AUTH-04 proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`\n",
)
replace(
    tracker,
    "- Repository tests: 565 passed; AUTH-03 adds durable replay, database membership, session-registry and revocation coverage without changing domain invariants.",
    "- Repository tests: 575 passed; AUTH-04 adds exact-origin logout, strict request-shape, current-session and account-wide termination coverage without changing domain invariants.",
)
replace(
    tracker,
    "- expose reviewed logout routes and add provider revocation, step-up assurance and live negative authorization tests;",
    "- add provider logout/back-channel revocation, step-up assurance and live negative authorization tests;",
)
replace(
    tracker,
    "No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-03 provide provider-neutral verification, PKCE flow and durable identity-state contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.",
    "No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-04 provide provider-neutral verification, PKCE flow, durable identity state and browser session termination contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.",
)

final_evidence = Path("docs/execution/08-final-system-release-evidence.md")
final_text = final_evidence.read_text(encoding="utf-8")
if "## Post-gate Browser Session Termination Evidence" not in final_text:
    final_text += """

## Post-gate Browser Session Termination Evidence

AUTH-04 adds a reviewed browser logout endpoint without enabling a real provider or production identity configuration.

- Reviewed base: `958b81a786b55286d0c41085d6258be17796ccd1`.
- Implementation proof: `ea9093af5e2707edf45fde73a19af371d01cb8ac`.
- Root CI `30533390869` passed with 575 repository tests, canonical and post-integration migrations, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare `30533390917` passed exact-origin logout readiness, unconfigured logout denial, existing pilot bearer, persona, PWA and health smoke tests.
- Logout requires an exact configured HTTPS origin and `application/json`; wildcard credentialed CORS is forbidden.
- Current-session revocation checks the signed cookie and durable registry before deleting the host cookie.
- Account-wide revocation derives the account id from the signed session and accepts no browser account identifier.
- Invalid origins, malformed bodies, missing cookies, revoked sessions and database failures remain fail-closed and sanitized.
- Staging continues to report `loginEnabled: false` and has no approved origin, provider, production session key or real identity database binding.

`GATE-AUTH-SESSION-TERMINATION-V1` passes. Provider logout/back-channel revocation, refresh-token governance, reviewed provider activation, production origins/secrets, step-up, monitoring, recovery rehearsal, UAT and production authorization remain blocked.
"""
final_evidence.write_text(final_text, encoding="utf-8")

board_path = Path("docs/execution/03-agent-board.json")
board = json.loads(board_path.read_text(encoding="utf-8"))
board["program_status"] = "auth_session_termination_verified_login_disabled"
board["auth_session_termination"] = {
    "id": "AUTH-04",
    "status": "gate_passed_provider_routes_disabled",
    "gate": "GATE-AUTH-SESSION-TERMINATION-V1",
    "branch": "pilot/auth-session-termination-v1",
    "reviewed_base_sha": "958b81a786b55286d0c41085d6258be17796ccd1",
    "implementation_proof_sha": PROOF,
    "root_ci_run": ROOT_CI,
    "cloudflare_deploy_run": CLOUDFLARE,
    "repository_tests_passed": 575,
    "browser_journeys_passed": 22,
    "exact_https_origin_allowlist": True,
    "credentialed_wildcard_cors": False,
    "json_only_logout": True,
    "strict_bounded_request_shape": True,
    "current_session_revocation": True,
    "account_wide_revocation": True,
    "browser_account_id_accepted": False,
    "active_registry_check_required": True,
    "secure_host_cookie_deletion": True,
    "logout_endpoint_deployed": True,
    "logout_enabled_in_staging": False,
    "login_enabled": False,
    "real_provider_configured": False,
    "production_web_origins_configured": False,
    "production_database_binding_configured": False,
    "production_identity_enabled": False,
    "production_mutations_enabled": False,
    "remaining_release_gate": "reviewed provider activation and production origins/secrets, provider logout and back-channel revocation, refresh-token governance, permission evaluation, step-up, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization",
}
board_path.write_text(json.dumps(board, indent=2) + "\n", encoding="utf-8")
