import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import { MessageRole, type Conversation } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  GenerationConflictError,
  StreamInterruptedError,
} from '../../create-chat-stream-api';
import type {
  ConversationStreamOverlayNotifier,
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

  describe('recovery after an interrupted stream (issue #8959)', () => {
    const CONVERSATION_ID = 'bucket/conv';
    const GENERATION_ID = 'gen-1';
    const userMessage = {
      role: MessageRole.User,
      content: 'question',
      timestamp: '2026-09-27T00:00:00Z',
    };
    const withAssistant = (
      assistant: Partial<Conversation['messages'][number]>,
    ) =>
      makeConversation({
        messages: [
          userMessage,
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: '2026-09-27T00:00:01Z',
            ...assistant,
          },
        ],
      });
    const placeholder = () => withAssistant({});
    const textChunk = (content: string) => ({
      id: 'response-1',
      object: 'chat.completion.chunk' as const,
      choices: [{ index: 0, finish_reason: null, delta: { content } }],
    });

    /** An attach SSE stream the test pushes events into. */

    /** Starts a generation, streams a partial answer, then drops the connection. */
    const renderAndInterrupt = async ({
      overlay = {},
      onStreamError,
    }: {
      overlay?: ConversationStreamOverlayNotifier;
      onStreamError?: (error: Error) => void;
    } = {}) => {
      const view = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: CONVERSATION_ID,
          initialConversation: placeholder(),
          overlay,
          onStreamError,
        }),
      );
      await act(async () => {
        view.result.current.stream.startStream(
          CONVERSATION_ID,
          'question',
          1,
          'gpt-4o',
          undefined,
          GENERATION_ID,
        );
      });
      act(() => capturedOptions?.onChunk(textChunk('Partial answer')));
      await act(async () => {
        capturedOptions?.onError(new StreamInterruptedError());
      });
      return view;
    };

    it('keeps stopping with the local id when the rejoined attach announces another id', async () => {
      const attach = makeAttachStream();
      vi.mocked(transport.getConversation).mockResolvedValueOnce(placeholder());
      transport.attachToGeneration = vi.fn().mockResolvedValue(attach.stream);

      const { result } = await renderAndInterrupt();
      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalled(),
      );
      const partial = result.current.conversation?.messages[1];
      await act(async () => {
        attach.emit({
          type: 'snapshot',
          message: { ...partial, content: 'Partial answer, continued' },
          generationId: 'gen-announced',
        });
      });
      await waitFor(() =>
        expect(result.current.conversation?.messages[1]?.content).toBe(
          'Partial answer, continued',
        ),
      );

      expect(result.current.stream.canStopStreaming).toBe(true);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledOnce();
      expect(transport.stopCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ generationId: GENERATION_ID, path: 'conv' }),
      );
    });

    it('rejoins a generation the backend is still running without showing an error', async () => {
      const attach = makeAttachStream();
      const overlay = { notifyGenerationEnd: vi.fn() };
      vi.mocked(transport.getConversation)
        .mockResolvedValueOnce(placeholder())
        .mockResolvedValueOnce(withAssistant({ content: 'Complete answer' }));
      transport.attachToGeneration = vi.fn().mockResolvedValue(attach.stream);

      const { result } = await renderAndInterrupt({ overlay });

      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalledWith(
          'conv',
          expect.any(AbortSignal),
        ),
      );
      const partial = result.current.conversation?.messages[1];
      expect(partial?.content).toBe('Partial answer');
      expect(partial?.streamErrorMessage).toBeUndefined();
      expect(result.current.stream.isStreaming).toBe(true);
      expect(result.current.stream.canStopStreaming).toBe(true);

      await act(async () => {
        attach.emit({
          type: 'snapshot',
          message: { ...partial, content: 'Partial answer, continued' },
        });
      });
      await waitFor(() =>
        expect(result.current.conversation?.messages[1]?.content).toBe(
          'Partial answer, continued',
        ),
      );

      await act(async () => {
        attach.emit({ type: 'done' });
      });
      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.conversation?.messages[1]?.content).toBe(
        'Complete answer',
      );
      expect(result.current.stream.canStopStreaming).toBe(false);
      expect(overlay.notifyGenerationEnd).toHaveBeenCalledOnce();
    });

    it('shows the saved answer when the backend finished while the connection was down', async () => {
      vi.mocked(transport.getConversation).mockResolvedValue(
        withAssistant({ content: 'Saved answer' }),
      );

      const { result } = await renderAndInterrupt();

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      const message = result.current.conversation?.messages[1];
      expect(message?.content).toBe('Saved answer');
      expect(message?.streamErrorMessage).toBeUndefined();
      expect(transport.attachToGeneration).not.toHaveBeenCalled();
    });

    it('retries the server check until the network is back', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(transport.getConversation)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValue(withAssistant({ content: 'Saved answer' }));

      const { result } = await renderAndInterrupt();
      await act(async () => {
        /* Coming back online skips the pending 1 s back-off. */
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(2000);
      });

      await waitFor(() =>
        expect(result.current.conversation?.messages[1]?.content).toBe(
          'Saved answer',
        ),
      );
      expect(transport.getConversation).toHaveBeenCalledTimes(3);
      expect(result.current.stream.isStreaming).toBe(false);
    });

    it('falls back to the error banner when the server cannot be reached', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(transport.getConversation).mockRejectedValue(
        new TypeError('Failed to fetch'),
      );

      const { result } = await renderAndInterrupt();
      expect(result.current.stream.isStreaming).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(transport.getConversation).toHaveBeenCalledTimes(6);
      expect(result.current.conversation?.messages[1]).toMatchObject({
        content: 'Partial answer',
        streamErrorMessage: '',
      });
      expect(result.current.stream.canStopStreaming).toBe(false);
    });

    it('falls back to the error banner when the server has no answer for this turn', async () => {
      vi.mocked(transport.getConversation).mockResolvedValue(
        makeConversation({ messages: [userMessage] }),
      );

      const { result } = await renderAndInterrupt();

      await waitFor(() =>
        expect(
          result.current.conversation?.messages[1]?.streamErrorMessage,
        ).toBe(''),
      );
      expect(result.current.stream.isStreaming).toBe(false);
      expect(transport.attachToGeneration).not.toHaveBeenCalled();
    });

    it('keeps a reload during recovery from starting a second resume', async () => {
      let resolveServerCheck!: (conversation: Conversation) => void;
      vi.mocked(transport.getConversation).mockReturnValueOnce(
        new Promise<Conversation>((resolve) => {
          resolveServerCheck = resolve;
        }),
      );
      transport.attachToGeneration = vi
        .fn()
        .mockResolvedValue(makeAttachStream().stream);

      const { result } = await renderAndInterrupt();
      act(() => {
        result.current.stream.resumeIfAwaitingGeneration(
          CONVERSATION_ID,
          placeholder(),
        );
      });
      expect(transport.attachToGeneration).not.toHaveBeenCalled();
      expect(
        result.current.stream.restoreBufferedGeneration(
          CONVERSATION_ID,
          placeholder(),
        ).messages[1].content,
      ).toBe('Partial answer');

      await act(async () => {
        resolveServerCheck(placeholder());
      });

      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalledOnce(),
      );
    });

    it('does not recover a generation a newer one on the same path replaced', async () => {
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: CONVERSATION_ID,
          initialConversation: placeholder(),
        }),
      );
      await act(async () => {
        result.current.stream.startStream(
          CONVERSATION_ID,
          'question',
          1,
          'gpt-4o',
        );
      });
      const supersededOptions = capturedOptions;
      await act(async () => {
        result.current.stream.startStream(
          CONVERSATION_ID,
          'question',
          1,
          'gpt-4o',
        );
      });

      await act(async () => {
        supersededOptions?.onError(new StreamInterruptedError());
      });

      expect(transport.getConversation).not.toHaveBeenCalled();
      expect(result.current.stream.isStreaming).toBe(true);
      expect(
        result.current.conversation?.messages[1]?.streamErrorMessage,
      ).toBeUndefined();
    });

    it('keeps Stop working after rejoining the generation', async () => {
      const attach = makeAttachStream();
      const overlay = { notifyGenerationEnd: vi.fn() };
      vi.mocked(transport.getConversation)
        .mockResolvedValueOnce(placeholder())
        .mockResolvedValueOnce(
          withAssistant({ content: 'Partial answer', wasStoppedByUser: true }),
        );
      transport.attachToGeneration = vi.fn().mockResolvedValue(attach.stream);

      const { result } = await renderAndInterrupt({ overlay });
      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalledOnce(),
      );

      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ generationId: GENERATION_ID, path: 'conv' }),
      );
      await act(async () => {
        attach.emit({ type: 'stopped' });
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.conversation?.messages[1]).toMatchObject({
        content: 'Partial answer',
        wasStoppedByUser: true,
      });
      expect(result.current.stream.canStopStreaming).toBe(false);
      expect(overlay.notifyGenerationEnd).not.toHaveBeenCalled();
    });

    it('hands the interruption to onStreamError exactly once', async () => {
      const onStreamError = vi.fn();
      vi.mocked(transport.getConversation).mockResolvedValue(
        withAssistant({ content: 'Saved answer' }),
      );

      const { result } = await renderAndInterrupt({ onStreamError });
      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );

      expect(onStreamError).toHaveBeenCalledOnce();
      expect(onStreamError.mock.calls[0][0]).toBeInstanceOf(
        StreamInterruptedError,
      );
    });
  });

  describe('a conflict on a start that opted into resumeOnConflict', () => {
    const CONVERSATION_ID = 'bucket/conv';
    const GENERATION_ID = 'gen-reloaded';
    const userMessage = {
      role: MessageRole.User,
      content: 'question',
      timestamp: '2026-10-02T00:00:00Z',
    };
    const preStart = () => makeConversation({ messages: [userMessage] });
    const withAssistant = (
      assistant: Partial<Conversation['messages'][number]>,
    ) =>
      makeConversation({
        messages: [
          userMessage,
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: '2026-10-02T00:00:01Z',
            ...assistant,
          },
        ],
      });
    const placeholder = () => withAssistant({});

    /** Auto-starts the reloaded turn, which the backend rejects with a conflict. */
    const renderAndConflict = async ({
      resumeOnConflict = true,
      onStreamError,
    }: {
      resumeOnConflict?: boolean;
      onStreamError?: (error: Error) => void;
    } = {}) => {
      const view = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: CONVERSATION_ID,
          initialConversation: placeholder(),
          onStreamError,
        }),
      );
      await act(async () => {
        view.result.current.stream.startStream(
          CONVERSATION_ID,
          'question',
          1,
          'gpt-4o',
          undefined,
          GENERATION_ID,
          SendCompletionDtoModeEnum.ContinueLastUser,
          { resumeOnConflict },
        );
      });
      await act(async () => {
        capturedOptions?.onError(new GenerationConflictError());
      });
      return view;
    };

    it('waits for the running generation to save its start, joins it, and ends on the saved answer', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const attach = makeAttachStream();
      const onStreamError = vi.fn();
      vi.mocked(transport.getConversation)
        .mockResolvedValueOnce(preStart())
        .mockResolvedValueOnce(placeholder())
        .mockResolvedValueOnce(withAssistant({ content: 'Saved answer' }));
      transport.attachToGeneration = vi.fn().mockResolvedValue(attach.stream);

      const { result } = await renderAndConflict({ onStreamError });

      expect(result.current.stream.isStreaming).toBe(true);
      expect(result.current.stream.canStopStreaming).toBe(false);
      expect(
        result.current.conversation?.messages[1]?.streamErrorMessage,
      ).toBeUndefined();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalledWith(
          'conv',
          expect.any(AbortSignal),
        ),
      );

      await act(async () => {
        attach.emit({
          type: 'snapshot',
          message: { role: MessageRole.Assistant, content: 'Saved' },
        });
      });
      await waitFor(() =>
        expect(result.current.conversation?.messages[1]?.content).toBe('Saved'),
      );
      expect(result.current.stream.canStopStreaming).toBe(false);

      await act(async () => {
        attach.emit({ type: 'done' });
      });
      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.conversation?.messages).toHaveLength(2);
      expect(result.current.conversation?.messages[1]).toMatchObject({
        content: 'Saved answer',
      });
      expect(
        result.current.conversation?.messages[1]?.streamErrorMessage,
      ).toBeUndefined();
      expect(transport.streamCompletion).toHaveBeenCalledOnce();
      expect(onStreamError).toHaveBeenCalledOnce();
      expect(onStreamError).toHaveBeenCalledWith(
        expect.any(GenerationConflictError),
      );
    });

    it('keeps Stop unavailable after the joined generation announces an id', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const attach = makeAttachStream();
      vi.mocked(transport.getConversation)
        .mockResolvedValueOnce(preStart())
        .mockResolvedValue(placeholder());
      transport.attachToGeneration = vi.fn().mockResolvedValue(attach.stream);

      const { result } = await renderAndConflict();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await waitFor(() =>
        expect(transport.attachToGeneration).toHaveBeenCalled(),
      );
      await act(async () => {
        attach.emit({
          type: 'snapshot',
          message: { role: MessageRole.Assistant, content: 'Saved' },
          generationId: 'gen-joined',
        });
      });
      await waitFor(() =>
        expect(result.current.conversation?.messages[1]?.content).toBe('Saved'),
      );

      expect(result.current.stream.isStreaming).toBe(true);
      expect(result.current.stream.canStopStreaming).toBe(false);
    });

    it('shows the saved answer when the running generation already finished', async () => {
      vi.mocked(transport.getConversation).mockResolvedValue(
        withAssistant({ content: 'Saved answer' }),
      );

      const { result } = await renderAndConflict();

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.conversation?.messages[1]).toMatchObject({
        content: 'Saved answer',
      });
      expect(
        result.current.conversation?.messages[1]?.streamErrorMessage,
      ).toBeUndefined();
      expect(transport.attachToGeneration).not.toHaveBeenCalled();
      expect(transport.streamCompletion).toHaveBeenCalledOnce();
    });

    it('falls back to the conflict message when the start never lands', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(transport.getConversation).mockResolvedValue(preStart());

      const { result } = await renderAndConflict();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(transport.getConversation).toHaveBeenCalledTimes(6);
      expect(result.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        DEFAULT_GENERATION_CONFLICT_MESSAGE,
      );
      expect(result.current.stream.canStopStreaming).toBe(false);
      expect(transport.streamCompletion).toHaveBeenCalledOnce();
    });

    it('falls back to the conflict message when the server cannot be reached', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(transport.getConversation).mockRejectedValue(
        new TypeError('Failed to fetch'),
      );

      const { result } = await renderAndConflict();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      await waitFor(() =>
        expect(result.current.stream.isStreaming).toBe(false),
      );
      expect(result.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        DEFAULT_GENERATION_CONFLICT_MESSAGE,
      );
    });

    it('does not hand over a start a newer one on the same path replaced', async () => {
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: CONVERSATION_ID,
          initialConversation: placeholder(),
        }),
      );
      await act(async () => {
        result.current.stream.startStream(
          CONVERSATION_ID,
          'question',
          1,
          'gpt-4o',
          undefined,
          GENERATION_ID,
          SendCompletionDtoModeEnum.ContinueLastUser,
          { resumeOnConflict: true },
        );
      });
      const supersededOptions = capturedOptions;
      await act(async () => {
        result.current.stream.startStream(
          CONVERSATION_ID,
          'question',
          1,
          'gpt-4o',
        );
      });

      await act(async () => {
        supersededOptions?.onError(new GenerationConflictError());
      });

      expect(transport.getConversation).not.toHaveBeenCalled();
      expect(result.current.stream.isStreaming).toBe(true);
      expect(
        result.current.conversation?.messages[1]?.streamErrorMessage,
      ).toBeUndefined();
    });

    it('still shows the conflict at once for a start that did not opt in', async () => {
      const { result } = await renderAndConflict({ resumeOnConflict: false });

      expect(result.current.conversation?.messages[1]?.streamErrorMessage).toBe(
        DEFAULT_GENERATION_CONFLICT_MESSAGE,
      );
      expect(result.current.stream.isStreaming).toBe(false);
      expect(transport.getConversation).not.toHaveBeenCalled();
    });
  });
});
