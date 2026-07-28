export type AssuranceLevel = 'aal1' | 'aal2';

export interface PermissionGrant {
  permission: string;
  assurance: AssuranceLevel;
}

export interface RoleAssignment {
  principalId: string;
  tenantId: string;
  campusId?: string;
  roleId: string;
}

export interface AuthorizationRequest {
  principalId: string;
  tenantId: string;
  campusId?: string;
  permission: string;
  assurance: AssuranceLevel;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: 'role-grant' | 'permission-not-granted' | 'scope-mismatch' | 'step-up-required';
}

const assuranceRank: Readonly<Record<AssuranceLevel, number>> = {
  aal1: 1,
  aal2: 2,
};

export class PolicyEngine {
  readonly #roles = new Map<string, ReadonlyMap<string, AssuranceLevel>>();
  readonly #assignments: RoleAssignment[] = [];

  registerRole(roleId: string, grants: readonly PermissionGrant[]): void {
    const permissions = new Map<string, AssuranceLevel>();
    for (const grant of grants) {
      permissions.set(grant.permission, grant.assurance);
    }
    this.#roles.set(roleId, permissions);
  }

  assignRole(assignment: RoleAssignment): void {
    if (!this.#roles.has(assignment.roleId)) {
      throw new Error('Unknown role');
    }
    this.#assignments.push(Object.freeze({ ...assignment }));
  }

  authorize(request: AuthorizationRequest): AuthorizationDecision {
    const principalAssignments = this.#assignments.filter(
      (assignment) => assignment.principalId === request.principalId,
    );
    const scoped = principalAssignments.filter(
      (assignment) =>
        assignment.tenantId === request.tenantId &&
        (!assignment.campusId || assignment.campusId === request.campusId),
    );

    if (principalAssignments.length > 0 && scoped.length === 0) {
      return { allowed: false, reason: 'scope-mismatch' };
    }

    let requiredAssurance: AssuranceLevel | undefined;
    for (const assignment of scoped) {
      const role = this.#roles.get(assignment.roleId);
      const assurance = role?.get(request.permission);
      if (
        assurance &&
        (!requiredAssurance || assuranceRank[assurance] > assuranceRank[requiredAssurance])
      ) {
        requiredAssurance = assurance;
      }
    }

    if (!requiredAssurance) {
      return { allowed: false, reason: 'permission-not-granted' };
    }
    if (assuranceRank[request.assurance] < assuranceRank[requiredAssurance]) {
      return { allowed: false, reason: 'step-up-required' };
    }
    return { allowed: true, reason: 'role-grant' };
  }
}
