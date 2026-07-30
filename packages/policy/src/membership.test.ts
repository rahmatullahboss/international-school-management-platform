import { describe, expect, it } from 'vitest';

import { MembershipDirectory } from './membership.js';

function directory(): MembershipDirectory {
  const memberships = new MembershipDirectory();
  memberships.register({
    membershipId: 'membership-main-admin',
    issuer: 'https://identity.school.test',
    providerSubject: 'provider-user-123',
    principalId: 'principal-1',
    tenantId: 'tenant-pilot-001',
    campusIds: ['campus-main'],
    roleIds: ['school-admin'],
    status: 'active',
  });
  return memberships;
}

describe('membership directory', () => {
  it('resolves the only active tenant and campus without browser-declared roles', () => {
    expect(
      directory().resolve('https://identity.school.test', 'provider-user-123'),
    ).toEqual({
      ok: true,
      context: {
        membershipId: 'membership-main-admin',
        principalId: 'principal-1',
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        roleIds: ['school-admin'],
      },
    });
  });

  it('denies unknown, suspended and revoked identities', () => {
    expect(directory().resolve('https://identity.school.test', 'unknown')).toEqual({
      ok: false,
      code: 'membership_not_found',
    });

    const inactive = new MembershipDirectory();
    inactive.register({
      membershipId: 'suspended',
      issuer: 'https://identity.school.test',
      providerSubject: 'provider-user-123',
      principalId: 'principal-1',
      tenantId: 'tenant-pilot-001',
      campusIds: ['campus-main'],
      roleIds: ['school-admin'],
      status: 'suspended',
    });
    inactive.register({
      membershipId: 'revoked',
      issuer: 'https://identity.school.test',
      providerSubject: 'provider-user-123',
      principalId: 'principal-1',
      tenantId: 'tenant-legacy',
      campusIds: [],
      roleIds: ['guardian'],
      status: 'revoked',
    });
    expect(inactive.resolve('https://identity.school.test', 'provider-user-123')).toEqual({
      ok: false,
      code: 'membership_inactive',
    });
  });

  it('requires explicit tenant selection for a multi-tenant identity', () => {
    const memberships = directory();
    memberships.register({
      membershipId: 'membership-second-guardian',
      issuer: 'https://identity.school.test',
      providerSubject: 'provider-user-123',
      principalId: 'principal-1',
      tenantId: 'tenant-partner-002',
      campusIds: ['campus-east'],
      roleIds: ['guardian'],
      status: 'active',
    });

    const result = memberships.resolve('https://identity.school.test', 'provider-user-123');
    expect(result).toMatchObject({
      ok: false,
      code: 'membership_selection_required',
    });
    if (result.ok || result.options === undefined) throw new Error('Expected membership options.');
    expect(result.options.map((option) => option.tenantId)).toEqual([
      'tenant-pilot-001',
      'tenant-partner-002',
    ]);
  });

  it('denies cross-tenant and cross-campus selection', () => {
    const memberships = directory();
    expect(
      memberships.resolve('https://identity.school.test', 'provider-user-123', {
        tenantId: 'tenant-attacker',
      }),
    ).toEqual({ ok: false, code: 'membership_scope_denied' });
    expect(
      memberships.resolve('https://identity.school.test', 'provider-user-123', {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-other',
      }),
    ).toEqual({ ok: false, code: 'membership_scope_denied' });
  });

  it('requires campus selection when one membership spans multiple campuses', () => {
    const memberships = new MembershipDirectory();
    memberships.register({
      membershipId: 'membership-multi-campus',
      issuer: 'https://identity.school.test',
      providerSubject: 'teacher-123',
      principalId: 'teacher-1',
      tenantId: 'tenant-pilot-001',
      campusIds: ['campus-main', 'campus-east'],
      roleIds: ['teacher'],
      status: 'active',
    });

    expect(
      memberships.resolve('https://identity.school.test', 'teacher-123', {
        tenantId: 'tenant-pilot-001',
      }),
    ).toMatchObject({ ok: false, code: 'membership_selection_required' });
    expect(
      memberships.resolve('https://identity.school.test', 'teacher-123', {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-east',
      }),
    ).toMatchObject({
      ok: true,
      context: { tenantId: 'tenant-pilot-001', campusId: 'campus-east', roleIds: ['teacher'] },
    });
  });

  it('keeps an existing membership id immutable', () => {
    const memberships = directory();
    expect(() =>
      memberships.register({
        membershipId: 'membership-main-admin',
        issuer: 'https://identity.school.test',
        providerSubject: 'provider-user-123',
        principalId: 'attacker',
        tenantId: 'tenant-pilot-001',
        campusIds: ['campus-main'],
        roleIds: ['school-admin'],
        status: 'active',
      }),
    ).toThrow('different record');
  });
});
