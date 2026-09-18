import http from 'node:http';
import net from 'node:net';
import { Writable } from 'node:stream';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { SSE_RELEASE_TIMEOUT_MS } from '../../common/utils/sse';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import type { SendCompletionDto } from '../dto/send-completion.dto';

/*
 * Lifecycle of the downstream completion response itself — distinct from
 * `completions.integration.spec.ts`, which covers the endpoint's request/
 * response contract. Everything here asserts what state `res` is left in
 * after the handler returns, because a detached-but-open response is exactly
 * the defect this suite exists to catch: reaching the end of the generator is
 * not evidence that the HTTP response was released.
 *
 * Real `stream.Writable`s and a real `http.Server` are used deliberately. A
 * hand-rolled fake cannot express the distinction the fix turns on: `end()`
 * marks a stalled response `writableEnded` but leaves its queued bytes in
 * place, and only `destroy()` drops `writableLength` to 0 on a real
 * `ServerResponse`.
 */

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};

const TEST_REQUEST = {
  user: TEST_USER,
  authSource: AuthSource.Cookie,
} as unknown as ExpressRequest;

const VALID_COMPLETION_BODY = {
  generationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  path: 'test-bucket/gpt-4o__Hello__uuid',
  model: 'gpt-4o',
  mode: 'append',
  message: 'Hello',
} as unknown as SendCompletionDto;

const CHUNK_SIZE = 64 * 1024;
/** 20 * 64 KiB = 1.25 MiB, past `SSE_COMPLETION_MAX_BUFFERED_BYTES`. */
const CHUNKS_PAST_LIMIT = 20;
/** The `onReadyToStream` callback's position in `streamCompletion`'s argument list. */
const ON_READY_TO_STREAM_ARG = 10;

const makeGenerationService = () => ({
  register: vi.fn().mockReturnValue(new AbortController()),
  abort: vi.fn().mockReturnValue(true),
  complete: vi.fn(),
  error: vi.fn(),
  getStatus: vi.fn().mockReturnValue(GenerationStatus.Active),
});

/**
 * Stands in for `ConversationStreamingService.streamCompletion`: yields
 * `chunkCount` chunks, then records that it persisted and returned normally.
 * `events` captures ordering so a test can prove persistence settled *before*
 * the response was released — the generator awaits its terminal
 * `saveConversation` before returning, so the controller's cleanup can never
 * precede it.
 */
const makeStreamingService = (
  events: string[],
  chunkCount: number,
  onFirstChunk?: () => void,
) => ({
  streamCompletion: vi.fn().mockImplementation(async function* (
    ...args: unknown[]
  ) {
    (args[ON_READY_TO_STREAM_ARG] as () => void)();
    for (let index = 0; index < chunkCount; index += 1) {
      yield Buffer.alloc(CHUNK_SIZE, 'x');
      if (index === 0) onFirstChunk?.();
    }
    events.push('persisted');
  }),
});

/**
 * A response whose `write` withholds its callback, so writes queue in the
 * internal buffer and `writableLength` climbs exactly as it does for a
 * browser that stopped reading.
 *
 * `resume()` models the peer starting to read again: it stops withholding
 * callbacks *and* releases the ones already held, so the whole backlog
 * drains. Releasing only the held callbacks would not be enough — a
 * `Writable` invokes `_write` for one chunk at a time, so at any moment only
 * a single callback is outstanding no matter how much is queued behind it.
 */
const createStalledResponse = (): {
  res: ExpressResponse;
  resume: () => void;
} => {
  const pendingCallbacks: Array<() => void> = [];
  let isStalled = true;
  const writable = new Writable({
    highWaterMark: 1024,
    write(_chunk, _encoding, callback) {
      if (isStalled) {
        pendingCallbacks.push(callback);
        return;
      }
      callback();
    },
  });
  Object.assign(writable, { setHeader: vi.fn(), flushHeaders: vi.fn() });
  return {
    res: writable as unknown as ExpressResponse,
    resume: () => {
      isStalled = false;
      pendingCallbacks.splice(0).forEach((callback) => callback());
    },
  };
};

/** Records `end`/`destroy` calls while still invoking the real implementation. */
const spyOnTermination = (res: ExpressResponse, events: string[]) => {
  const writable = res as unknown as Writable;
  const originalEnd = writable.end.bind(writable);
  const originalDestroy = writable.destroy.bind(writable);

  const end = vi.spyOn(writable, 'end').mockImplementation(((
    ...args: never[]
  ) => {
    events.push('end');
    return originalEnd(...args);
  }) as never);
  const destroy = vi.spyOn(writable, 'destroy').mockImplementation(((
    ...args: never[]
  ) => {
    events.push('destroy');
    return originalDestroy(...args);
  }) as never);

  return { end, destroy };
};

const waitUntil = async (
  predicate: () => boolean,
  label: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`waitUntil timed out waiting for: ${label}`);
};

