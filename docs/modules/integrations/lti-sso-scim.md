# LTI 1.3, SSO and SCIM Foundation

## Scope and conformance boundary

This milestone provides the security and persistence foundation for:

- LTI 1.3 platform registration and resource-link/deep-link launch validation;
- generic OpenID Connect single sign-on;
- generic SAML 2.0 assertion semantics;
- a bounded SCIM 2.0 Users/Groups provisioning contract.

It does not claim LTI Advantage certification, complete Deep Linking, Names and Role Provisioning Services, Assignment and Grade Services, a complete SAML XML parser/signature library or a deployed SCIM service. Provider-specific country adapters remain separate connectors.

## LTI registration

Every tenant registration records an immutable combination of issuer and client ID, HTTPS authorisation/access/key-set endpoints, allowed deployment IDs and exact target-link URIs. Duplicate issuer/client registration is rejected.

The internal property `accessEndpoint` represents the platform OAuth access endpoint. Deployment configuration must keep signing material and provider credentials in managed encrypted bindings rather than PostgreSQL JSON.

## Login initiation and replay controls

A login initiation creates one short-lived state value and one launch nonce. Both are:

- random and unique;
- bound to tenant, registration and target-link URI;
- valid for a bounded 30–900 second window;
- one-time consumable.

The database migration stores only state and nonce digests. An invalid deployment, audience, target link or assertion does not consume the launch nonce; a valid launch consumes it exactly once.

## Compact assertion verification

The default compact verifier:

1. requires three compact segments;
2. requires `RS256`;
3. imports an approved JSON Web Key document;
4. verifies the exact encoded header and claim body with Web Crypto;
5. rejects signature or payload changes.

After cryptographic verification, the LTI verifier checks issuer/client audience, issue and expiry time, nonce, LTI version, supported message type, deployment and target-link URI. It returns only the approved launch context: subject reference, deployment, message type, roles, context ID and resource-link ID. Unrequested identity claims such as email are not returned.

Key-set retrieval, cache expiry, key ID selection and emergency rotation belong to the deployment/provider adapter. A connector must never accept a key merely because it is embedded in the incoming assertion.

## OpenID Connect SSO

`OidcSsoAdapter` creates authorisation-code requests with:

- HTTPS issuer, authorisation endpoint and redirect URI;
- `openid` scope;
- state and nonce;
- PKCE SHA-256 challenge;
- optional login hint.

Claim validation requires matching issuer/audience/nonce and valid issue/expiry times. Email is exposed only when the provider marks it verified. Group claims are intersected with an explicit allow-list; an external group name cannot grant an internal role by itself.

The authorisation response exchange and signed identity-assertion verification are deployment adapter responsibilities. The returned verified claim set is then passed through this semantic validator.

## SAML SSO

The SAML semantic validator refuses assertions unless a reviewed XML-signature adapter has already set `signatureVerified=true`. It then validates:

- issuer/entity ID;
- audience;
- recipient;
- `InResponseTo` login request;
- `NotBefore` and `NotOnOrAfter` with bounded clock skew;
- one-time assertion ID;
- subject and allowed-group mapping.

Unsolicited assertions are not accepted by this contract. XML parsing must prohibit external entities and unsafe transforms. Signature verification must cover the exact assertion consumed by the semantic validator to prevent wrapping attacks.

## SCIM provisioning contract

The SCIM contract reserves:

```text
/api/v1/scim/v2/Users
/api/v1/scim/v2/Groups
```

The initial profile supports:

- resource and resource-ID paths;
- simple `attribute eq "value"` filters;
- bounded `add`, `replace` and `remove` operations;
- writable-path allow-listing;
- weak entity versions such as `W/"7"`.

Immutable fields including `id` are not writable. A deployed service must enforce connector scopes, tenant isolation, If-Match version checks, pagination, rate limits, disclosure audit and domain-command execution.

## Database migration

`202607280106_INT-01_lti_sso_scim` creates tenant-scoped tables for:

- immutable LTI registration configuration;
- digested one-time launch sessions;
- append-only launch audit;
- generic OIDC/SAML connections and group/attribute mappings;
- consumed SAML assertion IDs;
- SCIM external/internal resource mappings and versions.

All tables use forced row-level security through `app.tenant_id`. The launch-audit table is append-only. No reusable credential, state or nonce value is stored in plaintext.

## Operational checks

Before enabling a tenant connection:

1. verify issuer/entity metadata through an administrator-approved channel;
2. restrict redirect, recipient and target-link URIs to exact HTTPS values;
3. test clock synchronisation and key rotation;
4. map only approved groups/claims;
5. test state, nonce and assertion replay rejection;
6. test disabled-user and deprovisioning behavior;
7. record subprocessor/privacy metadata and disclosure purpose;
8. retain launch and provisioning evidence according to tenant policy.
