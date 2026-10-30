/**
 * Reads a newline-delimited SSE stream, JSON-decoding each `data:` line and
 * passing it to `onEvent`. Stops reading — and always releases the reader —
 * as soon as `onEvent` returns `true`, when the stream ends, or when
 * `reader.read()` rejects (a network error, or the caller aborting the
 * stream's own `AbortSignal`, e.g. on timeout). Malformed lines and
 * non-`data:` lines (comments, keepalives) are skipped silently.
 */
export const readSseEvents = async <TEvent>(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: TEvent) => Promise<boolean> | boolean,
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let shouldStop = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        let event: TEvent;
        try {
          event = JSON.parse(data) as TEvent;
        } catch {
          continue;
        }
        if (await onEvent(event)) {
          shouldStop = true;
          break;
        }
      }
      if (shouldStop) break;
    }
  } catch {
    /*
     * Network error, or the caller's own AbortSignal fired (timeout) — the
     * caller tracks its own timeout flag separately and decides what to do.
     */
  } finally {
    reader.releaseLock();
  }
};