const makeController = (
  streamingService: ReturnType<typeof makeStreamingService>,
  generationService: ReturnType<typeof makeGenerationService>,
) =>
  new ConversationController(
    streamingService as unknown as ConversationService,
    generationService as unknown as ConversationGenerationService,
  );

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('streamCompletion — downstream response lifecycle under backpressure', () => {
  it('stops writing, finishes the generation, and destroys the response when it cannot flush within the bound', async () => {
    /*
     * Only `setTimeout` is faked: the release timer must be advanceable
     * without a 15s test, while `setImmediate` stays real so `waitUntil` can
     * still yield to the event loop.
     */
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const events: string[] = [];
    const { res } = createStalledResponse();
    const termination = spyOnTermination(res, events);
    const generationService = makeGenerationService();
    const streamingService = makeStreamingService(events, CHUNKS_PAST_LIMIT);
    const writeSpy = vi.spyOn(res as unknown as Writable, 'write');

    const handled = makeController(
      streamingService,
      generationService,
    ).streamCompletion(TEST_REQUEST, res, VALID_COMPLETION_BODY, undefined);

    await waitUntil(() => events.includes('end'), 'the response to be ended');

    // (a) Writes stopped at the limit instead of buffering every chunk.
    expect(writeSpy.mock.calls.length).toBeLessThan(CHUNKS_PAST_LIMIT + 1);
    const writesAtDetachment = writeSpy.mock.calls.length;

    // (b) Persistence settled before the response was released.
    expect(events.indexOf('persisted')).toBeLessThan(events.indexOf('end'));

    // Graceful end alone cannot complete — `write` never calls back, so
    // `'finish'` never fires and the bounded fallback must take over.
    expect(termination.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SSE_RELEASE_TIMEOUT_MS);
    await handled;

    // (c) The generation was never cancelled on account of the slow client.
    expect(generationService.abort).not.toHaveBeenCalled();
    // (d) The response is terminal, and no chunk was written after detachment.
    expect(termination.destroy).toHaveBeenCalledOnce();
    expect((res as unknown as Writable).writableEnded).toBe(true);
    expect((res as unknown as Writable).destroyed).toBe(true);
    expect(writeSpy.mock.calls.length).toBe(writesAtDetachment);
  });

  it('ends a detached response gracefully, without destroying it, when the client drains in time', async () => {
    const events: string[] = [];
    const { res, resume } = createStalledResponse();
    const termination = spyOnTermination(res, events);
    const generationService = makeGenerationService();
    const streamingService = makeStreamingService(events, CHUNKS_PAST_LIMIT);

    const handled = makeController(
      streamingService,
      generationService,
    ).streamCompletion(TEST_REQUEST, res, VALID_COMPLETION_BODY, undefined);

    await waitUntil(() => events.includes('end'), 'the response to be ended');
    // The peer starts reading again after `end()`, so the queue drains and
    // `'finish'` arrives well inside `SSE_RELEASE_TIMEOUT_MS`.
    resume();
    await handled;

    /*
     * `writableFinished` is what proves the graceful path was taken: a
     * response terminated by the bounded `destroy()` fallback never reaches
     * it. A `destroy` spy would not prove it — Node's own `autoDestroy`
     * destroys the stream after `'finish'` either way.
     */
    expect((res as unknown as Writable).writableFinished).toBe(true);
    expect(termination.end).toHaveBeenCalledOnce();
    expect(generationService.abort).not.toHaveBeenCalled();
  });

  it('never detaches a client whose buffered output stays under the limit, and ends it exactly once', async () => {
    const events: string[] = [];
    const writable = new Writable({
      highWaterMark: 1024,
      write(_chunk, _encoding, callback) {
        // Drains immediately — `writableLength` returns to 0 after each write.
        callback();
      },
    });
    Object.assign(writable, { setHeader: vi.fn(), flushHeaders: vi.fn() });
    const res = writable as unknown as ExpressResponse;
    const termination = spyOnTermination(res, events);
    const generationService = makeGenerationService();
    const streamingService = makeStreamingService(events, CHUNKS_PAST_LIMIT);
    const writeSpy = vi.spyOn(writable, 'write');

    await makeController(streamingService, generationService).streamCompletion(
      TEST_REQUEST,
      res,
      VALID_COMPLETION_BODY,
      undefined,
    );

    // Every chunk plus the `: init` comment reached the client.
    expect(writeSpy).toHaveBeenCalledTimes(CHUNKS_PAST_LIMIT + 1);
    expect(termination.end).toHaveBeenCalledOnce();
    expect(writable.writableEnded).toBe(true);
  });

  it('leaves a closed response untouched while still draining the generation', async () => {
    const events: string[] = [];
    const { res } = createStalledResponse();
    const termination = spyOnTermination(res, events);
    const generationService = makeGenerationService();
    const emitClose = () => (res as unknown as Writable).emit('close');
    const streamingService = makeStreamingService(
      events,
      CHUNKS_PAST_LIMIT,
      emitClose,
    );
    const writeSpy = vi.spyOn(res as unknown as Writable, 'write');

    await makeController(streamingService, generationService).streamCompletion(
      TEST_REQUEST,
      res,
      VALID_COMPLETION_BODY,
      undefined,
    );

    // The generator still ran to its natural end and persisted.
    expect(events).toContain('persisted');
    expect(generationService.abort).not.toHaveBeenCalled();
    // Nothing was written, ended, or destroyed against the closed response.
    expect(writeSpy.mock.calls.length).toBeLessThan(CHUNKS_PAST_LIMIT + 1);
    expect(termination.end).not.toHaveBeenCalled();
    expect(termination.destroy).not.toHaveBeenCalled();
  });
});

