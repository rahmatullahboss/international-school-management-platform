/*
THESIS: Resilient school workflows must state what can continue offline, bound what is stored and make recovery evidence visible.
OWN-WORLD: The Operational Ledger extends to connectivity, bandwidth, approved drafts, replay outcomes and privacy-safe telemetry.
STORY: A person can keep working on explicitly approved drafts, see what remains on the device and recover without duplicating or finalising unsafe actions.
FIRST VIEWPORT: Connectivity, low-bandwidth mode, pending work and the last trusted sync are explicit before optional installation or support actions.
FORM: Tenant/principal-scoped durable envelopes, idempotent replay, bounded payloads, allowlisted telemetry and measurable performance budgets.
*/
import type { ReactElement } from 'react';

export type ConnectivityState = 'online' | 'degraded' | 'offline';
export type BandwidthMode = 'standard' | 'low';
export type ApprovedOfflineActionKind =
  'attendance.draft' | 'form.draft' | 'survey.draft' | 'request.draft';
export type OfflineActionClassification = 'general' | 'personal';
export type OfflineActionState = 'pending' | 'syncing' | 'failed' | 'synced' | 'expired';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface OfflineActionEnvelope {
  readonly id: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly kind: ApprovedOfflineActionKind;
  readonly classification: OfflineActionClassification;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly state: OfflineActionState;
  readonly attempts: number;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly reasonCode?: string;
  readonly serverReference?: string;
}

export interface OfflineActionQueueStorage {
  read(): string | null;
  write(serialized: string): void;
}

export interface OfflineQueueContext {
  readonly tenantId: string;
  readonly principalId: string;
}

export interface EnqueueOfflineActionInput extends OfflineQueueContext {
  readonly kind: ApprovedOfflineActionKind;
  readonly classification: OfflineActionClassification;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

export interface OfflineReplayResult {
  readonly outcome: 'synced' | 'retry';
  readonly serverReference?: string;
  readonly reasonCode?: string;
}

export interface OfflineReplaySummary {
  readonly attempted: number;
  readonly synced: number;
  readonly failed: number;
  readonly expired: number;
}

export type OfflineReplaySender = (
  action: Readonly<OfflineActionEnvelope>,
) => Promise<OfflineReplayResult>;

export class MemoryOfflineActionStorage implements OfflineActionQueueStorage {
  #value: string | null = null;

  read(): string | null {
    return this.#value;
  }

  write(serialized: string): void {
    this.#value = serialized;
  }
}

export class BrowserOfflineActionStorage implements OfflineActionQueueStorage {
  readonly #storage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly #key: string;

  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    key = 'school-platform:offline-actions:v1',
  ) {
    this.#storage = storage;
    this.#key = key;
  }

  read(): string | null {
    return this.#storage.getItem(this.#key);
  }

  write(serialized: string): void {
    this.#storage.setItem(this.#key, serialized);
  }
}

const OFFLINE_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_OFFLINE_PAYLOAD_BYTES = 16 * 1_024;
const MAX_OFFLINE_ACTIONS_PER_PRINCIPAL = 100;
const MAX_REPLAY_ATTEMPTS = 5;
const FORBIDDEN_OFFLINE_KEYS =
  /(?:password|secret|token|cookie|authorization|card|bank|medical|safeguard)/iu;

function parseTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApprovedActionKind(value: unknown): value is ApprovedOfflineActionKind {
  return (
    value === 'attendance.draft' ||
    value === 'form.draft' ||
    value === 'survey.draft' ||
    value === 'request.draft'
  );
}

function isOfflineActionState(value: unknown): value is OfflineActionState {
  return (
    value === 'pending' ||
    value === 'syncing' ||
    value === 'failed' ||
    value === 'synced' ||
    value === 'expired'
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isJsonValue(entry));
}

