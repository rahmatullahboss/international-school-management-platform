import { issueBrowserSession, type BrowserSessionClaims } from './browser-session.js';
import type { MembershipResolution, MembershipSelection } from './membership.js';
import {
  clearOAuthTransactionCookie,
  issueOAuthTransaction,
  verifyOAuthCallbackTransaction,
  type OidcStepUpRequest,
} from './oauth-transaction.js';
import {
  exchangeOidcAuthorizationCode,
  fetchOidcJwks,
  type OidcDiscoveredProvider,
} from './oidc-provider-client.js';
import {
  verifyOidcIdToken,
  type OidcIdentity,
  type OidcJsonWebKeySet,
  type OidcProviderConfiguration,
  type OidcVerificationResult,
} from './oidc.js';

export interface OidcLoginFlowConfiguration {
  readonly provider: OidcDiscoveredProvider;
  readonly clientSecret: string;
  readonly transactionSecret: string;
  readonly sessionSecret: string;
}

export interface BeginOidcLoginInput {
  readonly configuration: OidcLoginFlowConfiguration;
  readonly returnTo?: string;
  readonly stepUp?: OidcStepUpRequest;
  readonly now?: number;
}

export type BeginOidcLoginResult =
  | {
      readonly ok: true;
      readonly authorizationUrl: string;
      readonly setCookie: string;
    }
  | {
      readonly ok: false;
      readonly status: 400 | 503;
      readonly code: string;
      readonly message: string;
    };

export interface OidcCallbackParameters {
  readonly code?: string;
  readonly state?: string;
  readonly issuer?: string;
  readonly error?: string;
}

export type OidcSigningKeyResolution =
  | { readonly ok: true; readonly jwks: OidcJsonWebKeySet }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface OidcLoginFlowDependencies {
  readonly fetcher?: typeof fetch;
  readonly consumeTransaction: (
    transactionId: string,
    providerIssuer: string,
    expiresAt: number,
  ) => Promise<boolean>;
  readonly resolveSigningKeys?: (
    configuration: OidcProviderConfiguration,
    forceRefresh: boolean,
  ) => Promise<OidcSigningKeyResolution>;
  readonly resolveMembership: (
    identity: OidcIdentity,
    selection: MembershipSelection,
  ) => Promise<MembershipResolution>;
  readonly registerSession: (claims: BrowserSessionClaims) => Promise<boolean>;
}

export interface CompleteOidcLoginInput {
  readonly configuration: OidcLoginFlowConfiguration;
  readonly callback: OidcCallbackParameters;
  readonly cookieHeader: string | undefined;
  readonly membershipSelection?: MembershipSelection;
  readonly dependencies: OidcLoginFlowDependencies;
  readonly now?: number;
}

export type CompleteOidcLoginResult =
  | {
      readonly ok: true;
      readonly redirectTo: string;
      readonly session: BrowserSessionClaims;
      readonly setCookies: readonly string[];
    }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403 | 409 | 502 | 503;
      readonly code: string;
      readonly message: string;
      readonly setCookie: string;
    };

function callbackFailure(
  status: 400 | 401 | 403 | 409 | 502 | 503,
  code: string,
  message: string,
): CompleteOidcLoginResult {
  return {
    ok: false,
    status,
    code,
    message,
    setCookie: clearOAuthTransactionCookie(),
  };
}

function signingKeyFailureStatus(code: string): 502 | 503 {
  return code === 'oidc_provider_network_error' ||
    code === 'oidc_provider_http_error' ||
    code === 'oidc_provider_response_invalid' ||
    code === 'oidc_provider_capability_missing'
    ? 502
    : 503;
}

async function resolveSigningKeys(
  input: CompleteOidcLoginInput,
  forceRefresh: boolean,
): Promise<OidcSigningKeyResolution> {
  try {
    if (input.dependencies.resolveSigningKeys !== undefined) {
      return await input.dependencies.resolveSigningKeys(
        input.configuration.provider.configuration,
        forceRefresh,
      );
    }
    return await fetchOidcJwks(
      input.configuration.provider.configuration,
      input.dependencies.fetcher,
    );
  } catch {
    return {
      ok: false,
      code: 'oidc_signing_key_cache_unavailable',
      message: 'OIDC signing keys are unavailable.',
    };
  }
}

async function verifyIdentityWithSingleRefresh(
  input: CompleteOidcLoginInput,
  idToken: string,
  nonce: string,
): Promise<OidcVerificationResult | Extract<OidcSigningKeyResolution, { readonly ok: false }>> {
  const initialKeys = await resolveSigningKeys(input, false);
  if (!initialKeys.ok) return initialKeys;
  const verify = (jwks: OidcJsonWebKeySet): Promise<OidcVerificationResult> =>
    verifyOidcIdToken({
      idToken,
      nonce,
      configuration: input.configuration.provider.configuration,
      jwks,
      ...(input.now === undefined ? {} : { now: input.now }),
    });

  const initial = await verify(initialKeys.jwks);
  if (initial.ok || initial.code !== 'oidc_signing_key_not_found') return initial;

  const refreshedKeys = await resolveSigningKeys(input, true);
  if (!refreshedKeys.ok) return refreshedKeys;
  return verify(refreshedKeys.jwks);
}

