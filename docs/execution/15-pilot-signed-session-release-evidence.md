# PILOT-03 Signed Session Release Evidence

## Candidate

- Reviewed base: `f01cb446f8a6590e5800fba1f366e17a8eeedc2a`
- Branch: `pilot/signed-session-context-v1`
- Implementation proof: `0a36ef62ec1622bdea6de7d0135bf30026845528`
- Root CI: `30501350771`
- Cloudflare deploy/smoke: `30501350785`
- Gate: `GATE-PILOT-SIGNED-SESSION-V1`

## Identity-context evidence

The implementation proof establishes the following executable staging boundary:

- HMAC-SHA256 signed synthetic session tokens;
- 15-minute expiry;
- issuer and API audience validation;
- fixed pilot tenant and campus context;
- one bound role and subject per token;
- unique session identifiers;
- `Cache-Control: no-store` on issuance;
- rejection of missing, malformed, tampered, expired, wrong-secret and cross-role sessions;
- capabilities resolved by the Worker after verification;
- no browser-supplied tenant, campus, role or subject headers;
- bearer-session renewal once after `401`;
- current-view and last-safe-snapshot preservation during failure;
- generic production-runtime `404` for all synthetic pilot routes.

## Repository verification

Root CI `30501350771` passed all 21 canonical gates on implementation proof `0a36ef62ec1622bdea6de7d0135bf30026845528`:

- formatting, lint and architecture boundaries;
- TypeScript project references;
- 514 repository tests, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 migrations on fresh PostgreSQL;
- the direct-Neon test separately passed against live Neon;
- Worker and Vite builds;
- dependency audit, licence and provenance checks;
- all 22 browser journeys;
- execution-artifact validation.

Direct session-contract tests prove valid-role verification, exact 15-minute expiry, wrong-secret rejection and cross-role rejection.

## Performance evidence

- Initial JavaScript: 208,406 bytes / 250,000-byte limit
- Initial CSS: 15,022 bytes / 50,000-byte limit
- Total route JavaScript: 299,838 bytes / 350,000-byte limit
- Total route CSS: 73,158 bytes / 85,000-byte limit
- Violations: none

## Cloudflare staging evidence

Cloudflare run `30501350785` passed:

- repository verification;
- ephemeral 256-bit staging secret generation;
- secret injection through a protected temporary Wrangler secrets file;
- API Worker deployment;
- API-aware web build and web Worker deployment;
- signed admin-session issuance;
- bearer-authorized scoped snapshot retrieval;
- tenant, campus, role, subject and capability assertions;
- role chooser, admin, teacher, guardian and student routes;
- PWA manifest, offline page and API health smoke tests.

The secret file is created with restrictive permissions, removed by an exit trap and never committed or printed. Each deployment rotates the secret, invalidating prior synthetic sessions.

## Gate outcome

`GATE-PILOT-SIGNED-SESSION-V1` passes for the implementation proof. Final documentation and machine-board reconciliation require an exact-head CI and Cloudflare rerun before reviewed merge.

## Remaining production boundary

PILOT-03 is a synthetic staging identity bridge, not a production identity provider. Real release still requires reviewed OAuth/OIDC, issuer/JWKS validation, user and membership lifecycle, tenant/campus selection, database-backed authorization, safe browser session handling, logout/revocation, step-up assurance, negative authorization tests, monitoring, backup, rollback rehearsal, owner-led UAT and explicit production authorization.
