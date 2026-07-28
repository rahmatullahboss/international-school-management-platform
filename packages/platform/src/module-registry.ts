export interface ModuleRegistration {
  moduleId: string;
  routes: readonly string[];
  capabilities: readonly string[];
}

export class ModuleRegistry {
  readonly #routeOwners = new Map<string, string>();
  readonly #capabilityOwners = new Map<string, string>();

  register(registration: ModuleRegistration): void {
    for (const route of registration.routes) {
      if (this.#routeOwners.has(route)) {
        throw new Error('Route is already owned');
      }
    }
    for (const capability of registration.capabilities) {
      if (this.#capabilityOwners.has(capability)) {
        throw new Error('Capability is already owned');
      }
    }
    for (const route of registration.routes) {
      this.#routeOwners.set(route, registration.moduleId);
    }
    for (const capability of registration.capabilities) {
      this.#capabilityOwners.set(capability, registration.moduleId);
    }
  }

  ownerOfRoute(route: string): string | undefined {
    return this.#routeOwners.get(route);
  }

  ownerOfCapability(capability: string): string | undefined {
    return this.#capabilityOwners.get(capability);
  }
}
