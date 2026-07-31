import type {
  DatabaseReadModelStore,
  RuntimeReadModelHead,
} from './database-read-model-store.js';

export interface DatabaseReadModelSnapshot {
  readonly schemaVersion: 1;
  readonly scope: {
    readonly tenantId: string;
    readonly membershipId: string;
    readonly campusId?: string;
    readonly persona: RuntimeReadModelHead['persona'];
    readonly subjectRef: string;
    readonly capabilities: readonly string[];
  };
  readonly revision: number;
  readonly generatedAt: string;
  readonly sourceUpdatedAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export type DatabaseReadModelResolution =
  | {
      readonly ok: true;
      readonly status: 200;
      readonly etag: string;
      readonly snapshot: DatabaseReadModelSnapshot;
      readonly cache: 'hit' | 'miss';
    }
  | { readonly ok: true; readonly status: 304; readonly etag: string }
  | {
      readonly ok: false;
      readonly status: 404 | 503;
      readonly code: 'runtime_read_model_not_found' | 'runtime_read_model_unavailable';
      readonly message: string;
    };

interface CacheEntry {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 64;
const DEFAULT_TTL_MILLISECONDS = 15_000;
const MAX_CACHE_ENTRIES = 256;
const MAX_TTL_MILLISECONDS = 60_000;

export class RuntimeReadModelCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #maxEntries: number;
  readonly #ttlMilliseconds: number;

  constructor(
    maxEntries = DEFAULT_MAX_ENTRIES,
    ttlMilliseconds = DEFAULT_TTL_MILLISECONDS,
  ) {
    if (
      !Number.isInteger(maxEntries) ||
      maxEntries < 1 ||
      maxEntries > MAX_CACHE_ENTRIES ||
      !Number.isInteger(ttlMilliseconds) ||
      ttlMilliseconds < 1 ||
      ttlMilliseconds > MAX_TTL_MILLISECONDS
    ) {
      throw new Error('Runtime read-model cache bounds are invalid.');
    }
    this.#maxEntries = maxEntries;
    this.#ttlMilliseconds = ttlMilliseconds;
  }

  get(key: string, now: number): Readonly<Record<string, unknown>> | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= now) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.payload;
  }

  set(key: string, payload: Readonly<Record<string, unknown>>, now: number): void {
    this.#entries.delete(key);
    this.#entries.set(key, { payload: structuredClone(payload), expiresAt: now + this.#ttlMilliseconds });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  get size(): number {
    return this.#entries.size;
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

async function readModelEtag(head: RuntimeReadModelHead): Promise<string> {
  const canonical = JSON.stringify([
    head.tenantId,
    head.membershipId,
    head.campusId,
    head.persona,
    head.subjectRef,
    head.revision,
    head.payloadDigest,
    head.capabilityDigest,
  ]);
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)),
  );
  return `"rm1-${base64Url(digest)}"`;
}

function matchesEtag(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false;
  return header
    .split(',')
    .map((entry) => entry.trim())
    .some((entry) => entry === '*' || entry === etag);
}

function snapshotFor(
  head: RuntimeReadModelHead,
  payload: Readonly<Record<string, unknown>>,
): DatabaseReadModelSnapshot {
  return {
    schemaVersion: 1,
    scope: {
      tenantId: head.tenantId,
      membershipId: head.membershipId,
      ...(head.campusId === null ? {} : { campusId: head.campusId }),
      persona: head.persona,
      subjectRef: head.subjectRef,
      capabilities: head.capabilities,
    },
    revision: head.revision,
    generatedAt: head.generatedAt,
    sourceUpdatedAt: head.sourceUpdatedAt,
    data: payload,
  };
}

export async function resolveDatabaseReadModel(input: {
  readonly sessionId: string;
  readonly ifNoneMatch?: string;
  readonly store: Pick<DatabaseReadModelStore, 'resolveHead' | 'readPayload'>;
  readonly cache: RuntimeReadModelCache;
  readonly now?: number;
}): Promise<DatabaseReadModelResolution> {
  const now = input.now ?? Date.now();
  try {
    const head = await input.store.resolveHead(input.sessionId);
    if (head === undefined) {
      return {
        ok: false,
        status: 404,
        code: 'runtime_read_model_not_found',
        message: 'No current read model is available for this session.',
      };
    }
    const etag = await readModelEtag(head);
    if (matchesEtag(input.ifNoneMatch, etag)) return { ok: true, status: 304, etag };

    let payload = input.cache.get(etag, now);
    const cache = payload === undefined ? 'miss' : 'hit';
    if (payload === undefined) {
      payload = await input.store.readPayload(
        input.sessionId,
        head.revision,
        head.payloadDigest,
        head.capabilityDigest,
      );
      if (payload === undefined) {
        return {
          ok: false,
          status: 503,
          code: 'runtime_read_model_unavailable',
          message: 'The read model changed while it was being resolved.',
        };
      }
      input.cache.set(etag, payload, now);
    }
    return { ok: true, status: 200, etag, snapshot: snapshotFor(head, payload), cache };
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'runtime_read_model_unavailable',
      message: 'The database read model is unavailable.',
    };
  }
}
