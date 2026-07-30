import {
  validateOidcProviderConfiguration,
  verifyBrowserSession,
  type OidcProviderConfiguration,
} from '@school/policy';

export interface AuthBindings {
  readonly OIDC_ISSUER?: string;
  readonly OIDC_CLIENT_ID?: string;
  readonly OIDC_CLIENT_SECRET?: string;
  readonly OIDC_AUTHORIZATION_ENDPOINT?: string;
  readonly OIDC_TOKEN_ENDPOINT?: string;
  readonly OIDC_JWKS_URI?: string;
  readonly OIDC_REDIRECT_URI?: string;
  readonly AUTH_TRANSACTION_SECRET?: string;
  readonly AUTH_TRANSACTION_REPLAY_SOURCE?: string;
  readonly AUTH_SESSION_SECRET?: string;
  readonly AUTH_SESSION_REGISTRY_SOURCE?: string;
  readonly AUTH_MEMBERSHIP_SOURCE?: string;
}

export type AuthReadinessRequirement =
  | 'provider-metadata'
  | 'provider-client-credential'
  | 'transaction-signing-key'
  | 'transaction-replay-source'
  | 'session-signing-key'
  | 'session-registry-source'
  | 'membership-source';

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
    readonly issuerValidation: true;
    readonly audienceValidation: true;
    readonly jwksSignatureValidation: true;
    readonly nonceValidation: true;
    readonly membershipResolution: true;
    readonly databaseMembershipProjection: true;
    readonly httpOnlyHostCookie: true;
    readonly browserSessionRegistry: true;
    readonly sessionRevocation: true;
    readonly providerTokensWithheldFromBrowser: true;
    readonly stepUpAssurance: true;
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
  | 'AUTH_TRANSACTION_SECRET'
  | 'AUTH_TRANSACTION_REPLAY_SOURCE'
  | 'AUTH_SESSION_SECRET'
  | 'AUTH_SESSION_REGISTRY_SOURCE'
  | 'AUTH_MEMBERSHIP_SOURCE';

function configuredValue(bindings: AuthBindings, name: AuthBindingName): string | undefined {
  const value = bindings[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function providerConfiguration(bindings: AuthBindings): OidcProviderConfiguration | undefined {
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

export function resolveAuthReadiness(bindings: AuthBindings): AuthReadiness {
  const missingConfiguration: AuthReadinessRequirement[] = [];
  const configuration = providerConfiguration(bindings);
  if (
    configuration === undefined ||
    validateOidcProviderConfiguration(configuration) !== undefined
  ) {
    missingConfiguration.push('provider-metadata');
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

  return {
    schemaVersion: 1,
    mode: 'oidc-bff',
    state:
      missingConfiguration.length === 7
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
      issuerValidation: true,
      audienceValidation: true,
      jwksSignatureValidation: true,
      nonceValidation: true,
      membershipResolution: true,
      databaseMembershipProjection: true,
      httpOnlyHostCookie: true,
      browserSessionRegistry: true,
      sessionRevocation: true,
      providerTokensWithheldFromBrowser: true,
      stepUpAssurance: true,
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
