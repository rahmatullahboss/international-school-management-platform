# AUTH-06 Fresh Step-Up Assurance Release Evidence

## Candidate lineage

- Reviewed base: `a333eca824985e624a0fd87bc0127dea6ad8253f`
- Branch: `auth/provider-backchannel-stepup-v1`
- Pull request: `#52`
- Implementation proof: `17b53865900c3606bf5781a9ed0cf0b856262782`
- Main merge: `12881a80c6776020c8e26ca70ffb4af5c6b42b39`

## TDD evidence

The authoring workflow added the fresh-AAL2 and stale/AAL1 regression tests before production implementation. The red gate required the focused tests to fail and required both new test names to appear in the failing output before the implementation step could run.

The implementation was then applied, formatted and verified through the complete repository gate.

## Root verification

Canonical CI run `30578058983` passed:

- clean dependency installation;
- formatting and lint;
- architecture-boundary checks;
- TypeScript project references;
- 115 test files passed;
- 588 tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all canonical migrations replayed on fresh PostgreSQL;
- the AUTH post-integration migration and revocation probes passed;
- the direct-Neon test passed separately against the configured live branch;
- Worker and web production builds;
- initial and total experience asset budgets;
- high-severity dependency audit and licence policy;
- provenance generation without tracked drift;
- all Chromium browser journeys;
- execution-artifact validation.

## Executable assurance evidence

Tests prove:

- a signed step-up transaction emits `prompt=login` and `max_age=0`;
- reviewed ACR values are emitted only after count, length, whitespace and control-character validation;
- zero, negative and greater-than-five-minute freshness values are denied;
- signed transaction parsing rejects malformed step-up combinations;
- a verified AAL2 token with recent `auth_time` can continue to membership and session issuance;
- AAL1 proof is denied even when recent;
- missing or stale `auth_time` is denied;
- future `auth_time` is denied by the common ID-token verifier;
- a failed step-up does not issue a browser session;
- normal non-step-up OIDC behavior remains unchanged.

## Cloudflare evidence

Cloudflare staging run `30578058937` passed:

- repository verification;
- API and web Worker deployment;
- readiness controls for forced reauthentication, bounded fresh authentication and reviewed ACR values;
- `loginEnabled: false`;
- fail-closed browser session and logout routes without real provider and durable production configuration;
- existing signed pilot session and scoped snapshot flow;
- all role routes, PWA manifest, offline page and API health.

No real provider login, callback or step-up request was initiated.

## Security review

The final diff was reviewed for:

- browser tampering of requested assurance and freshness;
- ACR query injection;
- future, stale and missing authentication time;
- AAL1 downgrade;
- replay and nonce bypass;
- accidental provider-token disclosure;
- readiness information leakage.

No critical or important introduced security regression remained at the verified final head.

## Gate outcome

`GATE-AUTH-FRESH-STEP-UP-V1` passes for signed step-up intent, forced provider reauthentication, bounded fresh AAL2 proof and sanitized fail-closed callback enforcement.

A reviewed real provider, production bindings, provider logout/back-channel revocation, database-backed permission evaluation, database-backed read models, safe mutation tooling, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain required.
