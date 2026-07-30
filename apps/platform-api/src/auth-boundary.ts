import {
  validateOidcProviderConfiguration,
  verifyBrowserSession,
  type OidcProviderConfiguration,
} from '@school/policy';

export interface AuthBindings {
  readonly OIDC_ISSUER?: string;
  readonly OIDC_CLIENT_ID?: string;
  readonly OIDC_AUTHORIZATION_ENDPOINT?: string;
  readonly OIDC_TOKEN_ENDPOINT?: string;
  readonly OIDC_JWKS_URI?: string;
  readonly OIDC_REDIRECT_URI?: string;
  readonly AUTH_TRANSACTION_SECRET?: string;
  readonly AUTH_SESSION_SECRET?: string;
  readonly AUTH_MEMBERSHIP_SOURCE?: string;
}

export type AuthReadinessRequirement =
  | 'provider-metadata'
  | 'transaction-signing-key'
  | 'session-signing-key'
  | 'membership-source';

export interface AuthReadiness {
  readonly schemaVersion: 1;
  readonly mode: 'oidc-bff';
  readonly state: 'disabled' | 'incomplete' | 'provider-test-ready';
  readonly loginEnabled: false;
  readonly controls: {
    readonly authorizationCode: true;
    readonly pkceS256: true;
    readonly issuerValidation: true;
    readonly audienceValidation: true;
    readonly jwksSignatureValidation: true;
    readonly nonceValidation: true;
    readonly membershipResolution: true;
    readonly httpOnlyHostCookie: true;
    readonly stepUpAssurance: true;
  };
  readonly missingConfiguration: readonly AuthReadinessRequirement[];
}

const providerBindingNames = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_AUTHORIZATION_ENDPOINT',
  'OIDC_TOKEN_ENDPOINT',
  'OIDC_JWKS_URI',
  'OIDC_REDIRECT_URI',
] as const;

type ProviderBindingName = (typeof providerBindingNames)[number];

function configuredValue(
  bindings: AuthBindings,
  name: ProviderBindingName | 'AUTH_TRANSACTION_SECRET' | 'AUTH_SESSION_SECRET' | 'AUTH_MEMBERSHIP_SOURCE',
): string | undefined {
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
  if (!hasStrongKey(configuredValue(bindings, 'AUTH_TRANSACTION_SECRET'))) {
    missingConfiguration.push('transaction-signing-key');
  }
  if (!hasStrongKey(configuredValue(bindings, 'AUTH_SESSION_SECRET'))) {
    missingConfiguration.push('session-signing-key');
  }
  if (configuredValue(bindings, 'AUTH_MEMBERSHIP_SOURCE') === undefined) {
    missingConfiguration.push('membership-source');
  }

  return {
    schemaVersion: 1,
    mode: 'oidc-bff',
    state:
      missingConfiguration.length === 4
        ? 'disabled'
        : missingConfiguration.length > 0
          ? 'incomplete'
          : 'provider-test-ready',
    loginEnabled: false,
    controls: {
      authorizationCode: true,
      pkceS256: true,
      issuerValidation: true,
      audienceValidation: true,
      jwksSignatureValidation: true,
      nonceValidation: true,
      membershipResolution: true,
      httpOnlyHostCookie: true,
      stepUpAssurance: true,
    },
    missingConfiguration,
  };
}

export async function resolveAuthenticatedBrowserSession(
  bindings: AuthBindings,
  cookieHeader: string | undefined,
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
