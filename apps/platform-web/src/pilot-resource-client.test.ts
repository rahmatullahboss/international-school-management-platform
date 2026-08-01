import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pilotResourceClientContract } from './pilot-resource.js';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  failGet = false;
  failSet = false;
  failRemove = false;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    if (this.failGet) throw new Error('storage read failed');
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    if (this.failRemove) throw new Error('storage remove failed');
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failSet) throw new Error('storage write failed');
    this.values.set(key, value);
  }
}

const now = Date.parse('2026-08-01T12:00:00.000Z');
const apiBase = 'https://platform-api.test';
const accessToken = 'a'.repeat(48);

function sessionPayload(
  role: 'admin' | 'teacher' | 'guardian' | 'student' = 'admin',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const subjectByRole = {
    admin: 'principal-1',
    teacher: 'teacher-1',
    guardian: 'guardian-1',
    student: 'student-1',
  } as const;
  return {
    schemaVersion: 1,
    tokenType: 'Bearer',
    accessToken,
    expiresAt: new Date(now + 15 * 60_000).toISOString(),
    scope: {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      role,
      subjectId: subjectByRole[role],
    },
    ...overrides,
  };
}

function snapshotEnvelope(
  role: 'admin' | 'teacher' | 'guardian' | 'student' = 'admin',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const subjectByRole = {
    admin: 'principal-1',
    teacher: 'teacher-1',
    guardian: 'guardian-1',
    student: 'student-1',
  } as const;
  return {
    schemaVersion: 1,
    sourceVersion: 'source-v1',
    generatedAt: new Date(now).toISOString(),
    scope: {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      role,
      subjectId: subjectByRole[role],
      capabilities: ['pilot.read'],
    },
    data: { value: `${role}-snapshot` },
    ...overrides,
  };
}

function installWindow(
  options: {
    hostname?: string;
    apiUrl?: string;
    localStorage?: MemoryStorage;
    sessionStorage?: MemoryStorage;
  } = {},
): { localStorage: MemoryStorage; sessionStorage: MemoryStorage } {
  const localStorage = options.localStorage ?? new MemoryStorage();
  const sessionStorage = options.sessionStorage ?? new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __PLATFORM_API_URL__: options.apiUrl,
      location: { hostname: options.hostname ?? 'localhost' },
      localStorage,
      sessionStorage,
    },
  });
  return { localStorage, sessionStorage };
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  pilotResourceClientContract.resetMemory();
  installWindow();
  vi.spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete (globalThis as { window?: unknown }).window;
  pilotResourceClientContract.resetMemory();
});

describe('pilot API and key resolution', () => {
  it('prefers a trimmed runtime override and removes one trailing slash', () => {
    installWindow({ apiUrl: '  https://runtime.test/  ' });
    expect(pilotResourceClientContract.resolveApiBase()).toBe('https://runtime.test');
  });

  it('uses build-time API configuration when there is no runtime override', () => {
    vi.stubEnv('VITE_PLATFORM_API_URL', ' https://build.test/ ');
    expect(pilotResourceClientContract.resolveApiBase()).toBe('https://build.test');
  });

  it('maps the known staging web hostname and otherwise remains unconfigured', () => {
    installWindow({
      hostname: 'international-school-platform-web-staging.rahmatullahzisan.workers.dev',
    });
    expect(pilotResourceClientContract.resolveApiBase()).toBe(
      'https://international-school-platform-api-staging.rahmatullahzisan.workers.dev',
    );
    installWindow({ hostname: 'localhost', apiUrl: '   ' });
    expect(pilotResourceClientContract.resolveApiBase()).toBeUndefined();
  });

  it('builds role-scoped cache and session storage keys', () => {
    const cache = pilotResourceClientContract.cacheKey(apiBase, 'teacher');
    const session = pilotResourceClientContract.sessionKey(apiBase, 'teacher');
    expect(cache).toBe(`${apiBase}|tenant-pilot-001|campus-main|teacher|teacher-1`);
    expect(session).toBe(`${apiBase}|teacher|teacher-1`);
    expect(pilotResourceClientContract.storageKey(cache)).toContain('school-platform:pilot-read:');
    expect(pilotResourceClientContract.sessionStorageKey(session)).toContain(
      'school-platform:pilot-session:',
    );
    expect(pilotResourceClientContract.storageKey('a|b')).toContain('a%7Cb');
  });
});

