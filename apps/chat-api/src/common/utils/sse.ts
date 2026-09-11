import type { Response } from 'express';

/**
 * SSE comment written as the very first byte of every event stream.
 *
 * Firefox does not hand a streamed response to the `fetch()` caller until at
 * least one byte of the body has arrived — flushed headers alone are not
 * enough. Every SSE endpoint here flushes headers well before the first real
 * event exists (a completion waits on the model's first token;
 * `conversations/watch` and `client-channel/subscribe` wait on a DIAL Core
 * push that may never come), so without this comment Firefox leaves the
 * request pending: `fetch()` never resolves, the client-channel id never
 * arrives, and `useConversationStream` blocks on `waitForChannel` for its
 * full 20s timeout before the completion request is even sent.
 *
 * A comment line is inert for consumers — every SSE reader in this repo skips
 * lines that do not start with `data:`. Same fix as the pre-BFF app carried in
 * `pages/api/client-channels/subscribe.ts` (issue #6500).
 */
export const SSE_INIT_PAYLOAD = ': init\n\n';

/** Periodic no-op comment that keeps an idle event stream from being reaped. */
export const SSE_KEEPALIVE_PAYLOAD = ': keepalive\n\n';

/**
 * Sends the SSE response headers and the initial {@link SSE_INIT_PAYLOAD}
 * comment, so every browser — Firefox included — surfaces the stream to the
 * caller immediately instead of waiting for the first real event.
 *
 * Callers that need extra response headers must set them before calling this.
 */
export const startSseResponse = (res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(SSE_INIT_PAYLOAD);
};

/**
 * How long an upstream-relaying SSE handler (client-channel subscribe,
 * conversation watch) waits for `'drain'` after `res.write()` signals
 * backpressure before treating the connection as stalled and closing it —
 * the same as an explicit client disconnect.
 */
export const SSE_DRAIN_TIMEOUT_MS = 5000;

export interface SseWriteResult {
  /** False only when the response was already ended/detached. */
  written: boolean;
  /** True when `res.write()` returned `false` — the caller must wait for `'drain'` before writing more. */
  needsDrain: boolean;
}

/**
 * Wraps `res.write()` so every SSE handler shares the same backpressure
 * signal instead of four bespoke checks of its boolean return value.
 */
export const writeSseChunk = (
  res: Response,
  chunk: Uint8Array | string,
): SseWriteResult => {
  if (res.writableEnded) {
    return { written: false, needsDrain: false };
  }

  const needsDrain = !res.write(chunk);
  return { written: true, needsDrain };
};

/**
 * Resolves on whichever comes first: the response's `'drain'` event, the
 * given `signal` aborting (connection closed / upstream error), or
 * `timeoutMs` elapsing. Always tears down its own listeners/timer before
 * resolving, on every branch, so a caller can safely call this repeatedly
 * across a long-lived relay loop without leaking listeners.
 */
export const waitForDrain = (
  res: Response,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<'drained' | 'timeout' | 'aborted'> =>
  new Promise((resolve) => {
    let isSettled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      res.off('drain', onDrain);
      signal.removeEventListener('abort', onAbort);
    };

    const settle = (result: 'drained' | 'timeout' | 'aborted'): void => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(result);
    };

    const onDrain = (): void => settle('drained');
    const onAbort = (): void => settle('aborted');

    const timer = setTimeout(() => settle('timeout'), timeoutMs);

    if (signal.aborted) {
      settle('aborted');
      return;
    }

    res.once('drain', onDrain);
    signal.addEventListener('abort', onAbort);
  });
