#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

PROOF = "9886f41d198772c684d3b245258964d4bcb0e83c"
ROOT_CI = "30530441477"
CLOUDFLARE = "30530441742"


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing expected fragment in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


replace(
    "docs/execution/README.md",
    "**Status:** Authorization Code + PKCE contracts verified; durable identity adapters and real login gated",
    "**Status:** Durable identity context and revocable session contracts verified; real login and production promotion gated",
)
replace(
    "docs/execution/README.md",
    "19. [AUTH-02 Authorization Code + PKCE](18-oidc-pkce-flow-v1.md)\n20. [AUTH-02 release evidence](19-oidc-pkce-flow-release-evidence.md)\n21. Validation script: `scripts/validate_execution_artifacts.py`",
    "19. [AUTH-02 Authorization Code + PKCE](18-oidc-pkce-flow-v1.md)\n20. [AUTH-02 release evidence](19-oidc-pkce-flow-release-evidence.md)\n21. [AUTH-03 durable identity context](20-auth-durable-context-v1.md)\n22. [AUTH-03 release evidence](21-auth-durable-context-release-evidence.md)\n23. Validation script: `scripts/validate_execution_artifacts.py`",
)
replace(
    "docs/execution/README.md",
    "- `AUTH-02` — Verifies browser-bound Authorization Code + PKCE transactions, provider discovery, bounded JWKS retrieval, confidential code exchange, replay protection and secure login orchestration while real provider routes remain disabled.\n",
    "- `AUTH-02` — Verifies browser-bound Authorization Code + PKCE transactions, provider discovery, bounded JWKS retrieval, confidential code exchange, replay protection and secure login orchestration while real provider routes remain disabled.\n- `AUTH-03` — Adds a durable OAuth replay ledger, database-owned identity membership projection, mandatory browser-session registration and session revocation while real provider routes remain disabled.\n",
)