describe('pilot payload scope guards', () => {
  it('accepts an exact snapshot envelope and rejects malformed envelope primitives', () => {
    const valid = snapshotEnvelope('admin');
    expect(pilotResourceClientContract.isMatchingEnvelope(valid, 'admin')).toBe(true);
    for (const invalid of [
      null,
      [],
      { ...valid, schemaVersion: 2 },
      { ...valid, sourceVersion: 1 },
      { ...valid, generatedAt: 1 },
      { ...valid, scope: null },
      { ...valid, data: [] },
    ]) {
      expect(pilotResourceClientContract.isMatchingEnvelope(invalid, 'admin')).toBe(false);
    }
  });

  it('rejects every snapshot scope mismatch and malformed capability', () => {
    const valid = snapshotEnvelope('admin');
    const scope = valid.scope as Record<string, unknown>;
    for (const changedScope of [
      { ...scope, tenantId: 'other' },
      { ...scope, campusId: 'other' },
      { ...scope, role: 'teacher' },
      { ...scope, subjectId: 'teacher-1' },
      { ...scope, capabilities: 'pilot.read' },
      { ...scope, capabilities: ['pilot.read', 7] },
    ]) {
      expect(
        pilotResourceClientContract.isMatchingEnvelope({ ...valid, scope: changedScope }, 'admin'),
      ).toBe(false);
    }
  });

  it('accepts a scoped session and rejects malformed identity/session values', () => {
    const valid = sessionPayload('guardian');
    expect(pilotResourceClientContract.isMatchingSession(valid, 'guardian')).toBe(true);
    const scope = valid.scope as Record<string, unknown>;
    for (const invalid of [
      null,
      [],
      { ...valid, schemaVersion: 2 },
      { ...valid, tokenType: 'Basic' },
      { ...valid, accessToken: 5 },
      { ...valid, accessToken: 'short' },
      { ...valid, expiresAt: 5 },
      { ...valid, scope: null },
      { ...valid, scope: { ...scope, tenantId: 'other' } },
      { ...valid, scope: { ...scope, campusId: 'other' } },
      { ...valid, scope: { ...scope, role: 'student' } },
      { ...valid, scope: { ...scope, subjectId: 'student-1' } },
    ]) {
      expect(pilotResourceClientContract.isMatchingSession(invalid, 'guardian')).toBe(false);
    }
  });
});

describe('snapshot cache lifecycle', () => {
  it('persists a snapshot, serves memory first, then restores it from local storage', () => {
    const { localStorage } = installWindow();
    const key = pilotResourceClientContract.cacheKey(apiBase, 'admin');
    const stored = {
      cacheVersion: 1 as const,
      etag: '"etag-1"',
      receivedAt: now,
      envelope: snapshotEnvelope('admin'),
    };
    pilotResourceClientContract.storeSnapshot(key, stored);
    expect(pilotResourceClientContract.readStoredSnapshot(key, 'admin')).toEqual(stored);
    expect(localStorage.length).toBe(1);

    pilotResourceClientContract.resetMemory();
    expect(pilotResourceClientContract.readStoredSnapshot(key, 'admin')).toEqual(stored);
  });

  it('rejects missing, old, malformed and cross-scope persisted snapshots', () => {
    const { localStorage } = installWindow();
    const key = pilotResourceClientContract.cacheKey(apiBase, 'admin');
    const storageKey = pilotResourceClientContract.storageKey(key);
    expect(pilotResourceClientContract.readStoredSnapshot(key, 'admin')).toBeUndefined();

    for (const value of [
      '{bad-json',
      JSON.stringify({ cacheVersion: 2 }),
      JSON.stringify({ cacheVersion: 1, receivedAt: 'now', envelope: snapshotEnvelope('admin') }),
      JSON.stringify({
        cacheVersion: 1,
        receivedAt: now,
        etag: 7,
        envelope: snapshotEnvelope('admin'),
      }),
      JSON.stringify({
        cacheVersion: 1,
        receivedAt: now,
        envelope: snapshotEnvelope('teacher'),
      }),
    ]) {
      localStorage.setItem(storageKey, value);
      pilotResourceClientContract.resetMemory();
      expect(pilotResourceClientContract.readStoredSnapshot(key, 'admin')).toBeUndefined();
    }

    localStorage.failGet = true;
    expect(pilotResourceClientContract.readStoredSnapshot(key, 'admin')).toBeUndefined();
  });

  it('keeps memory caching available when local storage writes fail', () => {
    const localStorage = new MemoryStorage();
    localStorage.failSet = true;
    installWindow({ localStorage });
    const key = pilotResourceClientContract.cacheKey(apiBase, 'student');
    const stored = {
      cacheVersion: 1 as const,
      etag: undefined,
      receivedAt: now,
      envelope: snapshotEnvelope('student'),
    };
    expect(() => pilotResourceClientContract.storeSnapshot(key, stored)).not.toThrow();
    expect(pilotResourceClientContract.readStoredSnapshot(key, 'student')).toEqual(stored);
  });
});

