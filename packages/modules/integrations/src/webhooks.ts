import {
  bytesToHex,
  cloneAndFreeze,
  constantTimeEqual,
  sha256,
  stableStringify,
} from './common.js';

export interface WebhookSignInput {
  value: string;
  body: string;
  timestamp: number;
}

export interface WebhookVerifyInput extends WebhookSignInput {
  signature: string;
  now: number;
}

export interface WebhookSignerOptions {
  toleranceSeconds?: number;
}

async function hmacSha256(value: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}

export class WebhookSigner {
  readonly #toleranceSeconds: number;

  constructor(options: WebhookSignerOptions = {}) {
    this.#toleranceSeconds = options.toleranceSeconds ?? 300;
  }

  async sign(input: WebhookSignInput): Promise<string> {
    const digest = await hmacSha256(input.value, `${input.timestamp}.${input.body}`);
    return `t=${input.timestamp},v1=${digest}`;
  }

  async verify(input: WebhookVerifyInput): Promise<boolean> {
    const match = /^t=(\d+),v1=([a-f0-9]{64})$/u.exec(input.signature);
    if (!match) return false;
    const timestamp = Number(match[1]);
    const provided = match[2] ?? '';
    if (!Number.isSafeInteger(timestamp)) return false;
    if (Math.abs(input.now - timestamp) > this.#toleranceSeconds) return false;
    const expected = await hmacSha256(input.value, `${timestamp}.${input.body}`);
    return constantTimeEqual(expected, provided);
  }
}

interface InboundReceipt {
  payloadHash: string;
  result: unknown;
}

interface InFlightReceipt {
  payloadHash: string;
  promise: Promise<unknown>;
}

export interface ProcessInboundWebhookInput<Result> {
  tenantId: string;
  connectionId: string;
  providerEventId: string;
  payload: unknown;
  handler: () => Promise<Result>;
}

export interface ProcessInboundWebhookResult<Result> {
  duplicate: boolean;
  result: Result;
}

export class InboundWebhookProcessor {
  readonly #receipts = new Map<string, InboundReceipt>();
  readonly #inFlight = new Map<string, InFlightReceipt>();

  async process<Result>(
    input: ProcessInboundWebhookInput<Result>,
  ): Promise<Readonly<ProcessInboundWebhookResult<Result>>> {
    const key = `${input.tenantId}:${input.connectionId}:${input.providerEventId}`;
    const payloadHash = await sha256(stableStringify(input.payload));
    const existing = this.#receipts.get(key);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new Error('Provider event identifier was reused with a different payload');
      }
      return cloneAndFreeze({ duplicate: true, result: existing.result as Result });
    }
    const inFlight = this.#inFlight.get(key);
    if (inFlight) {
      if (inFlight.payloadHash !== payloadHash) {
        throw new Error('Provider event identifier was reused with a different payload');
      }
      return cloneAndFreeze({ duplicate: true, result: (await inFlight.promise) as Result });
    }

    const promise = input.handler();
    this.#inFlight.set(key, { payloadHash, promise });
    try {
      const result = await promise;
      this.#receipts.set(key, { payloadHash, result });
      return cloneAndFreeze({ duplicate: false, result });
    } finally {
      this.#inFlight.delete(key);
    }
  }
}

export type WebhookDeliveryStatus = 'pending' | 'retrying' | 'delivered' | 'dead-letter';

export interface EnqueueWebhookDeliveryInput {
  tenantId: string;
  subscriptionId: string;
  eventId: string;
  body: string;
  now: Date;
}

export interface WebhookDelivery {
  tenantId: string;
  subscriptionId: string;
  eventId: string;
  deliveryId: string;
  body: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  replayCount: number;
  nextAttemptAt: Date | null;
  deliveredAt: Date | null;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryQueueOptions {
  maxAttempts?: number;
  retryDelaySeconds?: (attempt: number) => number;
  idFactory?: () => string;
}

export class WebhookDeliveryQueue {
  readonly #deliveries = new Map<string, Readonly<WebhookDelivery>>();
  readonly #deduplication = new Map<string, string>();
  readonly #maxAttempts: number;
  readonly #retryDelaySeconds: (attempt: number) => number;
  readonly #idFactory: () => string;

