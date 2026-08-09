import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PilotConnectivity, PilotRole } from './portal-shared';

const PILOT_TENANT_ID = 'tenant-pilot-001';
const PILOT_CAMPUS_ID = 'campus-main';
const PRODUCTION_WEB_HOST =
  'international-school-platform-web-production.rahmatullahzisan.workers.dev';
const CACHE_VERSION = 1;
const SESSION_VERSION = 1;
const REFRESH_AFTER_MS = 60_000;
const SESSION_EXPIRY_SKEW_MS = 30_000;

const subjectByRole: Readonly<Record<PilotRole, string>> = {
  admin: 'principal-1',
  teacher: 'teacher-1',
  guardian: 'guardian-1',
  student: 'student-1',
};

interface ResourceSnapshotScope {
  readonly tenantId: string;
  readonly campusId?: string;
  readonly role: PilotRole;
  readonly subjectId: string;
  readonly capabilities: readonly string[];
}

interface ResourceSnapshotEnvelope<T> {
  readonly schemaVersion: 1;
  readonly sourceVersion: string;
  readonly generatedAt: string;
  readonly scope: ResourceSnapshotScope;
  readonly data: T;
}

interface StoredSnapshot<T> {
  readonly cacheVersion: 1;
  readonly etag: string | undefined;
  readonly receivedAt: number;
  readonly envelope: ResourceSnapshotEnvelope<T>;
}

interface PilotSessionEnvelope {
  readonly schemaVersion: 1;
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly scope: Readonly<{
    tenantId: string;
    campusId: string;
    role: PilotRole;
    subjectId: string;
  }>;
}

interface StoredSession {
  readonly sessionVersion: 1;
  readonly accessToken: string;
  readonly expiresAt: number;
  readonly scope: PilotSessionEnvelope['scope'];
}

export type PilotResourceState = 'seed' | 'cached' | 'refreshing' | 'current' | 'stale';

export interface PilotResource<T> {
  readonly data: T;
  readonly capabilities: readonly string[];
  readonly updatedAt: string;
  readonly state: PilotResourceState;
  readonly apiConfigured: boolean;
  readonly message: string | undefined;
  readonly refresh: () => void;
}

declare global {
  interface Window {
    __PLATFORM_API_URL__?: string;
  }
}

const memoryCache = new Map<string, StoredSnapshot<unknown>>();
const inFlight = new Map<string, Promise<StoredSnapshot<unknown>>>();
const sessionMemory = new Map<string, StoredSession>();
const sessionInFlight = new Map<string, Promise<StoredSession>>();

function productionRuntime(): boolean {
  return window.location.hostname === PRODUCTION_WEB_HOST;
}

function resolveApiBase(): string | undefined {
  if (productionRuntime()) return window.location.origin;

  const runtimeOverride = window.__PLATFORM_API_URL__?.trim();
  if (runtimeOverride !== undefined && runtimeOverride !== '')
    return runtimeOverride.replace(/\/$/u, '');

  const buildValue = (import.meta.env.VITE_PLATFORM_API_URL as string | undefined)?.trim();
  if (buildValue !== undefined && buildValue !== '') return buildValue.replace(/\/$/u, '');

  if (
    window.location.hostname ===
    'international-school-platform-web-staging.rahmatullahzisan.workers.dev'
  ) {
    return 'https://international-school-platform-api-staging.rahmatullahzisan.workers.dev';
  }
  return undefined;
}

function cacheKey(apiBase: string, role: PilotRole): string {
  if (productionRuntime()) return [apiBase, 'production', role].join('|');
  return [apiBase, PILOT_TENANT_ID, PILOT_CAMPUS_ID, role, subjectByRole[role]].join('|');
}

function storageKey(key: string): string {
  return `school-platform:pilot-read:${encodeURIComponent(key)}`;
}

function sessionKey(apiBase: string, role: PilotRole): string {
  return `${apiBase}|${role}|${subjectByRole[role]}`;
}

