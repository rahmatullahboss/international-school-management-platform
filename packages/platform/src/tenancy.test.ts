import { describe, expect, it } from 'vitest';

import {
  TenantDirectory,
  buildTenantCacheKey,
  buildTenantObjectKey,
  createTenantContext,
} from './tenancy.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

describe('tenant foundation', () => {
  it('normalizes custom domains and prevents cross-tenant collisions', () => {
    const directory = new TenantDirectory();
    directory.register({
      tenantId: tenantA,
      slug: 'north-star',
      displayName: 'North Star School',
      homeRegion: 'aws-us-east-2',
      deploymentProfile: 'regional-pooled',
      databaseBinding: 'neon-us-east-2',
    });
    directory.register({
      tenantId: tenantB,
      slug: 'river-school',
      displayName: 'River School',
      homeRegion: 'aws-us-east-2',
      deploymentProfile: 'regional-pooled',
      databaseBinding: 'neon-us-east-2',
    });

    directory.attachDomain(tenantA, ' Portal.North-Star.Example ');
    expect(directory.resolveDomain('portal.north-star.example')?.tenantId).toBe(tenantA);
    expect(() => directory.attachDomain(tenantB, 'PORTAL.NORTH-STAR.EXAMPLE')).toThrow(
      'Domain is already assigned',
    );
  });

  it('allows only ordered provisioning transitions', () => {
    const directory = new TenantDirectory();
    directory.register({
      tenantId: tenantA,
      slug: 'north-star',
      displayName: 'North Star School',
      homeRegion: 'aws-us-east-2',
      deploymentProfile: 'regional-pooled',
      databaseBinding: 'neon-us-east-2',
    });

    expect(() => directory.transitionProvisioning(tenantA, 'active')).toThrow(
      'Invalid provisioning transition',
    );
    directory.transitionProvisioning(tenantA, 'database-ready');
    directory.transitionProvisioning(tenantA, 'active');
    expect(directory.get(tenantA)?.provisioningStatus).toBe('active');
  });

  it('builds tenant-isolated cache and object namespaces', () => {
    expect(buildTenantCacheKey(tenantA, 'campus', 'main')).toBe(`tenant:${tenantA}:campus:main`);
    expect(buildTenantObjectKey(tenantA, 'documents/report.pdf')).toBe(
      `tenants/${tenantA}/documents/report.pdf`,
    );
    expect(() => buildTenantObjectKey(tenantA, '../other-tenant/file')).toThrow(
      'Unsafe object path',
    );
  });

  it('creates immutable routing context from the directory record', () => {
    const context = createTenantContext({
      tenantId: tenantA,
      homeRegion: 'aws-us-east-2',
      deploymentProfile: 'dedicated',
      databaseBinding: 'neon-dedicated-a',
    });

    expect(context).toEqual({
      tenantId: tenantA,
      homeRegion: 'aws-us-east-2',
      deploymentProfile: 'dedicated',
      databaseBinding: 'neon-dedicated-a',
    });
    expect(Object.isFrozen(context)).toBe(true);
  });
});
