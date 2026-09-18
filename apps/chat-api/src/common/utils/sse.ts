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

/**
 * Lifecycle of a downstream SSE response that relays backend-owned work
 * (`conversations/completions`, `conversations/completions/attach`). These
 * are deliberately distinct states rather than one "detached" boolean,
 * because the cleanup obligation differs: a response the client closed must
 * never be touched again, while a response that is merely slow is still open
 * and this handler owns terminating it. Conflating the two is what left a
 * slow client's response open with a megabyte buffered after the handler had
 * already returned.
 */
export enum SseResponseState {
  /** Writes are still going to the client. Ends normally when work finishes. */
  Streaming = 'streaming',
  /** `'close'` fired — Node already destroyed it; no write/end/destroy. */
  ClientClosed = 'client_closed',
  /** Over the buffered-bytes limit, or a write threw. Still open: release it. */
  BackpressureDetached = 'backpressure_detached',
  /** Ended normally once the relayed work finished. */
  Completed = 'completed',
}

/** How {@link releaseSseResponse} terminated a response. */
export enum SseReleaseOutcome {
  /** It was already finished or destroyed; nothing was touched. */
  AlreadyTerminal = 'already-terminal',
  /** `res.end()` flushed and `'finish'`/`'close'` arrived inside the bound. */
  Ended = 'ended',
  /** The bound elapsed without flushing, so the socket was destroyed. */
  Destroyed = 'destroyed',
}

/**
 * How long {@link releaseSseResponse} waits for a gracefully ended response
 * to actually flush before destroying it.
 *
 * `res.end()` alone does not reclaim what is already queued: on a real
 * `http.ServerResponse` whose peer has stopped reading it sets
 * `writableEnded` but leaves `writableFinished` false and `writableLength`
 * unchanged indefinitely, because `'finish'` only fires once the queue
 * drains. Only `destroy()` releases those bytes. So the bound is what makes
 * termination actually happen, not a defensive extra.
 *
 * 15s is long enough for a genuinely slow-but-progressing client to flush the
 * ~1 MiB the buffered-bytes limits allow (≈560 kbit/s sustained — below that
 * a streaming chat is unusable anyway) and short enough to bound retention.
 * Same order as {@link SSE_KEEPALIVE_INTERVAL_MS} in the conversation
 * controller, and an internal safety bound rather than an operator setting.
 */
export const SSE_RELEASE_TIMEOUT_MS = 15_000;

/**
 * Terminates a downstream SSE response this handler still owns: graceful
 * `res.end()` first, and `res.destroy()` only if the response has not
 * reported `'finish'`/`'close'` within `timeoutMs`.
 *
 * No further SSE event is written first — a response reaches here precisely
 * because the peer is not reading, so another frame would only enlarge the
 * queue. Never rejects, so a caller that cannot await it (a synchronous
 * cleanup path) can safely fire and forget.
 */
export const releaseSseResponse = (
  res: Response,
  timeoutMs: number = SSE_RELEASE_TIMEOUT_MS,
): Promise<SseReleaseOutcome> =>
  new Promise((resolve) => {
    if (res.writableFinished || res.destroyed) {
      resolve(SseReleaseOutcome.AlreadyTerminal);
      return;
    }

    let isSettled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      res.off('finish', onTerminal);
      res.off('close', onTerminal);
    };

    const onTerminal = (): void => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(SseReleaseOutcome.Ended);
    };

    /*
     * Settles and detaches its listeners *before* destroying, because
     * `destroy()` emits `'close'` — which would otherwise re-enter
     * `onTerminal` and report a graceful end for a forced one.
     */
    const timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      res.destroy();
      resolve(SseReleaseOutcome.Destroyed);
    }, timeoutMs);

    /*
     * Listeners go on before `end()`: a response whose queue is already empty
     * can emit `'finish'` during the `end()` call itself.
     */
    res.once('finish', onTerminal);
    res.once('close', onTerminal);

    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        /*
         * A response whose peer vanished mid-call can refuse a late `end()`.
         * The bound above still guarantees a terminal state, so there is
         * nothing to do but let it run.
         */
      }
    }
  });
