# PILOT-05 — Safe Database Mutation Release Evidence

**Gate:** `GATE-PILOT-SAFE-MUTATION-V1`  
**Result:** passed  
**Implementation head:** `2ff251c17d2b4d939a6f274402da99e6447707fd`  
**Main merge:** `9f32a588d7b61d4ef8b1ac38dc4807fa329212de`

## Test-first evidence

The valid behavioral red gate ran after formatting passed and failed because the mutation store and HTTP boundary did not yet exist. The subsequent implementation preserved the test contracts and verified:

- exact request shape and byte-bounded streaming;
- invalid media type, origin, idempotency key and browser-supplied scope denial before authentication;
- typed durable store responses only;
- same-request replay and different-request conflict;
- AAL2, permission, session, projection and revision decisions;
- sanitized database and authentication outages;
- no browser-selected tenancy or authorization scope.

## Canonical verification

Canonical CI run `30608179482` passed on the final reviewed head.

- format check: passed;
- lint: passed;
- architecture boundaries: passed;
- TypeScript: passed;
- ordinary unit/integration suite: 122 files passed and one environment-dependent Neon file skipped;
- ordinary tests: 640 passed and one environment-dependent test skipped;
- live Neon direct-driver gate: passed separately;
- canonical Wave 2 migrations: passed;
- post-integration migrations and negative probes: passed;
- Worker and web builds: passed;
- experience budget: passed;
- high-severity dependency audit: zero vulnerabilities;
- licence and provenance checks: passed;
- tracked artifact drift: none;
- browser journeys: passed;
- execution-artifact validation: passed.

## Database evidence

The immutable canonical migration manifest remains at 40 migrations. The reviewed post-integration manifest now contains AUTH-03, AUTH-07, AUTH-08, PILOT-04 and PILOT-05 in contiguous order, producing 45 verified schema-migration ledger entries on fresh PostgreSQL.

Positive and negative probes verified:

- first AAL2/current-grant/current-revision submission is accepted;
- same key and same request replays the original receipt;
- same key and different request returns an idempotency conflict;
- stale projection revision returns a conflict without accepting a command;
- an AAL1 session requires fresh AAL2;
- current permission removal denies a subsequent command;
- direct receipt-table access is denied to `app_runtime`;
- exactly one command receipt is persisted;
- exactly one audit event is persisted;
- exactly one transactional outbox event is persisted;
- account-wide revocation includes the PILOT-05 test session;
- post-integration replay and migration ownership rules remain intact.

## Concurrency and security review

Final security review identified and fixed a concurrent authorization race before merge. The initial lock mode did not prevent all session revocation or membership-binding status updates while the mutation was being accepted.

The merged function now:

1. locks the browser session, membership binding and account with `FOR UPDATE`;
2. locks the current role rows;
3. rechecks the exact signed-session role array;
4. locks the required permission grant;
5. evaluates current permission and AAL2 assurance;
6. revalidates idempotency;
7. locks the exact projection revision;
8. persists receipt, audit and outbox atomically.

This ordering prevents a command from being accepted through a concurrent revoke, disable, binding-status, role or grant change.

## HTTP evidence

The final HTTP tests verified:

- exact-origin credentialed preflight;
- only `content-type` and `idempotency-key` are allowed;
- signed-session and durable-registry authentication;
- 4 KiB streaming byte limit, including chunked requests;
- strict JSON body with no injected scope;
- `202` durable receipt and request correlation header;
- sanitized permission, step-up, projection, revision, idempotency and availability failures;
- `Cache-Control: no-store` and no authentication cookie.

## Cloudflare staging evidence

Cloudflare deployment and live smoke run `30608179484` passed.

With production database/mutation bindings intentionally absent, the deployed mutation route returned:

- HTTP `503`;
- error code `runtime_mutation_configuration_invalid`;
- `Cache-Control: no-store`;
- no `Set-Cookie`;
- no unintended `Access-Control-Allow-Origin` header.

The staging workflow also verified the complete readiness control list and all prior auth, database-read, signed-pilot, PWA and web-role smoke checks.

A transient staging false failure was corrected by retrying synthetic session issuance and signed snapshot verification as one pair during rolling Worker deployments. Mutation assertions were not weakened.

## Review state

PR #60 was mergeable, contained no unresolved review threads and had no submitted reviews. It was squash merged only after canonical CI and live Cloudflare staging both passed on the exact final head.

## Production boundary

No real identity-provider credential, production tenant/student data, production projection population, production mutation consumer, production database binding, public login, production domain binding or production promotion was introduced. Production activation still requires reviewed credentials and bindings, a projection rebuild consumer, outbox monitoring and replay controls, recovery rehearsal, owner UAT/security sign-off and explicit deployment authorization.
