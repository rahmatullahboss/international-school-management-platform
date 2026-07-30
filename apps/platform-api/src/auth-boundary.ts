import {
  validateOidcProviderConfiguration,
  verifyBrowserSession,
  type OidcProviderConfiguration,
} from '@school/policy';

import { hasValidAuthMutationOrigins } from './auth-logout.js';

export interface AuthBindings {
  readonly OIDC_ISSUER?: string;
  readonly OIDC_CLIENT_ID?: string;
  readonly OIDC_CLIENT_SECRET?: string;
  readonly OIDC_AUTHORIZATION_ENDPOINT?: string;
  readonly OIDC_TOKEN_ENDPOINT?: string;
  readonly OIDC_JWKS_URI?: string;
  readonly OIDC_REDIRECT_URI?: string;
  readonly OIDC_ENDPOINT_ORIGINS?: string;
  readonly OIDC_PROVIDER_CACHE_SOURCE?: string;
  readonly OIDC_BACKCHANNEL_LOGOUT_SOURCE?: string;
  readonly AUTH_TRANSACTION_SECRET?: string;
  readonly AUTH_TRANSACTION_REPLAY_SOURCE?: string;
  readonly AUTH_SESSION_SECRET?: string;
  readonly AUTH_SESSION_REGISTRY_SOURCE?: string;
  readonly AUTH_MEMBERSHIP_SOURCE?: string;
  readonly AUTH_ALLOWED_WEB_ORIGINS?: string;
}

export type AuthReadinessRequirement =
  | 'provider-metadata'
  | 'provider-endpoint-origins'
  | 'provider-cache-source'
  | 'backchannel-logout-source'
  | 'provider-client-credential'
  | 'transaction-signing-key'
  | 'transaction-replay-source'
  | 'session-signing-key'
  | 'session-registry-source'
  | 'membership-source'
  | 'allowed-web-origins';

export interface AuthReadiness {
  readonly schemaVersion: 1;
  readonly mode: 'oidc-bff';
  readonly state: 'disabled' | 'incomplete' | 'provider-test-ready';
  readonly loginEnabled: false;
  readonly controls: {
    readonly authorizationCode: true;
    readonly pkceS256: true;
    readonly highEntropyStateNonceVerifier: true;
    readonly browserBoundTransactionCookie: true;
    readonly transactionReplayProtection: true;
    readonly durableReplayLedger: true;
    readonly authorizationResponseIssuerValidation: true;
    readonly confidentialClientAuthentication: true;
    readonly serverSideTokenExchange: true;
    readonly providerDiscoveryValidation: true;
    readonly conditionalDiscoveryRevalidation: true;
    readonly boundedJwksCache: true;
    readonly boundedStaleIfError: true;
    readonly unknownKidSingleRefresh: true;
    readonly retiredKeyOverlap: true;
    readonly kidReuseDenied: true;
    readonly providerEndpointOriginPins: true;
    readonly providerEndpointChangeReview: true;
    readonly issuerValidation: true;
    readonly audienceValidation: true;
    readonly jwksSignatureValidation: true;
    readonly nonceValidation: true;
    readonly membershipResolution: true;
    readonly databaseMembershipProjection: true;
    readonly httpOnlyHostCookie: true;
    readonly browserSessionRegistry: true;
    readonly sessionRevocation: true;
    readonly originCheckedLogout: true;
    readonly accountWideLogout: true;
    readonly secureCookieDeletion: true;
    readonly providerTokensWithheldFromBrowser: true;
    readonly stepUpAssurance: true;
    readonly forcedReauthentication: true;
    readonly boundedFreshAuthentication: true;
    readonly reviewedAcrValues: true;
    readonly backChannelLogout: true;
    readonly typedLogoutTokens: true;
    readonly logoutTokenReplayProtection: true;
    readonly providerSessionRevocation: true;
    readonly durableProviderCache: true;
  };
  readonly missingConfiguration: readonly AuthReadinessRequirement[];
}

