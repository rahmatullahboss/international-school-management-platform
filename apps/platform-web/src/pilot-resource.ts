import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PilotConnectivity, PilotRole } from './portal-shared';

const PILOT_TENANT_ID = 'tenant-pilot-001';
const PILOT_CAMPUS_ID = 'campus-main';
const CACHE_VERSION = 1;
const REFRESH_AFTER_MS = 60_000;

const subjectByRole: Readonly<Record<PilotRole, string>> = {
  admin: 'principal-1',
  teacher: 'teacher-1',
  guardian: 'guardian-1',
  student: 'student-1',
};

interface PilotSnapshotScope {
  readonly tenantId: string;
  readonly campusId: string;
  readonly role: PilotRole;
  readonly subjectId: string;
  readonly capabilities: readonly string[];
}

interface PilotSnapshotEnvelope<T> {
  readonly schemaVersion: 1;
  readonly sourceVersion: string;
  readonly generatedAt: string;
  readonly scope: PilotSnapshotScope;
  readonly data: T;
}

interface StoredSnapshot<T> {
  readonly cacheVersion: 1;
  readonly etag: string | undefined;
  readonly receivedAt: number;
  readonly envelope: PilotSnapshotEnvelope<T>;
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

function resolveApiBase(): string | undefined {
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
  return [apiBase, PILOT_TENANT_ID, PILOT_CAMPUS_ID, role, subjectByRole[role]].join('|');
}

function storageKey(key: string): string {
  return `school-platform:pilot-read:${encodeURIComponent(key)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMatchingEnvelope<T>(value: unknown, role: PilotRole): value is PilotSnapshotEnvelope<T> {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.sourceVersion !== 'string') {
    return false;
  }
  if (typeof value.generatedAt !== 'string' || !isRecord(value.scope) || !isRecord(value.data)) {
    return false;
  }
  return (
    value.scope.tenantId === PILOT_TENANT_ID &&
    value.scope.campusId === PILOT_CAMPUS_ID &&
    value.scope.role === role &&
    value.scope.subjectId === subjectByRole[role] &&
    Array.isArray(value.scope.capabilities) &&
    value.scope.capabilities.every((capability) => typeof capability === 'string')
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

async function requestSnapshot<T>(
  apiBase: string,
  role: PilotRole,
  key: string,
  current: StoredSnapshot<T> | undefined,
): Promise<StoredSnapshot<T>> {
  const existing = inFlight.get(key);
  if (existing !== undefined) return existing as Promise<StoredSnapshot<T>>;

  const promise = (async (): Promise<StoredSnapshot<T>> => {
    const headers = new Headers({
      'x-school-tenant-id': PILOT_TENANT_ID,
      'x-school-campus-id': PILOT_CAMPUS_ID,
      'x-school-role': role,
      'x-school-subject-id': subjectByRole[role],
    });
    if (current?.etag !== undefined) headers.set('if-none-match', current.etag);

    const response = await fetch(`${apiBase}/pilot/v1/snapshots/${role}`, {
      method: 'GET',
      headers,
      credentials: 'omit',
      cache: 'no-store',
    });

    if (response.status === 304 && current !== undefined) {
      const refreshed = { ...current, receivedAt: Date.now() };
      storeSnapshot(key, refreshed);
      return refreshed;
    }
    if (!response.ok) {
      throw new Error(`Pilot read API returned ${response.status}.`);
    }

    const payload = await response.json();
    if (!isMatchingEnvelope<T>(payload, role)) {
      throw new Error('Pilot read API returned a snapshot outside the requested scope.');
    }

    const stored: StoredSnapshot<T> = {
      cacheVersion: CACHE_VERSION,
      etag: response.headers.get('etag') ?? undefined,
      receivedAt: Date.now(),
      envelope: payload,
    };
    storeSnapshot(key, stored);
    return stored;
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
          error instanceof Error ? error.message : 'The staging read API could not be reached.',
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
