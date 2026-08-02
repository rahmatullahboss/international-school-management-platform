import { describe, expect, it, vi } from 'vitest';

import { readBoundedUtf8RequestBody } from './bounded-request-body.js';

function stream(chunks: readonly Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
    cancel() {
      onCancel?.();
    },
  });
}

const encoder = new TextEncoder();

describe('bounded UTF-8 request body reader', () => {
  it('returns an empty body when no stream exists', async () => {
    await expect(readBoundedUtf8RequestBody(null, 32)).resolves.toBe('');
  });

  it('accepts UTF-8 chunks up to the exact byte limit', async () => {
    await expect(
      readBoundedUtf8RequestBody(stream([encoder.encode('é'), encoder.encode('é')]), 4),
    ).resolves.toBe('éé');
  });

  it('cancels as soon as streamed bytes exceed the limit', async () => {
    const cancelled = vi.fn();
    await expect(
      readBoundedUtf8RequestBody(
        stream([encoder.encode('1234'), encoder.encode('5'), encoder.encode('never-read')], cancelled),
        4,
      ),
    ).resolves.toBeUndefined();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('rejects malformed UTF-8 without exposing decoder errors', async () => {
    await expect(
      readBoundedUtf8RequestBody(stream([new Uint8Array([0xc3, 0x28])]), 8),
    ).resolves.toBeUndefined();
  });

  it('rejects invalid internal limits', async () => {
    await expect(readBoundedUtf8RequestBody(stream([encoder.encode('a')]), -1)).resolves.toBeUndefined();
    await expect(
      readBoundedUtf8RequestBody(stream([encoder.encode('a')]), Number.POSITIVE_INFINITY),
    ).resolves.toBeUndefined();
  });
});
