import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  buildLowBandwidthPolicy,
  ExperienceResiliencePanel,
  ExperienceTelemetryBuffer,
  MemoryOfflineActionStorage,
  OfflineActionQueue,
  validateExperiencePerformance,
} from '../../packages/modules/documents-experience/src/resilience';
import {
  registerPlatformServiceWorker,
  resolveSavedBandwidthMode,
  type ServiceWorkerContainerTarget,
  type ServiceWorkerRegistrationTarget,
  type ServiceWorkerStateTarget,
} from '../../apps/platform-web/src/pwa';

const context = { tenantId: 'tenant-1', principalId: 'teacher-1' } as const;

describe('EXP-01 PWA and resilience controls', () => {
  it('applies an explicit low-bandwidth policy without hidden background work', () => {
    expect(buildLowBandwidthPolicy('low')).toEqual({
      mode: 'low',
      eagerMedia: false,
      backgroundPolling: false,
      pageSize: 20,
      prefetchRoutes: false,
      preferTextSummaries: true,
    });
    expect(buildLowBandwidthPolicy('standard')).toMatchObject({
      eagerMedia: true,
      backgroundPolling: true,
      pageSize: 50,
      prefetchRoutes: true,
    });
    expect(resolveSavedBandwidthMode(null, true)).toBe('low');
    expect(resolveSavedBandwidthMode('standard', true)).toBe('standard');
  });

  it('stores only approved, bounded and idempotent offline drafts in principal scope', () => {
    const storage = new MemoryOfflineActionStorage();
    const queue = new OfflineActionQueue(storage);
    const first = queue.enqueue({
      ...context,
      kind: 'attendance.draft',
      classification: 'personal',
      idempotencyKey: 'attendance:class-7a:2026-07-29',
      createdAt: '2026-07-29T08:00:00+06:00',
      payload: { sessionReference: 'class-7a', presentCount: 23 },
    });
    const retry = queue.enqueue({
      ...context,
      kind: 'attendance.draft',
      classification: 'personal',
      idempotencyKey: 'attendance:class-7a:2026-07-29',
      createdAt: '2026-07-29T08:00:00+06:00',
      payload: { sessionReference: 'class-7a', presentCount: 24 },
    });
    queue.enqueue({
      tenantId: 'tenant-2',
      principalId: 'teacher-1',
      kind: 'form.draft',
      classification: 'general',
      idempotencyKey: 'other-tenant',
      createdAt: '2026-07-29T08:01:00+06:00',
      payload: { response: 'not-visible' },
    });

    expect(retry.id).toBe(first.id);
    expect(queue.list(context)).toHaveLength(1);
    expect(queue.pendingCount(context)).toBe(1);
    expect(queue.list({ tenantId: 'tenant-1', principalId: 'teacher-2' })).toEqual([]);
    expect(queue.list(context)[0]?.payload).toEqual({
      sessionReference: 'class-7a',
      presentCount: 23,
    });
  });

  it('rejects restricted classification, secrets and oversized content from durable offline storage', () => {
    const queue = new OfflineActionQueue(new MemoryOfflineActionStorage());
    expect(() =>
      queue.enqueue({
        ...context,
        kind: 'form.draft',
        classification: 'restricted' as never,
        idempotencyKey: 'restricted-form',
        createdAt: '2026-07-29T08:00:00+06:00',
        payload: { response: 'must-not-persist' },
      }),
    ).toThrow('OFFLINE_CLASSIFICATION_NOT_APPROVED');

    expect(() =>
      queue.enqueue({
        ...context,
        kind: 'form.draft',
        classification: 'personal',
        idempotencyKey: 'private-form',
        createdAt: '2026-07-29T08:00:00+06:00',
        payload: { authorizationToken: '[REDACTED_SECRET]' },
      }),
    ).toThrow('OFFLINE_PAYLOAD_FORBIDDEN:payload.authorizationToken');

    expect(() =>
      queue.enqueue({
        ...context,
        kind: 'survey.draft',
        classification: 'general',
        idempotencyKey: 'large-survey',
        createdAt: '2026-07-29T08:00:00+06:00',
        payload: { response: 'x'.repeat(17 * 1_024) },
      }),
    ).toThrow('OFFLINE_PAYLOAD_TOO_LARGE');
  });

  it('replays drafts idempotently, clears synced payloads and retains safe failure evidence', async () => {
    const storage = new MemoryOfflineActionStorage();
    const queue = new OfflineActionQueue(storage);
    queue.enqueue({
      ...context,
      kind: 'request.draft',
      classification: 'personal',
      idempotencyKey: 'request:leave:1',
      createdAt: '2026-07-29T08:00:00+06:00',
      payload: { requestType: 'leave', days: 1 },
    });

    const summary = await queue.replay(context, '2026-07-29T09:00:00+06:00', (action) => {
      expect(action.state).toBe('syncing');
      expect(action.attempts).toBe(1);
      return Promise.resolve({ outcome: 'synced' as const, serverReference: 'request-ref-1' });
    });

    expect(summary).toEqual({ attempted: 1, synced: 1, failed: 0, expired: 0 });
    expect(queue.list(context)[0]).toMatchObject({
      state: 'synced',
      attempts: 1,
      payload: {},
      serverReference: 'request-ref-1',
    });
    expect(queue.clearCompleted(context)).toBe(1);
    expect(queue.list(context)).toEqual([]);

    queue.enqueue({
      ...context,
      kind: 'form.draft',
      classification: 'personal',
      idempotencyKey: 'form:retry:1',
      createdAt: '2026-07-29T10:00:00+06:00',
      payload: { answer: 'draft' },
    });
    const failed = await queue.replay(context, '2026-07-29T10:05:00+06:00', () =>
      Promise.reject(new Error('network unavailable')),
    );
    expect(failed).toEqual({ attempted: 1, synced: 0, failed: 1, expired: 0 });
    expect(queue.list(context)[0]).toMatchObject({
      state: 'failed',
      reasonCode: 'OFFLINE_REPLAY_UNAVAILABLE',
    });
  });

  it('expires stale drafts and removes their payload before any sender is called', async () => {
    const queue = new OfflineActionQueue(new MemoryOfflineActionStorage());
    queue.enqueue({
      ...context,
      kind: 'survey.draft',
      classification: 'general',
      idempotencyKey: 'survey:stale',
      createdAt: '2026-07-20T08:00:00+06:00',
      payload: { answer: 'stale' },
    });
    let senderCalls = 0;
    const summary = await queue.replay(context, '2026-07-29T08:00:00+06:00', () => {
      senderCalls += 1;
      return Promise.resolve({ outcome: 'synced' as const });
    });

    expect(summary).toEqual({ attempted: 0, synced: 0, failed: 0, expired: 1 });
    expect(senderCalls).toBe(0);
    expect(queue.list(context)[0]).toMatchObject({
      state: 'expired',
      payload: {},
      reasonCode: 'OFFLINE_ACTION_EXPIRED',
    });
  });

  it('buffers only privacy-safe telemetry and exposes dropped-event evidence', () => {
    const buffer = new ExperienceTelemetryBuffer(2);
    buffer.record({
      name: 'connectivity.changed',
      timestamp: '2026-07-29T08:00:00+06:00',
      outcome: 'success',
      routeTemplate: '/',
      attributes: { persona: 'teacher', connectivity: 'online' },
    });
    buffer.record({
      name: 'performance.navigation',
      timestamp: '2026-07-29T08:01:00+06:00',
      outcome: 'success',
      durationMs: 320,
      routeTemplate: '/teacher/classes/:class-id',
      attributes: { bandwidthMode: 'low' },
    });
    buffer.record({
      name: 'offline.queue',
      timestamp: '2026-07-29T08:02:00+06:00',
      outcome: 'pending',
      routeTemplate: '/teacher/attendance',
      attributes: { workflow: 'attendance.draft' },
    });

    const snapshot = buffer.snapshot();
    expect(snapshot.dropped).toBe(1);
    expect(snapshot.events.map((event) => event.name)).toEqual([
      'performance.navigation',
      'offline.queue',
    ]);

    expect(() =>
      buffer.record({
        name: 'support.opened',
        timestamp: '2026-07-29T08:03:00+06:00',
        outcome: 'success',
        routeTemplate: '/students/12345',
      }),
    ).toThrow('TELEMETRY_ROUTE_MUST_BE_TEMPLATE');
    expect(() =>
      buffer.record({
        name: 'support.opened',
        timestamp: '2026-07-29T08:03:00+06:00',
        outcome: 'success',
        routeTemplate: '/support',
        attributes: { reasonCode: `student${'@'}example.test` },
      }),
    ).toThrow('TELEMETRY_ATTRIBUTE_INVALID');
  });

  it('enforces measurable application and low-bandwidth performance budgets', () => {
    expect(
      validateExperiencePerformance({
        initialJavaScriptBytes: 210_000,
        initialCssBytes: 24_000,
        firstContentfulPaintMs: 2_100,
        interactionLatencyMs: 150,
        lowBandwidthPageSize: 20,
      }),
    ).toEqual([]);

    expect(
      validateExperiencePerformance({
        initialJavaScriptBytes: 280_000,
        initialCssBytes: 24_000,
        firstContentfulPaintMs: 2_800,
        interactionLatencyMs: 150,
        lowBandwidthPageSize: 50,
      }).map((violation) => violation.metric),
    ).toEqual(['initialJavaScriptBytes', 'firstContentfulPaintMs', 'lowBandwidthPageSize']);
  });

  it('renders offline boundaries, localized pending count, update safety and support actions', () => {
    const markup = renderToStaticMarkup(
      <ExperienceResiliencePanel
        locale="bn-BD"
        connectivity="offline"
        bandwidthMode="low"
        pendingActionCount={12}
        lastSuccessfulSyncAt="2026-07-29T08:00:00+06:00"
        updateAvailable
        retryHref="/teacher/sync"
        supportHref="/offline.html"
        onBandwidthModeChange={() => undefined}
      />,
    );

    expect(markup).toContain('Working offline');
    expect(markup).toContain('১২ pending on this device');
    expect(markup).toContain('Drafts only; payments, publication and finalisation stay online.');
    expect(markup).toContain('Finish or sync current drafts before refreshing.');
    expect(markup).toContain('href="/teacher/sync"');
    expect(markup).toContain('href="/offline.html"');
  });

  it('registers the service worker and reports an installed update without forcing refresh', async () => {
    let updateFound: (() => void) | undefined;
    let stateChanged: (() => void) | undefined;
    let updateSignals = 0;
    const worker: { state: string } & ServiceWorkerStateTarget = {
      state: 'installing',
      addEventListener(_type, listener) {
        stateChanged = listener;
      },
    };
    const registration: ServiceWorkerRegistrationTarget = {
      installing: worker,
      waiting: null,
      addEventListener(_type, listener) {
        updateFound = listener;
      },
    };
    const container: ServiceWorkerContainerTarget = {
      controller: {},
      register(scriptUrl, options) {
        expect(scriptUrl).toBe('/sw.js');
        expect(options.scope).toBe('/');
        return Promise.resolve(registration);
      },
    };

    const result = await registerPlatformServiceWorker({
      container,
      onUpdateAvailable: () => {
        updateSignals += 1;
      },
    });
    expect(result).toEqual({ status: 'registered', updateAvailable: false });

    updateFound?.();
    worker.state = 'installed';
    stateChanged?.();
    expect(updateSignals).toBe(1);
  });

  it('keeps manifest, offline fallback and service-worker cache exclusions explicit', () => {
    const manifest = readFileSync(
      new URL('../../apps/platform-web/public/manifest.webmanifest', import.meta.url),
      'utf8',
    );
    const serviceWorker = readFileSync(
      new URL('../../apps/platform-web/public/sw.js', import.meta.url),
      'utf8',
    );
    const offline = readFileSync(
      new URL('../../apps/platform-web/public/offline.html', import.meta.url),
      'utf8',
    );
    const index = readFileSync(
      new URL('../../apps/platform-web/index.html', import.meta.url),
      'utf8',
    );

    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"purpose": "any maskable"');
    expect(index).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(serviceWorker).toContain("request.method !== 'GET'");
    expect(serviceWorker).toContain("'/api/'");
    expect(serviceWorker).toContain("'/documents/download/'");
    expect(serviceWorker).toContain('no-store|private');
    expect(serviceWorker).toContain('responseCanBeCached(response)');
    expect(offline).toContain(
      'Payments, publication, document downloads and final approval require',
    );
  });
});