tracker = "docs/execution/04-progress-tracker.md"
replace(
    tracker,
    "**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1` and `GATE-OIDC-PKCE-FLOW-V1` have passed. The non-production Cloudflare pilot now includes strict provider-neutral OIDC verification, server-owned membership selection and secure browser-session and Authorization Code + PKCE contracts, while durable identity adapters, real login, production identity and mutations remain disabled.",
    "**Current repository state:** All domain module streams are complete and integrated. `GATE-PILOT-READY`, `GATE-CLOUDFLARE-STAGING`, `GATE-PILOT-RUNTIME-COMPOSED`, `GATE-UX-CONTINUITY-V1`, `GATE-PILOT-READ-API-V1`, `GATE-PILOT-SIGNED-SESSION-V1`, `GATE-OIDC-TRUST-BOUNDARY-V1`, `GATE-OIDC-PKCE-FLOW-V1` and `GATE-AUTH-DURABLE-CONTEXT-V1` have passed. The non-production Cloudflare pilot now includes strict OIDC verification, Authorization Code + PKCE contracts, a durable replay ledger, database membership projection and revocable browser-session contracts, while real provider routes, production identity and mutations remain disabled.",
)
replace(
    tracker,
    "with the PKCE flow in [18-oidc-pkce-flow-v1.md](18-oidc-pkce-flow-v1.md) and [19-oidc-pkce-flow-release-evidence.md](19-oidc-pkce-flow-release-evidence.md).",
    "with the PKCE flow in [18-oidc-pkce-flow-v1.md](18-oidc-pkce-flow-v1.md) and [19-oidc-pkce-flow-release-evidence.md](19-oidc-pkce-flow-release-evidence.md), and durable identity context in [20-auth-durable-context-v1.md](20-auth-durable-context-v1.md) and [21-auth-durable-context-release-evidence.md](21-auth-durable-context-release-evidence.md).",
)
replace(
    tracker,
    "| `GATE-OIDC-PKCE-FLOW-V1` | passed | Implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; root CI `30517446940`; deploy/smoke `30517446956`; S256 transaction, discovery, replay, confidential exchange and token-withholding boundaries verified |\n",
    "| `GATE-OIDC-PKCE-FLOW-V1` | passed | Implementation proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; root CI `30517446940`; deploy/smoke `30517446956`; S256 transaction, discovery, replay, confidential exchange and token-withholding boundaries verified |\n| `GATE-AUTH-DURABLE-CONTEXT-V1` | passed | Implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`; root CI `30530441477`; deploy/smoke `30530441742`; durable replay, membership projection, session registration and revocation verified |\n",
)
replace(
    tracker,
    "| `AUTH-02` | post-integration | Authorization Code + PKCE contract passed; provider routes disabled | proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; CI `30517446940`; deploy `30517446956` |\n",
    "| `AUTH-02` | post-integration | Authorization Code + PKCE contract passed; provider routes disabled | proof `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`; CI `30517446940`; deploy `30517446956` |\n| `AUTH-03` | post-integration | durable identity context and revocation gate passed; provider routes disabled | proof `9886f41d198772c684d3b245258964d4bcb0e83c`; CI `30530441477`; deploy `30530441742` |\n",
)
auth03_closure = """
## AUTH-03 durable identity context gate closure

Completed and verified on implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`:

- the canonical 40-migration manifest remains frozen and AUTH-03 is applied through a separate post-integration manifest;
- atomic OAuth transaction consumption denies replay, expiry and invalid lifetimes;
- exact issuer-and-subject membership projection resolves active account, tenant, campus and role context;
- `app_runtime` has function-only access and no direct durable-auth table privileges;
- a browser session is registered durably before its secure cookie is returned;
- signed-cookie introspection requires an active registry record;
- explicit session revocation, account-wide revocation, membership changes and role changes invalidate sessions;
- replay, membership and registry outages fail closed with sanitized errors;
- Cloudflare readiness exposes generic durable-control categories while `loginEnabled` remains false.

Verification evidence:

- repository tests: 565 passed, with one environment-dependent direct-Neon test skipped in the ordinary suite and passed separately against live Neon;
- migrations: 40 canonical migrations plus one AUTH-03 post-integration migration passed on fresh PostgreSQL;
- browser journeys: 22 passed;
- initial JavaScript: 208,406 bytes against a 250,000-byte limit;
- initial CSS: 15,022 bytes against a 50,000-byte limit;
- total route JavaScript: 299,838 bytes against a 350,000-byte limit;
- total route CSS: 73,158 bytes against an 85,000-byte limit;
- no build-budget violation.

"""
replace(tracker, "## Live staging routes\n", auth03_closure + "## Live staging routes\n")
replace(
    tracker,
    "- AUTH-02 proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`\n",
    "- AUTH-02 proof: `fffd269a7f840f9f90cdca4c4268e46bec7f2a8e`\n- AUTH-03 proof: `9886f41d198772c684d3b245258964d4bcb0e83c`\n",
)
replace(
    tracker,
    "- Repository tests: 557 passed; AUTH-02 adds PKCE transaction, provider-discovery, replay, code-exchange and complete login-orchestration coverage without changing domain invariants.",
    "- Repository tests: 565 passed; AUTH-03 adds durable replay, database membership, session-registry and revocation coverage without changing domain invariants.",
)
replace(
    tracker,
    "- Canonical migration manifest: 40 migrations.\n",
    "- Canonical migration manifest: 40 immutable migrations.\n- Post-integration AUTH manifest: one migration; 41 total ledger entries verified.\n",
)
replace(
    tracker,
    "- add a durable atomic OAuth transaction replay ledger;\n- add approved discovery/JWKS caching and key-rotation governance;\n- configure a reviewed provider and database-backed membership adapter;\n- connect the verified membership context to database-backed permissions;\n- add logout, revocation, step-up assurance and negative authorization tests;\n",
    "- add approved discovery/JWKS caching and key-rotation governance;\n- configure a reviewed provider and production database binding;\n- connect the verified membership context to database-backed permission evaluation;\n- expose reviewed logout routes and add provider revocation, step-up assurance and live negative authorization tests;\n",
)
replace(
    tracker,
    "No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 and AUTH-02 provide provider-neutral verification and PKCE flow contracts with real login explicitly disabled. Production promotion requires all remaining identity, policy, data, monitoring, recovery and owner-authorization gates.",
    "No production deployment, real account, real tenant/student data, production database mutation, production cache purge or destructive cleanup was introduced. PILOT-03 remains a synthetic staging identity bridge. AUTH-01 through AUTH-03 provide provider-neutral verification, PKCE flow and durable identity-state contracts with real login explicitly disabled. Production promotion requires all remaining provider, policy, data, monitoring, recovery and owner-authorization gates.",
)

