import type {
  CommunicationChannel,
  CommunicationChannelAdapter,
  ProviderMessage,
  ProviderResult,
} from './contracts.js';

export interface RecordedProviderMessage extends ProviderMessage {
  readonly providerReference: string;
  readonly state: ProviderResult['state'];
}

export class InMemoryChannelAdapter implements CommunicationChannelAdapter {
  readonly #messages: RecordedProviderMessage[] = [];
  readonly #results = new Map<string, ProviderResult>();
  readonly #forcedFailures = new Map<string, string>();

  constructor(readonly channel: CommunicationChannel) {}

  get messages(): readonly RecordedProviderMessage[] {
    return Object.freeze([...this.#messages]);
  }

  failNext(destination: string, failureCode: string): void {
    this.#forcedFailures.set(destination, failureCode);
  }

  send(message: ProviderMessage): ProviderResult {
    const existing = this.#results.get(message.idempotencyKey);
    if (existing !== undefined) return existing;

    const failureCode = this.#forcedFailures.get(message.destination);
    if (failureCode !== undefined) {
      this.#forcedFailures.delete(message.destination);
      const failed: ProviderResult = Object.freeze({ state: 'failed', failureCode });
      this.#results.set(message.idempotencyKey, failed);
      return failed;
    }

    const providerReference = `${this.channel}:${message.dispatchId}`;
    const result: ProviderResult = Object.freeze({
      state: this.channel === 'in-app' ? 'delivered' : 'accepted',
      providerReference,
    });
    this.#results.set(message.idempotencyKey, result);
    this.#messages.push(
      Object.freeze({
        ...message,
        providerReference,
        state: result.state,
      }),
    );
    return result;
  }
}

export function createInMemoryCommunicationAdapters(): ReadonlyMap<
  CommunicationChannel,
  InMemoryChannelAdapter
> {
  return new Map<CommunicationChannel, InMemoryChannelAdapter>([
    ['in-app', new InMemoryChannelAdapter('in-app')],
    ['email', new InMemoryChannelAdapter('email')],
    ['sms', new InMemoryChannelAdapter('sms')],
    ['push', new InMemoryChannelAdapter('push')],
  ]);
}
