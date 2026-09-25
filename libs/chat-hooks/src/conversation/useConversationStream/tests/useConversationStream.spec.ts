import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import { MessageRole, type Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  GenerationConflictError,
  GenerationPersistenceError,
  StreamUpstreamError,
} from '../../create-chat-stream-api';
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
  generationOverride,
  ...rest
}: {
  transport: ConversationStreamTransport;
  conversationId: string | undefined;
  onStopError?: (error: Error) => void;
  overlay?: ConversationStreamOverlayNotifier;
  channel?: ConversationStreamChannel;
  initialConversation?: Conversation;
  generationConflictMessage?: string;
  generationPersistenceErrorMessage?: string;
  onStreamError?: (error: Error) => void;
  /** Overrides the `AbortController` `startGeneration` returns, so a test can abort it directly to simulate a host-driven stop. */
  generationOverride?: () => AbortController;
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(
    initialConversation ?? makeConversation(),
  );
  const conversationRef = useRef<Conversation | null>(conversation);
  conversationRef.current = conversation;

  const generation = {
    startGeneration: vi.fn(generationOverride ?? (() => new AbortController())),
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

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('unsaved answers', () => {
    const warning = 'Unsaved answer: copy before leaving';
    const placeholder = () =>
      makeConversation({
        messages: [
          {
            role: MessageRole.User,
            content: 'question',
            timestamp: '2026-09-25T00:00:00Z',
          },
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: '2026-09-25T00:00:01Z',
          },
        ],
      });
    const chunk = {
      id: 'response-1',
      object: 'chat.completion.chunk' as const,
      choices: [
        {
          index: 0,
          finish_reason: null,
          delta: {
            content: 'Visible answer',
            custom_content: {
              stages: [
                {
                  index: 0,
                  name: 'Visible step',
                  content: 'Tool output',
                  status: null,
                },
              ],
              state: { result: 'preserve me' },
            },
          },
        },
      ],
    };

    it.each([true, false])(
      'preserves text, stages and state after terminal failure (explicit=%s)',
      async (explicit) => {
        const initial = placeholder();
        vi.mocked(transport.getConversation).mockResolvedValue(initial);
        const { result } = renderHook(() =>
          useHookHarness({
            transport,
            conversationId: 'bucket/conv',
            initialConversation: initial,
            generationPersistenceErrorMessage: warning,
          }),
        );
        await act(async () => {
          result.current.stream.startStream(
            'bucket/conv',
            'question',
            1,
            'gpt-4o',
          );
        });
        act(() => capturedOptions?.onChunk(chunk));
        expect(result.current.conversation?.messages[1].content).toBe(
          'Visible answer',
        );
        await act(async () => {
          if (explicit)
            capturedOptions?.onError(new GenerationPersistenceError());
          else await capturedOptions?.onComplete();
        });
        expect(result.current.conversation?.messages[1]).toMatchObject({
          content: 'Visible answer',
          streamErrorMessage: warning,
          custom_content: {
            stages: [{ name: 'Visible step', content: 'Tool output' }],
            state: { result: 'preserve me' },
          },
        });
        expect(result.current.stream.isStreaming).toBe(false);
        expect(result.current.stream.canStopStreaming).toBe(false);
        const restored = result.current.stream.restoreBufferedGeneration(
          'bucket/conv',
          initial,
        );
        expect(restored.messages[1].content).toBe('Visible answer');
        if (explicit) expect(transport.getConversation).not.toHaveBeenCalled();
      },
    );

    it('accepts the saved server answer and enrichment without a warning', async () => {
      const initial = placeholder();
      const saved = makeConversation({
        messages: [
          initial.messages[0],
          {
            role: MessageRole.Assistant,
            content: 'Visible answer',
            timestamp: '2026-09-25T00:00:01Z',
            custom_content: { state: { server: 'enriched' } },
          },
        ],
      });
      vi.mocked(transport.getConversation).mockResolvedValue(saved);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: initial,
        }),
      );
      await act(async () => {
        result.current.stream.startStream(
          'bucket/conv',
          'question',
          1,
          'gpt-4o',
        );
      });
      act(() => capturedOptions?.onChunk(chunk));
      await act(async () => {
        await capturedOptions?.onComplete();
      });
      expect(result.current.conversation).toEqual(saved);
      expect(
        result.current.stream.restoreBufferedGeneration('bucket/conv', saved),
      ).toEqual(saved);
    });

    it.each([true, false])(
      'preserves a stages-only answer when terminal reload fails (%s)',
      async (readFails) => {
        const initial = placeholder();
        if (readFails)
          vi.mocked(transport.getConversation).mockRejectedValue(
            new Error('network unavailable'),
          );
        else vi.mocked(transport.getConversation).mockResolvedValue(initial);
        const { result } = renderHook(() =>
          useHookHarness({
            transport,
            conversationId: 'bucket/conv',
            initialConversation: initial,
            generationPersistenceErrorMessage: warning,
          }),
        );
        await act(async () => {
          result.current.stream.startStream(
            'bucket/conv',
            'question',
            1,
            'gpt-4o',
          );
        });
        act(() =>
          capturedOptions?.onChunk({
            ...chunk,
            choices: [
              {
                ...chunk.choices[0],
                delta: { ...chunk.choices[0].delta, content: '' },
              },
            ],
          }),
        );
        await act(async () => {
          await capturedOptions?.onComplete();
        });
        expect(result.current.conversation?.messages[1]).toMatchObject({
          content: '',
          streamErrorMessage: warning,
          custom_content: { stages: [{ name: 'Visible step' }] },
        });
        expect(result.current.stream.isStreaming).toBe(false);
      },
    );

    it.each([true, false])(
      'preserves an attached answer on terminal failure (explicit=%s)',
      async (explicit) => {
        const initial = placeholder();
        vi.mocked(transport.getConversation).mockResolvedValue(initial);
        transport.attachToGeneration = vi.fn().mockResolvedValue(
          new ReadableStream({
            start(controller) {
              const events = [
                { type: 'snapshot', message: initial.messages[1] },
                { type: 'chunk', chunk },
                explicit
                  ? {
                      type: 'error',
                      errorType: 'conversation_save_failed',
                      message: 'raw detail',
                    }
                  : { type: 'done' },
              ];
              for (const event of events)
                controller.enqueue(
                  new TextEncoder().encode(
                    'data: ' + JSON.stringify(event) + '\n\n',
                  ),
                );
              controller.close();
            },
          }),
        );
        const { result } = renderHook(() =>
          useHookHarness({
            transport,
            conversationId: 'bucket/conv',
            initialConversation: initial,
            generationPersistenceErrorMessage: warning,
          }),
        );
        act(() =>
          result.current.stream.resumeIfAwaitingGeneration(
            'bucket/conv',
            initial,
          ),
        );
        await waitFor(() =>
          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toBe(warning),
        );
        expect(result.current.conversation?.messages[1]).toMatchObject({
          content: 'Visible answer',
          custom_content: {
            stages: [{ name: 'Visible step' }],
            state: { result: 'preserve me' },
          },
        });
        expect(result.current.stream.isStreaming).toBe(false);
        if (explicit) expect(transport.getConversation).not.toHaveBeenCalled();
      },
    );

    it('does not restore a resumed answer over a newer generation while its reload is pending', async () => {
      const initial = placeholder();
      let resolveReload!: (conversation: Conversation) => void;
      transport.getConversation = vi.fn(
        () =>
          new Promise<Conversation>((resolve) => {
            resolveReload = resolve;
          }),
      );
      transport.attachToGeneration = vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            for (const event of [
              {
                type: 'snapshot',
                message: { ...initial.messages[1], content: 'Old answer' },
              },
              { type: 'done' },
            ]) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: ' + JSON.stringify(event) + '\n\n',
                ),
              );
            }
            controller.close();
          },
        }),
      );
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: initial,
        }),
      );
      act(() =>
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          initial,
        ),
      );
      await waitFor(() =>
        expect(transport.getConversation).toHaveBeenCalledOnce(),
      );
      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'next', 1, 'gpt-4o');
      });
      act(() => capturedOptions?.onChunk(chunk));
      const newAnswer = result.current.conversation;
      await act(async () => {
        resolveReload(initial);
      });
      expect(result.current.conversation).toEqual(newAnswer);
      expect(result.current.stream.isStreaming).toBe(true);
    });
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

  describe('generation conflict (issue #8688)', () => {
    const conversationWithPendingAnswer = () =>
      makeConversation({
        messages: [
          { role: MessageRole.User, content: 'hi', timestamp: '1' },
          { role: MessageRole.Assistant, content: '', timestamp: '2' },
        ],
      });

    const renderAndFail = async (
      error: Error,
      generationConflictMessage?: string,
      onStreamError?: (error: Error) => void,
    ) => {
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: conversationWithPendingAnswer(),
          generationConflictMessage,
          onStreamError,
        }),
      );

      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'hi', 1, 'gpt-4o');
      });
      act(() => {
        capturedOptions?.onError(error);
      });

      return result;
    };

    it('shows the host-supplied message when another tab is already generating', async () => {
      const view = await renderAndFail(
        new GenerationConflictError(),
        'Already generating elsewhere.',
      );

      expect(view.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        'Already generating elsewhere.',
      );
    });

    it('falls back to the default conflict message when the host supplies none', async () => {
      const view = await renderAndFail(new GenerationConflictError());

      expect(view.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        DEFAULT_GENERATION_CONFLICT_MESSAGE,
      );
    });

    it('stops streaming so the composer is usable again', async () => {
      const view = await renderAndFail(
        new GenerationConflictError(),
        'Already generating elsewhere.',
      );

      expect(view.current.stream.isStreaming).toBe(false);
      expect(view.current.stream.canStopStreaming).toBe(false);
    });

    it('never disguises a transport error as a conflict', async () => {
      const view = await renderAndFail(
        new Error('generation failed'),
        'Already generating elsewhere.',
      );

      expect(view.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        '',
      );
    });
  });

  describe('error text shown on the message (issue #8979)', () => {
    const renderAndFail = async (
      error: Error,
      onStreamError?: (error: Error) => void,
    ) => {
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: makeConversation({
            messages: [
              { role: MessageRole.User, content: 'hi', timestamp: '1' },
              { role: MessageRole.Assistant, content: '', timestamp: '2' },
            ],
          }),
          onStreamError,
        }),
      );

      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'hi', 1, 'gpt-4o');
      });
      act(() => {
        capturedOptions?.onError(error);
      });

      return result;
    };

    it('keeps the text of an upstream DIAL Core error', async () => {
      const view = await renderAndFail(
        new StreamUpstreamError('Rate limit exceeded'),
      );

      expect(view.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        'Rate limit exceeded',
      );
    });

    it.each([
      new TypeError('Failed to fetch'),
      new Error('Stream request failed with status 502'),
      new TypeError('terminated'),
    ])(
      'hides the transport error "%s" behind the host fallback',
      async (error) => {
        const view = await renderAndFail(error);

        expect(view.current.conversation?.messages[1]?.streamErrorMessage).toBe(
          '',
        );
      },
    );

    it('stops streaming after a transport error', async () => {
      const view = await renderAndFail(new TypeError('Failed to fetch'));

      expect(view.current.stream.isStreaming).toBe(false);
      expect(view.current.stream.canStopStreaming).toBe(false);
    });

    it('hands the original error to onStreamError exactly once', async () => {
      const onStreamError = vi.fn();
      const error = new TypeError('Failed to fetch');

      await renderAndFail(error, onStreamError);

      expect(onStreamError).toHaveBeenCalledOnce();
      expect(onStreamError).toHaveBeenCalledWith(error);
    });
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

    it('keeps waiting on attach past the old 5-minute watch timeout instead of falling back (Issue #8494)', async () => {
      const encoder = new TextEncoder();
      let streamController:
        ReadableStreamDefaultController<Uint8Array> | undefined;
      transport.attachToGeneration = vi.fn().mockResolvedValue(
        new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'snapshot',
                  message: {
                    role: MessageRole.Assistant,
                    content: '',
                    timestamp: '2026-01-01T00:00:00.000Z',
                  },
                })}\n\n`,
              ),
            );
          },
        }),
      );

      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      // A multi-stage generation (e.g. Deep Research) can easily run past
      // the old resume-watch timeout constant — attach must not abandon it.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });

      expect(transport.watchConversation).not.toHaveBeenCalled();
      expect(result.current.stream.isStreaming).toBe(true);

      transport.getConversation = vi
        .fn()
        .mockResolvedValue(makeConversation({ name: 'Resolved' }));
      streamController?.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
      );
      streamController?.close();
      vi.useRealTimers();

      await waitFor(() =>
        expect(result.current.conversation?.name).toBe('Resolved'),
      );
      expect(result.current.stream.isStreaming).toBe(false);
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

  describe('notifyGenerationSettled', () => {
    it('calls channel.notifyGenerationSettled exactly once on successful completion', async () => {
      const channel = {
        channelId: 'ch-1',
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn(),
        notifyGenerationSettled: vi.fn(),
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', channel }),
      );

      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
      });
      expect(channel.notifyGenerationSettled).not.toHaveBeenCalled();

      await act(async () => {
        await capturedOptions?.onComplete();
      });

      expect(channel.notifyGenerationSettled).toHaveBeenCalledOnce();
    });

    it('calls channel.notifyGenerationSettled exactly once on error', async () => {
      const channel = {
        channelId: 'ch-1',
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn(),
        notifyGenerationSettled: vi.fn(),
      };
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv', channel }),
      );

      act(() => {
        result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
      });
      act(() => {
        capturedOptions?.onError(new Error('generation failed'));
      });

      expect(channel.notifyGenerationSettled).toHaveBeenCalledOnce();
    });

    it('does not throw when the channel or the callback itself is omitted', async () => {
      const channelWithoutCallback = {
        channelId: 'ch-1',
        ensureConnected: vi.fn(),
        waitForChannel: vi.fn(),
      };
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          channel: channelWithoutCallback,
        }),
      );

      await expect(
        act(async () => {
          result.current.stream.startStream('bucket/conv', 'hi', 0, 'gpt-4o');
          await capturedOptions?.onComplete();
        }),
      ).resolves.not.toThrow();

      const { result: resultNoChannel } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );

      await expect(
        act(async () => {
          resultNoChannel.current.stream.startStream(
            'bucket/conv',
            'hi',
            0,
            'gpt-4o',
          );
          await capturedOptions?.onComplete();
        }),
      ).resolves.not.toThrow();
    });
  });
});
