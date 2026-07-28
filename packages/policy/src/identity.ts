export interface IdentityAccount {
  accountId: string;
  provider: string;
  providerSubject: string;
}

export class IdentityDirectory {
  readonly #accounts = new Map<string, IdentityAccount>();
  readonly #providerSubjects = new Map<string, string>();
  readonly #personLinks = new Map<string, string>();

  registerAccount(provider: string, providerSubject: string): IdentityAccount {
    const key = `${provider.trim().toLowerCase()}:${providerSubject.trim()}`;
    const existingId = this.#providerSubjects.get(key);
    if (existingId) {
      const existing = this.#accounts.get(existingId);
      if (!existing) {
        throw new Error('Identity directory is inconsistent');
      }
      return existing;
    }

    const account: IdentityAccount = Object.freeze({
      accountId: crypto.randomUUID(),
      provider: provider.trim().toLowerCase(),
      providerSubject: providerSubject.trim(),
    });
    this.#accounts.set(account.accountId, account);
    this.#providerSubjects.set(key, account.accountId);
    return account;
  }

  linkPerson(accountId: string, tenantId: string, personId: string): void {
    if (!this.#accounts.has(accountId)) {
      throw new Error('Unknown account');
    }
    const key = `${accountId}:${tenantId}`;
    const existing = this.#personLinks.get(key);
    if (existing && existing !== personId) {
      throw new Error('Account is already linked for this tenant');
    }
    this.#personLinks.set(key, personId);
  }

  resolvePerson(accountId: string, tenantId: string): string | undefined {
    return this.#personLinks.get(`${accountId}:${tenantId}`);
  }
}
