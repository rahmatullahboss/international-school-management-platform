export type MembershipStatus = 'active' | 'suspended' | 'revoked';

export interface IdentityMembership {
  readonly membershipId: string;
  readonly issuer: string;
  readonly providerSubject: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly campusIds: readonly string[];
  readonly roleIds: readonly string[];
  readonly status: MembershipStatus;
}

export interface MembershipSelection {
  readonly tenantId?: string;
  readonly campusId?: string;
}

export interface ResolvedMembershipContext {
  readonly membershipId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly campusId?: string;
  readonly roleIds: readonly string[];
}

export interface MembershipOption {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly campusIds: readonly string[];
  readonly roleIds: readonly string[];
}

export type MembershipResolution =
  | { readonly ok: true; readonly context: ResolvedMembershipContext }
  | {
      readonly ok: false;
      readonly code:
        | 'membership_not_found'
        | 'membership_inactive'
        | 'membership_selection_required'
        | 'membership_scope_denied';
      readonly options?: readonly MembershipOption[];
    };

function identityKey(issuer: string, providerSubject: string): string {
  return `${issuer.trim().replace(/\/$/u, '')}\u0000${providerSubject.trim()}`;
}

function canonicalMembership(membership: IdentityMembership): IdentityMembership {
  if (
    membership.membershipId.trim() === '' ||
    membership.issuer.trim() === '' ||
    membership.providerSubject.trim() === '' ||
    membership.principalId.trim() === '' ||
    membership.tenantId.trim() === '' ||
    membership.roleIds.length === 0
  ) {
    throw new Error('Membership identity, tenant and role fields are required.');
  }
  const campusIds = [...new Set(membership.campusIds.map((value) => value.trim()))].filter(Boolean);
  const roleIds = [...new Set(membership.roleIds.map((value) => value.trim()))].filter(Boolean);
  if (roleIds.length === 0) throw new Error('At least one role is required.');
  return Object.freeze({
    ...membership,
    issuer: membership.issuer.trim().replace(/\/$/u, ''),
    providerSubject: membership.providerSubject.trim(),
    principalId: membership.principalId.trim(),
    tenantId: membership.tenantId.trim(),
    campusIds: Object.freeze(campusIds),
    roleIds: Object.freeze(roleIds),
  });
}

function optionFromMembership(membership: IdentityMembership): MembershipOption {
  return {
    membershipId: membership.membershipId,
    tenantId: membership.tenantId,
    campusIds: membership.campusIds,
    roleIds: membership.roleIds,
  };
}

export class MembershipDirectory {
  readonly #memberships = new Map<string, IdentityMembership>();
  readonly #identityMembershipIds = new Map<string, string[]>();

  register(membership: IdentityMembership): IdentityMembership {
    const canonical = canonicalMembership(membership);
    const existing = this.#memberships.get(canonical.membershipId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(canonical)) {
        throw new Error('Membership id already belongs to a different record.');
      }
      return existing;
    }

    this.#memberships.set(canonical.membershipId, canonical);
    const key = identityKey(canonical.issuer, canonical.providerSubject);
    const memberships = this.#identityMembershipIds.get(key) ?? [];
    memberships.push(canonical.membershipId);
    this.#identityMembershipIds.set(key, memberships);
    return canonical;
  }

  resolve(
    issuer: string,
    providerSubject: string,
    selection: MembershipSelection = {},
  ): MembershipResolution {
    const membershipIds =
      this.#identityMembershipIds.get(identityKey(issuer, providerSubject)) ?? [];
    const memberships = membershipIds
      .map((membershipId) => this.#memberships.get(membershipId))
      .filter((membership): membership is IdentityMembership => membership !== undefined);
    if (memberships.length === 0) return { ok: false, code: 'membership_not_found' };

    const active = memberships.filter((membership) => membership.status === 'active');
    if (active.length === 0) return { ok: false, code: 'membership_inactive' };

    const tenantScoped =
      selection.tenantId === undefined
        ? active
        : active.filter((membership) => membership.tenantId === selection.tenantId);
    if (tenantScoped.length === 0) return { ok: false, code: 'membership_scope_denied' };

    if (
      selection.tenantId === undefined &&
      new Set(tenantScoped.map((item) => item.tenantId)).size > 1
    ) {
      return {
        ok: false,
        code: 'membership_selection_required',
        options: tenantScoped.map(optionFromMembership),
      };
    }

    if (tenantScoped.length > 1) {
      return {
        ok: false,
        code: 'membership_selection_required',
        options: tenantScoped.map(optionFromMembership),
      };
    }

    const membership = tenantScoped[0];
    if (membership === undefined) return { ok: false, code: 'membership_not_found' };

    let campusId = selection.campusId;
    if (membership.campusIds.length === 0) {
      if (campusId !== undefined) return { ok: false, code: 'membership_scope_denied' };
      campusId = undefined;
    } else if (campusId === undefined && membership.campusIds.length === 1) {
      campusId = membership.campusIds[0];
    } else if (campusId === undefined) {
      return {
        ok: false,
        code: 'membership_selection_required',
        options: [optionFromMembership(membership)],
      };
    } else if (!membership.campusIds.includes(campusId)) {
      return { ok: false, code: 'membership_scope_denied' };
    }

    return {
      ok: true,
      context: {
        membershipId: membership.membershipId,
        principalId: membership.principalId,
        tenantId: membership.tenantId,
        ...(campusId === undefined ? {} : { campusId }),
        roleIds: membership.roleIds,
      },
    };
  }
}
