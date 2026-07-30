#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding="utf-8")
    if source.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {source.count(old)}")
    target.write_text(source.replace(old, new), encoding="utf-8")


def insert_before(path: str, marker: str, block: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding="utf-8")
    if source.count(marker) != 1:
        raise SystemExit(f"{path}: expected exactly one insertion marker, found {source.count(marker)}")
    target.write_text(source.replace(marker, block + marker), encoding="utf-8")


def add_tests() -> None:
    oauth_test = ROOT / "packages/policy/src/oauth-transaction.test.ts"
    oauth_source = oauth_test.read_text(encoding="utf-8")
    oauth_marker = "  it('verifies the browser-bound state and exact authorization response issuer', async () => {"
    oauth_block = r"""  it('requests a fresh reviewed AAL2 provider authentication for step-up', async () => {
    const result = await issueOAuthTransaction({
      configuration,
      secret,
      returnTo: '/admin/finance/close',
      stepUp: {
        assurance: 'aal2',
        freshnessSeconds: 300,
        acrValues: ['urn:school:aal2', 'urn:school:phishing-resistant'],
      },
      now,
    } as Parameters<typeof issueOAuthTransaction>[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const url = new URL(result.request.authorizationUrl);
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('max_age')).toBe('0');
    expect(url.searchParams.get('acr_values')).toBe(
      'urn:school:aal2 urn:school:phishing-resistant',
    );
    expect(result.request.transaction).toMatchObject({
      requestedAssurance: 'aal2',
      stepUpFreshnessSeconds: 300,
      acrValues: ['urn:school:aal2', 'urn:school:phishing-resistant'],
    });
  });

  it('rejects unbounded freshness and malformed reviewed ACR values', async () => {
    for (const stepUp of [
      { assurance: 'aal2', freshnessSeconds: 301 },
      { assurance: 'aal2', freshnessSeconds: 0 },
      { assurance: 'aal2', freshnessSeconds: 300, acrValues: [] },
      { assurance: 'aal2', freshnessSeconds: 300, acrValues: ['urn:school:aal2 bad'] },
    ]) {
      await expect(
        issueOAuthTransaction({
          configuration,
          secret,
          stepUp,
          now,
        } as Parameters<typeof issueOAuthTransaction>[0]),
      ).resolves.toMatchObject({
        ok: false,
        code: 'oauth_transaction_configuration_invalid',
      });
    }
  });

"""
    if "requests a fresh reviewed AAL2 provider authentication for step-up" not in oauth_source:
        if oauth_source.count(oauth_marker) != 1:
            raise SystemExit("OAuth test insertion marker was not found exactly once.")
        oauth_test.write_text(oauth_source.replace(oauth_marker, oauth_block + oauth_marker), encoding="utf-8")

    login_test = ROOT / "packages/policy/src/oidc-login-flow.test.ts"
    login_source = login_test.read_text(encoding="utf-8")
    login_source = login_source.replace(
        "async function preparedFlow(options: { nonceOverride?: string } = {}): Promise<{",
        """async function preparedFlow(
  options: {
    nonceOverride?: string;
    stepUp?: unknown;
    tokenOverrides?: Record<string, unknown>;
  } = {},
): Promise<{""",
    )
    login_source = login_source.replace(
        """  const started = await beginOidcLogin({
    configuration: flowConfiguration,
    returnTo: '/admin/academics',
    now,
  });""",
        """  const started = await beginOidcLogin({
    configuration: flowConfiguration,
    returnTo: '/admin/academics',
    ...(options.stepUp === undefined ? {} : { stepUp: options.stepUp }),
    now,
  } as Parameters<typeof beginOidcLogin>[0]);""",
    )
    login_source = login_source.replace(
        "  const signedIdToken = await idToken(options.nonceOverride ?? nonce);",
        "  const signedIdToken = await idToken(options.nonceOverride ?? nonce, options.tokenOverrides);",
    )
    login_marker = "  it('denies replay before another provider request is made', async () => {"
    login_block = r"""  it('accepts only fresh AAL2 authentication for a step-up transaction', async () => {
    const prepared = await preparedFlow({
      stepUp: {
        assurance: 'aal2',
        freshnessSeconds: 300,
        acrValues: ['urn:school:aal2'],
      },
    });
    const result = await completeOidcLogin({
      configuration: flowConfiguration,
      callback: {
        code: 'authorization-code',
        state: prepared.state,
        issuer: flowConfiguration.provider.configuration.issuer,
      },
      cookieHeader: prepared.cookie,
      dependencies: dependencies(prepared),
      now,
    });

    expect(result).toMatchObject({
      ok: true,
      session: { assurance: 'aal2', authenticationTime: nowSeconds - 30 },
    });
  });

  it('denies stale or AAL1 authentication for a step-up transaction', async () => {
    for (const tokenOverrides of [
      { auth_time: nowSeconds - 301 },
      { auth_time: nowSeconds - 30, acr: 'urn:school:aal1', amr: ['pwd'] },
      { auth_time: undefined },
    ]) {
      const prepared = await preparedFlow({
        stepUp: {
          assurance: 'aal2',
          freshnessSeconds: 300,
          acrValues: ['urn:school:aal2'],
        },
        tokenOverrides,
      });
      await expect(
        completeOidcLogin({
          configuration: flowConfiguration,
          callback: {
            code: 'authorization-code',
            state: prepared.state,
            issuer: flowConfiguration.provider.configuration.issuer,
          },
          cookieHeader: prepared.cookie,
          dependencies: dependencies(prepared),
          now,
        }),
      ).resolves.toMatchObject({
        ok: false,
        status: 401,
        code: 'oidc_step_up_required',
      });
    }
  });

"""
    if "accepts only fresh AAL2 authentication for a step-up transaction" not in login_source:
        if login_source.count(login_marker) != 1:
            raise SystemExit("Login-flow test insertion marker was not found exactly once.")
        login_source = login_source.replace(login_marker, login_block + login_marker)
    login_test.write_text(login_source, encoding="utf-8")


