import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChatStreamApi,
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  GenerationConflictError,
  GenerationPersistenceError,
  StreamInterruptedError,
  StreamUpstreamError,
} from '../create-chat-stream-api';

let csrfToken: string | null = null;
const getCsrfToken = () => csrfToken;
const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

describe('createChatStreamApi', () => {
  const fetchMock = vi.fn();
  let getTimezone: () => string | undefined;

  const makeApi = () =>
    createChatStreamApi({
      getCsrfToken,
      setCsrfToken,
      completionsBasePath: '/api/v1/conversations',
      getTimezone: () => getTimezone(),
      fetchImpl: fetchMock,
    });

  beforeEach(() => {
    fetchMock.mockReset();
    csrfToken = null;
    getTimezone = () => undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when stopCompletion receives a non-OK response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const { stopCompletion } = makeApi();

    await expect(
      stopCompletion({
        generationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        path: 'gpt-4o__Hello__uuid',
      }),
    ).rejects.toThrow('stopCompletion failed: 500');
  });

  it('sends the stop request body to the completion stop endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { stopCompletion } = makeApi();

    await stopCompletion({
      generationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      path: 'gpt-4o__Hello__uuid',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/conversations/completions/stop',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          generationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
          path: 'gpt-4o__Hello__uuid',
        }),
      }),
    );
  });

  const emptyStream = (): ReadableStream<Uint8Array> =>
    new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

  const completeStreamRequest = (): Promise<void> =>
    new Promise<void>((resolve) => {
      const { streamCompletion } = makeApi();
      streamCompletion('gpt-4o__Hello__uuid', 'hello', 'gpt-4o', {
        onChunk: vi.fn(),
        onComplete: resolve,
        onError: () => resolve(),
      });
    });

  const failStreamRequest = (): Promise<Error> =>
    new Promise<Error>((resolve) => {
      const { streamCompletion } = makeApi();
      streamCompletion('gpt-4o__Hello__uuid', 'hello', 'gpt-4o', {
        onChunk: vi.fn(),
        onComplete: () => resolve(new Error('completed unexpectedly')),
        onError: resolve,
      });
    });

  /* A second browser tab submitting into a conversation that is already
   * generating gets a 409 from the completion endpoint ([#8688](https://github.com/epam/ai-dial-chat/issues/8688)). */
  it('reports a 409 completion response as a GenerationConflictError', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    const error = await failStreamRequest();

    expect(error).toBeInstanceOf(GenerationConflictError);
    expect(error.message).toBe(DEFAULT_GENERATION_CONFLICT_MESSAGE);
  });

  it('reports persistence failure after upstream DONE without completing successfully or exposing raw error text', async () => {
    const encoder = new TextEncoder();
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: [DONE]\n\ndata: {"error":{"type":"conversation_save_failed","message":"private upstream detail"}}\n\n',
              ),
            );
            controller.close();
          },
        }),
      ),
    );
    const error = await failStreamRequest();
    expect(error).toBeInstanceOf(GenerationPersistenceError);
    expect(error.message).not.toContain('private upstream detail');
  });

  it('reports any other non-OK completion response as a plain transport error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }));

    const error = await failStreamRequest();

    expect(error).not.toBeInstanceOf(GenerationConflictError);
    expect(error.message).toBe('Stream request failed with status 502');
  });

  const streamOf = (body: string): ReadableStream<Uint8Array> =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    });

  it('reports an in-band DIAL Core error chunk as a StreamUpstreamError', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        streamOf('data: {"error":{"message":"Model overloaded"}}\n\n'),
        { status: 200 },
      ),
    );

    const error = await failStreamRequest();

    expect(error).toBeInstanceOf(StreamUpstreamError);
    expect(error.message).toBe('Model overloaded');
  });

  describe('non-network transport failures stay untagged', () => {
    const expectUntagged = (error: Error) => {
      expect(error).not.toBeInstanceOf(StreamUpstreamError);
      expect(error).not.toBeInstanceOf(GenerationConflictError);
      expect(error).not.toBeInstanceOf(StreamInterruptedError);
    };

    it('leaves a 502 response untagged', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 502 }));

      expectUntagged(await failStreamRequest());
    });

    it('leaves a missing response body untagged', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      const error = await failStreamRequest();

      expectUntagged(error);
      expect(error.message).toBe('No response body');
    });
  });

  describe('network failures are reported as interruptions', () => {
    it('reports a rejected fetch as a StreamInterruptedError carrying the cause', async () => {
      const cause = new TypeError('Failed to fetch');
      fetchMock.mockRejectedValue(cause);

      const error = await failStreamRequest();

      expect(error).toBeInstanceOf(StreamInterruptedError);
      expect(error.cause).toBe(cause);
    });

    it('reports a stream that breaks mid-read as a StreamInterruptedError carrying the cause', async () => {
      const cause = new TypeError('network error');
      fetchMock.mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.error(cause);
            },
          }),
          { status: 200 },
        ),
      );

      const error = await failStreamRequest();

      expect(error).toBeInstanceOf(StreamInterruptedError);
      expect(error.cause).toBe(cause);
    });

    it('reports nothing when the caller aborts the stream', async () => {
      const abort = new AbortController();
      const onError = vi.fn();
      const onComplete = vi.fn();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );

      makeApi().streamCompletion('gpt-4o__Hello__uuid', 'hello', 'gpt-4o', {
        onChunk: vi.fn(),
        onComplete,
        onError,
        signal: abort.signal,
      });
      abort.abort();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('idle watchdog', () => {
    const IDLE_TIMEOUT_MS = 45_000;
    const encoder = new TextEncoder();

    /** A 2xx stream the test feeds by hand; it never ends on its own. */
    const openControlledStream = () => {
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      fetchMock.mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          }),
          { status: 200 },
        ),
      );
      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();
      makeApi().streamCompletion('gpt-4o__Hello__uuid', 'hello', 'gpt-4o', {
        onChunk,
        onComplete,
        onError,
      });
      return {
        onChunk,
        onComplete,
        onError,
        push: (text: string) => streamController.enqueue(encoder.encode(text)),
        end: () => streamController.close(),
      };
    };

    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    });

    it('reports a StreamInterruptedError once no byte has arrived for the idle timeout', async () => {
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);
      stream.push('data: {"choices":[]}\n\n');
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1);
      expect(stream.onError).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS);

      expect(stream.onError).toHaveBeenCalledOnce();
      expect(stream.onError.mock.calls[0][0]).toBeInstanceOf(
        StreamInterruptedError,
      );
      expect(stream.onComplete).not.toHaveBeenCalled();
    });

    it('stays open while keepalive comments keep arriving', async () => {
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);
      for (let tick = 0; tick < 12; tick += 1) {
        stream.push(': keepalive\n\n');
        await vi.advanceTimersByTimeAsync(15_000);
      }

      expect(stream.onError).not.toHaveBeenCalled();
      expect(stream.onChunk).not.toHaveBeenCalled();
    });

    it('detects a stall immediately when the page becomes visible past the deadline', async () => {
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);
      /* Timers do not run while the device sleeps; only the wall clock moves. */
      vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS * 4);

      setVisibility('visible');

      expect(stream.onError).toHaveBeenCalledOnce();
      expect(stream.onError.mock.calls[0][0]).toBeInstanceOf(
        StreamInterruptedError,
      );
    });

    it('detects a stall immediately when the network comes back past the deadline', async () => {
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);
      vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS * 2);

      window.dispatchEvent(new Event('online'));

      expect(stream.onError).toHaveBeenCalledOnce();
    });

    it('keeps a healthy stream open when the page becomes visible before the deadline', async () => {
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);
      stream.push('data: {"choices":[]}\n\n');
      await vi.advanceTimersByTimeAsync(10_000);

      setVisibility('visible');
      window.dispatchEvent(new Event('online'));

      expect(stream.onError).not.toHaveBeenCalled();
    });

    it('delivers nothing read after the watchdog fired', async () => {
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS);
      expect(stream.onError).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(0);

      expect(stream.onChunk).not.toHaveBeenCalled();
      expect(stream.onComplete).not.toHaveBeenCalled();
    });

    it('releases its listeners and timer once the stream completes', async () => {
      const removeDocumentListener = vi.spyOn(document, 'removeEventListener');
      const removeWindowListener = vi.spyOn(window, 'removeEventListener');
      const stream = openControlledStream();
      await vi.advanceTimersByTimeAsync(0);

      stream.end();
      await vi.advanceTimersByTimeAsync(0);

      expect(stream.onComplete).toHaveBeenCalledOnce();
      expect(removeDocumentListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
      expect(removeWindowListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function),
      );
      expect(removeWindowListener).toHaveBeenCalledWith(
        'pageshow',
        expect.any(Function),
      );
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS * 2);
      expect(stream.onError).not.toHaveBeenCalled();
    });

    it('honours a host-supplied idle timeout', async () => {
      fetchMock.mockResolvedValue(
        new Response(new ReadableStream<Uint8Array>(), { status: 200 }),
      );
      const onError = vi.fn();
      createChatStreamApi({
        getCsrfToken,
        setCsrfToken,
        completionsBasePath: '/api/v1/conversations',
        fetchImpl: fetchMock,
        idleTimeoutMs: 5_000,
      }).streamCompletion('gpt-4o__Hello__uuid', 'hello', 'gpt-4o', {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError,
      });
      await vi.advanceTimersByTimeAsync(5_000);

      expect(onError).toHaveBeenCalledOnce();
    });
  });

  it('sends the current browser timezone with each completion request', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const timezones = ['Europe/Warsaw', 'Asia/Tokyo'];
    let call = 0;
    getTimezone = () => timezones[call++];

    await completeStreamRequest();
    await completeStreamRequest();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/conversations/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Timezone': 'Europe/Warsaw',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/conversations/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Timezone': 'Asia/Tokyo' }),
      }),
    );
  });

  it('omits the timezone header when browser detection has no value', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    await completeStreamRequest();

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has('X-Timezone')).toBe(false);
  });

  it('preserves CSRF and request body behavior when adding the timezone', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    setCsrfToken('csrf-token');
    getTimezone = () => 'America/New_York';

    await completeStreamRequest();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/conversations/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-CSRF-Token': 'csrf-token',
          'X-Timezone': 'America/New_York',
        }),
        body: expect.stringContaining('"model":"gpt-4o"'),
      }),
    );
  });

  it('includes clientChannelId in the completion body when provided', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const { streamCompletion } = makeApi();

    await new Promise<void>((resolve) => {
      streamCompletion(
        'gpt-4o__Hello__uuid',
        'hello',
        'gpt-4o',
        { onChunk: vi.fn(), onComplete: resolve, onError: () => resolve() },
        undefined,
        'gen-id',
        undefined,
        undefined,
        'channel-123',
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/conversations/completions',
      expect.objectContaining({
        body: expect.stringContaining('"clientChannelId":"channel-123"'),
      }),
    );
  });

  it('omits clientChannelId from the completion body when not provided', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const { streamCompletion } = makeApi();

    await new Promise<void>((resolve) => {
      streamCompletion(
        'gpt-4o__Hello__uuid',
        'hello',
        'gpt-4o',
        { onChunk: vi.fn(), onComplete: resolve, onError: () => resolve() },
        undefined,
        'gen-id',
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/conversations/completions',
      expect.objectContaining({
        body: expect.not.stringContaining('clientChannelId'),
      }),
    );
  });
});
