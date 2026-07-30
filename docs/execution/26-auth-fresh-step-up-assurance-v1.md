# AUTH-06 — Fresh Step-Up Assurance

**Status:** `GATE-AUTH-FRESH-STEP-UP-V1` passed on implementation proof `17b53865900c3606bf5781a9ed0cf0b856262782`  
**Date:** 2026-07-31  
**Reviewed base:** `a333eca824985e624a0fd87bc0127dea6ad8253f`  
**Main merge:** `12881a80c6776020c8e26ca70ffb4af5c6b42b39`

## Purpose

AUTH-06 adds a provider-neutral, fail-closed step-up assurance contract on top of the signed OAuth transaction, strict ID-token verification and durable browser-session controls completed in AUTH-01 through AUTH-05.

The gate does not enable a real identity provider or public login route. It proves that a sensitive operation can request a fresh AAL2 authentication and that the callback cannot issue a browser session unless the verified provider proof satisfies the signed request.

## Signed step-up request

A step-up login request is carried inside the signed `__Host-school_oauth` transaction and contains:

- exact requested assurance `aal2`;
- a positive freshness window no longer than 300 seconds;
- optional reviewed ACR values;
- the existing state, nonce, PKCE verifier, provider issuer, return path, issue time and expiry.

The browser cannot alter the requested assurance, freshness window or ACR set without invalidating the transaction signature.

## Forced provider authentication

A step-up authorization request adds:

- `prompt=login`;
- `max_age=0`;
- optional `acr_values` selected by reviewed server-side configuration.

ACR values are bounded to five entries, each no longer than 256 characters. Empty values, whitespace and control characters are rejected before an authorization URL is produced.

## Callback assurance enforcement

After the normal transaction replay, token exchange, signing-key and ID-token verification sequence, a step-up callback additionally requires:

- locally derived assurance exactly `aal2`;
- an `auth_time` claim;
- `auth_time` not in the future beyond the existing clock-skew allowance;
- `auth_time` no older than the signed freshness window.

Missing, stale, future or AAL1 authentication returns the sanitized `oidc_step_up_required` failure and no membership resolution or browser session issuance occurs.

## Fail-closed behavior

Step-up initiation or completion fails closed for:

- unsupported assurance values;
- zero, negative or greater-than-five-minute freshness;
- empty, excessive, whitespace-bearing or control-character ACR values;
- tampered or malformed signed transaction data;
- missing or invalid state, nonce, issuer, PKCE or signing-key proof;
- missing, future or stale `auth_time`;
- assurance lower than AAL2;
- provider, cache, membership, replay or session-store failures inherited from the preceding AUTH gates.

## Readiness contract

The non-sensitive readiness response adds these verified controls:

- `forcedReauthentication`;
- `boundedFreshAuthentication`;
- `reviewedAcrValues`.

The response still exposes no provider secret, ACR configuration, signing key, database value, identity or tenant data.

## Staging boundary

Cloudflare staging verifies the new readiness controls while `loginEnabled` remains false. No provider credential, approved production origin, production cache/database binding or real identity is configured.

The existing synthetic pilot bearer flow remains separate from the browser OIDC path.

## Explicitly not enabled

AUTH-06 does not enable:

- a real identity provider or client credential;
- public login, callback or step-up routes;
- provider logout, back-channel logout or token revocation;
- production database/cache bindings;
- real account, tenant, student or staff identity data;
- production mutations or promotion;
- owner go-live authorization.