def apply_implementation() -> None:
    oauth = ROOT / "packages/policy/src/oauth-transaction.ts"
    source = oauth.read_text(encoding="utf-8")

    source = source.replace(
        "const RANDOM_BYTE_LENGTH = 32;\n",
        """const RANDOM_BYTE_LENGTH = 32;
const DEFAULT_STEP_UP_FRESHNESS_SECONDS = 5 * 60;
const MAX_STEP_UP_FRESHNESS_SECONDS = 5 * 60;
const MAX_ACR_VALUES = 5;
const MAX_ACR_VALUE_LENGTH = 256;
""",
    )

    source = source.replace(
        "export interface OAuthTransactionClaims {\n",
        """export interface OidcStepUpRequest {
  readonly assurance: 'aal2';
  readonly freshnessSeconds?: number;
  readonly acrValues?: readonly string[];
}

export interface OAuthTransactionClaims {
""",
    )

    source = source.replace(
        """  readonly requireAuthorizationResponseIssuer: boolean;
  readonly issuedAt: number;
""",
        """  readonly requireAuthorizationResponseIssuer: boolean;
  readonly requestedAssurance?: 'aal2';
  readonly stepUpFreshnessSeconds?: number;
  readonly acrValues?: readonly string[];
  readonly issuedAt: number;
""",
    )

    source = source.replace(
        """  readonly returnTo?: string;
  readonly requireAuthorizationResponseIssuer?: boolean;
""",
        """  readonly returnTo?: string;
  readonly requireAuthorizationResponseIssuer?: boolean;
  readonly stepUp?: OidcStepUpRequest;
""",
    )

    source = source.replace(
        """function transactionCookie(token: string, maxAge: number): string {
""",
        """function validAcrValues(values: readonly string[] | undefined): boolean {
  return (
    values === undefined ||
    (values.length > 0 &&
      values.length <= MAX_ACR_VALUES &&
      values.every(
        (value) =>
          value.length > 0 &&
          value.length <= MAX_ACR_VALUE_LENGTH &&
          /^[^\\s\\u0000-\\u001F\\u007F]+$/u.test(value),
      ))
  );
}

function validStepUpRequest(value: OidcStepUpRequest | undefined): boolean {
  if (value === undefined) return true;
  const freshnessSeconds = value.freshnessSeconds ?? DEFAULT_STEP_UP_FRESHNESS_SECONDS;
  return (
    value.assurance === 'aal2' &&
    Number.isInteger(freshnessSeconds) &&
    freshnessSeconds >= 1 &&
    freshnessSeconds <= MAX_STEP_UP_FRESHNESS_SECONDS &&
    validAcrValues(value.acrValues)
  );
}

function transactionCookie(token: string, maxAge: number): string {
""",
    )

    source = source.replace(
        """    typeof value.requireAuthorizationResponseIssuer !== 'boolean' ||
    typeof value.issuedAt !== 'number' ||
""",
        """    typeof value.requireAuthorizationResponseIssuer !== 'boolean' ||
    (value.requestedAssurance !== undefined && value.requestedAssurance !== 'aal2') ||
    (value.stepUpFreshnessSeconds !== undefined &&
      (typeof value.stepUpFreshnessSeconds !== 'number' ||
        !Number.isInteger(value.stepUpFreshnessSeconds) ||
        value.stepUpFreshnessSeconds < 1 ||
        value.stepUpFreshnessSeconds > MAX_STEP_UP_FRESHNESS_SECONDS)) ||
    (value.acrValues !== undefined &&
      (!Array.isArray(value.acrValues) ||
        !value.acrValues.every((entry) => typeof entry === 'string') ||
        !validAcrValues(value.acrValues))) ||
    ((value.requestedAssurance === undefined) !== (value.stepUpFreshnessSeconds === undefined)) ||
    (value.requestedAssurance === undefined && value.acrValues !== undefined) ||
    typeof value.issuedAt !== 'number' ||
""",
    )

    source = source.replace(
        """    input.secret.length < MINIMUM_SECRET_LENGTH ||
    !Number.isInteger(ttlSeconds) ||
""",
        """    input.secret.length < MINIMUM_SECRET_LENGTH ||
    !validStepUpRequest(input.stepUp) ||
    !Number.isInteger(ttlSeconds) ||
""",
    )

    source = source.replace(
        """    requireAuthorizationResponseIssuer: input.requireAuthorizationResponseIssuer ?? false,
    issuedAt,
""",
        """    requireAuthorizationResponseIssuer: input.requireAuthorizationResponseIssuer ?? false,
    ...(input.stepUp === undefined
      ? {}
      : {
          requestedAssurance: input.stepUp.assurance,
          stepUpFreshnessSeconds:
            input.stepUp.freshnessSeconds ?? DEFAULT_STEP_UP_FRESHNESS_SECONDS,
          ...(input.stepUp.acrValues === undefined
            ? {}
            : { acrValues: [...input.stepUp.acrValues] }),
        }),
    issuedAt,
""",
    )

    source = source.replace(
        """  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  return {
""",
        """  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  if (input.stepUp !== undefined) {
    authorizationUrl.searchParams.set('prompt', 'login');
    authorizationUrl.searchParams.set('max_age', '0');
    if (input.stepUp.acrValues !== undefined) {
      authorizationUrl.searchParams.set('acr_values', input.stepUp.acrValues.join(' '));
    }
  }

  return {
""",
    )
    oauth.write_text(source, encoding="utf-8")

    login = ROOT / "packages/policy/src/oidc-login-flow.ts"
    source = login.read_text(encoding="utf-8")
    source = source.replace(
        """} from './oauth-transaction.js';
""",
        """  type OidcStepUpRequest,
} from './oauth-transaction.js';
""",
    )
    source = source.replace(
        """  readonly returnTo?: string;
  readonly now?: number;
""",
        """  readonly returnTo?: string;
  readonly stepUp?: OidcStepUpRequest;
  readonly now?: number;
""",
    )
    source = source.replace(
        """    requireAuthorizationResponseIssuer:
      input.configuration.provider.authorizationResponseIssuerParameterSupported,
    ...(input.now === undefined ? {} : { now: input.now }),
""",
        """    requireAuthorizationResponseIssuer:
      input.configuration.provider.authorizationResponseIssuerParameterSupported,
    ...(input.stepUp === undefined ? {} : { stepUp: input.stepUp }),
    ...(input.now === undefined ? {} : { now: input.now }),
""",
    )
    source = source.replace(
        """    return callbackFailure(status, identity.code, identity.message);
  }

  let membership: MembershipResolution;
""",
        """    return callbackFailure(status, identity.code, identity.message);
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
""",
    )
    login.write_text(source, encoding="utf-8")

    oidc = ROOT / "packages/policy/src/oidc.ts"
    source = oidc.read_text(encoding="utf-8")
    source = source.replace(
        """  if (
    claims.iat > nowSeconds + skew ||
    (claims.nbf !== undefined && claims.nbf > nowSeconds + skew)
  ) {
""",
        """  if (
    claims.iat > nowSeconds + skew ||
    (claims.nbf !== undefined && claims.nbf > nowSeconds + skew) ||
    (claims.auth_time !== undefined && claims.auth_time > nowSeconds + skew)
  ) {
""",
    )
    oidc.write_text(source, encoding="utf-8")

    index = ROOT / "packages/policy/src/index.ts"
    source = index.read_text(encoding="utf-8")
    source = source.replace(
        """  OAuthTransactionIssueResult,
  VerifyOAuthCallbackInput,
""",
        """  OAuthTransactionIssueResult,
  OidcStepUpRequest,
  VerifyOAuthCallbackInput,
""",
    )
    index.write_text(source, encoding="utf-8")

    boundary = ROOT / "apps/platform-api/src/auth-boundary.ts"
    source = boundary.read_text(encoding="utf-8")
    source = source.replace(
        """    readonly providerTokensWithheldFromBrowser: true;
    readonly stepUpAssurance: true;
""",
        """    readonly providerTokensWithheldFromBrowser: true;
    readonly stepUpAssurance: true;
    readonly forcedReauthentication: true;
    readonly boundedFreshAuthentication: true;
    readonly reviewedAcrValues: true;
""",
    )
    source = source.replace(
        """      providerTokensWithheldFromBrowser: true,
      stepUpAssurance: true,
""",
        """      providerTokensWithheldFromBrowser: true,
      stepUpAssurance: true,
      forcedReauthentication: true,
      boundedFreshAuthentication: true,
      reviewedAcrValues: true,
""",
    )
    boundary.write_text(source, encoding="utf-8")

    boundary_test = ROOT / "apps/platform-api/src/auth-boundary.test.ts"
    source = boundary_test.read_text(encoding="utf-8")
    source = source.replace(
        """        providerTokensWithheldFromBrowser: true,
        stepUpAssurance: true,
""",
        """        providerTokensWithheldFromBrowser: true,
        stepUpAssurance: true,
        forcedReauthentication: true,
        boundedFreshAuthentication: true,
        reviewedAcrValues: true,
""",
    )
    boundary_test.write_text(source, encoding="utf-8")

    staging = ROOT / ".github/workflows/deploy-cloudflare-staging.yml"
    source = staging.read_text(encoding="utf-8")
    source = source.replace(
        """              'providerTokensWithheldFromBrowser', 'stepUpAssurance'
""",
        """              'providerTokensWithheldFromBrowser', 'stepUpAssurance',
              'forcedReauthentication', 'boundedFreshAuthentication', 'reviewedAcrValues'
""",
    )
    staging.write_text(source, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"test", "implementation"}:
        raise SystemExit("usage: implement_auth_06_step_up.py test|implementation")
    if sys.argv[1] == "test":
        add_tests()
    else:
        apply_implementation()


if __name__ == "__main__":
    main()