function sessionStorageKey(key: string): string {
  return `school-platform:pilot-session:${encodeURIComponent(key)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCapabilities(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((capability) => typeof capability === 'string');
}

function isMatchingEnvelope<T>(
  value: unknown,
  role: PilotRole,
): value is ResourceSnapshotEnvelope<T> {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.sourceVersion !== 'string') {
    return false;
  }
  if (typeof value.generatedAt !== 'string' || !isRecord(value.scope) || !isRecord(value.data)) {
    return false;
  }
  if (
    typeof value.scope.tenantId !== 'string' ||
    value.scope.tenantId.trim() === '' ||
    (value.scope.campusId !== undefined && typeof value.scope.campusId !== 'string') ||
    value.scope.role !== role ||
    typeof value.scope.subjectId !== 'string' ||
    value.scope.subjectId.trim() === '' ||
    !validCapabilities(value.scope.capabilities)
  ) {
    return false;
  }
  if (productionRuntime()) return true;
  return (
    value.scope.tenantId === PILOT_TENANT_ID &&
    value.scope.campusId === PILOT_CAMPUS_ID &&
    value.scope.subjectId === subjectByRole[role]
  );
}

function isMatchingSession(value: unknown, role: PilotRole): value is PilotSessionEnvelope {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SESSION_VERSION ||
    value.tokenType !== 'Bearer' ||
    typeof value.accessToken !== 'string' ||
    value.accessToken.length < 32 ||
    typeof value.expiresAt !== 'string' ||
    !isRecord(value.scope)
  ) {
    return false;
  }
  return (
    value.scope.tenantId === PILOT_TENANT_ID &&
    value.scope.campusId === PILOT_CAMPUS_ID &&
    value.scope.role === role &&
    value.scope.subjectId === subjectByRole[role]
  );
}

function readStoredSnapshot<T>(key: string, role: PilotRole): StoredSnapshot<T> | undefined {
  const memory = memoryCache.get(key);
  if (memory !== undefined && isMatchingEnvelope<T>(memory.envelope, role)) {
    return memory as StoredSnapshot<T>;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.cacheVersion !== CACHE_VERSION) return undefined;
    if (
      typeof parsed.receivedAt !== 'number' ||
      (parsed.etag !== undefined && typeof parsed.etag !== 'string') ||
      !isMatchingEnvelope<T>(parsed.envelope, role)
    ) {
      return undefined;
    }
    const stored = parsed as unknown as StoredSnapshot<T>;
    memoryCache.set(key, stored);
    return stored;
  } catch {
    return undefined;
  }
}

function storeSnapshot<T>(key: string, snapshot: StoredSnapshot<T>): void {
  memoryCache.set(key, snapshot);
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(snapshot));
  } catch {
    // Memory caching remains available when storage is unavailable or full.
  }
}

function readStoredSession(key: string, role: PilotRole): StoredSession | undefined {
  const memory = sessionMemory.get(key);
  if (
    memory !== undefined &&
    memory.scope.role === role &&
    memory.scope.subjectId === subjectByRole[role] &&
    memory.expiresAt > Date.now() + SESSION_EXPIRY_SKEW_MS
  ) {
    return memory;
  }

  try {
    const raw = window.sessionStorage.getItem(sessionStorageKey(key));
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.sessionVersion !== SESSION_VERSION ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now() + SESSION_EXPIRY_SKEW_MS ||
      !isRecord(parsed.scope) ||
      parsed.scope.tenantId !== PILOT_TENANT_ID ||
      parsed.scope.campusId !== PILOT_CAMPUS_ID ||
      parsed.scope.role !== role ||
      parsed.scope.subjectId !== subjectByRole[role]
    ) {
      return undefined;
    }
    const stored = parsed as unknown as StoredSession;
    sessionMemory.set(key, stored);
    return stored;
  } catch {
    return undefined;
  }
}

function storeSession(key: string, session: StoredSession): void {
  sessionMemory.set(key, session);
  try {
    window.sessionStorage.setItem(sessionStorageKey(key), JSON.stringify(session));
  } catch {
    // The in-memory session remains available when session storage is unavailable.
  }
}

function clearSession(key: string): void {
  sessionMemory.delete(key);
  try {
    window.sessionStorage.removeItem(sessionStorageKey(key));
  } catch {
    // No persistent session cleanup is needed when storage is unavailable.
  }
}

async function requestSession(
  apiBase: string,
  role: PilotRole,
  force = false,
): Promise<StoredSession> {
  const key = sessionKey(apiBase, role);
  if (!force) {
    const current = readStoredSession(key, role);
    if (current !== undefined) return current;
  }

  const existing = sessionInFlight.get(key);
  if (existing !== undefined) return existing;

  const promise = (async (): Promise<StoredSession> => {
    const response = await fetch(`${apiBase}/pilot/v1/sessions/${role}`, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Staging session service returned ${response.status}.`);

    const payload: unknown = await response.json();
    if (!isMatchingSession(payload, role)) {
      throw new Error('Staging session service returned an invalid identity scope.');
    }
    const expiresAt = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + SESSION_EXPIRY_SKEW_MS) {
      throw new Error('Staging session service returned an expired session.');
    }

    const stored: StoredSession = {
      sessionVersion: SESSION_VERSION,
      accessToken: payload.accessToken,
      expiresAt,
      scope: payload.scope,
    };
    storeSession(key, stored);
    return stored;
  })();

  sessionInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    sessionInFlight.delete(key);
  }
}

