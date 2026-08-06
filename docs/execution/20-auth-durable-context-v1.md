# AUTH-03 — Durable Identity Context and Session Revocation

**Status:** `GATE-AUTH-DURABLE-CONTEXT-V1` passed on implementation proof `9886f41d198772c684d3b245258964d4bcb0e83c`  
**Date:** 2026-07-30  
**Reviewed base:** `84b637f6b5080476b2a015cf938fe8d2c60d1e3f`

## Purpose

AUTH-03 converts the provider-neutral login contracts from AUTH-01 and AUTH-02 into durable server-owned identity state. It adds a PostgreSQL replay ledger, an OIDC-to-membership projection and a revocable browser-session registry without enabling a real provider or public login route.

## Migration lineage

The historical Wave 2 manifest remains an immutable 40-migration set. AUTH-03 uses a separate post-integration manifest and migration directory:

- base manifest: `infra/database/migration-manifest.json`;
- post-integration manifest: `infra/database/post-integration-migration-manifest.json`;
- AUTH-03 migration: `infra/database/post-integration-migrations/202607300301_AUTH-03_durable_identity_context.sql`.

Fresh verification replays the canonical 40 migrations first and then applies AUTH-03 as the 41st migration-ledger entry.

## Durable OAuth replay ledger

`iam.oauth_transaction_consumption` stores only the transaction id, provider issuer, expiry and consumption time. `iam.consume_oauth_transaction` performs an atomic insert and returns false for replayed, expired, invalid or excessively long-lived transactions.

The application runtime has no direct table privilege. It receives execute permission only on the reviewed security-definer function.

## Database membership projection

`iam.oidc_membership_binding` maps an exact verified provider `issuer + subject` to an internal account, tenant, membership and optional campus. `iam.oidc_membership_role_binding` supplies the server-owned roles for that membership.

Resolution rejects or excludes:

- disabled accounts;
- suspended or revoked bindings;
- identities with no active role binding;
- cross-tenant or cross-campus selection;
- ambiguous tenant or campus context without explicit selection.

The browser cannot supply an internal account id, membership id or role id as identity evidence.

## Durable browser-session registry

`iam.browser_session_registry` records:

- the signed session id;
- the resolved account and membership binding;
- tenant and optional campus scope;
- the exact role-id set;
- assurance level;
- issue and expiry times;
- optional revocation time and reason.

A signed cookie becomes browser-visible only after `iam.register_browser_session` confirms that the account, membership, campus and role set still match the active server-owned projection.

## Active-session checks

Every browser-session introspection performs two independent checks:

1. verify the signed `__Host-school_session` cookie cryptographically;
2. confirm the session id is active in the durable registry.

The registry check also verifies that:

- the account is still enabled;
- the membership binding remains active;
- the session is not expired or revoked;
- the current role binding exactly matches the role set captured at issuance.

Role removal, membership suspension, account disabling, expiry or explicit revocation therefore invalidates the session even when the cookie signature remains valid.

## Revocation

The database contract supports:

- single-session revocation with a non-empty reason;
- account-wide revocation of all unexpired active sessions;
- automatic denial after membership or role changes.

Direct registry writes are not exposed to `app_runtime`; revocation is performed only through security-definer functions.

## Worker adapter

`DurableAuthStore` provides typed methods for:

- atomic OAuth transaction consumption;
- membership resolution;
- durable session registration;
- active-session lookup;
- single-session revocation;
- account-wide revocation.

Malformed database rows, invalid identifiers and unavailable stores fail closed. Provider, database and internal error details are not returned to the browser.

## Login orchestration change

AUTH-02 callback orchestration now requires durable session registration after ID-token and membership verification. The success sequence is:

1. validate the browser-bound OAuth transaction;
2. consume the replay id durably;
3. exchange the authorization code;
4. verify provider signing keys and ID token;
5. resolve the database membership projection;
6. create a signed browser-session claim set;
7. register that session durably;
8. return the secure session cookie and clear the OAuth transaction cookie.

If replay storage, membership resolution or session registration is unavailable, no session cookie is released.

## Staging behavior

The readiness endpoint advertises durable replay, database membership, session-registry and revocation controls using generic configuration categories. Staging continues to report `loginEnabled: false` and does not receive an identity provider, client credential, production database binding or browser-session key.

## Explicitly not enabled

AUTH-03 does not enable:

- a real OpenID Provider or client credential;
- public login or callback routes;
- real user, tenant, student or staff identity data;
- refresh-token persistence;
- provider logout or provider-token revocation;
- step-up initiation;
- production session keys;
- production database mutation;
- production promotion or owner go-live authorization.
