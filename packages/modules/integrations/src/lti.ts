import { cloneAndFreeze } from './common.js';

export interface LtiRegistrationInput {
  tenantId: string;
  registrationId: string;
  issuer: string;
  clientId: string;
  authorizationEndpoint: string;
  accessEndpoint: string;
  keySetUrl: string;
  deploymentIds: readonly string[];
  allowedTargetLinkUris: readonly string[];
}

export type LtiRegistration = Readonly<LtiRegistrationInput>;

function requireHttps(value: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('LTI endpoints and target links must use HTTPS');
  }
}

function requireUnique(values: readonly string[], field: string): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error(`${field} must not be empty`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} must be unique`);
  return Object.freeze(normalized);
}

export class LtiRegistrationRegistry {
  readonly #byIssuerClient = new Map<string, LtiRegistration>();
  readonly #byId = new Map<string, LtiRegistration>();

  register(input: LtiRegistrationInput): LtiRegistration {
    for (const endpoint of [
      input.issuer,
      input.authorizationEndpoint,
      input.accessEndpoint,
      input.keySetUrl,
      ...input.allowedTargetLinkUris,
    ]) {
      requireHttps(endpoint);
    }
    if (this.#byId.has(input.registrationId)) throw new Error('LTI registration is immutable');
    const lookupKey = this.#lookupKey(input.issuer, input.clientId);
    if (this.#byIssuerClient.has(lookupKey))
      throw new Error('LTI issuer and client are already registered');
    const stored = cloneAndFreeze<LtiRegistrationInput>({
      ...input,
      deploymentIds: requireUnique(input.deploymentIds, 'LTI deployment IDs'),
      allowedTargetLinkUris: requireUnique(input.allowedTargetLinkUris, 'LTI target links'),
    });
    this.#byIssuerClient.set(lookupKey, stored);
    this.#byId.set(stored.registrationId, stored);
    return stored;
  }

  resolve(issuer: string, clientId: string): LtiRegistration | undefined {
    return this.#byIssuerClient.get(this.#lookupKey(issuer, clientId));
  }

  resolveById(registrationId: string): LtiRegistration | undefined {
    return this.#byId.get(registrationId);
  }

  #lookupKey(issuer: string, clientId: string): string {
    return `${issuer}:${clientId}`;
  }
}

export interface LtiLaunchSessionInput {
  tenantId: string;
  registrationId: string;
  targetLinkUri: string;
  loginHint: string;
  messageHint?: string;
}

export interface LtiLaunchSession extends LtiLaunchSessionInput {
  state: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface LtiLaunchSessionStoreOptions {
  valueFactory?: () => string;
  now?: () => Date;
  ttlSeconds?: number;
}

export interface VerifiedCompactAssertion {
  header: Readonly<Record<string, unknown>>;
  claims: Readonly<Record<string, unknown>>;
}

export interface CompactVerificationInput {
  compact: string;
  keyDocument?: JsonWebKey;
}

export type CompactAssertionVerifier = (
  input: CompactVerificationInput,
) => Promise<Readonly<VerifiedCompactAssertion>>;

function decodeBase64Url(value: string): Uint8Array {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value: string): Readonly<Record<string, unknown>> {
  const decoded = new TextDecoder().decode(decodeBase64Url(value));
  const parsed: unknown = JSON.parse(decoded);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Compact assertion part must be an object');
  }
  return parsed as Readonly<Record<string, unknown>>;
}

export async function verifyRs256Compact(
  input: CompactVerificationInput,
): Promise<Readonly<VerifiedCompactAssertion>> {
  const parts = input.compact.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Compact assertion is malformed');
  }
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256') throw new Error('LTI launch must use RS256');
  if (!input.keyDocument) throw new Error('LTI verification key is required');
  const key = await crypto.subtle.importKey(
    'jwk',
    input.keyDocument,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signatureBytes = Uint8Array.from(decodeBase64Url(parts[2]));
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    signatureBytes.buffer,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error('LTI compact assertion signature is invalid');
  return cloneAndFreeze({ header, claims });
}

export class LtiLaunchSessionStore {
  readonly #states = new Map<string, Readonly<LtiLaunchSession>>();
  readonly #nonces = new Map<string, Readonly<LtiLaunchSession>>();
  readonly #valueFactory: () => string;
  readonly #now: () => Date;
  readonly #ttlSeconds: number;

  constructor(options: LtiLaunchSessionStoreOptions = {}) {
    this.#valueFactory = options.valueFactory ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
    this.#ttlSeconds = options.ttlSeconds ?? 300;
    if (!Number.isInteger(this.#ttlSeconds) || this.#ttlSeconds < 30 || this.#ttlSeconds > 900) {
      throw new Error('LTI launch session TTL must be between 30 and 900 seconds');
    }
  }

  issue(input: LtiLaunchSessionInput): Readonly<LtiLaunchSession> {
    requireHttps(input.targetLinkUri);
    const issuedAt = this.#now();
    const session = cloneAndFreeze<LtiLaunchSession>({
      ...input,
      state: this.#uniqueValue(this.#states),
      nonce: this.#uniqueValue(this.#nonces),
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + this.#ttlSeconds * 1_000),
    });
    this.#states.set(session.state, session);
    this.#nonces.set(session.nonce, session);
    return session;
  }

  consumeState(state: string, now = this.#now()): Readonly<LtiLaunchSession> {
    const session = this.#states.get(state);
    if (!session) throw new Error('LTI login state is unknown or already used');
    this.#states.delete(state);
    if (session.expiresAt <= now) throw new Error('LTI login state is expired');
    return session;
  }

  consumeNonce(nonce: string, now = this.#now()): Readonly<LtiLaunchSession> {
    const session = this.#nonces.get(nonce);
    if (!session) throw new Error('LTI launch nonce is unknown or already used');
    this.#nonces.delete(nonce);
    if (session.expiresAt <= now) throw new Error('LTI launch nonce is expired');
    return session;
  }

  peekNonce(nonce: string): Readonly<LtiLaunchSession> | undefined {
    return this.#nonces.get(nonce);
  }

  #uniqueValue(index: ReadonlyMap<string, unknown>): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const value = this.#valueFactory();
      if (value.length >= 6 && !index.has(value)) return value;
    }
    throw new Error('Unable to allocate a unique LTI launch value');
  }
}

const deploymentClaim = 'https://purl.imsglobal.org/spec/lti/claim/deployment_id';
const messageTypeClaim = 'https://purl.imsglobal.org/spec/lti/claim/message_type';
const versionClaim = 'https://purl.imsglobal.org/spec/lti/claim/version';
const targetLinkClaim = 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri';
const rolesClaim = 'https://purl.imsglobal.org/spec/lti/claim/roles';
const contextClaim = 'https://purl.imsglobal.org/spec/lti/claim/context';
const resourceLinkClaim = 'https://purl.imsglobal.org/spec/lti/claim/resource_link';

export interface LtiLaunchVerificationInput {
  compact: string;
  keyDocument?: JsonWebKey;
  nowSeconds: number;
}

export interface LtiLaunchContext {
  tenantId: string;
  registrationId: string;
  subject: string;
  deploymentId: string;
  messageType: string;
  targetLinkUri: string;
  roles: readonly string[];
  contextId: string | null;
  resourceLinkId: string | null;
}

export interface LtiLaunchVerifierOptions {
  compactVerifier?: CompactAssertionVerifier;
  clockSkewSeconds?: number;
}

function stringClaim(claims: Readonly<Record<string, unknown>>, name: string): string {
  const value = claims[name];
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`LTI claim is missing: ${name}`);
  return value;
}

function optionalObjectId(claims: Readonly<Record<string, unknown>>, name: string): string | null {
  const value = claims[name];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function audienceValues(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
  throw new Error('LTI audience is invalid');
}

export class LtiLaunchVerifier {
  readonly #registry: LtiRegistrationRegistry;
  readonly #sessions: LtiLaunchSessionStore;
  readonly #compactVerifier: CompactAssertionVerifier;
  readonly #clockSkewSeconds: number;

  constructor(
    registry: LtiRegistrationRegistry,
    sessions: LtiLaunchSessionStore,
    options: LtiLaunchVerifierOptions = {},
  ) {
    this.#registry = registry;
    this.#sessions = sessions;
    this.#compactVerifier = options.compactVerifier ?? verifyRs256Compact;
    this.#clockSkewSeconds = options.clockSkewSeconds ?? 60;
  }

  async verify(input: LtiLaunchVerificationInput): Promise<Readonly<LtiLaunchContext>> {
    const verificationInput: CompactVerificationInput = input.keyDocument
      ? { compact: input.compact, keyDocument: input.keyDocument }
      : { compact: input.compact };
    const assertion = await this.#compactVerifier(verificationInput);
    if (assertion.header.alg !== 'RS256') throw new Error('LTI launch must use RS256');
    const issuer = stringClaim(assertion.claims, 'iss');
    const audiences = audienceValues(assertion.claims.aud);
    const registrations = audiences
      .map((audience) => this.#registry.resolve(issuer, audience))
      .filter((registration): registration is LtiRegistration => registration !== undefined);
    if (registrations.length !== 1) throw new Error('LTI audience does not match a registration');
    const registration = registrations[0];
    if (!registration) throw new Error('LTI audience does not match a registration');

    const issuedAt = assertion.claims.iat;
    const expiresAt = assertion.claims.exp;
    if (typeof issuedAt !== 'number' || issuedAt > input.nowSeconds + this.#clockSkewSeconds) {
      throw new Error('LTI launch assertion issue time is invalid');
    }
    if (typeof expiresAt !== 'number' || expiresAt <= input.nowSeconds - this.#clockSkewSeconds) {
      throw new Error('LTI launch assertion is expired');
    }

    const subject = stringClaim(assertion.claims, 'sub');
    const nonce = stringClaim(assertion.claims, 'nonce');
    const deploymentId = stringClaim(assertion.claims, deploymentClaim);
    const messageType = stringClaim(assertion.claims, messageTypeClaim);
    const version = stringClaim(assertion.claims, versionClaim);
    const targetLinkUri = stringClaim(assertion.claims, targetLinkClaim);
    if (version !== '1.3.0') throw new Error('LTI launch version is not supported');
    if (!['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'].includes(messageType)) {
      throw new Error('LTI message type is not supported');
    }
    if (!registration.deploymentIds.includes(deploymentId)) {
      throw new Error('LTI deployment is not registered');
    }
    if (!registration.allowedTargetLinkUris.includes(targetLinkUri)) {
      throw new Error('LTI target link is not registered');
    }

    const session = this.#sessions.peekNonce(nonce);
    if (!session) throw new Error('LTI launch nonce is unknown or already used');
    if (session.registrationId !== registration.registrationId) {
      throw new Error('LTI launch nonce belongs to another registration');
    }
    if (session.targetLinkUri !== targetLinkUri)
      throw new Error('LTI target link does not match login state');
    this.#sessions.consumeNonce(nonce, new Date(input.nowSeconds * 1_000));

    const rolesValue = assertion.claims[rolesClaim];
    const roles = Array.isArray(rolesValue)
      ? rolesValue.filter((role): role is string => typeof role === 'string')
      : [];
    return cloneAndFreeze({
      tenantId: registration.tenantId,
      registrationId: registration.registrationId,
      subject,
      deploymentId,
      messageType,
      targetLinkUri,
      roles,
      contextId: optionalObjectId(assertion.claims, contextClaim),
      resourceLinkId: optionalObjectId(assertion.claims, resourceLinkClaim),
    });
  }
}