export async function beginOidcLogin(input: BeginOidcLoginInput): Promise<BeginOidcLoginResult> {
  if (input.configuration.clientSecret === '') {
    return {
      ok: false,
      status: 503,
      code: 'oidc_login_unavailable',
      message: 'OIDC login is not configured.',
    };
  }
  const transaction = await issueOAuthTransaction({
    configuration: input.configuration.provider.configuration,
    secret: input.configuration.transactionSecret,
    ...(input.returnTo === undefined ? {} : { returnTo: input.returnTo }),
    requireAuthorizationResponseIssuer:
      input.configuration.provider.authorizationResponseIssuerParameterSupported,
    ...(input.stepUp === undefined ? {} : { stepUp: input.stepUp }),
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (!transaction.ok) {
    return {
      ok: false,
      status: transaction.code === 'oauth_return_path_invalid' ? 400 : 503,
      code: transaction.code,
      message: transaction.message,
    };
  }
  return {
    ok: true,
    authorizationUrl: transaction.request.authorizationUrl,
    setCookie: transaction.request.setCookie,
  };
}

export async function completeOidcLogin(
  input: CompleteOidcLoginInput,
): Promise<CompleteOidcLoginResult> {
  if (input.callback.error !== undefined) {
    return callbackFailure(
      401,
      'oidc_authorization_rejected',
      'The identity provider did not authorize the login.',
    );
  }
  if (
    input.callback.code === undefined ||
    input.callback.code === '' ||
    input.callback.code.length > 4096
  ) {
    return callbackFailure(
      400,
      'oidc_authorization_code_required',
      'A valid authorization code is required.',
    );
  }

  const transaction = await verifyOAuthCallbackTransaction({
    secret: input.configuration.transactionSecret,
    cookieHeader: input.cookieHeader,
    state: input.callback.state,
    ...(input.callback.issuer === undefined
      ? {}
      : { authorizationResponseIssuer: input.callback.issuer }),
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (!transaction.ok) {
    return callbackFailure(401, transaction.code, transaction.message);
  }

  let consumed: boolean;
  try {
    consumed = await input.dependencies.consumeTransaction(
      transaction.transaction.transactionId,
      transaction.transaction.providerIssuer,
      transaction.transaction.expiresAt,
    );
  } catch {
    return callbackFailure(
      503,
      'oauth_replay_store_unavailable',
      'The login transaction store is unavailable.',
    );
  }
  if (!consumed) {
    return callbackFailure(
      401,
      'oauth_transaction_replayed',
      'The OAuth transaction has already been consumed.',
    );
  }

  const tokenExchange = await exchangeOidcAuthorizationCode({
    configuration: input.configuration.provider.configuration,
    clientSecret: input.configuration.clientSecret,
    code: input.callback.code,
    codeVerifier: transaction.transaction.codeVerifier,
    ...(input.dependencies.fetcher === undefined ? {} : { fetcher: input.dependencies.fetcher }),
  });
  if (!tokenExchange.ok) {
    return callbackFailure(502, tokenExchange.code, tokenExchange.message);
  }

  const identity = await verifyIdentityWithSingleRefresh(
    input,
    tokenExchange.tokenSet.idToken,
    transaction.transaction.nonce,
  );
  if (!identity.ok) {
    const status =
      identity.code.startsWith('oidc_token_') ||
      identity.code === 'oidc_signing_key_not_found' ||
      identity.code === 'oidc_signature_invalid' ||
      identity.code === 'oidc_claims_invalid' ||
      identity.code === 'oidc_issuer_mismatch' ||
      identity.code === 'oidc_audience_mismatch' ||
      identity.code === 'oidc_nonce_mismatch'
        ? 401
        : signingKeyFailureStatus(identity.code);
    return callbackFailure(status, identity.code, identity.message);
  }

  if (transaction.transaction.requestedAssurance === 'aal2') {
    const authenticationTime = identity.identity.authenticationTime;
    const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
    const freshnessSeconds = transaction.transaction.stepUpFreshnessSeconds;
    if (
      freshnessSeconds === undefined ||
      identity.identity.assurance !== 'aal2' ||
      authenticationTime === undefined ||
      authenticationTime > nowSeconds + 60 ||
      authenticationTime < nowSeconds - freshnessSeconds
    ) {
      return callbackFailure(
        401,
        'oidc_step_up_required',
        'Fresh multi-factor authentication is required.',
      );
    }
  }

  let membership: MembershipResolution;
  try {
    membership = await input.dependencies.resolveMembership(
      identity.identity,
      input.membershipSelection ?? {},
    );
  } catch {
    return callbackFailure(
      503,
      'membership_source_unavailable',
      'The identity membership source is unavailable.',
    );
  }
  if (!membership.ok) {
    const status = membership.code === 'membership_selection_required' ? 409 : 403;
    return callbackFailure(
      status,
      membership.code,
      status === 409
        ? 'A tenant or campus selection is required before login can continue.'
        : 'The verified identity is not permitted to access this school context.',
    );
  }

  const browserSession = await issueBrowserSession({
    identity: identity.identity,
    membership: membership.context,
    secret: input.configuration.sessionSecret,
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (!browserSession.ok) {
    return callbackFailure(503, browserSession.code, browserSession.message);
  }

  let registered: boolean;
  try {
    registered = await input.dependencies.registerSession(browserSession.claims);
  } catch {
    return callbackFailure(
      503,
      'session_registry_unavailable',
      'The browser session registry is unavailable.',
    );
  }
  if (!registered) {
    return callbackFailure(
      403,
      'browser_session_registration_denied',
      'The current membership context cannot establish a browser session.',
    );
  }

  return {
    ok: true,
    redirectTo: transaction.transaction.returnTo,
    session: browserSession.claims,
    setCookies: [browserSession.setCookie, clearOAuthTransactionCookie()],
  };
}
