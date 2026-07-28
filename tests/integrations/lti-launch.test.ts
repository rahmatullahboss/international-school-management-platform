import { describe, expect, test } from 'vitest';

import {
  LtiLaunchSessionStore,
  LtiLaunchVerifier,
  LtiRegistrationRegistry,
  type VerifiedCompactAssertion,
} from '../../packages/modules/integrations/src/index.js';

const registration = {
  tenantId: 'tenant-1',
  registrationId: 'lti-reg-1',
  issuer: 'https://platform.example.test',
  clientId: 'client-1',
  authorizationEndpoint: 'https://platform.example.test/authorize',
  accessEndpoint: 'https://platform.example.test/access',
  keySetUrl: 'https://platform.example.test/keys',
  deploymentIds: ['deployment-1'],
  allowedTargetLinkUris: ['https://school.example.test/lti/launch'],
};

function claims(nonce: string, deploymentId = 'deployment-1'): Record<string, unknown> {
  return {
    iss: registration.issuer,
    aud: registration.clientId,
    sub: 'platform-user-1',
    nonce,
    iat: 1_000,
    exp: 2_000,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': deploymentId,
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri':
      'https://school.example.test/lti/launch',
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    ],
    'https://purl.imsglobal.org/spec/lti/claim/context': { id: 'class-1', title: 'Math' },
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': { id: 'resource-1' },
    email: 'not-returned@example.test',
  };
}

function fixture(assertion: VerifiedCompactAssertion) {
  const registry = new LtiRegistrationRegistry();
  registry.register(registration);
  const values = ['state-1', 'nonce-1'];
  const sessions = new LtiLaunchSessionStore({
    valueFactory: () => values.shift() ?? 'generated',
    now: () => new Date('1970-01-01T00:16:40.000Z'),
    ttlSeconds: 900,
  });
  const session = sessions.issue({
    tenantId: registration.tenantId,
    registrationId: registration.registrationId,
    targetLinkUri: registration.allowedTargetLinkUris[0] ?? '',
    loginHint: 'user-1',
  });
  const verifier = new LtiLaunchVerifier(registry, sessions, {
    compactVerifier: () => Promise.resolve(assertion),
  });
  return { verifier, sessions, session };
}

describe('LTI 1.3 launch verification', () => {
  test('returns only the approved launch context after verification', async () => {
    const assertion = {
      header: { alg: 'RS256', kid: 'key-1' },
      claims: claims('nonce-1'),
    };
    const { verifier } = fixture(assertion);

    const launch = await verifier.verify({
      compact: 'sample-assertion',
      nowSeconds: 1_500,
    });

    expect(launch).toEqual({
      tenantId: 'tenant-1',
      registrationId: 'lti-reg-1',
      subject: 'platform-user-1',
      deploymentId: 'deployment-1',
      messageType: 'LtiResourceLinkRequest',
      targetLinkUri: 'https://school.example.test/lti/launch',
      roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
      contextId: 'class-1',
      resourceLinkId: 'resource-1',
    });
    expect(launch).not.toHaveProperty('email');
  });

  test('rejects unregistered deployment without consuming the nonce', async () => {
    const assertion = {
      header: { alg: 'RS256', kid: 'key-1' },
      claims: claims('nonce-1', 'other-deployment'),
    };
    const { verifier, sessions, session } = fixture(assertion);

    await expect(
      verifier.verify({ compact: 'sample-assertion', nowSeconds: 1_500 }),
    ).rejects.toThrow('LTI deployment is not registered');
    expect(sessions.consumeNonce(session.nonce, new Date('1970-01-01T00:20:00.000Z'))).toBe(
      session,
    );
  });

  test('rejects invalid algorithm, audience, time and target link', async () => {
    const scenarios: Array<[VerifiedCompactAssertion, string]> = [
      [{ header: { alg: 'none' }, claims: claims('nonce-1') }, 'LTI launch must use RS256'],
      [
        { header: { alg: 'RS256' }, claims: { ...claims('nonce-1'), aud: 'other-client' } },
        'LTI audience does not match a registration',
      ],
      [
        { header: { alg: 'RS256' }, claims: { ...claims('nonce-1'), exp: 1_400 } },
        'LTI launch assertion is expired',
      ],
      [
        {
          header: { alg: 'RS256' },
          claims: {
            ...claims('nonce-1'),
            'https://purl.imsglobal.org/spec/lti/claim/target_link_uri':
              'https://attacker.example.test/launch',
          },
        },
        'LTI target link is not registered',
      ],
    ];

    for (const [assertion, message] of scenarios) {
      const { verifier } = fixture(assertion);
      await expect(
        verifier.verify({ compact: 'sample-assertion', nowSeconds: 1_500 }),
      ).rejects.toThrow(message);
    }
  });

  test('consumes a valid nonce once', async () => {
    const assertion = { header: { alg: 'RS256' }, claims: claims('nonce-1') };
    const { verifier } = fixture(assertion);

    await expect(
      verifier.verify({ compact: 'sample-assertion', nowSeconds: 1_500 }),
    ).resolves.toBeDefined();
    await expect(
      verifier.verify({ compact: 'sample-assertion', nowSeconds: 1_500 }),
    ).rejects.toThrow('LTI launch nonce is unknown or already used');
  });
});