type AuthBindingName =
  | 'OIDC_ISSUER'
  | 'OIDC_CLIENT_ID'
  | 'OIDC_CLIENT_SECRET'
  | 'OIDC_AUTHORIZATION_ENDPOINT'
  | 'OIDC_TOKEN_ENDPOINT'
  | 'OIDC_JWKS_URI'
  | 'OIDC_REDIRECT_URI'
  | 'OIDC_ENDPOINT_ORIGINS'
  | 'OIDC_PROVIDER_CACHE_SOURCE'
  | 'OIDC_BACKCHANNEL_LOGOUT_SOURCE'
  | 'AUTH_TRANSACTION_SECRET'
  | 'AUTH_TRANSACTION_REPLAY_SOURCE'
  | 'AUTH_SESSION_SECRET'
  | 'AUTH_SESSION_REGISTRY_SOURCE'
  | 'AUTH_MEMBERSHIP_SOURCE'
  | 'AUTH_ALLOWED_WEB_ORIGINS';

function configuredValue(bindings: AuthBindings, name: AuthBindingName): string | undefined {
  const value = bindings[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

export function resolveAuthProviderConfiguration(
  bindings: AuthBindings,
): OidcProviderConfiguration | undefined {
  const issuer = configuredValue(bindings, 'OIDC_ISSUER');
  const clientId = configuredValue(bindings, 'OIDC_CLIENT_ID');
  const authorizationEndpoint = configuredValue(bindings, 'OIDC_AUTHORIZATION_ENDPOINT');
  const tokenEndpoint = configuredValue(bindings, 'OIDC_TOKEN_ENDPOINT');
  const jwksUri = configuredValue(bindings, 'OIDC_JWKS_URI');
  const redirectUri = configuredValue(bindings, 'OIDC_REDIRECT_URI');
  if (
    issuer === undefined ||
    clientId === undefined ||
    authorizationEndpoint === undefined ||
    tokenEndpoint === undefined ||
    jwksUri === undefined ||
    redirectUri === undefined
  ) {
    return undefined;
  }
  return { issuer, clientId, authorizationEndpoint, tokenEndpoint, jwksUri, redirectUri };
}

function hasStrongKey(value: string | undefined): boolean {
  return value !== undefined && value.length >= 32;
}

function exactHttpsOrigins(value: string | undefined): readonly string[] | undefined {
  if (value === undefined) return undefined;
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (entries.length === 0 || entries.length > 10) return undefined;
  const origins = new Set<string>();
  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return undefined;
    }
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      entry !== url.origin
    ) {
      return undefined;
    }
    origins.add(url.origin);
  }
  return [...origins];
}

export function resolveAuthProviderEndpointOrigins(
  bindings: AuthBindings,
): readonly string[] | undefined {
  return exactHttpsOrigins(configuredValue(bindings, 'OIDC_ENDPOINT_ORIGINS'));
}

function hasValidProviderEndpointOrigins(
  value: string | undefined,
  configuration: OidcProviderConfiguration | undefined,
): boolean {
  const origins = exactHttpsOrigins(value);
  if (origins === undefined) return false;
  if (configuration === undefined) return true;
  return [
    configuration.issuer,
    configuration.authorizationEndpoint,
    configuration.tokenEndpoint,
    configuration.jwksUri,
  ].every((endpoint) => origins.includes(new URL(endpoint).origin));
}

