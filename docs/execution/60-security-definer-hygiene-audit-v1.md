# System-wide SECURITY DEFINER Hygiene Audit v1

**Program:** `international-school-platform-v1`  
**Status:** implementation in progress; production activation is not authorized

## Objective

Add one generic fail-closed database gate for every application-owned PostgreSQL `SECURITY DEFINER` function. Existing integration tests validate many individual role/function boundaries, but a newly added privileged function could otherwise miss those hand-maintained allowlists.

The audit is system-wide across application schemas and is intentionally independent of individual domain modules.

## Required invariants

For every application `SECURITY DEFINER` function:

1. execution must not be granted to PostgreSQL `PUBLIC`;
2. an explicit function-level `search_path` must be present in `pg_proc.proconfig`;
3. the normalized explicit `search_path` must begin with `pg_catalog` so attacker-controlled application schemas cannot shadow built-in names before reviewed schemas;
4. the function must not live in the `public` schema;
5. the audit must inspect the current built database catalog rather than infer safety only from migration text.

The audit does not replace existing per-capability role tests. A function can pass this generic hygiene gate and still fail a narrower role-separation test.

## Scope

Application schemas are every non-system schema except:

- `pg_catalog`;
- `information_schema`;
- `pg_toast` and temporary/toast-temporary schemas;
- extension-owned `public` objects, which are excluded by prohibiting application `SECURITY DEFINER` functions in `public` rather than auditing unrelated extension functions as application code.

The CI database is already built through the current canonical/post-integration, production runtime and `PROD-06`/`PROD-07` recovery chain before this audit runs.

## Failure evidence

The verifier emits a bounded list of violating function identities and one of these reason classes:

- `public-execute`;
- `missing-search-path`;
- `unsafe-search-path`;
- `public-schema-security-definer`.

Any violation blocks CI. The correct remediation is to harden the owning migration/function definition and add explicit revocation/search-path configuration; the audit will not introduce an allowlist for convenience.

## Production boundary

This repository audit is security-hardening evidence only. It does not replace deployed security review, external penetration testing, real IdP/credential review, log/redaction verification or explicit owner/security production authorization.