final_evidence = Path("docs/execution/08-final-system-release-evidence.md")
final_text = final_evidence.read_text(encoding="utf-8")
if "## Post-gate Durable Identity Context Evidence" not in final_text:
    final_text += """

## Post-gate Durable Identity Context Evidence

AUTH-03 adds durable server-owned identity context without enabling a real provider or public login route.

- Reviewed base: `84b637f6b5080476b2a015cf938fe8d2c60d1e3f`.
- Implementation proof: `9886f41d198772c684d3b245258964d4bcb0e83c`.
- Root CI `30530441477` passed the canonical gates with 565 repository tests, 40 canonical migrations, one AUTH-03 post-integration migration, live Neon, builds, budgets, 22 browser journeys and artifact validation.
- Cloudflare `30530441742` passed durable-control readiness, fail-closed browser-session verification, pilot bearer, persona, PWA and health smoke tests.
- OAuth replay consumption is atomic and durable.
- Exact provider issuer+subject resolves a database-owned account, membership, tenant, campus and role projection.
- `app_runtime` has no direct durable-auth table access and uses only reviewed security-definer functions.
- Browser sessions are registered before cookies are released and are checked against the registry during introspection.
- Explicit revocation, account-wide logout, membership suspension and role removal invalidate signed sessions.
- The staged readiness endpoint reports `loginEnabled: false`; no provider credential, production database binding or session key is deployed.

`GATE-AUTH-DURABLE-CONTEXT-V1` passes. Reviewed provider configuration, public login/callback routing, production secrets, JWKS rotation, permission evaluation, provider logout/revocation, refresh-token governance, step-up, monitoring, recovery rehearsal, UAT and production authorization remain blocked.
"""
final_evidence.write_text(final_text, encoding="utf-8")

board_path = Path("docs/execution/03-agent-board.json")
board = json.loads(board_path.read_text(encoding="utf-8"))
board["program_status"] = "auth_durable_context_verified_login_disabled"
board["database_baseline"]["post_integration_manifest"] = (
    "infra/database/post-integration-migration-manifest.json"
)
board["database_baseline"]["post_integration_auth_migration_count"] = 1
board["database_baseline"]["total_verified_migration_count"] = 41
board["auth_durable_context"] = {
    "id": "AUTH-03",
    "status": "gate_passed_provider_routes_disabled",
    "gate": "GATE-AUTH-DURABLE-CONTEXT-V1",
    "branch": "pilot/auth-durable-context-v1",
    "reviewed_base_sha": "84b637f6b5080476b2a015cf938fe8d2c60d1e3f",
    "implementation_proof_sha": PROOF,
    "root_ci_run": ROOT_CI,
    "cloudflare_deploy_run": CLOUDFLARE,
    "repository_tests_passed": 565,
    "browser_journeys_passed": 22,
    "canonical_migrations_verified": 40,
    "post_integration_migrations_verified": 1,
    "oauth_replay_ledger_durable": True,
    "database_membership_projection": True,
    "direct_runtime_table_access": False,
    "security_definer_function_access": True,
    "session_registration_required_before_cookie": True,
    "session_registry_checked_on_introspection": True,
    "single_session_revocation": True,
    "account_wide_revocation": True,
    "role_or_membership_change_invalidates_session": True,
    "login_enabled": False,
    "real_provider_configured": False,
    "production_database_binding_configured": False,
    "production_identity_enabled": False,
    "production_mutations_enabled": False,
    "remaining_release_gate": "reviewed provider and public routes, production secret/database bindings, JWKS rotation, database-backed permission evaluation, provider logout and refresh-token governance, step-up, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization",
}
board_path.write_text(json.dumps(board, indent=2) + "\n", encoding="utf-8")
