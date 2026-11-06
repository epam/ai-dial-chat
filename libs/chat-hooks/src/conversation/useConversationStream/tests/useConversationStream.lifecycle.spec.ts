import { MessageRole, type Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GENERATION_INTERRUPTED_ERROR_MESSAGE } from '../../create-chat-stream-api';
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

    /** A watch stream that never delivers an update: nothing is producing the answer. */
    const openWatchStream = () =>
      new ReadableStream<Uint8Array>({
        start() {
          /* stays open: no update arrives */
        },
      });

    it('releases the chat and shows the host text when attach finds nothing and the stored copy is still the placeholder', async () => {
      transport.watchConversation = vi
        .fn()
        .mockResolvedValue(openWatchStream());
      transport.getConversation = vi
        .fn()
        .mockResolvedValue(makeAwaitingConversation());
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: makeAwaitingConversation(),
          generationInterruptedMessage: 'Interrupted',
        }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });
      expect(result.current.stream.isStreaming).toBe(true);

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.stream.canStopStreaming).toBe(false);
      expect(result.current.conversation?.messages[1].streamErrorMessage).toBe(
        'Interrupted',
      );
      expect(transport.stopCompletion).not.toHaveBeenCalled();
    });

    it('shows the English default text when the host passes no interrupted text', async () => {
      transport.watchConversation = vi
        .fn()
        .mockResolvedValue(openWatchStream());
      transport.getConversation = vi
        .fn()
        .mockResolvedValue(makeAwaitingConversation());
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: makeAwaitingConversation(),
        }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() =>
        expect(
          result.current.conversation?.messages[1].streamErrorMessage,
        ).toBe(DEFAULT_GENERATION_INTERRUPTED_ERROR_MESSAGE),
      );
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

    it('keeps sparse parent references from the replay snapshot through later interleaved chunks', async () => {
      const encoder = new TextEncoder();
      const event = (payload: unknown) =>
        encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
      const stagesChunk = (stages: unknown[]) => ({
        type: 'chunk',
        chunk: { choices: [{ delta: { custom_content: { stages } } }] },
      });
      transport.attachToGeneration = vi.fn().mockResolvedValue(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              event({
                type: 'snapshot',
                message: {
                  role: MessageRole.Assistant,
                  content: '',
                  timestamp: '2026-01-01T00:00:00.000Z',
                  custom_content: {
                    stages: [
                      { index: 4, name: 'Plan', status: null },
                      {
                        index: 7,
                        name: 'Search',
                        status: null,
                        parent_stage_index: 4,
                      },
                    ],
                  },
                },
              }),
            );
            controller.enqueue(
              event(
                stagesChunk([
                  { index: 9, name: 'Read', parent_stage_index: 4 },
                  { index: 7, content: 'found' },
                ]),
              ),
            );
            controller.enqueue(
              event(
                stagesChunk([
                  { index: 9, status: 'failed' },
                  { index: 7, status: 'completed' },
                ]),
              ),
            );
          },
        }),
      );

      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: makeAwaitingConversation(),
        }),
      );

      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          makeAwaitingConversation(),
        );
      });

      await waitFor(() =>
        expect(
          result.current.conversation?.messages[1].custom_content?.stages,
        ).toEqual([
          { index: 4, name: 'Plan', status: null },
          {
            index: 7,
            name: 'Search',
            status: 'completed',
            parent_stage_index: 4,
            content: 'found',
          },
          {
            index: 9,
            name: 'Read',
            status: 'failed',
            parent_stage_index: 4,
          },
        ]),
      );
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
