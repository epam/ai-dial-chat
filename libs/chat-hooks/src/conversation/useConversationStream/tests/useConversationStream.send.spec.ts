import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import { MessageRole, type Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConversationStreamTransport,
  StreamCompletionOptions,
} from '../useConversationStream';
import {
  createStreamTestTransport,
  makeConversation,
  useHookHarness,
} from './conversation-stream-harness';

describe('useConversationStream', () => {
  let capturedOptions: StreamCompletionOptions | undefined;
  let transport: ConversationStreamTransport;

  beforeEach(() => {
    capturedOptions = undefined;
    transport = createStreamTestTransport((options) => {
      capturedOptions = options;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it.each([false, true])(
    'keeps applying a background generation after another conversation starts one (batchChunksPerFrame: %s)',
    async (batchChunksPerFrame) => {
      vi.useFakeTimers();
      const placeholder = (id: string, prompt: string): Conversation =>
        makeConversation({
          id,
          messages: [
            {
              role: MessageRole.User,
              content: prompt,
              timestamp: '2026-01-01T00:00:00.000Z',
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: '2026-01-01T00:00:01.000Z',
            },
          ],
        });
      const textChunk = (content: string) => ({
        id: content,
        object: 'chat.completion.chunk' as const,
        choices: [{ delta: { content }, finish_reason: null, index: 0 }],
      });
      const { result, rerender } = renderHook(
        (props: { conversationId: string }) =>
          useHookHarness({
            transport,
            conversationId: props.conversationId,
            initialConversation: placeholder('bucket/convA', 'A?'),
            batchChunksPerFrame,
          }),
        { initialProps: { conversationId: 'bucket/convA' } },
      );

      await act(async () => {
        result.current.stream.startStream(
          'bucket/convA',
          'A?',
          1,
          'gpt-4o',
          undefined,
          'gen-A',
        );
      });
      const optionsA = capturedOptions;
      act(() => optionsA?.onChunk(textChunk('A1 ')));

      rerender({ conversationId: 'bucket/convB' });
      act(() =>
        result.current.setConversation(placeholder('bucket/convB', 'B?')),
      );
      await act(async () => {
        result.current.stream.startStream(
          'bucket/convB',
          'B?',
          1,
          'gpt-4o',
          undefined,
          'gen-B',
        );
      });
      const optionsB = capturedOptions;

      act(() => {
        optionsA?.onChunk(textChunk('A2 '));
        optionsB?.onChunk(textChunk('B1'));
      });
      act(() => vi.advanceTimersToNextFrame());

      expect(result.current.conversation?.messages[1].content).toBe('B1');
      expect(
        result.current.stream.restoreBufferedGeneration(
          'bucket/convA',
          placeholder('bucket/convA', 'A?'),
        ).messages[1].content,
      ).toBe('A1 A2 ');

      /* Back on A mid-generation: the host reloads A and restores its buffer. */
      rerender({ conversationId: 'bucket/convA' });
      act(() =>
        result.current.setConversation(
          result.current.stream.restoreBufferedGeneration(
            'bucket/convA',
            placeholder('bucket/convA', 'A?'),
          ),
        ),
      );
      act(() => {
        optionsA?.onChunk(textChunk('A3'));
        optionsB?.onChunk(textChunk(' B2'));
      });
      act(() => vi.advanceTimersToNextFrame());

      expect(result.current.conversation?.messages[1].content).toBe('A1 A2 A3');
      expect(
        result.current.stream.restoreBufferedGeneration(
          'bucket/convB',
          placeholder('bucket/convB', 'B?'),
        ).messages[1].content,
      ).toBe('B1 B2');
    },
  );

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

  it('restores parent references sent only on opening deltas from the background buffer', async () => {
    const initialConversation = makeConversation({
      messages: [
        {
          role: MessageRole.User,
          content: 'Plan it',
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
    const sendStages = (id: string, stages: unknown[]) =>
      act(() => {
        capturedOptions?.onChunk({
          id,
          object: 'chat.completion.chunk',
          choices: [
            {
              delta: { custom_content: { stages: stages as never } },
              finish_reason: null,
              index: 0,
            },
          ],
        });
      });

    await act(async () => {
      result.current.stream.startStream(
        'bucket/convA',
        'Plan it',
        1,
        'gpt-4o',
        undefined,
        'gen-1',
      );
      await Promise.resolve();
    });

    sendStages('chunk-1', [
      { index: 0, name: 'Plan', status: null },
      { index: 1, name: 'Search', status: null, parent_stage_index: 0 },
    ]);
    rerender({ conversationId: 'bucket/convB' });
    sendStages('chunk-2', [
      { index: 1, content: 'found' },
      { index: 1, status: 'completed' },
    ]);

    const restored = result.current.stream.restoreBufferedGeneration(
      'bucket/convA',
      makeConversation({
        messages: initialConversation.messages.map((message) => ({
          ...message,
        })),
      }),
    );

    expect(restored.messages[1].custom_content?.stages).toEqual([
      { index: 0, name: 'Plan', status: null },
      {
        index: 1,
        name: 'Search',
        status: 'completed',
        parent_stage_index: 0,
        content: 'found',
      },
    ]);
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

  it('ignores a superseded generation completing on the same path', async () => {
    const { result } = renderHook(() =>
      useHookHarness({
        transport,
        conversationId: 'bucket/conv',
        initialConversation: makeConversation({
          messages: [
            { role: MessageRole.User, content: 'edited', timestamp: 't' },
            { role: MessageRole.Assistant, content: '', timestamp: 't' },
          ],
        }),
      }),
    );

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        1,
        'gpt-4o',
        undefined,
        'gen-1',
      );
    });
    /* The stopped generation's own callbacks, captured before the re-submit
     * replaces the harness's capturedOptions. */
    const stoppedOptions = capturedOptions;

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'edited',
        1,
        'gpt-4o',
        undefined,
        'gen-2',
        SendCompletionDtoModeEnum.Edit,
      );
    });

    await act(async () => {
      await stoppedOptions?.onComplete();
    });

    expect(result.current.stream.isStreaming).toBe(true);
    expect(transport.getConversation).not.toHaveBeenCalled();
    expect(result.current.conversation?.messages[0]?.content).toBe('edited');
  });

  it('does not write a superseded generation error onto the new answer', async () => {
    const { result } = renderHook(() =>
      useHookHarness({
        transport,
        conversationId: 'bucket/conv',
        initialConversation: makeConversation({
          messages: [
            { role: MessageRole.User, content: 'edited', timestamp: 't' },
            { role: MessageRole.Assistant, content: '', timestamp: 't' },
          ],
        }),
      }),
    );

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'hi',
        1,
        'gpt-4o',
        undefined,
        'gen-1',
      );
    });
    const stoppedOptions = capturedOptions;

    await act(async () => {
      result.current.stream.startStream(
        'bucket/conv',
        'edited',
        1,
        'gpt-4o',
        undefined,
        'gen-2',
        SendCompletionDtoModeEnum.Edit,
      );
    });

    act(() => {
      stoppedOptions?.onError(new Error('generation failed'));
    });

    expect(result.current.stream.isStreaming).toBe(true);
    expect(result.current.conversation?.messages[1]?.streamErrorMessage).toBe(
      undefined,
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

  describe('cancellation re-check after the channel wait', () => {
    it('does not send once the wait resolves after the generation was stopped, and settles demand/generation state instead of leaking it', async () => {
      /*
       * `handleStop` never aborts the `AbortController` it started with — it
       * only tells the backend to stop and marks the generation id in
       * `stoppedGenerationIdsRef` — so this is the realistic "Stop while the
       * channel wait is outstanding" race, not a directly-aborted signal.
       */
      let resolveWait!: (id: string | null) => void;
      const notifyGenerationSettled = vi.fn();
      const channel = {
        channelId: null as string | null,
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn(
          () =>
            new Promise<string | null>((resolve) => {
              resolveWait = resolve;
            }),
        ),
        notifyGenerationSettled,
      };
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          channel,
        }),
      );
      /*
       * The harness's `generation` object is recreated every render (a
       * fresh `vi.fn()` each time), so capture the reference `startStream`'s
       * own closure will actually call before triggering any re-render.
       */
      const completeGenerationSpy =
        result.current.generation.completeGeneration;

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
      expect(result.current.stream.isStreaming).toBe(true);

      act(() => {
        result.current.stream.handleStop();
      });

      await act(async () => {
        resolveWait('ch-1');
      });

      expect(transport.streamCompletion).not.toHaveBeenCalled();
      expect(result.current.conversation?.messages).toHaveLength(0);
      // The demand acquired for this generation is released, not leaked.
      expect(notifyGenerationSettled).toHaveBeenCalledOnce();
      // The generation registry entry and per-path streaming state are
      // closed out too, so the composer isn't left stuck "generating".
      expect(completeGenerationSpy).toHaveBeenCalledWith('conv', 'gen-1');
      expect(result.current.stream.isStreaming).toBe(false);
    });

    it('does not send a superseded completion once its wait resolves, only the newer generation reaches the transport, and the superseded one still releases its demand', async () => {
      const waitResolvers: Array<(id: string | null) => void> = [];
      const notifyGenerationSettled = vi.fn();
      const channel = {
        channelId: null as string | null,
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn(
          () =>
            new Promise<string | null>((resolve) => {
              waitResolvers.push(resolve);
            }),
        ),
        notifyGenerationSettled,
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', channel }),
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
        result.current.stream.startStream(
          'bucket/conv',
          'hi again',
          0,
          'gpt-4o',
          undefined,
          'gen-2',
        );
      });

      expect(waitResolvers).toHaveLength(2);
      await act(async () => {
        waitResolvers[0]('ch-old');
      });
      expect(transport.streamCompletion).not.toHaveBeenCalled();
      // gen-1's own demand is released even though it was never sent.
      expect(notifyGenerationSettled).toHaveBeenCalledOnce();

      await act(async () => {
        waitResolvers[1]('ch-new');
      });
      expect(transport.streamCompletion).toHaveBeenCalledOnce();
      const call = vi.mocked(transport.streamCompletion).mock.calls[0];
      expect(call[5]).toBe('gen-2');
      expect(call.at(-1)).toBe('ch-new');
    });

    it('still passes 20000ms as the CHANNEL_WAIT_TIMEOUT_MS to waitForChannel', async () => {
      const channel = {
        channelId: null as string | null,
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn().mockResolvedValue(null),
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', channel }),
      );

      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
      });

      expect(channel.waitForChannel).toHaveBeenCalledWith(20000);
    });

    it('sends without a channel id when the wait resolves null', async () => {
      const channel = {
        channelId: null as string | null,
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn().mockResolvedValue(null),
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', channel }),
      );

      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
      });

      expect(transport.streamCompletion).toHaveBeenCalledOnce();
      const call = vi.mocked(transport.streamCompletion).mock.calls[0];
      expect(call.at(-1)).toBeUndefined();
    });
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
});
