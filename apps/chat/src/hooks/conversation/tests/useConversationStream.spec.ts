import type { Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import React from 'react';
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
} from '../../../server-api/conversations.api';
import { useConversationStream } from '../useConversationStream';

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
}));

const mockStreamCompletion = vi.mocked(streamCompletion);
const mockSaveConversation = vi.mocked(saveConversation);
const mockGetConversation = vi.mocked(getConversation);
const mockStopCompletion = vi.mocked(stopCompletion);

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(GenerationProvider, null, children);

const makeParams = (
  overrides?: Partial<Parameters<typeof useConversationStream>[0]>,
) => ({
  conversationId: 'bucket/gpt-4o__Hello__uuid',
  stoppedGeneratingText: 'Stopped',
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
      expect(mockGetConversation).toHaveBeenCalledWith('gpt-4o__Hello__uuid');
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

  it('passes generationId and mode to streamCompletion', async () => {
    const { result } = renderHook(() => useConversationStream(makeParams()), {
      wrapper,
    });

    await act(async () => {
      result.current.startStream(
        'bucket/gpt-4o__Hello__uuid',
        'hello',
        0,
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

    // Completing a stream for a non-displayed conversation must not reload or
    // overwrite the currently-shown conversation.
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
  });

  it('handleStop calls stopCompletion API then reloads from server', async () => {
    mockStreamCompletion.mockImplementation(() => {
      // keep stream open (don't call onComplete)
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

    await waitFor(() => {
      expect(mockStopCompletion).toHaveBeenCalledWith({
        generationId: 'stop-gen-id',
        path: 'gpt-4o__Hello__uuid',
      });
      expect(mockGetConversation).toHaveBeenCalledWith('gpt-4o__Hello__uuid');
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

  it('streams with the correct path format for path-encoded conversation IDs', async () => {
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
      'applications/catalog/Team%2FApp%20One__0.0.1__title',
      'hello',
      'applications/catalog/Team%2FApp%20One__0.0.1',
      expect.any(Object),
      undefined,
      expect.any(String),
      'append',
      undefined,
    );

    await waitFor(() => {
      expect(mockGetConversation).toHaveBeenCalledWith(
        'applications/catalog/Team%2FApp%20One__0.0.1__title',
      );
    });
  });
});
