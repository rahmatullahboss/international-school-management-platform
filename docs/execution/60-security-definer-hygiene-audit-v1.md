# System-wide SECURITY DEFINER Hygiene Audit v1

**Program:** `international-school-platform-v1`  
**Status:** merged and verified; production activation is not authorized

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

## Scope and migration chain

Application schemas are every non-system schema except:

- `pg_catalog`;
- `information_schema`;
- `pg_toast` and temporary/toast-temporary schemas;
- extension-owned `public` objects, which are excluded by prohibiting application `SECURITY DEFINER` functions in `public` rather than auditing unrelated extension functions as application code.

The CI database is built through the canonical/post-integration, production runtime and `PROD-06`/`PROD-07` recovery chain before this audit runs. The security verifier then applies the forward-only `PROD-08` production-security migration from `infra/database/production-security-migration-manifest.json` and requires the exact 63-migration state before inspecting the catalog.

`PROD-08` exists as a separate forward hardening layer rather than rewriting historical canonical migrations. This keeps existing deployment history reviewable while giving existing databases an explicit upgrade path.

## Initial findings and remediation

The first catalog run found four real `unsafe-search-path` violations:

- `billing.allocate_document_number(uuid,text,text)`;
- `ledger.post_journal_entry(uuid,text)`;
- `ledger.close_period(uuid,text)`;
- `ledger.reopen_period(uuid,text,text)`.

Each function already used fully qualified application relation references, so the remediation did not change business behavior. `PROD-08` pins the function-level path to `pg_catalog` first, followed by the owning application schema and `pg_temp`, and explicitly revokes `PUBLIC` execute on all four functions. Existing reviewed role grants remain unchanged.

## Failure evidence

The verifier emits a bounded list of violating function identities and one of these reason classes:

- `public-execute`;
- `missing-search-path`;
- `unsafe-search-path`;
- `public-schema-security-definer`.

Any violation blocks CI. The verifier also creates one intentionally unsafe function for each reason class inside a transaction, proves all four are detected, rolls the transaction back and verifies that no self-test residue remains. The audit has no convenience allowlist.

## Verification evidence

- Initial catalog CI `31594220594` failed on the four real unsafe paths above.
- First remediated full CI `31595157916` passed after `PROD-08`.
- Final combined-state CI `31595704313` on head `4cdcded01ae0d02252b969b7081efec11641335b` passed the security gate, existing capability/role tests, database recovery rehearsal, Admissions lifecycle, secret-backed live Neon check, build, Cloudflare production dry-runs, audit/license/provenance checks, browser E2E and execution-artifact validation.
- PR #155 was squash-merged to `main` as `8b6be240a5a6888965e1e3c2016c8a30983db3ac`.

## Production boundary

This repository audit is security-hardening evidence only. It does not replace deployed security review, external penetration testing, real IdP/credential review, log/redaction verification or explicit owner/security production authorization.
