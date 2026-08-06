async function safeCancel(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The caller receives a sanitized invalid-body result either way.
  }
}

export async function readBoundedUtf8RequestBody(
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
): Promise<string | undefined> {
  if (body === null) return '';
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) return undefined;

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return undefined;
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let text = '';
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > maximumBytes) {
        await safeCancel(reader);
        return undefined;
      }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    await safeCancel(reader);
    return undefined;
  } finally {
    reader.releaseLock();
  }
}
