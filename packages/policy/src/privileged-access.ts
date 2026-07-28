export interface PrivilegedAccessRequest {
  tenantId: string;
  principalId: string;
  reason: string;
  requestedAt: Date;
  expiresAt: Date;
}

export interface PrivilegedAccessGrant extends PrivilegedAccessRequest {
  grantId: string;
  approvedBy?: string;
  approvedAt?: Date;
  revokedAt?: Date;
}

export class PrivilegedAccessRegistry {
  readonly #grants = new Map<string, PrivilegedAccessGrant>();

  request(request: PrivilegedAccessRequest): PrivilegedAccessGrant {
    const reason = request.reason.trim();
    if (!reason) {
      throw new Error('Privileged access reason is required');
    }
    if (request.expiresAt <= request.requestedAt) {
      throw new Error('Privileged access expiry must be after request time');
    }

    const grant: PrivilegedAccessGrant = Object.freeze({
      ...request,
      reason,
      grantId: crypto.randomUUID(),
    });
    this.#grants.set(grant.grantId, grant);
    return grant;
  }

  approve(grantId: string, approvedBy: string, approvedAt: Date): PrivilegedAccessGrant {
    const grant = this.#require(grantId);
    if (approvedAt >= grant.expiresAt) {
      throw new Error('Expired privileged access cannot be approved');
    }
    const approved = Object.freeze({ ...grant, approvedBy, approvedAt });
    this.#grants.set(grantId, approved);
    return approved;
  }

  revoke(grantId: string, revokedAt: Date): PrivilegedAccessGrant {
    const grant = this.#require(grantId);
    const revoked = Object.freeze({ ...grant, revokedAt });
    this.#grants.set(grantId, revoked);
    return revoked;
  }

  isActive(grantId: string, at: Date): boolean {
    const grant = this.#grants.get(grantId);
    return Boolean(
      grant?.approvedBy &&
      grant.approvedAt &&
      grant.approvedAt <= at &&
      at < grant.expiresAt &&
      (!grant.revokedAt || at < grant.revokedAt),
    );
  }

  #require(grantId: string): PrivilegedAccessGrant {
    const grant = this.#grants.get(grantId);
    if (!grant) {
      throw new Error('Unknown privileged access grant');
    }
    return grant;
  }
}
