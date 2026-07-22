import type { Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationProvider } from '../../../context/GenerationContext';
import {
  CompletionMode,
  type StreamCompletionOptions,
  stopCompletion,
  streamCompletion,
} from '../../../server-api/chat-stream.api';
import {
  getConversation,
  saveConversation,
  watchConversation,
} from '../../../server-api/conversations.api';
import { useConversationStream } from '../useConversationStream';

vi.mock('../../../context/ClientChannelContext', () => ({
  useClientChannel: vi.fn(() => ({
    channelId: null,
    pendingEvents: [],
    reportEvent: vi.fn(),
    ensureConnected: vi.fn(),
  })),
}));

vi.mock('../../../server-api/chat-stream.api', () => ({
  streamCompletion: vi.fn(),
  stopCompletion: vi.fn().mockResolvedValue(undefined),
  CompletionMode: {
    Append: 'append',
    ContinueLastUser: 'continue_last_user',
    Regenerate: 'regenerate',
    Edit: 'edit',
  },
}));
vi.mock('../../../server-api/conversations.api', () => ({
  saveConversation: vi.fn().mockResolvedValue(undefined),
  getConversation: vi.fn().mockResolvedValue({ id: 'reloaded', messages: [] }),
  watchConversation: vi.fn(),
}));

const mockStreamCompletion = vi.mocked(streamCompletion);
const mockSaveConversation = vi.mocked(saveConversation);
const mockGetConversation = vi.mocked(getConversation);
const mockStopCompletion = vi.mocked(stopCompletion);
const mockWatchConversation = vi.mocked(watchConversation);

const sseEncoder = new TextEncoder();

/** Builds a fake SSE `ReadableStream` that yields the given `data:` lines, then ends. */
const makeSseStream = (dataLines: string[]): ReadableStream<Uint8Array> => {
  let index = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (index < dataLines.length) {
          const value = sseEncoder.encode(dataLines[index]);
          index += 1;
          return { done: false, value };
        }
        return { done: true, value: undefined };
      },
      releaseLock: () => {
        /* no-op */
      },
    }),
  } as unknown as ReadableStream<Uint8Array>;
};

/** Builds a fake SSE stream whose reader never resolves unless `signal` aborts. */
const makeHangingSseStream = (
  signal: AbortSignal,
): ReadableStream<Uint8Array> => {
  return {
    getReader: () => ({
      read: () =>
        new Promise<{ done: boolean; value?: Uint8Array }>(
          (_resolve, reject) => {
            const onAbort = () =>
              reject(new DOMException('Aborted', 'AbortError'));
            if (signal.aborted) {
              onAbort();
              return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
          },
        ),
      releaseLock: () => {
        /* no-op */
      },
    }),
  } as unknown as ReadableStream<Uint8Array>;
};

const makeAwaitingConversation = (): Conversation =>
  ({
    id: 'bucket/gpt-4o__Hello__uuid',
    messages: [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: '', timestamp: new Date().toISOString() },
    ],
  }) as unknown as Conversation;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(GenerationProvider, null, children);

const makeParams = (
  overrides?: Partial<Parameters<typeof useConversationStream>[0]>,
) => ({
  conversationId: 'bucket/gpt-4o__Hello__uuid',
  setConversation: vi.fn(),
  conversationRef: { current: null as Conversation | null },
  ...overrides,
});

