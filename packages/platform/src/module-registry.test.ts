import { describe, expect, it } from 'vitest';

import { ModuleRegistry } from './module-registry.js';

describe('ModuleRegistry', () => {
  it('registers unique routes and capabilities', () => {
    const registry = new ModuleRegistry();
    registry.register({ moduleId: 'sis', routes: ['/students'], capabilities: ['student.read'] });
    registry.register({
      moduleId: 'finance',
      routes: ['/finance'],
      capabilities: ['invoice.read'],
    });

    expect(registry.ownerOfRoute('/students')).toBe('sis');
    expect(registry.ownerOfCapability('invoice.read')).toBe('finance');
  });

  it('rejects duplicate route and capability ownership', () => {
    const registry = new ModuleRegistry();
    registry.register({ moduleId: 'sis', routes: ['/students'], capabilities: ['student.read'] });

    expect(() =>
      registry.register({
        moduleId: 'shadow',
        routes: ['/students'],
        capabilities: ['shadow.read'],
      }),
    ).toThrow('Route is already owned');
    expect(() =>
      registry.register({
        moduleId: 'shadow',
        routes: ['/shadow'],
        capabilities: ['student.read'],
      }),
    ).toThrow('Capability is already owned');
  });
});