describe('streamCompletion — downstream response lifecycle over real HTTP', () => {
  /*
   * 8 MiB of intent, so that even a socket whose underlying write never
   * completes still crosses the 1 MiB threshold on its own — the queueing
   * this asserts comes from the write below, not from chunk count.
   */
  const REAL_HTTP_CHUNKS = 128;

  const startServer = async (
    handle: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<{ server: http.Server; port: number }> => {
    const server = http.createServer(handle);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a TCP address');
    }
    return { server, port: address.port };
  };

  /**
   * Makes the response's underlying TCP socket withhold every in-flight
   * write, so `res` never drains regardless of the machine's OS-level
   * socket buffer size.
   *
   * `socket.pause()`-ing the *client* was tried first and is what this
   * replaces: on a real network stack the kernel's receive window can
   * absorb megabytes before the sender ever blocks, so whether the payload
   * below has fully flushed by the time this test samples it is a race
   * against that buffer's size — observed to flip `writableFinished` to
   * `true` early on a CI runner with a larger window than the machine this
   * was authored on.
   *
   * Patching the *internal* `_write` (not the public `write()`) is what
   * keeps `res.writableLength`'s own bookkeeping correct: the public API is
   * where `Writable` increments it, and only the paired `_write` callback
   * decrements it, so withholding that callback reproduces genuine
   * backpressure deterministically. `_destroy` is patched too, to abort any
   * outstanding write with an error before tearing down — mirroring what a
   * real socket handle does on destroy (and is *why* `destroy()` reclaims
   * the buffer on a genuine stalled connection) — because a stand-in `_write`
   * that never calls back has no other way to resolve it.
   */
  const stallSocketWrites = (socket: net.Socket): void => {
    const pendingCallbacks: Array<(err?: Error) => void> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any)._write = (
      _chunk: unknown,
      _encoding: unknown,
      callback: (err?: Error) => void,
    ) => {
      pendingCallbacks.push(callback);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalDestroy = (socket as any)._destroy.bind(socket);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any)._destroy = (
      err: Error | null,
      cb: (err?: Error) => void,
    ) => {
      const stalled = pendingCallbacks.splice(0);
      originalDestroy(err, cb);
      stalled.forEach((callback) => callback(err ?? new Error('destroyed')));
    };
  };

  /** A client that sends the request and is never read by the test. */
  const connectClient = (port: number): net.Socket => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(
        'POST /api/v1/conversations/completions HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n',
      );
    });
    socket.on('error', () => undefined);
    return socket;
  };

  it('releases a real ServerResponse whose underlying socket stopped accepting writes: ended, then destroyed with its buffer reclaimed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const events: string[] = [];
    const generationService = makeGenerationService();
    const streamingService = makeStreamingService(events, REAL_HTTP_CHUNKS);

    let serverResponse: http.ServerResponse | undefined;
    let handled: Promise<void> | undefined;
    const { server, port } = await startServer((req, res) => {
      stallSocketWrites(req.socket);
      serverResponse = res;
      Object.assign(req, TEST_REQUEST);
      handled = makeController(streamingService, generationService)
        .streamCompletion(
          req as unknown as ExpressRequest,
          res as unknown as ExpressResponse,
          VALID_COMPLETION_BODY,
          undefined,
        )
        .catch(() => undefined);
    });
    const socket = connectClient(port);

    try {
      await waitUntil(
        () => serverResponse?.writableEnded === true,
        'the real response to be ended',
      );

      /*
       * The pre-fix fingerprint, verified against this exact setup: `end()`
       * flips `writableEnded` but leaves the queued megabytes in place and
       * `'finish'` never arrives, so the bound is what reclaims them.
       */
      expect(serverResponse?.writableFinished).toBe(false);
      expect(serverResponse?.writableLength).toBeGreaterThan(1024 * 1024);
      expect(serverResponse?.destroyed).toBe(false);

      await vi.advanceTimersByTimeAsync(SSE_RELEASE_TIMEOUT_MS);
      await handled;

      expect(serverResponse?.destroyed).toBe(true);
      // The bytes still queued for the aborted in-flight write are released
      // as part of destroying the socket, the same as a real stalled
      // connection — not left buffered on an object nothing references
      // anymore.
      expect(serverResponse?.writableLength).toBe(0);
      expect(generationService.abort).not.toHaveBeenCalled();
      expect(events).toContain('persisted');
    } finally {
      socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