describe('identity session cache lifecycle', () => {
  it('persists a valid future session and restores it from session storage', () => {
    const { sessionStorage } = installWindow();
    const key = pilotResourceClientContract.sessionKey(apiBase, 'teacher');
    const stored = {
      sessionVersion: 1 as const,
      accessToken,
      expiresAt: now + 15 * 60_000,
      scope: sessionPayload('teacher').scope as {
        tenantId: string;
        campusId: string;
        role: 'teacher';
        subjectId: string;
      },
    };
    pilotResourceClientContract.storeSession(key, stored);
    expect(pilotResourceClientContract.readStoredSession(key, 'teacher')).toEqual(stored);
    expect(sessionStorage.length).toBe(1);

    pilotResourceClientContract.resetMemory();
    expect(pilotResourceClientContract.readStoredSession(key, 'teacher')).toEqual(stored);
  });

  it('rejects expired, malformed and cross-scope persisted sessions', () => {
    const { sessionStorage } = installWindow();
    const key = pilotResourceClientContract.sessionKey(apiBase, 'guardian');
    const storageKey = pilotResourceClientContract.sessionStorageKey(key);
    const validScope = sessionPayload('guardian').scope;
    const candidates = [
      '{bad-json',
      JSON.stringify({ sessionVersion: 2 }),
      JSON.stringify({
        sessionVersion: 1,
        accessToken: 5,
        expiresAt: now + 60_000,
        scope: validScope,
      }),
      JSON.stringify({ sessionVersion: 1, accessToken, expiresAt: 'later', scope: validScope }),
      JSON.stringify({
        sessionVersion: 1,
        accessToken,
        expiresAt: now + 20_000,
        scope: validScope,
      }),
      JSON.stringify({ sessionVersion: 1, accessToken, expiresAt: now + 60_000, scope: null }),
      JSON.stringify({
        sessionVersion: 1,
        accessToken,
        expiresAt: now + 60_000,
        scope: { ...(validScope as object), tenantId: 'other' },
      }),
      JSON.stringify({
        sessionVersion: 1,
        accessToken,
        expiresAt: now + 60_000,
        scope: { ...(validScope as object), campusId: 'other' },
      }),
      JSON.stringify({
        sessionVersion: 1,
        accessToken,
        expiresAt: now + 60_000,
        scope: { ...(validScope as object), role: 'student' },
      }),
      JSON.stringify({
        sessionVersion: 1,
        accessToken,
        expiresAt: now + 60_000,
        scope: { ...(validScope as object), subjectId: 'student-1' },
      }),
    ];
    for (const candidate of candidates) {
      sessionStorage.setItem(storageKey, candidate);
      pilotResourceClientContract.resetMemory();
      expect(pilotResourceClientContract.readStoredSession(key, 'guardian')).toBeUndefined();
    }

    sessionStorage.failGet = true;
    expect(pilotResourceClientContract.readStoredSession(key, 'guardian')).toBeUndefined();
  });

  it('keeps memory sessions when writes fail and tolerates persistent cleanup failure', () => {
    const sessionStorage = new MemoryStorage();
    sessionStorage.failSet = true;
    installWindow({ sessionStorage });
    const key = pilotResourceClientContract.sessionKey(apiBase, 'student');
    const stored = {
      sessionVersion: 1 as const,
      accessToken,
      expiresAt: now + 60_000,
      scope: sessionPayload('student').scope as {
        tenantId: string;
        campusId: string;
        role: 'student';
        subjectId: string;
      },
    };
    expect(() => pilotResourceClientContract.storeSession(key, stored)).not.toThrow();
    expect(pilotResourceClientContract.readStoredSession(key, 'student')).toEqual(stored);

    sessionStorage.failRemove = true;
    expect(() => pilotResourceClientContract.clearSession(key)).not.toThrow();
    expect(pilotResourceClientContract.readStoredSession(key, 'student')).toBeUndefined();
  });
});

