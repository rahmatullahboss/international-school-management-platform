import { describe, expect, test } from 'vitest';

import {
  LtiLaunchSessionStore,
  LtiRegistrationRegistry,
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

describe('LTI registration and sessions', () => {
  test('publishes immutable HTTPS registrations', () => {
    const registry = new LtiRegistrationRegistry();
    const stored = registry.register(registration);

    expect(Object.isFrozen(stored)).toBe(true);
    expect(registry.resolve(stored.issuer, stored.clientId)).toBe(stored);
    expect(registry.resolveById(stored.registrationId)).toBe(stored);
    expect(() => registry.register(stored)).toThrow('LTI registration is immutable');
    expect(() =>
      registry.register({
        ...registration,
        registrationId: 'bad-reg',
        authorizationEndpoint: 'http://platform.example.test/auth',
      }),
    ).toThrow('LTI endpoints and target links must use HTTPS');
  });

  test('issues expiring one-time state and nonce records', () => {
    const values = ['state-1', 'nonce-1'];
    const sessions = new LtiLaunchSessionStore({
      valueFactory: () => values.shift() ?? 'generated',
      now: () => new Date('2026-07-28T04:00:00.000Z'),
      ttlSeconds: 300,
    });
    const session = sessions.issue({
      tenantId: registration.tenantId,
      registrationId: registration.registrationId,
      targetLinkUri: registration.allowedTargetLinkUris[0] ?? '',
      loginHint: 'user-1',
      messageHint: 'resource-1',
    });

    expect(session).toMatchObject({ state: 'state-1', nonce: 'nonce-1' });
    expect(sessions.consumeState(session.state, new Date('2026-07-28T04:01:00.000Z'))).toBe(
      session,
    );
    expect(() =>
      sessions.consumeState(session.state, new Date('2026-07-28T04:01:01.000Z')),
    ).toThrow('LTI login state is unknown or already used');
    expect(sessions.consumeNonce(session.nonce, new Date('2026-07-28T04:01:02.000Z'))).toBe(
      session,
    );
    expect(() =>
      sessions.consumeNonce(session.nonce, new Date('2026-07-28T04:01:03.000Z')),
    ).toThrow('LTI launch nonce is unknown or already used');
  });

  test('rejects expired state without consuming its nonce', () => {
    const values = ['state-2', 'nonce-2'];
    const sessions = new LtiLaunchSessionStore({
      valueFactory: () => values.shift() ?? 'generated',
      now: () => new Date('2026-07-28T04:00:00.000Z'),
      ttlSeconds: 60,
    });
    const session = sessions.issue({
      tenantId: registration.tenantId,
      registrationId: registration.registrationId,
      targetLinkUri: registration.allowedTargetLinkUris[0] ?? '',
      loginHint: 'user-1',
    });

    expect(() =>
      sessions.consumeState(session.state, new Date('2026-07-28T04:02:00.000Z')),
    ).toThrow('LTI login state is expired');
    expect(sessions.consumeNonce(session.nonce, new Date('2026-07-28T04:00:30.000Z'))).toBe(
      session,
    );
  });
});