export function resolveAuthReadiness(bindings: AuthBindings): AuthReadiness {
  const missingConfiguration: AuthReadinessRequirement[] = [];
  const configuration = resolveAuthProviderConfiguration(bindings);
  if (
    configuration === undefined ||
    validateOidcProviderConfiguration(configuration) !== undefined
  ) {
    missingConfiguration.push('provider-metadata');
  }
  if (
    !hasValidProviderEndpointOrigins(
      configuredValue(bindings, 'OIDC_ENDPOINT_ORIGINS'),
      configuration,
    )
  ) {
    missingConfiguration.push('provider-endpoint-origins');
  }
  if (configuredValue(bindings, 'OIDC_PROVIDER_CACHE_SOURCE') !== 'database') {
    missingConfiguration.push('provider-cache-source');
  }
  if (configuredValue(bindings, 'OIDC_BACKCHANNEL_LOGOUT_SOURCE') !== 'database') {
    missingConfiguration.push('backchannel-logout-source');
  }
  if (configuredValue(bindings, 'OIDC_CLIENT_SECRET') === undefined) {
    missingConfiguration.push('provider-client-credential');
  }
  if (!hasStrongKey(configuredValue(bindings, 'AUTH_TRANSACTION_SECRET'))) {
    missingConfiguration.push('transaction-signing-key');
  }
  if (configuredValue(bindings, 'AUTH_TRANSACTION_REPLAY_SOURCE') === undefined) {
    missingConfiguration.push('transaction-replay-source');
  }
  if (!hasStrongKey(configuredValue(bindings, 'AUTH_SESSION_SECRET'))) {
    missingConfiguration.push('session-signing-key');
  }
  if (configuredValue(bindings, 'AUTH_SESSION_REGISTRY_SOURCE') === undefined) {
    missingConfiguration.push('session-registry-source');
  }
  if (configuredValue(bindings, 'AUTH_MEMBERSHIP_SOURCE') === undefined) {
    missingConfiguration.push('membership-source');
  }
  if (!hasValidAuthMutationOrigins(configuredValue(bindings, 'AUTH_ALLOWED_WEB_ORIGINS'))) {
    missingConfiguration.push('allowed-web-origins');
  }

  return {
    schemaVersion: 1,
    mode: 'oidc-bff',
    state:
      missingConfiguration.length === 11
        ? 'disabled'
        : missingConfiguration.length > 0
          ? 'incomplete'
          : 'provider-test-ready',
    loginEnabled: false,
    controls: {
      authorizationCode: true,
      pkceS256: true,
      highEntropyStateNonceVerifier: true,
      browserBoundTransactionCookie: true,
      transactionReplayProtection: true,
      durableReplayLedger: true,
      authorizationResponseIssuerValidation: true,
      confidentialClientAuthentication: true,
      serverSideTokenExchange: true,
      providerDiscoveryValidation: true,
      conditionalDiscoveryRevalidation: true,
      boundedJwksCache: true,
      boundedStaleIfError: true,
      unknownKidSingleRefresh: true,
      retiredKeyOverlap: true,
      kidReuseDenied: true,
      providerEndpointOriginPins: true,
      providerEndpointChangeReview: true,
      issuerValidation: true,
      audienceValidation: true,
      jwksSignatureValidation: true,
      nonceValidation: true,
      membershipResolution: true,
      databaseMembershipProjection: true,
      httpOnlyHostCookie: true,
      browserSessionRegistry: true,
      sessionRevocation: true,
      originCheckedLogout: true,
      accountWideLogout: true,
      secureCookieDeletion: true,
      providerTokensWithheldFromBrowser: true,
      stepUpAssurance: true,
      forcedReauthentication: true,
      boundedFreshAuthentication: true,
      reviewedAcrValues: true,
      backChannelLogout: true,
      typedLogoutTokens: true,
      logoutTokenReplayProtection: true,
      providerSessionRevocation: true,
      durableProviderCache: true,
    },
    missingConfiguration,
  };
}

export async function resolveAuthenticatedBrowserSession(
  bindings: AuthBindings,
  cookieHeader: string | undefined,
  isSessionActive?: (sessionId: string) => Promise<boolean>,
): Promise<
  | {
      readonly ok: true;
      readonly session: {
        readonly principalId: string;
        readonly membershipId: string;
        readonly tenantId: string;
        readonly campusId?: string;
        readonly roleIds: readonly string[];
        readonly assurance: 'aal1' | 'aal2';
        readonly expiresAt: string;
      };
    }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
      readonly code: string;
      readonly message: string;
    }
> {
  const verification = await verifyBrowserSession(bindings.AUTH_SESSION_SECRET, cookieHeader);
  if (!verification.ok) {
    return {
      ok: false,
      status: verification.code === 'browser_session_configuration_invalid' ? 503 : 401,
      code: verification.code,
      message: verification.message,
    };
  }
  if (
    configuredValue(bindings, 'AUTH_SESSION_REGISTRY_SOURCE') === undefined ||
    isSessionActive === undefined
  ) {
    return {
      ok: false,
      status: 503,
      code: 'session_registry_unavailable',
      message: 'The browser session registry is unavailable.',
    };
  }

  let active: boolean;
  try {
    active = await isSessionActive(verification.claims.sessionId);
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'session_registry_unavailable',
      message: 'The browser session registry is unavailable.',
    };
  }
  if (!active) {
    return {
      ok: false,
      status: 401,
      code: 'browser_session_revoked',
      message: 'The browser session is no longer active.',
    };
  }

  return {
    ok: true,
    session: {
      principalId: verification.claims.principalId,
      membershipId: verification.claims.membershipId,
      tenantId: verification.claims.tenantId,
      ...(verification.claims.campusId === undefined
        ? {}
        : { campusId: verification.claims.campusId }),
      roleIds: verification.claims.roleIds,
      assurance: verification.claims.assurance,
      expiresAt: new Date(verification.claims.expiresAt * 1000).toISOString(),
    },
  };
}
