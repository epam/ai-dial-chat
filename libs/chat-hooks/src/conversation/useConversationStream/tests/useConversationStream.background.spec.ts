import {
  BackgroundGenerationStatus,
  MessageRole,
  type Conversation,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StopCompletionError } from '../../create-chat-stream-api';
import type {
  ConversationStreamTransport,
  StreamCompletionOptions,
} from '../useConversationStream';
import {
  createStreamTestTransport,
  makeAttachStream,
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

  describe('background generations', () => {
    const pendingBackground = (generationId = 'gen-bg') => ({
      role: MessageRole.Assistant,
      content: '',
      timestamp: 't1',
      responseId: 'dial_r1',
      backgroundGeneration: {
        generationId,
        status: BackgroundGenerationStatus.Pending,
        startedAt: 1,
      },
    });
    const withPending = () =>
      makeConversation({
        messages: [
          { role: MessageRole.User, content: 'question', timestamp: 't0' },
          pendingBackground(),
        ],
      });
    const openStream = () =>
      new ReadableStream<Uint8Array>({
        start() {
          /* stays open: the attach replay is still running */
        },
      });

    it('resumes through attach instead of settling when the reload after a stream end shows a pending background message', async () => {
      const initial = makeConversation({
        messages: [
          { role: MessageRole.User, content: 'question', timestamp: 't0' },
          { role: MessageRole.Assistant, content: '', timestamp: 't1' },
        ],
      });
      vi.mocked(transport.getConversation).mockResolvedValue(withPending());
      vi.mocked(transport.attachToGeneration).mockResolvedValue(openStream());
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
      await act(async () => {
        await capturedOptions?.onComplete();
      });

      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalled(),
      );
      expect(result.current.stream.isStreaming).toBe(true);
      expect(
        result.current.conversation?.messages[1].streamErrorMessage,
      ).toBeUndefined();
    });

    it('settles as before when the reload shows a completed background message', async () => {
      const initial = makeConversation({
        messages: [
          { role: MessageRole.User, content: 'question', timestamp: 't0' },
          { role: MessageRole.Assistant, content: '', timestamp: 't1' },
        ],
      });
      vi.mocked(transport.getConversation).mockResolvedValue(
        makeConversation({
          messages: [
            { role: MessageRole.User, content: 'question', timestamp: 't0' },
            {
              ...pendingBackground(),
              content: 'answer',
              backgroundGeneration: {
                generationId: 'gen-bg',
                status: BackgroundGenerationStatus.Completed,
                startedAt: 1,
              },
            },
          ],
        }),
      );
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
      await act(async () => {
        await capturedOptions?.onComplete();
      });

      expect(transport.attachToGeneration).not.toHaveBeenCalled();
      expect(result.current.stream.isStreaming).toBe(false);
      expect(result.current.conversation?.messages[1].content).toBe('answer');
    });

    it('offers Stop after a refresh and sends the stored generation id', async () => {
      const initial = withPending();
      vi.mocked(transport.attachToGeneration).mockResolvedValue(openStream());
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
      await waitFor(() => expect(result.current.stream.isStreaming).toBe(true));

      expect(result.current.stream.canStopStreaming).toBe(true);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledWith({
        generationId: 'gen-bg',
        path: 'conv',
        content: initial.messages[1].content,
      });
    });

    it('reports a Stop 404 for a resumed generation that is still streaming after the grace window', async () => {
      const onStopError = vi.fn();
      const notFound = new StopCompletionError(404);
      transport.stopCompletion = vi.fn().mockRejectedValue(notFound);
      const initial = withPending();
      vi.mocked(transport.attachToGeneration).mockResolvedValue(openStream());
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: initial,
          onStopError,
        }),
      );
      act(() =>
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          initial,
        ),
      );
      await waitFor(() => expect(result.current.stream.isStreaming).toBe(true));
      vi.useFakeTimers();

      await act(async () => {
        result.current.stream.handleStop();
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(onStopError).toHaveBeenCalledWith(notFound);
    });

    it('keeps Stop unavailable for a resumed message without a background marker', async () => {
      const initial = makeConversation({
        messages: [
          { role: MessageRole.User, content: 'question', timestamp: 't0' },
          { role: MessageRole.Assistant, content: '', timestamp: 't1' },
        ],
      });
      vi.mocked(transport.attachToGeneration).mockResolvedValue(openStream());
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
      await waitFor(() => expect(result.current.stream.isStreaming).toBe(true));

      expect(result.current.stream.canStopStreaming).toBe(false);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).not.toHaveBeenCalled();
    });
  });

  describe('attach-supplied generation id for a resumed non-background generation', () => {
    const ATTACH_ID = 'gen-attach';
    const userMessage = {
      role: MessageRole.User,
      content: 'question',
      timestamp: 't0',
    };
    const placeholder = () =>
      makeConversation({
        messages: [
          userMessage,
          { role: MessageRole.Assistant, content: '', timestamp: 't1' },
        ],
      });
    const stoppedPartial = () =>
      makeConversation({
        messages: [
          userMessage,
          {
            role: MessageRole.Assistant,
            content: 'Hel',
            timestamp: 't1',
            wasStoppedByUser: true,
          },
        ],
      });
    const snapshotOf = (content: string, generationId?: string) => ({
      type: 'snapshot',
      message: { role: MessageRole.Assistant, content, timestamp: 't1' },
      ...(generationId != null && { generationId }),
    });

    /** An attach SSE stream the test pushes events into. */

    const renderResumed = async (initial: Conversation) => {
      const attach = makeAttachStream();
      transport.attachToGeneration = vi.fn().mockResolvedValue(attach.stream);
      const view = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: initial,
        }),
      );
      act(() =>
        view.result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          initial,
        ),
      );
      await waitFor(() =>
        expect(view.result.current.stream.isStreaming).toBe(true),
      );
      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalled(),
      );
      return { ...view, attach };
    };

    it('offers Stop after the attach snapshot announces an id and sends that id', async () => {
      const { result, attach } = await renderResumed(placeholder());
      expect(result.current.stream.canStopStreaming).toBe(false);

      await act(async () => {
        attach.emit(snapshotOf('Hel', ATTACH_ID));
      });

      await waitFor(() =>
        expect(result.current.stream.canStopStreaming).toBe(true),
      );
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledOnce();
      expect(transport.stopCompletion).toHaveBeenCalledWith({
        generationId: ATTACH_ID,
        path: 'conv',
        content: 'Hel',
      });
    });

    it('settles on the stopped partial after the attach reports stopped', async () => {
      vi.mocked(transport.getConversation).mockResolvedValue(stoppedPartial());
      const { result, attach } = await renderResumed(placeholder());
      await act(async () => {
        attach.emit(snapshotOf('Hel', ATTACH_ID));
      });
      await waitFor(() =>
        expect(result.current.stream.canStopStreaming).toBe(true),
      );
      act(() => result.current.stream.handleStop());

      await act(async () => {
        attach.emit({ type: 'stopped' });
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.stream.canStopStreaming).toBe(false);
      expect(result.current.conversation?.messages[1]).toMatchObject({
        content: 'Hel',
        wasStoppedByUser: true,
      });
    });

    it('keeps Stop unavailable when the snapshot carries no id', async () => {
      const { result, attach } = await renderResumed(placeholder());

      await act(async () => {
        attach.emit(snapshotOf('Hel'));
      });
      await waitFor(() =>
        expect(result.current.conversation?.messages[1].content).toBe('Hel'),
      );

      expect(result.current.stream.canStopStreaming).toBe(false);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).not.toHaveBeenCalled();
    });

    it('drops Stop when the attach ends without a terminal event and the watch fallback takes over', async () => {
      vi.mocked(transport.watchConversation).mockResolvedValue(
        new ReadableStream<Uint8Array>({
          start() {
            /* stays open: the watch is still waiting for the final save */
          },
        }),
      );
      vi.mocked(transport.getConversation).mockResolvedValue(placeholder());
      const { result, attach } = await renderResumed(placeholder());
      await act(async () => {
        attach.emit(snapshotOf('Hel', ATTACH_ID));
      });
      await waitFor(() =>
        expect(result.current.stream.canStopStreaming).toBe(true),
      );

      await act(async () => {
        attach.end();
      });

      await waitFor(() =>
        expect(transport.watchConversation).toHaveBeenCalled(),
      );
      await waitFor(() =>
        expect(result.current.stream.canStopStreaming).toBe(false),
      );
      expect(result.current.stream.isStreaming).toBe(true);
    });

    it('sends the stored background id, not the announced one, for a pending background message', async () => {
      const pendingBackground = makeConversation({
        messages: [
          userMessage,
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: 't1',
            responseId: 'dial_r1',
            backgroundGeneration: {
              generationId: 'gen-bg',
              status: BackgroundGenerationStatus.Pending,
              startedAt: 1,
            },
          },
        ],
      });
      const { result, attach } = await renderResumed(pendingBackground);
      await act(async () => {
        attach.emit(snapshotOf('Hel', ATTACH_ID));
      });

      act(() => result.current.stream.handleStop());

      expect(transport.stopCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ generationId: 'gen-bg' }),
      );
    });

    it('keeps the local answer and Stop when a load asks to resume the same active path', async () => {
      const initial = placeholder();
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
          undefined,
          'gen-local',
        );
      });
      expect(result.current.stream.canStopStreaming).toBe(true);

      act(() =>
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          initial,
        ),
      );
      act(() => {
        capturedOptions?.onChunk({
          id: 'local-answer',
          object: 'chat.completion.chunk',
          choices: [
            {
              delta: { content: 'Local answer' },
              index: 0,
              finish_reason: null,
            },
          ],
        });
      });

      expect(transport.attachToGeneration).not.toHaveBeenCalled();
      expect(transport.getConversation).not.toHaveBeenCalled();
      expect(result.current.conversation?.messages[1].content).toBe(
        'Local answer',
      );

      expect(result.current.stream.canStopStreaming).toBe(true);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ generationId: 'gen-local' }),
      );
    });
  });

  describe("another participant's foreground generation", () => {
    it('keeps the chat generating while the marker is live, then shows the saved answer', async () => {
      const question = {
        role: MessageRole.User,
        content: 'question',
        timestamp: 't0',
      };
      const running = makeConversation({
        messages: [
          question,
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: 't1',
            foregroundGeneration: {
              generationId: '9d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6',
              startedAt: 1,
              expiresAt: Date.now() + 60_000,
            },
          },
        ],
      });
      const answered = makeConversation({
        messages: [
          question,
          { role: MessageRole.Assistant, content: 'answer', timestamp: 't1' },
        ],
      });
      const watch = makeAttachStream();
      vi.mocked(transport.attachToGeneration).mockRejectedValue(
        new Error('404'),
      );
      vi.mocked(transport.watchConversation).mockResolvedValue(watch.stream);
      vi.mocked(transport.getConversation).mockResolvedValue(running);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: running,
          generationInterruptedMessage: 'Interrupted',
        }),
      );

      act(() =>
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          running,
        ),
      );
      await waitFor(() =>
        expect(transport.watchConversation).toHaveBeenCalled(),
      );
      await waitFor(() => expect(transport.getConversation).toHaveBeenCalled());

      expect(result.current.stream.isStreaming).toBe(true);
      expect(
        result.current.conversation?.messages[1].streamErrorMessage,
      ).toBeUndefined();

      vi.mocked(transport.getConversation).mockResolvedValue(answered);
      watch.emit({ action: 'UPDATE' });

      await waitFor(() =>
        expect(result.current.conversation?.messages[1].content).toBe('answer'),
      );
      expect(result.current.stream.isStreaming).toBe(false);
    });
  });
});
