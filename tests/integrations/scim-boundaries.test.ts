import { describe, expect, it } from 'vitest';

import { ScimContract } from '../../packages/modules/integrations/src/scim.js';

describe('SCIM contract boundaries', () => {
  it('requires a normalized absolute base path and encodes resource identifiers', () => {
    expect(() => new ScimContract('api/v1/scim/v2')).toThrow(
      'SCIM base path must be an absolute path without a trailing slash',
    );
    expect(() => new ScimContract('/api/v1/scim/v2/')).toThrow(
      'SCIM base path must be an absolute path without a trailing slash',
    );

    const scim = new ScimContract('/api/v1/scim/v2');
    expect(scim.resourcePath('Users')).toBe('/api/v1/scim/v2/Users');
    expect(scim.resourcePath('Groups', 'group/with spaces')).toBe(
      '/api/v1/scim/v2/Groups/group%2Fwith%20spaces',
    );
  });

  it('fails closed for malformed filters while preserving valid eq filters', () => {
    const scim = new ScimContract('/api/v1/scim/v2');

    expect(scim.parseFilter('  externalId EQ "student-42"  ')).toEqual({
      attribute: 'externalId',
      operator: 'eq',
      value: 'student-42',
    });
    expect(() => scim.parseFilter('')).toThrow('SCIM filter is malformed');
    expect(() => scim.parseFilter('1invalid eq "value"')).toThrow('SCIM filter is malformed');
    expect(() => scim.parseFilter('displayName eq value')).toThrow('SCIM filter is malformed');
  });

  it('validates patch shape and optimistic-concurrency versions', () => {
    const scim = new ScimContract('/api/v1/scim/v2');

    expect(() => scim.validatePatch([])).toThrow('SCIM patch requires operations');
    expect(() => scim.validatePatch([{ op: 'replace', path: 'displayName' }])).toThrow(
      'SCIM patch value is required',
    );
    expect(scim.validatePatch([{ op: 'REMOVE', path: 'groups' }])).toEqual([
      { op: 'remove', path: 'groups' },
    ]);
    expect(scim.validatePatch([{ op: 'REPLACE', path: 'active', value: false }])).toEqual([
      { op: 'replace', path: 'active', value: false },
    ]);

    for (const version of [0, -1, 1.5, Number.NaN]) {
      expect(() => scim.etag(version)).toThrow('SCIM version must be positive');
    }
    expect(scim.etag(1)).toBe('W/"1"');
  });
});
