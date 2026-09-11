import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChatStreamApi,
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  GenerationConflictError,
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
   * generating gets a 409 from the completion endpoint (issue #8688). */
  it('reports a 409 completion response as a GenerationConflictError', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    const error = await failStreamRequest();

    expect(error).toBeInstanceOf(GenerationConflictError);
    expect(error.message).toBe(DEFAULT_GENERATION_CONFLICT_MESSAGE);
  });

  it('reports any other non-OK completion response as a plain transport error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }));

    const error = await failStreamRequest();

    expect(error).not.toBeInstanceOf(GenerationConflictError);
    expect(error.message).toBe('Stream request failed with status 502');
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
