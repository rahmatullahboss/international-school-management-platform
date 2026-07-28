import { describe, expect, it } from 'vitest';

import {
  IdentityDirectory,
  PolicyEngine,
  PrivilegedAccessRegistry,
  type AuthorizationRequest,
} from './index.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const campusA = '11111111-cccc-4ccc-8ccc-cccccccccccc';

describe('identity and policy foundation', () => {
  it('links external accounts to tenant people without merging identities implicitly', () => {
    const identities = new IdentityDirectory();
    const account = identities.registerAccount('oidc', 'subject-123');
    identities.linkPerson(account.accountId, tenantA, 'person-a');
    identities.linkPerson(account.accountId, tenantB, 'person-b');

    expect(identities.resolvePerson(account.accountId, tenantA)).toBe('person-a');
    expect(identities.resolvePerson(account.accountId, tenantB)).toBe('person-b');
    expect(() => identities.linkPerson(account.accountId, tenantA, 'person-other')).toThrow(
      'Account is already linked for this tenant',
    );
  });

  it('denies by default and enforces tenant and campus scope', () => {
    const engine = new PolicyEngine();
    engine.registerRole('teacher', [
      { permission: 'attendance.read', assurance: 'aal1' },
      { permission: 'attendance.write', assurance: 'aal1' },
    ]);
    engine.assignRole({
      principalId: 'user-1',
      tenantId: tenantA,
      campusId: campusA,
      roleId: 'teacher',
    });

    const base: AuthorizationRequest = {
      principalId: 'user-1',
      tenantId: tenantA,
      campusId: campusA,
      permission: 'attendance.read',
      assurance: 'aal1',
    };

    expect(engine.authorize(base)).toEqual({ allowed: true, reason: 'role-grant' });
    expect(engine.authorize({ ...base, permission: 'finance.refund' })).toEqual({
      allowed: false,
      reason: 'permission-not-granted',
    });
    expect(engine.authorize({ ...base, tenantId: tenantB })).toEqual({
      allowed: false,
      reason: 'scope-mismatch',
    });
    expect(engine.authorize({ ...base, campusId: 'other-campus' })).toEqual({
      allowed: false,
      reason: 'scope-mismatch',
    });
  });

  it('requires step-up assurance for sensitive actions', () => {
    const engine = new PolicyEngine();
    engine.registerRole('finance-admin', [{ permission: 'finance.refund', assurance: 'aal2' }]);
    engine.assignRole({ principalId: 'user-2', tenantId: tenantA, roleId: 'finance-admin' });

    const request = {
      principalId: 'user-2',
      tenantId: tenantA,
      permission: 'finance.refund',
    } as const;

    expect(engine.authorize({ ...request, assurance: 'aal1' })).toEqual({
      allowed: false,
      reason: 'step-up-required',
    });
    expect(engine.authorize({ ...request, assurance: 'aal2' })).toEqual({
      allowed: true,
      reason: 'role-grant',
    });
  });

  it('allows support access only after approval and before expiry', () => {
    const registry = new PrivilegedAccessRegistry();
    const grant = registry.request({
      tenantId: tenantA,
      principalId: 'support-user',
      reason: 'Investigate failed tenant provisioning',
      expiresAt: new Date('2026-07-28T02:00:00Z'),
      requestedAt: new Date('2026-07-28T00:00:00Z'),
    });

    expect(registry.isActive(grant.grantId, new Date('2026-07-28T00:30:00Z'))).toBe(false);
    registry.approve(grant.grantId, 'tenant-admin', new Date('2026-07-28T00:15:00Z'));
    expect(registry.isActive(grant.grantId, new Date('2026-07-28T00:30:00Z'))).toBe(true);
    expect(registry.isActive(grant.grantId, new Date('2026-07-28T02:00:00Z'))).toBe(false);
    expect(() =>
      registry.request({
        tenantId: tenantA,
        principalId: 'support-user',
        reason: ' ',
        expiresAt: new Date('2026-07-28T02:00:00Z'),
        requestedAt: new Date('2026-07-28T00:00:00Z'),
      }),
    ).toThrow('Privileged access reason is required');
  });
});