function isOfflineActionEnvelope(value: unknown): value is OfflineActionEnvelope {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.tenantId === 'string' &&
    typeof value.principalId === 'string' &&
    isApprovedActionKind(value.kind) &&
    (value.classification === 'general' || value.classification === 'personal') &&
    typeof value.idempotencyKey === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.expiresAt === 'string' &&
    isOfflineActionState(value.state) &&
    typeof value.attempts === 'number' &&
    Number.isInteger(value.attempts) &&
    isRecord(value.payload) &&
    isJsonValue(value.payload) &&
    (value.reasonCode === undefined || typeof value.reasonCode === 'string') &&
    (value.serverReference === undefined || typeof value.serverReference === 'string')
  );
}

function cloneAction(action: OfflineActionEnvelope): Readonly<OfflineActionEnvelope> {
  return Object.freeze({
    ...action,
    payload: Object.freeze({ ...action.payload }),
  });
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function findForbiddenPayloadPath(value: JsonValue, path = 'payload'): string | undefined {
  if (isJsonArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenPayloadPath(value[index]!, `${path}[${String(index)}]`);
      if (nested !== undefined) return nested;
    }
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_OFFLINE_KEYS.test(key)) return `${path}.${key}`;
    const nested = findForbiddenPayloadPath(nestedValue, `${path}.${key}`);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function readActions(storage: OfflineActionQueueStorage): OfflineActionEnvelope[] {
  const serialized = storage.read();
  if (serialized === null || serialized.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('OFFLINE_QUEUE_STORAGE_CORRUPT');
  }
  if (!Array.isArray(parsed) || !parsed.every((entry) => isOfflineActionEnvelope(entry))) {
    throw new Error('OFFLINE_QUEUE_STORAGE_CORRUPT');
  }
  return parsed.map((entry) => ({ ...entry, payload: { ...entry.payload } }));
}

function writeActions(
  storage: OfflineActionQueueStorage,
  actions: readonly OfflineActionEnvelope[],
): void {
  storage.write(JSON.stringify(actions));
}

export class OfflineActionQueue {
  readonly #storage: OfflineActionQueueStorage;

  constructor(storage: OfflineActionQueueStorage) {
    this.#storage = storage;
  }

  enqueue(input: EnqueueOfflineActionInput): Readonly<OfflineActionEnvelope> {
    if (!input.tenantId.trim() || !input.principalId.trim()) {
      throw new Error('OFFLINE_QUEUE_SCOPE_REQUIRED');
    }
    if (!input.idempotencyKey.trim()) throw new Error('OFFLINE_IDEMPOTENCY_KEY_REQUIRED');
    if (!isApprovedActionKind(input.kind)) throw new Error('OFFLINE_ACTION_NOT_APPROVED');
    if (input.classification !== 'general' && input.classification !== 'personal') {
      throw new Error('OFFLINE_CLASSIFICATION_NOT_APPROVED');
    }

    const createdAt = parseTimestamp(input.createdAt, 'createdAt');
    const forbiddenPath = findForbiddenPayloadPath(input.payload);
    if (forbiddenPath !== undefined) {
      throw new Error(`OFFLINE_PAYLOAD_FORBIDDEN:${forbiddenPath}`);
    }
    const payloadBytes = new TextEncoder().encode(JSON.stringify(input.payload)).byteLength;
    if (payloadBytes > MAX_OFFLINE_PAYLOAD_BYTES) {
      throw new Error('OFFLINE_PAYLOAD_TOO_LARGE');
    }

    const actions = readActions(this.#storage);
    const existing = actions.find(
      (action) =>
        action.tenantId === input.tenantId &&
        action.principalId === input.principalId &&
        action.idempotencyKey === input.idempotencyKey,
    );
    if (existing !== undefined) return cloneAction(existing);

    const principalActions = actions.filter(
      (action) =>
        action.tenantId === input.tenantId &&
        action.principalId === input.principalId &&
        action.state !== 'synced' &&
        action.state !== 'expired',
    );
    if (principalActions.length >= MAX_OFFLINE_ACTIONS_PER_PRINCIPAL) {
      throw new Error('OFFLINE_QUEUE_LIMIT_REACHED');
    }

    const action: OfflineActionEnvelope = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      principalId: input.principalId,
      kind: input.kind,
      classification: input.classification,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date(createdAt).toISOString(),
      updatedAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(createdAt + OFFLINE_RETENTION_MS).toISOString(),
      state: 'pending',
      attempts: 0,
      payload: { ...input.payload },
    };
    actions.push(action);
    writeActions(this.#storage, actions);
    return cloneAction(action);
  }

  list(context: OfflineQueueContext): readonly Readonly<OfflineActionEnvelope>[] {
    return readActions(this.#storage)
      .filter(
        (action) =>
          action.tenantId === context.tenantId && action.principalId === context.principalId,
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((action) => cloneAction(action));
  }

  pendingCount(context: OfflineQueueContext): number {
    return this.list(context).filter(
      (action) =>
        action.state === 'pending' || action.state === 'failed' || action.state === 'syncing',
    ).length;
  }

  async replay(
    context: OfflineQueueContext,
    replayedAt: string,
    sender: OfflineReplaySender,
  ): Promise<OfflineReplaySummary> {
    const replayTimestamp = parseTimestamp(replayedAt, 'replayedAt');
    const actions = readActions(this.#storage);
    let attempted = 0;
    let synced = 0;
    let failed = 0;
    let expired = 0;

    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]!;
      if (action.tenantId !== context.tenantId || action.principalId !== context.principalId) {
        continue;
      }
      if (action.state === 'synced' || action.state === 'expired') continue;
      if (parseTimestamp(action.expiresAt, 'expiresAt') <= replayTimestamp) {
        actions[index] = {
          ...action,
          state: 'expired',
          updatedAt: new Date(replayTimestamp).toISOString(),
          payload: {},
          reasonCode: 'OFFLINE_ACTION_EXPIRED',
        };
        expired += 1;
        continue;
      }
      if (action.attempts >= MAX_REPLAY_ATTEMPTS) continue;

      attempted += 1;
      const syncing: OfflineActionEnvelope = {
        ...action,
        state: 'syncing',
        attempts: action.attempts + 1,
        updatedAt: new Date(replayTimestamp).toISOString(),
      };
      actions[index] = syncing;
      writeActions(this.#storage, actions);

      let result: OfflineReplayResult;
      try {
        result = await sender(cloneAction(syncing));
      } catch {
        result = { outcome: 'retry', reasonCode: 'OFFLINE_REPLAY_UNAVAILABLE' };
      }

      if (result.outcome === 'synced') {
        actions[index] = {
          ...syncing,
          state: 'synced',
          updatedAt: new Date(replayTimestamp).toISOString(),
          payload: {},
          ...(result.serverReference === undefined
            ? {}
            : { serverReference: result.serverReference }),
        };
        synced += 1;
      } else {
        actions[index] = {
          ...syncing,
          state: 'failed',
          updatedAt: new Date(replayTimestamp).toISOString(),
          reasonCode: result.reasonCode ?? 'OFFLINE_REPLAY_RETRY',
        };
        failed += 1;
      }
    }

    writeActions(this.#storage, actions);
    return Object.freeze({ attempted, synced, failed, expired });
  }

  clearCompleted(context: OfflineQueueContext): number {
    const actions = readActions(this.#storage);
    const retained = actions.filter(
      (action) =>
        action.tenantId !== context.tenantId ||
        action.principalId !== context.principalId ||
        (action.state !== 'synced' && action.state !== 'expired'),
    );
    const removed = actions.length - retained.length;
    writeActions(this.#storage, retained);
    return removed;
  }
}

export interface LowBandwidthPolicy {
  readonly mode: BandwidthMode;
  readonly eagerMedia: boolean;
  readonly backgroundPolling: boolean;
  readonly pageSize: number;
  readonly prefetchRoutes: boolean;
  readonly preferTextSummaries: boolean;
}

export function buildLowBandwidthPolicy(mode: BandwidthMode): LowBandwidthPolicy {
  if (mode === 'low') {
    return Object.freeze({
      mode,
      eagerMedia: false,
      backgroundPolling: false,
      pageSize: 20,
      prefetchRoutes: false,
      preferTextSummaries: true,
    });
  }
  return Object.freeze({
    mode,
    eagerMedia: true,
    backgroundPolling: true,
    pageSize: 50,
    prefetchRoutes: true,
    preferTextSummaries: false,
  });
}

export const EXPERIENCE_PERFORMANCE_BUDGET = Object.freeze({
  initialJavaScriptBytes: 250_000,
  initialCssBytes: 50_000,
  firstContentfulPaintMs: 2_500,
  interactionLatencyMs: 200,
  lowBandwidthPageSize: 20,
});

export interface ExperiencePerformanceSnapshot {
  readonly initialJavaScriptBytes: number;
  readonly initialCssBytes: number;
  readonly firstContentfulPaintMs: number;
  readonly interactionLatencyMs: number;
  readonly lowBandwidthPageSize: number;
}

export interface ExperiencePerformanceViolation {
  readonly metric: keyof ExperiencePerformanceSnapshot;
  readonly actual: number;
  readonly budget: number;
}

export function validateExperiencePerformance(
  snapshot: ExperiencePerformanceSnapshot,
): readonly ExperiencePerformanceViolation[] {
  const violations: ExperiencePerformanceViolation[] = [];
  for (const metric of Object.keys(EXPERIENCE_PERFORMANCE_BUDGET) as Array<
    keyof ExperiencePerformanceSnapshot
  >) {
    const actual = snapshot[metric];
    const budget = EXPERIENCE_PERFORMANCE_BUDGET[metric];
    if (actual > budget) violations.push({ metric, actual, budget });
  }
  return Object.freeze(violations.map((violation) => Object.freeze(violation)));
}

export type ExperienceTelemetryEventName =
  | 'connectivity.changed'
  | 'offline.queue'
  | 'offline.replay'
  | 'performance.navigation'
  | 'pwa.service_worker'
  | 'support.opened';

export interface ExperienceTelemetryEvent {
  readonly name: ExperienceTelemetryEventName;
  readonly timestamp: string;
  readonly outcome: 'success' | 'failure' | 'pending';
  readonly durationMs?: number;
  readonly routeTemplate?: string;
  readonly attributes?: Readonly<
    Partial<
      Record<'persona' | 'connectivity' | 'bandwidthMode' | 'workflow' | 'reasonCode', string>
    >
  >;
}

const TELEMETRY_ATTRIBUTE_KEYS = new Set([
  'persona',
  'connectivity',
  'bandwidthMode',
  'workflow',
  'reasonCode',
]);
const TELEMETRY_VALUE_PATTERN = /^[a-z0-9_./:-]{1,64}$/iu;
const TELEMETRY_PII_PATTERN = /@|(?:\d[ -]?){7,}/u;
const ROUTE_TEMPLATE_PATTERN = /^(?:\/|\/(?:[a-z-]+|:[a-z-]+)(?:\/(?:[a-z-]+|:[a-z-]+))*)$/u;

function sanitizeTelemetryEvent(event: ExperienceTelemetryEvent): ExperienceTelemetryEvent {
  parseTimestamp(event.timestamp, 'telemetry.timestamp');
  if (
    event.durationMs !== undefined &&
    (!Number.isFinite(event.durationMs) || event.durationMs < 0)
  ) {
    throw new Error('TELEMETRY_DURATION_INVALID');
  }
  if (event.routeTemplate !== undefined && !ROUTE_TEMPLATE_PATTERN.test(event.routeTemplate)) {
    throw new Error('TELEMETRY_ROUTE_MUST_BE_TEMPLATE');
  }
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.attributes ?? {})) {
    if (value === undefined) continue;
    if (!TELEMETRY_ATTRIBUTE_KEYS.has(key)) throw new Error('TELEMETRY_ATTRIBUTE_NOT_ALLOWED');
    if (!TELEMETRY_VALUE_PATTERN.test(value) || TELEMETRY_PII_PATTERN.test(value)) {
      throw new Error('TELEMETRY_ATTRIBUTE_INVALID');
    }
    attributes[key] = value;
  }
  return Object.freeze({
    name: event.name,
    timestamp: new Date(parseTimestamp(event.timestamp, 'telemetry.timestamp')).toISOString(),
    outcome: event.outcome,
    ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
    ...(event.routeTemplate === undefined ? {} : { routeTemplate: event.routeTemplate }),
    ...(Object.keys(attributes).length === 0 ? {} : { attributes: Object.freeze(attributes) }),
  });
}

export class ExperienceTelemetryBuffer {
  readonly #limit: number;
  readonly #events: ExperienceTelemetryEvent[] = [];
  #dropped = 0;

  constructor(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error('TELEMETRY_BUFFER_LIMIT_INVALID');
    }
    this.#limit = limit;
  }

  record(event: ExperienceTelemetryEvent): void {
    const sanitized = sanitizeTelemetryEvent(event);
    if (this.#events.length >= this.#limit) {
      this.#events.shift();
      this.#dropped += 1;
    }
    this.#events.push(sanitized);
  }

  snapshot(): Readonly<{
    readonly events: readonly ExperienceTelemetryEvent[];
    readonly dropped: number;
  }> {
    return Object.freeze({
      events: Object.freeze(this.#events.map((event) => Object.freeze({ ...event }))),
      dropped: this.#dropped,
    });
  }

  drain(): Readonly<{
    readonly events: readonly ExperienceTelemetryEvent[];
    readonly dropped: number;
  }> {
    const snapshot = this.snapshot();
    this.#events.length = 0;
    this.#dropped = 0;
    return snapshot;
  }
}

function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatTimestamp(locale: string, value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export interface ExperienceResiliencePanelProps {
  readonly locale: string;
  readonly connectivity: ConnectivityState;
  readonly bandwidthMode: BandwidthMode;
  readonly pendingActionCount: number;
  readonly lastSuccessfulSyncAt?: string;
  readonly updateAvailable?: boolean;
  readonly retryHref?: string | undefined;
  readonly supportHref: string;
  readonly onBandwidthModeChange?: (mode: BandwidthMode) => void;
}

export function ExperienceResiliencePanel(props: ExperienceResiliencePanelProps): ReactElement {
  const nextMode: BandwidthMode = props.bandwidthMode === 'low' ? 'standard' : 'low';
  const connectivityLabel =
    props.connectivity === 'online'
      ? 'Online'
      : props.connectivity === 'degraded'
        ? 'Connection is limited'
        : 'Working offline';
  const connectivityDetail =
    props.connectivity === 'online'
      ? 'Approved work can sync normally.'
      : props.connectivity === 'degraded'
        ? 'Low-bandwidth mode reduces media, polling and page size.'
        : 'Only approved drafts remain available. Final submission waits for a trusted connection.';

  return (
    <section
      className="experience-resilience"
      data-connectivity={props.connectivity}
      data-bandwidth={props.bandwidthMode}
      aria-labelledby="experience-resilience-title"
    >
      <header>
        <div>
          <p>Resilient workspace</p>
          <h2 id="experience-resilience-title">{connectivityLabel}</h2>
          <span>{connectivityDetail}</span>
        </div>
        <strong role="status" aria-live="polite">
          {formatNumber(props.locale, props.pendingActionCount)} pending on this device
        </strong>
      </header>

      <dl>
        <div>
          <dt>Bandwidth mode</dt>
          <dd>{props.bandwidthMode === 'low' ? 'Low bandwidth' : 'Standard'}</dd>
        </div>
        <div>
          <dt>Last successful sync</dt>
          <dd>
            {props.lastSuccessfulSyncAt === undefined
              ? 'No trusted sync recorded'
              : formatTimestamp(props.locale, props.lastSuccessfulSyncAt)}
          </dd>
        </div>
        <div>
          <dt>Offline boundary</dt>
          <dd>Drafts only; payments, publication and finalisation stay online.</dd>
        </div>
      </dl>

      {props.updateAvailable === true ? (
        <div className="experience-resilience__notice" role="status">
          <strong>An application update is ready.</strong>
          <span>Finish or sync current drafts before refreshing.</span>
        </div>
      ) : null}

      <footer>
        {props.onBandwidthModeChange === undefined ? null : (
          <button type="button" onClick={() => props.onBandwidthModeChange?.(nextMode)}>
            Use {nextMode === 'low' ? 'low-bandwidth' : 'standard'} mode
          </button>
        )}
        {props.retryHref === undefined ? null : <a href={props.retryHref}>Retry sync</a>}
        <a href={props.supportHref}>Open offline support</a>
      </footer>
    </section>
  );
}
