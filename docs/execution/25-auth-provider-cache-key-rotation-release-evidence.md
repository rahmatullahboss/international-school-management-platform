# AUTH-05 OIDC Provider Cache and Signing-Key Rotation Release Evidence

## Candidate lineage

- Reviewed base: `146589b2abc400fbfda5e8952ede55252f4c13c9`
- Branch: `pilot/oidc-key-rotation-v1`
- Pull request: `#50`
- Implementation proof: `d8e60bc045265799d6ecf63da6a75e22c9287459`
- Main merge: `73f2fef7dbec098d8fa9ab045f2d1750afbeab81`

## TDD hardening evidence

The bounded-cache integrity change used an explicit red-green gate:

- a durable discovery record with a freshness interval above the reviewed maximum was accepted before the fix;
- a future-dated durable JWKS record was accepted before the fix;
- both regression tests were run and proved failing before implementation;
- timestamp validation was then applied;
- both regressions and the complete repository suite passed afterward.

The same cycle also exposed and corrected a response-fixture defect where `ResponseInit.headers` replaced the mandatory JSON content type.

## Root verification

Root CI run `30574007099` passed on exact head `d8e60bc045265799d6ecf63da6a75e22c9287459`:

- clean dependency installation;
- formatting and lint;
- architecture-boundary checks;
- TypeScript project references;
- 115 repository test files passed;
- 584 tests passed, with one environment-dependent direct-Neon test skipped in the ordinary suite;
- all 40 canonical migrations replayed on fresh PostgreSQL;
- the AUTH post-integration migration and revocation probes passed;
- the direct-Neon test passed separately against the configured live Neon branch;
- Worker and web production builds;
- initial and total experience asset budgets;
- high-severity dependency audit and licence policy;
- provenance generation without tracked drift;
- all platform, SIS, finance, integrations, student-support and experience Chromium browser suites;
- execution-artifact validation.

## Unit and policy evidence

Executable tests prove:

- discovery metadata is cached and conditionally revalidated with an ETag;
- exact HTTPS provider origins are required and unpinned endpoints are denied;
- previously reviewed provider endpoint changes are denied;
- concurrent discovery misses share one network request;
- removed signing keys remain available only for a bounded overlap;
- expired retired keys are removed;
- a reused `kid` with different key material is denied;
- stale approved keys are used only for bounded network/provider failure;
- malformed or scope-poisoned cache entries fail closed;
- cache freshness above the maximum is rejected;
- future-dated cache records are rejected;
- an unknown token key id triggers exactly one forced refresh;
- an invalid signature for a known key does not trigger refresh;
- provider cache failures are mapped to sanitized browser-facing errors;
- provider tokens remain withheld from browser-facing results.

## Cloudflare evidence

Cloudflare staging run `30574006810` passed:

- repository verification;
- API and web Worker deployment;
- readiness controls for conditional discovery revalidation, bounded JWKS caching, bounded stale-if-error, single unknown-key refresh, retired-key overlap, key-id reuse denial, endpoint-origin pins and endpoint-change review;
- exact generic `provider-endpoint-origins` and `provider-cache-source` missing categories;
- `loginEnabled: false`;
- fail-closed browser session introspection and logout while provider, cache, database and browser-origin configuration remain unavailable;
- existing signed pilot session and scoped snapshot flow;
- all role routes, PWA manifest, offline page and API health.

No provider endpoint, cache identifier, credential, database URL, secret or real identity appears in readiness or error responses.

## Performance evidence

- Initial JavaScript remained within the 250,000-byte limit.
- Initial CSS remained within the 50,000-byte limit.
- Total route JavaScript remained within the 350,000-byte limit.
- Total route CSS remained within the 85,000-byte limit.
- Violations: none.

## Gate outcome

`GATE-AUTH-PROVIDER-CACHE-ROTATION-V1` passes for fail-closed OIDC discovery caching, signing-key rotation, durable-cache timestamp bounds and provider endpoint-origin governance.

A reviewed real provider, production cache and database bindings, database-backed authorization evaluation, provider logout/back-channel revocation, refresh-token governance, step-up initiation, monitoring, recovery rehearsal, owner-led UAT and explicit production authorization remain required.