describe('useConversationStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamCompletion.mockImplementation(
      (_path, _message, _model, options) => {
        void options.onComplete();
      },
    );
    mockGetConversation.mockResolvedValue({
      id: 'reloaded',
      messages: [],
    } as unknown as Conversation);
  });

  it('does NOT call saveConversation on stream complete', async () => {
    const { result } = renderHook(() => useConversationStream(makeParams()), {
      wrapper,
    });

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
      );
    });

    await waitFor(() => {
      expect(mockSaveConversation).not.toHaveBeenCalled();
    });
  });

  it('calls getConversation to reload from server on stream complete', async () => {
    const { result } = renderHook(() => useConversationStream(makeParams()), {
      wrapper,
    });

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
      );
    });

    await waitFor(() => {
      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket/gpt-4o__Hello__uuid',
      );
    });
  });

  it('updates conversation state with server-reloaded data on complete', async () => {
    const serverConversation = {
      id: 'server-side',
      messages: [{ role: 'assistant', content: 'Hi from server' }],
    } as unknown as Conversation;
    mockGetConversation.mockResolvedValue(serverConversation);

    const setConversation = vi.fn();
    const conversationRef = { current: null as Conversation | null };
    const { result } = renderHook(
      () =>
        useConversationStream(makeParams({ setConversation, conversationRef })),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
      );
    });

    await waitFor(() => {
      expect(setConversation).toHaveBeenCalledWith(serverConversation);
      expect(conversationRef.current).toBe(serverConversation);
    });
  });

  it('chunk with mismatched generationId does not update conversation state', async () => {
    // First call: capture onChunk, hold stream open (no onComplete)
    let capturedOnChunk: StreamCompletionOptions['onChunk'] | null = null;
    mockStreamCompletion
      .mockImplementationOnce((_path, _message, _model, options) => {
        capturedOnChunk = options.onChunk;
        // first stream stays open
      })
      .mockImplementationOnce((_path, _message, _model, _options) => {
        // second stream also stays open — don't call onComplete
      });

    const setConversation = vi.fn();
    const { result } = renderHook(
      () => useConversationStream(makeParams({ setConversation })),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'active-gen-id',
      );
    });

    // Second stream replaces activeGenerationIdRef — first stream's chunks are now stale
    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'new-gen-id',
      );
    });

    // Fire the captured chunk from the first stream (now stale)
    act(() => {
      capturedOnChunk?.({
        id: 'stale-chunk-id',
        object: 'chat.completion.chunk',
        choices: [
          {
            delta: { content: 'stale chunk' },
            finish_reason: null,
            index: 0,
          },
        ],
      });
    });

    // setConversation must NOT have been called for the stale chunk
    expect(setConversation).not.toHaveBeenCalled();
  });

  it('passes generationId and mode to streamCompletion, forwarding the regenerate index', async () => {
    const { result } = renderHook(() => useConversationStream(makeParams()), {
      wrapper,
    });

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        3,
        'gpt-4o',
        undefined,
        'my-gen-id',
        CompletionMode.Regenerate as never,
      );
    });

    expect(mockStreamCompletion).toHaveBeenCalledWith(
      'gpt-4o__Hello__uuid',
      'hello',
      'gpt-4o',
      expect.any(Object),
      undefined,
      'my-gen-id',
      'regenerate',
      // Regenerate truncates at the assistant index (same as the local index).
      3,
      undefined,
    );
  });

  it('translates the edit placeholder index to the user message index for the backend', async () => {
    const { result } = renderHook(() => useConversationStream(makeParams()), {
      wrapper,
    });

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'edited',
        3,
        'gpt-4o',
        undefined,
        'edit-gen-id',
        CompletionMode.Edit as never,
      );
    });

    expect(mockStreamCompletion).toHaveBeenCalledWith(
      'gpt-4o__Hello__uuid',
      'edited',
      'gpt-4o',
      expect.any(Object),
      undefined,
      'edit-gen-id',
      'edit',
      // Edit truncates at the user message — one before the placeholder index.
      2,
      undefined,
    );
  });

  it('does not apply chunks to a conversation that is no longer displayed', async () => {
    // Capture the chunk callback; keep the stream open.
    let capturedOnChunk: StreamCompletionOptions['onChunk'] | null = null;
    mockStreamCompletion.mockImplementation((_path, _message, _model, opts) => {
      capturedOnChunk = opts.onChunk;
    });

    const setConversation = vi.fn();
    // The hook is displaying conversation B...
    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({
            conversationId: 'bucket/gpt-4o__Other__displayed',
            setConversation,
          }),
        ),
      { wrapper },
    );

    // ...but a stream for conversation A is in flight.
    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__streaming',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'gen-a',
      );
    });

    act(() => {
      capturedOnChunk?.({
        id: 'chunk-id',
        object: 'chat.completion.chunk',
        choices: [
          { delta: { content: 'text for A' }, finish_reason: null, index: 0 },
        ],
      });
    });

    // A's chunk must not write into the displayed conversation B.
    expect(setConversation).not.toHaveBeenCalled();
  });

  it('does not reload the displayed conversation when a different conversation completes', async () => {
    // Default mock fires onComplete synchronously.
    const setConversation = vi.fn();
    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({
            conversationId: 'bucket/gpt-4o__Other__displayed',
            setConversation,
          }),
        ),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__streaming',
        'hello',
        0,
        'gpt-4o',
      );
    });

    /*
     * Completing a stream for a non-displayed conversation must not reload or
     * overwrite the currently-shown conversation.
     */
    expect(mockGetConversation).not.toHaveBeenCalled();
    expect(setConversation).not.toHaveBeenCalled();
  });

  it('reports isStreaming only for the currently displayed conversation', async () => {
    mockStreamCompletion.mockImplementation(() => {
      // keep stream open
    });

    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({ conversationId: 'bucket/gpt-4o__Displayed__id' }),
        ),
      { wrapper },
    );

    // Stream started for a different conversation than the one displayed.
    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Background__id',
        'hello',
        0,
        'gpt-4o',
      );
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.canStopStreaming).toBe(false);
  });

  it('handleStop calls the stopCompletion API for the active generation', async () => {
    mockStreamCompletion.mockImplementation(() => {
      // keep stream open (don't call onComplete)
    });

    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({ conversationId: 'bucket/gpt-4o__Hello__uuid' }),
        ),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'stop-gen-id',
      );
    });

    expect(result.current.canStopStreaming).toBe(true);

    await act(async () => {
      result.current.handleStop();
    });

    await waitFor(() => {
      expect(mockStopCompletion).toHaveBeenCalledWith({
        generationId: 'stop-gen-id',
        path: 'gpt-4o__Hello__uuid',
      });
    });
  });

  it('does not eagerly reload on stop — the stream end reloads the saved partial', async () => {
    /*
     * Capture onComplete so we can simulate the backend closing the stream
     * after it has aborted and saved the partial answer.
     */
    let capturedOnComplete: StreamCompletionOptions['onComplete'] | null = null;
    mockStreamCompletion.mockImplementation((_p, _m, _model, opts) => {
      capturedOnComplete = opts.onComplete;
    });

    const setConversation = vi.fn();
    const serverAfterStop = {
      id: 'after-stop',
      messages: [
        { role: 'assistant', content: 'Partial', wasStoppedByUser: true },
      ],
    } as unknown as Conversation;
    mockGetConversation.mockResolvedValue(serverAfterStop);

    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({
            conversationId: 'bucket/gpt-4o__Hello__uuid',
            setConversation,
          }),
        ),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'stop-gen-id',
      );
    });

    await act(async () => {
      result.current.handleStop();
    });

    // Stop must not reload by itself (that would race the backend's save).
    expect(mockGetConversation).not.toHaveBeenCalled();

    // When the backend closes the stream, onComplete reloads the saved partial.
    await act(async () => {
      await capturedOnComplete?.();
    });

    await waitFor(() => {
      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket/gpt-4o__Hello__uuid',
      );
      expect(setConversation).toHaveBeenCalledWith(serverAfterStop);
    });
  });

  it('GenerationContext startGeneration returns AbortController that stays alive during navigation', async () => {
    mockStreamCompletion.mockImplementation(() => {
      // keep stream open
    });

    const { result } = renderHook(() => useConversationStream(makeParams()), {
      wrapper,
    });

    let abortFired = false;

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'nav-gen-id',
      );
    });

    // Spy on the AbortController passed to streamCompletion
    const callArgs = mockStreamCompletion.mock.calls[0];
    const { signal } = callArgs[3] as { signal: AbortSignal };
    signal.addEventListener('abort', () => {
      abortFired = true;
    });

    // The hook is mounted (not navigated away) — signal must NOT be aborted yet
    expect(signal.aborted).toBe(false);
    expect(abortFired).toBe(false);
  });

  it('decodes an already-percent-encoded conversation id segment so it is not double-encoded downstream', async () => {
    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({
            conversationId:
              'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
          }),
        ),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
        'hello',
        0,
        'applications/catalog/Team%2FApp%20One__0.0.1',
      );
    });

    expect(mockStreamCompletion).toHaveBeenCalledWith(
      'applications/catalog/Team/App One__0.0.1__title',
      'hello',
      'applications/catalog/Team%2FApp%20One__0.0.1',
      expect.any(Object),
      undefined,
      expect.any(String),
      'append',
      undefined,
      undefined,
    );

    await waitFor(() => {
      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket/applications/catalog/Team/App One__0.0.1__title',
      );
    });
  });

  it('handleStop surfaces stopCompletion failures', async () => {
    mockStreamCompletion.mockImplementation(() => {
      // keep stream open
    });
    const onStopError = vi.fn();
    const stopError = new Error('stop failed');
    mockStopCompletion.mockRejectedValueOnce(stopError);

    const { result } = renderHook(
      () =>
        useConversationStream(
          makeParams({
            conversationId: 'bucket/gpt-4o__Hello__uuid',
            onStopError,
          }),
        ),
      { wrapper },
    );

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
        'gpt-4o',
        undefined,
        'stop-gen-id',
      );
    });

    await act(async () => {
      result.current.handleStop();
    });

    await waitFor(() => {
      expect(onStopError).toHaveBeenCalledWith(stopError);
      expect(result.current.hasStreamError).toBe(true);
    });
  });

  describe('resumeIfAwaitingGeneration', () => {
    it('adds the conversation path to streamingPaths for an awaiting-resume conversation', () => {
      mockWatchConversation.mockReturnValue(new Promise(() => undefined));

      const { result } = renderHook(
        () =>
          useConversationStream(
            makeParams({ conversationId: 'bucket/gpt-4o__Hello__uuid' }),
          ),
        { wrapper },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
      });

      expect(result.current.isStreaming).toBe(true);
      expect(result.current.canStopStreaming).toBe(false);
    });

    it('does not call stopCompletion for a resumed generation without a local generation id', async () => {
      mockWatchConversation.mockReturnValue(new Promise(() => undefined));

      const { result } = renderHook(
        () =>
          useConversationStream(
            makeParams({ conversationId: 'bucket/gpt-4o__Hello__uuid' }),
          ),
        { wrapper },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
      });

      await act(async () => {
        result.current.handleStop();
      });

      expect(result.current.isStreaming).toBe(true);
      expect(result.current.canStopStreaming).toBe(false);
      expect(mockStopCompletion).not.toHaveBeenCalled();
    });

    it('does nothing for a conversation that is not awaiting resume', () => {
      const finishedConversation = {
        id: 'bucket/gpt-4o__Hello__uuid',
        messages: [{ role: 'assistant', content: 'Already answered' }],
      } as unknown as Conversation;

      const { result } = renderHook(
        () =>
          useConversationStream(
            makeParams({ conversationId: 'bucket/gpt-4o__Hello__uuid' }),
          ),
        { wrapper },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          finishedConversation,
        );
      });

      expect(result.current.isStreaming).toBe(false);
      expect(mockWatchConversation).not.toHaveBeenCalled();
    });

    it('resolves and clears streamingPaths on a qualifying UPDATE event', async () => {
      const resolvedConversation = {
        id: 'resolved',
        messages: [{ role: 'assistant', content: 'Final answer' }],
      } as unknown as Conversation;
      mockWatchConversation.mockResolvedValue(
        makeSseStream(['data: {"action":"UPDATE"}\n\n']),
      );
      mockGetConversation.mockResolvedValueOnce(resolvedConversation);

      const setConversation = vi.fn();
      const { result } = renderHook(
        () =>
          useConversationStream(
            makeParams({
              conversationId: 'bucket/gpt-4o__Hello__uuid',
              setConversation,
            }),
          ),
        { wrapper },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() => {
        expect(setConversation).toHaveBeenCalledWith(resolvedConversation);
        expect(result.current.isStreaming).toBe(false);
      });
    });

    it('deduplicates only active resume watches for the same path', async () => {
      const firstResolvedConversation = {
        id: 'first-resolved',
        messages: [{ role: 'assistant', content: 'First final answer' }],
      } as unknown as Conversation;
      const secondResolvedConversation = {
        id: 'second-resolved',
        messages: [{ role: 'assistant', content: 'Second final answer' }],
      } as unknown as Conversation;

      mockWatchConversation
        .mockResolvedValueOnce(makeSseStream(['data: {"action":"UPDATE"}\n\n']))
        .mockResolvedValueOnce(
          makeSseStream(['data: {"action":"UPDATE"}\n\n']),
        );
      mockGetConversation
        .mockResolvedValueOnce(firstResolvedConversation)
        .mockResolvedValueOnce(secondResolvedConversation);

      const setConversation = vi.fn();
      const { result } = renderHook(
        () =>
          useConversationStream(
            makeParams({
              conversationId: 'bucket/gpt-4o__Hello__uuid',
              setConversation,
            }),
          ),
        { wrapper },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() => {
        expect(setConversation).toHaveBeenCalledWith(firstResolvedConversation);
        expect(result.current.isStreaming).toBe(false);
      });
      expect(mockWatchConversation).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() => {
        expect(setConversation).toHaveBeenCalledWith(
          secondResolvedConversation,
        );
        expect(result.current.isStreaming).toBe(false);
      });
      expect(mockWatchConversation).toHaveBeenCalledTimes(2);
    });

    it('keeps watching past a non-qualifying UPDATE event', async () => {
      const stillAwaiting = makeAwaitingConversation();
      const resolvedConversation = {
        id: 'resolved',
        messages: [{ role: 'assistant', content: 'Final answer' }],
      } as unknown as Conversation;
      mockWatchConversation.mockResolvedValue(
        makeSseStream([
          'data: {"action":"UPDATE"}\n\n',
          'data: {"action":"UPDATE"}\n\n',
        ]),
      );
      mockGetConversation
        .mockResolvedValueOnce(stillAwaiting)
        .mockResolvedValueOnce(resolvedConversation);

      const setConversation = vi.fn();
      const { result } = renderHook(
        () =>
          useConversationStream(
            makeParams({
              conversationId: 'bucket/gpt-4o__Hello__uuid',
              setConversation,
            }),
          ),
        { wrapper },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Hello__uuid',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() => {
        expect(mockGetConversation).toHaveBeenCalledTimes(2);
        expect(setConversation).toHaveBeenCalledWith(resolvedConversation);
        expect(result.current.isStreaming).toBe(false);
      });
    });

    it('times out, performs a final fetch, and clears streamingPaths regardless of outcome', async () => {
      vi.useFakeTimers();
      try {
        mockWatchConversation.mockImplementation(async (_path, signal) =>
          makeHangingSseStream(signal as AbortSignal),
        );
        mockGetConversation.mockResolvedValueOnce(makeAwaitingConversation());

        const setConversation = vi.fn();
        const { result } = renderHook(
          () =>
            useConversationStream(
              makeParams({
                conversationId: 'bucket/gpt-4o__Hello__uuid',
                setConversation,
              }),
            ),
          { wrapper },
        );

        act(() => {
          result.current.resumeIfAwaitingGeneration(
            'bucket/gpt-4o__Hello__uuid',
            makeAwaitingConversation(),
          );
        });

        expect(result.current.isStreaming).toBe(true);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        });

        expect(mockGetConversation).toHaveBeenCalledWith(
          'bucket/gpt-4o__Hello__uuid',
        );
        expect(result.current.isStreaming).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('resolving in the background clears streamingPaths without touching the displayed conversation', async () => {
      const resolvedConversation = {
        id: 'resolved',
        messages: [{ role: 'assistant', content: 'Final answer' }],
      } as unknown as Conversation;
      mockWatchConversation.mockResolvedValue(
        makeSseStream(['data: {"action":"UPDATE"}\n\n']),
      );
      mockGetConversation.mockResolvedValueOnce(resolvedConversation);

      const setConversation = vi.fn();
      const { result, rerender } = renderHook(
        (props: { conversationId: string }) =>
          useConversationStream(
            makeParams({
              conversationId: props.conversationId,
              setConversation,
            }),
          ),
        {
          wrapper,
          initialProps: { conversationId: 'bucket/gpt-4o__Displayed__id' },
        },
      );

      act(() => {
        result.current.resumeIfAwaitingGeneration(
          'bucket/gpt-4o__Background__id',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() => {
        expect(mockGetConversation).toHaveBeenCalledWith(
          'bucket/gpt-4o__Background__id',
        );
      });

      // The background resolution must not overwrite the displayed conversation.
      expect(setConversation).not.toHaveBeenCalled();

      /*
       * Switching to the now-resolved background conversation shows it is no
       * longer tracked as streaming.
       */
      rerender({ conversationId: 'bucket/gpt-4o__Background__id' });
      expect(result.current.isStreaming).toBe(false);
    });
  });
});
