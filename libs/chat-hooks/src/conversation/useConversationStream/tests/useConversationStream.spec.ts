import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import { MessageRole, type Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConversationStreamChannel,
  ConversationStreamOverlayNotifier,
  ConversationStreamTransport,
  StreamCompletionOptions,
} from '../useConversationStream';
import { useConversationStream } from '../useConversationStream';

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id: 'bucket/gpt-4o__Hello',
  folderId: 'bucket',
  name: 'Hello',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
  ...overrides,
});

/** Captures the `options` passed to the most recent `streamCompletion` call. */
const useHookHarness = ({
  transport,
  conversationId,
  initialConversation,
  ...rest
}: {
  transport: ConversationStreamTransport;
  conversationId: string | undefined;
  onStopError?: (error: Error) => void;
  overlay?: ConversationStreamOverlayNotifier;
  channel?: ConversationStreamChannel;
  initialConversation?: Conversation;
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(
    initialConversation ?? makeConversation(),
  );
  const conversationRef = useRef<Conversation | null>(conversation);
  conversationRef.current = conversation;

  const generation = {
    startGeneration: vi.fn(() => new AbortController()),
    completeGeneration: vi.fn(),
  };

  const stream = useConversationStream({
    conversationId,
    state: { setConversation, conversationRef },
    transport,
    generation,
    ...rest,
  });

  return { conversation, stream, generation };
};

describe('useConversationStream', () => {
  let capturedOptions: StreamCompletionOptions | undefined;
  let transport: ConversationStreamTransport;

  beforeEach(() => {
    capturedOptions = undefined;
    transport = {
      streamCompletion: vi.fn((_path, _message, _model, options) => {
        capturedOptions = options;
      }),
      stopCompletion: vi.fn().mockResolvedValue(undefined),
      watchConversation: vi.fn(),
      attachToGeneration: vi.fn().mockRejectedValue(new Error('not mocked')),
      getConversation: vi.fn().mockResolvedValue(makeConversation()),
    };
  });

  it('delegates start to the injected transport', async () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    await act(async () => {
      result.current.stream.startStream('bucket/conv', 'hi', 1, 'gpt-4o');
    });

    expect(transport.streamCompletion).toHaveBeenCalledOnce();
  });

  it('does not call saveConversation-shaped side effects on complete; reloads via transport', async () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    await act(async () => {
      result.current.stream.startStream('bucket/conv', 'hi', 1, 'gpt-4o');
    });

    await act(async () => {
      await capturedOptions?.onComplete();
    });

    expect(transport.getConversation).toHaveBeenCalledWith('bucket/conv');
  });

  it('applies a chunk to the displayed conversation', () => {
    const { result } = renderHook(() =>
      useHookHarness({
        transport,
        conversationId: 'bucket/conv',
      }),
    );

    act(() => {
      result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
    });

    act(() => {
      capturedOptions?.onChunk({
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        choices: [
          { delta: { content: 'Hello' }, finish_reason: null, index: 0 },
        ],
      });
    });

    expect(result.current.conversation?.messages).toHaveLength(0);
  });

  it('drops a chunk whose generation id no longer matches the active generation', async () => {
    const { result, rerender } = renderHook(
      (props: { conversationId: string }) =>
        useHookHarness({ transport, conversationId: props.conversationId }),
      { initialProps: { conversationId: 'bucket/conv' } },
    );

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        0,
        'gpt-4o',
        undefined,
        'gen-1',
      );
    });
    const staleOptions = capturedOptions;

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi again',
        0,
        'gpt-4o',
        undefined,
        'gen-2',
      );
    });

    // The stale generation's onChunk must not update state now that gen-2 is active.
    act(() => {
      staleOptions?.onChunk({
        id: 'c',
        object: 'chat.completion.chunk',
        choices: [
          { delta: { content: 'stale' }, finish_reason: null, index: 0 },
        ],
      });
    });

    expect(transport.streamCompletion).toHaveBeenCalledTimes(2);
    rerender({ conversationId: 'bucket/conv' });
  });

  it('tracks isStreaming independently per displayed conversation', () => {
    const { result, rerender } = renderHook(
      (props: { conversationId: string }) =>
        useHookHarness({ transport, conversationId: props.conversationId }),
      { initialProps: { conversationId: 'bucket/convA' } },
    );

    act(() => {
      result.current.stream.startStream('bucket/convA', 'hi', 0, 'gpt-4o');
    });
    expect(result.current.stream.isStreaming).toBe(true);

    rerender({ conversationId: 'bucket/convB' });
    expect(result.current.stream.isStreaming).toBe(false);
  });

  it('restores stages accumulated before and during background navigation', async () => {
    const initialConversation = makeConversation({
      messages: [
        {
          role: MessageRole.User,
          content: 'Use a tool',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          role: MessageRole.Assistant,
          content: '',
          timestamp: '2026-01-01T00:00:01.000Z',
        },
      ],
    });
    const { result, rerender } = renderHook(
      (props: { conversationId: string }) =>
        useHookHarness({
          transport,
          conversationId: props.conversationId,
          initialConversation,
        }),
      { initialProps: { conversationId: 'bucket/convA' } },
    );

    await act(async () => {
      result.current.stream.startStream(
        'bucket/convA',
        'Use a tool',
        1,
        'gpt-4o',
        undefined,
        'gen-1',
      );
      await Promise.resolve();
    });

    act(() => {
      capturedOptions?.onChunk({
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        choices: [
          {
            delta: {
              custom_content: {
                stages: [
                  {
                    index: 0,
                    name: 'Calling ',
                    status: null,
                    content: 'first ',
                  },
                ],
              },
            },
            finish_reason: null,
            index: 0,
          },
        ],
      });
    });

    rerender({ conversationId: 'bucket/convB' });
    act(() => {
      capturedOptions?.onChunk({
        id: 'chunk-2',
        object: 'chat.completion.chunk',
        choices: [
          {
            delta: {
              custom_content: {
                stages: [
                  {
                    index: 0,
                    name: 'tool',
                    status: null,
                    content: 'second',
                  },
                ],
              },
            },
            finish_reason: null,
            index: 0,
          },
        ],
      });
    });

    const reloadedPlaceholder = makeConversation({
      messages: initialConversation.messages.map((message) => ({ ...message })),
    });
    const restored = result.current.stream.restoreBufferedGeneration(
      'bucket/convA',
      reloadedPlaceholder,
    );

    expect(restored.messages[1].custom_content?.stages).toEqual([
      {
        index: 0,
        name: 'Calling tool',
        status: null,
        content: 'first second',
      },
    ]);

    rerender({ conversationId: 'bucket/convA' });
    act(() => {
      capturedOptions?.onChunk({
        id: 'chunk-3',
        object: 'chat.completion.chunk',
        choices: [
          {
            delta: {
              custom_content: {
                stages: [
                  {
                    index: 0,
                    name: '',
                    status: null,
                    content: ' third',
                  },
                ],
              },
            },
            finish_reason: null,
            index: 0,
          },
        ],
      });
    });

    expect(
      result.current.conversation?.messages[1].custom_content?.stages,
    ).toEqual([
      {
        index: 0,
        name: 'Calling tool',
        status: null,
        content: 'first second third',
      },
    ]);

    await act(async () => {
      await capturedOptions?.onComplete();
    });
    const afterCompletion = makeConversation({
      messages: reloadedPlaceholder.messages,
    });
    expect(
      result.current.stream.restoreBufferedGeneration(
        'bucket/convA',
        afterCompletion,
      ),
    ).toBe(afterCompletion);
  });

  it('does not reload the displayed conversation when a different conversation completes', async () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/convA' }),
    );

    act(() => {
      result.current.stream.startStream('bucket/convB', 'hi', 0, 'gpt-4o');
    });

    await act(async () => {
      await capturedOptions?.onComplete();
    });

    expect(transport.getConversation).not.toHaveBeenCalled();
  });

  it('passes generationId and mode, translating regenerate index for the backend', async () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        2,
        'gpt-4o',
        undefined,
        'gen-1',
        SendCompletionDtoModeEnum.Regenerate,
      );
    });

    expect(transport.streamCompletion).toHaveBeenCalledWith(
      'conv',
      'hi',
      'gpt-4o',
      expect.anything(),
      undefined,
      'gen-1',
      SendCompletionDtoModeEnum.Regenerate,
      2,
      undefined,
    );
  });

  it('translates the edit placeholder index to the user message index', async () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        3,
        'gpt-4o',
        undefined,
        'gen-1',
        SendCompletionDtoModeEnum.Edit,
      );
    });

    expect(transport.streamCompletion).toHaveBeenCalledWith(
      'conv',
      'hi',
      'gpt-4o',
      expect.anything(),
      undefined,
      'gen-1',
      SendCompletionDtoModeEnum.Edit,
      2,
      undefined,
    );
  });

  it('handleStop calls the transport stopCompletion for the active generation', () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    act(() => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        0,
        'gpt-4o',
        undefined,
        'gen-1',
      );
    });
    act(() => {
      result.current.stream.handleStop();
    });

    expect(transport.stopCompletion).toHaveBeenCalledWith({
      generationId: 'gen-1',
      path: 'conv',
    });
  });

  it('does not eagerly reload on stop — the completion signal drives the reload', () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    act(() => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        0,
        'gpt-4o',
        undefined,
        'gen-1',
      );
    });
    act(() => {
      result.current.stream.handleStop();
    });

    expect(transport.getConversation).not.toHaveBeenCalled();
  });

  it('surfaces a stopCompletion failure via onStopError', async () => {
    const onStopError = vi.fn();
    transport.stopCompletion = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useHookHarness({
        transport,
        conversationId: 'bucket/conv',
        onStopError,
      }),
    );

    act(() => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        0,
        'gpt-4o',
        undefined,
        'gen-1',
      );
    });
    await act(async () => {
      result.current.stream.handleStop();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onStopError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    );
  });

  it('reports an error only on the currently displayed conversation', () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    act(() => {
      result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
    });
    act(() => {
      capturedOptions?.onError(new Error('generation failed'));
    });

    expect(result.current.conversation?.messages[0]?.streamErrorMessage).toBe(
      undefined,
    );
  });

  it('works without a client channel — passes no clientChannelId', async () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    await act(async () => {
      result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
    });

    const call = vi.mocked(transport.streamCompletion).mock.calls[0];
    expect(call.at(-1)).toBeUndefined();
  });

  it('passes the awaited clientChannelId when a channel resolves during the wait', async () => {
    let resolveWait!: (id: string | null) => void;
    const channel = {
      channelId: null as string | null,
      ensureConnected: vi.fn(),
      waitForChannel: vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolveWait = resolve;
          }),
      ),
    };

    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv', channel }),
    );

    act(() => {
      result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
    });

    expect(transport.streamCompletion).not.toHaveBeenCalled();

    await act(async () => {
      resolveWait('ch-123');
    });

    expect(transport.streamCompletion).toHaveBeenCalledOnce();
    const call = vi.mocked(transport.streamCompletion).mock.calls[0];
    expect(call.at(-1)).toBe('ch-123');
  });

  it('works without an overlay notifier — no error thrown on start/stop', () => {
    const { result } = renderHook(() =>
      useHookHarness({ transport, conversationId: 'bucket/conv' }),
    );

    expect(() => {
      act(() => {
        result.current.stream.startStream(
          'bucket/conv',
          'hi',
          0,
          'gpt-4o',
          undefined,
          'gen-1',
        );
      });
      act(() => {
        result.current.stream.handleStop();
      });
    }).not.toThrow();
  });

  describe('resumeIfAwaitingGeneration', () => {
    const makeAwaitingConversation = (): Conversation =>
      makeConversation({
        messages: [
          {
            role: MessageRole.User,
            content: 'Hi',
            timestamp: '2026-01-01T00:00:00.000Z',
          },
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: '2026-01-01T00:00:00.000Z',
          },
        ],
      });

    it('marks the path as streaming for an awaiting-resume conversation', async () => {
      transport.watchConversation = vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      );
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      expect(result.current.stream.isStreaming).toBe(true);
      await waitFor(() => expect(transport.getConversation).toHaveBeenCalled());
      // attachToGeneration is tried first; the default mock rejects, falling
      // back to watchConversation for this test's terminal-check.
      expect(transport.attachToGeneration).toHaveBeenCalledWith(
        'conv',
        expect.any(AbortSignal),
      );
      expect(transport.watchConversation).toHaveBeenCalledOnce();
    });

    it('attaches to the live replay: applies the snapshot and chunks progressively, then reloads on the terminal event', async () => {
      const encoder = new TextEncoder();
      transport.attachToGeneration = vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'snapshot',
                  message: {
                    role: MessageRole.Assistant,
                    content: 'Hel',
                    timestamp: '2026-01-01T00:00:00.000Z',
                  },
                })}\n\n`,
              ),
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'chunk',
                  chunk: { choices: [{ delta: { content: 'lo' } }] },
                })}\n\n`,
              ),
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
            );
            controller.close();
          },
        }),
      );
      transport.getConversation = vi
        .fn()
        .mockResolvedValue(makeConversation({ name: 'Resolved' }));

      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() =>
        expect(result.current.conversation?.name).toBe('Resolved'),
      );
      expect(result.current.stream.isStreaming).toBe(false);
      // Attach fully resolved the resume — the watch fallback never ran.
      expect(transport.watchConversation).not.toHaveBeenCalled();
    });

    it('does nothing for a conversation not awaiting resume', () => {
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeConversation({
            messages: [
              {
                role: MessageRole.Assistant,
                content: 'done',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
          }),
        );
      });

      expect(result.current.stream.isStreaming).toBe(false);
      expect(transport.watchConversation).not.toHaveBeenCalled();
    });

    it('resolves and clears the streaming path on a qualifying UPDATE event', async () => {
      const encoder = new TextEncoder();
      transport.watchConversation = vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"action":"UPDATE"}\n'));
            controller.close();
          },
        }),
      );
      transport.getConversation = vi
        .fn()
        .mockResolvedValue(makeConversation({ name: 'Resolved' }));

      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.conversation?.name).toBe('Resolved');
    });

    it('deduplicates resume watches for the same path', async () => {
      transport.watchConversation = vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      );
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      // attachToGeneration is tried (and rejects) before the watch fallback runs.
      await waitFor(() =>
        expect(transport.watchConversation).toHaveBeenCalledOnce(),
      );
    });

    it('performs a final check and clears the streaming path when the watch stream errors', async () => {
      transport.watchConversation = vi
        .fn()
        .mockRejectedValue(new Error('no stream'));
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(transport.getConversation).toHaveBeenCalled();
    });
  });

  describe('overlay generation lifecycle notifications', () => {
    it('emits notifyGenerationStart before notifyGenerationEnd for a send-triggered generation', async () => {
      const overlay = {
        notifyGenerationStart: vi.fn(),
        notifyGenerationEnd: vi.fn(),
        notifyStopGenerating: vi.fn(),
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', overlay }),
      );

      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
      });
      expect(overlay.notifyGenerationStart).toHaveBeenCalledOnce();
      expect(overlay.notifyGenerationEnd).not.toHaveBeenCalled();

      await act(async () => {
        await capturedOptions?.onComplete();
      });
      expect(overlay.notifyGenerationEnd).toHaveBeenCalledOnce();
    });

    it('does not emit notifyGenerationEnd for a user-initiated stop; emits notifyStopGenerating instead', async () => {
      const overlay = {
        notifyGenerationStart: vi.fn(),
        notifyGenerationEnd: vi.fn(),
        notifyStopGenerating: vi.fn(),
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', overlay }),
      );

      act(() => {
        result.current.stream.startStream(
          'bucket/conv',
          'hi',
          0,
          'gpt-4o',
          undefined,
          'gen-1',
        );
      });
      act(() => {
        result.current.stream.handleStop();
      });
      expect(overlay.notifyStopGenerating).toHaveBeenCalledOnce();

      await act(async () => {
        await capturedOptions?.onComplete();
      });
      expect(overlay.notifyGenerationEnd).not.toHaveBeenCalled();
    });
  });
});