describe('pilot session API requests', () => {
  it('reuses a valid stored session unless force renewal is requested', async () => {
    const key = pilotResourceClientContract.sessionKey(apiBase, 'admin');
    const stored = {
      sessionVersion: 1 as const,
      accessToken,
      expiresAt: now + 60_000,
      scope: sessionPayload('admin').scope as {
        tenantId: string;
        campusId: string;
        role: 'admin';
        subjectId: string;
      },
    };
    pilotResourceClientContract.storeSession(key, stored);
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(sessionPayload('admin'))));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pilotResourceClientContract.requestSession(apiBase, 'admin')).resolves.toEqual(
      stored,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      pilotResourceClientContract.requestSession(apiBase, 'admin', true),
    ).resolves.toMatchObject({
      accessToken,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('issues and stores a scoped session from the API', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(sessionPayload('teacher'))));
    vi.stubGlobal('fetch', fetchMock);
    const result = await pilotResourceClientContract.requestSession(apiBase, 'teacher');
    expect(result).toMatchObject({
      sessionVersion: 1,
      accessToken,
      scope: { role: 'teacher', subjectId: 'teacher-1' },
    });
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}/pilot/v1/sessions/teacher`, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
    });
  });

  it('deduplicates concurrent session issuance', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => responsePromise);
    vi.stubGlobal('fetch', fetchMock);
    const first = pilotResourceClientContract.requestSession(apiBase, 'guardian');
    const second = pilotResourceClientContract.requestSession(apiBase, 'guardian');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse?.(jsonResponse(sessionPayload('guardian')));
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('rejects session HTTP errors, invalid scopes and expired dates', async () => {
    const cases: Array<[Response, string]> = [
      [new Response(null, { status: 503 }), 'Pilot session API returned 503.'],
      [jsonResponse({ invalid: true }), 'Pilot session API returned an invalid identity scope.'],
      [
        jsonResponse(sessionPayload('admin', { expiresAt: 'not-a-date' })),
        'Pilot session API returned an expired identity session.',
      ],
      [
        jsonResponse(sessionPayload('admin', { expiresAt: new Date(now + 20_000).toISOString() })),
        'Pilot session API returned an expired identity session.',
      ],
    ];
    for (const [response, message] of cases) {
      pilotResourceClientContract.resetMemory();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(response)),
      );
      await expect(pilotResourceClientContract.requestSession(apiBase, 'admin')).rejects.toThrow(
        message,
      );
    }
  });
});

describe('pilot snapshot API requests', () => {
  it('fetches, validates and persists a scoped snapshot with its ETag', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionPayload('admin')))
      .mockResolvedValueOnce(
        jsonResponse(snapshotEnvelope('admin'), { headers: { etag: '"snapshot-v1"' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const key = pilotResourceClientContract.cacheKey(apiBase, 'admin');
    const result = await pilotResourceClientContract.requestSnapshot(
      apiBase,
      'admin',
      key,
      undefined,
    );
    expect(result).toMatchObject({ etag: '"snapshot-v1"', receivedAt: now });
    expect(result.envelope).toMatchObject({ scope: { role: 'admin' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends If-None-Match and refreshes cached receipt time on 304', async () => {
    const current = {
      cacheVersion: 1 as const,
      etag: '"cached"',
      receivedAt: now - 120_000,
      envelope: snapshotEnvelope('teacher'),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionPayload('teacher')))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);
    const key = pilotResourceClientContract.cacheKey(apiBase, 'teacher');
    await expect(
      pilotResourceClientContract.requestSnapshot(apiBase, 'teacher', key, current),
    ).resolves.toEqual({ ...current, receivedAt: now });
    const snapshotCall = fetchMock.mock.calls[1];
    const init = snapshotCall?.[1] as RequestInit;
    expect(new Headers(init.headers).get('if-none-match')).toBe('"cached"');
  });

  it('renews the identity session once after a 401 and retries the snapshot', async () => {
    const renewedToken = 'b'.repeat(48);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionPayload('guardian')))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse(sessionPayload('guardian', { accessToken: renewedToken })),
      )
      .mockResolvedValueOnce(jsonResponse(snapshotEnvelope('guardian')));
    vi.stubGlobal('fetch', fetchMock);
    const key = pilotResourceClientContract.cacheKey(apiBase, 'guardian');
    await expect(
      pilotResourceClientContract.requestSnapshot(apiBase, 'guardian', key, undefined),
    ).resolves.toMatchObject({ envelope: { scope: { role: 'guardian' } } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retryInit = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(retryInit.headers).get('authorization')).toBe(`Bearer ${renewedToken}`);
  });

  it('deduplicates concurrent snapshot requests', async () => {
    let resolveSnapshot: ((response: Response) => void) | undefined;
    const deferred = new Promise<Response>((resolve) => {
      resolveSnapshot = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionPayload('student')))
      .mockImplementationOnce(() => deferred);
    vi.stubGlobal('fetch', fetchMock);
    const key = pilotResourceClientContract.cacheKey(apiBase, 'student');
    const first = pilotResourceClientContract.requestSnapshot(apiBase, 'student', key, undefined);
    await Promise.resolve();
    const second = pilotResourceClientContract.requestSnapshot(apiBase, 'student', key, undefined);
    resolveSnapshot?.(jsonResponse(snapshotEnvelope('student')));
    const [left, right] = await Promise.all([first, second]);
    expect(left).toEqual(right);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects snapshot HTTP errors, second-attempt authorization failures and scope mismatch', async () => {
    const cases: Array<[Response[], string]> = [
      [
        [jsonResponse(sessionPayload('admin')), new Response(null, { status: 500 })],
        'Pilot read API returned 500.',
      ],
      [
        [
          jsonResponse(sessionPayload('admin')),
          new Response(null, { status: 401 }),
          jsonResponse(sessionPayload('admin')),
          new Response(null, { status: 401 }),
        ],
        'Pilot read API returned 401.',
      ],
      [
        [jsonResponse(sessionPayload('admin')), jsonResponse(snapshotEnvelope('teacher'))],
        'Pilot read API returned a snapshot outside the requested scope.',
      ],
    ];
    for (const [responses, message] of cases) {
      pilotResourceClientContract.resetMemory();
      const fetchMock = vi.fn();
      for (const response of responses) fetchMock.mockResolvedValueOnce(response);
      vi.stubGlobal('fetch', fetchMock);
      const key = pilotResourceClientContract.cacheKey(apiBase, 'admin');
      await expect(
        pilotResourceClientContract.requestSnapshot(apiBase, 'admin', key, undefined),
      ).rejects.toThrow(message);
    }
  });

  it('accepts a successful snapshot without an ETag', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionPayload('admin')))
      .mockResolvedValueOnce(jsonResponse(snapshotEnvelope('admin')));
    vi.stubGlobal('fetch', fetchMock);
    const key = pilotResourceClientContract.cacheKey(apiBase, 'admin');
    await expect(
      pilotResourceClientContract.requestSnapshot(apiBase, 'admin', key, undefined),
    ).resolves.toMatchObject({ etag: undefined });
  });
});
