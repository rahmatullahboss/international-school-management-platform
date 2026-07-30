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
  readonly missingConfiguration: readonly string[];
}

const requiredBindings = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_AUTHORIZATION_ENDPOINT',
  'OIDC_TOKEN_ENDPOINT',
  'OIDC_JWKS_URI',
  'OIDC_REDIRECT_URI',
  'AUTH_TRANSACTION_SECRET',
  'AUTH_SESSION_SECRET',
  'AUTH_MEMBERSHIP_SOURCE',
] as const;

type RequiredBindingName = (typeof requiredBindings)[number];

function configuredValue(bindings: AuthBindings, name: RequiredBindingName): string | undefined {
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

export function resolveAuthReadiness(bindings: AuthBindings): AuthReadiness {
  const missing = requiredBindings.filter((name) => {
    const value = configuredValue(bindings, name);
    if (value === undefined) return true;
    if (
      (name === 'AUTH_TRANSACTION_SECRET' || name === 'AUTH_SESSION_SECRET') &&
      value.length < 32
    ) {
      return true;
    }
    return false;
  });
  const configuration = providerConfiguration(bindings);
  const configurationFailure =
    configuration === undefined ? undefined : validateOidcProviderConfiguration(configuration);
  const missingConfiguration =
    configurationFailure === undefined ? missing : [...missing, 'OIDC_PROVIDER_CONFIGURATION'];

  return {
    schemaVersion: 1,
    mode: 'oidc-bff',
    state:
      missingConfiguration.length === requiredBindings.length
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
