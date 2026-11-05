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

  describe('batchChunksPerFrame', () => {
    const streaming = () =>
      makeConversation({
        messages: [
          { role: MessageRole.User, content: 'question', timestamp: 't0' },
          { role: MessageRole.Assistant, content: '', timestamp: 't1' },
        ],
      });
    const textChunk = (content: string) => ({
      id: 'response-1',
      object: 'chat.completion.chunk' as const,
      choices: [{ index: 0, finish_reason: null, delta: { content } }],
    });

    const renderBatched = async (batchChunksPerFrame = true) => {
      vi.useFakeTimers();
      const initial = streaming();
      const view = renderHook(
        ({ conversationId }: { conversationId: string }) =>
          useHookHarness({
            transport,
            conversationId,
            initialConversation: initial,
            batchChunksPerFrame,
          }),
        { initialProps: { conversationId: 'bucket/conv' } },
      );
      await act(async () => {
        view.result.current.stream.startStream(
          'bucket/conv',
          'question',
          1,
          'gpt-4o',
        );
      });
      return view;
    };
    const answer = (view: {
      result: { current: { conversation: Conversation | null } };
    }) => view.result.current.conversation?.messages[1].content;

    it('shows several chunks of one frame in a single update', async () => {
      const view = await renderBatched();

      act(() => {
        capturedOptions?.onChunk(textChunk('a'));
        capturedOptions?.onChunk(textChunk('b'));
        capturedOptions?.onChunk(textChunk('c'));
      });
      expect(answer(view)).toBe('');

      act(() => vi.advanceTimersToNextFrame());
      expect(answer(view)).toBe('abc');
    });

    it('never re-applies a pending chunk over the completion reload', async () => {
      const reloaded = makeConversation({
        messages: [
          { role: MessageRole.User, content: 'question', timestamp: 't0' },
          { role: MessageRole.Assistant, content: 'final', timestamp: 't1' },
        ],
      });
      vi.mocked(transport.getConversation).mockResolvedValue(reloaded);
      const view = await renderBatched();

      act(() => capturedOptions?.onChunk(textChunk('partial')));
      await act(async () => {
        await capturedOptions?.onComplete();
      });
      act(() => vi.advanceTimersToNextFrame());

      expect(answer(view)).toBe('final');
    });

    it('sends the answer text shown so far with Stop', async () => {
      const view = await renderBatched();

      act(() => capturedOptions?.onChunk(textChunk('partial')));
      act(() => view.result.current.stream.handleStop());

      expect(transport.stopCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'partial' }),
      );
    });

    it('shows the received text together with the failure', async () => {
      const view = await renderBatched();

      act(() => capturedOptions?.onChunk(textChunk('partial')));
      act(() => capturedOptions?.onError(new Error('boom')));

      expect(view.result.current.conversation?.messages[1]).toMatchObject({
        content: 'partial',
        streamErrorMessage: '',
      });
    });

    it('shows the received text as soon as the user stops', async () => {
      const view = await renderBatched();

      act(() => capturedOptions?.onChunk(textChunk('partial')));
      act(() => view.result.current.stream.handleStop());

      expect(answer(view)).toBe('partial');
    });

    it('flushes before a superseding generation and ignores the old one', async () => {
      const view = await renderBatched();
      const firstOptions = capturedOptions;

      act(() => firstOptions?.onChunk(textChunk('first')));
      await act(async () => {
        view.result.current.stream.startStream(
          'bucket/conv',
          'question',
          1,
          'gpt-4o',
        );
      });
      expect(answer(view)).toBe('first');

      act(() => firstOptions?.onChunk(textChunk(' stale')));
      act(() => vi.advanceTimersToNextFrame());
      expect(answer(view)).toBe('first');
    });

    it('drops the pending write when the conversation is left, keeping the buffer', async () => {
      const view = await renderBatched();

      act(() => capturedOptions?.onChunk(textChunk('partial')));
      view.rerender({ conversationId: 'bucket/other' });
      act(() => vi.advanceTimersToNextFrame());

      expect(answer(view)).toBe('');
      expect(
        view.result.current.stream.restoreBufferedGeneration(
          'bucket/conv',
          streaming(),
        ).messages[1].content,
      ).toBe('partial');
    });

    it('applies every chunk synchronously when batching is off', async () => {
      const view = await renderBatched(false);

      act(() => capturedOptions?.onChunk(textChunk('a')));

      expect(answer(view)).toBe('a');
    });
  });
});
