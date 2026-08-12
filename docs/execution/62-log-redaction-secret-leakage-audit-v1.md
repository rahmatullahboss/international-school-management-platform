# Runtime Log Redaction and Secret Leakage Audit v1

**Program:** `international-school-platform-v1`  
**Status:** implementation in progress; production activation is not authorized

## Objective

Make the production API fail closed when an unexpected exception contains request secrets, credential material or attacker-controlled values, and prevent future runtime code from introducing unreviewed raw logging paths.

The current production API does not intentionally emit request/env/error objects to a logger. This work therefore does not add a new logger. It adds an explicit unhandled-error response boundary plus a repository-level negative audit that preserves the current no-raw-logging posture.

## Runtime response boundary

Unexpected exceptions must produce a stable provider-neutral HTTP 500 response:

- fixed `internal_error` code;
- fixed non-sensitive message;
- `cache-control: no-store`;
- no exception message, stack, cause, request URL query values, Authorization header, Cookie header, database URL, OIDC secret or environment object;
- the existing correlation-id response header remains available for operational correlation.

Expected domain/auth errors continue to use their reviewed stable error codes and messages.

## Synthetic leakage test

An integration test will use only synthetic sentinel strings. It will:

1. issue a valid test browser session;
2. send synthetic Cookie/Authorization/query secret sentinels;
3. make the mocked database dependency throw an exception containing separate synthetic password/token/database-URL sentinels;
4. require HTTP 500 with the stable internal error body and `no-store`;
5. serialize the full response body and assert that none of the synthetic sentinels or raw exception text appear.

No real production secret is read or used.

## Static runtime audit

A Node-based CI validator scans non-test TypeScript under `apps/platform-api/src` and fails on unreviewed high-risk output patterns, including:

- direct `console.log`, `console.error`, `console.warn`, `console.info` or `console.debug` calls;
- direct serialization of `context.env`, generic `environment`, `request`, or `context.req` objects with `JSON.stringify`;
- direct response/log construction from an exception `.message`, `.stack` or `.cause` outside the reviewed global error-boundary module.

The validator has adversarial self-tests for each rule class. There is no convenience allowlist for application runtime files. If structured operational logging is added later, it must use a separately reviewed redacting logger and update this contract deliberately.

## Scope

This repository gate covers accidental secret disclosure from application-controlled runtime responses and direct application logging code. It does not claim control over infrastructure-provider access logs, external observability products, database-provider logs or deployed Cloudflare account settings.

## Production boundary

A green repository audit is necessary but not sufficient for production authorization. Deployed log/trace redaction verification, real IdP/credential review, external security testing as required, incident-response acceptance, owner UAT and explicit owner/security authorization remain external gates.
