import { cloneAndFreeze } from './common.js';

export type ScimResourceType = 'Users' | 'Groups';
export type ScimPatchOperationName = 'add' | 'replace' | 'remove';

export interface ScimFilter {
  attribute: string;
  operator: 'eq';
  value: string;
}

export interface ScimPatchOperation {
  op: string;
  path: string;
  value?: unknown;
}

const writablePaths = new Set([
  'active',
  'userName',
  'externalId',
  'name',
  'name.givenName',
  'name.familyName',
  'displayName',
  'emails',
  'phoneNumbers',
  'groups',
  'members',
]);

export class ScimContract {
  readonly #basePath: string;

  constructor(basePath: string) {
    if (!basePath.startsWith('/') || basePath.endsWith('/')) {
      throw new Error('SCIM base path must be an absolute path without a trailing slash');
    }
    this.#basePath = basePath;
  }

  resourcePath(resourceType: ScimResourceType, resourceId?: string): string {
    return resourceId
      ? `${this.#basePath}/${resourceType}/${encodeURIComponent(resourceId)}`
      : `${this.#basePath}/${resourceType}`;
  }

  parseFilter(filter: string): Readonly<ScimFilter> {
    const match = /^([A-Za-z][A-Za-z0-9_.-]*)\s+([A-Za-z]+)\s+"([^"]*)"$/u.exec(filter.trim());
    if (!match) throw new Error('SCIM filter is malformed');
    const [, attribute, operator, value] = match;
    if (operator?.toLowerCase() !== 'eq')
      throw new Error('SCIM filter supports only the eq operator');
    if (!attribute || value === undefined) throw new Error('SCIM filter is malformed');
    return cloneAndFreeze({ attribute, operator: 'eq' as const, value });
  }

  validatePatch(
    operations: readonly Readonly<ScimPatchOperation>[],
  ): readonly Readonly<ScimPatchOperation>[] {
    if (operations.length === 0) throw new Error('SCIM patch requires operations');
    const validated = operations.map((operation) => {
      const normalized = operation.op.toLowerCase();
      if (!['add', 'replace', 'remove'].includes(normalized)) {
        throw new Error('SCIM patch operation is not supported');
      }
      if (!writablePaths.has(operation.path)) throw new Error('SCIM patch path is not writable');
      if (normalized !== 'remove' && operation.value === undefined) {
        throw new Error('SCIM patch value is required');
      }
      return { ...operation, op: normalized as ScimPatchOperationName };
    });
    return cloneAndFreeze(validated);
  }

  etag(version: number): string {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new Error('SCIM version must be positive');
    return `W/"${version}"`;
  }
}
