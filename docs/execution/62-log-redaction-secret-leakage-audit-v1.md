# Runtime Log Redaction and Secret Leakage Audit v1

**Program:** `international-school-platform-v1`  
**Status:** verified on branch; production activation is not authorized

## Objective

Make the production API fail closed when an unexpected exception contains request secrets, credential material or attacker-controlled values, and prevent future runtime code from introducing unreviewed raw logging paths.

The production API does not intentionally emit request, environment or exception-detail objects to logs. One existing scheduled projection observation did use a direct `console.log`, but its schema was aggregate-only and contained no request or credential material. This work preserves that useful operational telemetry while centralizing it behind one typed, structurally audited sink.

## Runtime response boundary

Unhandled exceptions produce a stable provider-neutral HTTP 500 response:

- fixed `internal_error` code;
- fixed non-sensitive message;
- `cache-control: no-store`;
- fresh correlation-id response header;
- no exception message, stack, cause, request URL query values, Authorization header, Cookie header, database URL, OIDC secret or environment object.

The global boundary deliberately does not inspect or log the exception object. Expected domain/auth/dependency errors continue to use their reviewed stable responses. In particular, existing production database credential failures remain fail-closed 503 responses rather than being rewritten as generic 500 errors.

## Synthetic leakage test

The integration test uses only synthetic sentinel strings. It directly exercises the core Hono error boundary by test-only mocking `parseRuntimeEnvironment` for `/health` to throw an Error containing synthetic exception, stack, database-URL, password and token sentinels. The request carries separate synthetic Cookie, Authorization and query-token sentinels.

The test requires:

1. HTTP 500;
2. the exact stable `internal_error` response body;
3. `cache-control: no-store`;
4. a correlation-id response header;
5. none of the request, environment, exception, database URL, password, token or session-secret sentinel values appearing in the serialized response.

No real production secret is read or used.

## Reviewed aggregate operational log sink

The first static runtime audit correctly found the pre-existing direct scheduled projection log in `runtime-projection-scheduled.ts`. Review confirmed that it emitted only:

- event name;
- success/failure boolean;
- success counters (`claimed`, `completed`, `retried`, `deadLettered`); or
- fixed failure `code`.

Instead of deleting operational visibility, the log is now routed through `runtime-operational-log.ts`. The sink accepts the typed `RuntimeProjectionBatchResolution`, constructs only the reviewed aggregate object and owns the single permitted runtime `console.log(JSON.stringify(observation))` call.

The validator treats that file as a structural contract, not a convenience allowlist. It fails if the sink:

- gains more or differently shaped console output;
- serializes the raw resolution object;
- reads exception message/stack/cause;
- spreads the raw resolution;
- references request/environment/authorization/cookie/password/secret/token/database-URL fields.

All other production API source files remain prohibited from direct console output.

## Static runtime audit

A Node-based CI validator scans non-test TypeScript under `apps/platform-api/src` and fails on unreviewed high-risk output patterns, including:

- direct `console.log`, `console.error`, `console.warn`, `console.info` or `console.debug` outside the exact reviewed operational sink;
- direct serialization of `context.env`, generic `environment`, `request`, or `context.req` objects with `JSON.stringify`;
- caught exception message/stack/cause or raw exception conversion/output patterns;
- structural or sensitive-field drift in the reviewed log sink.

Adversarial self-tests cover clean runtime source, the clean reviewed sink, direct console output, raw environment serialization, caught exception detail output and sensitive reviewed-sink drift.

## Verification evidence

Full trusted CI run `31600605694` on head `bb31232b036091047cb5919fb8a760526819cc49` passed:

- format, lint and architecture boundaries;
- runtime secret-boundary validator and adversarial self-tests;
- projection operations policy and production activation evidence validators;
- typecheck and the full test suite including the synthetic global 500 leakage test;
- canonical/auth/persona/production-runtime database gates;
- projection recovery and system-wide SECURITY DEFINER hygiene;
- broad backup/restore/rollback and PROD-08 restore preservation;
- Admissions lifecycle;
- secret-backed live Neon verification;
- build and Cloudflare production dry-runs;
- experience budget, npm audit, license and provenance checks;
- browser E2E and execution-artifact validation.

A final documentation-state full CI run is required before merge.

## Scope

This repository gate covers accidental secret disclosure from application-controlled runtime responses and direct application logging code. It does not claim control over infrastructure-provider access logs, external observability products, database-provider logs or deployed Cloudflare account settings.

## Production boundary

A green repository audit is necessary but not sufficient for production authorization. Deployed log/trace redaction verification, infrastructure-provider log policy review, real IdP/credential review, external security testing as required, incident-response acceptance, owner UAT and explicit owner/security authorization remain external gates.
