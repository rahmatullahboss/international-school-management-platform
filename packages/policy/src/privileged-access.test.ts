import { describe, expect, it } from 'vitest';

import { PrivilegedAccessRegistry } from './privileged-access.js';

const requestedAt = new Date('2026-08-19T10:00:00.000Z');
const expiresAt = new Date('2026-08-19T11:00:00.000Z');

function requestGrant(registry: PrivilegedAccessRegistry) {
  return registry.request({
    tenantId: 'tenant-1',
    principalId: 'support-engineer-1',
    reason: '  Investigate tenant provisioning failure  ',
    requestedAt,
    expiresAt,
  });
}

describe('PrivilegedAccessRegistry', () => {
  it('normalizes the reason and rejects empty or non-expiring requests', () => {
    const registry = new PrivilegedAccessRegistry();
    const grant = requestGrant(registry);

    expect(grant.reason).toBe('Investigate tenant provisioning failure');
    expect(Object.isFrozen(grant)).toBe(true);
    expect(() =>
      registry.request({
        tenantId: 'tenant-1',
        principalId: 'support-engineer-1',
        reason: '   ',
        requestedAt,
        expiresAt,
      }),
    ).toThrow('Privileged access reason is required');
    expect(() =>
      registry.request({
        tenantId: 'tenant-1',
        principalId: 'support-engineer-1',
        reason: 'Investigate tenant provisioning failure',
        requestedAt,
        expiresAt: requestedAt,
      }),
    ).toThrow('Privileged access expiry must be after request time');
  });

  it('rejects self-approval and approval after the grant has expired', () => {
    const registry = new PrivilegedAccessRegistry();
    const grant = requestGrant(registry);

    expect(() =>
      registry.approve(grant.grantId, grant.principalId, new Date('2026-08-19T10:05:00.000Z')),
    ).toThrow('Privileged access approval requires an independent approver');
    expect(() => registry.approve(grant.grantId, 'tenant-admin', expiresAt)).toThrow(
      'Expired privileged access cannot be approved',
    );
  });

  it('is active only after independent approval, before expiry and before revocation', () => {
    const registry = new PrivilegedAccessRegistry();
    const grant = requestGrant(registry);
    const approvedAt = new Date('2026-08-19T10:05:00.000Z');

    expect(registry.isActive(grant.grantId, new Date('2026-08-19T10:04:59.000Z'))).toBe(false);
    const approved = registry.approve(grant.grantId, 'tenant-admin', approvedAt);
    expect(approved).toMatchObject({ approvedBy: 'tenant-admin', approvedAt });
    expect(registry.isActive(grant.grantId, approvedAt)).toBe(true);
    expect(registry.isActive(grant.grantId, expiresAt)).toBe(false);

    const revokedAt = new Date('2026-08-19T10:30:00.000Z');
    const revoked = registry.revoke(grant.grantId, revokedAt);
    expect(revoked.revokedAt).toEqual(revokedAt);
    expect(registry.isActive(grant.grantId, new Date('2026-08-19T10:29:59.000Z'))).toBe(true);
    expect(registry.isActive(grant.grantId, revokedAt)).toBe(false);
  });

  it('fails closed for unknown grants', () => {
    const registry = new PrivilegedAccessRegistry();

    expect(registry.isActive('missing-grant', requestedAt)).toBe(false);
    expect(() => registry.approve('missing-grant', 'tenant-admin', requestedAt)).toThrow(
      'Unknown privileged access grant',
    );
    expect(() => registry.revoke('missing-grant', requestedAt)).toThrow(
      'Unknown privileged access grant',
    );
  });
});
