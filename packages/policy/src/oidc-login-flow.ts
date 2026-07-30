import {
  issueBrowserSession,
  type BrowserSessionClaims,
} from './browser-session.js';
import type {
  MembershipResolution,
  MembershipSelection,
} from './membership.js';
import {
  clearOAuthTransactionCookie,
  issueOAuthTransaction,
  verifyOAuthCallbackTransaction,
} from './oauth-transaction.js';
import {
  exchangeOidcAuthorizationCode,
  fetchOidcJwks,
  type OidcDiscoveredProvider,
} from './oidc-provider-client.js';
import { verifyOidcIdToken, type OidcIdentity } from './oidc.js';

export interface OidcLoginFlowConfiguration {
  readonly provider: OidcDiscoveredProvider;
  readonly clientSecret: string;
  readonly transactionSecret: string;
  readonly sessionSecret: string;
}

export interface BeginOidcLoginInput {
  readonly configuration: OidcLoginFlowConfiguration;
  readonly returnTo?: string;
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

export interface OidcLoginFlowDependencies {
  readonly fetcher?: typeof fetch;
  readonly consumeTransaction: (
    transactionId: string,
    expiresAt: number,
  ) => Promise<boolean>;
  readonly resolveMembership: (
    identity: OidcIdentity,
    selection: MembershipSelection,
  ) => Promise<MembershipResolution>;
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

export async function beginOidcLogin(
  input: BeginOidcLoginInput,
): Promise<BeginOidcLoginResult> {
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
    returnTo: input.returnTo,
    requireAuthorizationResponseIssuer:
      input.configuration.provider.authorizationResponseIssuerParameterSupported,
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
    authorizationResponseIssuer: input.callback.issuer,
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (!transaction.ok) {
    return callbackFailure(401, transaction.code, transaction.message);
  }

  const consumed = await input.dependencies.consumeTransaction(
    transaction.transaction.transactionId,
    transaction.transaction.expiresAt,
  );
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
    ...(input.dependencies.fetcher === undefined
      ? {}
      : { fetcher: input.dependencies.fetcher }),
  });
  if (!tokenExchange.ok) {
    return callbackFailure(502, tokenExchange.code, tokenExchange.message);
  }

  const signingKeys = await fetchOidcJwks(
    input.configuration.provider.configuration,
    input.dependencies.fetcher,
  );
  if (!signingKeys.ok) {
    return callbackFailure(502, signingKeys.code, signingKeys.message);
  }

  const identity = await verifyOidcIdToken({
    idToken: tokenExchange.tokenSet.idToken,
    nonce: transaction.transaction.nonce,
    configuration: input.configuration.provider.configuration,
    jwks: signingKeys.jwks,
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (!identity.ok) {
    return callbackFailure(401, identity.code, identity.message);
  }

  const membership = await input.dependencies.resolveMembership(
    identity.identity,
    input.membershipSelection ?? {},
  );
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

  return {
    ok: true,
    redirectTo: transaction.transaction.returnTo,
    session: browserSession.claims,
    setCookies: [browserSession.setCookie, clearOAuthTransactionCookie()],
  };
}
