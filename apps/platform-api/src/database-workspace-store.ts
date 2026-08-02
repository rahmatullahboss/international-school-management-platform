import type { HttpDatabase } from '@school/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WORKSPACE_ROLES = new Set([
  'admin',
  'teacher',
  'guardian',
  'student',
  'admissions',
  'finance',
  'support',
]);

export type DatabaseWorkspaceRole =
  'admin' | 'teacher' | 'guardian' | 'student' | 'admissions' | 'finance' | 'support';

export interface DatabaseBrowserWorkspace {
  readonly role: DatabaseWorkspaceRole;
  readonly capabilities: readonly string[];
}

interface WorkspaceRow extends Record<string, unknown> {
  readonly roleKey: string;
  readonly capabilities: string[];
}

function requireUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error('sessionId must be a UUID.');
}

function isWorkspaceRole(value: string): value is DatabaseWorkspaceRole {
  return WORKSPACE_ROLES.has(value);
}

function validateWorkspaceRow(row: WorkspaceRow): DatabaseBrowserWorkspace {
  if (!isWorkspaceRole(row.roleKey) || !Array.isArray(row.capabilities)) {
    throw new Error('Workspace resolution returned an invalid database response.');
  }
  if (
    row.capabilities.some(
      (capability) => typeof capability !== 'string' || capability.trim() !== capability,
    ) ||
    new Set(row.capabilities).size !== row.capabilities.length
  ) {
    throw new Error('Workspace resolution returned an invalid database response.');
  }
  return { role: row.roleKey, capabilities: row.capabilities };
}

export class DatabaseWorkspaceStore {
  readonly #database: HttpDatabase;

  constructor(database: HttpDatabase) {
    this.#database = database;
  }

  async resolve(sessionId: string): Promise<DatabaseBrowserWorkspace | undefined> {
    requireUuid(sessionId);
    const rows = await this.#database.query<WorkspaceRow>(
      `SELECT role_key AS "roleKey", capabilities
       FROM iam.resolve_browser_workspace($1::uuid)`,
      [sessionId],
    );
    if (rows.length === 0) return undefined;
    if (rows.length !== 1 || rows[0] === undefined) {
      throw new Error('Workspace resolution returned an invalid database response.');
    }
    return validateWorkspaceRow(rows[0]);
  }
}
