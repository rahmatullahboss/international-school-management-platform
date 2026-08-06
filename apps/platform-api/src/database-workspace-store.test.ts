import { describe, expect, it, vi } from 'vitest';

import { DatabaseWorkspaceStore } from './database-workspace-store.js';

const sessionId = '95000000-0000-4000-8000-000000000008';

function databaseWith(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue(rows) };
}

describe('database workspace store', () => {
  it('returns the exact reviewed workspace and capabilities', async () => {
    const database = databaseWith([
      { roleKey: 'admin', capabilities: ['reports.read', 'sis.student.read'] },
    ]);
    const store = new DatabaseWorkspaceStore(database);

    await expect(store.resolve(sessionId)).resolves.toEqual({
      role: 'admin',
      capabilities: ['reports.read', 'sis.student.read'],
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('iam.resolve_browser_workspace'),
      [sessionId],
    );
  });

  it('returns undefined when no current workspace resolves', async () => {
    const store = new DatabaseWorkspaceStore(databaseWith([]));
    await expect(store.resolve(sessionId)).resolves.toBeUndefined();
  });

  it.each([
    [{ roleKey: 'unknown', capabilities: [] }],
    [{ roleKey: 'admin', capabilities: ['reports.read', 'reports.read'] }],
    [{ roleKey: 'admin', capabilities: [' reports.read'] }],
    [
      { roleKey: 'admin', capabilities: [] },
      { roleKey: 'admin', capabilities: [] },
    ],
  ])('fails closed on malformed or ambiguous rows', async (...rows) => {
    const store = new DatabaseWorkspaceStore(databaseWith(rows));
    await expect(store.resolve(sessionId)).rejects.toThrow(/invalid database response/u);
  });

  it('rejects malformed session identifiers before database access', async () => {
    const database = databaseWith([]);
    const store = new DatabaseWorkspaceStore(database);
    await expect(store.resolve('not-a-session')).rejects.toThrow(/UUID/u);
    expect(database.query).not.toHaveBeenCalled();
  });
});