  constructor(options: WebhookDeliveryQueueOptions = {}) {
    this.#maxAttempts = options.maxAttempts ?? 5;
    this.#retryDelaySeconds = options.retryDelaySeconds ?? ((attempt) => 2 ** attempt * 30);
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    if (this.#maxAttempts < 1) throw new Error('maxAttempts must be positive');
  }

  enqueue(input: EnqueueWebhookDeliveryInput): Readonly<WebhookDelivery> {
    const deduplicationKey = `${input.tenantId}:${input.subscriptionId}:${input.eventId}`;
    const existingId = this.#deduplication.get(deduplicationKey);
    if (existingId) {
      const existing = this.#deliveries.get(existingId);
      if (!existing) throw new Error('Webhook delivery index is inconsistent');
      return existing;
    }
    const deliveryId = this.#idFactory();
    if (this.#deliveries.has(deliveryId)) throw new Error('Webhook delivery identifier exists');
    const delivery = cloneAndFreeze<WebhookDelivery>({
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      eventId: input.eventId,
      deliveryId,
      body: input.body,
      status: 'pending',
      attempts: 0,
      replayCount: 0,
      nextAttemptAt: input.now,
      deliveredAt: null,
      responseStatus: null,
      lastError: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.#deliveries.set(deliveryId, delivery);
    this.#deduplication.set(deduplicationKey, deliveryId);
    return delivery;
  }

  due(now: Date): readonly Readonly<WebhookDelivery>[] {
    return [...this.#deliveries.values()]
      .filter(
        (delivery) =>
          (delivery.status === 'pending' || delivery.status === 'retrying') &&
          delivery.nextAttemptAt !== null &&
          delivery.nextAttemptAt <= now,
      )
      .sort(
        (left, right) =>
          (left.nextAttemptAt?.getTime() ?? 0) - (right.nextAttemptAt?.getTime() ?? 0),
      );
  }

  recordFailure(deliveryId: string, error: string, now: Date): Readonly<WebhookDelivery> {
    const delivery = this.#require(deliveryId);
    if (delivery.status === 'delivered') throw new Error('Delivered webhook cannot fail');
    const attempts = delivery.attempts + 1;
    const exhausted = attempts >= this.#maxAttempts;
    const updated = cloneAndFreeze<WebhookDelivery>({
      ...delivery,
      status: exhausted ? 'dead-letter' : 'retrying',
      attempts,
      nextAttemptAt: exhausted
        ? null
        : new Date(now.getTime() + this.#retryDelaySeconds(attempts) * 1_000),
      lastError: error,
      updatedAt: now,
    });
    this.#deliveries.set(deliveryId, updated);
    return updated;
  }

  recordSuccess(deliveryId: string, responseStatus: number, now: Date): Readonly<WebhookDelivery> {
    const delivery = this.#require(deliveryId);
    const updated = cloneAndFreeze<WebhookDelivery>({
      ...delivery,
      status: 'delivered',
      deliveredAt: now,
      responseStatus,
      nextAttemptAt: null,
      lastError: null,
      updatedAt: now,
    });
    this.#deliveries.set(deliveryId, updated);
    return updated;
  }

  deadLetters(tenantId: string): readonly Readonly<WebhookDelivery>[] {
    return [...this.#deliveries.values()].filter(
      (delivery) => delivery.tenantId === tenantId && delivery.status === 'dead-letter',
    );
  }

  replayDeadLetter(deliveryId: string, now: Date): Readonly<WebhookDelivery> {
    const delivery = this.#require(deliveryId);
    if (delivery.status !== 'dead-letter')
      throw new Error('Only dead-letter deliveries can replay');
    const updated = cloneAndFreeze<WebhookDelivery>({
      ...delivery,
      status: 'pending',
      attempts: 0,
      replayCount: delivery.replayCount + 1,
      nextAttemptAt: now,
      deliveredAt: null,
      responseStatus: null,
      lastError: null,
      updatedAt: now,
    });
    this.#deliveries.set(deliveryId, updated);
    return updated;
  }

  #require(deliveryId: string): Readonly<WebhookDelivery> {
    const delivery = this.#deliveries.get(deliveryId);
    if (!delivery) throw new Error('Unknown webhook delivery');
    return delivery;
  }
}
