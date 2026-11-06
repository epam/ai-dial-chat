import { MessageRole } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GENERATION_CONFLICT_MESSAGE,
  GenerationConflictError,
  StreamUpstreamError,
} from '../../create-chat-stream-api';
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
});