function databaseEnvelope<T>(
  value: unknown,
  role: PilotRole,
): ResourceSnapshotEnvelope<T> | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    typeof value.generatedAt !== 'string' ||
    !isRecord(value.scope) ||
    value.scope.persona !== role ||
    typeof value.scope.tenantId !== 'string' ||
    value.scope.tenantId.trim() === '' ||
    (value.scope.campusId !== undefined && typeof value.scope.campusId !== 'string') ||
    typeof value.scope.subjectRef !== 'string' ||
    value.scope.subjectRef.trim() === '' ||
    !validCapabilities(value.scope.capabilities) ||
    !isRecord(value.data)
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    sourceVersion: `database-rm-${value.revision}`,
    generatedAt: value.generatedAt,
    scope: {
      tenantId: value.scope.tenantId,
      ...(value.scope.campusId === undefined ? {} : { campusId: value.scope.campusId }),
      role,
      subjectId: value.scope.subjectRef,
      capabilities: value.scope.capabilities,
    },
    data: value.data as T,
  };
}

async function requestProductionSnapshot<T>(
  apiBase: string,
  role: PilotRole,
  key: string,
  current: StoredSnapshot<T> | undefined,
): Promise<StoredSnapshot<T>> {
  const headers = new Headers();
  if (current?.etag !== undefined) headers.set('if-none-match', current.etag);
  const response = await fetch(`${apiBase}/auth/v1/snapshot`, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (response.status === 304 && current !== undefined) {
    const refreshed = { ...current, receivedAt: Date.now() };
    storeSnapshot(key, refreshed);
    return refreshed;
  }
  if (!response.ok) throw new Error(`Production read API returned ${response.status}.`);
  const value: unknown = await response.json();
  const envelope = databaseEnvelope<T>(value, role);
  if (envelope === undefined) {
    throw new Error('Production read API returned a snapshot outside the authenticated workspace.');
  }
  const stored: StoredSnapshot<T> = {
    cacheVersion: CACHE_VERSION,
    etag: response.headers.get('etag') ?? undefined,
    receivedAt: Date.now(),
    envelope,
  };
  storeSnapshot(key, stored);
  return stored;
}

async function requestSnapshot<T>(
  apiBase: string,
  role: PilotRole,
  key: string,
  current: StoredSnapshot<T> | undefined,
): Promise<StoredSnapshot<T>> {
  const existing = inFlight.get(key);
  if (existing !== undefined) return existing as Promise<StoredSnapshot<T>>;

  const promise = (async (): Promise<StoredSnapshot<T>> => {
    if (productionRuntime()) return requestProductionSnapshot(apiBase, role, key, current);

    let session = await requestSession(apiBase, role);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const headers = new Headers({ authorization: `Bearer ${session.accessToken}` });
      if (current?.etag !== undefined) headers.set('if-none-match', current.etag);

      const response = await fetch(`${apiBase}/pilot/v1/snapshots/${role}`, {
        method: 'GET',
        headers,
        credentials: 'omit',
        cache: 'no-store',
      });

      if (response.status === 401 && attempt === 0) {
        clearSession(sessionKey(apiBase, role));
        session = await requestSession(apiBase, role, true);
        continue;
      }
      if (response.status === 304 && current !== undefined) {
        const refreshed = { ...current, receivedAt: Date.now() };
        storeSnapshot(key, refreshed);
        return refreshed;
      }
      if (!response.ok) throw new Error(`Staging data service returned ${response.status}.`);

      const payload: unknown = await response.json();
      if (!isMatchingEnvelope<T>(payload, role)) {
        throw new Error('Staging data service returned data outside the requested scope.');
      }

      const stored: StoredSnapshot<T> = {
        cacheVersion: CACHE_VERSION,
        etag: response.headers.get('etag') ?? undefined,
        receivedAt: Date.now(),
        envelope: payload,
      };
      storeSnapshot(key, stored);
      return stored;
    }

    throw new Error('Staging identity session could not be renewed.');
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export function usePilotResource<T extends Readonly<Record<string, unknown>>>(
  role: PilotRole,
  fallbackData: T,
  fallbackCapabilities: readonly string[],
  fallbackUpdatedAt: string,
  connectivity: PilotConnectivity,
): PilotResource<T> {
  const apiBase = useMemo(resolveApiBase, []);
  const key = useMemo(
    () => (apiBase === undefined ? undefined : cacheKey(apiBase, role)),
    [apiBase, role],
  );
  const initial = useMemo(
    () => (key === undefined ? undefined : readStoredSnapshot<T>(key, role)),
    [key, role],
  );
  const [snapshot, setSnapshot] = useState<StoredSnapshot<T> | undefined>(initial);
  const [state, setState] = useState<PilotResourceState>(initial === undefined ? 'seed' : 'cached');
  const [message, setMessage] = useState<string>();

  const refresh = useCallback((): void => {
    if (apiBase === undefined || key === undefined || connectivity === 'offline') return;

    setState('refreshing');
    setMessage(undefined);
    const current = readStoredSnapshot<T>(key, role) ?? snapshot;
    void requestSnapshot<T>(apiBase, role, key, current)
      .then((next) => {
        setSnapshot(next);
        setState('current');
      })
      .catch((error: unknown) => {
        setState('stale');
        setMessage(
          error instanceof Error
            ? error.message
            : productionRuntime()
              ? 'The production read API could not be reached.'
              : 'The staging read API could not be reached.',
        );
      });
  }, [apiBase, connectivity, key, role, snapshot]);

  useEffect(() => {
    if (apiBase === undefined || key === undefined || connectivity === 'offline') return;
    const current = readStoredSnapshot<T>(key, role) ?? snapshot;
    if (current === undefined || Date.now() - current.receivedAt >= REFRESH_AFTER_MS) refresh();

    const handleVisibility = (): void => {
      if (document.visibilityState !== 'visible') return;
      const latest = readStoredSnapshot<T>(key, role);
      if (latest === undefined || Date.now() - latest.receivedAt >= REFRESH_AFTER_MS) refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [apiBase, connectivity, key, refresh, role, snapshot]);

  return {
    data: snapshot?.envelope.data ?? fallbackData,
    capabilities: snapshot?.envelope.scope.capabilities ?? fallbackCapabilities,
    updatedAt: snapshot?.envelope.generatedAt ?? fallbackUpdatedAt,
    state,
    apiConfigured: apiBase !== undefined,
    message,
    refresh,
  };
}
